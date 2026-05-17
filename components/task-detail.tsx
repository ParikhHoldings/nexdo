'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
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
import { Button } from '@/components/ui/button'
import { Badge, TagBadge, PersonBadge } from '@/components/ui/badge'
import type {
  ActionType,
  DraftOutput,
  PrepOutput,
  ResearchOutput,
  Task,
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

export function TaskDetail() {
  const { selectedTask, isDetailOpen, closeDetail, updateTask, deleteTask, isAuthenticated } =
    useTaskStore()
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContext, setEditContext] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium')
  const [editActionType, setEditActionType] = useState<ActionType>('manual')
  const [editEstimate, setEditEstimate] = useState('')
  const [editPeople, setEditPeople] = useState('')
  const [editTags, setEditTags] = useState('')

  if (!selectedTask) return null

  const task = selectedTask
  const isExecutable = ['research', 'draft', 'prep'].includes(task.action_type)
  const agentOutput = normalizeAgentOutput(task.agent_output, task.action_type)
  const hasAgentOutput = agentOutput !== null

  const resetEditForm = () => {
    setEditError(null)
    setEditTitle(task.title)
    setEditContext(task.context ?? '')
    setEditDueDate(task.due_date ?? '')
    setEditPriority(task.priority)
    setEditActionType(task.action_type)
    setEditEstimate(task.estimated_minutes !== null ? String(task.estimated_minutes) : '')
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

    const updates: TaskUpdate = {
      title,
      context: editContext.trim() || null,
      due_date: editDueDate || null,
      priority: editPriority,
      action_type: editActionType,
      estimated_minutes:
        estimatedMinutes === null ? null : Math.round(estimatedMinutes),
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
                {task.estimated_minutes && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-300">
                      {task.estimated_minutes} minutes
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
                <div className="flex flex-wrap gap-2">
                  {(['todo', 'in_progress', 'waiting', 'done'] as const).map(
                    (status) => (
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
                    )
                  )}
                </div>
              </div>

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
