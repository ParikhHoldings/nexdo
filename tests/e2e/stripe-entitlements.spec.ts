import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { tierForStripePriceId } from '../../lib/stripe-entitlements'
import { updateCustomerSubscriptionTier } from '../../lib/stripe-webhook'

test('Stripe price entitlement mapping requires a configured matching price id', () => {
  expect(
    tierForStripePriceId('price_pro_live', {
      pro: 'price_pro_live',
      power: 'price_power_live',
    })
  ).toBe('pro')

  expect(
    tierForStripePriceId('price_power_live', {
      pro: 'price_pro_live',
      power: 'price_power_live',
    })
  ).toBe('power')

  expect(
    tierForStripePriceId('price_unknown', {
      pro: 'price_pro_live',
      power: 'price_power_live',
    })
  ).toBeNull()
})

test('Stripe price entitlement mapping fails closed for missing or placeholder config', () => {
  expect(
    tierForStripePriceId(undefined, {
      pro: undefined,
      power: undefined,
    })
  ).toBeNull()

  expect(
    tierForStripePriceId('price_power_live', {
      pro: 'price_pro_placeholder',
      power: undefined,
    })
  ).toBeNull()

  expect(
    tierForStripePriceId('price_pro_placeholder', {
      pro: 'price_pro_placeholder',
      power: 'price_power_placeholder',
    })
  ).toBeNull()
})

function profileUpdateClient({
  profile,
  error = null,
}: {
  profile?: { id: string; stripe_customer_id: string; subscription_tier: string }
  error?: { message: string } | null
}) {
  return {
    from: (table: string) => {
      expect(table).toBe('profiles')
      return {
        update: (fields: Record<string, unknown>) => ({
          eq: (field: string, value: string) => ({
            select: (columns: string) => ({
              maybeSingle: async () => {
                expect(fields).toEqual({ subscription_tier: 'power' })
                expect(field).toBe('stripe_customer_id')
                expect(value).toBe('cus_launch')
                expect(columns).toBe('id')
                if (error) return { data: null, error }
                if (!profile || profile.stripe_customer_id !== value) {
                  return { data: null, error: null }
                }

                profile.subscription_tier = String(fields.subscription_tier)
                return { data: { id: profile.id }, error: null }
              },
            }),
          }),
        }),
      }
    },
  }
}

test('Stripe webhook profile tier updates fail unless a profile row is written', async () => {
  const profile = {
    id: 'profile-1',
    stripe_customer_id: 'cus_launch',
    subscription_tier: 'free',
  }

  await expect(
    updateCustomerSubscriptionTier(profileUpdateClient({ profile }), 'cus_launch', 'power')
  ).resolves.toEqual({ id: 'profile-1' })
  expect(profile.subscription_tier).toBe('power')

  await expect(
    updateCustomerSubscriptionTier(profileUpdateClient({}), 'cus_launch', 'power')
  ).rejects.toThrow('No profile found')

  await expect(
    updateCustomerSubscriptionTier(
      profileUpdateClient({ error: { message: 'database unavailable' } }),
      'cus_launch',
      'power'
    )
  ).rejects.toThrow('Failed to update subscription tier')
})

test('Stripe webhook smoke verifies quota plan state after tier changes', () => {
  const source = readFileSync('scripts/smoke-stripe.mjs', 'utf8')

  expect(source).toContain('const PLAN_LIMITS = {')
  expect(source).toContain('verifyQuotaPlanState(supabase, userId,')
  expect(source).toContain("await verifyQuotaPlanState(supabase, userId, 'free')")
  expect(source).toContain("await verifyQuotaPlanState(supabase, userId, 'pro')")
  expect(source).toContain("await verifyQuotaPlanState(supabase, userId, 'power')")
  expect(source).toContain("priceId: proPriceId")
  expect(source).toContain("priceId: powerPriceId")
  expect(source).toContain('quotaWouldAllow(profile,')
})
