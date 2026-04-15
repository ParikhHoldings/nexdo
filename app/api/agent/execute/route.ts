import { NextRequest, NextResponse } from 'next/server'
import { executeResearch, executeDraft, executePrep } from '@/lib/openai'
import type { Task } from '@/lib/database.types'
import { requireUser } from '@/lib/api-auth'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'
import { checkQuota, consumeQuota, quotaExceededResponse } from '@/lib/quota'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  // Gate 1: rate limit (bursts of calls from a single user).
  const gate = await consumeRateLimit(auth.userId, RATE_LIMITS.aiAgent)
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many agent runs. Please slow down.',
        reset_at: gate.resetAt?.toISOString() ?? null,
      },
      { status: 429, headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiAgent.limit) }
    )
  }

  // Gate 2: monthly plan quota. Pre-check first; consume only on success.
  const preQuota = await checkQuota(auth.userId, 'agent_execute')
  if (!preQuota.allowed) {
    return NextResponse.json(quotaExceededResponse(preQuota), { status: 402 })
  }

  try {
    const { task } = await request.json()

    if (!task || !task.action_type) {
      return NextResponse.json({ error: 'Invalid task' }, { status: 400 })
    }

    const typedTask = task as Task

    if (typedTask.action_type === 'manual' || typedTask.action_type === 'remind') {
      return NextResponse.json(
        { error: 'Task type does not support execution' },
        { status: 400 }
      )
    }

    let result = null
    switch (typedTask.action_type) {
      case 'research':
        result = await executeResearch(typedTask)
        break
      case 'draft':
        result = await executeDraft(typedTask)
        break
      case 'prep':
        result = await executePrep(typedTask)
        break
      default:
        return NextResponse.json({ error: 'Unknown action type' }, { status: 400 })
    }

    if (!result) {
      return NextResponse.json({ error: 'Failed to execute task' }, { status: 500 })
    }

    // Only consume quota after a successful run so users aren't charged for failures.
    await consumeQuota(auth.userId, 'agent_execute')

    return NextResponse.json(result, {
      headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiAgent.limit),
    })
  } catch (error) {
    console.error('Error executing task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
