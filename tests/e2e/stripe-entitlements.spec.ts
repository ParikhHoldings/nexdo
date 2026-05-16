import { expect, test } from '@playwright/test'
import { tierForStripePriceId } from '../../lib/stripe-entitlements'

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
