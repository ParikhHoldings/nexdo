import type { SubscriptionTier } from './database.types'

export const DEMO_IMPORT_TASK_LIMIT = 100
export const FREE_PLAN_IMPORT_TASK_LIMIT = 25

interface ImportPreviewWarningInput {
  isAuthenticated: boolean
  importCount: number
  subscriptionTier?: SubscriptionTier | null
  taskCountThisMonth?: number | null
}

function pluralizeTaskSlot(count: number) {
  return `task slot${count !== 1 ? 's' : ''}`
}

export function importPreviewWarning({
  isAuthenticated,
  importCount,
  subscriptionTier,
  taskCountThisMonth,
}: ImportPreviewWarningInput): string | null {
  if (!isAuthenticated) {
    return `Demo file imports are capped at ${DEMO_IMPORT_TASK_LIMIT} tasks per file.`
  }

  if (subscriptionTier !== 'free') return null

  const used = taskCountThisMonth || 0
  const remaining = Math.max(FREE_PLAN_IMPORT_TASK_LIMIT - used, 0)
  const slotCopy = pluralizeTaskSlot(remaining)

  if (importCount > remaining) {
    return `Your Free plan has ${remaining} ${slotCopy} left this month. This import may fail unless you upgrade or reduce the file.`
  }

  return `${remaining} Free-plan ${slotCopy} left before import.`
}
