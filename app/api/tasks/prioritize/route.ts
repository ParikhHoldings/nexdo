import { NextRequest, NextResponse } from 'next/server'
import { prioritizeTasks } from '@/lib/openai'
import type { Task } from '@/lib/database.types'

export async function POST(request: NextRequest) {
  try {
    const { tasks } = await request.json()

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'Invalid tasks array' },
        { status: 400 }
      )
    }

    const prioritized = await prioritizeTasks(tasks as Task[])

    if (!prioritized) {
      return NextResponse.json(
        { error: 'Failed to prioritize tasks' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tasks: prioritized })
  } catch (error) {
    console.error('Error prioritizing tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
