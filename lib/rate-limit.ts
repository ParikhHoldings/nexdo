import { createServiceClient } from '@/lib/supabase/server'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date | null
}

export interface RateLimitConfig {
  bucket: string
  limit: number
  windowSeconds: number
}

/**
 * Per-user rate limit gate. Stored in Supabase so it survives across
 * serverless cold starts and scales with Postgres' existing connection pool.
 *
 * Fails OPEN (allows the request) if the service role isn't configured
 * yet, so local dev and preview deploys don't silently 429. In production
 * SUPABASE_SERVICE_ROLE_KEY must be set for limits to take effect.
 */
export async function consumeRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = await createServiceClient()
  if (!supabase) {
    return { allowed: true, remaining: config.limit, resetAt: null }
  }
  const { data, error } = await (supabase as any).rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: config.bucket,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds,
  })

  if (error || !data || !data[0]) {
    console.error('consume_rate_limit RPC failed:', error)
    return { allowed: true, remaining: config.limit, resetAt: null }
  }

  return {
    allowed: !!data[0].allowed,
    remaining: data[0].remaining ?? 0,
    resetAt: data[0].reset_at ? new Date(data[0].reset_at) : null,
  }
}

/** Standard rate-limit presets for AI endpoints. */
export const RATE_LIMITS = {
  aiParse: { bucket: 'ai_parse', limit: 120, windowSeconds: 60 * 60 }, // 120/hour
  aiBriefing: { bucket: 'ai_briefing', limit: 30, windowSeconds: 60 * 60 },
  aiPrioritize: { bucket: 'ai_prioritize', limit: 60, windowSeconds: 60 * 60 },
  aiAgent: { bucket: 'ai_agent', limit: 30, windowSeconds: 60 * 60 },
  apiKeyRotate: { bucket: 'api_key_rotate', limit: 5, windowSeconds: 60 * 60 },
} as const

export function rateLimitResponseHeaders(result: RateLimitResult, limit: number) {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
  }
  if (result.resetAt) {
    headers['X-RateLimit-Reset'] = String(Math.floor(result.resetAt.getTime() / 1000))
  }
  return headers
}
