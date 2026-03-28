'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { TaskDetail } from '@/components/task-detail'
import { useTaskStore, useUserStore } from '@/lib/store'
import { getDemoTasks } from '@/lib/tasks'
import { createClient } from '@/lib/supabase/client'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { setTasks } = useTaskStore()
  const { setProfile, setLoading } = useUserStore()

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()

      if (supabase) {
        // Try to load user profile and tasks from Supabase
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            // Load profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()

            if (profile) {
              setProfile(profile)
            }

            // Load tasks
            const { data: tasks } = await supabase
              .from('tasks')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })

            if (tasks) {
              setTasks(tasks)
            }
          } else {
            // Use demo data if not authenticated
            setTasks(getDemoTasks())
            setProfile({
              id: 'demo-user',
              full_name: 'Demo User',
              timezone: 'America/Chicago',
              work_type: null,
              subscription_tier: 'free',
              stripe_customer_id: null,
              api_key: null,
              task_count_this_month: 0,
              agent_executions_this_month: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        } catch (error) {
          console.error('Error loading data:', error)
          // Fall back to demo data
          setTasks(getDemoTasks())
        }
      } else {
        // Supabase not configured, use demo data
        setTasks(getDemoTasks())
        setProfile({
          id: 'demo-user',
          full_name: 'Demo User',
          timezone: 'America/Chicago',
          work_type: null,
          subscription_tier: 'free',
          stripe_customer_id: null,
          api_key: null,
          task_count_this_month: 0,
          agent_executions_this_month: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      setLoading(false)
    }

    loadData()
  }, [setTasks, setProfile, setLoading])

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">{children}</div>
      </main>
      <TaskDetail />
    </div>
  )
}
