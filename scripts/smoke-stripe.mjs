#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const PLAN_LIMITS = {
  free: { tasksPerMonth: 25, agentExecutionsPerMonth: 0 },
  pro: { tasksPerMonth: -1, agentExecutionsPerMonth: 50 },
  power: { tasksPerMonth: -1, agentExecutionsPerMonth: -1 },
  team: { tasksPerMonth: -1, agentExecutionsPerMonth: -1 },
}

if (!secretKey || !proPriceId || !powerPriceId) {
  console.error('Missing STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, or STRIPE_POWER_PRICE_ID.')
  process.exit(1)
}

if (allowWebhook && !allowWrite) {
  console.error('Webhook smoke creates disposable Stripe and Supabase data. Pass --write --webhook.')
  process.exit(1)
}

if (allowWebhook && (!webhookSecret || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey)) {
  console.error(
    'Webhook smoke requires STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.'
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

function createSupabaseAdminClient() {
  return createSupabaseJsClient(supabaseUrl, supabaseServiceRoleKey, {
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
  const password = `Nexdo-stripe-smoke-${randomUUID()}!aA1`
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
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

      if (profile?.id) return { userId, email, password }

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

function quotaWouldAllow(profile, kind, quantity = 1) {
  const plan = PLAN_LIMITS[profile.subscription_tier]
  if (!plan) fail(`unknown plan in quota smoke: ${profile.subscription_tier}`)

  const limit =
    kind === 'task_create'
      ? plan.tasksPerMonth
      : plan.agentExecutionsPerMonth
  const used =
    kind === 'task_create'
      ? profile.task_count_this_month
      : profile.agent_executions_this_month

  return limit === -1 || used + quantity <= limit
}

function createCookieJar() {
  const cookies = new Map()

  return {
    getAll() {
      return Array.from(cookies.entries()).map(([name, value]) => ({ name, value }))
    },
    setAll(cookiesToSet) {
      for (const { name, value, options } of cookiesToSet) {
        if (!value || options?.maxAge === 0) {
          cookies.delete(name)
        } else {
          cookies.set(name, value)
        }
      }
    },
    header() {
      return Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    },
  }
}

async function createSmokeSessionCookie({ email, password }) {
  const jar = createCookieJar()
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: false,
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (cookiesToSet) => jar.setAll(cookiesToSet),
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    fail('failed to create authenticated smoke session', error?.message)
  }

  const cookieHeader = jar.header()
  if (!cookieHeader) fail('authenticated smoke session did not set Supabase cookies')
  return cookieHeader
}

async function postAuthenticatedTask(cookieHeader, title) {
  const response = await fetch(`${appUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      title,
      raw_input: title,
      context: 'Stripe webhook smoke task quota action.',
      priority: 'medium',
      source: 'stripe_smoke',
    }),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  return { response, data }
}

async function loadTaskCount(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('task_count_this_month')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) fail('failed to load smoke task count', error?.message)
  return data.task_count_this_month ?? 0
}

async function verifyAuthenticatedTaskQuotaAction({
  supabase,
  userId,
  cookieHeader,
  expectedTier,
  expectAllowed,
}) {
  const before = await loadTaskCount(supabase, userId)
  const title = `Stripe app quota smoke ${expectedTier} ${new Date().toISOString()}`
  const { response, data } = await postAuthenticatedTask(cookieHeader, title)

  if (expectAllowed) {
    if (!response.ok) {
      fail(
        `${expectedTier} authenticated task_create action failed with ${response.status}`,
        JSON.stringify(data)
      )
    }

    if (!data?.id || data.user_id !== userId || data.title !== title) {
      fail(`${expectedTier} authenticated task_create response did not return the created task`)
    }

    const after = await loadTaskCount(supabase, userId)
    if (after !== before + 1) {
      fail(`${expectedTier} authenticated task_create did not consume task quota`)
    }

    console.log(`ok authenticated task_create quota action ${expectedTier}`)
    return
  }

  if (response.status !== 402 || data?.tier !== expectedTier) {
    fail(
      `${expectedTier} authenticated task_create limit should fail with 402`,
      JSON.stringify(data)
    )
  }

  const { data: existing, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)

  if (error) fail('failed to verify denied task_create cleanup', error.message)
  if ((existing ?? []).length > 0) {
    fail(`${expectedTier} denied task_create still inserted a task`)
  }

  console.log(`ok authenticated task_create quota denial ${expectedTier}`)
}

async function setUsageState(supabase, userId, fields) {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select('subscription_tier, task_count_this_month, agent_executions_this_month')
    .maybeSingle()

  if (error || !data) fail('failed to set smoke quota state', error?.message)
  return data
}

async function verifyQuotaPlanState(supabase, userId, expectedTier) {
  const plan = PLAN_LIMITS[expectedTier]
  if (!plan) fail(`unknown expected tier in quota smoke: ${expectedTier}`)

  let profile = await setUsageState(supabase, userId, {
    task_count_this_month:
      plan.tasksPerMonth === -1 ? 100000 : Math.max(plan.tasksPerMonth - 1, 0),
    agent_executions_this_month:
      plan.agentExecutionsPerMonth === -1
        ? 100000
        : Math.max(plan.agentExecutionsPerMonth - 1, 0),
  })

  if (profile.subscription_tier !== expectedTier) {
    fail(`quota smoke expected ${expectedTier}, got ${profile.subscription_tier}`)
  }

  if (!quotaWouldAllow(profile, 'task_create')) {
    fail(`${expectedTier} task quota denied at expected allowed boundary`)
  }

  if (plan.tasksPerMonth !== -1) {
    profile = await setUsageState(supabase, userId, {
      task_count_this_month: plan.tasksPerMonth,
    })
    if (quotaWouldAllow(profile, 'task_create')) {
      fail(`${expectedTier} task quota allowed over monthly task limit`)
    }
  }

  profile = await setUsageState(supabase, userId, {
    agent_executions_this_month:
      plan.agentExecutionsPerMonth === -1
        ? 100000
        : Math.max(plan.agentExecutionsPerMonth - 1, 0),
  })

  const shouldAllowAgent = plan.agentExecutionsPerMonth !== 0
  if (quotaWouldAllow(profile, 'agent_execute') !== shouldAllowAgent) {
    fail(`${expectedTier} agent quota boundary did not match plan`)
  }

  if (plan.agentExecutionsPerMonth > 0) {
    profile = await setUsageState(supabase, userId, {
      agent_executions_this_month: plan.agentExecutionsPerMonth,
    })
    if (quotaWouldAllow(profile, 'agent_execute')) {
      fail(`${expectedTier} agent quota allowed over monthly execution limit`)
    }
  }

  console.log(`ok quota plan state ${expectedTier}`)
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
  const supabase = createSupabaseAdminClient()
  let customer = null
  let userId = null
  let cookieHeader = null
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

    const smokeProfile = await createSmokeProfile(supabase, customer.id)
    userId = smokeProfile.userId
    console.log('ok webhook smoke profile bind')
    cookieHeader = await createSmokeSessionCookie(smokeProfile)
    console.log('ok webhook smoke app session')

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
    await verifyQuotaPlanState(supabase, userId, 'free')
    await verifyAuthenticatedTaskQuotaAction({
      supabase,
      userId,
      cookieHeader,
      expectedTier: 'free',
      expectAllowed: false,
    })

    const proEvent = subscriptionEvent({
      id: `evt_nexdo_pro_${randomUUID()}`,
      type: 'customer.subscription.updated',
      customerId: customer.id,
      priceId: proPriceId,
      status: 'active',
    })
    eventIds.push(proEvent.id)
    await postSignedWebhook(proEvent)
    await waitForProfileTier(supabase, userId, 'pro')
    console.log('ok webhook subscription.updated -> pro')
    await verifyQuotaPlanState(supabase, userId, 'pro')
    await verifyAuthenticatedTaskQuotaAction({
      supabase,
      userId,
      cookieHeader,
      expectedTier: 'pro',
      expectAllowed: true,
    })

    const powerEvent = subscriptionEvent({
      id: `evt_nexdo_power_${randomUUID()}`,
      type: 'customer.subscription.updated',
      customerId: customer.id,
      priceId: powerPriceId,
      status: 'active',
    })
    eventIds.push(powerEvent.id)
    await postSignedWebhook(powerEvent)
    await waitForProfileTier(supabase, userId, 'power')
    console.log('ok webhook subscription.updated -> power')
    await verifyQuotaPlanState(supabase, userId, 'power')
    await verifyAuthenticatedTaskQuotaAction({
      supabase,
      userId,
      cookieHeader,
      expectedTier: 'power',
      expectAllowed: true,
    })

    const duplicate = await postSignedWebhook(powerEvent)
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
    await verifyQuotaPlanState(supabase, userId, 'free')
    await verifyAuthenticatedTaskQuotaAction({
      supabase,
      userId,
      cookieHeader,
      expectedTier: 'free',
      expectAllowed: false,
    })
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
