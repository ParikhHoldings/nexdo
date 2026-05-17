import { NextRequest, NextResponse } from 'next/server'
import { executeResearch, executeDraft, executePrep } from '@/lib/openai'
import type { Task } from '@/lib/database.types'
import { requireUser } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit, RATE_LIMITS, rateLimitResponseHeaders } from '@/lib/rate-limit'
import {
  checkQuota,
  consumeQuota,
  quotaExceededResponse,
  quotaFailureStatus,
} from '@/lib/quota'
import { appendAgentExecution } from '@/lib/agent-output'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  let body: { taskId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.taskId !== 'string' || body.taskId.trim().length === 0) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  const { data: task, error: taskError } = await (supabase as any)
    .from('tasks')
    .select('*')
    .eq('id', body.taskId.trim())
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (taskError) {
    console.error('Error loading task for agent execution:', taskError)
    return NextResponse.json({ error: 'Failed to load task' }, { status: 500 })
  }

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const typedTask = task as Task

  if (typedTask.action_type === 'manual' || typedTask.action_type === 'remind') {
    return NextResponse.json(
      { error: 'Task type does not support execution' },
      { status: 400 }
    )
  }

  if (!['research', 'draft', 'prep'].includes(typedTask.action_type)) {
    return NextResponse.json({ error: 'Unknown action type' }, { status: 400 })
  }

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

    // Only consume quota after a successful run, but before returning or
    // persisting output. If quota recording fails closed, the result is not
    // exposed or saved without accounting.
    const consumed = await consumeQuota(auth.userId, 'agent_execute')
    if (!consumed.allowed) {
      return NextResponse.json(
        quotaExceededResponse(consumed),
        { status: quotaFailureStatus(consumed) }
      )
    }

    const agentOutput = appendAgentExecution(
      typedTask.agent_output,
      result,
      typedTask.action_type
    )

    const { data: updatedTask, error: updateError } = await (supabase as any)
      .from('tasks')
      .update({
        agent_output: agentOutput,
        updated_at: new Date().toISOString(),
      })
      .eq('id', typedTask.id)
      .eq('user_id', auth.userId)
      .select('id')
      .maybeSingle()

    if (updateError) {
      console.error('Error saving agent output:', updateError)
      return NextResponse.json(
        { error: 'Failed to save agent output' },
        { status: 500 }
      )
    }

    if (!updatedTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json(agentOutput, {
      headers: rateLimitResponseHeaders(gate, RATE_LIMITS.aiAgent.limit),
    })
  } catch (error) {
    console.error('Error executing task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
