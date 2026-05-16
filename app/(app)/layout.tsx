'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { TaskDetail } from '@/components/task-detail'
import { ToastProvider } from '@/components/ui'
import { SidebarSkeleton, TaskListSkeleton } from '@/components/ui/skeleton'
import { useTaskStore, useUserStore } from '@/lib/store'
import { getDemoTasks } from '@/lib/tasks'
import { createClient } from '@/lib/supabase/client'

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

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { setTasks, setAuthenticated } = useTaskStore()
  const { setProfile, setLoading, isLoading } = useUserStore()

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const timezone = detectTimezone()

      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            setAuthenticated(true)

            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()

            if (profile) {
              setProfile(profile)
            }

            const { data: tasks } = await supabase
              .from('tasks')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })

            if (tasks) {
              setTasks(tasks)
            }
          } else {
            // Logged-out visitors see demo data so they can explore the app.
            setAuthenticated(false)
            setTasks(getDemoTasks())
            setProfile({
              id: 'demo-user',
              full_name: 'Demo User',
              timezone,
              work_type: null,
              subscription_tier: 'free',
              stripe_customer_id: null,
              api_key: null,
              api_key_scopes: ['tasks:read', 'tasks:write', 'briefing:read'],
              api_key_last_used_at: null,
              task_count_this_month: 0,
              agent_executions_this_month: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        } catch (error) {
          console.error('Error loading data:', error)
          setAuthenticated(false)
          setTasks(getDemoTasks())
        }
      } else {
        setAuthenticated(false)
        setTasks(getDemoTasks())
        setProfile({
          id: 'demo-user',
          full_name: 'Demo User',
          timezone,
          work_type: null,
          subscription_tier: 'free',
          stripe_customer_id: null,
          api_key: null,
          api_key_scopes: ['tasks:read', 'tasks:write', 'briefing:read'],
          api_key_last_used_at: null,
          task_count_this_month: 0,
          agent_executions_this_month: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      setLoading(false)
    }

    loadData()
  }, [setTasks, setProfile, setLoading, setAuthenticated])

  return (
    <ToastProvider>
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
