'use client'

import { useEffect } from 'react'
import {
  browserNotificationBody,
  getBrowserNotificationPermission,
  getDueTasksForBrowserNotification,
  getLocalDateKey,
  getStoredNotifiedTaskIds,
  markTaskNotificationSent,
} from '@/lib/browser-notifications'
import { useTaskStore, useUIStore } from '@/lib/store'

const MAX_NOTIFICATIONS_PER_PASS = 3

export function TaskNotificationController() {
  const tasks = useTaskStore((state) => state.tasks)
  const browserNotificationsEnabled = useUIStore(
    (state) => state.browserNotificationsEnabled
  )
  const setNotificationPermission = useUIStore(
    (state) => state.setNotificationPermission
  )

  useEffect(() => {
    const permission = getBrowserNotificationPermission()
    setNotificationPermission(permission)

    if (
      !browserNotificationsEnabled ||
      permission !== 'granted' ||
      typeof window === 'undefined' ||
      !('Notification' in window)
    ) {
      return
    }

    const today = getLocalDateKey()
    const notifiedTaskIds = getStoredNotifiedTaskIds(today)
    const dueTasks = getDueTasksForBrowserNotification(tasks, today)
      .filter((task) => !notifiedTaskIds.has(task.id))
      .slice(0, MAX_NOTIFICATIONS_PER_PASS)

    dueTasks.forEach((task) => {
      try {
        const notification = new window.Notification(`Nexdo: ${task.title}`, {
          body: browserNotificationBody(task, today),
          tag: `nexdo-task-${task.id}`,
        })

        notification.onclick = () => {
          window.focus()
        }

        markTaskNotificationSent(task.id, today)
      } catch (error) {
        console.error('Could not send task notification:', error)
      }
    })
  }, [browserNotificationsEnabled, tasks, setNotificationPermission])

  return null
}
