import { expect, test } from '@playwright/test'
import type { Task } from '../../lib/database.types'
import {
  executeDraftHeuristic,
  executePrepHeuristic,
  executeResearchHeuristic,
  executeTaskHeuristic,
  generateBriefingHeuristic,
  parseTaskHeuristic,
  prioritizeTasksHeuristic,
} from '../../lib/task-intelligence'
import { getLocalDateKey } from '../../lib/dates'

function isoDate(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return getLocalDateKey(date)
}

function task(overrides: Partial<Task>): Task {
  const now = new Date().toISOString()

  return {
    id: overrides.id || crypto.randomUUID(),
    user_id: 'test-user',
    title: overrides.title || 'Untitled task',
    raw_input: overrides.raw_input ?? null,
    description: overrides.description ?? null,
    status: overrides.status || 'todo',
    priority: overrides.priority || 'medium',
    due_date: overrides.due_date ?? null,
    due_time: overrides.due_time ?? null,
    context: overrides.context ?? null,
    source: overrides.source || 'manual',
    action_type: overrides.action_type || 'manual',
    estimated_minutes: overrides.estimated_minutes ?? null,
    energy_level: overrides.energy_level ?? null,
    people: overrides.people ?? null,
    tags: overrides.tags ?? null,
    parent_task_id: overrides.parent_task_id ?? null,
    related_task_ids: overrides.related_task_ids ?? null,
    agent_output: overrides.agent_output ?? null,
    completed_at: overrides.completed_at ?? null,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
    source_agent_id: overrides.source_agent_id ?? null,
    external_ref: overrides.external_ref ?? null,
    ingestion_intent: overrides.ingestion_intent ?? null,
    agent_metadata: overrides.agent_metadata ?? null,
  }
}

test('task parsing heuristic extracts launch-relevant metadata', () => {
  const parsed = parseTaskHeuristic(
    'Draft launch email to Sarah tomorrow at 2:30pm 25 min high priority for customer rollout',
    new Date('2026-05-16T12:00:00')
  )

  expect(parsed).toMatchObject({
    title: 'Draft launch email to Sarah for customer rollout',
    due_date: '2026-05-17',
    due_time: '14:30',
    priority: 'high',
    action_type: 'draft',
    estimated_minutes: 25,
    energy_level: 'light',
  })
  expect(parsed.people).toContain('Sarah')
  expect(parsed.tags).toEqual(expect.arrayContaining(['email', 'customer']))
})

test('task parsing heuristic removes relative date connectors from titles', () => {
  const byTomorrow = parseTaskHeuristic(
    'Draft the Monday launch handoff for Nexdo by tomorrow',
    new Date('2026-05-17T12:00:00')
  )
  expect(byTomorrow).toMatchObject({
    title: 'Draft the Monday launch handoff for Nexdo',
    due_date: '2026-05-18',
    priority: 'high',
    action_type: 'draft',
  })

  const dueToday = parseTaskHeuristic(
    'Review launch blockers due today',
    new Date('2026-05-17T12:00:00')
  )
  expect(dueToday.title).toBe('Review launch blockers')
  expect(dueToday.due_date).toBe('2026-05-17')
})

test('task parsing heuristic rejects invalid explicit due dates', () => {
  expect(
    parseTaskHeuristic(
      'Review launch plan on 2026-02-30',
      new Date('2026-01-15T12:00:00')
    ).due_date
  ).toBeNull()

  expect(
    parseTaskHeuristic(
      'Review launch plan on 13/01/2026',
      new Date('2026-01-15T12:00:00')
    ).due_date
  ).toBeNull()

  expect(
    parseTaskHeuristic(
      'Review launch plan on 2/28/2026',
      new Date('2026-01-15T12:00:00')
    ).due_date
  ).toBe('2026-02-28')
})

test('prioritization heuristic ranks urgent and dated tasks first', () => {
  const ranked = prioritizeTasksHeuristic(
    [
      task({
        id: 'low-quick',
        title: 'Quick cleanup',
        priority: 'low',
        estimated_minutes: 10,
        energy_level: 'quick',
      }),
      task({
        id: 'urgent-today',
        title: 'Fix launch blocker',
        priority: 'urgent',
        due_date: isoDate(0),
        estimated_minutes: 60,
        energy_level: 'deep',
      }),
      task({
        id: 'medium-later',
        title: 'Later follow-up',
        priority: 'medium',
        due_date: isoDate(3),
        estimated_minutes: 30,
        energy_level: 'light',
      }),
    ],
    new Date(`${isoDate(0)}T08:00:00`)
  )

  expect(ranked[0]).toMatchObject({
    task_id: 'urgent-today',
    rank: 1,
    time_block: 'morning_deep',
  })
  expect(ranked.find((item) => item.task_id === 'low-quick')).toMatchObject({
    time_block: 'quick_win',
  })
})

test('prioritization heuristic orders timed same-day tasks by due time', () => {
  const ranked = prioritizeTasksHeuristic(
    [
      task({
        id: 'late-today',
        title: 'Send end-of-day recap',
        priority: 'high',
        due_date: isoDate(0),
        due_time: '17:00',
        estimated_minutes: 30,
      }),
      task({
        id: 'early-today',
        title: 'Join launch standup',
        priority: 'high',
        due_date: isoDate(0),
        due_time: '09:00',
        estimated_minutes: 30,
      }),
    ],
    new Date(`${isoDate(0)}T08:00:00`)
  )

  expect(ranked.map((item) => item.task_id)).toEqual(['early-today', 'late-today'])
  expect(ranked[0].reasoning).toContain('09:00')
})

test('briefing heuristic summarizes active tasks without closed work', () => {
  const briefing = generateBriefingHeuristic(
    [
      task({
        id: 'overdue',
        title: 'Reply to blocked customer',
        priority: 'urgent',
        due_date: isoDate(-2),
        people: ['Jordan'],
      }),
      task({
        id: 'quick',
        title: 'Send status note',
        priority: 'medium',
        estimated_minutes: 10,
      }),
      task({
        id: 'done',
        title: 'Already shipped',
        status: 'done',
        priority: 'urgent',
        due_date: isoDate(-5),
      }),
      task({
        id: 'cancelled',
        title: 'Cancelled handoff',
        status: 'cancelled',
        priority: 'urgent',
        due_date: isoDate(-5),
        people: ['Taylor'],
      }),
    ],
    'Casey'
  )

  expect(briefing.greeting).toContain('Casey')
  expect(briefing.top_priorities.map((item) => item.task_id)).toContain('overdue')
  expect(briefing.overdue).toEqual([
    expect.objectContaining({
      task_id: 'overdue',
      days_overdue: 2,
    }),
  ])
  expect(briefing.quick_wins).toEqual([
    expect.objectContaining({ task_id: 'quick', estimated_minutes: 10 }),
  ])
  expect(briefing.someone_waiting).toEqual([
    expect.objectContaining({ task_id: 'overdue', person: 'Jordan' }),
  ])
  expect(briefing.top_priorities.map((item) => item.task_id)).not.toContain('cancelled')
  expect(briefing.overdue.map((item) => item.task_id)).not.toContain('cancelled')
  expect(briefing.summary).toContain('2 active tasks')
})

test('briefing heuristic treats past due times today as overdue', () => {
  const briefing = generateBriefingHeuristic(
    [
      task({
        id: 'past-time',
        title: 'Join launch partner call',
        priority: 'high',
        due_date: '2026-05-17',
        due_time: '09:30',
      }),
      task({
        id: 'future-time',
        title: 'Send evening recap',
        priority: 'high',
        due_date: '2026-05-17',
        due_time: '17:30',
      }),
    ],
    'Casey',
    new Date('2026-05-17T12:00:00')
  )

  expect(briefing.overdue).toEqual([
    expect.objectContaining({
      task_id: 'past-time',
      days_overdue: 0,
    }),
  ])
  expect(briefing.summary).toContain('1 overdue item')
})

test('execution heuristics return bounded outputs by action type', () => {
  const researchTask = task({
    title: 'Research pricing options',
    action_type: 'research',
    context: 'Compare entry-level launch plans.',
  })
  const draftTask = task({
    title: 'Draft customer update',
    action_type: 'draft',
    people: ['Mira'],
  })
  const prepTask = task({
    title: 'Prepare launch standup',
    action_type: 'prep',
    estimated_minutes: 45,
  })

  expect(executeResearchHeuristic(researchTask).key_findings.length).toBeGreaterThanOrEqual(3)
  expect(executeDraftHeuristic(draftTask).draft).toContain('Mira')
  expect(executePrepHeuristic(prepTask).questions_to_ask.length).toBeGreaterThanOrEqual(3)
  expect(executeTaskHeuristic(researchTask)).toHaveProperty('recommended_action')
  expect(executeTaskHeuristic(draftTask)).toHaveProperty('suggested_subject')
  expect(executeTaskHeuristic(prepTask)).toHaveProperty('materials_needed')
  expect(executeTaskHeuristic(task({ title: 'Manual task' }))).toBeNull()
})
