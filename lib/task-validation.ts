import type {
  ActionType,
  EnergyLevel,
  TaskPriority,
  TaskSource,
  TaskStatus,
  TaskUpdate,
} from '@/lib/database.types'

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'cancelled'] as const
const CREATE_SOURCES = ['manual', 'email', 'voice', 'api'] as const
const ACTION_TYPES = ['manual', 'research', 'draft', 'prep', 'remind'] as const
const ENERGY = ['deep', 'light', 'quick'] as const

const MAX_TITLE = 500
const MAX_TEXT = 4000
const MAX_DUE_TIME = 8
const MAX_ARRAY_ITEMS = 50
const MAX_ARRAY_ITEM = 120
const MAX_ESTIMATED_MINUTES = 60 * 24 * 7

const CREATE_FIELDS = new Set([
  'title',
  'raw_input',
  'description',
  'priority',
  'due_date',
  'due_time',
  'context',
  'source',
  'action_type',
  'estimated_minutes',
  'energy_level',
  'people',
  'tags',
])

const PATCH_FIELDS = new Set([
  'title',
  'description',
  'context',
  'status',
  'priority',
  'due_date',
  'due_time',
  'action_type',
  'energy_level',
  'estimated_minutes',
  'people',
  'tags',
])

export interface ValidationError {
  field: string
  message: string
}

export type NormalizedTaskInput = {
  title: string
  raw_input: string | null
  description: string | null
  priority: TaskPriority
  due_date: string | null
  due_time: string | null
  context: string | null
  source: Exclude<TaskSource, 'agent'>
  action_type: ActionType
  estimated_minutes: number | null
  energy_level: EnergyLevel | null
  people: string[] | null
  tags: string[] | null
}

export type TaskInputValidation = {
  errors: ValidationError[]
  task: NormalizedTaskInput | null
}

export type TaskPatchValidation = {
  updates: TaskUpdate
  errors: ValidationError[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKnownFields(
  body: Record<string, unknown>,
  allowedFields: Set<string>,
  errors: ValidationError[]
) {
  for (const field of Object.keys(body)) {
    if (!allowedFields.has(field)) {
      errors.push({
        field,
        message: 'This field is not editable through this route.',
      })
    }
  }
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim() || null
}

function validateNullableText(
  field: string,
  value: unknown,
  errors: ValidationError[]
) {
  if (value === undefined || value === null) return

  if (typeof value !== 'string') {
    errors.push({ field, message: 'Must be a string or null.' })
  } else if (value.length > MAX_TEXT) {
    errors.push({ field, message: `Must be ${MAX_TEXT} chars or fewer.` })
  }
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)

  return normalized.length > 0 ? normalized : null
}

function validateStringArray(
  field: string,
  value: unknown,
  errors: ValidationError[]
) {
  if (value === undefined || value === null) return

  if (!Array.isArray(value)) {
    errors.push({ field, message: 'Must be an array of strings or null.' })
    return
  }

  if (value.length > MAX_ARRAY_ITEMS) {
    errors.push({ field, message: `Must include ${MAX_ARRAY_ITEMS} items or fewer.` })
    return
  }

  for (const item of value) {
    if (typeof item !== 'string') {
      errors.push({ field, message: 'Must be an array of strings or null.' })
      return
    }
    if (item.length > MAX_ARRAY_ITEM) {
      errors.push({ field, message: `Items must be ${MAX_ARRAY_ITEM} characters or fewer.` })
      return
    }
  }
}

function validateDueDate(value: unknown, errors: ValidationError[], nullableMessage: string) {
  if (value === undefined || value === null) return

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push({ field: 'due_date', message: nullableMessage })
  }
}

function validateDueTime(value: unknown, errors: ValidationError[], nullableMessage: string) {
  if (value === undefined || value === null) return

  if (
    typeof value !== 'string' ||
    value.length > MAX_DUE_TIME ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(value)
  ) {
    errors.push({ field: 'due_time', message: nullableMessage })
  }
}

function validateEstimatedMinutes(field: string, value: unknown, errors: ValidationError[]) {
  if (value === undefined || value === null) return

  const minutes = Number(value)
  if (
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > MAX_ESTIMATED_MINUTES
  ) {
    errors.push({
      field,
      message: `Must be between 0 and ${MAX_ESTIMATED_MINUTES}.`,
    })
  }
}

export function validateTaskInput(value: unknown): TaskInputValidation {
  const errors: ValidationError[] = []

  if (!isRecord(value)) {
    return {
      errors: [{ field: 'body', message: 'Request body must be an object.' }],
      task: null,
    }
  }

  hasOnlyKnownFields(value, CREATE_FIELDS, errors)

  if (typeof value.title !== 'string' || value.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required.' })
  } else if (value.title.length > MAX_TITLE) {
    errors.push({ field: 'title', message: `Title must be ${MAX_TITLE} chars or fewer.` })
  }

  if (value.priority !== undefined && !PRIORITIES.includes(value.priority as TaskPriority)) {
    errors.push({ field: 'priority', message: `Must be one of ${PRIORITIES.join(', ')}.` })
  }

  if (value.source !== undefined && !CREATE_SOURCES.includes(value.source as typeof CREATE_SOURCES[number])) {
    errors.push({ field: 'source', message: `Must be one of ${CREATE_SOURCES.join(', ')}.` })
  }

  if (value.action_type !== undefined && !ACTION_TYPES.includes(value.action_type as ActionType)) {
    errors.push({ field: 'action_type', message: `Must be one of ${ACTION_TYPES.join(', ')}.` })
  }

  if (value.energy_level !== undefined && value.energy_level !== null && !ENERGY.includes(value.energy_level as EnergyLevel)) {
    errors.push({ field: 'energy_level', message: `Must be one of ${ENERGY.join(', ')}.` })
  }

  validateDueDate(value.due_date, errors, 'Must be YYYY-MM-DD.')
  validateDueTime(value.due_time, errors, 'Must be HH:MM or HH:MM:SS.')

  for (const field of ['raw_input', 'description', 'context'] as const) {
    validateNullableText(field, value[field], errors)
  }

  validateEstimatedMinutes('estimated_minutes', value.estimated_minutes, errors)
  validateStringArray('people', value.people, errors)
  validateStringArray('tags', value.tags, errors)

  if (errors.length > 0) {
    return { errors, task: null }
  }

  return {
    errors: [],
    task: {
      title: (value.title as string).trim(),
      raw_input: normalizeNullableText(value.raw_input),
      description: normalizeNullableText(value.description),
      priority: (value.priority as TaskPriority | undefined) ?? 'medium',
      due_date: (value.due_date as string | null | undefined) ?? null,
      due_time: (value.due_time as string | null | undefined) ?? null,
      context: normalizeNullableText(value.context),
      source: (value.source as Exclude<TaskSource, 'agent'> | undefined) ?? 'manual',
      action_type: (value.action_type as ActionType | undefined) ?? 'manual',
      estimated_minutes:
        value.estimated_minutes === undefined || value.estimated_minutes === null
          ? null
          : Math.round(Number(value.estimated_minutes)),
      energy_level: (value.energy_level as EnergyLevel | null | undefined) ?? null,
      people: normalizeStringArray(value.people),
      tags: normalizeStringArray(value.tags),
    },
  }
}

export function validateTaskPatch(value: unknown): TaskPatchValidation {
  const errors: ValidationError[] = []
  const updates: TaskUpdate = {}

  if (!isRecord(value)) {
    return {
      errors: [{ field: 'body', message: 'Request body must be an object.' }],
      updates,
    }
  }

  hasOnlyKnownFields(value, PATCH_FIELDS, errors)

  if (value.title !== undefined) {
    if (typeof value.title !== 'string' || value.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required.' })
    } else if (value.title.length > MAX_TITLE) {
      errors.push({ field: 'title', message: `Title must be ${MAX_TITLE} chars or fewer.` })
    } else {
      updates.title = value.title.trim()
    }
  }

  if (value.description !== undefined) {
    const errorCount = errors.length
    validateNullableText('description', value.description, errors)
    if (errors.length === errorCount) {
      updates.description = normalizeNullableText(value.description)
    }
  }

  if (value.context !== undefined) {
    const errorCount = errors.length
    validateNullableText('context', value.context, errors)
    if (errors.length === errorCount) {
      updates.context = normalizeNullableText(value.context)
    }
  }

  if (value.status !== undefined) {
    if (!STATUSES.includes(value.status as TaskStatus)) {
      errors.push({ field: 'status', message: `Must be one of ${STATUSES.join(', ')}.` })
    } else {
      updates.status = value.status as TaskStatus
    }
  }

  if (value.priority !== undefined) {
    if (!PRIORITIES.includes(value.priority as TaskPriority)) {
      errors.push({ field: 'priority', message: `Must be one of ${PRIORITIES.join(', ')}.` })
    } else {
      updates.priority = value.priority as TaskPriority
    }
  }

  if (value.due_date !== undefined) {
    const errorCount = errors.length
    validateDueDate(value.due_date, errors, 'Must be YYYY-MM-DD or null.')
    if (errors.length === errorCount) {
      updates.due_date = (value.due_date as string | null) ?? null
    }
  }

  if (value.due_time !== undefined) {
    const errorCount = errors.length
    validateDueTime(value.due_time, errors, 'Must be HH:MM, HH:MM:SS, or null.')
    if (errors.length === errorCount) {
      updates.due_time = (value.due_time as string | null) ?? null
    }
  }

  if (value.action_type !== undefined) {
    if (!ACTION_TYPES.includes(value.action_type as ActionType)) {
      errors.push({ field: 'action_type', message: `Must be one of ${ACTION_TYPES.join(', ')}.` })
    } else {
      updates.action_type = value.action_type as ActionType
    }
  }

  if (value.energy_level !== undefined) {
    if (value.energy_level !== null && !ENERGY.includes(value.energy_level as EnergyLevel)) {
      errors.push({ field: 'energy_level', message: `Must be one of ${ENERGY.join(', ')} or null.` })
    } else {
      updates.energy_level = (value.energy_level as EnergyLevel | null) ?? null
    }
  }

  if (value.estimated_minutes !== undefined) {
    const errorCount = errors.length
    validateEstimatedMinutes('estimated_minutes', value.estimated_minutes, errors)
    if (errors.length === errorCount) {
      updates.estimated_minutes =
        value.estimated_minutes === null
          ? null
          : Math.round(Number(value.estimated_minutes))
    }
  }

  if (value.people !== undefined) {
    const errorCount = errors.length
    validateStringArray('people', value.people, errors)
    if (errors.length === errorCount) {
      updates.people = normalizeStringArray(value.people)
    }
  }

  if (value.tags !== undefined) {
    const errorCount = errors.length
    validateStringArray('tags', value.tags, errors)
    if (errors.length === errorCount) {
      updates.tags = normalizeStringArray(value.tags)
    }
  }

  return { updates, errors }
}
