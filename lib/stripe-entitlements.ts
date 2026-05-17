import type { SubscriptionTier } from './database.types'
import { isUsableEnv } from './env'

type StripeEntitlementTier = Extract<SubscriptionTier, 'pro' | 'power'>

type StripePriceConfig = Partial<Record<StripeEntitlementTier, string | null | undefined>>

export function tierForStripePriceId(
  priceId: string | null | undefined,
  priceIds: StripePriceConfig = {
    pro: process.env.STRIPE_PRO_PRICE_ID,
    power: process.env.STRIPE_POWER_PRICE_ID,
  }
): StripeEntitlementTier | null {
  if (!isUsableEnv(priceId)) return null

  if (isUsableEnv(priceIds.power) && priceId === priceIds.power) {
    return 'power'
  }

  if (isUsableEnv(priceIds.pro) && priceId === priceIds.pro) {
    return 'pro'
  }

  return null
}
