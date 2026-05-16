import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseCSVContent,
  autoMapCSVColumns,
  aiMapCSVColumns,
  normalizeTask,
  saveImportedTasks,
} from '@/lib/importers'
import { enforceImportQuota } from '@/lib/import-quota'
import type { TaskInsert } from '@/lib/database.types'

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let content: string
    let providedMapping: Record<string, string> | undefined

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
      providedMapping = body.mapping

      if (!content) {
        return NextResponse.json(
          { error: 'CSV content is required' },
          { status: 400 }
        )
      }
    }

    // Get authenticated user (required for imports so data can't leak across accounts).
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

    // Parse CSV headers
    const lines = content.split(/\r?\n/).filter(line => line.trim())
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV must have at least a header row and one data row' },
        { status: 400 }
      )
    }

    // Parse header and sample rows for mapping
    const headerLine = lines[0]
    const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))

    // Determine column mapping
    let mapping: Record<string, string>

    if (providedMapping) {
      mapping = providedMapping
    } else {
      // Try AI mapping first if OpenAI is available
      const openaiApiKey = process.env.OPENAI_API_KEY
      const sampleRows = lines.slice(1, 4).map(line =>
        line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
      )

      const aiMapping = await aiMapCSVColumns(headers, sampleRows, openaiApiKey)
      mapping = aiMapping || autoMapCSVColumns(headers)
    }

    // Parse CSV rows with mapping
    const rows = parseCSVContent(content, mapping)

    // Convert to Nexdo tasks
    const tasks: TaskInsert[] = []
    for (const row of rows) {
      // Skip rows without a title
      const title = row.title || row.name || row.task || row.subject
      if (!title) continue

      const task = normalizeTask(row, 'csv', userId, 'manual')
      tasks.push(task)
    }

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No valid tasks found in CSV. Make sure your CSV has a title/name column.' },
        { status: 400 }
      )
    }

    const quotaResponse = await enforceImportQuota(userId, tasks.length)
    if (quotaResponse) return quotaResponse

    // Save tasks
    const result = await saveImportedTasks(tasks, dbClient)

    return NextResponse.json({
      imported: result.imported,
      failed: result.failed,
      tasks: result.tasks,
      mapping,
    })
  } catch (error) {
    console.error('Error importing CSV:', error)
    return NextResponse.json(
      { error: 'Failed to import CSV' },
      { status: 500 }
    )
  }
}
