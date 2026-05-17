'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { isUsableEnv } from '@/lib/env'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Return null if Supabase is not configured
  if (!isUsableEnv(supabaseUrl) || !isUsableEnv(supabaseAnonKey)) {
    return null
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
