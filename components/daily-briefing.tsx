'use client'

import { useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun,
  Sparkles,
  Clock,
  AlertTriangle,
  Users,
  ChevronUp,
} from 'lucide-react'
import { useBriefingStore, useTaskStore } from '@/lib/store'
import { BriefingSkeleton } from '@/components/ui/skeleton'
import { getGreeting } from '@/lib/utils'
import { generateBriefingHeuristic } from '@/lib/task-intelligence'
import type { BriefingContent, Task } from '@/lib/database.types'

interface DailyBriefingProps {
  userName?: string
}

function getBriefingSignature(tasks: Task[], userName: string): string {
  return JSON.stringify({
    userName,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      estimated_minutes: task.estimated_minutes,
      people: task.people,
      updated_at: task.updated_at,
    })),
  })
}

export function DailyBriefing({ userName = 'there' }: DailyBriefingProps) {
  const { briefing, isLoading, isDismissed, setBriefing, setLoading, dismiss } =
    useBriefingStore()
  const { tasks, selectTask, isAuthenticated } = useTaskStore()
  const briefingSignature = useMemo(
    () => getBriefingSignature(tasks, userName),
    [tasks, userName]
  )
  const lastFetchedSignature = useRef<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      lastFetchedSignature.current = null
      return
    }
    if (isDismissed) return

    setBriefing(
      tasks.length > 0 ? generateBriefingHeuristic(tasks, userName) : null
    )
  }, [isAuthenticated, isDismissed, setBriefing, tasks, userName])

  useEffect(() => {
    if (!isAuthenticated) return
    if (isDismissed) return

    if (tasks.length === 0) {
      lastFetchedSignature.current = null
      setBriefing(null)
      return
    }

    if (lastFetchedSignature.current === briefingSignature) return

    const fetchBriefing = async () => {
      lastFetchedSignature.current = briefingSignature
      setLoading(true)
      try {
        const response = await fetch('/api/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks, userName }),
        })

        if (response.ok) {
          const data = await response.json()
          setBriefing(data)
        } else {
          setBriefing(generateBriefingHeuristic(tasks, userName))
        }
      } catch (error) {
        console.error('Failed to fetch briefing:', error)
        setBriefing(generateBriefingHeuristic(tasks, userName))
      } finally {
        setLoading(false)
      }
    }

    fetchBriefing()
  }, [
    briefingSignature,
    isAuthenticated,
    isDismissed,
    setBriefing,
    setLoading,
    tasks,
    userName,
  ])

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      selectTask(task)
    }
  }

  if (isDismissed) return null

  if (isLoading) {
    return <BriefingSkeleton />
  }

  if (!briefing) {
    // Show a simple greeting when no briefing is available
    return (
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Sun className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {getGreeting()}, {userName}!
            </h2>
            <p className="text-sm text-zinc-400">
              {tasks.length === 0
                ? "Add your first task to get started."
                : `You have ${tasks.filter((t) => t.status !== 'done').length} tasks to focus on.`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                {briefing.greeting}
              </h2>
              <p className="text-sm text-zinc-400">{briefing.summary}</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <ChevronUp className="h-5 w-5 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Content grid */}
      <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Priorities */}
        {briefing.top_priorities.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Top Priorities
            </h3>
            <div className="space-y-2">
              {briefing.top_priorities.map((item) => (
                <button
                  key={item.task_id}
                  onClick={() => handleTaskClick(item.task_id)}
                  className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 rounded-lg p-3 transition-colors"
                >
                  <p className="text-sm text-zinc-200 font-medium">
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">{item.reasoning}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Wins */}
        {briefing.quick_wins.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Quick Wins
            </h3>
            <div className="space-y-2">
              {briefing.quick_wins.map((item) => (
                <button
                  key={item.task_id}
                  onClick={() => handleTaskClick(item.task_id)}
                  className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 rounded-lg p-3 transition-colors flex items-center justify-between"
                >
                  <p className="text-sm text-zinc-200">{item.title}</p>
                  <span className="text-xs text-zinc-500">
                    {item.estimated_minutes}m
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overdue */}
        {briefing.overdue.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue
            </h3>
            <div className="space-y-2">
              {briefing.overdue.map((item) => (
                <button
                  key={item.task_id}
                  onClick={() => handleTaskClick(item.task_id)}
                  className="w-full text-left bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg p-3 transition-colors"
                >
                  <p className="text-sm text-zinc-200">{item.title}</p>
                  <p className="text-xs text-red-400 mt-1">
                    {item.days_overdue} day{item.days_overdue > 1 ? 's' : ''} overdue
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Someone Waiting */}
        {briefing.someone_waiting.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Someone&apos;s Waiting
            </h3>
            <div className="space-y-2">
              {briefing.someone_waiting.map((item) => (
                <button
                  key={item.task_id}
                  onClick={() => handleTaskClick(item.task_id)}
                  className="w-full text-left bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg p-3 transition-colors"
                >
                  <p className="text-sm text-zinc-200">{item.title}</p>
                  <p className="text-xs text-amber-400 mt-1">
                    {item.person} is waiting
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
