import { NextRequest, NextResponse } from 'next/server'
import { prioritizeTasks } from '@/lib/openai'
import type { Task } from '@/lib/database.types'
import { requireUser } from '@/lib/api-auth'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

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
    const { tasks } = await request.json()

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'Invalid tasks array' }, { status: 400 })
    }

    // Upper bound on batch size to protect the OpenAI budget.
    if (tasks.length > 100) {
      return NextResponse.json(
        { error: 'Too many tasks (max 100 per request)' },
        { status: 400 }
      )
    }

    const prioritized = await prioritizeTasks(tasks as Task[])

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
