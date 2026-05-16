import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: events, error } = await supabase
    .from('agent_action_events')
    .select(
      'id, tool_name, source_agent_id, external_ref, ingestion_intent, success, error, duration_ms, created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error loading MCP events:', error)
    return NextResponse.json(
      { error: 'Failed to load agent events' },
      { status: 500 }
    )
  }

  return NextResponse.json({ events: events || [] })
}
