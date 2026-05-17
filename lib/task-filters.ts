import { getLocalDateKey } from '@/lib/dates'
import type { Task } from '@/lib/database.types'

export function isActiveTask(task: Task): boolean {
  return task.status !== 'done' && task.status !== 'cancelled'
}

export function isTodayFocusTask(task: Task, today = getLocalDateKey()): boolean {
  return isActiveTask(task) && (task.due_date === today || !task.due_date)
}
