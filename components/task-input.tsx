'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, Loader2, Command } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { parseTaskHeuristic } from '@/lib/task-intelligence'
import type { Task, ParsedTask } from '@/lib/database.types'

interface TaskInputProps {
  onTaskCreated?: (task: Task) => void
}

export function TaskInput({ onTaskCreated }: TaskInputProps) {
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { addTask } = useTaskStore()
  const toast = useToast()

  // Global keyboard shortcut: Cmd+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    const rawInput = input.trim()
    setIsProcessing(true)
    setInput('')

    try {
      // Check for quick mode: /quick prefix
      const isQuickMode = rawInput.startsWith('/quick ')
      const taskInput = isQuickMode ? rawInput.slice(7) : rawInput
      const supabase = createClient()

      let parsedTask: ParsedTask

      if (isQuickMode) {
        // Quick mode: skip AI parsing
        parsedTask = {
          title: taskInput,
          due_date: null,
          priority: 'medium',
          context: null,
          people: [],
          tags: [],
          action_type: 'manual',
          estimated_minutes: null,
          energy_level: null,
        }
      } else if (!supabase) {
        parsedTask = parseTaskHeuristic(taskInput)
      } else {
        // AI parsing
        const response = await fetch('/api/tasks/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: taskInput }),
        })

        if (!response.ok) {
          // Let the user know AI parsing failed so they aren't confused
          // when a task lands without a due date / people / tags.
          const payload = await response.json().catch(() => ({}))
          if (response.status === 429) {
            toast.error(
              'AI parsing is rate-limited right now.',
              'Your task was saved without AI enrichment.'
            )
          } else if (response.status !== 401) {
            toast.info('AI parsing unavailable', payload?.message || 'Saved your task as-is.')
          }
          parsedTask = parseTaskHeuristic(taskInput)
        } else {
          parsedTask = await response.json()
        }
      }

      // Check if user is authenticated and save to Supabase
      let savedTask: Task | null = null

      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            // Save to Supabase via API
            const saveResponse = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: parsedTask.title,
                raw_input: rawInput,
                priority: parsedTask.priority,
                due_date: parsedTask.due_date,
                context: parsedTask.context,
                source: 'manual',
                action_type: parsedTask.action_type,
                estimated_minutes: parsedTask.estimated_minutes,
                energy_level: parsedTask.energy_level,
                people: parsedTask.people,
                tags: parsedTask.tags,
              }),
            })

            if (saveResponse.ok) {
              savedTask = await saveResponse.json()
            } else if (saveResponse.status === 402) {
              // Quota exhausted — surface an actionable upgrade prompt.
              const payload = await saveResponse.json().catch(() => ({}))
              toast.push({
                kind: 'error',
                title: 'Monthly limit reached',
                message: payload?.message || 'Upgrade to create more tasks.',
                action: { label: 'Upgrade plan', href: '/settings?tab=billing' },
              })
              return
            } else if (saveResponse.status === 400) {
              const payload = await saveResponse.json().catch(() => ({}))
              toast.error(
                'Could not save task',
                payload?.errors?.[0]?.message || payload?.error || 'Validation failed.'
              )
              return
            } else if (saveResponse.status !== 401) {
              toast.error('Could not save task', 'Please try again.')
            }
          }
        } catch (error) {
          console.error('Error saving to Supabase:', error)
          toast.error('Could not save task', 'Check your connection and try again.')
          // Fall through to local creation for demo users.
        }
      }

      // Use saved task from API or create local task for demo mode
      const newTask: Task = savedTask || {
        id: crypto.randomUUID(),
        user_id: 'demo-user',
        title: parsedTask.title,
        raw_input: rawInput,
        description: null,
        status: 'todo',
        priority: parsedTask.priority,
        due_date: parsedTask.due_date,
        due_time: null,
        context: parsedTask.context,
        source: 'manual',
        action_type: parsedTask.action_type,
        estimated_minutes: parsedTask.estimated_minutes,
        energy_level: parsedTask.energy_level,
        people: parsedTask.people,
        tags: parsedTask.tags,
        parent_task_id: null,
        related_task_ids: null,
        agent_output: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source_agent_id: null,
        external_ref: null,
        ingestion_intent: null,
        agent_metadata: null,
      }

      addTask(newTask)
      onTaskCreated?.(newTask)
    } catch (error) {
      console.error('Error creating task:', error)
      // Create a locally parsed task on error so capture still works offline.
      const parsedTask = parseTaskHeuristic(rawInput)
      const fallbackTask: Task = {
        id: crypto.randomUUID(),
        user_id: 'demo-user',
        title: parsedTask.title,
        raw_input: rawInput,
        description: null,
        status: 'todo',
        priority: parsedTask.priority,
        due_date: parsedTask.due_date,
        due_time: null,
        context: parsedTask.context,
        source: 'manual',
        action_type: parsedTask.action_type,
        estimated_minutes: parsedTask.estimated_minutes,
        energy_level: parsedTask.energy_level,
        people: parsedTask.people,
        tags: parsedTask.tags,
        parent_task_id: null,
        related_task_ids: null,
        agent_output: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source_agent_id: null,
        external_ref: null,
        ingestion_intent: null,
        agent_metadata: null,
      }
      addTask(fallbackTask)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={cn(
          'relative rounded-xl transition-all duration-200',
          isFocused && 'ring-2 ring-accent/50'
        )}
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Loader2 className="h-5 w-5 text-accent animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key="plus"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Plus className="h-5 w-5 text-zinc-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="What needs to get done? Be specific..."
          className={cn(
            'w-full bg-zinc-900 border border-zinc-800 rounded-xl',
            'pl-12 pr-24 py-4',
            'text-zinc-100 placeholder:text-zinc-500',
            'focus:outline-none transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          disabled={isProcessing}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Keyboard shortcut hint */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-500">
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">
              <Command className="h-3 w-3 inline" />
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">K</kbd>
          </div>

          {/* AI badge */}
          {input.trim() && !input.startsWith('/quick') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 px-2 py-1 bg-accent/10 rounded-md"
            >
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="text-xs text-accent">AI</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Helper text */}
      <AnimatePresence>
        {isFocused && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-2 text-xs text-zinc-500"
          >
            <span className="text-zinc-400">Tip:</span> Be specific about context,
            deadlines, and people involved. Use{' '}
            <code className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">
              /quick
            </code>{' '}
            for instant add without AI.
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  )
}
