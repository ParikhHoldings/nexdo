#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const allowWrite = args.has('--write')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function authedClient(accessToken) {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

function fail(message, detail) {
  if (detail) console.error(detail)
  throw new Error(message)
}

async function assertQuery(label, promise) {
  const { error } = await promise
  if (error) fail(`${label} failed`, error)
  console.log(`ok ${label}`)
}

async function readSmoke() {
  await assertQuery(
    'profiles schema',
    service
      .from('profiles')
      .select('id, api_key, api_key_hash, api_key_hint, api_key_scopes, api_key_last_used_at')
      .limit(1)
  )

  await assertQuery(
    'tasks schema',
    service
      .from('tasks')
      .select('id, user_id, source_agent_id, external_ref, ingestion_intent, agent_metadata')
      .limit(1)
  )

  await assertQuery(
    'agent_action_events schema',
    service
      .from('agent_action_events')
      .select('id, user_id, tool_name, source_agent_id, external_ref, success, duration_ms')
      .limit(1)
  )

  await assertQuery(
    'task_notes schema',
    service.from('task_notes').select('id, task_id, content, note_type, created_at').limit(1)
  )

  await assertQuery(
    'usage_events schema',
    service.from('usage_events').select('id, user_id, event_type, created_at').limit(1)
  )

  await assertQuery(
    'rate_limits schema',
    service.from('rate_limits').select('user_id, bucket, count, window_start').limit(1)
  )

  await assertQuery(
    'stripe_events schema',
    service.from('stripe_events').select('id, type, processed_at').limit(1)
  )
}

async function waitForProfile(userId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await service
      .from('profiles')
      .select('id, api_key_scopes')
      .eq('id', userId)
      .maybeSingle()

    if (data && !error) return data
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  fail('profile trigger did not create a profile for the smoke user')
}

async function verifyUsageAndRateLimits(userId) {
  const { count: beforeNoopCount, error: beforeNoopError } = await service
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (beforeNoopError) fail('usage event count before no-op failed', beforeNoopError)

  const { error: noopUsageError } = await service.rpc('increment_usage', {
    p_user_id: userId,
    p_event_type: 'task_create',
    p_quantity: 0,
  })
  if (noopUsageError) fail('increment_usage no-op failed', noopUsageError)

  const { count: afterNoopCount, error: afterNoopError } = await service
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (afterNoopError) fail('usage event count after no-op failed', afterNoopError)
  if (afterNoopCount !== beforeNoopCount) {
    fail('increment_usage quantity 0 wrote a usage event')
  }
  console.log('ok quota no-op reset without audit event')

  const { data: taskUsage, error: taskUsageError } = await service.rpc('increment_usage', {
    p_user_id: userId,
    p_event_type: 'task_create',
    p_quantity: 2,
  })
  if (taskUsageError || !taskUsage?.[0]) {
    fail('increment_usage task_create quantity failed', taskUsageError)
  }
  if (taskUsage[0].task_count_this_month < 2) {
    fail('increment_usage did not increment task counter by quantity')
  }
  console.log('ok task quota increment quantity')

  const { data: agentUsage, error: agentUsageError } = await service.rpc('increment_usage', {
    p_user_id: userId,
    p_event_type: 'agent_execute',
    p_quantity: 1,
  })
  if (agentUsageError || !agentUsage?.[0]) {
    fail('increment_usage agent_execute failed', agentUsageError)
  }
  if (agentUsage[0].agent_executions_this_month < 1) {
    fail('increment_usage did not increment agent execution counter')
  }
  console.log('ok agent quota increment')

  const bucket = `smoke_api_key_rotate_${Date.now()}`
  const { data: firstGate, error: firstGateError } = await service.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket,
    p_limit: 1,
    p_window_seconds: 60,
  })
  if (firstGateError || firstGate?.[0]?.allowed !== true) {
    fail('consume_rate_limit first request failed', firstGateError)
  }

  const { data: secondGate, error: secondGateError } = await service.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket,
    p_limit: 1,
    p_window_seconds: 60,
  })
  if (secondGateError || secondGate?.[0]?.allowed !== false) {
    fail('consume_rate_limit did not block over-limit request', secondGateError)
  }
  console.log('ok rate-limit allow and block')
  return bucket
}

async function writeSmoke() {
  const email = `nexdo-smoke-${Date.now()}@example.com`
  const password = `Nexdo-smoke-${crypto.randomUUID()}!`
  let userId = null
  const stripeEventIds = []

  try {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Nexdo Smoke Test' },
    })
    if (createError || !created.user) fail('smoke user creation failed', createError)
    userId = created.user.id
    console.log('ok auth admin create user')

    const profile = await waitForProfile(userId)
    if (!Array.isArray(profile.api_key_scopes)) {
      fail('profile did not include api_key_scopes')
    }
    console.log('ok profile trigger')

    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError || !signedIn.session?.access_token) {
      fail('smoke user sign-in failed', signInError)
    }
    console.log('ok auth sign-in')

    const userClient = authedClient(signedIn.session.access_token)
    const { data: allowedProfile, error: profileReadError } = await userClient
      .from('profiles')
      .select('id, full_name, api_key_hint, api_key_scopes')
      .eq('id', userId)
      .single()
    if (profileReadError || allowedProfile.id !== userId) {
      fail('allowed profile column read failed', profileReadError)
    }
    console.log('ok profile self-read allowed columns')

    const { error: profileInsertError } = await userClient
      .from('profiles')
      .insert({
        id: userId,
        full_name: 'Nexdo Browser Insert Spoof',
        subscription_tier: 'power',
        api_key_hash: '0'.repeat(64),
        api_key_scopes: ['tasks:read', 'tasks:write', 'briefing:read'],
      })
    if (!profileInsertError) {
      fail('direct profile insert was unexpectedly allowed')
    }
    console.log('ok profile rows require server-owned creation')

    const { error: sensitiveReadError } = await userClient
      .from('profiles')
      .select('api_key_hash, stripe_customer_id')
      .eq('id', userId)
    if (!sensitiveReadError) {
      fail('sensitive profile columns were unexpectedly readable')
    }
    console.log('ok sensitive profile columns cannot be self-read')

    const { error: profileUpdateError } = await userClient
      .from('profiles')
      .update({ full_name: 'Nexdo Smoke Test Updated' })
      .eq('id', userId)
    if (profileUpdateError) fail('allowed profile update failed', profileUpdateError)
    console.log('ok profile self-update allowed fields')

    const invalidProfileUpdates = [
      {
        label: 'blank profile name',
        payload: { full_name: '   ' },
      },
      {
        label: 'oversized profile name',
        payload: { full_name: 'x'.repeat(121) },
      },
      {
        label: 'invalid profile timezone',
        payload: { timezone: 'Not/AZone' },
      },
    ]

    for (const { label, payload } of invalidProfileUpdates) {
      const { error } = await userClient
        .from('profiles')
        .update(payload)
        .eq('id', userId)
      if (!error) fail(`direct profile update accepted ${label}`)
    }
    console.log('ok profile self-update enforces content bounds')

    const { error: tierUpdateError } = await userClient
      .from('profiles')
      .update({ subscription_tier: 'power' })
      .eq('id', userId)
    if (!tierUpdateError) fail('direct subscription_tier update was unexpectedly allowed')
    console.log('ok sensitive profile fields cannot be self-updated')

    const { error: apiScopeUpdateError } = await userClient
      .from('profiles')
      .update({ api_key_scopes: ['tasks:read', 'tasks:write', 'briefing:read'] })
      .eq('id', userId)
    if (!apiScopeUpdateError) fail('direct api_key_scopes update was unexpectedly allowed')
    console.log('ok API key scopes require server route')

    const { error: protectedInsertError } = await userClient
      .from('tasks')
      .insert({
        user_id: userId,
        title: 'Nexdo protected agent metadata insert',
        source_agent_id: 'browser-spoof',
        external_ref: 'browser-spoof-ref',
        ingestion_intent: 'create',
        agent_metadata: { unsafe: true },
      })
    if (!protectedInsertError) {
      fail('direct task insert could write server-managed agent metadata')
    }
    console.log('ok direct task insert cannot write agent metadata columns')

    const { error: sourceSpoofInsertError } = await userClient
      .from('tasks')
      .insert({
        user_id: userId,
        title: 'Nexdo browser source spoof insert',
        raw_input: 'Nexdo browser source spoof insert',
        source: 'agent',
      })
    if (!sourceSpoofInsertError) {
      fail('direct task insert could spoof agent source')
    }
    console.log('ok direct task insert cannot spoof task source')

    const invalidTaskInserts = [
      {
        label: 'blank task title',
        payload: {
          user_id: userId,
          title: '   ',
        },
      },
      {
        label: 'oversized task context',
        payload: {
          user_id: userId,
          title: 'Nexdo invalid context smoke task',
          context: 'x'.repeat(4001),
        },
      },
      {
        label: 'out-of-range task estimate',
        payload: {
          user_id: userId,
          title: 'Nexdo invalid estimate smoke task',
          estimated_minutes: 10081,
        },
      },
      {
        label: 'oversized task tag array',
        payload: {
          user_id: userId,
          title: 'Nexdo invalid tags smoke task',
          tags: Array.from({ length: 51 }, (_, index) => `tag-${index}`),
        },
      },
    ]

    for (const { label, payload } of invalidTaskInserts) {
      const { error } = await userClient.from('tasks').insert(payload)
      if (!error) fail(`direct task insert accepted ${label}`)
    }
    console.log('ok direct task insert enforces task content bounds')

    const { data: insertedTask, error: insertError } = await userClient
      .from('tasks')
      .insert({
        user_id: userId,
        title: 'Nexdo Supabase smoke task',
        raw_input: 'Nexdo Supabase smoke task',
      })
      .select('id, status, source, user_id')
      .single()
    if (insertError || !insertedTask?.id) fail('RLS task insert failed', insertError)
    if (insertedTask.source !== 'manual') {
      fail(`RLS task insert defaulted to unexpected source ${insertedTask.source}`)
    }
    console.log('ok RLS task insert')

    const { error: protectedNoteInsertError } = await userClient
      .from('task_notes')
      .insert({
        task_id: insertedTask.id,
        content: 'Spoofed metadata note',
        note_type: 'agent_result',
        created_at: '2000-01-01T00:00:00.000Z',
      })
    if (!protectedNoteInsertError) {
      fail('direct task note insert could write server-managed note metadata')
    }
    console.log('ok direct task note insert cannot write metadata columns')

    const { data: insertedNote, error: noteInsertError } = await userClient
      .from('task_notes')
      .insert({
        task_id: insertedTask.id,
        content: 'Nexdo Supabase smoke note',
      })
      .select('id, task_id, content, note_type')
      .single()
    if (
      noteInsertError ||
      !insertedNote?.id ||
      insertedNote.task_id !== insertedTask.id ||
      insertedNote.note_type !== 'note'
    ) {
      fail('RLS task note insert failed', noteInsertError)
    }
    console.log('ok RLS task note insert')

    const { error: longNoteInsertError } = await userClient
      .from('task_notes')
      .insert({
        task_id: insertedTask.id,
        content: 'x'.repeat(2001),
      })
    if (!longNoteInsertError) {
      fail('direct task note insert could bypass content length limit')
    }
    console.log('ok direct task note insert enforces content length')

    const { data: updatedTask, error: updateError } = await userClient
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', insertedTask.id)
      .select('id, status')
      .single()
    if (updateError || updatedTask.status !== 'done') {
      fail('RLS task update failed', updateError)
    }
    console.log('ok RLS task update')

    const { error: sourceSpoofUpdateError } = await userClient
      .from('tasks')
      .update({ source: 'agent' })
      .eq('id', insertedTask.id)
    if (!sourceSpoofUpdateError) {
      fail('direct task update could spoof agent source')
    }
    console.log('ok direct task update cannot spoof task source')

    const { error: contentBoundUpdateError } = await userClient
      .from('tasks')
      .update({ title: '   ' })
      .eq('id', insertedTask.id)
    if (!contentBoundUpdateError) {
      fail('direct task update could bypass task content bounds')
    }
    console.log('ok direct task update enforces task content bounds')

    const { error: protectedTaskUpdateError } = await userClient
      .from('tasks')
      .update({
        agent_output: { spoofed: true },
        source_agent_id: 'browser-spoof',
        external_ref: 'browser-spoof-ref',
        ingestion_intent: 'update',
        agent_metadata: { unsafe: true },
        completed_at: new Date().toISOString(),
      })
      .eq('id', insertedTask.id)
    if (!protectedTaskUpdateError) {
      fail('direct task update could write server-managed columns')
    }
    console.log('ok direct task update cannot write server-managed columns')

    const agentExternalRef = `supabase-unique-${Date.now()}`
    const { error: firstAgentInsertError } = await service
      .from('tasks')
      .insert({
        user_id: userId,
        title: 'Nexdo Supabase idempotency task',
        source: 'agent',
        source_agent_id: 'nexdo-smoke',
        external_ref: agentExternalRef,
        ingestion_intent: 'create',
      })
    if (firstAgentInsertError) {
      fail('agent idempotency seed insert failed', firstAgentInsertError)
    }

    const { error: duplicateAgentInsertError } = await service
      .from('tasks')
      .insert({
        user_id: userId,
        title: 'Nexdo Supabase duplicate idempotency task',
        source: 'agent',
        source_agent_id: 'nexdo-smoke',
        external_ref: agentExternalRef,
        ingestion_intent: 'create',
      })
    if (!duplicateAgentInsertError) {
      fail('agent idempotency unique index did not reject duplicate external ref')
    }
    console.log('ok agent external-ref idempotency unique index')

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: leakedTasks, error: leakCheckError } = await publicClient
      .from('tasks')
      .select('id')
      .eq('id', insertedTask.id)
    if (leakCheckError) fail('public RLS leak check failed', leakCheckError)
    if ((leakedTasks || []).length > 0) fail('public client could read a private task')
    console.log('ok public RLS isolation')

    const stripeEventId = `evt_nexdo_smoke_${Date.now()}`
    stripeEventIds.push(stripeEventId)
    const { error: stripeEventInsertError } = await service
      .from('stripe_events')
      .insert({ id: stripeEventId, type: 'nexdo.smoke' })
    if (stripeEventInsertError) {
      fail('service role could not insert Stripe event idempotency record', stripeEventInsertError)
    }
    console.log('ok Stripe event idempotency service insert')

    const { data: publicStripeEvents, error: publicStripeReadError } = await publicClient
      .from('stripe_events')
      .select('id')
      .eq('id', stripeEventId)
    if (!publicStripeReadError && (publicStripeEvents || []).length > 0) {
      fail('public client could read Stripe webhook event records')
    }
    console.log('ok public cannot read Stripe webhook event records')

    const { data: userStripeEvents, error: userStripeReadError } = await userClient
      .from('stripe_events')
      .select('id')
      .eq('id', stripeEventId)
    if (!userStripeReadError && (userStripeEvents || []).length > 0) {
      fail('browser client could read Stripe webhook event records')
    }
    console.log('ok browser clients cannot read Stripe webhook event records')

    const publicStripeSpoofId = `evt_nexdo_public_spoof_${Date.now()}`
    stripeEventIds.push(publicStripeSpoofId)
    const { error: publicStripeInsertError } = await publicClient
      .from('stripe_events')
      .insert({ id: publicStripeSpoofId, type: 'nexdo.public_spoof' })
    if (!publicStripeInsertError) {
      fail('public client could insert Stripe webhook event records')
    }

    const userStripeSpoofId = `evt_nexdo_browser_spoof_${Date.now()}`
    stripeEventIds.push(userStripeSpoofId)
    const { error: userStripeInsertError } = await userClient
      .from('stripe_events')
      .insert({ id: userStripeSpoofId, type: 'nexdo.browser_spoof' })
    if (!userStripeInsertError) {
      fail('browser client could insert Stripe webhook event records')
    }
    console.log('ok Stripe webhook event records require service-owned writes')

    const { error: usageInsertError } = await userClient
      .from('usage_events')
      .insert({
        user_id: userId,
        event_type: 'task_create',
        quantity: 999,
        metadata: { spoofed: true },
      })
    if (!usageInsertError) {
      fail('browser client could insert usage events directly')
    }
    console.log('ok browser clients cannot insert usage events')

    const { error: rateLimitInsertError } = await userClient
      .from('rate_limits')
      .insert({
        user_id: userId,
        bucket: `browser_spoof_${Date.now()}`,
        count: 999,
      })
    if (!rateLimitInsertError) {
      fail('browser client could insert rate-limit buckets directly')
    }
    console.log('ok browser clients cannot insert rate-limit buckets')

    const { data: auditEvent, error: auditError } = await service
      .from('agent_action_events')
      .insert({
        user_id: userId,
        tool_name: 'smoke_supabase',
        source_agent_id: 'nexdo-smoke',
        external_ref: `supabase-smoke-${Date.now()}`,
        success: true,
        metadata: { script: 'smoke-supabase' },
      })
      .select('id')
      .single()
    if (auditError || !auditEvent?.id) fail('agent audit insert failed', auditError)
    console.log('ok agent audit insert')

    const { data: ownAuditEvent, error: auditReadError } = await userClient
      .from('agent_action_events')
      .select('id')
      .eq('id', auditEvent.id)
      .single()
    if (auditReadError || ownAuditEvent.id !== auditEvent.id) {
      fail('agent audit RLS read failed', auditReadError)
    }
    console.log('ok agent audit RLS read')

    const { data: publicAuditEvents, error: publicAuditError } = await publicClient
      .from('agent_action_events')
      .select('id')
      .eq('id', auditEvent.id)
    if (!publicAuditError && (publicAuditEvents || []).length > 0) {
      fail('public client could read a private agent audit event')
    }
    console.log('ok public cannot read agent audit events')

    const { error: directAuditInsertError } = await userClient
      .from('agent_action_events')
      .insert({
        user_id: userId,
        tool_name: 'browser_spoof',
        success: true,
      })
    if (!directAuditInsertError) {
      fail('browser client could insert agent audit events directly')
    }
    console.log('ok browser clients cannot insert agent audit events')

    const rateLimitBucket = await verifyUsageAndRateLimits(userId)

    const { error: usageUpdateError } = await userClient
      .from('usage_events')
      .update({ quantity: 999 })
      .eq('user_id', userId)
    if (!usageUpdateError) {
      fail('browser client could update usage events directly')
    }

    const { error: usageDeleteError } = await userClient
      .from('usage_events')
      .delete()
      .eq('user_id', userId)
    if (!usageDeleteError) {
      fail('browser client could delete usage events directly')
    }
    console.log('ok usage events remain service-mutated')

    const { data: userRateLimitRows, error: userRateLimitReadError } = await userClient
      .from('rate_limits')
      .select('bucket')
      .eq('bucket', rateLimitBucket)
    if (!userRateLimitReadError && (userRateLimitRows || []).length > 0) {
      fail('browser client could read rate-limit buckets directly')
    }

    const { data: publicRateLimitRows, error: publicRateLimitReadError } = await publicClient
      .from('rate_limits')
      .select('bucket')
      .eq('bucket', rateLimitBucket)
    if (!publicRateLimitReadError && (publicRateLimitRows || []).length > 0) {
      fail('public client could read rate-limit buckets directly')
    }
    console.log('ok rate-limit buckets remain service-owned')
  } finally {
    if (stripeEventIds.length > 0) {
      const { error } = await service.from('stripe_events').delete().in('id', stripeEventIds)
      if (error) {
        console.error('warning: failed to delete smoke Stripe event records', error)
      } else {
        console.log('ok smoke Stripe event cleanup')
      }
    }

    if (userId) {
      const { error } = await service.auth.admin.deleteUser(userId)
      if (error) {
        console.error('warning: failed to delete smoke user', error)
      } else {
        console.log('ok auth admin delete user')
      }
    }
  }
}

async function main() {
  console.log(`Smoking Supabase at ${supabaseUrl}`)
  await readSmoke()

  if (allowWrite) {
    await writeSmoke()
  } else {
    console.log('skip write checks; pass --write to create and delete a smoke user')
  }

  console.log('Supabase smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
