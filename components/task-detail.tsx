'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  Clock,
  Users,
  Tag,
  Sparkles,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  Trash2,
  Edit3,
  Save,
  Bot,
  Link2,
} from 'lucide-react'
import { cn, formatDueTime, formatRelativeDate } from '@/lib/utils'
import {
  agentMetadataKeys,
  agentTraceLabel,
  compactTraceValue,
  formatIngestionIntent,
  hasAgentTrace,
} from '@/lib/agent-trace'
import { useTaskStore } from '@/lib/store'
import { executeTaskHeuristic } from '@/lib/task-intelligence'
import {
  AGENT_REVIEW_STATUSES,
  appendAgentExecution,
  isAgentOutputEnvelope,
  normalizeAgentOutput,
  updateAgentReview,
  type AgentOutput,
  type AgentReviewStatus,
} from '@/lib/agent-output'
import { isExecutableActionType } from '@/lib/task-actions'
import {
  createDemoTaskNote,
  getDemoTaskNotes,
  MAX_TASK_NOTE_LENGTH,
  validateTaskNoteContent,
} from '@/lib/task-notes'
import { Button } from '@/components/ui/button'
import { Badge, TagBadge, PersonBadge } from '@/components/ui/badge'
import type {
  ActionType,
  DraftOutput,
  PrepOutput,
  ResearchOutput,
  Task,
  TaskNote,
  EnergyLevel,
  TaskPriority,
  TaskUpdate,
} from '@/lib/database.types'

interface AgentResultProps {
  output: AgentOutput
  actionType: string
}

function AgentResult({ output, actionType }: AgentResultProps) {
  if (actionType === 'research') {
    const research = output as ResearchOutput
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Summary</h4>
          <p className="text-sm text-zinc-400">{research.summary}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Key Findings</h4>
          <ul className="space-y-1">
            {research.key_findings.map((finding, i) => (
              <li key={i} className="text-sm text-zinc-400 flex gap-2">
                <span className="text-accent">•</span>
                {finding}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-300 mb-2">
            Recommended Action
          </h4>
          <p className="text-sm text-zinc-400">{research.recommended_action}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Confidence:</span>
          <Badge
            variant="default"
            className={cn(
              research.confidence === 'high' && 'bg-emerald-500/10 text-emerald-400',
              research.confidence === 'medium' && 'bg-amber-500/10 text-amber-400',
              research.confidence === 'low' && 'bg-red-500/10 text-red-400'
            )}
          >
            {research.confidence}
          </Badge>
        </div>
      </div>
    )
  }

  if (actionType === 'draft') {
    const draft = output as DraftOutput
    return (
      <div className="space-y-4">
        {draft.suggested_subject && (
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-2">
              Suggested Subject
            </h4>
            <p className="text-sm text-zinc-400">{draft.suggested_subject}</p>
          </div>
        )}
        <div>
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Draft</h4>
          <div className="bg-zinc-800 rounded-lg p-4">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">
              {draft.draft}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Tone: {draft.tone}</span>
          <span>{draft.word_count} words</span>
        </div>
      </div>
    )
  }

  if (actionType === 'prep') {
    const prep = output as PrepOutput
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Overview</h4>
          <p className="text-sm text-zinc-400">{prep.overview}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Key Points</h4>
          <ul className="space-y-1">
            {prep.key_points.map((point, i) => (
              <li key={i} className="text-sm text-zinc-400 flex gap-2">
                <span className="text-accent">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        {prep.questions_to_ask.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-2">
              Questions to Ask
            </h4>
            <ul className="space-y-1">
              {prep.questions_to_ask.map((question, i) => (
                <li key={i} className="text-sm text-zinc-400 flex gap-2">
                  <span className="text-amber-400">?</span>
                  {question}
                </li>
              ))}
            </ul>
          </div>
        )}
        {prep.materials_needed.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-2">
              Materials Needed
            </h4>
            <ul className="space-y-1">
              {prep.materials_needed.map((material, i) => (
                <li key={i} className="text-sm text-zinc-400 flex gap-2">
                  <FileText className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                  {material}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-xs text-zinc-500">
          Estimated time: {prep.time_estimate}
        </div>
      </div>
    )
  }

  return null
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low']
const ACTION_TYPES: ActionType[] = ['manual', 'research', 'draft', 'prep', 'remind']
const ENERGY_LEVELS: EnergyLevel[] = ['deep', 'light', 'quick']
const TASK_STATUSES: Task['status'][] = [
  'todo',
  'in_progress',
  'waiting',
  'done',
  'cancelled',
]
const REVIEW_STATUS_LABELS: Record<AgentReviewStatus, string> = {
  unreviewed: 'Unreviewed',
  verified: 'Verified',
  needs_revision: 'Needs revision',
}

function listToText(value: string[] | null): string {
  return value?.join(', ') ?? ''
}

function textToList(value: string): string[] | null {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? Array.from(new Set(items)) : null
}

interface AgentReviewPanelProps {
  task: Task
  agentOutput: NonNullable<ReturnType<typeof normalizeAgentOutput>>
  isAuthenticated: boolean
  updateTask: (
    id: string,
    updates: TaskUpdate,
    options?: { persist?: boolean }
  ) => void
}

function AgentReviewPanel({
  task,
  agentOutput,
  isAuthenticated,
  updateTask,
}: AgentReviewPanelProps) {
  const [reviewStatus, setReviewStatus] = useState<AgentReviewStatus>(
    agentOutput.review.status
  )
  const [reviewNote, setReviewNote] = useState(agentOutput.review.note ?? '')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSaved, setReviewSaved] = useState(false)
  const [isSavingReview, setIsSavingReview] = useState(false)

  const handleSaveReview = async () => {
    setReviewError(null)
    setReviewSaved(false)
    setIsSavingReview(true)

    const nextOutput = updateAgentReview(
      agentOutput,
      reviewStatus,
      reviewNote.trim() || null
    )

    try {
      if (!isAuthenticated) {
        updateTask(
          task.id,
          { agent_output: nextOutput as unknown as Task['agent_output'] },
          { persist: false }
        )
        setReviewSaved(true)
        return
      }

      const response = await fetch(`/api/tasks/${task.id}/agent-review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewStatus,
          note: reviewNote.trim() || null,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            'Could not save review'
        )
      }

      const savedOutput = normalizeAgentOutput(
        payload as Task['agent_output'],
        task.action_type
      )
      updateTask(
        task.id,
        {
          agent_output: (savedOutput ?? nextOutput) as unknown as Task['agent_output'],
        },
        { persist: false }
      )
      setReviewSaved(true)
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : 'Could not save review'
      )
    } finally {
      setIsSavingReview(false)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-200">
          Verification notes
        </h4>
        <p className="mt-1 text-xs text-zinc-500">
          Mark whether this agent result is ready to use or needs another pass.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {AGENT_REVIEW_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={reviewStatus === status}
            onClick={() => setReviewStatus(status)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm transition-colors',
              reviewStatus === status
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100'
            )}
          >
            {REVIEW_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <textarea
        aria-label="Agent review note"
        value={reviewNote}
        onChange={(event) => {
          setReviewNote(event.target.value)
          setReviewSaved(false)
        }}
        rows={3}
        maxLength={1000}
        placeholder="Add what you verified, changed, or still need to check."
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
      />

      {reviewError && (
        <p className="text-sm text-red-400">{reviewError}</p>
      )}
      {reviewSaved && (
        <p className="text-sm text-emerald-400">Review saved.</p>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSaveReview}
          isLoading={isSavingReview}
        >
          Save review
        </Button>
      </div>
    </div>
  )
}

interface TaskNotesPanelProps {
  task: Task
  isAuthenticated: boolean
}

function TaskNotesPanel({ task, isAuthenticated }: TaskNotesPanelProps) {
  const [taskNotes, setTaskNotes] = useState<TaskNote[]>(() =>
    isAuthenticated ? [] : getDemoTaskNotes(task.id)
  )
  const [noteDraft, setNoteDraft] = useState('')
  const [notesLoading, setNotesLoading] = useState(isAuthenticated)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [noteSaved, setNoteSaved] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const controller = new AbortController()

    fetch(`/api/tasks/${task.id}/notes`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(
            payload?.message ||
              payload?.error ||
              'Could not load task notes'
          )
        }
        setTaskNotes(Array.isArray(payload?.notes) ? payload.notes : [])
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setTaskNotes([])
        setNoteError(
          error instanceof Error && error.message
            ? error.message
            : 'Could not load task notes'
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setNotesLoading(false)
      })

    return () => controller.abort()
  }, [task.id, isAuthenticated])

  const handleSaveNote = async () => {
    const validation = validateTaskNoteContent(noteDraft)
    if ('error' in validation) {
      setNoteError(validation.error)
      setNoteSaved(false)
      return
    }

    setIsSavingNote(true)
    setNoteError(null)
    setNoteSaved(false)

    try {
      if (!isAuthenticated) {
        const note = createDemoTaskNote(task.id, validation.content)
        setTaskNotes((current) => [note, ...current])
        setNoteDraft('')
        setNoteSaved(true)
        return
      }

      const response = await fetch(`/api/tasks/${task.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: validation.content }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            'Could not save task note'
        )
      }

      setTaskNotes((current) => [payload as TaskNote, ...current])
      setNoteDraft('')
      setNoteSaved(true)
    } catch (error) {
      setNoteError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not save task note'
      )
    } finally {
      setIsSavingNote(false)
    }
  }

  return (
    <section
      aria-label="Task notes"
      className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4"
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-zinc-500" />
        <h3 className="text-sm font-medium text-zinc-200">
          Task notes
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        <textarea
          aria-label="Task note"
          value={noteDraft}
          onChange={(event) => {
            setNoteDraft(event.target.value)
            setNoteError(null)
            setNoteSaved(false)
          }}
          rows={3}
          maxLength={MAX_TASK_NOTE_LENGTH}
          placeholder="Add context, links, decisions, or handoff notes."
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">
            {noteDraft.length}/{MAX_TASK_NOTE_LENGTH}
          </span>
          <Button
            size="sm"
            onClick={handleSaveNote}
            isLoading={isSavingNote}
          >
            <Save className="h-4 w-4 mr-2" />
            Add note
          </Button>
        </div>
        {noteError && (
          <p className="text-sm text-red-400">{noteError}</p>
        )}
        {noteSaved && (
          <p className="text-sm text-emerald-400">Note saved.</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {notesLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading notes
          </div>
        )}
        {!notesLoading && taskNotes.length === 0 && (
          <p className="text-sm text-zinc-500">
            No notes yet.
          </p>
        )}
        {taskNotes.map((note) => (
          <article
            key={note.id}
            className="rounded-lg bg-zinc-900 px-3 py-2"
          >
            <p className="whitespace-pre-wrap text-sm text-zinc-300">
              {note.content}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {new Date(note.created_at).toLocaleString()}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

interface TaskRelationshipsPanelProps {
  task: Task
  tasks: Task[]
  isAuthenticated: boolean
  updateTask: (
    id: string,
    updates: TaskUpdate,
    options?: { persist?: boolean }
  ) => void
  selectTask: (task: Task | null) => void
}

function relationshipTaskLabel(task: Task | undefined, taskId: string) {
  return task?.title ?? `Task ${taskId.slice(0, 8)}`
}

function TaskRelationshipsPanel({
  task,
  tasks,
  isAuthenticated,
  updateTask,
  selectTask,
}: TaskRelationshipsPanelProps) {
  const [isSavingRelationships, setIsSavingRelationships] = useState(false)
  const [relationshipError, setRelationshipError] = useState<string | null>(null)
  const relatedTaskIds = task.related_task_ids ?? []
  const relatedTaskIdSet = new Set(relatedTaskIds)
  const taskById = new Map(tasks.map((item) => [item.id, item]))
  const parentTask = task.parent_task_id
    ? taskById.get(task.parent_task_id)
    : undefined
  const parentCandidates = tasks.filter(
    (item) => item.id !== task.id && !relatedTaskIdSet.has(item.id)
  )
  const relatedCandidates = tasks.filter(
    (item) =>
      item.id !== task.id &&
      item.id !== task.parent_task_id &&
      !relatedTaskIdSet.has(item.id)
  )

  const saveRelationships = async (
    parentTaskId: string | null,
    nextRelatedTaskIds: string[]
  ) => {
    setRelationshipError(null)
    setIsSavingRelationships(true)

    const relationshipUpdate: TaskUpdate = {
      parent_task_id: parentTaskId,
      related_task_ids:
        nextRelatedTaskIds.length > 0
          ? Array.from(new Set(nextRelatedTaskIds))
          : null,
    }

    if (!isAuthenticated) {
      updateTask(task.id, relationshipUpdate, { persist: false })
      setIsSavingRelationships(false)
      return
    }

    try {
      const response = await fetch(`/api/tasks/${task.id}/relationships`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relationshipUpdate),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            'Could not update task relationships'
        )
      }

      const savedTask = payload as Task
      updateTask(
        task.id,
        {
          parent_task_id: savedTask.parent_task_id,
          related_task_ids: savedTask.related_task_ids,
        },
        { persist: false }
      )
    } catch (error) {
      setRelationshipError(
        error instanceof Error
          ? error.message
          : 'Could not update task relationships'
      )
    } finally {
      setIsSavingRelationships(false)
    }
  }

  const handleParentChange = (value: string) => {
    const nextParentTaskId = value || null
    saveRelationships(
      nextParentTaskId,
      relatedTaskIds.filter((id) => id !== nextParentTaskId)
    )
  }

  const handleAddRelatedTask = (value: string) => {
    if (!value) return
    saveRelationships(task.parent_task_id, [...relatedTaskIds, value])
  }

  const handleRemoveRelatedTask = (taskId: string) => {
    saveRelationships(
      task.parent_task_id,
      relatedTaskIds.filter((id) => id !== taskId)
    )
  }

  return (
    <section
      aria-label="Task relationships"
      className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4"
    >
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-zinc-500" />
        <h3 className="text-sm font-medium text-zinc-200">
          Task relationships
        </h3>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-zinc-400">
            Parent task
          </label>
          <select
            aria-label="Parent task"
            value={task.parent_task_id ?? ''}
            disabled={isSavingRelationships}
            onChange={(event) => handleParentChange(event.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">No parent task</option>
            {task.parent_task_id && !parentTask && (
              <option value={task.parent_task_id}>
                {relationshipTaskLabel(parentTask, task.parent_task_id)}
              </option>
            )}
            {parentCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
          {parentTask && (
            <button
              type="button"
              onClick={() => selectTask(parentTask)}
              className="mt-2 text-left text-sm text-zinc-300 transition-colors hover:text-zinc-100"
            >
              {parentTask.title}
            </button>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-zinc-400">
            Related tasks
          </label>
          <select
            aria-label="Add related task"
            value=""
            disabled={isSavingRelationships || relatedCandidates.length === 0}
            onChange={(event) => handleAddRelatedTask(event.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Add related task</option>
            {relatedCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>

          <div className="mt-3 space-y-2">
            {relatedTaskIds.length === 0 && (
              <p className="text-sm text-zinc-500">No related tasks.</p>
            )}
            {relatedTaskIds.map((relatedTaskId) => {
              const relatedTask = taskById.get(relatedTaskId)
              const label = relationshipTaskLabel(relatedTask, relatedTaskId)

              return (
                <div
                  key={relatedTaskId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-2"
                >
                  <button
                    type="button"
                    disabled={!relatedTask}
                    onClick={() => relatedTask && selectTask(relatedTask)}
                    className="min-w-0 truncate text-left text-sm text-zinc-300 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                  >
                    {label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove related task ${label}`}
                    onClick={() => handleRemoveRelatedTask(relatedTaskId)}
                    disabled={isSavingRelationships}
                    className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {isSavingRelationships && (
          <p className="text-sm text-zinc-500">Saving relationships...</p>
        )}
        {relationshipError && (
          <p className="text-sm text-red-400">{relationshipError}</p>
        )}
      </div>
    </section>
  )
}

export function TaskDetail() {
  const { selectedTask, tasks, isDetailOpen, closeDetail, updateTask, deleteTask, selectTask, isAuthenticated } =
    useTaskStore()
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContext, setEditContext] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editDueTime, setEditDueTime] = useState('')
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium')
  const [editActionType, setEditActionType] = useState<ActionType>('manual')
  const [editEstimate, setEditEstimate] = useState('')
  const [editEnergyLevel, setEditEnergyLevel] = useState<EnergyLevel | ''>('')
  const [editPeople, setEditPeople] = useState('')
  const [editTags, setEditTags] = useState('')

  if (!selectedTask) return null

  const task = selectedTask
  const isExecutable = isExecutableActionType(task.action_type)
  const agentOutput = normalizeAgentOutput(task.agent_output, task.action_type)
  const hasAgentOutput = agentOutput !== null
  const showAgentTrace = hasAgentTrace(task)
  const agentLabel = agentTraceLabel(task)
  const intentLabel = formatIngestionIntent(task.ingestion_intent)
  const metadataKeys = agentMetadataKeys(task.agent_metadata)

  const resetEditForm = () => {
    setEditError(null)
    setEditTitle(task.title)
    setEditContext(task.context ?? '')
    setEditDueDate(task.due_date ?? '')
    setEditDueTime(task.due_time ? formatDueTime(task.due_time) : '')
    setEditPriority(task.priority)
    setEditActionType(task.action_type)
    setEditEstimate(task.estimated_minutes !== null ? String(task.estimated_minutes) : '')
    setEditEnergyLevel(task.energy_level ?? '')
    setEditPeople(listToText(task.people))
    setEditTags(listToText(task.tags))
  }

  const handleStartEdit = () => {
    resetEditForm()
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    resetEditForm()
    setIsEditing(false)
  }

  const handleClose = () => {
    setIsEditing(false)
    setEditError(null)
    closeDetail()
  }

  const handleSaveEdit = () => {
    const title = editTitle.trim()
    if (!title) {
      setEditError('Title is required.')
      return
    }

    const estimatedMinutes =
      editEstimate.trim() === '' ? null : Number(editEstimate.trim())
    if (
      estimatedMinutes !== null &&
      (!Number.isFinite(estimatedMinutes) ||
        estimatedMinutes < 0 ||
        estimatedMinutes > 60 * 24 * 7)
    ) {
      setEditError('Estimate must be between 0 and 10080 minutes.')
      return
    }

    const dueTime = editDueTime.trim()
    if (dueTime && !/^\d{2}:\d{2}$/.test(dueTime)) {
      setEditError('Due time must use HH:MM format.')
      return
    }

    const updates: TaskUpdate = {
      title,
      context: editContext.trim() || null,
      due_date: editDueDate || null,
      due_time: dueTime || null,
      priority: editPriority,
      action_type: editActionType,
      estimated_minutes:
        estimatedMinutes === null ? null : Math.round(estimatedMinutes),
      energy_level: editEnergyLevel || null,
      people: textToList(editPeople),
      tags: textToList(editTags),
    }

    updateTask(task.id, updates)
    setEditError(null)
    setIsEditing(false)
  }

  const handleExecute = async () => {
    setIsExecuting(true)
    setExecutionError(null)

    const saveAgentOutput = (output: AgentOutput) => {
      const nextOutput = appendAgentExecution(
        task.agent_output,
        output,
        task.action_type
      )
      updateTask(
        task.id,
        { agent_output: nextOutput as unknown as Task['agent_output'] },
        { persist: false }
      )
    }

    const saveAgentEnvelope = (output: unknown) => {
      const nextOutput = normalizeAgentOutput(
        output as Task['agent_output'],
        task.action_type
      )
      if (!nextOutput) return false
      updateTask(
        task.id,
        { agent_output: nextOutput as unknown as Task['agent_output'] },
        { persist: false }
      )
      return true
    }

    if (!isAuthenticated) {
      const fallback = executeTaskHeuristic(task)
      if (fallback) {
        saveAgentOutput(fallback)
        setIsExecuting(false)
        return
      }
    }

    try {
      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401 || response.status === 503) {
          const fallback = executeTaskHeuristic(task)
          if (fallback) {
            saveAgentOutput(fallback)
            return
          }
        }
        throw new Error(
          payload?.message ||
            payload?.error ||
            'Execution failed'
        )
      }

      if (!isAgentOutputEnvelope(payload) || !saveAgentEnvelope(payload)) {
        saveAgentOutput(payload)
      }
    } catch (error) {
      if (!isAuthenticated) {
        const fallback = executeTaskHeuristic(task)
        if (fallback) {
          saveAgentOutput(fallback)
          return
        }
      }
      setExecutionError(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to execute task. Please try again.'
      )
    } finally {
      setIsExecuting(false)
    }
  }

  const handleDelete = () => {
    deleteTask(task.id)
    handleClose()
  }

  const handleStatusChange = (status: Task['status']) => {
    updateTask(task.id, { status })
  }

  return (
    <AnimatePresence>
      {isDetailOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-zinc-900 border-l border-zinc-800 z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <Badge variant="priority" priority={task.priority}>
                  {task.priority}
                </Badge>
                {isExecutable && (
                  <Badge variant="action" action={task.action_type}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    {task.action_type}
                  </Badge>
                )}
                {showAgentTrace && (
                  <Badge
                    variant="outline"
                    className="border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  >
                    <Bot className="h-3 w-3 mr-1" />
                    Agent
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!isEditing && (
                  <button
                    onClick={handleStartEdit}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                    aria-label="Edit task"
                    title="Edit task"
                  >
                    <Edit3 className="h-5 w-5 text-zinc-400" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  aria-label="Close task detail"
                >
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {isEditing ? (
                <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Title
                    </label>
                    <input
                      aria-label="Task title"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Context
                    </label>
                    <textarea
                      aria-label="Task context"
                      value={editContext}
                      onChange={(event) => setEditContext(event.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Due date
                      </label>
                      <input
                        aria-label="Task due date"
                        type="date"
                        value={editDueDate}
                        onChange={(event) => setEditDueDate(event.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Due time
                      </label>
                      <input
                        aria-label="Task due time"
                        type="time"
                        value={editDueTime}
                        onChange={(event) => setEditDueTime(event.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Estimate
                      </label>
                      <input
                        aria-label="Task estimate"
                        type="number"
                        min={0}
                        max={10080}
                        value={editEstimate}
                        onChange={(event) => setEditEstimate(event.target.value)}
                        placeholder="Minutes"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Energy
                      </label>
                      <select
                        aria-label="Task energy level"
                        value={editEnergyLevel}
                        onChange={(event) =>
                          setEditEnergyLevel(event.target.value as EnergyLevel | '')
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                      >
                        <option value="">No energy level</option>
                        {ENERGY_LEVELS.map((energyLevel) => (
                          <option key={energyLevel} value={energyLevel}>
                            {energyLevel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Priority
                      </label>
                      <select
                        aria-label="Task priority"
                        value={editPriority}
                        onChange={(event) =>
                          setEditPriority(event.target.value as TaskPriority)
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Action type
                      </label>
                      <select
                        aria-label="Task action type"
                        value={editActionType}
                        onChange={(event) =>
                          setEditActionType(event.target.value as ActionType)
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                      >
                        {ACTION_TYPES.map((actionType) => (
                          <option key={actionType} value={actionType}>
                            {actionType}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      People
                    </label>
                    <input
                      aria-label="Task people"
                      value={editPeople}
                      onChange={(event) => setEditPeople(event.target.value)}
                      placeholder="Sarah, Alex"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Tags
                    </label>
                    <input
                      aria-label="Task tags"
                      value={editTags}
                      onChange={(event) => setEditTags(event.target.value)}
                      placeholder="customer, launch"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>

                  {editError && (
                    <p className="text-sm text-red-400">{editError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100">
                    {task.title}
                  </h2>
                  {task.context && (
                    <p className="mt-2 text-sm text-zinc-400">{task.context}</p>
                  )}
                </div>
              )}

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-4">
                {task.due_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-300">
                      {formatRelativeDate(task.due_date)}
                    </span>
                  </div>
                )}
                {task.due_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-300">
                      {formatDueTime(task.due_time)}
                    </span>
                  </div>
                )}
                {task.estimated_minutes && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-300">
                      {task.estimated_minutes} minutes
                    </span>
                  </div>
                )}
                {task.energy_level && (
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-300">
                      {task.energy_level} energy
                    </span>
                  </div>
                )}
              </div>

              {/* People */}
              {task.people && task.people.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-zinc-400">People</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.people.map((person) => (
                      <PersonBadge key={person} name={person} />
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-zinc-400">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                </div>
              )}

              {/* Status selector */}
              <div>
                <span className="text-sm text-zinc-400 block mb-2">Status</span>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Task status"
                >
                  {TASK_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        task.status === status
                          ? 'bg-accent text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <TaskRelationshipsPanel
                key={`relationships-${task.id}`}
                task={task}
                tasks={tasks}
                isAuthenticated={isAuthenticated}
                updateTask={updateTask}
                selectTask={selectTask}
              />

              <TaskNotesPanel
                key={`${task.id}-${isAuthenticated ? 'auth' : 'demo'}`}
                task={task}
                isAuthenticated={isAuthenticated}
              />

              {showAgentTrace && (
                <section
                  aria-label="Agent trace"
                  className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-cyan-300" />
                    <h3 className="text-sm font-medium text-cyan-100">
                      Agent trace
                    </h3>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">
                        Source agent
                      </dt>
                      <dd
                        className="mt-1 text-zinc-200"
                        title={task.source_agent_id ?? undefined}
                      >
                        {agentLabel}
                      </dd>
                    </div>
                    {task.external_ref && (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">
                          External ref
                        </dt>
                        <dd
                          className="mt-1 text-zinc-200"
                          title={task.external_ref}
                        >
                          {compactTraceValue(task.external_ref)}
                        </dd>
                      </div>
                    )}
                    {intentLabel && (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">
                          Intent
                        </dt>
                        <dd className="mt-1 text-zinc-200">{intentLabel}</dd>
                      </div>
                    )}
                    {metadataKeys.length > 0 && (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">
                          Metadata keys
                        </dt>
                        <dd className="mt-1 text-zinc-200">
                          {metadataKeys.join(', ')}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              )}

              {/* Agent execution */}
              {isExecutable && (
                <div className="border-t border-zinc-800 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <h3 className="text-lg font-medium text-zinc-100">
                      AI Agent
                    </h3>
                  </div>

                  {!hasAgentOutput && !isExecuting && (
                    <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <p className="text-sm text-zinc-400 mb-4">
                        Run the AI agent to{' '}
                        {task.action_type === 'research'
                          ? 'research this topic'
                          : task.action_type === 'draft'
                            ? 'draft content'
                            : 'prepare materials'}{' '}
                        for you.
                      </p>
                      <Button onClick={handleExecute}>
                        <Play className="h-4 w-4 mr-2" />
                        Run {task.action_type}
                      </Button>
                    </div>
                  )}

                  {isExecuting && (
                    <div className="bg-zinc-800/50 rounded-lg p-6 text-center">
                      <Loader2 className="h-8 w-8 text-accent animate-spin mx-auto mb-3" />
                      <p className="text-sm text-zinc-400">
                        Agent is working on your task...
                      </p>
                    </div>
                  )}

                  {executionError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-red-400">{executionError}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={handleExecute}
                        >
                          Try again
                        </Button>
                      </div>
                    </div>
                  )}

                  {agentOutput && (
                    <div className="space-y-4">
                      <div className="bg-zinc-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <span className="text-sm text-emerald-400 font-medium">
                              Completed
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExecute}
                            disabled={isExecuting}
                          >
                            {isExecuting ? 'Running...' : 'Run again'}
                          </Button>
                        </div>
                        <AgentResult
                          output={agentOutput.current}
                          actionType={task.action_type}
                        />
                      </div>

                      <AgentReviewPanel
                        key={`${task.id}-${agentOutput.history[0]?.id ?? 'new'}`}
                        task={task}
                        agentOutput={agentOutput}
                        isAuthenticated={isAuthenticated}
                        updateTask={updateTask}
                      />

                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-zinc-500" />
                            <h4 className="text-sm font-medium text-zinc-200">
                              Execution history
                            </h4>
                          </div>
                          <span className="text-xs text-zinc-500">
                            {agentOutput.history.length} run{agentOutput.history.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <ol className="mt-3 space-y-2">
                          {agentOutput.history.map((run) => (
                            <li
                              key={run.id}
                              className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-2"
                            >
                              <span className="text-sm text-zinc-300">
                                {run.action_type}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {new Date(run.created_at).toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Raw input */}
              {task.raw_input && task.raw_input !== task.title && (
                <div className="border-t border-zinc-800 pt-6">
                  <span className="text-sm text-zinc-500 block mb-2">
                    Original input
                  </span>
                  <p className="text-sm text-zinc-400 italic">
                    &quot;{task.raw_input}&quot;
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <span className="text-xs text-zinc-500">
                Created {new Date(task.created_at).toLocaleDateString()}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
