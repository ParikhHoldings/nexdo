import type { Task } from './database.types'

export const TASK_EXPORT_FIELDS = [
  'id',
  'title',
  'raw_input',
  'description',
  'status',
  'priority',
  'due_date',
  'due_time',
  'action_type',
  'estimated_minutes',
  'energy_level',
  'people',
  'tags',
  'parent_task_id',
  'related_task_ids',
  'context',
  'source',
  'agent_output',
  'source_agent_id',
  'external_ref',
  'ingestion_intent',
  'agent_metadata',
  'created_at',
  'updated_at',
  'completed_at',
] as const

type TaskExportField = (typeof TASK_EXPORT_FIELDS)[number]

export interface TaskExportPayload {
  version: 1
  exported_at: string
  task_count: number
  tasks: Array<Pick<Task, TaskExportField>>
}

function taskExportRow(task: Task): Pick<Task, TaskExportField> {
  const row = {} as Record<TaskExportField, Task[TaskExportField]>

  for (const field of TASK_EXPORT_FIELDS) {
    row[field] = task[field]
  }

  return row as Pick<Task, TaskExportField>
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = Array.isArray(value)
    ? value.join('; ')
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

  return `"${text.replace(/"/g, '""')}"`
}

export function tasksToExportPayload(
  tasks: Task[],
  exportedAt = new Date()
): TaskExportPayload {
  return {
    version: 1,
    exported_at: exportedAt.toISOString(),
    task_count: tasks.length,
    tasks: tasks.map(taskExportRow),
  }
}

export function tasksToJsonString(tasks: Task[], exportedAt = new Date()) {
  return `${JSON.stringify(tasksToExportPayload(tasks, exportedAt), null, 2)}\n`
}

export function tasksToCsv(tasks: Task[]) {
  const header = TASK_EXPORT_FIELDS.join(',')
  const rows = tasks.map((task) =>
    TASK_EXPORT_FIELDS.map((field) => csvCell(task[field])).join(',')
  )

  return `${[header, ...rows].join('\n')}\n`
}
