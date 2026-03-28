import Stripe from 'stripe'

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey || secretKey.includes('placeholder')) {
    return null
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  })
}

export const stripe = getStripeClient()

// Price IDs - these should be created in Stripe Dashboard
export const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder',
  power: process.env.STRIPE_POWER_PRICE_ID || 'price_power_placeholder',
} as const

// Plan limits
export const PLAN_LIMITS = {
  free: {
    tasks_per_month: 25,
    agent_executions_per_month: 0,
    features: ['Basic task management', 'AI task parsing', 'Daily briefing (preview)'],
  },
  pro: {
    tasks_per_month: -1, // unlimited
    agent_executions_per_month: 50,
    price: 15,
    features: [
      'Unlimited tasks',
      'AI task parsing',
      'Daily briefing',
      '50 agent executions/month',
      'Priority support',
    ],
  },
  power: {
    tasks_per_month: -1,
    agent_executions_per_month: -1,
    price: 30,
    features: [
      'Everything in Pro',
      'Unlimited agent executions',
      'API access',
      'Agent integrations (coming soon)',
      'Priority support',
    ],
  },
  team: {
    tasks_per_month: -1,
    agent_executions_per_month: -1,
    price: null, // Contact sales
    features: [
      'Everything in Power',
      'Team collaboration',
      'Admin controls',
      'SSO',
      'Custom integrations',
    ],
  },
} as const

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) return null

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    })

    return session
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return null
  }
}

export async function createCustomer(
  email: string,
  name?: string
): Promise<Stripe.Customer | null> {
  if (!stripe) return null

  try {
    const customer = await stripe.customers.create({
      email,
      name,
    })
    return customer
  } catch (error) {
    console.error('Error creating customer:', error)
    return null
  }
}

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null

  try {
    return await stripe.subscriptions.retrieve(subscriptionId)
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null

  try {
    return await stripe.subscriptions.cancel(subscriptionId)
  } catch (error) {
    console.error('Error canceling subscription:', error)
    return null
  }
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session | null> {
  if (!stripe) return null

  try {
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
  } catch (error) {
    console.error('Error creating billing portal session:', error)
    return null
  }
}
