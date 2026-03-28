import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseTodoistTask, saveImportedTasks } from '@/lib/importers'
import type { TaskInsert } from '@/lib/database.types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Todoist API token is required' },
        { status: 400 }
      )
    }

    // Fetch tasks from Todoist API
    const todoistResponse = await fetch('https://api.todoist.com/rest/v2/tasks', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!todoistResponse.ok) {
      const errorText = await todoistResponse.text()
      console.error('Todoist API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch tasks from Todoist. Please check your API token.' },
        { status: 400 }
      )
    }

    const todoistTasks = await todoistResponse.json()

    if (!Array.isArray(todoistTasks)) {
      return NextResponse.json(
        { error: 'Invalid response from Todoist API' },
        { status: 500 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    let userId = 'demo-user'
    let dbClient = null

    if (supabase) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!authError && user) {
        userId = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dbClient = supabase as any
      }
    }

    // Parse Todoist tasks to Nexdo format
    const tasks: TaskInsert[] = todoistTasks.map((task: Record<string, unknown>) =>
      parseTodoistTask(task, userId)
    )

    // Save tasks
    const result = await saveImportedTasks(tasks, dbClient)

    return NextResponse.json({
      imported: result.imported,
      failed: result.failed,
      tasks: result.tasks,
    })
  } catch (error) {
    console.error('Error importing from Todoist:', error)
    return NextResponse.json(
      { error: 'Failed to import tasks' },
      { status: 500 }
    )
  }
}
