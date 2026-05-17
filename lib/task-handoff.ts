import { normalizeLocalDateKey, normalizeLocalTime } from './dates'
import type {
  ActionType,
  EnergyLevel,
  IngestionIntent,
  NoteType,
  Task,
  TaskNote,
  TaskPriority,
  TaskStatus,
} from './database.types'

const MAX_HANDOFF_NOTES = 5
const HANDOFF_HEADER = '# Nexdo Task Handoff'

const TASK_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'waiting',
  'done',
  'cancelled',
]
const TASK_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low']
const ACTION_TYPES: ActionType[] = ['manual', 'research', 'draft', 'prep', 'remind']
const ENERGY_LEVELS: EnergyLevel[] = ['deep', 'light', 'quick']
const INGESTION_INTENTS: IngestionIntent[] = ['create', 'update', 'complete', 'auto']
const NOTE_TYPES: NoteType[] = ['note', 'agent_result', 'link', 'file']

export interface ParsedTaskHandoffNote {
  content: string
  note_type: NoteType
}

export interface ParsedTaskHandoff {
  title: string
  status: TaskStatus
  priority: TaskPriority
  action_type: ActionType
  due_date: string | null
  due_time: string | null
  estimated_minutes: number | null
  energy_level: EnergyLevel | null
  people: string[] | null
  tags: string[] | null
  context: string | null
  description: string | null
  raw_input: string | null
  source_agent_id: string | null
  external_ref: string | null
  ingestion_intent: IngestionIntent | null
  notes: ParsedTaskHandoffNote[]
}

export type TaskHandoffParseResult =
  | { handoff: ParsedTaskHandoff }
  | { error: string }

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (Array.isArray(value)) {
    return value.length > 0 ? `${label}: ${value.join(', ')}` : null
  }

  const text = String(value).trim()
  return text ? `${label}: ${text}` : null
}

function noteLine(note: TaskNote): string {
  const type = note.note_type === 'agent_result' ? 'agent result' : note.note_type
  return `- ${type}: ${note.content}`
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

function nullableValue(value: string | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

function parseList(value: string | undefined): string[] | null {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items && items.length > 0 ? Array.from(new Set(items)) : null
}

function parseEnum<T extends string>(
  label: string,
  value: string | undefined,
  allowed: readonly T[]
): { value: T | null } | { error: string } {
  const text = nullableValue(value)
  if (!text) return { value: null }
  if (allowed.includes(text as T)) return { value: text as T }
  return { error: `Invalid handoff ${label}.` }
}

function parseDue(value: string | undefined):
  | { due_date: string | null; due_time: string | null }
  | { error: string } {
  const text = nullableValue(value)
  if (!text) return { due_date: null, due_time: null }

  const [datePart, timePart] = text.split(/\s+/, 2)
  const dueDate = normalizeLocalDateKey(datePart)
  if (!dueDate) return { error: 'Invalid handoff due date.' }

  const dueTime = timePart ? normalizeLocalTime(timePart) : null
  if (timePart && !dueTime) return { error: 'Invalid handoff due time.' }

  return { due_date: dueDate, due_time: dueTime }
}

function parseEstimate(value: string | undefined):
  | { estimated_minutes: number | null }
  | { error: string } {
  const text = nullableValue(value)
  if (!text) return { estimated_minutes: null }

  const match = /^(\d+)(?:\s+minutes?)?$/i.exec(text)
  if (!match) return { error: 'Invalid handoff estimate.' }

  const estimatedMinutes = Number(match[1])
  if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 10080) {
    return { error: 'Invalid handoff estimate.' }
  }

  return { estimated_minutes: estimatedMinutes }
}

function parseNoteType(value: string): NoteType {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_')
  return NOTE_TYPES.includes(normalized as NoteType)
    ? (normalized as NoteType)
    : 'note'
}

export function parseTaskHandoffBrief(input: string): TaskHandoffParseResult {
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  const firstMeaningfulLine = lines.find((item) => item.trim())
  if (firstMeaningfulLine?.trim() !== HANDOFF_HEADER) {
    return { error: 'Paste a Nexdo task handoff brief.' }
  }

  const fields = new Map<string, string>()
  const notes: ParsedTaskHandoffNote[] = []
  let mode: 'fields' | 'notes' | 'instructions' = 'fields'

  for (const rawLine of lines) {
    const currentLine = rawLine.trim()
    if (!currentLine || currentLine === HANDOFF_HEADER) continue
    if (currentLine === 'Recent notes:') {
      mode = 'notes'
      continue
    }
    if (currentLine === 'Recent notes: none yet') {
      mode = 'notes'
      continue
    }
    if (currentLine === 'Agent instructions:') {
      mode = 'instructions'
      continue
    }
    if (mode === 'instructions') continue

    if (mode === 'notes') {
      const noteMatch = /^-\s*([^:]+):\s*(.+)$/.exec(currentLine)
      if (noteMatch) {
        notes.push({
          note_type: parseNoteType(noteMatch[1]),
          content: noteMatch[2].trim(),
        })
      }
      continue
    }

    const fieldMatch = /^([^:]+):\s*(.*)$/.exec(currentLine)
    if (fieldMatch) {
      fields.set(normalizeLabel(fieldMatch[1]), fieldMatch[2].trim())
    }
  }

  const title = nullableValue(fields.get('title'))
  if (!title) return { error: 'Handoff brief is missing a title.' }

  const status = parseEnum('status', fields.get('status'), TASK_STATUSES)
  if ('error' in status) return status
  const priority = parseEnum('priority', fields.get('priority'), TASK_PRIORITIES)
  if ('error' in priority) return priority
  const actionType = parseEnum('action type', fields.get('action type'), ACTION_TYPES)
  if ('error' in actionType) return actionType
  const energy = parseEnum('energy', fields.get('energy'), ENERGY_LEVELS)
  if ('error' in energy) return energy
  const ingestionIntent = parseEnum(
    'ingestion intent',
    fields.get('ingestion intent'),
    INGESTION_INTENTS
  )
  if ('error' in ingestionIntent) return ingestionIntent

  const due = parseDue(fields.get('due'))
  if ('error' in due) return due
  const estimate = parseEstimate(fields.get('estimate'))
  if ('error' in estimate) return estimate

  return {
    handoff: {
      title,
      status: status.value ?? 'todo',
      priority: priority.value ?? 'medium',
      action_type: actionType.value ?? 'manual',
      due_date: due.due_date,
      due_time: due.due_time,
      estimated_minutes: estimate.estimated_minutes,
      energy_level: energy.value,
      people: parseList(fields.get('people')),
      tags: parseList(fields.get('tags')),
      context: nullableValue(fields.get('context')),
      description: nullableValue(fields.get('description')),
      raw_input: nullableValue(fields.get('original input')),
      source_agent_id: nullableValue(fields.get('source agent')),
      external_ref: nullableValue(fields.get('external ref')),
      ingestion_intent: ingestionIntent.value,
      notes: notes.slice(0, MAX_HANDOFF_NOTES),
    },
  }
}

export function taskHandoffBrief(task: Task, notes: TaskNote[] = []): string {
  const taskLines = [
    '# Nexdo Task Handoff',
    line('Title', task.title),
    line('Status', task.status),
    line('Priority', task.priority),
    line('Action type', task.action_type),
    line(
      'Due',
      task.due_date
        ? `${task.due_date}${task.due_time ? ` ${task.due_time}` : ''}`
        : null
    ),
    line(
      'Estimate',
      task.estimated_minutes !== null && task.estimated_minutes !== undefined
        ? `${task.estimated_minutes} minutes`
        : null
    ),
    line('Energy', task.energy_level),
    line('People', task.people),
    line('Tags', task.tags),
    line('Context', task.context),
    line('Description', task.description),
    line('Original input', task.raw_input && task.raw_input !== task.title ? task.raw_input : null),
    line('Source agent', task.source_agent_id),
    line('External ref', task.external_ref),
    line('Ingestion intent', task.ingestion_intent),
  ].filter((item): item is string => Boolean(item))

  const recentNotes = notes.slice(0, MAX_HANDOFF_NOTES)
  const noteLines =
    recentNotes.length > 0
      ? ['Recent notes:', ...recentNotes.map(noteLine)]
      : ['Recent notes: none yet']

  const instructions = [
    'Agent instructions:',
    '- Read the task details and notes before changing task state.',
    '- Prefer add_task_note with note_type=agent_result for findings, drafts, handoffs, and uncertainty.',
    '- Include source_agent_id and external_ref on create, update, complete, and note writes when available.',
    '- Do not send messages, spend money, or make irreversible external commitments unless the human explicitly asks.',
  ]

  return [...taskLines, '', ...noteLines, '', ...instructions].join('\n')
}
