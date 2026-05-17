#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const vercelProtectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const PLACEHOLDER_FRAGMENTS = [
  'placeholder',
  'your-',
  'xxx',
  'replace',
  'example',
  'todo',
  'changeme',
]

function isUsableSecret(value) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  return !PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))
}

if (
  !isUsableSecret(supabaseUrl) ||
  !isUsableSecret(supabaseAnonKey) ||
  !isUsableSecret(supabaseServiceRoleKey)
) {
  console.error(
    'Authenticated app smoke requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

function createSupabaseAdminClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createSmokeUser(supabase) {
  const email = `nexdo-app-smoke-${Date.now()}@example.com`
  const password = `Nexdo-app-smoke-${randomUUID()}!aA1`
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Nexdo App Smoke',
    },
  })

  if (error || !data.user?.id) {
    throw new Error(`failed to create app smoke user: ${error?.message ?? 'unknown error'}`)
  }

  const userId = data.user.id

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data: profile, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: 'Nexdo App Smoke',
          subscription_tier: 'power',
          task_count_this_month: 0,
          agent_executions_this_month: 0,
        })
        .eq('id', userId)
        .select('id')
        .maybeSingle()

      if (updateError) {
        throw new Error(`failed to prepare app smoke profile: ${updateError.message}`)
      }

      if (profile?.id) return { userId, email, password }
      await sleep(500)
    }

    throw new Error('profile trigger did not create an app smoke profile in time')
  } catch (setupError) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('warning: failed to delete app smoke user after setup failure', deleteError)
    }
    throw setupError
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
    throw new Error(`failed to create app smoke session: ${error?.message ?? 'unknown error'}`)
  }

  const cookieHeader = jar.header()
  if (!cookieHeader) throw new Error('app smoke session did not set Supabase cookies')
  return cookieHeader
}

async function appJson(cookieHeader, path, options = {}) {
  const headers = {
    Cookie: cookieHeader,
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (vercelProtectionBypass) {
    headers['x-vercel-protection-bypass'] = vercelProtectionBypass
  }

  const response = await fetch(`${appUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  const expectedStatus = options.expectedStatus || 200
  if (response.status !== expectedStatus) {
    throw new Error(
      `${path} returned ${response.status}, expected ${expectedStatus}: ${JSON.stringify(data)}`
    )
  }

  return data
}

function reviewableAgentOutput() {
  const createdAt = new Date().toISOString()
  const output = {
    overview: 'Authenticated app smoke prep output.',
    key_points: ['Confirm launch owner', 'Review smoke evidence'],
    questions_to_ask: ['Is the handoff ready?'],
    materials_needed: ['Nexdo launch checklist'],
    time_estimate: '15 minutes',
  }

  return {
    schema_version: 1,
    current: output,
    history: [
      {
        id: `app-smoke-agent-${randomUUID()}`,
        action_type: 'prep',
        output,
        created_at: createdAt,
      },
    ],
    review: {
      status: 'unreviewed',
      note: null,
      updated_at: null,
    },
  }
}

async function seedReviewableAgentOutput(supabase, taskId) {
  const seededOutput = reviewableAgentOutput()
  const { data, error } = await supabase
    .from('tasks')
    .update({
      agent_output: seededOutput,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`failed to seed reviewable agent output: ${error.message}`)
  }
  if (!data?.id) {
    throw new Error('failed to seed reviewable agent output: task not found')
  }
}

async function smokeAuthenticatedTaskRoutes(cookieHeader, supabase) {
  const listedBefore = await appJson(cookieHeader, '/api/tasks')
  if (!Array.isArray(listedBefore.tasks)) {
    throw new Error('/api/tasks did not return a tasks array')
  }
  console.log(`ok authenticated task list (${listedBefore.tasks.length} existing)`)

  const title = `Nexdo app smoke task ${new Date().toISOString()}`
  const created = await appJson(cookieHeader, '/api/tasks', {
    method: 'POST',
    body: {
      title,
      raw_input: title,
      priority: 'high',
      due_date: null,
      due_time: null,
      context: 'Authenticated app smoke task.',
      action_type: 'prep',
      estimated_minutes: 15,
      energy_level: 'light',
      people: ['Nexdo Smoke'],
      tags: ['smoke', 'app'],
    },
  })
  if (!created?.id || created.title !== title) {
    throw new Error('/api/tasks did not return the created task')
  }
  console.log('ok authenticated task create')

  const updated = await appJson(cookieHeader, `/api/tasks/${created.id}`, {
    method: 'PATCH',
    body: {
      status: 'in_progress',
      context: 'Updated by authenticated app smoke.',
      due_time: '13:45',
      estimated_minutes: 20,
      tags: ['smoke', 'app', 'updated'],
    },
  })
  if (
    updated?.id !== created.id ||
    updated.status !== 'in_progress' ||
    updated.due_time !== '13:45' ||
    !updated.tags?.includes('updated')
  ) {
    throw new Error('/api/tasks/[id] did not return the updated task')
  }
  console.log('ok authenticated task update')

  const emptyNote = await appJson(cookieHeader, `/api/tasks/${created.id}/notes`, {
    method: 'POST',
    body: { content: '   ' },
    expectedStatus: 400,
  })
  if (!String(emptyNote?.error || '').includes('Note content is required')) {
    throw new Error('/api/tasks/[id]/notes did not reject empty note content')
  }
  console.log('ok authenticated task note validation')

  const noteContent = 'Authenticated app smoke note for launch handoff.'
  const note = await appJson(cookieHeader, `/api/tasks/${created.id}/notes`, {
    method: 'POST',
    body: { content: `  ${noteContent}  ` },
  })
  if (note?.task_id !== created.id || note.content !== noteContent) {
    throw new Error('/api/tasks/[id]/notes did not return the created note')
  }
  console.log('ok authenticated task note create')

  const notes = await appJson(cookieHeader, `/api/tasks/${created.id}/notes`)
  if (!notes?.notes?.some((item) => item.id === note.id && item.content === noteContent)) {
    throw new Error('/api/tasks/[id]/notes did not return the created note')
  }
  console.log('ok authenticated task note list')

  await seedReviewableAgentOutput(supabase, created.id)
  console.log('ok authenticated task agent output seed')

  const invalidReview = await appJson(cookieHeader, `/api/tasks/${created.id}/agent-review`, {
    method: 'PATCH',
    body: { status: 'approved' },
    expectedStatus: 400,
  })
  if (!String(invalidReview?.error || '').includes('status must be one of')) {
    throw new Error('/api/tasks/[id]/agent-review did not reject invalid review status')
  }
  console.log('ok authenticated agent review validation')

  const reviewNote = 'Authenticated app smoke verified the agent output.'
  const reviewedOutput = await appJson(cookieHeader, `/api/tasks/${created.id}/agent-review`, {
    method: 'PATCH',
    body: { status: 'verified', note: `  ${reviewNote}  ` },
  })
  if (
    reviewedOutput?.review?.status !== 'verified' ||
    reviewedOutput.review.note !== reviewNote ||
    !reviewedOutput.review.updated_at ||
    reviewedOutput?.history?.[0]?.action_type !== 'prep'
  ) {
    throw new Error('/api/tasks/[id]/agent-review did not return the reviewed agent output')
  }
  console.log('ok authenticated agent review save')

  const deleted = await appJson(cookieHeader, `/api/tasks/${created.id}`, {
    method: 'DELETE',
  })
  if (deleted?.success !== true) {
    throw new Error('/api/tasks/[id] did not confirm deletion')
  }
  console.log('ok authenticated task delete')
}

async function main() {
  console.log(`Smoking authenticated app routes at ${appUrl}`)
  const supabase = createSupabaseAdminClient()
  let userId = null

  try {
    const user = await createSmokeUser(supabase)
    userId = user.userId
    console.log('ok app smoke user')

    const cookieHeader = await createSmokeSessionCookie(user)
    console.log('ok app smoke auth')

    await smokeAuthenticatedTaskRoutes(cookieHeader, supabase)
    console.log('Authenticated app smoke passed.')
  } finally {
    if (userId) {
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) {
        console.error('warning: failed to delete app smoke user', error)
      } else {
        console.log('ok app smoke user cleanup')
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
