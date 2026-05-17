import type { Task } from './database.types'
import { getLocalDateKey } from './dates'

export { getLocalDateKey }

export type BrowserNotificationPermission =
  | NotificationPermission
  | 'unsupported'

export const BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY =
  'nexdo_browser_notifications_enabled'

const NOTIFIED_TASKS_STORAGE_PREFIX = 'nexdo_notified_due_tasks'
const ACTIVE_STATUSES = new Set(['todo', 'in_progress', 'waiting'])
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

function canUseLocalStorage() {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.localStorage)
  } catch {
    return false
  }
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return window.Notification.permission
}

export function getStoredBrowserNotificationsEnabled() {
  if (!canUseLocalStorage()) return false
  return window.localStorage.getItem(BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY) === 'true'
}

export function persistBrowserNotificationsEnabled(enabled: boolean) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(
    BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY,
    String(enabled)
  )
}

function notifiedStorageKey(dateKey: string) {
  return `${NOTIFIED_TASKS_STORAGE_PREFIX}_${dateKey}`
}

export function getStoredNotifiedTaskIds(dateKey = getLocalDateKey()) {
  if (!canUseLocalStorage()) return new Set<string>()

  try {
    const raw = window.localStorage.getItem(notifiedStorageKey(dateKey))
    const ids = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

export function markTaskNotificationSent(taskId: string, dateKey = getLocalDateKey()) {
  if (!canUseLocalStorage()) return
  const ids = getStoredNotifiedTaskIds(dateKey)
  ids.add(taskId)
  window.localStorage.setItem(
    notifiedStorageKey(dateKey),
    JSON.stringify(Array.from(ids))
  )
}

export function getDueTasksForBrowserNotification(
  tasks: Task[],
  today = getLocalDateKey()
) {
  return tasks
    .filter((task) => {
      if (!ACTIVE_STATUSES.has(task.status)) return false
      return Boolean(task.due_date && task.due_date <= today)
    })
    .sort((a, b) => {
      if (a.due_date !== b.due_date) return String(a.due_date).localeCompare(String(b.due_date))
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    })
}

export function browserNotificationBody(task: Task, today = getLocalDateKey()) {
  const timing = task.due_date && task.due_date < today ? 'Overdue' : 'Due today'
  const context = task.context ? ` - ${task.context}` : ''
  return `${timing} - ${task.priority} priority${context}`
}
