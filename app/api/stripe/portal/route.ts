import { NextResponse } from 'next/server'
import { createBillingPortalSession } from '@/lib/stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: 'Billing is not configured yet' }, { status: 503 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await createServiceClient()
    if (!service) {
      return NextResponse.json({ error: 'Billing is not configured yet' }, { status: 503 })
    }

    const { data: profile, error: profileError } = await (service as any)
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Error loading billing profile:', profileError)
      return NextResponse.json({ error: 'Billing profile is not available yet' }, { status: 500 })
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await createBillingPortalSession(
      profile.stripe_customer_id,
      `${appUrl}/settings?tab=billing`
    )

    if (!session?.url) {
      return NextResponse.json({ error: 'Unable to open billing portal' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating billing portal session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
