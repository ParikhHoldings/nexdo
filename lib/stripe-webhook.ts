import type { SubscriptionTier } from '@/lib/database.types'

export async function updateCustomerSubscriptionTier(
  supabase: any,
  customerId: string,
  tier: SubscriptionTier
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ subscription_tier: tier })
    .eq('stripe_customer_id', customerId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to update subscription tier for ${customerId}`)
  }

  if (!data) {
    throw new Error(`No profile found for Stripe customer ${customerId}`)
  }

  return data as { id: string }
}
