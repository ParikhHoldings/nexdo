import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession, createCustomer, PRICE_IDS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { priceId, plan } = await request.json()

    // Get the authenticated user
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the user's profile
    const { data: profileData } = await supabase
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
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Get the correct price ID
    const actualPriceId = priceId || (plan === 'pro' ? PRICE_IDS.pro : PRICE_IDS.power)

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
