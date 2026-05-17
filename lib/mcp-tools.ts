import { createServiceClient } from '@/lib/supabase/server'
import { parseTaskInput, generateBriefing } from '@/lib/openai'
import { canUseApiAccess, hasRequiredScope, requiredScopeForTool } from '@/lib/agent-scopes'
import { apiKeyHint, hashApiKey } from '@/lib/api-keys'
import { checkQuota, consumeQuota } from '@/lib/quota'
import { getLocalDateKey } from '@/lib/dates'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  BriefingContent,
  IngestionIntent,
} from '@/lib/database.types'

const TASK_STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'cancelled'] as const
const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const INGESTION_INTENTS = ['create', 'update', 'complete', 'auto'] as const

const MAX_AGENT_INPUT = 2000
const MAX_AGENT_REF = 160
const MAX_AGENT_METADATA_BYTES = 4000
const MAX_TITLE = 500
const MAX_CONTEXT = 4000
const MAX_SEARCH_QUERY = 200

// Tool definition type
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

// Tool handler result
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

// Tool definitions
export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'list_tasks',
    description:
      'List tasks from Nexdo. Filter by status, due date, or get all tasks. Returns task id, title, priority, status, due_date, context, and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'waiting', 'done'],
          description: 'Filter by task status',
        },
        due_today: {
          type: 'boolean',
          description: 'If true, only return tasks due today',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default 20, max 50)',
        },
      },
    },
  },
  {
    name: 'create_task',
    description:
      'Create a new task in Nexdo using natural language. The input will be parsed to extract title, due date, priority, context, people, and tags automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          maxLength: MAX_AGENT_INPUT,
          description:
            'Natural language task description (e.g., "Call John about the project tomorrow at 2pm - high priority")',
        },
        source_agent_id: {
          type: 'string',
          maxLength: MAX_AGENT_REF,
          description: 'Optional stable identifier for the agent creating the task',
        },
        external_ref: {
          type: 'string',
          maxLength: MAX_AGENT_REF,
          description:
            'Optional idempotency/reference id from the calling agent system. Requires source_agent_id; replays with the same source_agent_id and external_ref return the existing task.',
        },
        agent_metadata: {
          type: 'object',
          description: 'Optional structured metadata from the calling agent',
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed in Nexdo.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The ID of the task to complete',
        },
        source_agent_id: {
          type: 'string',
          maxLength: MAX_AGENT_REF,
          description: 'Optional stable identifier for the agent completing the task',
        },
        external_ref: {
          type: 'string',
          maxLength: MAX_AGENT_REF,
          description:
            'Optional reference id from the calling agent system for audit traceability. Requires source_agent_id.',
        },
        ingestion_intent: {
          type: 'string',
          enum: ['create', 'update', 'complete', 'auto'],
          description: 'How the agent intended this task mutation to be interpreted',
        },
        agent_metadata: {
          type: 'object',
          description: 'Optional structured metadata from the calling agent',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task in Nexdo. Only provide fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The ID of the task to update',
        },
        title: {
          type: 'string',
          maxLength: MAX_TITLE,
          description: 'New title for the task',
        },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'medium', 'low'],
          description: 'New priority level',
        },
        due_date: {
          type: 'string',
          description: 'New due date in YYYY-MM-DD format',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'waiting', 'done'],
          description: 'New status',
        },
        context: {
          type: 'string',
          maxLength: MAX_CONTEXT,
          description: 'Additional context or notes about the task',
        },
        source_agent_id: {
          type: 'string',
          maxLength: MAX_AGENT_REF,
          description: 'Optional stable identifier for the agent updating the task',
        },
        external_ref: {
          type: 'string',
          maxLength: MAX_AGENT_REF,
          description: 'Optional idempotency/reference id from the calling agent system',
        },
        ingestion_intent: {
          type: 'string',
          enum: ['create', 'update', 'complete', 'auto'],
          description: 'How the agent intended this task mutation to be interpreted',
        },
        agent_metadata: {
          type: 'object',
          description: 'Optional structured metadata from the calling agent',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'get_briefing',
    description:
      "Get today's AI-generated briefing including top priorities, overdue tasks, quick wins, and tasks where someone is waiting.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_tasks',
    description:
      'Search tasks by keyword. Searches in title, context, and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          maxLength: MAX_SEARCH_QUERY,
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_task',
    description: 'Get full details of a specific task including agent output.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The ID of the task',
        },
      },
      required: ['task_id'],
    },
  },
]

// Tool handlers
type ToolHandler = (
  args: Record<string, unknown>,
  userId: string,
  deps: MCPToolDependencies
) => Promise<ToolResult>

export interface MCPToolDependencies {
  createServiceClient: typeof createServiceClient
  parseTaskInput: typeof parseTaskInput
  generateBriefing: typeof generateBriefing
  checkQuota: typeof checkQuota
  consumeQuota: typeof consumeQuota
}

const DEFAULT_MCP_TOOL_DEPENDENCIES: MCPToolDependencies = {
  createServiceClient,
  parseTaskInput,
  generateBriefing,
  checkQuota,
  consumeQuota,
}

function formatTaskForResponse(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    source: task.source,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date,
    due_time: task.due_time,
    context: task.context,
    action_type: task.action_type,
    tags: task.tags,
    people: task.people,
    estimated_minutes: task.estimated_minutes,
    source_agent_id: task.source_agent_id,
    external_ref: task.external_ref,
    ingestion_intent: task.ingestion_intent,
  }
}

async function findTaskByExternalRef(
  supabase: any,
  userId: string,
  sourceAgentId: string,
  externalRef: string
): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('source_agent_id', sourceAgentId)
    .eq('external_ref', externalRef)
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data || null
}

function taskResponse(
  task: Task,
  options: { idempotentReplay?: boolean } = {}
): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...formatTaskForResponse(task),
            idempotent_replay: options.idempotentReplay || false,
          },
          null,
          2
        ),
      },
    ],
  }
}

function optionalString(
  value: unknown,
  options: { maxLength?: number } = {}
): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return options.maxLength ? trimmed.slice(0, options.maxLength) : trimmed
}

function optionalMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const metadata = value as Record<string, unknown>
  const byteLength = new TextEncoder().encode(JSON.stringify(metadata)).length
  return byteLength <= MAX_AGENT_METADATA_BYTES ? metadata : null
}

function optionalIngestionIntent(value: unknown): IngestionIntent | null {
  return INGESTION_INTENTS.includes(value as IngestionIntent)
    ? (value as IngestionIntent)
    : null
}

function toolError(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
    isError: true,
  }
}

function stringArg(
  args: Record<string, unknown>,
  field: string,
  options: { required?: boolean; maxLength?: number } = {}
) {
  const value = args[field]
  if (value === undefined || value === null || value === '') {
    return options.required ? { error: `Error: ${field} is required` } : { value: null }
  }
  if (typeof value !== 'string') {
    return { error: `Error: ${field} must be a string` }
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return options.required ? { error: `Error: ${field} is required` } : { value: null }
  }
  if (options.maxLength && trimmed.length > options.maxLength) {
    return { error: `Error: ${field} must be ${options.maxLength} characters or fewer` }
  }
  return { value: trimmed }
}

function numberLimit(value: unknown, fallback: number, max: number) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(1, Math.floor(n)), max)
}

function taskMatchesSearch(task: Task, query: string): boolean {
  const needle = query.toLowerCase()
  return (
    task.title.toLowerCase().includes(needle) ||
    Boolean(task.context?.toLowerCase().includes(needle)) ||
    Boolean(task.tags?.some((tag) => tag.toLowerCase().includes(needle)))
  )
}

function metadataArg(value: unknown) {
  if (value === undefined) return { value: null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Error: agent_metadata must be an object' }
  }
  const metadata = value as Record<string, unknown>
  const byteLength = new TextEncoder().encode(JSON.stringify(metadata)).length
  if (byteLength > MAX_AGENT_METADATA_BYTES) {
    return { error: `Error: agent_metadata must be ${MAX_AGENT_METADATA_BYTES} bytes or fewer` }
  }
  return { value: metadata }
}

function auditMetadata(args: Record<string, unknown>): Record<string, unknown> {
  return {
    argument_keys: Object.keys(args).sort(),
    has_agent_metadata: Boolean(optionalMetadata(args.agent_metadata)),
  }
}

async function logAgentAction(input: {
  userId: string
  toolName: string
  args: Record<string, unknown>
  success: boolean
  error?: string | null
  durationMs: number
}, deps: MCPToolDependencies) {
  const supabaseRaw = await deps.createServiceClient()
  if (!supabaseRaw) return

  const supabase = supabaseRaw as any
  await supabase.from('agent_action_events').insert({
    user_id: input.userId,
    tool_name: input.toolName,
    source_agent_id: optionalString(input.args.source_agent_id, {
      maxLength: MAX_AGENT_REF,
    }),
    external_ref: optionalString(input.args.external_ref, {
      maxLength: MAX_AGENT_REF,
    }),
    ingestion_intent: optionalIngestionIntent(input.args.ingestion_intent),
    metadata: auditMetadata(input.args),
    success: input.success,
    error: input.error || null,
    duration_ms: input.durationMs,
  })
}

const listTasks: ToolHandler = async (args, userId, deps) => {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const status = args.status as TaskStatus | undefined
  if (status !== undefined && !TASK_STATUSES.includes(status)) {
    return toolError(`Error: status must be one of ${TASK_STATUSES.join(', ')}`)
  }

  if (args.due_today !== undefined && typeof args.due_today !== 'boolean') {
    return toolError('Error: due_today must be a boolean')
  }

  const dueToday = args.due_today as boolean | undefined
  const limit = numberLimit(args.limit, 20, 50)

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  if (dueToday) {
    const today = getLocalDateKey()
    query = query.eq('due_date', today)
  }

  const { data: tasks, error } = await query

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }

  const formatted = (tasks || []).map(formatTaskForResponse)
  return {
    content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
  }
}

const createTask: ToolHandler = async (args, userId, deps) => {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const inputResult = stringArg(args, 'input', {
    required: true,
    maxLength: MAX_AGENT_INPUT,
  })
  if (inputResult.error) return toolError(inputResult.error)
  const input = inputResult.value as string

  const sourceAgentResult = stringArg(args, 'source_agent_id', {
    maxLength: MAX_AGENT_REF,
  })
  if (sourceAgentResult.error) return toolError(sourceAgentResult.error)
  const externalRefResult = stringArg(args, 'external_ref', {
    maxLength: MAX_AGENT_REF,
  })
  if (externalRefResult.error) return toolError(externalRefResult.error)
  const metadataResult = metadataArg(args.agent_metadata)
  if (metadataResult.error) return toolError(metadataResult.error)

  const sourceAgentId = sourceAgentResult.value
  const externalRef = externalRefResult.value

  if (externalRef && !sourceAgentId) {
    return toolError('Error: source_agent_id is required when external_ref is provided')
  }

  if (externalRef && sourceAgentId) {
    const existingTask = await findTaskByExternalRef(
      supabase,
      userId,
      sourceAgentId,
      externalRef
    )
    if (existingTask) {
      return taskResponse(existingTask, { idempotentReplay: true })
    }
  }

  const preQuota = await deps.checkQuota(userId, 'task_create')
  if (!preQuota.allowed) {
    return toolError(
      `Error: ${preQuota.reason || 'Task quota exceeded for this account'}`
    )
  }

  // Parse the natural language input
  const parsed = await deps.parseTaskInput(input)
  if (!parsed) {
    return toolError('Error: Failed to parse task input')
  }

  // Insert the task
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: parsed.title,
      raw_input: input,
      priority: parsed.priority,
      due_date: parsed.due_date,
      context: parsed.context,
      people: parsed.people,
      tags: parsed.tags,
      action_type: parsed.action_type,
      estimated_minutes: parsed.estimated_minutes,
      energy_level: parsed.energy_level,
      status: 'todo',
      source: sourceAgentId ? 'agent' : 'api',
      source_agent_id: sourceAgentId,
      external_ref: externalRef,
      ingestion_intent: 'create',
      agent_metadata: metadataResult.value,
    })
    .select()
    .single()

  if (error) {
    if (externalRef && sourceAgentId && error.code === '23505') {
      const existingTask = await findTaskByExternalRef(
        supabase,
        userId,
        sourceAgentId,
        externalRef
      )
      if (existingTask) {
        return taskResponse(existingTask, { idempotentReplay: true })
      }
    }

    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }

  if (!task) {
    return toolError('Error: Failed to create task')
  }

  const quota = await deps.consumeQuota(userId, 'task_create')
  if (!quota.allowed) {
    const { error: cleanupError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)
      .eq('user_id', userId)

    if (cleanupError) {
      console.error('Error rolling back MCP task after quota failure:', cleanupError)
    }

    return toolError(
      `Error: ${quota.reason || 'Task quota exceeded for this account'}`
    )
  }

  return taskResponse(task)
}

const completeTask: ToolHandler = async (args, userId, deps) => {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const taskIdResult = stringArg(args, 'task_id', { required: true })
  if (taskIdResult.error) return toolError(taskIdResult.error)
  const taskId = taskIdResult.value as string

  const sourceAgentResult = stringArg(args, 'source_agent_id', {
    maxLength: MAX_AGENT_REF,
  })
  if (sourceAgentResult.error) return toolError(sourceAgentResult.error)
  const externalRefResult = stringArg(args, 'external_ref', {
    maxLength: MAX_AGENT_REF,
  })
  if (externalRefResult.error) return toolError(externalRefResult.error)

  if (externalRefResult.value && !sourceAgentResult.value) {
    return toolError('Error: source_agent_id is required when external_ref is provided')
  }

  if (args.ingestion_intent !== undefined) {
    const intent = optionalIngestionIntent(args.ingestion_intent)
    if (!intent) {
      return toolError(`Error: ingestion_intent must be one of ${INGESTION_INTENTS.join(', ')}`)
    }
  }

  const metadataResult = metadataArg(args.agent_metadata)
  if (metadataResult.error) return toolError(metadataResult.error)

  const { data: task, error } = await supabase
    .from('tasks')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }

  if (!task) {
    return toolError('Error: Task not found')
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formatTaskForResponse(task), null, 2),
      },
    ],
  }
}

const updateTask: ToolHandler = async (args, userId, deps) => {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const taskIdResult = stringArg(args, 'task_id', { required: true })
  if (taskIdResult.error) return toolError(taskIdResult.error)
  const taskId = taskIdResult.value as string

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (args.title !== undefined) {
    const titleResult = stringArg(args, 'title', { required: true, maxLength: MAX_TITLE })
    if (titleResult.error) return toolError(titleResult.error)
    updates.title = titleResult.value
  }

  if (args.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(args.priority as TaskPriority)) {
      return toolError(`Error: priority must be one of ${TASK_PRIORITIES.join(', ')}`)
    }
    updates.priority = args.priority as TaskPriority
  }

  if (args.due_date !== undefined) {
    if (
      args.due_date !== null &&
      (typeof args.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(args.due_date))
    ) {
      return toolError('Error: due_date must be YYYY-MM-DD or null')
    }
    updates.due_date = args.due_date
  }

  if (args.status !== undefined) {
    if (!TASK_STATUSES.includes(args.status as TaskStatus)) {
      return toolError(`Error: status must be one of ${TASK_STATUSES.join(', ')}`)
    }
    updates.status = args.status as TaskStatus
    // Set completed_at when marking done
    if (args.status === 'done') {
      updates.completed_at = new Date().toISOString()
    } else {
      updates.completed_at = null
    }
  }
  if (args.context !== undefined) {
    if (args.context !== null && typeof args.context !== 'string') {
      return toolError('Error: context must be a string or null')
    }
    if (typeof args.context === 'string' && args.context.length > MAX_CONTEXT) {
      return toolError(`Error: context must be ${MAX_CONTEXT} characters or fewer`)
    }
    updates.context = typeof args.context === 'string' ? args.context.trim() || null : null
  }

  if (args.source_agent_id !== undefined) {
    const sourceAgentResult = stringArg(args, 'source_agent_id', {
      maxLength: MAX_AGENT_REF,
    })
    if (sourceAgentResult.error) return toolError(sourceAgentResult.error)
    updates.source_agent_id = sourceAgentResult.value
    if (updates.source_agent_id) updates.source = 'agent'
  }
  if (args.external_ref !== undefined) {
    const externalRefResult = stringArg(args, 'external_ref', {
      maxLength: MAX_AGENT_REF,
    })
    if (externalRefResult.error) return toolError(externalRefResult.error)
    updates.external_ref = externalRefResult.value
  }
  if (args.ingestion_intent !== undefined) {
    const intent = optionalIngestionIntent(args.ingestion_intent)
    if (!intent) {
      return toolError(`Error: ingestion_intent must be one of ${INGESTION_INTENTS.join(', ')}`)
    }
    updates.ingestion_intent = intent
  }
  if (args.agent_metadata !== undefined) {
    const metadataResult = metadataArg(args.agent_metadata)
    if (metadataResult.error) return toolError(metadataResult.error)
    updates.agent_metadata = metadataResult.value
  }

  if (Object.keys(updates).length === 1) {
    return toolError('Error: no valid updates provided')
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }

  if (!task) {
    return toolError('Error: Task not found')
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formatTaskForResponse(task), null, 2),
      },
    ],
  }
}

const getBriefing: ToolHandler = async (args, userId, deps) => {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  // Get user profile for name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  // Get active tasks for briefing
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['todo', 'in_progress', 'waiting'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(50)

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }

  const briefing = await deps.generateBriefing(
    tasks || [],
    profile?.full_name || 'there'
  )

  if (!briefing) {
    return {
      content: [{ type: 'text', text: 'Failed to generate briefing' }],
      isError: true,
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(briefing, null, 2) }],
  }
}

const searchTasks: ToolHandler = async (args, userId, deps) => {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const queryResult = stringArg(args, 'query', {
    required: true,
    maxLength: MAX_SEARCH_QUERY,
  })
  if (queryResult.error) return toolError(queryResult.error)
  const query = (queryResult.value as string)
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!query) {
    return toolError('Error: query must include searchable text')
  }

  const limit = numberLimit(args.limit, 10, 50)

  // Fetch a bounded recent window and filter locally so the advertised tag
  // search works without relying on fragile PostgREST array-query syntax.
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(250)

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }

  const formatted = (tasks || [])
    .filter((task: Task) => taskMatchesSearch(task, query))
    .slice(0, limit)
    .map(formatTaskForResponse)
  return {
    content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
  }
}

const getTask: ToolHandler = async (args, userId, deps) => {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const taskIdResult = stringArg(args, 'task_id', { required: true })
  if (taskIdResult.error) return toolError(taskIdResult.error)
  const taskId = taskIdResult.value as string

  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }

  if (!task) {
    return toolError('Error: Task not found')
  }

  // Include full task details with agent_output
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...formatTaskForResponse(task),
            description: task.description,
            raw_input: task.raw_input,
            action_type: task.action_type,
            energy_level: task.energy_level,
            agent_output: task.agent_output,
            completed_at: task.completed_at,
            created_at: task.created_at,
            updated_at: task.updated_at,
          },
          null,
          2
        ),
      },
    ],
  }
}

// Handler registry
const TOOL_HANDLERS: Record<string, ToolHandler> = {
  list_tasks: listTasks,
  create_task: createTask,
  complete_task: completeTask,
  update_task: updateTask,
  get_briefing: getBriefing,
  search_tasks: searchTasks,
  get_task: getTask,
}

// Main tool executor
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  return executeToolWithDependencies(
    name,
    args,
    userId,
    DEFAULT_MCP_TOOL_DEPENDENCIES
  )
}

export async function executeToolWithDependencies(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  deps: MCPToolDependencies
): Promise<ToolResult> {
  const handler = TOOL_HANDLERS[name]
  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    }
  }

  const startedAt = Date.now()
  let result: ToolResult
  try {
    result = await handler(args, userId, deps)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    result = {
      content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
      isError: true,
    }
  }

  await logAgentAction({
    userId,
    toolName: name,
    args,
    success: !result.isError,
    error: result.isError ? result.content[0]?.text : null,
    durationMs: Date.now() - startedAt,
  }, deps).catch(console.error)

  return result
}

function isMissingApiKeyHashColumn(error: unknown) {
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : ''

  return (
    message.includes('api_key_hash') &&
    (message.includes('does not exist') || message.includes('schema cache'))
  )
}

// Auth helper: validate API key and return user ID
export async function validateApiKey(
  apiKey: string
): Promise<{ userId: string; scopes: string[] } | null> {
  return validateApiKeyWithDependencies(apiKey, DEFAULT_MCP_TOOL_DEPENDENCIES)
}

export async function validateApiKeyWithDependencies(
  apiKey: string,
  deps: Pick<MCPToolDependencies, 'createServiceClient'>
): Promise<{ userId: string; scopes: string[] } | null> {
  const supabaseRaw = await deps.createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) return null

  // API keys start with 'nxd_'
  if (!apiKey.startsWith('nxd_')) return null

  const apiKeyHash = hashApiKey(apiKey)
  let matchedLegacyKey = false
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('id, api_key_scopes, subscription_tier')
    .eq('api_key_hash', apiKeyHash)
    .maybeSingle()

  if ((error && isMissingApiKeyHashColumn(error)) || !profile) {
    const legacyResult = await supabase
      .from('profiles')
      .select('id, api_key_scopes, subscription_tier')
      .eq('api_key', apiKey)
      .maybeSingle()

    profile = legacyResult.data
    error = legacyResult.error
    matchedLegacyKey = !!profile
  }

  if (error || !profile) return null
  if (!canUseApiAccess(profile.subscription_tier)) return null

  const usedAt = new Date().toISOString()
  const update = matchedLegacyKey
    ? {
        api_key: null,
        api_key_hash: apiKeyHash,
        api_key_hint: apiKeyHint(apiKey),
        api_key_last_used_at: usedAt,
      }
    : { api_key_last_used_at: usedAt }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', profile.id)

  if (updateError && matchedLegacyKey && isMissingApiKeyHashColumn(updateError)) {
    await supabase
      .from('profiles')
      .update({ api_key_last_used_at: usedAt })
      .eq('id', profile.id)
  }

  return { userId: profile.id, scopes: profile.api_key_scopes || [] }
}

export function canUseTool(scopes: string[], toolName: string): boolean {
  return hasRequiredScope(scopes, toolName)
}

export function missingScopeMessage(toolName: string): string {
  return `API key missing required scope: ${requiredScopeForTool(toolName)}`
}
