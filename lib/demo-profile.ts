import type { Profile } from './database.types'

const DEMO_PROFILE_STORAGE_KEY = 'nexdo_demo_profile'

export function createDemoProfile(timezone: string): Profile {
  const now = new Date().toISOString()

  return {
    id: 'demo-user',
    full_name: 'Demo User',
    timezone,
    work_type: null,
    subscription_tier: 'free',
    stripe_customer_id: null,
    api_key: null,
    api_key_hash: null,
    api_key_hint: null,
    api_key_scopes: ['tasks:read', 'tasks:write', 'briefing:read'],
    api_key_last_used_at: null,
    task_count_this_month: 0,
    agent_executions_this_month: 0,
    created_at: now,
    updated_at: now,
  }
}

export function getDemoProfile(timezone: string): Profile {
  const fallbackProfile = createDemoProfile(timezone)

  if (!canUseLocalStorage()) return fallbackProfile

  try {
    const raw = window.localStorage.getItem(DEMO_PROFILE_STORAGE_KEY)
    if (!raw) return fallbackProfile

    const parsed = JSON.parse(raw)
    if (!isStoredDemoProfile(parsed)) return fallbackProfile

    return {
      ...fallbackProfile,
      ...parsed,
      id: 'demo-user',
      subscription_tier: 'free',
      stripe_customer_id: null,
      api_key: null,
      api_key_hash: null,
      api_key_hint: null,
      api_key_last_used_at: null,
      task_count_this_month: 0,
      agent_executions_this_month: 0,
    }
  } catch {
    return fallbackProfile
  }
}

export function persistDemoProfile(profile: Profile): void {
  if (!canUseLocalStorage()) return

  try {
    window.localStorage.setItem(
      DEMO_PROFILE_STORAGE_KEY,
      JSON.stringify({
        id: 'demo-user',
        full_name: profile.full_name,
        timezone: profile.timezone,
        work_type: profile.work_type,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      })
    )
  } catch {
    // Demo profile persistence is best-effort; in-memory settings still work.
  }
}

function canUseLocalStorage(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return Boolean(window.localStorage)
  } catch {
    return false
  }
}

function isStoredDemoProfile(value: unknown): value is Partial<Profile> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const profile = value as Partial<Profile>
  return (
    (profile.full_name === null || typeof profile.full_name === 'string') &&
    typeof profile.timezone === 'string'
  )
}
