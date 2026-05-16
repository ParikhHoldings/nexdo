import type { SubscriptionTier } from './database.types'

export const API_KEY_SCOPES = [
  'tasks:read',
  'tasks:write',
  'briefing:read',
] as const

export const API_ACCESS_REQUIRED_MESSAGE = 'API access requires a Power plan or higher.'

const API_ACCESS_TIERS = new Set<SubscriptionTier>(['power', 'team'])

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = [
  'tasks:read',
  'tasks:write',
  'briefing:read',
]

const SCOPE_SET = new Set<string>(API_KEY_SCOPES)

export const API_KEY_SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'tasks:read': 'Read tasks',
  'tasks:write': 'Create and update tasks',
  'briefing:read': 'Read daily briefing',
}

export function normalizeApiKeyScopes(value: unknown): ApiKeyScope[] {
  if (!Array.isArray(value)) return DEFAULT_API_KEY_SCOPES

  const scopes = value.filter(
    (scope): scope is ApiKeyScope =>
      typeof scope === 'string' && SCOPE_SET.has(scope)
  )

  return scopes.length > 0 ? Array.from(new Set(scopes)) : DEFAULT_API_KEY_SCOPES
}

export function canUseApiAccess(tier: SubscriptionTier | null | undefined): boolean {
  return tier ? API_ACCESS_TIERS.has(tier) : false
}

export function requiredScopeForTool(toolName: string): ApiKeyScope {
  if (toolName === 'get_briefing') return 'briefing:read'
  if (toolName === 'create_task' || toolName === 'update_task' || toolName === 'complete_task') {
    return 'tasks:write'
  }
  return 'tasks:read'
}

export function hasRequiredScope(scopes: string[], toolName: string): boolean {
  return scopes.includes(requiredScopeForTool(toolName))
}
