'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CheckCircle2, Trash2, AlertTriangle } from 'lucide-react'
import { TaskCard } from '@/components/task-card'
import { TaskListSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useTaskStore } from '@/lib/store'
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns'

export default function DonePage() {
  const { tasks, isLoading, setTasks, isAuthenticated } = useTaskStore()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const toast = useToast()

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

  /**
   * Deletes every completed task. We persist to the API when the user is
   * logged in so the data actually goes away — the previous implementation
   * only mutated local state, which silently reappeared on reload.
   */
  const handleClearCompleted = async () => {
    setClearing(true)
    const toDelete = completedTasks.slice()
    const activeTasks = tasks.filter((t) => t.status !== 'done')

    // Optimistic update for snappy UI.
    setTasks(activeTasks)

    if (isAuthenticated) {
      const results = await Promise.allSettled(
        toDelete.map((t) =>
          fetch(`/api/tasks/${t.id}`, { method: 'DELETE' }).then((r) => {
            if (!r.ok) throw new Error(`Failed to delete ${t.id}`)
          })
        )
      )
      const failures = results.filter((r) => r.status === 'rejected').length
      if (failures > 0) {
        toast.error(
          `${failures} task${failures === 1 ? '' : 's'} could not be deleted`,
          'They will reappear on refresh. Please try again.'
        )
      } else {
        toast.success(`Cleared ${toDelete.length} completed task${toDelete.length === 1 ? '' : 's'}`)
      }
    } else {
      toast.success('Cleared completed tasks')
    }

    setClearing(false)
    setConfirmOpen(false)
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
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
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

      {/* Confirm modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !clearing && setConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-done-title"
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 id="clear-done-title" className="text-lg font-semibold text-zinc-100">
                  Clear {completedTasks.length} completed task
                  {completedTasks.length === 1 ? '' : 's'}?
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  This permanently deletes all of your done tasks. This action can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={clearing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleClearCompleted}
                disabled={clearing}
              >
                {clearing ? 'Deleting…' : 'Delete all'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
