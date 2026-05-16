import { createServiceClient } from '@/lib/supabase/server'
import { parseTaskInput, generateBriefing } from '@/lib/openai'
import { hasRequiredScope, requiredScopeForTool } from '@/lib/agent-scopes'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  BriefingContent,
  IngestionIntent,
} from '@/lib/database.types'

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
          description:
            'Natural language task description (e.g., "Call John about the project tomorrow at 2pm - high priority")',
        },
        source_agent_id: {
          type: 'string',
          description: 'Optional stable identifier for the agent creating the task',
        },
        external_ref: {
          type: 'string',
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
          description: 'Additional context or notes about the task',
        },
        source_agent_id: {
          type: 'string',
          description: 'Optional stable identifier for the agent updating the task',
        },
        external_ref: {
          type: 'string',
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
  userId: string
) => Promise<ToolResult>

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

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function optionalIngestionIntent(value: unknown): IngestionIntent | null {
  return value === 'create' || value === 'update' || value === 'complete' || value === 'auto'
    ? value
    : null
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
}) {
  const supabaseRaw = await createServiceClient()
  if (!supabaseRaw) return

  const supabase = supabaseRaw as any
  await supabase.from('agent_action_events').insert({
    user_id: input.userId,
    tool_name: input.toolName,
    source_agent_id: optionalString(input.args.source_agent_id),
    external_ref: optionalString(input.args.external_ref),
    ingestion_intent: optionalIngestionIntent(input.args.ingestion_intent),
    metadata: auditMetadata(input.args),
    success: input.success,
    error: input.error || null,
    duration_ms: input.durationMs,
  })
}

const listTasks: ToolHandler = async (args, userId) => {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const status = args.status as TaskStatus | undefined
  const dueToday = args.due_today as boolean | undefined
  const limit = Math.min(Math.max(1, (args.limit as number) || 20), 50)

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
    const today = new Date().toISOString().split('T')[0]
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

const createTask: ToolHandler = async (args, userId) => {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const input = args.input as string
  if (!input) {
    return {
      content: [{ type: 'text', text: 'Error: input is required' }],
      isError: true,
    }
  }

  const sourceAgentId = optionalString(args.source_agent_id)
  const externalRef = optionalString(args.external_ref)

  if (externalRef && !sourceAgentId) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: source_agent_id is required when external_ref is provided',
        },
      ],
      isError: true,
    }
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

  // Parse the natural language input
  const parsed = await parseTaskInput(input)
  if (!parsed) {
    return {
      content: [{ type: 'text', text: 'Error: Failed to parse task input' }],
      isError: true,
    }
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
      agent_metadata: optionalMetadata(args.agent_metadata),
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

  return taskResponse(task)
}

const completeTask: ToolHandler = async (args, userId) => {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const taskId = args.task_id as string
  if (!taskId) {
    return {
      content: [{ type: 'text', text: 'Error: task_id is required' }],
      isError: true,
    }
  }

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
    .single()

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
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

const updateTask: ToolHandler = async (args, userId) => {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const taskId = args.task_id as string
  if (!taskId) {
    return {
      content: [{ type: 'text', text: 'Error: task_id is required' }],
      isError: true,
    }
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (args.title !== undefined) updates.title = args.title
  if (args.priority !== undefined) updates.priority = args.priority as TaskPriority
  if (args.due_date !== undefined) updates.due_date = args.due_date
  if (args.status !== undefined) {
    updates.status = args.status as TaskStatus
    // Set completed_at when marking done
    if (args.status === 'done') {
      updates.completed_at = new Date().toISOString()
    } else {
      updates.completed_at = null
    }
  }
  if (args.context !== undefined) updates.context = args.context
  if (args.source_agent_id !== undefined) {
    updates.source_agent_id = optionalString(args.source_agent_id)
    if (updates.source_agent_id) updates.source = 'agent'
  }
  if (args.external_ref !== undefined) updates.external_ref = optionalString(args.external_ref)
  if (args.ingestion_intent !== undefined) {
    updates.ingestion_intent = optionalIngestionIntent(args.ingestion_intent)
  }
  if (args.agent_metadata !== undefined) updates.agent_metadata = optionalMetadata(args.agent_metadata)

  const { data: task, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
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

const getBriefing: ToolHandler = async (args, userId) => {
  const supabaseRaw = await createServiceClient()
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

  const briefing = await generateBriefing(
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

const searchTasks: ToolHandler = async (args, userId) => {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const query = args.query as string
  if (!query) {
    return {
      content: [{ type: 'text', text: 'Error: query is required' }],
      isError: true,
    }
  }

  const limit = Math.min(Math.max(1, (args.limit as number) || 10), 50)
  const searchPattern = `%${query}%`

  // Search in title, context, and use textSearch for tags
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .or(`title.ilike.${searchPattern},context.ilike.${searchPattern}`)
    .order('updated_at', { ascending: false })
    .limit(limit)

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

const getTask: ToolHandler = async (args, userId) => {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) {
    return {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    }
  }

  const taskId = args.task_id as string
  if (!taskId) {
    return {
      content: [{ type: 'text', text: 'Error: task_id is required' }],
      isError: true,
    }
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
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
    result = await handler(args, userId)
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
  }).catch(console.error)

  return result
}

// Auth helper: validate API key and return user ID
export async function validateApiKey(
  apiKey: string
): Promise<{ userId: string; scopes: string[] } | null> {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) return null

  // API keys start with 'nxd_'
  if (!apiKey.startsWith('nxd_')) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, api_key_scopes')
    .eq('api_key', apiKey)
    .single()

  if (error || !profile) return null

  await supabase
    .from('profiles')
    .update({ api_key_last_used_at: new Date().toISOString() })
    .eq('id', profile.id)

  return { userId: profile.id, scopes: profile.api_key_scopes || [] }
}

export function canUseTool(scopes: string[], toolName: string): boolean {
  return hasRequiredScope(scopes, toolName)
}

export function missingScopeMessage(toolName: string): string {
  return `API key missing required scope: ${requiredScopeForTool(toolName)}`
}
