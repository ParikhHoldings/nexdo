import { NextRequest, NextResponse } from 'next/server'
import { prioritizeTasks } from '@/lib/openai'
import { requireUser } from '@/lib/api-auth'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'
import { sanitizeAiTasks } from '@/lib/ai-task-input'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  let body: { tasks?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tasks } = body

  const sanitized = sanitizeAiTasks(tasks, 100)
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 })
  }

  const gate = await consumeRateLimit(auth.userId, RATE_LIMITS.aiPrioritize)
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many prioritize requests.',
        reset_at: gate.resetAt?.toISOString() ?? null,
      },
      { status: 429, headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiPrioritize.limit) }
    )
  }

  try {
    const prioritized = await prioritizeTasks(sanitized.tasks)

    if (!prioritized) {
      return NextResponse.json({ error: 'Failed to prioritize tasks' }, { status: 500 })
    }

    return NextResponse.json(
      { tasks: prioritized },
      { headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiPrioritize.limit) }
    )
  } catch (error) {
    console.error('Error prioritizing tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
