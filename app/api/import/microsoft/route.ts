import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseMicrosoftTask, saveImportedTasks } from '@/lib/importers'
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
    const dbClient = supabase as any

    const body = await request.json()
    const { access_token } = body

    if (!access_token) {
      return NextResponse.json(
        { error: 'Microsoft access token is required' },
        { status: 400 }
      )
    }

    // Fetch task lists from Microsoft Graph API
    const listsResponse = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (!listsResponse.ok) {
      const errorText = await listsResponse.text()
      console.error('Microsoft Graph API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch task lists from Microsoft. Please check your access token.' },
        { status: 400 }
      )
    }

    const listsData = await listsResponse.json()
    const lists = listsData.value || []

    // Fetch tasks from each list
    const allTasks: TaskInsert[] = []

    for (const list of lists as Array<{ id: string }>) {
      const tasksResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      )

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        const tasks = tasksData.value || []

        for (const task of tasks as Array<Record<string, unknown>>) {
          allTasks.push(parseMicrosoftTask(task, userId))
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
    console.error('Error importing from Microsoft To Do:', error)
    return NextResponse.json(
      { error: 'Failed to import tasks' },
      { status: 500 }
    )
  }
}
