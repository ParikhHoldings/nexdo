import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateTaskRelationshipPatch } from '@/lib/task-relationships'

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
    const { updates, referencedTaskIds, errors } =
      validateTaskRelationshipPatch(body, id)

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No relationship updates provided' },
        { status: 400 }
      )
    }

    const service = await createServiceClient()
    if (!service) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const db = service as any
    const idsToCheck = Array.from(new Set([id, ...referencedTaskIds]))
    const { data: ownedTasks, error: ownedTasksError } = await db
      .from('tasks')
      .select('id')
      .eq('user_id', user.id)
      .in('id', idsToCheck)

    if (ownedTasksError) {
      console.error('Error verifying task relationships:', ownedTasksError)
      return NextResponse.json(
        { error: 'Failed to verify linked tasks' },
        { status: 500 }
      )
    }

    const ownedTaskIds = new Set(
      (ownedTasks ?? []).map((task: { id: string }) => task.id)
    )

    if (!ownedTaskIds.has(id)) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    const missingLinkedTaskId = referencedTaskIds.find(
      (taskId) => !ownedTaskIds.has(taskId)
    )
    if (missingLinkedTaskId) {
      return NextResponse.json(
        {
          error: 'Linked task not found',
          message: 'Linked tasks must belong to the current user.',
        },
        { status: 400 }
      )
    }

    const updatePayload = {
      ...updates,
      updated_at: new Date().toISOString(),
    }
    const { data: task, error } = await db
      .from('tasks')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating task relationships:', error)
      return NextResponse.json(
        { error: 'Failed to update task relationships' },
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
    console.error('Error updating task relationships:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
