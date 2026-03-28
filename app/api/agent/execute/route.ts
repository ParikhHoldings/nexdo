import { NextRequest, NextResponse } from 'next/server'
import { executeResearch, executeDraft, executePrep } from '@/lib/openai'
import type { Task } from '@/lib/database.types'

export async function POST(request: NextRequest) {
  try {
    const { task } = await request.json()

    if (!task || !task.action_type) {
      return NextResponse.json(
        { error: 'Invalid task' },
        { status: 400 }
      )
    }

    const typedTask = task as Task

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
      case 'manual':
      case 'remind':
        return NextResponse.json(
          { error: 'Task type does not support execution' },
          { status: 400 }
        )
      default:
        return NextResponse.json(
          { error: 'Unknown action type' },
          { status: 400 }
        )
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to execute task' },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error executing task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
