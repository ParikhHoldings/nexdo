'use client'

import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Calendar, Inbox } from 'lucide-react'
import { TaskInput } from '@/components/task-input'
import { TaskCard } from '@/components/task-card'
import { TaskListSkeleton } from '@/components/ui/skeleton'
import { useTaskStore } from '@/lib/store'
import { format, addDays, isSameDay, parseISO, isAfter } from 'date-fns'

export default function UpcomingPage() {
  const { tasks, isLoading } = useTaskStore()

  // Get upcoming tasks (due in the future, not done)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingTasks = tasks.filter((t) => {
    if (t.status === 'done' || t.status === 'cancelled') return false
    if (!t.due_date) return false
    const dueDate = parseISO(t.due_date)
    return isAfter(dueDate, today)
  })

  // Group by date
  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof upcomingTasks> = {}

    // Create date buckets for the next 7 days
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i)
      const key = format(date, 'yyyy-MM-dd')
      groups[key] = []
    }

    // Add "Later" bucket
    groups['later'] = []

    // Sort tasks into buckets
    upcomingTasks.forEach((task) => {
      if (!task.due_date) return

      const dueDate = parseISO(task.due_date)
      const daysDiff = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysDiff <= 7) {
        const key = format(dueDate, 'yyyy-MM-dd')
        if (groups[key]) {
          groups[key].push(task)
        }
      } else {
        groups['later'].push(task)
      }
    })

    return groups
  }, [upcomingTasks])

  // Get formatted date label
  const getDateLabel = (dateStr: string): string => {
    if (dateStr === 'later') return 'Later'

    const date = parseISO(dateStr)
    const tomorrow = addDays(today, 1)

    if (isSameDay(date, tomorrow)) {
      return 'Tomorrow'
    }

    return format(date, 'EEEE, MMMM d')
  }

  // Filter out empty date groups
  const nonEmptyGroups = Object.entries(groupedTasks).filter(
    ([_, tasks]) => tasks.length > 0
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold text-zinc-100">Upcoming</h1>
        </div>
        <p className="text-zinc-500 mt-1">Tasks scheduled for the coming days</p>
      </header>

      {/* Task Input */}
      <div className="mb-8">
        <TaskInput />
      </div>

      {/* Task List by Date */}
      {isLoading ? (
        <TaskListSkeleton count={5} />
      ) : nonEmptyGroups.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">
            Nothing upcoming
          </h3>
          <p className="text-zinc-500 max-w-sm mx-auto">
            No tasks scheduled for the future. Add a task with a due date to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {nonEmptyGroups.map(([dateStr, dateTasks]) => (
            <div key={dateStr}>
              <h2 className="text-sm font-medium text-zinc-400 mb-3 sticky top-0 bg-zinc-950 py-2">
                {getDateLabel(dateStr)}
                <span className="ml-2 text-zinc-600">
                  ({dateTasks.length})
                </span>
              </h2>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {dateTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task count */}
      {upcomingTasks.length > 0 && (
        <p className="text-center text-sm text-zinc-500 mt-8">
          {upcomingTasks.length} upcoming task{upcomingTasks.length !== 1 && 's'}
        </p>
      )}
    </div>
  )
}
