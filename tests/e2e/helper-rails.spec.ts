import { expect, test } from '@playwright/test'
import {
  canUseApiAccess,
  hasRequiredScope,
  normalizeApiKeyScopes,
  requiredScopeForTool,
} from '../../lib/agent-scopes'
import { sanitizeAiTasks, sanitizeUserName } from '../../lib/ai-task-input'
import {
  appendAgentExecution,
  normalizeAgentOutput,
  updateAgentReview,
} from '../../lib/agent-output'
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
