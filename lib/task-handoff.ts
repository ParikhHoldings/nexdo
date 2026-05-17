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
import { MAX_TASK_NOTE_LENGTH } from './task-notes'

const MAX_HANDOFF_NOTES = 5
const HANDOFF_HEADER = '# Nexdo Task Handoff'
const MAX_HANDOFF_TITLE = 500
const MAX_HANDOFF_TEXT = 4000
const MAX_HANDOFF_ARRAY_ITEMS = 50
const MAX_HANDOFF_ARRAY_ITEM = 120
const MAX_HANDOFF_AGENT_REF = 160

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

function parseBoundedText(
  label: string,
  value: string | undefined,
  maxLength: number
): { value: string | null } | { error: string } {
  const text = nullableValue(value)
  if (!text) return { value: null }
  if (text.length > maxLength) {
    return { error: `Handoff ${label} must be ${maxLength} characters or fewer.` }
  }
  return { value: text }
}

function parseList(label: string, value: string | undefined):
  | { value: string[] | null }
  | { error: string } {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (!items || items.length === 0) return { value: null }

  if (items.length > MAX_HANDOFF_ARRAY_ITEMS) {
    return {
      error: `Handoff ${label} must include ${MAX_HANDOFF_ARRAY_ITEMS} items or fewer.`,
    }
  }

  if (items.some((item) => item.length > MAX_HANDOFF_ARRAY_ITEM)) {
    return {
      error: `Handoff ${label} items must be ${MAX_HANDOFF_ARRAY_ITEM} characters or fewer.`,
    }
  }

  return { value: Array.from(new Set(items)) }
}

function parseEnum<T extends string>(
  label: string,
  value: string | undefined,
  allowed: readonly T[]
): { value: T | null } | { error: string } {
  const text = nullableValue(value)
  if (!text) return { value: null }
  const normalized = text.toLowerCase().replace(/\s+/g, '_')
  if (allowed.includes(normalized as T)) return { value: normalized as T }
  return { error: `Invalid handoff ${label}.` }
}

function parseDue(value: string | undefined):
  | { due_date: string | null; due_time: string | null }
  | { error: string } {
  const text = nullableValue(value)
  if (!text) return { due_date: null, due_time: null }

  const parts = text.split(/\s+/)
  if (parts.length > 2) return { error: 'Invalid handoff due.' }

  const [datePart, timePart] = parts
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
        const content = noteMatch[2].trim()
        if (content.length > MAX_TASK_NOTE_LENGTH) {
          return {
            error: `Handoff note content must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.`,
          }
        }
        notes.push({
          note_type: parseNoteType(noteMatch[1]),
          content,
        })
      }
      continue
    }

    const fieldMatch = /^([^:]+):\s*(.*)$/.exec(currentLine)
    if (fieldMatch) {
      const label = normalizeLabel(fieldMatch[1])
      if (fields.has(label)) {
        return { error: `Duplicate handoff field: ${fieldMatch[1].trim()}.` }
      }
      fields.set(label, fieldMatch[2].trim())
    }
  }

  const title = parseBoundedText('title', fields.get('title'), MAX_HANDOFF_TITLE)
  if ('error' in title) return title
  if (!title.value) return { error: 'Handoff brief is missing a title.' }

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
  const people = parseList('people', fields.get('people'))
  if ('error' in people) return people
  const tags = parseList('tags', fields.get('tags'))
  if ('error' in tags) return tags
  const context = parseBoundedText('context', fields.get('context'), MAX_HANDOFF_TEXT)
  if ('error' in context) return context
  const description = parseBoundedText('description', fields.get('description'), MAX_HANDOFF_TEXT)
  if ('error' in description) return description
  const rawInput = parseBoundedText('original input', fields.get('original input'), MAX_HANDOFF_TEXT)
  if ('error' in rawInput) return rawInput
  const sourceAgentId = parseBoundedText(
    'source agent',
    fields.get('source agent'),
    MAX_HANDOFF_AGENT_REF
  )
  if ('error' in sourceAgentId) return sourceAgentId
  const externalRef = parseBoundedText(
    'external ref',
    fields.get('external ref'),
    MAX_HANDOFF_AGENT_REF
  )
  if ('error' in externalRef) return externalRef

  return {
    handoff: {
      title: title.value,
      status: status.value ?? 'todo',
      priority: priority.value ?? 'medium',
      action_type: actionType.value ?? 'manual',
      due_date: due.due_date,
      due_time: due.due_time,
      estimated_minutes: estimate.estimated_minutes,
      energy_level: energy.value,
      people: people.value,
      tags: tags.value,
      context: context.value,
      description: description.value,
      raw_input: rawInput.value,
      source_agent_id: sourceAgentId.value,
      external_ref: externalRef.value,
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
