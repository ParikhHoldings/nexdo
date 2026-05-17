import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkQuota,
  consumeQuota,
  quotaExceededResponse,
  quotaFailureStatus,
} from '@/lib/quota'
import { validateTaskInput } from '@/lib/task-validation'

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

  // Pre-check quota so failed inserts do not spend monthly task budget.
  const preQuota = await checkQuota(user.id, 'task_create')
  if (!preQuota.allowed) {
    return NextResponse.json(quotaExceededResponse(preQuota), {
      status: quotaFailureStatus(preQuota),
    })
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

    if (!task) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    // Account only after the task exists. If accounting fails closed, remove
    // the created row so users do not get unmetered task creation.
    const consumed = await consumeQuota(user.id, 'task_create')
    if (!consumed.allowed) {
      const { error: cleanupError } = await db
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('user_id', user.id)

      if (cleanupError) {
        console.error('Error rolling back task after quota failure:', cleanupError)
      }

      return NextResponse.json(quotaExceededResponse(consumed), {
        status: quotaFailureStatus(consumed),
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
