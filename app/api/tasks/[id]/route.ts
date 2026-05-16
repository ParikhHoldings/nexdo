import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TaskPriority, TaskStatus } from '@/lib/database.types'

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'cancelled'] as const
const ACTION_TYPES = ['manual', 'research', 'draft', 'prep', 'remind'] as const
const ENERGY = ['deep', 'light', 'quick'] as const

const MAX_TITLE = 500
const MAX_TEXT = 4000

type PatchValidation = {
  updates: Record<string, unknown>
  errors: Array<{ field: string; message: string }>
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function validatePatch(body: Record<string, unknown>): PatchValidation {
  const updates: Record<string, unknown> = {}
  const errors: PatchValidation['errors'] = []

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required.' })
    } else if (body.title.length > MAX_TITLE) {
      errors.push({ field: 'title', message: `Title must be ${MAX_TITLE} chars or fewer.` })
    } else {
      updates.title = body.title.trim()
    }
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      errors.push({ field: 'description', message: 'Must be a string or null.' })
    } else if (typeof body.description === 'string' && body.description.length > MAX_TEXT) {
      errors.push({ field: 'description', message: `Description must be ${MAX_TEXT} chars or fewer.` })
    } else {
      updates.description = body.description
    }
  }

  if (body.context !== undefined) {
    if (body.context !== null && typeof body.context !== 'string') {
      errors.push({ field: 'context', message: 'Must be a string or null.' })
    } else if (typeof body.context === 'string' && body.context.length > MAX_TEXT) {
      errors.push({ field: 'context', message: `Context must be ${MAX_TEXT} chars or fewer.` })
    } else {
      updates.context = body.context
    }
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as TaskStatus)) {
      errors.push({ field: 'status', message: `Must be one of ${STATUSES.join(', ')}.` })
    } else {
      updates.status = body.status
    }
  }

  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority as TaskPriority)) {
      errors.push({ field: 'priority', message: `Must be one of ${PRIORITIES.join(', ')}.` })
    } else {
      updates.priority = body.priority
    }
  }

  if (body.due_date !== undefined) {
    if (
      body.due_date !== null &&
      (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date))
    ) {
      errors.push({ field: 'due_date', message: 'Must be YYYY-MM-DD or null.' })
    } else {
      updates.due_date = body.due_date
    }
  }

  if (body.due_time !== undefined) {
    if (
      body.due_time !== null &&
      (typeof body.due_time !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(body.due_time))
    ) {
      errors.push({ field: 'due_time', message: 'Must be HH:MM, HH:MM:SS, or null.' })
    } else {
      updates.due_time = body.due_time
    }
  }

  if (body.action_type !== undefined) {
    if (!ACTION_TYPES.includes(body.action_type as typeof ACTION_TYPES[number])) {
      errors.push({ field: 'action_type', message: `Must be one of ${ACTION_TYPES.join(', ')}.` })
    } else {
      updates.action_type = body.action_type
    }
  }

  if (body.energy_level !== undefined) {
    if (body.energy_level !== null && !ENERGY.includes(body.energy_level as typeof ENERGY[number])) {
      errors.push({ field: 'energy_level', message: `Must be one of ${ENERGY.join(', ')} or null.` })
    } else {
      updates.energy_level = body.energy_level
    }
  }

  if (body.estimated_minutes !== undefined) {
    if (body.estimated_minutes === null) {
      updates.estimated_minutes = null
    } else {
      const minutes = Number(body.estimated_minutes)
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 60 * 24 * 7) {
        errors.push({ field: 'estimated_minutes', message: 'Must be between 0 and 10080.' })
      } else {
        updates.estimated_minutes = Math.round(minutes)
      }
    }
  }

  if (body.people !== undefined) {
    if (body.people !== null && !isStringArray(body.people)) {
      errors.push({ field: 'people', message: 'Must be an array of strings or null.' })
    } else {
      updates.people = body.people
    }
  }

  if (body.tags !== undefined) {
    if (body.tags !== null && !isStringArray(body.tags)) {
      errors.push({ field: 'tags', message: 'Must be an array of strings or null.' })
    } else {
      updates.tags = body.tags
    }
  }

  if (body.agent_output !== undefined) {
    if (
      body.agent_output !== null &&
      (typeof body.agent_output !== 'object' || Array.isArray(body.agent_output))
    ) {
      errors.push({ field: 'agent_output', message: 'Must be an object or null.' })
    } else {
      updates.agent_output = body.agent_output
    }
  }

  return { updates, errors }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { updates, errors } = validatePatch(body)

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    // Set updated_at timestamp
    updates.updated_at = new Date().toISOString()

    // Auto-set completed_at when status changes to done
    if (updates.status === 'done' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString()
    } else if (updates.status && updates.status !== 'done') {
      updates.completed_at = null
    }
    const db = supabase as any
    const { data: task, error } = await db
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating task:', error)
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      )
    }

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const db = supabase as any
    const { data: task, error } = await db
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Error deleting task:', error)
      return NextResponse.json(
        { error: 'Failed to delete task' },
        { status: 500 }
      )
    }

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
