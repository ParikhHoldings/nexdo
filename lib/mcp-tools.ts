import { createServiceClient } from '@/lib/supabase/server'
import { parseTaskInput, generateBriefing } from '@/lib/openai'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  BriefingContent,
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
    priority: task.priority,
    status: task.status,
    due_date: task.due_date,
    due_time: task.due_time,
    context: task.context,
    tags: task.tags,
    people: task.people,
    estimated_minutes: task.estimated_minutes,
  }
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
      source: 'api',
    })
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

  try {
    return await handler(args, userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
      isError: true,
    }
  }
}

// Auth helper: validate API key and return user ID
export async function validateApiKey(
  apiKey: string
): Promise<{ userId: string } | null> {
  const supabaseRaw = await createServiceClient()
  const supabase = supabaseRaw as any
  if (!supabaseRaw) return null

  // API keys start with 'nxd_'
  if (!apiKey.startsWith('nxd_')) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('api_key', apiKey)
    .single()

  if (error || !profile) return null

  return { userId: profile.id }
}
