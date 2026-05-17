'use client'

import { forwardRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Clock,
  Users,
  Sparkles,
  Play,
  Bot,
  MoreHorizontal,
  Trash2,
  Edit3,
} from 'lucide-react'
import { cn, formatDueTime, formatRelativeDate, getPriorityColor } from '@/lib/utils'
import { agentTraceLabel, hasAgentTrace } from '@/lib/agent-trace'
import { useTaskStore } from '@/lib/store'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge, TagBadge, PersonBadge } from '@/components/ui/badge'
import type { Task } from '@/lib/database.types'

interface TaskCardProps {
  task: Task
  showReasoning?: string
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  { task, showReasoning },
  ref
) {
  const [showMenu, setShowMenu] = useState(false)
  const { selectTask, updateTask, deleteTask } = useTaskStore()

  const handleComplete = () => {
    updateTask(task.id, {
      status: task.status === 'done' ? 'todo' : 'done',
    })
  }

  const handleClick = (e: React.MouseEvent) => {
    // Don't open detail if clicking checkbox or menu
    if ((e.target as HTMLElement).closest('.no-detail-trigger')) {
      return
    }
    selectTask(task)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteTask(task.id)
    setShowMenu(false)
  }

  const isExecutable = ['research', 'draft', 'prep'].includes(task.action_type)
  const isDone = task.status === 'done'
  const showAgentTrace = hasAgentTrace(task)
  const agentLabel = agentTraceLabel(task, 20)

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'group relative bg-zinc-900/50 border border-zinc-800 rounded-lg',
        'cursor-pointer transition-all duration-200',
        'hover:bg-zinc-800/50 hover:border-zinc-700',
        getPriorityColor(task.priority),
        isDone && 'opacity-60'
      )}
      onClick={handleClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="no-detail-trigger pt-0.5">
            <Checkbox
              checked={isDone}
              onChange={handleComplete}
              aria-label={
                isDone
                  ? `Mark "${task.title}" active`
                  : `Mark "${task.title}" complete`
              }
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3
              className={cn(
                'text-sm font-medium text-zinc-100 mb-1',
                isDone && 'line-through text-zinc-500'
              )}
            >
              {task.title}
            </h3>

            {/* Context */}
            {task.context && (
              <p className="text-xs text-zinc-500 mb-2 line-clamp-1">
                {task.context}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Due date */}
              {task.due_date && (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatRelativeDate(task.due_date)}
                    {task.due_time ? ` at ${formatDueTime(task.due_time)}` : ''}
                  </span>
                </div>
              )}

              {/* Estimated time */}
              {task.estimated_minutes && (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  <span>{task.estimated_minutes}m</span>
                </div>
              )}

              {/* People */}
              {task.people && task.people.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-zinc-500" />
                  {task.people.slice(0, 2).map((person) => (
                    <PersonBadge key={person} name={person} />
                  ))}
                  {task.people.length > 2 && (
                    <span className="text-xs text-zinc-500">
                      +{task.people.length - 2}
                    </span>
                  )}
                </div>
              )}

              {/* Executable badge */}
              {isExecutable && (
                <Badge variant="action" action={task.action_type}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  {task.action_type}
                </Badge>
              )}

              {showAgentTrace && (
                <span
                  className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-300"
                  title={
                    task.source_agent_id
                      ? `Source agent: ${task.source_agent_id}`
                      : 'Created or updated by an external agent'
                  }
                >
                  <Bot className="mr-1 h-3 w-3" />
                  {agentLabel}
                </span>
              )}
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {task.tags.slice(0, 3).map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
                {task.tags.length > 3 && (
                  <span className="text-xs text-zinc-500">
                    +{task.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* AI Reasoning */}
            {showReasoning && (
              <p className="text-xs text-accent/70 mt-2 italic">
                Why now: {showReasoning}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="no-detail-trigger flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isExecutable && !isDone && (
              <button
                className="p-1.5 hover:bg-zinc-700 rounded-md transition-colors"
                title="Run agent"
                aria-label={`Run agent for "${task.title}"`}
                onClick={(e) => {
                  e.stopPropagation()
                  selectTask(task)
                }}
              >
                <Play className="h-4 w-4 text-accent" />
              </button>
            )}

            <div className="relative">
              <button
                className="p-1.5 hover:bg-zinc-700 rounded-md transition-colors"
                aria-label={`Open task menu for "${task.title}"`}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
              >
                <MoreHorizontal className="h-4 w-4 text-zinc-400" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1">
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        selectTask(task)
                        setShowMenu(false)
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
})

TaskCard.displayName = 'TaskCard'
