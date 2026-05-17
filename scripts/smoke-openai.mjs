#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const shouldSmokeAppRoutes = args.has('--app')

const apiKey = process.env.OPENAI_API_KEY
const model = process.env.OPENAI_MODEL || 'gpt-4o'
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const PLACEHOLDER_FRAGMENTS = [
  'placeholder',
  'your-',
  'xxx',
  'replace',
  'example',
  'todo',
  'changeme',
]

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isUsableSecret(value) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  return !PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))
}

if (!isUsableSecret(apiKey)) {
  console.error('Missing OPENAI_API_KEY or value looks like a placeholder.')
  process.exit(1)
}

if (
  shouldSmokeAppRoutes &&
  (!isUsableSecret(supabaseUrl) ||
    !isUsableSecret(supabaseAnonKey) ||
    !isUsableSecret(supabaseServiceRoleKey))
) {
  console.error(
    'OpenAI app-route smoke requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const openai = new OpenAI({ apiKey })

async function jsonCompletion(label, system, user) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error(`${label} returned no content`)

  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`${label} did not return valid JSON: ${content}`)
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} missing string value`)
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} missing array value`)
}

function assertNonEmptyArray(value, label) {
  assertArray(value, label)
  if (value.length === 0) throw new Error(`${label} missing at least one item`)
}

function createSupabaseAdminClient() {
  return createSupabaseJsClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

async function createSmokeUser(supabase) {
  const email = `nexdo-openai-app-smoke-${Date.now()}@example.com`
  const password = `Nexdo-openai-smoke-${randomUUID()}!aA1`
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Nexdo OpenAI App Smoke',
    },
  })

  if (error || !data.user?.id) {
    throw new Error(`failed to create Supabase smoke user: ${error?.message ?? 'unknown error'}`)
  }

  const userId = data.user.id

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data: profile, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: 'Nexdo OpenAI App Smoke',
          subscription_tier: 'power',
          task_count_this_month: 0,
          agent_executions_this_month: 0,
        })
        .eq('id', userId)
        .select('id')
        .maybeSingle()

      if (updateError) {
        throw new Error(`failed to prepare smoke profile: ${updateError.message}`)
      }

      if (profile?.id) return { userId, email, password }
      await sleep(500)
    }

    throw new Error('profile trigger did not create an OpenAI app smoke profile in time')
  } catch (error) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('warning: failed to delete OpenAI app smoke user after setup failure', deleteError)
    }
    throw error
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
    throw new Error(`failed to create authenticated smoke session: ${error?.message ?? 'unknown error'}`)
  }

  const cookieHeader = jar.header()
  if (!cookieHeader) throw new Error('authenticated smoke session did not set Supabase cookies')
  return cookieHeader
}

async function postAppJson(cookieHeader, path, body) {
  const response = await fetch(`${appUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(data)}`)
  }

  return data
}

async function createExecutableTask(supabase, userId, actionType) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: `OpenAI app smoke ${actionType}`,
      raw_input: `OpenAI app smoke ${actionType}`,
      context: 'Verify provider-backed app route execution before launch.',
      description: 'Disposable task created by scripts/smoke-openai.mjs.',
      priority: 'high',
      status: 'todo',
      action_type: actionType,
      estimated_minutes: 20,
      energy_level: 'deep',
      tags: ['smoke', 'openai'],
      people: [],
    })
    .select('id, action_type')
    .single()

  if (error || !data?.id) {
    throw new Error(`failed to create ${actionType} app smoke task: ${error?.message ?? 'unknown error'}`)
  }

  return data
}

async function smokeParse() {
  const parsed = await jsonCompletion(
    'task parse',
    `Return only JSON for a task with fields title, due_date, due_time, priority, context, people, tags, action_type, estimated_minutes, energy_level. due_time must be HH:MM or null.`,
    'Research pricing pages for three AI task managers by tomorrow at 9:30am, high priority.'
  )

  assertString(parsed.title, 'parse.title')
  assertString(parsed.priority, 'parse.priority')
  assertString(parsed.action_type, 'parse.action_type')
  assertString(parsed.due_time, 'parse.due_time')
  assertArray(parsed.people, 'parse.people')
  assertArray(parsed.tags, 'parse.tags')
  console.log('ok OpenAI task parse')
}

async function smokePrioritize() {
  const prioritized = await jsonCompletion(
    'prioritize',
    `Return only JSON in the form {"tasks":[{"task_id":"string","rank":number,"reasoning":"string","time_block":"morning_deep|afternoon_light|quick_win|evening"}]}.`,
    JSON.stringify([
      {
        id: 'task-1',
        title: 'Reply to investor email',
        priority: 'urgent',
        due_date: getLocalDateKey(),
        estimated_minutes: 10,
      },
      {
        id: 'task-2',
        title: 'Draft launch notes',
        priority: 'medium',
        due_date: null,
        estimated_minutes: 45,
      },
    ])
  )

  assertArray(prioritized.tasks, 'prioritize.tasks')
  assertString(prioritized.tasks[0]?.task_id, 'prioritize.tasks[0].task_id')
  assertString(prioritized.tasks[0]?.reasoning, 'prioritize.tasks[0].reasoning')
  console.log('ok OpenAI prioritization')
}

async function smokeBriefing() {
  const briefing = await jsonCompletion(
    'briefing',
    `Return only JSON with fields greeting, top_priorities, overdue, quick_wins, someone_waiting, summary.`,
    JSON.stringify({
      userName: 'Nexdo',
      tasks: [
        {
          id: 'task-1',
          title: 'Prepare customer onboarding call',
          priority: 'high',
          due_date: getLocalDateKey(),
          people: ['Alex'],
          estimated_minutes: 30,
        },
      ],
    })
  )

  assertString(briefing.greeting, 'briefing.greeting')
  assertArray(briefing.top_priorities, 'briefing.top_priorities')
  assertArray(briefing.overdue, 'briefing.overdue')
  assertArray(briefing.quick_wins, 'briefing.quick_wins')
  assertArray(briefing.someone_waiting, 'briefing.someone_waiting')
  assertString(briefing.summary, 'briefing.summary')
  console.log('ok OpenAI briefing')
}

async function smokeResearchExecution() {
  const research = await jsonCompletion(
    'research execution',
    `Return only JSON with fields summary, key_findings, sources_searched, recommended_action, confidence.`,
    'Research three practical wedges for an AI-native task manager for founders.'
  )

  assertString(research.summary, 'research.summary')
  assertNonEmptyArray(research.key_findings, 'research.key_findings')
  assertArray(research.sources_searched, 'research.sources_searched')
  assertString(research.recommended_action, 'research.recommended_action')
  assertString(research.confidence, 'research.confidence')
  console.log('ok OpenAI research execution')
}

async function smokeDraftExecution() {
  const draft = await jsonCompletion(
    'draft execution',
    `Return only JSON with fields draft, tone, suggested_subject, word_count.`,
    'Draft a concise product update email about Nexdo becoming ready for bounded AI-agent task execution.'
  )

  assertString(draft.draft, 'draft.draft')
  assertString(draft.tone, 'draft.tone')
  if (draft.suggested_subject !== null && draft.suggested_subject !== undefined) {
    assertString(draft.suggested_subject, 'draft.suggested_subject')
  }
  if (!Number.isFinite(Number(draft.word_count))) {
    throw new Error('draft.word_count missing numeric value')
  }
  console.log('ok OpenAI draft execution')
}

async function smokePrepExecution() {
  const prep = await jsonCompletion(
    'prep execution',
    `Return only JSON with fields overview, key_points, questions_to_ask, materials_needed, time_estimate.`,
    'Prepare for a customer discovery call about AI-native task management.'
  )

  assertString(prep.overview, 'prep.overview')
  assertNonEmptyArray(prep.key_points, 'prep.key_points')
  assertArray(prep.questions_to_ask, 'prep.questions_to_ask')
  assertArray(prep.materials_needed, 'prep.materials_needed')
  assertString(prep.time_estimate, 'prep.time_estimate')
  console.log('ok OpenAI prep execution')
}

async function smokeOpenAiAppRoutes() {
  const supabase = createSupabaseAdminClient()
  let userId = null

  try {
    const smokeUser = await createSmokeUser(supabase)
    userId = smokeUser.userId
    const cookieHeader = await createSmokeSessionCookie(smokeUser)
    console.log('ok OpenAI app smoke auth')

    const parsed = await postAppJson(cookieHeader, '/api/tasks/parse', {
      input: 'Research competitor onboarding pages by tomorrow at 9:30am, high priority.',
    })
    assertString(parsed.title, 'app.parse.title')
    assertString(parsed.priority, 'app.parse.priority')
    assertString(parsed.action_type, 'app.parse.action_type')
    assertString(parsed.due_time, 'app.parse.due_time')
    console.log('ok OpenAI app parse route')

    const today = getLocalDateKey()
    const prioritized = await postAppJson(cookieHeader, '/api/tasks/prioritize', {
      tasks: [
        {
          id: 'app-task-1',
          title: 'Reply to launch partner',
          status: 'todo',
          priority: 'urgent',
          due_date: today,
          due_time: null,
          context: 'Partner is waiting on launch details.',
          people: ['Alex'],
          estimated_minutes: 10,
          energy_level: 'quick',
        },
        {
          id: 'app-task-2',
          title: 'Draft agent launch notes',
          status: 'todo',
          priority: 'medium',
          due_date: null,
          due_time: null,
          context: 'Needed before public copy review.',
          people: [],
          estimated_minutes: 45,
          energy_level: 'deep',
        },
      ],
    })
    assertNonEmptyArray(prioritized.tasks, 'app.prioritize.tasks')
    assertString(prioritized.tasks[0]?.task_id, 'app.prioritize.tasks[0].task_id')
    console.log('ok OpenAI app prioritize route')

    const briefing = await postAppJson(cookieHeader, '/api/briefing', {
      userName: 'Nexdo',
      tasks: [
        {
          id: 'app-task-1',
          title: 'Prepare launch-readiness review',
          status: 'todo',
          priority: 'high',
          due_date: today,
          due_time: null,
          context: 'Blocks Monday early-access decision.',
          people: ['Founder'],
          estimated_minutes: 30,
          energy_level: 'deep',
        },
      ],
    })
    assertString(briefing.greeting, 'app.briefing.greeting')
    assertArray(briefing.top_priorities, 'app.briefing.top_priorities')
    assertString(briefing.summary, 'app.briefing.summary')
    console.log('ok OpenAI app briefing route')

    for (const actionType of ['research', 'draft', 'prep']) {
      const task = await createExecutableTask(supabase, userId, actionType)
      const output = await postAppJson(cookieHeader, '/api/agent/execute', {
        taskId: task.id,
      })

      if (output.schema_version !== 1 || !output.current || !Array.isArray(output.history)) {
        throw new Error(`app agent ${actionType} route did not return an agent output envelope`)
      }

      if (output.history[0]?.action_type !== actionType) {
        throw new Error(`app agent ${actionType} route returned wrong action type`)
      }

      const { data: saved, error } = await supabase
        .from('tasks')
        .select('agent_output')
        .eq('id', task.id)
        .eq('user_id', userId)
        .maybeSingle()

      if (error || saved?.agent_output?.schema_version !== 1) {
        throw new Error(`app agent ${actionType} route did not persist output`)
      }

      console.log(`ok OpenAI app ${actionType} execution route`)
    }
  } finally {
    if (userId) {
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) console.error('warning: failed to delete OpenAI app smoke user', error)
    }
  }
}

async function main() {
  console.log(`Smoking OpenAI model ${model}`)
  await smokeParse()
  await smokePrioritize()
  await smokeBriefing()
  await smokeResearchExecution()
  await smokeDraftExecution()
  await smokePrepExecution()

  if (shouldSmokeAppRoutes) {
    await smokeOpenAiAppRoutes()
  } else {
    console.log('skip app-route checks; pass --app to verify authenticated app OpenAI routes')
  }

  console.log('OpenAI smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
