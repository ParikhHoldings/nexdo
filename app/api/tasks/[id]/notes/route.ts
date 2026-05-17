import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateTaskNoteContent } from '@/lib/task-notes'

async function requireOwnedTask(id: string) {
  const supabase = await createClient()
  if (!supabase) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      ),
    }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const db = supabase as any
  const { data: task, error: taskError } = await db
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (taskError) {
    console.error('Error loading task for notes:', taskError)
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Failed to load task' }, { status: 500 }),
    }
  }

  if (!task) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Task not found' }, { status: 404 }),
    }
  }

  return { ok: true as const, supabase, userId: user.id }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const owned = await requireOwnedTask(id)
  if (!owned.ok) return owned.response

  const { data: notes, error } = await (owned.supabase as any)
    .from('task_notes')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading task notes:', error)
    return NextResponse.json({ error: 'Failed to load task notes' }, { status: 500 })
  }

  return NextResponse.json({ notes: notes ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const owned = await requireOwnedTask(id)
  if (!owned.ok) return owned.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateTaskNoteContent(
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).content
      : undefined
  )
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const service = await createServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const { data: note, error } = await (service as any)
    .from('task_notes')
    .insert({
      task_id: id,
      content: validation.content,
      note_type: 'note',
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error saving task note:', error)
    return NextResponse.json({ error: 'Failed to save task note' }, { status: 500 })
  }

  if (!note) {
    return NextResponse.json({ error: 'Failed to save task note' }, { status: 500 })
  }

  return NextResponse.json(note)
}
