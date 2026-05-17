import type { Json, Task } from './database.types'

type AgentTraceTask = Pick<
  Task,
  'source' | 'source_agent_id' | 'external_ref' | 'ingestion_intent' | 'agent_metadata'
>

const INTENT_LABELS = {
  create: 'Create',
  update: 'Update',
  complete: 'Complete',
  auto: 'Auto',
} as const

export function hasAgentTrace(task: AgentTraceTask): boolean {
  return (
    task.source === 'agent' ||
    Boolean(task.source_agent_id) ||
    Boolean(task.external_ref) ||
    Boolean(task.ingestion_intent) ||
    Boolean(task.agent_metadata)
  )
}

export function compactTraceValue(value: string, maxLength = 28): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(maxLength - 1, 1))}...`
}

export function agentTraceLabel(task: AgentTraceTask, maxLength = 28): string {
  if (task.source_agent_id) {
    return compactTraceValue(task.source_agent_id, maxLength)
  }

  return 'External agent'
}

export function formatIngestionIntent(
  intent: AgentTraceTask['ingestion_intent']
): string | null {
  if (!intent) return null
  return INTENT_LABELS[intent] ?? intent
}

export function agentMetadataKeys(metadata: Json | null, maxKeys = 6): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return []
  }

  return Object.keys(metadata).filter(Boolean).slice(0, maxKeys)
}
