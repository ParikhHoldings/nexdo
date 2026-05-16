import type { Task, TaskPriority, TaskStatus } from '@/lib/database.types'

const STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'cancelled'] as const
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const ACTION_TYPES = ['manual', 'research', 'draft', 'prep', 'remind'] as const
const ENERGY = ['deep', 'light', 'quick'] as const

const MAX_TITLE = 500
const MAX_CONTEXT = 1200
const MAX_ARRAY_ITEMS = 20
const MAX_ARRAY_ITEM = 80
const MAX_USER_NAME = 120

type SanitizedTaskResult =
  | { ok: true; tasks: Task[] }
  | { ok: false; error: string }

function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return null
  return value.trim().slice(0, max) || null
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const items = value
    .slice(0, MAX_ARRAY_ITEMS)
    .map((item) => text(item, MAX_ARRAY_ITEM))
    .filter((item): item is string => Boolean(item))

  return items.length > 0 ? items : null
}

function finiteMinutes(value: unknown): number | null {
  if (value === undefined || value === null) return null
  const minutes = Number(value)
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 60 * 24 * 7) {
    return null
  }
  return Math.round(minutes)
}

function validDate(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }
  return value
}

export function sanitizeUserName(value: unknown) {
  return text(value, MAX_USER_NAME) || 'there'
}

export function sanitizeAiTasks(value: unknown, maxTasks: number): SanitizedTaskResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'Invalid tasks array' }
  }

  if (value.length > maxTasks) {
    return { ok: false, error: `Too many tasks (max ${maxTasks} per request)` }
  }

  const now = new Date().toISOString()
  const tasks: Task[] = []

  for (const [index, rawTask] of value.entries()) {
    if (!rawTask || typeof rawTask !== 'object' || Array.isArray(rawTask)) {
      return { ok: false, error: `Task at index ${index} must be an object` }
    }

    const task = rawTask as Record<string, unknown>
    const id = text(task.id, 120)
    const title = text(task.title, MAX_TITLE)

    if (!id || !title) {
      return { ok: false, error: `Task at index ${index} requires id and title` }
    }

    const status = STATUSES.includes(task.status as TaskStatus)
      ? (task.status as TaskStatus)
      : 'todo'
    const priority = PRIORITIES.includes(task.priority as TaskPriority)
      ? (task.priority as TaskPriority)
      : 'medium'
    const actionType = ACTION_TYPES.includes(task.action_type as Task['action_type'])
      ? (task.action_type as Task['action_type'])
      : 'manual'
    const energyLevel = ENERGY.includes(task.energy_level as NonNullable<Task['energy_level']>)
      ? (task.energy_level as NonNullable<Task['energy_level']>)
      : null

    tasks.push({
      id,
      user_id: text(task.user_id, 120) || '',
      title,
      raw_input: text(task.raw_input, MAX_CONTEXT),
      description: text(task.description, MAX_CONTEXT),
      status,
      priority,
      due_date: validDate(task.due_date),
      due_time: text(task.due_time, 8),
      context: text(task.context, MAX_CONTEXT),
      source: 'manual',
      action_type: actionType,
      estimated_minutes: finiteMinutes(task.estimated_minutes),
      energy_level: energyLevel,
      people: stringArray(task.people),
      tags: stringArray(task.tags),
      parent_task_id: null,
      related_task_ids: null,
      agent_output: null,
      completed_at: null,
      created_at: text(task.created_at, 40) || now,
      updated_at: text(task.updated_at, 40) || now,
      source_agent_id: text(task.source_agent_id, 160),
      external_ref: text(task.external_ref, 160),
      ingestion_intent: null,
      agent_metadata: null,
    })
  }

  return { ok: true, tasks }
}
