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
  ClipboardPaste,
} from 'lucide-react'
import { ImportSourceCard } from '@/components/import-source-card'
import { Button } from '@/components/ui/button'
import { useTaskStore, useUserStore } from '@/lib/store'
import {
  DEMO_IMPORT_TASK_LIMIT,
  importPreviewWarning,
} from '@/lib/import-preview'
import {
  autoMapCSVColumns,
  normalizeTask,
  parseCSVContent,
  parseICSContent,
  parseJSONExport,
} from '@/lib/importers'
import { createDemoTaskNote } from '@/lib/task-notes'
import {
  parseTaskHandoffBrief,
  type ParsedTaskHandoff,
} from '@/lib/task-handoff'
import type { Task, TaskInsert } from '@/lib/database.types'

const DEMO_USER_ID = 'demo-user'
const MAX_DEMO_IMPORT_BYTES = 2 * 1024 * 1024

interface ImportState {
  isLoading: boolean
  isComplete: boolean
  importedCount?: number
  error?: string | null
}

interface HandoffImportState {
  isLoading: boolean
  isComplete: boolean
  importedTitle?: string
  noteCount?: number
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

function demoTaskFromHandoff(handoff: ParsedTaskHandoff): Task {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    user_id: DEMO_USER_ID,
    title: handoff.title,
    raw_input: handoff.raw_input ?? `Imported from Nexdo handoff: ${handoff.title}`,
    description: handoff.description,
    status: handoff.status,
    priority: handoff.priority,
    due_date: handoff.due_date,
    due_time: handoff.due_time,
    context: handoff.context,
    source: 'manual',
    action_type: handoff.action_type,
    estimated_minutes: handoff.estimated_minutes,
    energy_level: handoff.energy_level,
    people: handoff.people,
    tags: handoff.tags,
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: handoff.status === 'done' ? now : null,
    created_at: now,
    updated_at: now,
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
  }
}

function handoffCreatePayload(handoff: ParsedTaskHandoff) {
  return {
    title: handoff.title,
    raw_input: handoff.raw_input ?? `Imported from Nexdo handoff: ${handoff.title}`,
    description: handoff.description,
    priority: handoff.priority,
    due_date: handoff.due_date,
    due_time: handoff.due_time,
    context: handoff.context,
    source: 'manual',
    action_type: handoff.action_type,
    estimated_minutes: handoff.estimated_minutes,
    energy_level: handoff.energy_level,
    people: handoff.people,
    tags: handoff.tags,
  }
}

function handoffTraceNote(handoff: ParsedTaskHandoff): string | null {
  const trace = [
    handoff.source_agent_id ? `source_agent_id=${handoff.source_agent_id}` : null,
    handoff.external_ref ? `external_ref=${handoff.external_ref}` : null,
    handoff.ingestion_intent ? `ingestion_intent=${handoff.ingestion_intent}` : null,
  ].filter(Boolean)

  return trace.length > 0 ? `Imported handoff trace: ${trace.join(', ')}` : null
}

function handoffNoteContent(
  note: ParsedTaskHandoff['notes'][number]
): string {
  return note.note_type === 'agent_result'
    ? `agent result: ${note.content}`
    : note.content
}

async function parseFileImport(
  source: ImportSource,
  file: File,
  maxTasks = DEMO_IMPORT_TASK_LIMIT
): Promise<TaskInsert[]> {
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

  return usableTasks.slice(0, maxTasks)
}

export default function ImportPage() {
  const { addTask, isAuthenticated } = useTaskStore()
  const { profile } = useUserStore()
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
  const [handoffInput, setHandoffInput] = useState('')
  const [handoffState, setHandoffState] = useState<HandoffImportState>({
    isLoading: false,
    isComplete: false,
    error: null,
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

        const importedTasks = await parseFileImport(source, data.file)
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
        throw new Error(result.message || result.error || 'Import failed')
      }

      // Keep the visible workspace in sync with server-side imports.
      if (Array.isArray(result.tasks)) {
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

  const previewFileImport = async (source: ImportSource, file: File) => {
    const importedTasks = await parseFileImport(
      source,
      file,
      isAuthenticated ? Number.MAX_SAFE_INTEGER : DEMO_IMPORT_TASK_LIMIT
    )
    const sampleTitles = importedTasks
      .map((task) => task.title?.trim())
      .filter((title): title is string => Boolean(title))
      .slice(0, 3)

    const warning = importPreviewWarning({
      isAuthenticated,
      importCount: importedTasks.length,
      subscriptionTier: profile?.subscription_tier,
      taskCountThisMonth: profile?.task_count_this_month,
    })

    return {
      count: importedTasks.length,
      sampleTitles,
      warning,
    }
  }

  const handleHandoffImport = async () => {
    setHandoffState({ isLoading: true, isComplete: false, error: null })

    const parsed = parseTaskHandoffBrief(handoffInput)
    if ('error' in parsed) {
      setHandoffState({
        isLoading: false,
        isComplete: false,
        error: parsed.error,
      })
      return
    }

    const { handoff } = parsed
    const traceNote = handoffTraceNote(handoff)
    const noteContents = [
      traceNote,
      ...handoff.notes.map(handoffNoteContent),
    ].filter((item): item is string => Boolean(item))

    try {
      if (!isAuthenticated) {
        const task = demoTaskFromHandoff(handoff)
        addTask(task)
        for (const note of noteContents) {
          createDemoTaskNote(task.id, note)
        }
        setHandoffInput('')
        setHandoffState({
          isLoading: false,
          isComplete: true,
          importedTitle: task.title,
          noteCount: noteContents.length,
          error: null,
        })
        return
      }

      const createResponse = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(handoffCreatePayload(handoff)),
      })
      const createPayload = await createResponse.json().catch(() => ({}))
      if (!createResponse.ok) {
        throw new Error(
          createPayload?.message ||
            createPayload?.errors?.[0]?.message ||
            createPayload?.error ||
            'Could not import handoff task'
        )
      }

      let savedTask = createPayload as Task
      if (handoff.status !== 'todo') {
        const statusResponse = await fetch(`/api/tasks/${savedTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: handoff.status }),
        })
        const statusPayload = await statusResponse.json().catch(() => ({}))
        if (!statusResponse.ok) {
          throw new Error(
            statusPayload?.message ||
              statusPayload?.errors?.[0]?.message ||
              statusPayload?.error ||
              'Could not apply imported task status'
          )
        }
        savedTask = statusPayload as Task
      }

      for (const note of noteContents) {
        const noteResponse = await fetch(`/api/tasks/${savedTask.id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: note }),
        })
        const notePayload = await noteResponse.json().catch(() => ({}))
        if (!noteResponse.ok) {
          throw new Error(
            notePayload?.message ||
              notePayload?.error ||
              'Imported task was created, but a handoff note could not be saved'
          )
        }
      }

      addTask(savedTask)
      setHandoffInput('')
      setHandoffState({
        isLoading: false,
        isComplete: true,
        importedTitle: savedTask.title,
        noteCount: noteContents.length,
        error: null,
      })
    } catch (error) {
      setHandoffState({
        isLoading: false,
        isComplete: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Could not import handoff task',
      })
    }
  }

  return (
    <div className="min-h-full max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 lg:pb-8">
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

      {/* Nexdo Handoff Section */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-10"
      >
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-200">
          <div className="h-5 w-1 rounded-full bg-accent" />
          Paste a Nexdo Handoff
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-start gap-3">
            <ClipboardPaste className="mt-1 h-5 w-5 flex-shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1 space-y-3">
              <textarea
                aria-label="Nexdo task handoff brief"
                value={handoffInput}
                onChange={(event) => {
                  setHandoffInput(event.target.value)
                  setHandoffState((current) => ({
                    ...current,
                    isComplete: false,
                    error: null,
                  }))
                }}
                rows={7}
                placeholder="# Nexdo Task Handoff"
                className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-sm">
                  {handoffState.error && (
                    <p className="text-red-400">{handoffState.error}</p>
                  )}
                  {handoffState.isComplete && (
                    <p className="text-emerald-400">
                      Added {handoffState.importedTitle}
                      {handoffState.noteCount
                        ? ` with ${handoffState.noteCount} note${handoffState.noteCount === 1 ? '' : 's'}.`
                        : '.'}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleHandoffImport}
                  isLoading={handoffState.isLoading}
                  disabled={!handoffInput.trim()}
                >
                  Import handoff
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

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
          Import directly from apps that support personal or OAuth access tokens.
          Full OAuth connection is a post-launch workflow.
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
            description="Import Microsoft To Do lists with a Graph access token"
            icon={<Layers className="h-6 w-6" />}
            type="token"
            tokenPlaceholder="Graph access token"
            instructions="Use a Microsoft Graph access token with Tasks.Read permissions. Full OAuth connection is planned after launch."
            {...importStates.microsoft}
            onImport={async ({ token }) => {
              await handleImport('microsoft', '/api/import/microsoft', { token })
            }}
          />
          <ImportSourceCard
            name="Google Tasks"
            description="Import Google Tasks lists with a Google access token"
            icon={<Calendar className="h-6 w-6" />}
            type="token"
            tokenPlaceholder="Google Tasks access token"
            instructions="Use a Google OAuth access token with Google Tasks scope. Full OAuth connection is planned after launch."
            {...importStates.google}
            onImport={async ({ token }) => {
              await handleImport('google', '/api/import/google', { token })
            }}
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
            onPreview={async ({ file }) => previewFileImport('apple', file)}
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
            onPreview={async ({ file }) => previewFileImport('things3', file)}
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
            onPreview={async ({ file }) => previewFileImport('omnifocus', file)}
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
            onPreview={async ({ file }) => previewFileImport('asana', file)}
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
            onPreview={async ({ file }) => previewFileImport('trello', file)}
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
            onPreview={async ({ file }) => previewFileImport('csv', file)}
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
