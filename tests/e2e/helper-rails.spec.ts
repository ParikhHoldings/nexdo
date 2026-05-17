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
  appendAgentExecution,
  normalizeAgentOutput,
  updateAgentReview,
} from '../../lib/agent-output'
import { createClientProfileFallback } from '../../lib/profile'
import { quotaExceededResponse, quotaFailureStatus } from '../../lib/quota'
import { rateLimitResponseHeaders } from '../../lib/rate-limit'
import { validateTaskInput, validateTaskPatch } from '../../lib/task-validation'

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
    due_time: '14:30:00',
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
    user_id: 'other-user',
    source_agent_id: 'agent-1',
    agent_output: { draft: 'spoofed' },
  })

  expect(invalid.task).toBeNull()
  expect(invalid.errors.map((error) => error.field)).toEqual(
    expect.arrayContaining(['source', 'user_id', 'source_agent_id', 'agent_output'])
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

  expect(source).toContain("const shouldSmokeAppRoutes = args.has('--app')")
  expect(source).toContain("import { createBrowserClient } from '@supabase/ssr'")
  expect(source).toContain('await supabase.auth.signInWithPassword({ email, password })')
  expect(source).toContain("postAppJson(cookieHeader, '/api/tasks/parse'")
  expect(source).toContain("postAppJson(cookieHeader, '/api/tasks/prioritize'")
  expect(source).toContain("postAppJson(cookieHeader, '/api/briefing'")
  expect(source).toContain("postAppJson(cookieHeader, '/api/agent/execute'")
  expect(source).toContain("for (const actionType of ['research', 'draft', 'prep'])")
  expect(source).toContain("subscription_tier: 'power'")
  expect(source).toContain("select('agent_output')")
})

test('launch smoke orchestrates required technical and approval gates', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const source = readFileSync('scripts/smoke-launch.mjs', 'utf8')

  expect(packageJson.scripts['smoke:launch']).toBe('node scripts/smoke-launch.mjs')
  expect(source).toContain("const envArg = rawArgs.find((arg) => arg.startsWith('--env='))")
  expect(source).toContain('...fileEnv')
  expect(source).toContain("await run('Lint', ['run', 'lint'])")
  expect(source).toContain("await run('Typecheck', ['run', 'typecheck'])")
  expect(source).toContain("await run('Build', ['run', 'build'])")
  expect(source).toContain("await run('Playwright e2e', ['run', 'test:e2e'])")
  expect(source).toContain("await run('Dependency audit', ['audit', '--audit-level=moderate'])")
  expect(source).toContain("await run('Environment preflight', ['run', 'verify:env', '--', envFile])")
  expect(source).toContain("await run('Supabase write smoke', ['run', 'smoke:supabase', '--', '--write'])")
  expect(source).toContain("await run('OpenAI app-route smoke', ['run', 'smoke:openai', '--', '--app'])")
  expect(source).toContain("const stripeArgs = ['run', 'smoke:stripe', '--', '--write', '--webhook']")
  expect(source).toContain("'--provision', '--write', '--audit'")
  expect(source).toContain('Full launch smoke cannot skip local rails or provider smokes')
  expect(source).toContain("if (!copyApproved) missingManualGates.push('--copy-approved')")
  expect(source).toContain(
    "if (!productionDeployVerified) missingManualGates.push('--production-deploy-verified')"
  )
  expect(source).toContain('--technical-only')
})
