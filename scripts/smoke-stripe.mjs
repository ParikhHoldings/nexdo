#!/usr/bin/env node

import Stripe from 'stripe'

const args = new Set(process.argv.slice(2))
const allowWrite = args.has('--write')
const allowLive = args.has('--live')

const secretKey = process.env.STRIPE_SECRET_KEY
const proPriceId = process.env.STRIPE_PRO_PRICE_ID
const powerPriceId = process.env.STRIPE_POWER_PRICE_ID
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

if (!secretKey || !proPriceId || !powerPriceId) {
  console.error('Missing STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, or STRIPE_POWER_PRICE_ID.')
  process.exit(1)
}

if (!allowLive && !secretKey.startsWith('sk_test_')) {
  console.error('Refusing to smoke Stripe with a non-test secret key. Pass --live only after approval.')
  process.exit(1)
}

const stripe = new Stripe(secretKey, {
  apiVersion: '2025-02-24.acacia',
})

function fail(message, detail) {
  if (detail) console.error(detail)
  throw new Error(message)
}

async function verifyPrice(priceId, label) {
  const price = await stripe.prices.retrieve(priceId)
  if (!price.active) fail(`${label} price is inactive: ${priceId}`)
  if (price.type !== 'recurring') fail(`${label} price is not recurring: ${priceId}`)
  if (!price.currency) fail(`${label} price has no currency: ${priceId}`)
  console.log(`ok ${label} price (${price.currency} ${price.unit_amount ?? 'usage'})`)
  return price
}

async function readSmoke() {
  const account = await stripe.accounts.retrieve()
  if (!account.id) fail('Stripe account retrieval returned no account id')
  console.log(`ok account ${account.id}`)

  await verifyPrice(proPriceId, 'pro')
  await verifyPrice(powerPriceId, 'power')
}

async function writeSmoke() {
  let customer = null
  try {
    customer = await stripe.customers.create({
      email: `nexdo-stripe-smoke-${Date.now()}@example.com`,
      name: 'Nexdo Stripe Smoke Test',
      metadata: {
        source: 'nexdo-smoke-stripe',
      },
    })
    console.log(`ok customer create ${customer.id}`)

    const checkout = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      line_items: [{ price: proPriceId, quantity: 1 }],
      success_url: `${appUrl}/settings?checkout=success`,
      cancel_url: `${appUrl}/settings?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        source: 'nexdo-smoke-stripe',
      },
    })
    if (!checkout.id || !checkout.url) fail('checkout session missing id or url')
    console.log(`ok checkout session ${checkout.id}`)

    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${appUrl}/settings`,
    })
    if (!portal.id || !portal.url) fail('billing portal session missing id or url')
    console.log(`ok billing portal session ${portal.id}`)
  } finally {
    if (customer?.id) {
      const deleted = await stripe.customers.del(customer.id)
      if (!deleted.deleted) {
        console.error(`warning: failed to delete smoke customer ${customer.id}`)
      } else {
        console.log('ok customer delete')
      }
    }
  }
}

async function main() {
  console.log('Smoking Stripe billing configuration')
  await readSmoke()

  if (allowWrite) {
    await writeSmoke()
  } else {
    console.log('skip write checks; pass --write to create disposable Stripe test objects')
  }

  console.log('Stripe smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
