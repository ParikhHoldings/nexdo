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
  Trash2,
} from 'lucide-react'
import { cn, formatRelativeDate, getPriorityBgColor } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { executeTaskHeuristic } from '@/lib/task-intelligence'
import { Button } from '@/components/ui/button'
import { Badge, TagBadge, PersonBadge } from '@/components/ui/badge'
import type { Task, ResearchOutput, DraftOutput, PrepOutput } from '@/lib/database.types'

type AgentOutput = ResearchOutput | DraftOutput | PrepOutput

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

export function TaskDetail() {
  const { selectedTask, isDetailOpen, closeDetail, updateTask, deleteTask, isAuthenticated } =
    useTaskStore()
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)

  if (!selectedTask) return null

  const task = selectedTask
  const isExecutable = ['research', 'draft', 'prep'].includes(task.action_type)
  const hasAgentOutput = task.agent_output !== null

  const handleExecute = async () => {
    setIsExecuting(true)
    setExecutionError(null)

    const saveAgentOutput = (output: AgentOutput) => {
      updateTask(
        task.id,
        { agent_output: output as unknown as Task['agent_output'] },
        { persist: false }
      )
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

      if (!response.ok) {
        if (response.status === 401 || response.status === 503) {
          const fallback = executeTaskHeuristic(task)
          if (fallback) {
            saveAgentOutput(fallback)
            return
          }
        }
        throw new Error('Execution failed')
      }

      const result = await response.json()
      saveAgentOutput(result)
    } catch {
      if (!isAuthenticated) {
        const fallback = executeTaskHeuristic(task)
        if (fallback) {
          saveAgentOutput(fallback)
          return
        }
      }
      setExecutionError('Failed to execute task. Please try again.')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleDelete = () => {
    deleteTask(task.id)
    closeDetail()
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
            onClick={closeDetail}
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
              <button
                onClick={closeDetail}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">
                  {task.title}
                </h2>
                {task.context && (
                  <p className="mt-2 text-sm text-zinc-400">{task.context}</p>
                )}
              </div>

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

                  {hasAgentOutput && (
                    <div className="bg-zinc-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-medium">
                          Completed
                        </span>
                      </div>
                      <AgentResult
                        output={task.agent_output as unknown as AgentOutput}
                        actionType={task.action_type}
                      />
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
