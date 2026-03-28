import { NextRequest, NextResponse } from 'next/server'
import { parseTaskInput } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    const parsedTask = await parseTaskInput(input)

    if (!parsedTask) {
      return NextResponse.json(
        { error: 'Failed to parse task' },
        { status: 500 }
      )
    }

    return NextResponse.json(parsedTask)
  } catch (error) {
    console.error('Error parsing task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
