import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseTodoistTask, saveImportedTasks } from '@/lib/importers'
import { checkImportQuota, recordImportQuota } from '@/lib/import-quota'
import type { TaskInsert } from '@/lib/database.types'

export async function POST(request: Request) {
  try {
    // Authenticate before doing anything that costs money or leaks data.
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id
    const service = await createServiceClient()
    if (!service) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }
    const dbClient = service as any

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

    // Parse Todoist tasks to Nexdo format
    const tasks: TaskInsert[] = todoistTasks.map((task: Record<string, unknown>) =>
      parseTodoistTask(task, userId)
    )

    const quotaResponse = await checkImportQuota(userId, tasks.length)
    if (quotaResponse) return quotaResponse

    // Save tasks
    const result = await saveImportedTasks(tasks, dbClient)
    const quotaRecordResponse = await recordImportQuota(
      userId,
      result.imported,
      result.tasks,
      dbClient
    )
    if (quotaRecordResponse) return quotaRecordResponse

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
