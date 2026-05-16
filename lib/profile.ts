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
