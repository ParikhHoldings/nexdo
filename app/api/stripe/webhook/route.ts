import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { tierForStripePriceId } from '@/lib/stripe-entitlements'
import { updateCustomerSubscriptionTier } from '@/lib/stripe-webhook'

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  // Idempotency: Stripe retries on non-2xx, and at-least-once delivery
  // can replay successful events. Record-and-skip makes this safe.
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string | null
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        // Only activate the plan if Stripe reports an active/trialing sub.
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          console.warn(
            `Ignoring checkout.session.completed for sub ${subscriptionId} in status ${subscription.status}`
          )
          break
        }

        const priceId = subscription.items.data[0]?.price.id
        const tier = tierForStripePriceId(priceId)
        if (!tier) {
          console.warn('Stripe webhook: unrecognized priceId, skipping tier update:', priceId)
          break
        }

        await updateCustomerSubscriptionTier(supabase, customerId, tier)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price.id

        // Past-due / unpaid / canceled subs should not retain paid tier.
        if (
          subscription.status !== 'active' &&
          subscription.status !== 'trialing'
        ) {
          await updateCustomerSubscriptionTier(supabase, customerId, 'free')
          break
        }

        const tier = tierForStripePriceId(priceId)
        if (!tier) {
          console.warn('Stripe webhook: unrecognized priceId, skipping tier update:', priceId)
          break
        }

        await updateCustomerSubscriptionTier(supabase, customerId, tier)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await updateCustomerSubscriptionTier(supabase, customerId, 'free')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.log('Payment failed for customer:', customerId)
        // TODO(post-launch): send dunning email; Stripe will retry the invoice.
        break
      }
    }

    // Record the event AFTER successful processing. If we crashed above,
    // Stripe will retry and we'll try again.
    await supabase
      .from('stripe_events')
      .insert({ id: event.id, type: event.type })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
