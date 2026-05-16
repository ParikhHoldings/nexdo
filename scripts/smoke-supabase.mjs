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
      .select('id, api_key, api_key_scopes, api_key_last_used_at')
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
}

async function writeSmoke() {
  const email = `nexdo-smoke-${Date.now()}@example.com`
  const password = `Nexdo-smoke-${crypto.randomUUID()}!`
  let userId = null

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
    const { data: insertedTask, error: insertError } = await userClient
      .from('tasks')
      .insert({
        user_id: userId,
        title: 'Nexdo Supabase smoke task',
        raw_input: 'Nexdo Supabase smoke task',
        source: 'manual',
      })
      .select('id, status, user_id')
      .single()
    if (insertError || !insertedTask?.id) fail('RLS task insert failed', insertError)
    console.log('ok RLS task insert')

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

    await verifyUsageAndRateLimits(userId)
  } finally {
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
