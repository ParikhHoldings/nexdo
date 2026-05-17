#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const allowWrite = args.has('--write')
const allowLive = args.has('--live')
const allowWebhook = args.has('--webhook')

const secretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const proPriceId = process.env.STRIPE_PRO_PRICE_ID
const powerPriceId = process.env.STRIPE_POWER_PRICE_ID
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!secretKey || !proPriceId || !powerPriceId) {
  console.error('Missing STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, or STRIPE_POWER_PRICE_ID.')
  process.exit(1)
}

if (allowWebhook && !allowWrite) {
  console.error('Webhook smoke creates disposable Stripe and Supabase data. Pass --write --webhook.')
  process.exit(1)
}

if (allowWebhook && (!webhookSecret || !supabaseUrl || !supabaseServiceRoleKey)) {
  console.error(
    'Webhook smoke requires STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.'
  )
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function postSignedWebhook(event) {
  const payload = JSON.stringify(event)
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  })

  const response = await fetch(`${appUrl}/api/stripe/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
    },
    body: payload,
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    fail(`webhook ${event.type} failed with ${response.status}`, JSON.stringify(data))
  }

  return data
}

function subscriptionEvent({ id, type, customerId, priceId, status }) {
  return {
    id,
    object: 'event',
    api_version: '2025-02-24.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `sub_${randomUUID().replace(/-/g, '')}`,
        object: 'subscription',
        customer: customerId,
        status,
        items: {
          object: 'list',
          data: [
            {
              id: `si_${randomUUID().replace(/-/g, '')}`,
              object: 'subscription_item',
              price: {
                id: priceId,
                object: 'price',
              },
            },
          ],
        },
      },
    },
    livemode: allowLive,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type,
  }
}

async function createSmokeProfile(supabase, customerId) {
  const email = `nexdo-stripe-webhook-smoke-${Date.now()}@example.com`
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: 'Nexdo Stripe Webhook Smoke',
    },
  })

  if (error || !data.user?.id) {
    fail('failed to create Supabase smoke user', error?.message)
  }

  const userId = data.user.id

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data: profile, error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customerId,
          subscription_tier: 'free',
        })
        .eq('id', userId)
        .select('id')
        .maybeSingle()

      if (updateError) {
        fail('failed to bind Stripe customer to smoke profile', updateError.message)
      }

      if (profile?.id) return userId

      await sleep(500)
    }

    fail('profile trigger did not create a smoke profile row in time')
  } catch (error) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('warning: failed to delete smoke Supabase user after setup failure', deleteError)
    }
    throw error
  }
}

async function waitForProfileTier(supabase, userId, expectedTier) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle()

    if (error) fail('failed to load smoke profile tier', error.message)
    if (data?.subscription_tier === expectedTier) return

    await sleep(500)
  }

  fail(`profile tier did not become ${expectedTier}`)
}

async function cleanupWebhookSmoke({ supabase, customerId, userId, eventIds }) {
  if (eventIds.length > 0) {
    const { error } = await supabase.from('stripe_events').delete().in('id', eventIds)
    if (error) console.error('warning: failed to clean smoke stripe_events', error)
  }

  if (userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) console.error('warning: failed to delete smoke Supabase user', error)
  }

  if (customerId) {
    const deleted = await stripe.customers.del(customerId)
    if (!deleted.deleted) {
      console.error(`warning: failed to delete smoke customer ${customerId}`)
    }
  }
}

async function webhookSmoke() {
  const supabase = createSupabaseClient()
  let customer = null
  let userId = null
  const eventIds = []

  try {
    customer = await stripe.customers.create({
      email: `nexdo-stripe-webhook-smoke-${Date.now()}@example.com`,
      name: 'Nexdo Stripe Webhook Smoke',
      metadata: {
        source: 'nexdo-smoke-stripe-webhook',
      },
    })
    console.log(`ok webhook customer create ${customer.id}`)

    userId = await createSmokeProfile(supabase, customer.id)
    console.log('ok webhook smoke profile bind')

    const unknownPriceEvent = subscriptionEvent({
      id: `evt_nexdo_unknown_${randomUUID()}`,
      type: 'customer.subscription.updated',
      customerId: customer.id,
      priceId: `price_unknown_${randomUUID()}`,
      status: 'active',
    })
    eventIds.push(unknownPriceEvent.id)
    await postSignedWebhook(unknownPriceEvent)
    await waitForProfileTier(supabase, userId, 'free')
    console.log('ok webhook unknown price leaves tier unchanged')

    const activeEvent = subscriptionEvent({
      id: `evt_nexdo_active_${randomUUID()}`,
      type: 'customer.subscription.updated',
      customerId: customer.id,
      priceId: powerPriceId,
      status: 'active',
    })
    eventIds.push(activeEvent.id)
    await postSignedWebhook(activeEvent)
    await waitForProfileTier(supabase, userId, 'power')
    console.log('ok webhook subscription.updated -> power')

    const duplicate = await postSignedWebhook(activeEvent)
    if (!duplicate?.duplicate) fail('duplicate webhook did not report duplicate replay')
    await waitForProfileTier(supabase, userId, 'power')
    console.log('ok webhook duplicate idempotency')

    const deletedEvent = subscriptionEvent({
      id: `evt_nexdo_deleted_${randomUUID()}`,
      type: 'customer.subscription.deleted',
      customerId: customer.id,
      priceId: powerPriceId,
      status: 'canceled',
    })
    eventIds.push(deletedEvent.id)
    await postSignedWebhook(deletedEvent)
    await waitForProfileTier(supabase, userId, 'free')
    console.log('ok webhook subscription.deleted -> free')
  } finally {
    await cleanupWebhookSmoke({
      supabase,
      customerId: customer?.id,
      userId,
      eventIds,
    })
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

  if (allowWebhook) {
    await webhookSmoke()
  } else {
    console.log('skip webhook checks; pass --write --webhook to verify signed webhook handling')
  }

  console.log('Stripe smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
