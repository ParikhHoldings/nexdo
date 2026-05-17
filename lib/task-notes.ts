import type { TaskNote } from './database.types'

export const MAX_TASK_NOTE_LENGTH = 2000
export const DEMO_TASK_NOTES_STORAGE_KEY = 'nexdo_demo_task_notes'

type StoredDemoTaskNotes = Record<string, TaskNote[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function noteId() {
  return globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random()}`
}

function readStoredDemoTaskNotes(): StoredDemoTaskNotes {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(DEMO_TASK_NOTES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([taskId, notes]) => [
          taskId,
          Array.isArray(notes)
            ? notes.filter(isTaskNote).sort(newestFirst)
            : [],
        ])
        .filter(([, notes]) => notes.length > 0)
    )
  } catch {
    return {}
  }
}

function persistStoredDemoTaskNotes(notes: StoredDemoTaskNotes) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DEMO_TASK_NOTES_STORAGE_KEY, JSON.stringify(notes))
}

function isTaskNote(value: unknown): value is TaskNote {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.task_id === 'string' &&
    typeof value.content === 'string' &&
    typeof value.created_at === 'string' &&
    ['note', 'agent_result', 'link', 'file'].includes(String(value.note_type))
  )
}

function newestFirst(a: TaskNote, b: TaskNote) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

export function validateTaskNoteContent(value: unknown):
  | { content: string }
  | { error: string } {
  if (typeof value !== 'string') {
    return { error: 'Note content is required.' }
  }

  const content = value.trim()
  if (!content) {
    return { error: 'Note content is required.' }
  }

  if (content.length > MAX_TASK_NOTE_LENGTH) {
    return { error: `Note content must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.` }
  }

  return { content }
}

export function getDemoTaskNotes(taskId: string): TaskNote[] {
  return readStoredDemoTaskNotes()[taskId] ?? []
}

export function createDemoTaskNote(
  taskId: string,
  content: string,
  createdAt = new Date().toISOString()
): TaskNote {
  const note: TaskNote = {
    id: noteId(),
    task_id: taskId,
    content,
    note_type: 'note',
    created_at: createdAt,
  }
  const storedNotes = readStoredDemoTaskNotes()
  const notes = [note, ...(storedNotes[taskId] ?? [])].sort(newestFirst)
  persistStoredDemoTaskNotes({ ...storedNotes, [taskId]: notes })
  return note
}
