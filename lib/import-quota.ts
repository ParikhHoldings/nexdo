import { NextResponse } from 'next/server'
import { consumeQuota, quotaExceededResponse, quotaFailureStatus } from '@/lib/quota'

export async function enforceImportQuota(userId: string, taskCount: number) {
  if (taskCount <= 0) return null

  const quota = await consumeQuota(userId, 'task_create', taskCount)
  if (quota.allowed) return null

  return NextResponse.json(quotaExceededResponse(quota), {
    status: quotaFailureStatus(quota),
  })
}
