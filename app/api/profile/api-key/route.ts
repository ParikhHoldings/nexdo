import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  API_ACCESS_REQUIRED_MESSAGE,
  canUseApiAccess,
  normalizeApiKeyScopes,
} from '@/lib/agent-scopes'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'
import { apiKeyHint, generateApiKey, hashApiKey } from '@/lib/api-keys'

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

  const { data: profile, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Error loading profile for API key generation:', profileError)
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 }
    )
  }

  if (!profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    )
  }

  if (!canUseApiAccess(profile.subscription_tier)) {
    return NextResponse.json(
      {
        error: API_ACCESS_REQUIRED_MESSAGE,
        upgrade_url: '/settings?tab=billing',
      },
      { status: 402 }
    )
  }

  const gate = await consumeRateLimit(user.id, RATE_LIMITS.apiKeyRotate)
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many API key rotations. Please try again later.',
        reset_at: gate.resetAt?.toISOString() ?? null,
      },
      {
        status: 429,
        headers: rateLimitResponseHeaders(gate, RATE_LIMITS.apiKeyRotate.limit),
      }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const scopes = normalizeApiKeyScopes(body?.scopes)
    const newKey = generateApiKey()
    const newKeyHint = apiKeyHint(newKey)
    const service = await createServiceClient()

    if (!service) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const db = service as any
    const { error } = await db
      .from('profiles')
      .update({
        api_key: null,
        api_key_hash: hashApiKey(newKey),
        api_key_hint: newKeyHint,
        api_key_scopes: scopes,
        api_key_last_used_at: null,
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error generating API key:', error)
      return NextResponse.json(
        { error: 'Failed to generate API key' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { api_key: newKey, api_key_hint: newKeyHint, api_key_scopes: scopes },
      { headers: rateLimitResponseHeaders(gate, RATE_LIMITS.apiKeyRotate.limit) }
    )
  } catch (error) {
    console.error('Error generating API key:', error)
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    )
  }
}
