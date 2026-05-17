import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import {
  canUseApiAccess,
  hasRequiredScope,
  normalizeApiKeyScopes,
  requiredScopeForTool,
} from '../../lib/agent-scopes'
import { apiKeyHint, hashApiKey } from '../../lib/api-keys'
import { persistApiKeyRotation } from '../../lib/api-key-rotation'
import { sanitizeAiTasks, sanitizeUserName } from '../../lib/ai-task-input'
import {
  agentOutputReviewStatus,
  appendAgentExecution,
  normalizeAgentOutput,
  updateAgentReview,
} from '../../lib/agent-output'
import {
  authErrorMessage,
  safeAuthRedirect,
  safeLoginRedirect,
} from '../../lib/auth-redirect'
import { validateParsedTask } from '../../lib/ai-response-validation'
import { getDueTasksForBrowserNotification } from '../../lib/browser-notifications'
import { createClientProfileFallback } from '../../lib/profile'
import { importPreviewWarning } from '../../lib/import-preview'
import { quotaExceededResponse, quotaFailureStatus } from '../../lib/quota'
import { rateLimitResponseHeaders } from '../../lib/rate-limit'
import { validateTaskInput, validateTaskPatch } from '../../lib/task-validation'
import { getLocalDateKey } from '../../lib/dates'
import { isActiveTask, isTodayFocusTask } from '../../lib/task-filters'
import {
  asExecutableActionType,
  EXECUTABLE_ACTION_TYPES,
  isExecutableActionType,
} from '../../lib/task-actions'
import { MAX_TASK_NOTE_LENGTH, validateTaskNoteContent } from '../../lib/task-notes'
import { validateTaskRelationshipPatch } from '../../lib/task-relationships'
import {
  tasksToCsv,
  tasksToExportPayload,
  tasksToJsonString,
} from '../../lib/task-export'
import { formatRelativeDate } from '../../lib/utils'
import type { Task } from '../../lib/database.types'

test('AI task input sanitizer trims, bounds, and defaults task fields', () => {
  const result = sanitizeAiTasks(
    [
      {
        id: ' task-1 ',
        user_id: ' user-1 ',
        title: ` ${'Launch note '.repeat(80)} `,
        status: 'not-a-status',
        priority: 'not-a-priority',
        due_date: 'not-a-date',
        due_time: '14:30:00 extra',
        context: ' Context '.repeat(200),
        action_type: 'draft',
        estimated_minutes: '12.6',
        energy_level: 'quick',
        people: [' Alex ', '', 42, 'Jordan'],
        tags: Array.from({ length: 25 }, (_, index) => ` tag-${index} `),
        source_agent_id: 'agent-1',
        external_ref: 'external-1',
        agent_output: { spoofed: true },
      },
    ],
    5
  )

  expect(result.ok).toBe(true)
  if (!result.ok) return

  expect(result.tasks[0]).toMatchObject({
    id: 'task-1',
    user_id: 'user-1',
    status: 'todo',
    priority: 'medium',
    due_date: null,
    due_time: null,
    action_type: 'draft',
    estimated_minutes: 13,
    energy_level: 'quick',
    people: ['Alex', 'Jordan'],
    source: 'manual',
    agent_output: null,
    source_agent_id: 'agent-1',
    external_ref: 'external-1',
  })
  expect(result.tasks[0].title.length).toBeLessThanOrEqual(500)
  expect(result.tasks[0].context?.length).toBeLessThanOrEqual(1200)
  expect(result.tasks[0].tags).toHaveLength(20)
})

test('relative date formatter treats date-only strings as local calendar dates', () => {
  expect(formatRelativeDate(getLocalDateKey())).toBe('Today')
})

test('AI parsed task validator normalizes due times', () => {
  expect(
    validateParsedTask({
      title: 'Call launch partner',
      due_date: '2026-05-18',
      due_time: '9:05',
      priority: 'high',
      people: [],
      tags: [],
      action_type: 'prep',
      estimated_minutes: 20,
      energy_level: 'light',
    })
  ).toMatchObject({
    due_date: '2026-05-18',
    due_time: '09:05',
  })

  expect(
    validateParsedTask({
      title: 'Call launch partner',
      due_date: '2026-02-30',
      due_time: '25:00',
    })
  ).toMatchObject({
    due_date: null,
    due_time: null,
  })

  expect(
    validateParsedTask({
      title: 'Call launch partner',
      due_time: '14:30:00 extra',
    })
  ).toMatchObject({
    due_time: null,
  })
})

test('auth redirect helpers keep callback and login redirects same-origin', () => {
  const middlewareSource = readFileSync('lib/supabase/middleware.ts', 'utf8')

  expect(safeAuthRedirect('/today')).toBe('/today')
  expect(safeAuthRedirect('/settings?tab=billing')).toBe('/settings?tab=billing')
  expect(safeAuthRedirect('/auth/update-password')).toBe('/auth/update-password')
  expect(safeAuthRedirect(' /all ')).toBe('/all')
  expect(safeAuthRedirect('https://example.com')).toBe('/today')
  expect(safeAuthRedirect('//example.com')).toBe('/today')
  expect(safeAuthRedirect('/\\example.com')).toBe('/today')
  expect(safeAuthRedirect('/%5cexample.com')).toBe('/today')
  expect(safeAuthRedirect('/today\nSet-Cookie: test=1')).toBe('/today')
  expect(safeAuthRedirect(null)).toBe('/today')
  expect(safeLoginRedirect('/settings?tab=billing')).toBe('/settings?tab=billing')
  expect(safeLoginRedirect('/auth/login?redirect=/settings')).toBe('/today')
  expect(safeLoginRedirect('/auth/update-password')).toBe('/today')

  expect(authErrorMessage('callback_error')).toBe(
    'Could not finish sign-in. Request a fresh link or sign in again.'
  )
  expect(authErrorMessage('other')).toBeNull()

  expect(middlewareSource).toContain('`${request.nextUrl.pathname}${request.nextUrl.search}`')
  expect(middlewareSource).not.toContain(
    "url.searchParams.set('redirect', request.nextUrl.pathname)"
  )
})

test('AI task input sanitizer fails closed for invalid arrays and required fields', () => {
  expect(sanitizeUserName(` ${'Casey'.repeat(40)} `)).toHaveLength(120)
  expect(sanitizeUserName('   ')).toBe('there')

  expect(sanitizeAiTasks('not an array', 5)).toEqual({
    ok: false,
    error: 'Invalid tasks array',
  })

  expect(sanitizeAiTasks([{ id: 'task-1', title: 'Task' }, { id: 'task-2', title: 'Task' }], 1)).toEqual({
    ok: false,
    error: 'Too many tasks (max 1 per request)',
  })

  expect(sanitizeAiTasks([{ id: 'task-1' }], 5)).toEqual({
    ok: false,
    error: 'Task at index 0 requires id and title',
  })
})

test('API key scope helpers map plans and tools to least-privilege permissions', () => {
  expect(canUseApiAccess('free')).toBe(false)
  expect(canUseApiAccess('pro')).toBe(false)
  expect(canUseApiAccess('power')).toBe(true)
  expect(canUseApiAccess('team')).toBe(true)
  expect(canUseApiAccess(null)).toBe(false)

  expect(normalizeApiKeyScopes(['tasks:read', 'tasks:read', 'invalid'])).toEqual([
    'tasks:read',
  ])
  expect(normalizeApiKeyScopes(['invalid'])).toEqual([
    'tasks:read',
    'tasks:write',
    'briefing:read',
  ])

  expect(requiredScopeForTool('list_tasks')).toBe('tasks:read')
  expect(requiredScopeForTool('search_tasks')).toBe('tasks:read')
  expect(requiredScopeForTool('create_task')).toBe('tasks:write')
  expect(requiredScopeForTool('update_task')).toBe('tasks:write')
  expect(requiredScopeForTool('complete_task')).toBe('tasks:write')
  expect(requiredScopeForTool('add_task_note')).toBe('tasks:write')
  expect(requiredScopeForTool('get_briefing')).toBe('briefing:read')
  expect(hasRequiredScope(['tasks:read'], 'list_tasks')).toBe(true)
  expect(hasRequiredScope(['tasks:read'], 'create_task')).toBe(false)
})

test('authenticated profile fallback keeps app state signed in without sensitive fields', () => {
  const profile = createClientProfileFallback(
    {
      id: 'user-1',
      email: 'founder@example.com',
      user_metadata: { full_name: '  Founder User  ' },
    },
    'America/Chicago'
  )

  expect(profile).toMatchObject({
    id: 'user-1',
    full_name: 'Founder User',
    timezone: 'America/Chicago',
    subscription_tier: 'free',
    stripe_customer_id: null,
    api_key: null,
    api_key_hash: null,
    api_key_hint: null,
    task_count_this_month: 0,
    agent_executions_this_month: 0,
  })
  expect(profile.api_key_scopes).toEqual([
    'tasks:read',
    'tasks:write',
    'briefing:read',
  ])

  expect(
    createClientProfileFallback(
      { id: 'user-2', email: 'operator@example.com', user_metadata: {} },
      'UTC'
    ).full_name
  ).toBe('operator')
})

function apiKeyRotationClient({
  profile,
  error = null,
}: {
  profile?: Record<string, unknown>
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
                expect(field).toBe('id')
                expect(value).toBe('user-1')
                expect(columns).toBe('id')
                if (error) return { data: null, error }
                if (!profile || profile.id !== value) {
                  return { data: null, error: null }
                }

                Object.assign(profile, fields)
                return { data: { id: profile.id }, error: null }
              },
            }),
          }),
        }),
      }
    },
  }
}

test('API key rotation persistence stores hashed keys and requires a profile row', async () => {
  const apiKey = 'nxd_test_launch_key'
  const scopes = ['tasks:read', 'briefing:read']
  const profile: Record<string, unknown> = { id: 'user-1' }

  await expect(
    persistApiKeyRotation(apiKeyRotationClient({ profile }), 'user-1', apiKey, scopes)
  ).resolves.toEqual({ hint: apiKeyHint(apiKey) })

  expect(profile).toMatchObject({
    api_key: null,
    api_key_hash: hashApiKey(apiKey),
    api_key_hint: apiKeyHint(apiKey),
    api_key_scopes: scopes,
    api_key_last_used_at: null,
  })

  await expect(
    persistApiKeyRotation(apiKeyRotationClient({}), 'user-1', apiKey, scopes)
  ).rejects.toThrow('No profile found')

  await expect(
    persistApiKeyRotation(
      apiKeyRotationClient({ error: { message: 'database unavailable' } }),
      'user-1',
      apiKey,
      scopes
    )
  ).rejects.toThrow('Failed to persist API key')
})

test('quota and rate-limit response helpers expose stable client contracts', () => {
  expect(
    quotaExceededResponse({
      allowed: false,
      limit: 25,
      used: 25,
      tier: 'free',
      reason: 'Monthly limit reached',
    })
  ).toEqual({
    error: 'Quota exceeded',
    message: 'Monthly limit reached',
    limit: 25,
    used: 25,
    tier: 'free',
    upgrade_url: '/settings?tab=billing',
  })

  expect(
    quotaFailureStatus({
      allowed: false,
      limit: 25,
      used: 25,
      tier: 'free',
      reason: 'Monthly limit reached',
    })
  ).toBe(402)

  expect(
    quotaFailureStatus({
      allowed: false,
      limit: 25,
      used: 24,
      tier: 'free',
      reason: 'Failed to record usage',
    })
  ).toBe(500)

  const resetAt = new Date('2026-05-16T12:00:00.000Z')
  expect(rateLimitResponseHeaders({ allowed: false, remaining: -3, resetAt }, 30)).toEqual({
    'X-RateLimit-Limit': '30',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': String(Math.floor(resetAt.getTime() / 1000)),
  })

  expect(rateLimitResponseHeaders({ allowed: true, remaining: 12, resetAt: null }, 30)).toEqual({
    'X-RateLimit-Limit': '30',
    'X-RateLimit-Remaining': '12',
  })
})

test('import preview warnings reflect demo and Free-plan task caps', () => {
  expect(
    importPreviewWarning({
      isAuthenticated: false,
      importCount: 1,
    })
  ).toBe('Demo file imports are capped at 100 tasks per file.')

  expect(
    importPreviewWarning({
      isAuthenticated: true,
      importCount: 2,
      subscriptionTier: 'free',
      taskCountThisMonth: 23,
    })
  ).toBe('2 Free-plan task slots left before import.')

  expect(
    importPreviewWarning({
      isAuthenticated: true,
      importCount: 3,
      subscriptionTier: 'free',
      taskCountThisMonth: 23,
    })
  ).toBe(
    'Your Free plan has 2 task slots left this month. This import may fail unless you upgrade or reduce the file.'
  )

  expect(
    importPreviewWarning({
      isAuthenticated: true,
      importCount: 1,
      subscriptionTier: 'free',
      taskCountThisMonth: 24,
    })
  ).toBe('1 Free-plan task slot left before import.')

  expect(
    importPreviewWarning({
      isAuthenticated: true,
      importCount: 20,
      subscriptionTier: 'pro',
      taskCountThisMonth: 40,
    })
  ).toBeNull()
})

test('agent output helper preserves run history and verification notes', () => {
  const first = appendAgentExecution(
    null,
    {
      draft: 'First draft',
      tone: 'Concise',
      suggested_subject: 'Launch note',
      word_count: 2,
    },
    'draft'
  )
  const second = appendAgentExecution(
    first,
    {
      draft: 'Second draft',
      tone: 'Concise',
      suggested_subject: 'Launch note',
      word_count: 2,
    },
    'draft'
  )
  const reviewed = updateAgentReview(
    second,
    'verified',
    'Checked tone and next step.'
  )

  expect(reviewed.current).toMatchObject({ draft: 'Second draft' })
  expect(reviewed.history).toHaveLength(2)
  expect(reviewed.review).toMatchObject({
    status: 'verified',
    note: 'Checked tone and next step.',
  })

  const legacy = normalizeAgentOutput(
    {
      draft: 'Legacy draft',
      tone: 'Concise',
      suggested_subject: 'Legacy',
      word_count: 2,
    },
    'draft'
  )
  expect(legacy?.history).toHaveLength(1)
  expect(legacy?.review.status).toBe('unreviewed')
  expect(agentOutputReviewStatus(reviewed, 'draft')).toBe('verified')
  expect(
    agentOutputReviewStatus(
      {
        draft: 'Legacy draft',
        tone: 'Concise',
        suggested_subject: 'Legacy',
        word_count: 2,
      },
      'draft'
    )
  ).toBe('unreviewed')
  expect(agentOutputReviewStatus(null, 'draft')).toBeNull()
  expect(agentOutputReviewStatus({ draft: 'Not executable' }, 'manual')).toBeNull()
})

test('task validation normalizes safe create inputs and rejects protected fields', () => {
  const valid = validateTaskInput({
    title: '  Draft launch note  ',
    raw_input: ' Draft launch note tomorrow ',
    priority: 'high',
    due_date: '2026-05-18',
    due_time: '09:30',
    context: '  Align with verified product truth.  ',
    source: 'manual',
    action_type: 'draft',
    estimated_minutes: '25.6',
    energy_level: 'light',
    people: [' Nathan ', '', 'Quill'],
    tags: [' launch ', 'copy'],
  })

  expect(valid.errors).toEqual([])
  expect(valid.task).toMatchObject({
    title: 'Draft launch note',
    raw_input: 'Draft launch note tomorrow',
    priority: 'high',
    due_date: '2026-05-18',
    due_time: '09:30',
    context: 'Align with verified product truth.',
    source: 'manual',
    action_type: 'draft',
    estimated_minutes: 26,
    energy_level: 'light',
    people: ['Nathan', 'Quill'],
    tags: ['launch', 'copy'],
  })

  const invalid = validateTaskInput({
    title: 'Agent-created spoof',
    source: 'agent',
    due_date: '2026-02-30',
    due_time: '29:00',
    user_id: 'other-user',
    source_agent_id: 'agent-1',
    agent_output: { draft: 'spoofed' },
  })

  expect(invalid.task).toBeNull()
  expect(invalid.errors.map((error) => error.field)).toEqual(
    expect.arrayContaining([
      'source',
      'due_date',
      'due_time',
      'user_id',
      'source_agent_id',
      'agent_output',
    ])
  )
})

test('task patch validation allowlists human-editable fields only', () => {
  const valid = validateTaskPatch({
    title: '  Review launch blockers  ',
    status: 'done',
    priority: 'urgent',
    due_date: null,
    due_time: '14:00:00',
    context: '  Check provider smoke status.  ',
    estimated_minutes: 12.4,
    people: [' Nathan ', 'Founder'],
    tags: [' launch ', ' verification '],
  })

  expect(valid.errors).toEqual([])
  expect(valid.updates).toMatchObject({
    title: 'Review launch blockers',
    status: 'done',
    priority: 'urgent',
    due_date: null,
    due_time: '14:00:00',
    context: 'Check provider smoke status.',
    estimated_minutes: 12,
    people: ['Nathan', 'Founder'],
    tags: ['launch', 'verification'],
  })

  const invalid = validateTaskPatch({
    title: '',
    due_date: '2026-13-01',
    due_time: '24:00',
    user_id: 'other-user',
    completed_at: '2026-05-18T12:00:00.000Z',
    source_agent_id: 'agent-1',
    agent_output: { draft: 'spoofed' },
    people: ['x'.repeat(121)],
  })

  expect(invalid.updates).toEqual({})
  expect(invalid.errors.map((error) => error.field)).toEqual(
    expect.arrayContaining([
      'title',
      'due_date',
      'due_time',
      'user_id',
      'completed_at',
      'source_agent_id',
      'agent_output',
      'people',
    ])
  )
})

test('OpenAI smoke can verify authenticated app routes with disposable data', () => {
  const source = readFileSync('scripts/smoke-openai.mjs', 'utf8')
  const parseRouteSource = readFileSync('app/api/tasks/parse/route.ts', 'utf8')

  expect(source).toContain("const shouldSmokeAppRoutes = args.has('--app')")
  expect(source).toContain('function getLocalDateKey(date = new Date())')
  expect(source).not.toContain('toISOString().slice(0, 10)')
  expect(source).toContain("import { createBrowserClient } from '@supabase/ssr'")
  expect(source).toContain('await supabase.auth.signInWithPassword({ email, password })')
  expect(source).toContain("postAppJson(cookieHeader, '/api/tasks/parse'")
  expect(source).toContain("postAppJson(cookieHeader, '/api/tasks/prioritize'")
  expect(source).toContain("postAppJson(cookieHeader, '/api/briefing'")
  expect(source).toContain("postAppJson(cookieHeader, '/api/agent/execute'")
  expect(source).toContain("for (const actionType of ['research', 'draft', 'prep'])")
  expect(source).toContain("subscription_tier: 'power'")
  expect(source).toContain("select('agent_output')")
  expect(source).toContain('VERCEL_AUTOMATION_BYPASS_SECRET')
  expect(source).toContain("'x-vercel-protection-bypass'")
  expect(parseRouteSource).toContain('input.trim().length === 0')
  expect(parseRouteSource).toContain('const normalizedInput = input.trim()')
  expect(parseRouteSource).toContain('parseTaskInput(normalizedInput)')
  expect(parseRouteSource).toContain('normalizedInput.length > 2000')
})

test('authenticated app smoke verifies task CRUD, task notes, and agent review', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const source = readFileSync('scripts/smoke-app.mjs', 'utf8')

  expect(packageJson.scripts['smoke:app']).toBe('node scripts/smoke-app.mjs')
  expect(source).toContain("import { createBrowserClient } from '@supabase/ssr'")
  expect(source).toContain('await supabase.auth.signInWithPassword({ email, password })')
  expect(source).toContain("subscription_tier: 'power'")
  expect(source).toContain("appJson(cookieHeader, '/api/tasks'")
  expect(source).toContain("appJson(cookieHeader, `/api/tasks/${created.id}`")
  expect(source).toContain("appJson(cookieHeader, `/api/tasks/${created.id}/notes`")
  expect(source).toContain('Note content is required')
  expect(source).toContain('Authenticated app smoke note for launch handoff.')
  expect(source).toContain('seedReviewableAgentOutput(supabase, created.id)')
  expect(source).toContain("appJson(cookieHeader, `/api/tasks/${created.id}/agent-review`")
  expect(source).toContain('status must be one of')
  expect(source).toContain('Authenticated app smoke verified the agent output.')
  expect(source).toContain('VERCEL_AUTOMATION_BYPASS_SECRET')
  expect(source).toContain("'x-vercel-protection-bypass'")
  expect(source).toContain('await supabase.auth.admin.deleteUser(userId)')
})

test('date-only task surfaces compare local date keys without UTC parsing', () => {
  const demoTasksSource = readFileSync('lib/tasks.ts', 'utf8')
  const allTasksSource = readFileSync('app/(app)/all/page.tsx', 'utf8')

  expect(demoTasksSource).toContain('const today = getLocalDateKey()')
  expect(demoTasksSource).toContain('return t.due_date > today')
  expect(demoTasksSource).not.toContain('new Date(t.due_date)')

  expect(allTasksSource).toContain('return a.due_date.localeCompare(b.due_date)')
  expect(allTasksSource).not.toContain('new Date(a.due_date)')
})

test('active task helpers include active work and exclude closed work', () => {
  const baseTask: Task = {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Review today focus',
    raw_input: null,
    description: null,
    status: 'todo',
    priority: 'medium',
    due_date: null,
    due_time: null,
    context: null,
    source: 'manual',
    action_type: 'manual',
    estimated_minutes: null,
    energy_level: null,
    people: null,
    tags: null,
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: '2026-05-17T12:00:00.000Z',
    updated_at: '2026-05-17T12:00:00.000Z',
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
  }

  expect(isActiveTask(baseTask)).toBe(true)
  expect(isActiveTask({ ...baseTask, status: 'done' })).toBe(false)
  expect(isActiveTask({ ...baseTask, status: 'cancelled' })).toBe(false)

  expect(isTodayFocusTask(baseTask, '2026-05-17')).toBe(true)
  expect(
    isTodayFocusTask({ ...baseTask, due_date: '2026-05-17' }, '2026-05-17')
  ).toBe(true)
  expect(
    isTodayFocusTask({ ...baseTask, due_date: '2026-05-18' }, '2026-05-17')
  ).toBe(false)
  expect(
    isTodayFocusTask({ ...baseTask, status: 'done' }, '2026-05-17')
  ).toBe(false)
  expect(
    isTodayFocusTask({ ...baseTask, status: 'cancelled' }, '2026-05-17')
  ).toBe(false)

  expect(
    getDueTasksForBrowserNotification(
      [
        { ...baseTask, id: 'active-due', due_date: '2026-05-17' },
        { ...baseTask, id: 'done-due', due_date: '2026-05-17', status: 'done' },
        {
          ...baseTask,
          id: 'cancelled-due',
          due_date: '2026-05-17',
          status: 'cancelled',
        },
        { ...baseTask, id: 'future', due_date: '2026-05-18' },
      ],
      '2026-05-17'
    ).map((task) => task.id)
  ).toEqual(['active-due'])
})

test('task export helpers preserve portable task metadata', () => {
  const task: Task = {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Export "launch", review',
    raw_input: 'Export launch review',
    description: null,
    status: 'in_progress',
    priority: 'high',
    due_date: '2026-05-18',
    due_time: '09:30',
    context: 'Include CSV escaping.',
    source: 'manual',
    action_type: 'prep',
    estimated_minutes: 30,
    energy_level: 'deep',
    people: ['Casey', 'Jordan'],
    tags: ['launch', 'backup'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: '2026-05-17T12:00:00.000Z',
    updated_at: '2026-05-17T12:30:00.000Z',
    source_agent_id: 'codex',
    external_ref: 'handoff-1',
    ingestion_intent: 'update',
    agent_metadata: { reviewed: true },
  }

  const exportedAt = new Date('2026-05-17T13:00:00.000Z')
  expect(tasksToExportPayload([task], exportedAt)).toMatchObject({
    version: 1,
    exported_at: '2026-05-17T13:00:00.000Z',
    task_count: 1,
    tasks: [
      {
        title: task.title,
        raw_input: 'Export launch review',
        agent_metadata: { reviewed: true },
        due_time: '09:30',
        people: ['Casey', 'Jordan'],
        source_agent_id: 'codex',
        external_ref: 'handoff-1',
      },
    ],
  })

  expect(JSON.parse(tasksToJsonString([task], exportedAt)).task_count).toBe(1)
  const csv = tasksToCsv([task])
  expect(csv).toContain('title,raw_input,description,status,priority,due_date,due_time')
  expect(csv).toContain('"Export ""launch"", review"')
  expect(csv).toContain('"Casey; Jordan"')
  expect(csv).toContain('"{""reviewed"":true}"')
})

test('task relationship validation requires bounded owned-link inputs', () => {
  const currentTaskId = '00000000-0000-4000-8000-000000000001'
  const parentTaskId = '00000000-0000-4000-8000-000000000002'
  const relatedTaskId = '00000000-0000-4000-8000-000000000003'

  expect(
    validateTaskRelationshipPatch(
      {
        parent_task_id: parentTaskId,
        related_task_ids: [relatedTaskId, relatedTaskId, ''],
      },
      currentTaskId
    )
  ).toEqual({
    updates: {
      parent_task_id: parentTaskId,
      related_task_ids: [relatedTaskId],
    },
    referencedTaskIds: [parentTaskId, relatedTaskId],
    errors: [],
  })

  const invalid = validateTaskRelationshipPatch(
    {
      parent_task_id: currentTaskId,
      related_task_ids: [parentTaskId, 'not-a-task-id'],
      agent_output: { spoofed: true },
    },
    currentTaskId
  )

  expect(invalid.errors).toEqual(
    expect.arrayContaining([
      {
        field: 'agent_output',
        message: 'This field is not editable through this route.',
      },
      {
        field: 'parent_task_id',
        message: 'Cannot link a task to itself.',
      },
      {
        field: 'related_task_ids',
        message: 'Must be a valid task id.',
      },
    ])
  )

  expect(
    validateTaskRelationshipPatch(
      {
        parent_task_id: parentTaskId,
        related_task_ids: [parentTaskId],
      },
      currentTaskId
    ).errors
  ).toContainEqual({
    field: 'related_task_ids',
    message: 'Parent task cannot also be a related task.',
  })
})

test('executable action helpers keep agent execution bounded to owned work types', () => {
  expect(EXECUTABLE_ACTION_TYPES).toEqual(['research', 'draft', 'prep'])

  for (const actionType of EXECUTABLE_ACTION_TYPES) {
    expect(isExecutableActionType(actionType)).toBe(true)
    expect(asExecutableActionType(actionType)).toBe(actionType)
  }

  expect(isExecutableActionType('manual')).toBe(false)
  expect(isExecutableActionType('remind')).toBe(false)
  expect(asExecutableActionType('manual')).toBeNull()
  expect(asExecutableActionType('remind')).toBeNull()

  const taskCardSource = readFileSync('components/task-card.tsx', 'utf8')
  const taskDetailSource = readFileSync('components/task-detail.tsx', 'utf8')
  const executeRouteSource = readFileSync('app/api/agent/execute/route.ts', 'utf8')
  const agentOutputSource = readFileSync('lib/agent-output.ts', 'utf8')

  expect(taskCardSource).toContain('isExecutableActionType(task.action_type)')
  expect(taskDetailSource).toContain('isExecutableActionType(task.action_type)')
  expect(executeRouteSource).toContain('isExecutableActionType(actionType)')
  expect(executeRouteSource).toContain('Task type does not support execution')
  expect(agentOutputSource).toContain('asExecutableActionType(actionType)')
})

test('task note helpers and route keep notes owned and bounded', () => {
  expect(validateTaskNoteContent('  Keep this context for handoff.  ')).toEqual({
    content: 'Keep this context for handoff.',
  })
  expect(validateTaskNoteContent('   ')).toEqual({
    error: 'Note content is required.',
  })
  expect(validateTaskNoteContent('x'.repeat(MAX_TASK_NOTE_LENGTH + 1))).toEqual({
    error: `Note content must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.`,
  })

  const routeSource = readFileSync('app/api/tasks/[id]/notes/route.ts', 'utf8')
  const migrationSource = readFileSync(
    'supabase/migrations/008_task_note_column_grants.sql',
    'utf8'
  )
  expect(routeSource).toContain('validateTaskNoteContent')
  expect(routeSource).toContain(".from('tasks')")
  expect(routeSource).toContain(".eq('user_id', user.id)")
  expect(routeSource).toContain('createClient, createServiceClient')
  expect(routeSource).toContain('const service = await createServiceClient()')
  expect(routeSource).toContain(".from('task_notes')")
  expect(routeSource).toContain("note_type: 'note'")
  expect(migrationSource).toContain('grant insert (')
  expect(migrationSource).toContain('task_notes_content_length')
  expect(migrationSource).toContain('between 1 and 2000')
  expect(migrationSource).toContain('task_id')
  expect(migrationSource).toContain('content')
  expect(migrationSource).not.toContain('note_type,')
  expect(migrationSource).not.toContain('created_at')
})

test('launch smoke orchestrates required technical and approval gates', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const source = readFileSync('scripts/smoke-launch.mjs', 'utf8')
  const envSource = readFileSync('scripts/verify-env.mjs', 'utf8')
  const routeSmokeSource = readFileSync('scripts/smoke-routes.mjs', 'utf8')
  const workflowSource = readFileSync('.github/workflows/verify.yml', 'utf8')
  const localEnvExample = readFileSync('.env.local.example', 'utf8')
  const productionEnvExample = readFileSync('.env.production.local.example', 'utf8')

  expect(packageJson.scripts['smoke:launch']).toBe('node scripts/smoke-launch.mjs')
  expect(packageJson.scripts['smoke:routes']).toBe('node scripts/smoke-routes.mjs')
  expect(workflowSource).toContain('pull_request:')
  expect(workflowSource).toContain('push:')
  expect(workflowSource).toContain('- main')
  expect(workflowSource).toContain('- staging')
  expect(workflowSource).toContain('uses: actions/checkout@v5')
  expect(workflowSource).toContain('uses: actions/setup-node@v5')
  expect(workflowSource).toContain('node-version: 22')
  expect(workflowSource).toContain('run: npm ci')
  expect(workflowSource).toContain('run: npm run lint')
  expect(workflowSource).toContain('run: npm run typecheck')
  expect(workflowSource).toContain('run: npm run build')
  expect(workflowSource).toContain('run: npm audit --audit-level=moderate')
  expect(workflowSource).toContain('run: npx playwright install --with-deps chromium')
  expect(workflowSource).toContain('run: rm -rf .next && npm run test:e2e')
  expect(workflowSource.indexOf('run: npm run build')).toBeLessThan(
    workflowSource.indexOf('run: npm audit --audit-level=moderate')
  )
  expect(workflowSource.indexOf('run: npm audit --audit-level=moderate')).toBeLessThan(
    workflowSource.indexOf('run: npx playwright install --with-deps chromium')
  )
  expect(source).toContain("const envArg = rawArgs.find((arg) => arg.startsWith('--env='))")
  expect(source).toContain("const allowLocalUrl = args.has('--allow-local-url')")
  expect(source).toContain('...fileEnv')
  expect(envSource).toContain("const appUrlArg = rawArgs.find((arg) => arg.startsWith('--app-url='))")
  expect(envSource).toContain('const env = { ...process.env, ...fileEnv }')
  expect(envSource).toContain('if (appUrlOverride) env.NEXT_PUBLIC_APP_URL = appUrlOverride')
  expect(envSource).toContain('function isOriginUrl(value)')
  expect(envSource).toContain("parsed.pathname === '/' && !parsed.search && !parsed.hash")
  expect(source).toContain('function validateProviderAppUrl(value)')
  expect(source).toContain('Provider launch smokes require --url=https://your-preview.example')
  expect(source).toContain('Provider launch smokes require a remote preview/production URL')
  expect(source).toContain('Provider launch smokes require an HTTPS app URL')
  expect(source).toContain('const appUrlError = validateProviderAppUrl(childEnv.NEXT_PUBLIC_APP_URL)')
  expect(source).toContain("await run('Lint', ['run', 'lint'])")
  expect(source).toContain("await run('Typecheck', ['run', 'typecheck'])")
  expect(source).toContain("await run('Build', ['run', 'build'])")
  expect(source).toContain("await run('Playwright e2e', ['run', 'test:e2e'])")
  expect(source).toContain("await run('Dependency audit', ['audit', '--audit-level=moderate'])")
  expect(source).toContain("await run('Environment preflight', [")
  expect(source).toContain("`--app-url=${childEnv.NEXT_PUBLIC_APP_URL}`")
  expect(source).toContain("await run('Rendered route smoke'")
  expect(source).toContain("await run('Supabase write smoke', ['run', 'smoke:supabase', '--', '--write'])")
  expect(source).toContain("await run('Authenticated app smoke', ['run', 'smoke:app'])")
  expect(source).toContain("await run('OpenAI app-route smoke', ['run', 'smoke:openai', '--', '--app'])")
  expect(source).toContain("const stripeArgs = ['run', 'smoke:stripe', '--', '--write', '--webhook']")
  expect(source).toContain("'--provision', '--write', '--audit'")
  expect(source).toContain('Full launch smoke cannot skip local rails or provider smokes')
  expect(source).toContain('Partial technical launch smoke passed; skipped')
  expect(source).toContain("if (!copyApproved) missingManualGates.push('--copy-approved')")
  expect(source).toContain(
    "if (!productionDeployVerified) missingManualGates.push('--production-deploy-verified')"
  )
  expect(source).toContain('--technical-only')
  expect(routeSmokeSource).toContain("'/settings/mcp'")
  expect(routeSmokeSource).toContain("'/auth/reset'")
  expect(routeSmokeSource).toContain("'/auth/update-password'")
  expect(routeSmokeSource).toContain("{ name: 'mobile', width: 390, height: 844 }")
  expect(routeSmokeSource).toContain('VERCEL_AUTOMATION_BYPASS_SECRET')
  expect(routeSmokeSource).toContain("'x-vercel-protection-bypass'")
  expect(routeSmokeSource).toContain('function isVercelProtectionPage')
  expect(routeSmokeSource).toContain('Route smoke blocked by Vercel Deployment Protection')
  expect(routeSmokeSource).toContain('Route smoke passed.')
  for (const envExample of [localEnvExample, productionEnvExample]) {
    expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_URL=')
    expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY=')
    expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY=')
    expect(envExample).toContain('OPENAI_API_KEY=')
    expect(envExample).toContain('STRIPE_SECRET_KEY=')
    expect(envExample).toContain('STRIPE_WEBHOOK_SECRET=')
    expect(envExample).toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=')
    expect(envExample).toContain('STRIPE_PRO_PRICE_ID=')
    expect(envExample).toContain('STRIPE_POWER_PRICE_ID=')
    expect(envExample).toContain('NEXT_PUBLIC_APP_URL=')
    expect(envExample).toContain('NEXDO_API_KEY=nxd_')
    expect(envExample).toContain('NEXDO_READONLY_API_KEY=nxd_')
    expect(envExample).toContain('VERCEL_AUTOMATION_BYPASS_SECRET=')
  }
  expect(productionEnvExample).toContain('Copy this file to `.env.production.local`')
  expect(productionEnvExample).toContain('Do not commit the copied `.env.production.local` file.')
  expect(productionEnvExample).toContain('Use shell exports for ad hoc')
})
