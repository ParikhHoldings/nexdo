'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckSquare,
  Calendar,
  Layers,
  Apple,
  Inbox,
  LayoutGrid,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import { ImportSourceCard } from '@/components/import-source-card'
import { useTaskStore } from '@/lib/store'
import {
  autoMapCSVColumns,
  normalizeTask,
  parseCSVContent,
  parseICSContent,
  parseJSONExport,
} from '@/lib/importers'
import type { Task, TaskInsert } from '@/lib/database.types'

const DEMO_USER_ID = 'demo-user'
const MAX_DEMO_IMPORT_BYTES = 2 * 1024 * 1024
const MAX_DEMO_IMPORT_TASKS = 100

interface ImportState {
  isLoading: boolean
  isComplete: boolean
  importedCount?: number
  error?: string | null
}

type ImportSource =
  | 'todoist'
  | 'microsoft'
  | 'google'
  | 'apple'
  | 'things3'
  | 'omnifocus'
  | 'asana'
  | 'trello'
  | 'csv'

type JsonImportSource = 'things3' | 'omnifocus' | 'trello' | 'asana' | 'generic'
type NormalizeSource = Parameters<typeof normalizeTask>[1]

function normalizeSourceFor(source: ImportSource): NormalizeSource {
  if (source === 'csv') return 'csv'
  if (source === 'apple') return 'ics'
  if (source === 'things3') return 'things3'
  if (source === 'omnifocus') return 'omnifocus'
  if (source === 'asana') return 'asana'
  if (source === 'trello') return 'trello'
  return 'generic'
}

function jsonSourceFor(source: ImportSource): JsonImportSource {
  if (source === 'things3') return 'things3'
  if (source === 'omnifocus') return 'omnifocus'
  if (source === 'asana') return 'asana'
  if (source === 'trello') return 'trello'
  return 'generic'
}

function fileExtension(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() || ''
}

function demoTaskFromInsert(task: TaskInsert): Task {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    user_id: DEMO_USER_ID,
    title: task.title || 'Untitled Task',
    raw_input: task.raw_input ?? null,
    description: task.description ?? null,
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    due_date: task.due_date ?? null,
    due_time: task.due_time ?? null,
    context: task.context ?? null,
    source: task.source || 'manual',
    action_type: task.action_type || 'manual',
    estimated_minutes: task.estimated_minutes ?? null,
    energy_level: task.energy_level ?? null,
    people: task.people ?? null,
    tags: task.tags ?? null,
    parent_task_id: task.parent_task_id ?? null,
    related_task_ids: task.related_task_ids ?? null,
    agent_output: task.agent_output ?? null,
    completed_at: task.completed_at ?? null,
    created_at: task.created_at || now,
    updated_at: task.updated_at || now,
    source_agent_id: task.source_agent_id ?? null,
    external_ref: task.external_ref ?? null,
    ingestion_intent: task.ingestion_intent ?? null,
    agent_metadata: task.agent_metadata ?? null,
  }
}

async function parseDemoFileImport(source: ImportSource, file: File): Promise<TaskInsert[]> {
  if (file.size > MAX_DEMO_IMPORT_BYTES) {
    throw new Error('Demo imports support files up to 2 MB.')
  }

  const content = await file.text()
  const extension = fileExtension(file)
  let tasks: TaskInsert[] = []

  if (extension === 'ics' || source === 'apple') {
    tasks = parseICSContent(content, DEMO_USER_ID)
  } else if (extension === 'json') {
    tasks = parseJSONExport(content, jsonSourceFor(source), DEMO_USER_ID)
  } else if (extension === 'csv') {
    const rawRows = parseCSVContent(content)
    const headers = Object.keys(rawRows[0] || {})
    const mappedRows =
      headers.length > 0
        ? parseCSVContent(content, autoMapCSVColumns(headers))
        : []

    tasks = mappedRows.map((row) =>
      normalizeTask(row, normalizeSourceFor(source), DEMO_USER_ID, 'manual')
    )
  } else {
    throw new Error('Unsupported demo import file. Use CSV, JSON, or ICS.')
  }

  const usableTasks = tasks.filter((task) => task.title?.trim())
  if (usableTasks.length === 0) {
    throw new Error('No tasks found in this file.')
  }

  return usableTasks.slice(0, MAX_DEMO_IMPORT_TASKS)
}

export default function ImportPage() {
  const { addTask, isAuthenticated } = useTaskStore()
  const [importStates, setImportStates] = useState<Record<ImportSource, ImportState>>({
    todoist: { isLoading: false, isComplete: false },
    microsoft: { isLoading: false, isComplete: false },
    google: { isLoading: false, isComplete: false },
    apple: { isLoading: false, isComplete: false },
    things3: { isLoading: false, isComplete: false },
    omnifocus: { isLoading: false, isComplete: false },
    asana: { isLoading: false, isComplete: false },
    trello: { isLoading: false, isComplete: false },
    csv: { isLoading: false, isComplete: false },
  })

  const updateState = (source: ImportSource, state: Partial<ImportState>) => {
    setImportStates((prev) => ({
      ...prev,
      [source]: { ...prev[source], ...state },
    }))
  }

  const handleImport = async (
    source: ImportSource,
    endpoint: string,
    data: { token?: string; file?: File; source?: string }
  ) => {
    updateState(source, { isLoading: true, error: null })

    try {
      if (!isAuthenticated) {
        if (!data.file) {
          throw new Error('Sign in to import from connected apps. File imports work in demo mode.')
        }

        const importedTasks = await parseDemoFileImport(source, data.file)
        for (const task of importedTasks) {
          addTask(demoTaskFromInsert(task))
        }

        updateState(source, {
          isLoading: false,
          isComplete: true,
          importedCount: importedTasks.length,
        })
        return
      }

      let response: Response

      if (data.file) {
        const formData = new FormData()
        formData.append('file', data.file)
        if (data.source) {
          formData.append('source', data.source)
        }
        response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        })
      } else {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      // Add imported tasks to store if in demo mode
      if (!isAuthenticated && result.tasks) {
        for (const task of result.tasks as Task[]) {
          addTask({
            ...task,
            id: task.id || crypto.randomUUID(),
            created_at: task.created_at || new Date().toISOString(),
            updated_at: task.updated_at || new Date().toISOString(),
          })
        }
      }

      updateState(source, {
        isLoading: false,
        isComplete: true,
        importedCount: result.imported,
      })
    } catch (err) {
      updateState(source, {
        isLoading: false,
        error: err instanceof Error ? err.message : 'Import failed',
      })
    }
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-zinc-100">Import Your Tasks</h1>
        <p className="text-zinc-400 mt-2">
          Bring your tasks from any app into Nexdo
        </p>
      </motion.div>

      {/* Connect & Import Section */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-accent rounded-full" />
          Connect & Import
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Import directly from your task management apps using API tokens or OAuth.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ImportSourceCard
            name="Todoist"
            description="Import all your Todoist tasks including priority and labels"
            icon={<CheckSquare className="h-6 w-6" />}
            type="token"
            tokenPlaceholder="Todoist API token"
            instructions="Get your API token from Todoist Settings > Integrations > Developer"
            {...importStates.todoist}
            onImport={async ({ token }) => {
              await handleImport('todoist', '/api/import/todoist', { token })
            }}
          />
          <ImportSourceCard
            name="Microsoft To Do"
            description="Sync your Microsoft To Do lists and tasks"
            icon={<Layers className="h-6 w-6" />}
            type="oauth"
            comingSoon
            {...importStates.microsoft}
            onImport={async () => {}}
          />
          <ImportSourceCard
            name="Google Tasks"
            description="Import tasks from Google Tasks"
            icon={<Calendar className="h-6 w-6" />}
            type="oauth"
            comingSoon
            {...importStates.google}
            onImport={async () => {}}
          />
        </div>
      </motion.section>

      {/* Upload a File Section */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-accent rounded-full" />
          Upload a File
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Export your tasks from other apps and upload them here.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ImportSourceCard
            name="Apple Reminders"
            description="Import from Apple Reminders via ICS export"
            icon={<Apple className="h-6 w-6" />}
            type="file"
            fileAccept=".ics"
            instructions="Export from Reminders: File > Export, then upload the .ics file"
            {...importStates.apple}
            onImport={async ({ file }) => {
              if (file) {
                await handleImport('apple', '/api/import/ics', { file })
              }
            }}
          />
          <ImportSourceCard
            name="Things 3"
            description="Import from Things 3 JSON or CSV export"
            icon={<CheckSquare className="h-6 w-6" />}
            type="file"
            fileAccept=".json,.csv"
            instructions="Use Things 3 Export feature to create a JSON or CSV file"
            {...importStates.things3}
            onImport={async ({ file }) => {
              if (file) {
                const ext = file.name.split('.').pop()?.toLowerCase()
                if (ext === 'json') {
                  await handleImport('things3', '/api/import/json', {
                    file,
                    source: 'things3',
                  })
                } else {
                  await handleImport('things3', '/api/import/csv', { file })
                }
              }
            }}
          />
          <ImportSourceCard
            name="OmniFocus"
            description="Import OmniFocus tasks via CSV export"
            icon={<Inbox className="h-6 w-6" />}
            type="file"
            fileAccept=".csv"
            instructions="Export from OmniFocus to CSV format, then upload"
            {...importStates.omnifocus}
            onImport={async ({ file }) => {
              if (file) {
                await handleImport('omnifocus', '/api/import/csv', { file })
              }
            }}
          />
          <ImportSourceCard
            name="Asana"
            description="Import from Asana CSV export"
            icon={<LayoutGrid className="h-6 w-6" />}
            type="file"
            fileAccept=".csv"
            instructions="In Asana: Open project > ... > Export/Print > CSV"
            {...importStates.asana}
            onImport={async ({ file }) => {
              if (file) {
                await handleImport('asana', '/api/import/csv', { file })
              }
            }}
          />
          <ImportSourceCard
            name="Trello"
            description="Import from Trello JSON export"
            icon={<LayoutGrid className="h-6 w-6" />}
            type="file"
            fileAccept=".json"
            instructions="In Trello: Menu > More > Print and Export > Export as JSON"
            {...importStates.trello}
            onImport={async ({ file }) => {
              if (file) {
                await handleImport('trello', '/api/import/json', {
                  file,
                  source: 'trello',
                })
              }
            }}
          />
          <ImportSourceCard
            name="Any App (CSV)"
            description="Universal CSV import with smart column detection"
            icon={<FileSpreadsheet className="h-6 w-6" />}
            type="file"
            fileAccept=".csv"
            instructions="Export your tasks as CSV. Make sure you have a 'title' or 'name' column. We'll auto-detect other fields like due dates and priority."
            {...importStates.csv}
            onImport={async ({ file }) => {
              if (file) {
                await handleImport('csv', '/api/import/csv', { file })
              }
            }}
          />
        </div>
      </motion.section>

      {/* Help Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-10 p-6 rounded-xl bg-zinc-900/50 border border-zinc-800"
      >
        <h3 className="font-semibold text-zinc-200 mb-2 flex items-center gap-2">
          <FileText className="h-5 w-5 text-zinc-400" />
          Need help exporting?
        </h3>
        <p className="text-sm text-zinc-400">
          Most task apps let you export your data as CSV, JSON, or ICS files. Look for an
          &quot;Export&quot; option in your app&apos;s settings or menu. If you&apos;re not sure how to
          export from your app, check their help documentation or contact their support.
        </p>
      </motion.section>
    </div>
  )
}
