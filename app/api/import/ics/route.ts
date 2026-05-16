import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseICSContent, saveImportedTasks } from '@/lib/importers'

export async function POST(request: Request) {
  try {
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

    // Parse ICS content
    const tasks = parseICSContent(content, userId)

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks (VTODO components) found in ICS file.' },
        { status: 400 }
      )
    }

    // Save tasks
    const result = await saveImportedTasks(tasks, dbClient)

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
