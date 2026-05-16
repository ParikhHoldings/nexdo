import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeQuota, quotaExceededResponse } from '@/lib/quota'

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const SOURCES = ['manual', 'email', 'voice', 'api'] as const
const ACTION_TYPES = ['manual', 'research', 'draft', 'prep', 'remind'] as const
const ENERGY = ['deep', 'light', 'quick'] as const

const MAX_TITLE = 500
const MAX_CONTEXT = 4000
const MAX_DUE_TIME = 8
const MAX_ARRAY_ITEMS = 50
const MAX_ARRAY_ITEM = 120

interface ValidationError {
  field: string
  message: string
}

type NormalizedTaskInput = {
  title: string
  raw_input: string | null
  description: string | null
  priority: string
  due_date: string | null
  due_time: string | null
  context: string | null
  source: string
  action_type: string
  estimated_minutes: number | null
  energy_level: string | null
  people: string[] | null
  tags: string[] | null
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim() || null
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

function validateTaskInput(body: Record<string, unknown>): {
  errors: ValidationError[]
  task: NormalizedTaskInput | null
} {
  const errs: ValidationError[] = []
  if (typeof body.title !== 'string' || body.title.trim().length === 0) {
    errs.push({ field: 'title', message: 'Title is required.' })
  } else if (body.title.length > MAX_TITLE) {
    errs.push({ field: 'title', message: `Title must be ${MAX_TITLE} chars or fewer.` })
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority as typeof PRIORITIES[number])) {
    errs.push({ field: 'priority', message: `Must be one of ${PRIORITIES.join(', ')}.` })
  }
  if (body.source !== undefined && !SOURCES.includes(body.source as typeof SOURCES[number])) {
    errs.push({ field: 'source', message: `Must be one of ${SOURCES.join(', ')}.` })
  }
  if (body.action_type !== undefined && !ACTION_TYPES.includes(body.action_type as typeof ACTION_TYPES[number])) {
    errs.push({ field: 'action_type', message: `Must be one of ${ACTION_TYPES.join(', ')}.` })
  }
  if (body.energy_level !== undefined && body.energy_level !== null && !ENERGY.includes(body.energy_level as typeof ENERGY[number])) {
    errs.push({ field: 'energy_level', message: `Must be one of ${ENERGY.join(', ')}.` })
  }
  if (body.due_date !== undefined && body.due_date !== null) {
    if (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
      errs.push({ field: 'due_date', message: 'Must be YYYY-MM-DD.' })
    }
  }

  if (body.due_time !== undefined && body.due_time !== null) {
    if (
      typeof body.due_time !== 'string' ||
      body.due_time.length > MAX_DUE_TIME ||
      !/^\d{2}:\d{2}(:\d{2})?$/.test(body.due_time)
    ) {
      errs.push({ field: 'due_time', message: 'Must be HH:MM or HH:MM:SS.' })
    }
  }

  for (const field of ['raw_input', 'description', 'context'] as const) {
    const value = body[field]
    if (value !== undefined && value !== null && typeof value !== 'string') {
      errs.push({ field, message: 'Must be a string or null.' })
    } else if (typeof value === 'string' && value.length > MAX_CONTEXT) {
      errs.push({ field, message: `Must be ${MAX_CONTEXT} chars or fewer.` })
    }
  }

  if (body.estimated_minutes !== undefined && body.estimated_minutes !== null) {
    const n = Number(body.estimated_minutes)
    if (!Number.isFinite(n) || n < 0 || n > 60 * 24 * 7) {
      errs.push({ field: 'estimated_minutes', message: 'Must be between 0 and 10080.' })
    }
  }

  validateStringArray('people', body.people, errs)
  validateStringArray('tags', body.tags, errs)

  if (errs.length > 0) {
    return { errors: errs, task: null }
  }

  return {
    errors: [],
    task: {
      title: (body.title as string).trim(),
      raw_input: normalizeNullableText(body.raw_input),
      description: normalizeNullableText(body.description),
      priority: (body.priority as string | undefined) ?? 'medium',
      due_date: (body.due_date as string | null | undefined) ?? null,
      due_time: (body.due_time as string | null | undefined) ?? null,
      context: normalizeNullableText(body.context),
      source: (body.source as string | undefined) ?? 'manual',
      action_type: (body.action_type as string | undefined) ?? 'manual',
      estimated_minutes:
        body.estimated_minutes === undefined || body.estimated_minutes === null
          ? null
          : Math.round(Number(body.estimated_minutes)),
      energy_level: (body.energy_level as string | null | undefined) ?? null,
      people: normalizeStringArray(body.people),
      tags: normalizeStringArray(body.tags),
    },
  }
}

export async function GET() {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = supabase as any
  const { data: tasks, error } = await db
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 })
  }

  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { errors, task: validatedTask } = validateTaskInput(body)
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
  }

  // Enforce monthly task-creation quota for free-tier users.
  const quota = await consumeQuota(user.id, 'task_create')
  if (!quota.allowed) {
    return NextResponse.json(quotaExceededResponse(quota), { status: 402 })
  }

  try {
    if (!validatedTask) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    }

    const db = supabase as any
    const { data: task, error } = await db
      .from('tasks')
      .insert({
        user_id: user.id,
        title: validatedTask.title,
        raw_input: validatedTask.raw_input,
        description: validatedTask.description,
        priority: validatedTask.priority,
        due_date: validatedTask.due_date,
        due_time: validatedTask.due_time,
        context: validatedTask.context,
        source: validatedTask.source,
        action_type: validatedTask.action_type,
        estimated_minutes: validatedTask.estimated_minutes,
        energy_level: validatedTask.energy_level,
        people: validatedTask.people,
        tags: validatedTask.tags,
        status: 'todo',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
