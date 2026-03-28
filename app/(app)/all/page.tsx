'use client'

import { useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Inbox, Search, Filter, SortAsc } from 'lucide-react'
import { TaskInput } from '@/components/task-input'
import { TaskCard } from '@/components/task-card'
import { TaskListSkeleton } from '@/components/ui/skeleton'
import { useTaskStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { TaskPriority, TaskStatus } from '@/lib/database.types'

type SortOption = 'created' | 'due_date' | 'priority' | 'title'

const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export default function AllTasksPage() {
  const { tasks, isLoading } = useTaskStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('created')
  const [showFilters, setShowFilters] = useState(false)

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.context?.toLowerCase().includes(searchLower) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter)
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [tasks, search, statusFilter, priorityFilter, sortBy])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold text-zinc-100">All Tasks</h1>
        </div>
        <p className="text-zinc-500 mt-1">
          {tasks.filter((t) => t.status !== 'done').length} active tasks
        </p>
      </header>

      {/* Task Input */}
      <div className="mb-6">
        <TaskInput />
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
              showFilters
                ? 'bg-accent/10 text-accent'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <SortAsc className="h-4 w-4" />
            Sort: {sortBy.replace('_', ' ')}
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
            {/* Status filter */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {['all', 'todo', 'in_progress', 'waiting'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status as TaskStatus | 'all')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors',
                      statusFilter === status
                        ? 'bg-accent text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {status === 'all' ? 'All' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority filter */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">Priority</label>
              <div className="flex flex-wrap gap-2">
                {['all', 'urgent', 'high', 'medium', 'low'].map((priority) => (
                  <button
                    key={priority}
                    onClick={() => setPriorityFilter(priority as TaskPriority | 'all')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors',
                      priorityFilter === priority
                        ? 'bg-accent text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {priority === 'all' ? 'All' : priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort options */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">Sort by</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'created', label: 'Created' },
                  { key: 'due_date', label: 'Due date' },
                  { key: 'priority', label: 'Priority' },
                  { key: 'title', label: 'Title' },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setSortBy(option.key as SortOption)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors',
                      sortBy === option.key
                        ? 'bg-accent text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {isLoading ? (
          <TaskListSkeleton count={5} />
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-2">
              {search || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No matching tasks'
                : 'No tasks yet'}
            </h3>
            <p className="text-zinc-500 max-w-sm mx-auto">
              {search || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first task above'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Results count */}
      {filteredTasks.length > 0 && (
        <p className="text-center text-sm text-zinc-500 mt-6">
          Showing {filteredTasks.length} task{filteredTasks.length !== 1 && 's'}
          {(search || statusFilter !== 'all' || priorityFilter !== 'all') &&
            ` (filtered from ${tasks.filter((t) => t.status !== 'done').length})`}
        </p>
      )}
    </div>
  )
}
