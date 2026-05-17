import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeAuthRedirect } from '@/lib/auth-redirect'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeAuthRedirect(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()

    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return to login on error or if Supabase not configured
  return NextResponse.redirect(`${origin}/auth/login?error=callback_error`)
}
