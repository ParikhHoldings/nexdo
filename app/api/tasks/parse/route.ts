import { NextRequest, NextResponse } from 'next/server'
import { parseTaskInput } from '@/lib/openai'
import { requireUser } from '@/lib/api-auth'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const gate = await consumeRateLimit(auth.userId, RATE_LIMITS.aiParse)
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many parse requests. Please slow down.',
        reset_at: gate.resetAt?.toISOString() ?? null,
      },
      { status: 429, headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiParse.limit) }
    )
  }

  try {
    const { input } = await request.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Bound the prompt size to control OpenAI spend.
    if (input.length > 2000) {
      return NextResponse.json(
        { error: 'Input too long (max 2000 characters)' },
        { status: 400 }
      )
    }

    const parsedTask = await parseTaskInput(input)

    if (!parsedTask) {
      return NextResponse.json({ error: 'Failed to parse task' }, { status: 500 })
    }

    return NextResponse.json(parsedTask, {
      headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiParse.limit),
    })
  } catch (error) {
    console.error('Error parsing task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
