import { getLocalDateKey } from '@/lib/dates'
import type { Task } from '@/lib/database.types'

const UNTIMED_DUE_TIME_RANK = '99:99:99'

export function isActiveTask(task: Task): boolean {
  return task.status !== 'done' && task.status !== 'cancelled'
}

export function isTodayFocusTask(task: Task, today = getLocalDateKey()): boolean {
  return isActiveTask(task) && (task.due_date === today || !task.due_date)
}

export function compareTasksByDueDateTime(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1

  const dateCompare = a.due_date.localeCompare(b.due_date)
  if (dateCompare !== 0) return dateCompare

  return (a.due_time ?? UNTIMED_DUE_TIME_RANK).localeCompare(
    b.due_time ?? UNTIMED_DUE_TIME_RANK
  )
}
