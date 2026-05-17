'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AlertTriangle, Inbox } from 'lucide-react'
import { TaskInput } from '@/components/task-input'
import { TaskCard } from '@/components/task-card'
import { DailyBriefing } from '@/components/daily-briefing'
import { TaskListSkeleton } from '@/components/ui/skeleton'
import { useTaskStore, useUserStore } from '@/lib/store'
import { prioritizeTasksHeuristic } from '@/lib/task-intelligence'
import { isTodayFocusTask } from '@/lib/task-filters'
import { getLocalDateKey } from '@/lib/dates'
import type { PrioritizedTask } from '@/lib/database.types'

export default function TodayPage() {
  const { tasks, isLoading, isAuthenticated } = useTaskStore()
  const { profile } = useUserStore()
  const [prioritization, setPrioritization] = useState<PrioritizedTask[]>([])
  const [isPrioritizing, setIsPrioritizing] = useState(false)
  const [prioritizationNotice, setPrioritizationNotice] = useState<string | null>(null)

  // Filter for today's tasks and incomplete tasks
  const today = getLocalDateKey()
  const todayTasks = useMemo(
    () => tasks.filter((task) => isTodayFocusTask(task, today)),
    [tasks, today]
  )

  // Fetch prioritization
  useEffect(() => {
    const fetchPrioritization = async () => {
      if (todayTasks.length === 0) {
        setPrioritization([])
        setPrioritizationNotice(null)
        return
      }

      if (!isAuthenticated) {
        setPrioritizationNotice(null)
        setPrioritization(prioritizeTasksHeuristic(todayTasks))
        return
      }

      setIsPrioritizing(true)
      try {
        const response = await fetch('/api/tasks/prioritize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: todayTasks }),
        })

        const payload = await response.json().catch(() => ({}))

        if (response.ok) {
          setPrioritizationNotice(null)
          setPrioritization(payload.tasks || payload)
        } else {
          setPrioritizationNotice(
            `Using local priority order: ${
              payload?.message ||
              payload?.error ||
              'AI prioritization is unavailable.'
            }`
          )
          setPrioritization(prioritizeTasksHeuristic(todayTasks))
        }
      } catch (error) {
        console.error('Failed to prioritize tasks:', error)
        setPrioritizationNotice('Using local priority order: AI prioritization is unavailable.')
        setPrioritization(prioritizeTasksHeuristic(todayTasks))
      } finally {
        setIsPrioritizing(false)
      }
    }

    fetchPrioritization()
  }, [isAuthenticated, todayTasks])

  // Sort tasks by prioritization rank
  const sortedTasks = [...todayTasks].sort((a, b) => {
    const aRank = prioritization.find((p) => p.task_id === a.id)?.rank ?? 999
    const bRank = prioritization.find((p) => p.task_id === b.id)?.rank ?? 999
    return aRank - bRank
  })

  // Get reasoning for a task
  const getReasoning = (taskId: string): string | undefined => {
    return prioritization.find((p) => p.task_id === taskId)?.reasoning
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Today</h1>
        <p className="text-zinc-500 mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      {/* Daily Briefing */}
      <div className="mb-6">
        <DailyBriefing userName={profile?.full_name?.split(' ')[0]} />
      </div>

      {/* Task Input */}
      <div className="mb-8">
        <TaskInput />
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {prioritizationNotice && !isPrioritizing && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{prioritizationNotice}</span>
          </div>
        )}
        {isLoading || isPrioritizing ? (
          <TaskListSkeleton count={5} />
        ) : sortedTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-2">
              Your day is clear
            </h3>
            <p className="text-zinc-500 max-w-sm mx-auto">
              Add a task above, import existing work, or connect a scoped agent from settings.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showReasoning={getReasoning(task.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Task count */}
      {sortedTasks.length > 0 && (
        <p className="text-center text-sm text-zinc-500 mt-6">
          {sortedTasks.length} task{sortedTasks.length !== 1 && 's'} for today
        </p>
      )}
    </div>
  )
}
