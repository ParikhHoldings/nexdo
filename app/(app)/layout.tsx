'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { TaskDetail } from '@/components/task-detail'
import { ToastProvider } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { SidebarSkeleton, TaskListSkeleton } from '@/components/ui/skeleton'
import { ThemeController } from '@/components/theme-controller'
import { TaskNotificationController } from '@/components/task-notification-controller'
import { useTaskStore, useUserStore } from '@/lib/store'
import { getDemoTasks } from '@/lib/tasks'
import { getDemoProfile } from '@/lib/demo-profile'
import { createClient } from '@/lib/supabase/client'
import {
  CLIENT_PROFILE_SELECT,
  createClientProfileFallback,
  toClientProfile,
} from '@/lib/profile'

/**
 * Detects the user's local IANA timezone so demo tasks and briefings
 * don't pretend everyone is in Chicago. Falls back gracefully.
 */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function TaskStoreErrorToast() {
  const { error, setError } = useTaskStore()
  const toast = useToast()

  useEffect(() => {
    if (!error) return
    toast.error(error)
    setError(null)
  }, [error, setError, toast])

  return null
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    setTasks,
    setAuthenticated: setTasksAuthenticated,
    setError,
  } = useTaskStore()
  const {
    setProfile,
    setLoading,
    isLoading,
    setAuthenticated: setUserAuthenticated,
  } = useUserStore()

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const timezone = detectTimezone()

      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            setTasksAuthenticated(true)
            setUserAuthenticated(true)

            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select(CLIENT_PROFILE_SELECT)
              .eq('id', user.id)
              .maybeSingle()

            if (profile) {
              setProfile(toClientProfile(profile))
            } else {
              if (profileError) {
                console.error('Error loading profile:', profileError)
              }
              setProfile(createClientProfileFallback(user, timezone))
              setError(
                profileError
                  ? 'Could not load your profile settings. Some account features may be temporarily unavailable.'
                  : 'Your profile is still being set up. Some account features may be temporarily unavailable.'
              )
            }

            const { data: tasks, error: tasksError } = await supabase
              .from('tasks')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })

            if (tasks) {
              setTasks(tasks)
            } else if (tasksError) {
              console.error('Error loading tasks:', tasksError)
              setTasks([])
              setError('Could not load your tasks. Refresh or try again shortly.')
            }
          } else {
            // Logged-out visitors see demo data so they can explore the app.
            setTasksAuthenticated(false)
            setUserAuthenticated(false)
            setTasks(getDemoTasks())
            setProfile(getDemoProfile(timezone))
          }
        } catch (error) {
          console.error('Error loading data:', error)
          setTasksAuthenticated(false)
          setUserAuthenticated(false)
          setTasks(getDemoTasks())
          setProfile(getDemoProfile(timezone))
        }
      } else {
        setTasksAuthenticated(false)
        setUserAuthenticated(false)
        setTasks(getDemoTasks())
        setProfile(getDemoProfile(timezone))
      }

      setLoading(false)
    }

    loadData()
  }, [
    setTasks,
    setProfile,
    setLoading,
    setTasksAuthenticated,
    setUserAuthenticated,
    setError,
  ])

  return (
    <ToastProvider>
      <ThemeController />
      <TaskNotificationController />
      <TaskStoreErrorToast />
      <div className="flex h-screen bg-zinc-950">
        {isLoading ? <SidebarSkeleton /> : <Sidebar />}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {isLoading ? (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-8 space-y-3">
                  <div className="h-8 w-40 bg-zinc-800/50 rounded-md animate-pulse" />
                  <div className="h-4 w-64 bg-zinc-800/30 rounded-md animate-pulse" />
                </div>
                <TaskListSkeleton count={4} />
              </div>
            ) : (
              children
            )}
          </div>
        </main>
        <TaskDetail />
      </div>
    </ToastProvider>
  )
}
