import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AuthResult {
  ok: true
  userId: string
  email: string | null
}

export interface AuthFail {
  ok: false
  response: NextResponse
}

/**
 * Shared auth helper for API routes. Returns either an authenticated
 * user or a ready-to-return 401/503 response. Keeps individual routes
 * short and consistent, and makes it harder to forget the auth gate.
 */
export async function requireUser(): Promise<AuthResult | AuthFail> {
  const supabase = await createClient()
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      ),
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true, userId: user.id, email: user.email ?? null }
}
