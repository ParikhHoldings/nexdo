'use client'

import { useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Inbox, Search, Filter, SortAsc } from 'lucide-react'
import { TaskInput } from '@/components/task-input'
import { TaskCard } from '@/components/task-card'
import { TaskListSkeleton } from '@/components/ui/skeleton'
import { useTaskStore } from '@/lib/store'
import { taskMatchesSearch } from '@/lib/task-search'
import { hasAgentTrace } from '@/lib/agent-trace'
import { agentOutputReviewStatus } from '@/lib/agent-output'
import { cn } from '@/lib/utils'
import type { TaskPriority, TaskStatus } from '@/lib/database.types'

type SortOption = 'created' | 'due_date' | 'priority' | 'title'
type OriginFilter = 'all' | 'human' | 'agent'
type ReviewFilter = 'all' | 'needs_review' | 'verified'

const activeStatuses: TaskStatus[] = ['todo', 'in_progress', 'waiting']
const statusFilters: Array<TaskStatus | 'all'> = [
  'all',
  'todo',
  'in_progress',
  'waiting',
  'done',
  'cancelled',
]
const originFilters: Array<{ key: OriginFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'human', label: 'Human' },
  { key: 'agent', label: 'Agent' },
]
const reviewFilters: Array<{ key: ReviewFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'verified', label: 'Verified' },
]

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
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('created')
  const [showFilters, setShowFilters] = useState(false)

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result =
      statusFilter === 'all'
        ? tasks.filter((t) => activeStatuses.includes(t.status))
        : tasks.filter((t) => t.status === statusFilter)

    // Search filter
    if (search) {
      result = result.filter((task) => taskMatchesSearch(task, search))
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter)
    }

    if (originFilter !== 'all') {
      result = result.filter((task) => {
        const isAgentOrigin = hasAgentTrace(task)
        return originFilter === 'agent' ? isAgentOrigin : !isAgentOrigin
      })
    }

    if (reviewFilter !== 'all') {
      result = result.filter((task) => {
        const reviewStatus = agentOutputReviewStatus(
          task.agent_output,
          task.action_type
        )

        if (reviewFilter === 'verified') return reviewStatus === 'verified'
        return (
          reviewStatus === 'unreviewed' ||
          reviewStatus === 'needs_revision'
        )
      })
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
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
  }, [
    tasks,
    search,
    statusFilter,
    priorityFilter,
    originFilter,
    reviewFilter,
    sortBy,
  ])

  const activeTaskCount = tasks.filter((t) => activeStatuses.includes(t.status)).length
  const baseResultCount =
    statusFilter === 'all'
      ? activeTaskCount
      : tasks.filter((t) => t.status === statusFilter).length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold text-zinc-100">All Tasks</h1>
        </div>
        <p className="text-zinc-500 mt-1">
          {activeTaskCount} active task{activeTaskCount !== 1 && 's'}
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
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Status filter"
              >
                {statusFilters.map((status) => (
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

            {/* Origin filter */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">Origin</label>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Origin filter"
              >
                {originFilters.map((origin) => (
                  <button
                    key={origin.key}
                    onClick={() => setOriginFilter(origin.key)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors',
                      originFilter === origin.key
                        ? 'bg-accent text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {origin.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Review filter */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">
                Agent output review
              </label>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Agent output review filter"
              >
                {reviewFilters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setReviewFilter(filter.key)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors',
                      reviewFilter === filter.key
                        ? 'bg-accent text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {filter.label}
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
              {search ||
              statusFilter !== 'all' ||
              priorityFilter !== 'all' ||
              originFilter !== 'all' ||
              reviewFilter !== 'all'
                ? 'No matching tasks'
                : 'No tasks yet'}
            </h3>
            <p className="text-zinc-500 max-w-sm mx-auto">
              {search ||
              statusFilter !== 'all' ||
              priorityFilter !== 'all' ||
              originFilter !== 'all' ||
              reviewFilter !== 'all'
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
          {(search ||
            statusFilter !== 'all' ||
            priorityFilter !== 'all' ||
            originFilter !== 'all' ||
            reviewFilter !== 'all') &&
            ` (filtered from ${baseResultCount})`}
        </p>
      )}
    </div>
  )
}
