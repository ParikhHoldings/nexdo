import type { Profile } from '@/lib/database.types'

export const CLIENT_PROFILE_SELECT = [
  'id',
  'full_name',
  'timezone',
  'work_type',
  'subscription_tier',
  'api_key_hint',
  'api_key_scopes',
  'api_key_last_used_at',
  'task_count_this_month',
  'agent_executions_this_month',
  'created_at',
  'updated_at',
].join(', ')

type ClientProfileRow = Omit<
  Profile,
  'stripe_customer_id' | 'api_key' | 'api_key_hash'
>

export function toClientProfile(profile: ClientProfileRow): Profile {
  return {
    ...profile,
    stripe_customer_id: null,
    api_key: null,
    api_key_hash: null,
  }
}

type ProfileFallbackUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

function profileNameFromUser(user: ProfileFallbackUser): string | null {
  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : null

  const name = metadataName?.trim()
  if (name) return name

  const emailPrefix = user.email?.split('@')[0]?.trim()
  return emailPrefix || null
}

export function createClientProfileFallback(
  user: ProfileFallbackUser,
  timezone: string
): Profile {
  const now = new Date().toISOString()

  return {
    id: user.id,
    full_name: profileNameFromUser(user),
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
