import { NextRequest, NextResponse } from 'next/server'
import { generateBriefing } from '@/lib/openai'
import type { Task } from '@/lib/database.types'
import { requireUser } from '@/lib/api-auth'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  let body: { tasks?: unknown; userName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tasks, userName } = body

  if (!tasks || !Array.isArray(tasks)) {
    return NextResponse.json({ error: 'Invalid tasks array' }, { status: 400 })
  }

  if (tasks.length > 200) {
    return NextResponse.json(
      { error: 'Too many tasks (max 200 per briefing)' },
      { status: 400 }
    )
  }

  const gate = await consumeRateLimit(auth.userId, RATE_LIMITS.aiBriefing)
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Briefing already generated recently. Try again later.',
        reset_at: gate.resetAt?.toISOString() ?? null,
      },
      { status: 429, headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiBriefing.limit) }
    )
  }

  try {
    const briefing = await generateBriefing(
      tasks as Task[],
      typeof userName === 'string' && userName.trim() ? userName : 'there'
    )

    if (!briefing) {
      return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 })
    }

    return NextResponse.json(briefing, {
      headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiBriefing.limit),
    })
  } catch (error) {
    console.error('Error generating briefing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
