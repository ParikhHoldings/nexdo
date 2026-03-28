import { NextRequest, NextResponse } from 'next/server'
import { generateBriefing } from '@/lib/openai'
import type { Task } from '@/lib/database.types'

export async function POST(request: NextRequest) {
  try {
    const { tasks, userName } = await request.json()

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'Invalid tasks array' },
        { status: 400 }
      )
    }

    const briefing = await generateBriefing(tasks as Task[], userName || 'there')

    if (!briefing) {
      return NextResponse.json(
        { error: 'Failed to generate briefing' },
        { status: 500 }
      )
    }

    return NextResponse.json(briefing)
  } catch (error) {
    console.error('Error generating briefing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
