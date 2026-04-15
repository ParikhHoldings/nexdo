import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseGoogleTask, saveImportedTasks } from '@/lib/importers'
import type { TaskInsert } from '@/lib/database.types'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbClient = supabase as any

    const body = await request.json()
    const { access_token } = body

    if (!access_token) {
      return NextResponse.json(
        { error: 'Google access token is required' },
        { status: 400 }
      )
    }

    // Fetch task lists from Google Tasks API
    const listsResponse = await fetch('https://www.googleapis.com/tasks/v1/lists', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (!listsResponse.ok) {
      const errorText = await listsResponse.text()
      console.error('Google Tasks API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch task lists from Google. Please check your access token.' },
        { status: 400 }
      )
    }

    const listsData = await listsResponse.json()
    const lists = listsData.items || []

    // Fetch tasks from each list
    const allTasks: TaskInsert[] = []

    for (const list of lists as Array<{ id: string }>) {
      const tasksResponse = await fetch(
        `https://www.googleapis.com/tasks/v1/lists/${list.id}/tasks`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      )

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        const tasks = tasksData.items || []

        for (const task of tasks as Array<Record<string, unknown>>) {
          // Skip tasks without titles (deleted or empty)
          if (task.title) {
            allTasks.push(parseGoogleTask(task, userId))
          }
        }
      }
    }

    // Save tasks
    const result = await saveImportedTasks(allTasks, dbClient)

    return NextResponse.json({
      imported: result.imported,
      failed: result.failed,
      tasks: result.tasks,
    })
  } catch (error) {
    console.error('Error importing from Google Tasks:', error)
    return NextResponse.json(
      { error: 'Failed to import tasks' },
      { status: 500 }
    )
  }
}
