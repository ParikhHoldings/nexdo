import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJSONExport, saveImportedTasks } from '@/lib/importers'

type JsonSource = 'things3' | 'omnifocus' | 'trello' | 'asana' | 'generic'

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let content: string
    let source: JsonSource = 'generic'

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const formSource = formData.get('source') as string | null

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }

      content = await file.text()
      if (formSource && ['things3', 'omnifocus', 'trello', 'asana', 'generic'].includes(formSource)) {
        source = formSource as JsonSource
      }
    } else {
      // Handle JSON body
      const body = await request.json()
      content = body.content
      source = body.source || 'generic'

      if (!content) {
        return NextResponse.json(
          { error: 'JSON content is required' },
          { status: 400 }
        )
      }
    }

    // Validate JSON
    try {
      JSON.parse(content)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON content' },
        { status: 400 }
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

    // Parse JSON export
    const tasks = parseJSONExport(content, source, userId)

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No valid tasks found in JSON export.' },
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
    console.error('Error importing JSON:', error)
    return NextResponse.json(
      { error: 'Failed to import JSON file' },
      { status: 500 }
    )
  }
}
