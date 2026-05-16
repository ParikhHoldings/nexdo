'use client'

import { create } from 'zustand'
import type { Task, Profile, BriefingContent, TaskUpdate } from './database.types'
import { persistDemoTasks } from './tasks'

interface TaskState {
  tasks: Task[]
  selectedTask: Task | null
  isDetailOpen: boolean
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean

  // Actions
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: TaskUpdate, options?: { persist?: boolean }) => void
  deleteTask: (id: string) => void
  selectTask: (task: Task | null) => void
  openDetail: () => void
  closeDetail: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setAuthenticated: (val: boolean) => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTask: null,
  isDetailOpen: false,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => {
    const { tasks, isAuthenticated } = get()
    const nextTasks = [task, ...tasks]
    set({ tasks: nextTasks })
    if (!isAuthenticated) persistDemoTasks(nextTasks)
  },

  updateTask: (id, updates, options) => {
    const state = get()
    const originalTask = state.tasks.find((task) => task.id === id)
    if (!originalTask) {
      set({ error: 'Task not found.' })
      return
    }

    const updatedAt = new Date().toISOString()
    const applyUpdates = (task: Task): Task => ({
      ...task,
      ...updates,
      updated_at: updatedAt,
      completed_at:
        updates.completed_at !== undefined
          ? updates.completed_at
          : updates.status === 'done' && !task.completed_at
            ? updatedAt
            : updates.status !== undefined && updates.status !== 'done'
              ? null
              : task.completed_at,
    })

    const nextTasks = state.tasks.map((t) => (t.id === id ? applyUpdates(t) : t))
    const nextSelectedTask =
      state.selectedTask?.id === id
        ? applyUpdates(state.selectedTask)
        : state.selectedTask

    // Optimistic update
    set({
      tasks: nextTasks,
      selectedTask: nextSelectedTask,
    })

    // Persist to Supabase if authenticated
    const { isAuthenticated } = state
    if (!isAuthenticated) {
      persistDemoTasks(nextTasks)
    } else if (options?.persist !== false) {
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Task update failed')
          }

          const savedTask = (await response.json()) as Task
          set((current) => ({
            tasks: current.tasks.map((task) =>
              task.id === id ? savedTask : task
            ),
            selectedTask:
              current.selectedTask?.id === id ? savedTask : current.selectedTask,
          }))
        })
        .catch((error) => {
          console.error('Error updating task:', error)
          set((current) => ({
            tasks: current.tasks.map((task) =>
              task.id === id ? originalTask : task
            ),
            selectedTask:
              current.selectedTask?.id === id
                ? originalTask
                : current.selectedTask,
            error: 'Could not save task changes. The previous task state was restored.',
          }))
        })
    }
  },

  deleteTask: (id) => {
    const state = get()
    const originalIndex = state.tasks.findIndex((t) => t.id === id)
    const originalTask = state.tasks[originalIndex]
    if (!originalTask) {
      set({ error: 'Task not found.' })
      return
    }

    const nextTasks = state.tasks.filter((t) => t.id !== id)

    // Optimistic update
    set({
      tasks: nextTasks,
      selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
      isDetailOpen: state.selectedTask?.id === id ? false : state.isDetailOpen,
    })

    // Persist to Supabase if authenticated
    const { isAuthenticated } = state
    if (!isAuthenticated) {
      persistDemoTasks(nextTasks)
    } else {
      fetch(`/api/tasks/${id}`, { method: 'DELETE' })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Task delete failed')
          }
        })
        .catch((error) => {
          console.error('Error deleting task:', error)
          set((current) => {
            const taskExists = current.tasks.some((task) => task.id === id)
            const restoredTasks = taskExists
              ? current.tasks
              : [
                  ...current.tasks.slice(0, originalIndex),
                  originalTask,
                  ...current.tasks.slice(originalIndex),
                ]

            return {
              tasks: restoredTasks,
              error: 'Could not delete task. The task was restored.',
            }
          })
        })
    }
  },

  selectTask: (task) => set({ selectedTask: task, isDetailOpen: !!task }),

  openDetail: () => set({ isDetailOpen: true }),

  closeDetail: () => set({ isDetailOpen: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setAuthenticated: (val) => set({ isAuthenticated: val }),
}))

interface UserState {
  profile: Profile | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setProfile: (profile: Profile | null) => void
  setAuthenticated: (auth: boolean) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isAuthenticated: false,
  isLoading: true,

  setProfile: (profile) =>
    set({ profile, isAuthenticated: !!profile && profile.id !== 'demo-user' }),

  setAuthenticated: (auth) => set({ isAuthenticated: auth }),

  setLoading: (loading) => set({ isLoading: loading }),

  logout: () => set({ profile: null, isAuthenticated: false }),
}))

interface BriefingState {
  briefing: BriefingContent | null
  isLoading: boolean
  isDismissed: boolean

  // Actions
  setBriefing: (briefing: BriefingContent | null) => void
  setLoading: (loading: boolean) => void
  dismiss: () => void
  reset: () => void
}

export const useBriefingStore = create<BriefingState>((set) => ({
  briefing: null,
  isLoading: false,
  isDismissed: false,

  setBriefing: (briefing) => set({ briefing }),

  setLoading: (loading) => set({ isLoading: loading }),

  dismiss: () => set({ isDismissed: true }),

  reset: () => set({ briefing: null, isDismissed: false }),
}))

interface UIState {
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  commandBarOpen: boolean

  // Actions
  toggleTheme: () => void
  setTheme: (theme: 'dark' | 'light') => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openCommandBar: () => void
  closeCommandBar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  sidebarCollapsed: true,
  commandBarOpen: false,

  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'dark' ? 'light' : 'dark',
    })),

  setTheme: (theme) => set({ theme }),

  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  openCommandBar: () => set({ commandBarOpen: true }),

  closeCommandBar: () => set({ commandBarOpen: false }),
}))
