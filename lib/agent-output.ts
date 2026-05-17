import type {
  ActionType,
  DraftOutput,
  Json,
  PrepOutput,
  ResearchOutput,
} from './database.types'

export type AgentOutput = ResearchOutput | DraftOutput | PrepOutput
export type AgentReviewStatus = 'unreviewed' | 'verified' | 'needs_revision'

export interface AgentExecutionRecord {
  id: string
  action_type: Extract<ActionType, 'research' | 'draft' | 'prep'>
  output: AgentOutput
  created_at: string
}

export interface AgentReview {
  status: AgentReviewStatus
  note: string | null
  updated_at: string | null
}

export interface AgentOutputEnvelope {
  schema_version: 1
  current: AgentOutput
  history: AgentExecutionRecord[]
  review: AgentReview
}

export const AGENT_REVIEW_STATUSES: AgentReviewStatus[] = [
  'unreviewed',
  'verified',
  'needs_revision',
]

const MAX_HISTORY = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function executionId() {
  return globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}-${Math.random()}`
}

function executableActionType(actionType: ActionType) {
  return ['research', 'draft', 'prep'].includes(actionType)
    ? (actionType as AgentExecutionRecord['action_type'])
    : null
}

function normalizeReview(value: unknown): AgentReview {
  if (!isRecord(value)) {
    return { status: 'unreviewed', note: null, updated_at: null }
  }

  const status = AGENT_REVIEW_STATUSES.includes(
    value.status as AgentReviewStatus
  )
    ? (value.status as AgentReviewStatus)
    : 'unreviewed'
  const note = typeof value.note === 'string' && value.note.trim()
    ? value.note.trim()
    : null
  const updatedAt =
    typeof value.updated_at === 'string' && value.updated_at
      ? value.updated_at
      : null

  return { status, note, updated_at: updatedAt }
}

function recordFrom(
  output: AgentOutput,
  actionType: ActionType,
  createdAt = new Date().toISOString()
): AgentExecutionRecord | null {
  const executable = executableActionType(actionType)
  if (!executable) return null

  return {
    id: executionId(),
    action_type: executable,
    output,
    created_at: createdAt,
  }
}

export function isAgentOutputEnvelope(
  value: unknown
): value is AgentOutputEnvelope {
  return (
    isRecord(value) &&
    value.schema_version === 1 &&
    isRecord(value.current) &&
    Array.isArray(value.history)
  )
}

export function normalizeAgentOutput(
  value: Json | AgentOutputEnvelope | AgentOutput | null,
  actionType: ActionType
): AgentOutputEnvelope | null {
  if (!isRecord(value)) return null

  if (isAgentOutputEnvelope(value)) {
    const fallbackRecord = recordFrom(
      value.current as AgentOutput,
      actionType,
      typeof value.history[0]?.created_at === 'string'
        ? value.history[0].created_at
        : new Date().toISOString()
    )
    const history = value.history
      .filter(isRecord)
      .map((record) => ({
        id: typeof record.id === 'string' ? record.id : executionId(),
        action_type:
          executableActionType(record.action_type as ActionType) ??
          executableActionType(actionType) ??
          'draft',
        output: isRecord(record.output)
          ? (record.output as AgentOutput)
          : (value.current as AgentOutput),
        created_at:
          typeof record.created_at === 'string'
            ? record.created_at
            : new Date().toISOString(),
      }))

    return {
      schema_version: 1,
      current: value.current as unknown as AgentOutput,
      history: history.length > 0 || !fallbackRecord ? history : [fallbackRecord],
      review: normalizeReview(value.review),
    }
  }

  const record = recordFrom(value as unknown as AgentOutput, actionType)
  if (!record) return null

  return {
    schema_version: 1,
    current: value as unknown as AgentOutput,
    history: [record],
    review: { status: 'unreviewed', note: null, updated_at: null },
  }
}

export function appendAgentExecution(
  existing: Json | AgentOutputEnvelope | AgentOutput | null,
  output: AgentOutput,
  actionType: ActionType
): AgentOutputEnvelope {
  const record = recordFrom(output, actionType)
  if (!record) {
    throw new Error('Unsupported executable action type')
  }

  const normalized = normalizeAgentOutput(existing, actionType)

  return {
    schema_version: 1,
    current: output,
    history: [record, ...(normalized?.history ?? [])].slice(0, MAX_HISTORY),
    review: { status: 'unreviewed', note: null, updated_at: null },
  }
}

export function updateAgentReview(
  existing: AgentOutputEnvelope,
  status: AgentReviewStatus,
  note: string | null,
  updatedAt = new Date().toISOString()
): AgentOutputEnvelope {
  return {
    ...existing,
    review: {
      status,
      note: note?.trim() || null,
      updated_at: updatedAt,
    },
  }
}
