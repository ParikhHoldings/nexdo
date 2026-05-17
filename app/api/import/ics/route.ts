import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseICSContent, saveImportedTasks } from '@/lib/importers'
import { checkImportQuota, recordImportQuota } from '@/lib/import-quota'

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
    const service = await createServiceClient()
    if (!service) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }
    const dbClient = service as any

    const contentType = request.headers.get('content-type') || ''
    let content: string

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }

      content = await file.text()
    } else {
      // Handle JSON body
      const body = await request.json()
      content = body.content

      if (!content) {
        return NextResponse.json(
          { error: 'ICS content is required' },
          { status: 400 }
        )
      }
    }

    // Validate ICS content
    if (!content.includes('BEGIN:VCALENDAR') && !content.includes('BEGIN:VTODO')) {
      return NextResponse.json(
        { error: 'Invalid ICS file. Must contain VCALENDAR or VTODO components.' },
        { status: 400 }
      )
    }

    // Parse ICS content
    const tasks = parseICSContent(content, userId)

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks (VTODO components) found in ICS file.' },
        { status: 400 }
      )
    }

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
    console.error('Error importing ICS:', error)
    return NextResponse.json(
      { error: 'Failed to import ICS file' },
      { status: 500 }
    )
  }
}
