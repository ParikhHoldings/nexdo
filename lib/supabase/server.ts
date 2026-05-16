import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

function isUsableEnv(value: string | undefined): value is string {
  return Boolean(
    value &&
      !value.toLowerCase().includes('placeholder') &&
      !value.toLowerCase().includes('your-')
  )
}

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Return null if Supabase is not configured
  if (!isUsableEnv(supabaseUrl) || !isUsableEnv(supabaseAnonKey)) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as any)
          })
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  })
}

export async function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Return null if not configured
  if (!isUsableEnv(supabaseUrl) || !isUsableEnv(serviceRoleKey)) {
    return null
  }

  const { createClient } = await import('@supabase/supabase-js')
  return createClient<Database>(supabaseUrl, serviceRoleKey)
}
