import { NextResponse } from 'next/server'
import { consumeQuota, quotaExceededResponse } from '@/lib/quota'

export async function enforceImportQuota(userId: string, taskCount: number) {
  if (taskCount <= 0) return null

  const quota = await consumeQuota(userId, 'task_create', taskCount)
  if (quota.allowed) return null

  const status =
    quota.reason === 'Failed to record usage' ||
    quota.reason === 'Service unavailable' ||
    quota.reason === 'No profile'
      ? 500
      : 402

  return NextResponse.json(quotaExceededResponse(quota), { status })
}
