import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeQuota, quotaExceededResponse } from '@/lib/quota'

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const SOURCES = ['manual', 'email', 'voice', 'api', 'agent'] as const
const ACTION_TYPES = ['manual', 'research', 'draft', 'prep', 'remind'] as const
const ENERGY = ['deep', 'light', 'quick'] as const

const MAX_TITLE = 500
const MAX_CONTEXT = 4000

interface ValidationError {
  field: string
  message: string
}

function validateTaskInput(body: Record<string, unknown>): ValidationError[] {
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
  if (typeof body.context === 'string' && body.context.length > MAX_CONTEXT) {
    errs.push({ field: 'context', message: `Context must be ${MAX_CONTEXT} chars or fewer.` })
  }
  if (body.estimated_minutes !== undefined && body.estimated_minutes !== null) {
    const n = Number(body.estimated_minutes)
    if (!Number.isFinite(n) || n < 0 || n > 60 * 24 * 7) {
      errs.push({ field: 'estimated_minutes', message: 'Must be between 0 and 10080.' })
    }
  }
  return errs
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

  const errors = validateTaskInput(body)
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
  }

  // Enforce monthly task-creation quota for free-tier users.
  const quota = await consumeQuota(user.id, 'task_create')
  if (!quota.allowed) {
    return NextResponse.json(quotaExceededResponse(quota), { status: 402 })
  }

  try {
    const {
      title,
      raw_input,
      priority = 'medium',
      due_date,
      context,
      source = 'manual',
      action_type = 'manual',
      estimated_minutes,
      energy_level,
      people,
      tags,
    } = body as Record<string, unknown>
    const db = supabase as any
    const { data: task, error } = await db
      .from('tasks')
      .insert({
        user_id: user.id,
        title: (title as string).trim(),
        raw_input: raw_input ?? null,
        priority: priority ?? 'medium',
        due_date: due_date ?? null,
        context: context ?? null,
        source: source ?? 'manual',
        action_type: action_type ?? 'manual',
        estimated_minutes: estimated_minutes ?? null,
        energy_level: energy_level ?? null,
        people: people ?? null,
        tags: tags ?? null,
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
