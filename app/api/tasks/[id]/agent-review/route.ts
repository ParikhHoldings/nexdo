import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  AGENT_REVIEW_STATUSES,
  normalizeAgentOutput,
  updateAgentReview,
  type AgentReviewStatus,
} from '@/lib/agent-output'
import type { ActionType, Task } from '@/lib/database.types'

const MAX_REVIEW_NOTE = 1000

function validateReviewBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid JSON body.' }
  }

  const payload = body as Record<string, unknown>
  if (!AGENT_REVIEW_STATUSES.includes(payload.status as AgentReviewStatus)) {
    return {
      error: `status must be one of ${AGENT_REVIEW_STATUSES.join(', ')}`,
    }
  }

  if (payload.note !== undefined && payload.note !== null) {
    if (typeof payload.note !== 'string') {
      return { error: 'note must be a string or null' }
    }
    if (payload.note.length > MAX_REVIEW_NOTE) {
      return { error: `note must be ${MAX_REVIEW_NOTE} chars or fewer` }
    }
  }

  return {
    status: payload.status as AgentReviewStatus,
    note: typeof payload.note === 'string' ? payload.note.trim() || null : null,
  }
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateReviewBody(body)
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { id } = await params
  const db = supabase as any
  const { data: task, error: taskError } = await db
    .from('tasks')
    .select('id, user_id, action_type, agent_output')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (taskError) {
    console.error('Error loading task for agent review:', taskError)
    return NextResponse.json({ error: 'Failed to load task' }, { status: 500 })
  }

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const typedTask = task as Pick<Task, 'id' | 'action_type' | 'agent_output'>
  const envelope = normalizeAgentOutput(
    typedTask.agent_output,
    typedTask.action_type as ActionType
  )
  if (!envelope) {
    return NextResponse.json(
      { error: 'Task does not have reviewable agent output' },
      { status: 400 }
    )
  }

  const reviewedOutput = updateAgentReview(
    envelope,
    validation.status,
    validation.note
  )

  const service = await createServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const { data: updatedTask, error: updateError } = await (service as any)
    .from('tasks')
    .update({
      agent_output: reviewedOutput,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('agent_output')
    .maybeSingle()

  if (updateError) {
    console.error('Error saving agent review:', updateError)
    return NextResponse.json(
      { error: 'Failed to save agent review' },
      { status: 500 }
    )
  }

  if (!updatedTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  return NextResponse.json(updatedTask.agent_output)
}
