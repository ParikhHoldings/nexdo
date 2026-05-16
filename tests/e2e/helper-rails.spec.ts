import { expect, test } from '@playwright/test'
import {
  canUseApiAccess,
  hasRequiredScope,
  normalizeApiKeyScopes,
  requiredScopeForTool,
} from '../../lib/agent-scopes'
import { sanitizeAiTasks, sanitizeUserName } from '../../lib/ai-task-input'
import { quotaExceededResponse } from '../../lib/quota'
import { rateLimitResponseHeaders } from '../../lib/rate-limit'

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
