import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
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
    const body = await request.json()
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
    } = body

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: task, error } = await db
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
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
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
