import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_LIMITS } from '@/lib/stripe'
import type { SubscriptionTier } from '@/lib/database.types'

export type QuotaKind = 'task_create' | 'agent_execute'

export interface QuotaResult {
  allowed: boolean
  limit: number
  used: number
  tier: SubscriptionTier
  reason?: string
}

/**
 * Look up the current usage for the user, performing a lazy monthly reset
 * on the profile if we've crossed a billing-period boundary.
 */
export async function getUsage(userId: string): Promise<{
  tier: SubscriptionTier
  task_count_this_month: number
  agent_executions_this_month: number
} | null> {
  const supabase = await createServiceClient()
  if (!supabase) return null

  // Use rpc to reset-then-read atomically; increment_usage with quantity=0
  // performs the month-boundary reset without consuming budget.
  const { data, error } = await (supabase as any).rpc('increment_usage', {
    p_user_id: userId,
    p_event_type: 'task_create', // type is required but quantity=0 is a no-op counter-wise
    p_quantity: 0,
  })

  if (error || !data || !data[0]) {
    // Fall back to a direct read if RPC isn't available (dev/migration race).
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('subscription_tier, task_count_this_month, agent_executions_this_month')
      .eq('id', userId)
      .single()
    if (!profile) return null
    return {
      tier: profile.subscription_tier,
      task_count_this_month: profile.task_count_this_month ?? 0,
      agent_executions_this_month: profile.agent_executions_this_month ?? 0,
    }
  }
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single()

  return {
    tier: profile?.subscription_tier ?? 'free',
    task_count_this_month: data[0].task_count_this_month ?? 0,
    agent_executions_this_month: data[0].agent_executions_this_month ?? 0,
  }
}

/**
 * Check whether a user can perform an action, without consuming budget.
 * Used for client-side pre-checks and for cheaper "would this succeed" probes.
 */
export async function checkQuota(
  userId: string,
  kind: QuotaKind
): Promise<QuotaResult> {
  const usage = await getUsage(userId)
  if (!usage) {
    return { allowed: false, limit: 0, used: 0, tier: 'free', reason: 'No profile' }
  }

  const plan = PLAN_LIMITS[usage.tier]
  const limit =
    kind === 'task_create' ? plan.tasks_per_month : (plan as { agent_executions_per_month: number }).agent_executions_per_month
  const used =
    kind === 'task_create' ? usage.task_count_this_month : usage.agent_executions_this_month

  // -1 means unlimited (Pro/Power/Team).
  if (limit === -1) return { allowed: true, limit: -1, used, tier: usage.tier }

  if (used >= limit) {
    return {
      allowed: false,
      limit,
      used,
      tier: usage.tier,
      reason:
        kind === 'task_create'
          ? `You've reached your ${limit}-task monthly limit on the ${usage.tier} plan.`
          : `You've used all ${limit} agent executions this month on the ${usage.tier} plan.`,
    }
  }

  return { allowed: true, limit, used, tier: usage.tier }
}

/**
 * Consume one unit of quota for the given action. Returns whether the
 * request should be allowed (after incrementing). The underlying RPC is
 * atomic and also logs a usage_event row for auditing.
 */
export async function consumeQuota(
  userId: string,
  kind: QuotaKind
): Promise<QuotaResult> {
  const pre = await checkQuota(userId, kind)
  if (!pre.allowed) return pre

  const supabase = await createServiceClient()
  if (!supabase) {
    return { ...pre, allowed: false, reason: 'Service unavailable' }
  }
  const { error } = await (supabase as any).rpc('increment_usage', {
    p_user_id: userId,
    p_event_type: kind,
    p_quantity: 1,
  })

  if (error) {
    console.error('consumeQuota RPC failed:', error)
    return { ...pre, allowed: false, reason: 'Failed to record usage' }
  }

  return { ...pre, used: pre.used + 1 }
}

/** Shape quota responses sent to clients. */
export function quotaExceededResponse(result: QuotaResult) {
  return {
    error: 'Quota exceeded',
    message: result.reason ?? 'You have reached your plan limit for this month.',
    limit: result.limit,
    used: result.used,
    tier: result.tier,
    upgrade_url: '/settings?tab=billing',
  }
}
