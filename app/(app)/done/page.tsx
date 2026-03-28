'use client'

import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { TaskCard } from '@/components/task-card'
import { TaskListSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/lib/store'
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns'

export default function DonePage() {
  const { tasks, isLoading, setTasks } = useTaskStore()

  // Get completed tasks
  const completedTasks = tasks.filter((t) => t.status === 'done')

  // Group by completion date
  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof completedTasks> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    }

    completedTasks
      .sort(
        (a, b) =>
          new Date(b.completed_at || b.updated_at).getTime() -
          new Date(a.completed_at || a.updated_at).getTime()
      )
      .forEach((task) => {
        const completedDate = parseISO(task.completed_at || task.updated_at)

        if (isToday(completedDate)) {
          groups.today.push(task)
        } else if (isYesterday(completedDate)) {
          groups.yesterday.push(task)
        } else if (isThisWeek(completedDate)) {
          groups.this_week.push(task)
        } else {
          groups.earlier.push(task)
        }
      })

    return groups
  }, [completedTasks])

  const handleClearCompleted = () => {
    const activeTasks = tasks.filter((t) => t.status !== 'done')
    setTasks(activeTasks)
  }

  const groupLabels: Record<string, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    earlier: 'Earlier',
  }

  const nonEmptyGroups = Object.entries(groupedTasks).filter(
    ([_, tasks]) => tasks.length > 0
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold text-zinc-100">Done</h1>
          </div>
          <p className="text-zinc-500 mt-1">
            {completedTasks.length} completed task{completedTasks.length !== 1 && 's'}
          </p>
        </div>

        {completedTasks.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear all
          </Button>
        )}
      </header>

      {/* Task List by Date */}
      {isLoading ? (
        <TaskListSkeleton count={5} />
      ) : nonEmptyGroups.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">
            Nothing completed yet
          </h3>
          <p className="text-zinc-500 max-w-sm mx-auto">
            Completed tasks will appear here. Go crush some tasks!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {nonEmptyGroups.map(([groupKey, groupTasks]) => (
            <div key={groupKey}>
              <h2 className="text-sm font-medium text-zinc-400 mb-3 sticky top-0 bg-zinc-950 py-2">
                {groupLabels[groupKey]}
                <span className="ml-2 text-zinc-600">
                  ({groupTasks.length})
                </span>
              </h2>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {groupTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {completedTasks.length > 0 && (
        <div className="mt-12 p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">
            Completion Stats
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-zinc-100">
                {groupedTasks.today.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Today</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-zinc-100">
                {groupedTasks.today.length + groupedTasks.yesterday.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Last 2 days</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-zinc-100">
                {completedTasks.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">All time</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
