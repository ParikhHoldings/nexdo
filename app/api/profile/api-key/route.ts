import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeApiKeyScopes } from '@/lib/agent-scopes'

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
    const body = await request.json().catch(() => ({}))
    const scopes = normalizeApiKeyScopes(body?.scopes)
    // Generate new API key with "nxd_" prefix
    const newKey = 'nxd_' + crypto.randomUUID().replace(/-/g, '')
    const db = supabase as any
    const { error } = await db
      .from('profiles')
      .update({
        api_key: newKey,
        api_key_scopes: scopes,
        api_key_last_used_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error generating API key:', error)
      return NextResponse.json(
        { error: 'Failed to generate API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({ api_key: newKey, api_key_scopes: scopes })
  } catch (error) {
    console.error('Error generating API key:', error)
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    )
  }
}
