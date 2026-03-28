import { cn } from '@/lib/utils'
import type { TaskPriority, ActionType } from '@/lib/database.types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'outline' | 'priority' | 'action'
  priority?: TaskPriority
  action?: ActionType
  className?: string
}

export function Badge({
  children,
  variant = 'default',
  priority,
  action,
  className,
}: BadgeProps) {
  const priorityStyles: Record<TaskPriority, string> = {
    urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }

  const actionStyles: Record<ActionType, string> = {
    manual: 'bg-zinc-500/10 text-zinc-400',
    research: 'bg-purple-500/10 text-purple-400',
    draft: 'bg-blue-500/10 text-blue-400',
    prep: 'bg-amber-500/10 text-amber-400',
    remind: 'bg-cyan-500/10 text-cyan-400',
  }

  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-300',
    outline: 'border border-zinc-700 text-zinc-400',
    priority: priority ? priorityStyles[priority] : '',
    action: action ? actionStyles[action] : '',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400">
      {tag}
    </span>
  )
}

export function PersonBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent">
      {name}
    </span>
  )
}
