import { NextRequest, NextResponse } from 'next/server'
import { generateBriefing } from '@/lib/openai'
import { requireUser } from '@/lib/api-auth'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'
import { sanitizeAiTasks, sanitizeUserName } from '@/lib/ai-task-input'

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

  const sanitized = sanitizeAiTasks(tasks, 200)
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 })
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
      sanitized.tasks,
      sanitizeUserName(userName)
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
