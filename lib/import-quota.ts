import { NextResponse } from 'next/server'
import {
  checkQuota,
  consumeQuota,
  quotaExceededResponse,
  quotaFailureStatus,
} from '@/lib/quota'
import type { TaskInsert } from '@/lib/database.types'

type ImportedTaskWithId = TaskInsert & { id?: unknown }

async function cleanupImportedTasks(
  userId: string,
  tasks: ImportedTaskWithId[],
  supabase: any
) {
  const taskIds = tasks
    .map((task) => task.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (taskIds.length === 0) return

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .in('id', taskIds)

  if (error) {
    console.error('Error rolling back imported tasks after quota failure:', error)
  }
}

export async function checkImportQuota(userId: string, taskCount: number) {
  if (taskCount <= 0) return null

  const quota = await checkQuota(userId, 'task_create', taskCount)
  if (quota.allowed) return null

  return NextResponse.json(quotaExceededResponse(quota), {
    status: quotaFailureStatus(quota),
  })
}

export async function recordImportQuota(
  userId: string,
  taskCount: number,
  insertedTasks: ImportedTaskWithId[],
  supabase: any
) {
  if (taskCount <= 0) return null

  const quota = await consumeQuota(userId, 'task_create', taskCount)
  if (quota.allowed) return null

  await cleanupImportedTasks(userId, insertedTasks, supabase)

  return NextResponse.json(quotaExceededResponse(quota), {
    status: quotaFailureStatus(quota),
  })
}
