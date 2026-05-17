'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Inbox } from 'lucide-react'
import { TaskInput } from '@/components/task-input'
import { TaskCard } from '@/components/task-card'
import { DailyBriefing } from '@/components/daily-briefing'
import { TaskListSkeleton } from '@/components/ui/skeleton'
import { useTaskStore, useUserStore } from '@/lib/store'
import { prioritizeTasksHeuristic } from '@/lib/task-intelligence'
import { getLocalDateKey } from '@/lib/dates'
import type { PrioritizedTask } from '@/lib/database.types'

export default function TodayPage() {
  const { tasks, isLoading, isAuthenticated } = useTaskStore()
  const { profile } = useUserStore()
  const [prioritization, setPrioritization] = useState<PrioritizedTask[]>([])
  const [isPrioritizing, setIsPrioritizing] = useState(false)

  // Filter for today's tasks and incomplete tasks
  const today = getLocalDateKey()
  const todayTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== 'done' &&
          t.status !== 'cancelled' &&
          (t.due_date === today || !t.due_date)
      ),
    [tasks, today]
  )

  // Fetch prioritization
  useEffect(() => {
    const fetchPrioritization = async () => {
      if (todayTasks.length === 0) {
        setPrioritization([])
        return
      }

      if (!isAuthenticated) {
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

        if (response.ok) {
          const data = await response.json()
          setPrioritization(data.tasks || data)
        } else {
          setPrioritization(prioritizeTasksHeuristic(todayTasks))
        }
      } catch (error) {
        console.error('Failed to prioritize tasks:', error)
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
              Add a task above or let your AI agents do the work.
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
