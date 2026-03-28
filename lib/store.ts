'use client'

import { create } from 'zustand'
import type { Task, Profile, BriefingContent, TaskUpdate } from './database.types'

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
  updateTask: (id: string, updates: TaskUpdate) => void
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

  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks],
    })),

  updateTask: (id, updates) => {
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              updated_at: new Date().toISOString(),
              completed_at:
                updates.status === 'done' && !t.completed_at
                  ? new Date().toISOString()
                  : updates.status !== 'done'
                    ? null
                    : t.completed_at,
            }
          : t
      ),
      selectedTask:
        state.selectedTask?.id === id
          ? { ...state.selectedTask, ...updates }
          : state.selectedTask,
    }))

    // Persist to Supabase if authenticated
    const { isAuthenticated } = get()
    if (isAuthenticated) {
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch(console.error)
    }
  },

  deleteTask: (id) => {
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
      isDetailOpen: state.selectedTask?.id === id ? false : state.isDetailOpen,
    }))

    // Persist to Supabase if authenticated
    const { isAuthenticated } = get()
    if (isAuthenticated) {
      fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(console.error)
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

  setProfile: (profile) => set({ profile, isAuthenticated: !!profile }),

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
  sidebarCollapsed: false,
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
