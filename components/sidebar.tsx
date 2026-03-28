'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Sun,
  Calendar,
  Inbox,
  CheckCircle2,
  Settings,
  LogOut,
  Moon,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, useUserStore, useTaskStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'

const navigation = [
  { name: 'Today', href: '/today', icon: Sun },
  { name: 'Upcoming', href: '/upcoming', icon: Calendar },
  { name: 'All Tasks', href: '/all', icon: Inbox },
  { name: 'Done', href: '/done', icon: CheckCircle2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUIStore()
  const { profile, isAuthenticated } = useUserStore()
  const { tasks } = useTaskStore()

  // Count today's tasks
  const today = new Date().toISOString().split('T')[0]
  const todayCount = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'cancelled' && t.due_date === today
  ).length

  const handleLogout = async () => {
    const supabase = createClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    router.push('/')
  }

  return (
    <>
      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50',
          'w-64 bg-zinc-900 border-r border-zinc-800',
          'flex flex-col h-screen',
          'transform transition-transform duration-200 ease-out',
          sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0',
          sidebarCollapsed && 'lg:w-20'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <Link href="/today" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" />
            {!sidebarCollapsed && (
              <span className="text-xl font-bold tracking-tight">nexdo</span>
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors lg:hidden"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            const showBadge = item.name === 'Today' && todayCount > 0

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 font-medium">{item.name}</span>
                    {showBadge && (
                      <Badge variant="default" className="bg-accent/20 text-accent">
                        {todayCount}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Settings */}
        <div className="p-4 space-y-2 border-t border-zinc-800">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
              pathname === '/settings'
                ? 'bg-accent/10 text-accent'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            )}
          >
            <Settings className="h-5 w-5" />
            {!sidebarCollapsed && <span className="font-medium">Settings</span>}
          </Link>

          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            {!sidebarCollapsed && (
              <span className="font-medium">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
            )}
          </button>
        </div>

        {/* User */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-zinc-300">
                {profile?.full_name?.charAt(0) || 'D'}
              </span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {profile?.full_name || 'Demo User'}
                </p>
                <p className="text-xs text-zinc-500 capitalize">
                  {profile?.subscription_tier || 'free'} plan
                </p>
              </div>
            )}
            {isAuthenticated && !sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4 text-zinc-400" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="fixed bottom-4 left-4 z-40 p-3 bg-accent rounded-full shadow-lg lg:hidden"
      >
        <Menu className="h-6 w-6 text-white" />
      </button>
    </>
  )
}
