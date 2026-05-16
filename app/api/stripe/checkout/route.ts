import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession, createCustomer, PRICE_IDS } from '@/lib/stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BILLABLE_PLANS = ['pro', 'power'] as const
type BillablePlan = (typeof BILLABLE_PLANS)[number]

function isBillablePlan(plan: unknown): plan is BillablePlan {
  return typeof plan === 'string' && BILLABLE_PLANS.includes(plan as BillablePlan)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { plan?: unknown }
    const plan = body.plan

    if (!isBillablePlan(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Choose pro or power.' },
        { status: 400 }
      )
    }

    // Get the authenticated user
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const service = await createServiceClient()
    if (!service) {
      return NextResponse.json(
        { error: 'Billing persistence is not configured yet.' },
        { status: 503 }
      )
    }

    // Get billing identifiers through the server trust boundary.
    const { data: profileData } = await (service as any)
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const profile = profileData as { stripe_customer_id: string | null } | null
    let customerId = profile?.stripe_customer_id

    // Create a Stripe customer if one doesn't exist
    if (!customerId) {
      const customer = await createCustomer(user.email || '', user.user_metadata?.full_name)
      if (!customer) {
        return NextResponse.json(
          { error: 'Failed to create customer' },
          { status: 500 }
        )
      }

      customerId = customer.id

      // Save the customer ID to the profile
      await (service as any)
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Derive the Stripe price from server configuration only. Clients choose
    // a product plan; they never get to supply the chargeable price id.
    const actualPriceId = PRICE_IDS[plan]

    // Guard against running with placeholder env. Failing fast here is far
    // better than sending the user to Stripe with an invalid price id.
    if (!actualPriceId || actualPriceId.includes('placeholder')) {
      console.error('Stripe price id not configured for plan:', plan)
      return NextResponse.json(
        {
          error: 'Billing is not configured yet. Please contact support.',
        },
        { status: 503 }
      )
    }

    // Create the checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await createCheckoutSession(
      customerId,
      actualPriceId,
      `${appUrl}/settings?checkout=success`,
      `${appUrl}/settings?checkout=cancelled`
    )

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
