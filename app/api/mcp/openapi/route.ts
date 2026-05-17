import { NextResponse } from 'next/server'
import { isUsableEnv } from '@/lib/env'

function resolveServerUrl(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL
  if (isUsableEnv(configuredUrl)) {
    return configuredUrl.replace(/\/$/, '')
  }

  return new URL(request.url).origin
}

function errorResponse(description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }
}

const actionErrorResponses = {
  '400': errorResponse('Tool validation or execution error'),
  '401': errorResponse('Unauthorized'),
  '403': errorResponse('API key missing the required scope'),
  '500': errorResponse('Server error'),
  '503': errorResponse('Service unavailable'),
}

// OpenAPI 3.0 spec for ChatGPT Actions
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Nexdo API',
    description: 'AI-powered task management. Create, update, complete, and search tasks using natural language.',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'https://nexdo.ai',
      description: 'Nexdo API',
    },
  ],
  paths: {
    '/api/mcp/actions/list_tasks': {
      post: {
        operationId: 'listTasks',
        summary: 'List tasks',
        description: 'List tasks from Nexdo. Filter by status, due date, or get all tasks.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
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
                    type: 'integer',
                    description: 'Maximum number of tasks to return (default 20, max 50)',
                    minimum: 1,
                    maximum: 50,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'List of tasks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tasks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Task' },
                    },
                  },
                },
              },
            },
          },
          ...actionErrorResponses,
        },
        security: [{ BearerAuth: [] }],
      },
    },
    '/api/mcp/actions/create_task': {
      post: {
        operationId: 'createTask',
        summary: 'Create a new task',
        description: 'Create a new task using natural language. The input will be parsed to extract title, due date, priority, context, people, and tags automatically.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['input'],
                properties: {
                  input: {
                    type: 'string',
                    maxLength: 2000,
                    description: 'Natural language task description (e.g., "Call John about the project tomorrow at 2pm - high priority")',
                  },
                  source_agent_id: {
                    type: 'string',
                    maxLength: 160,
                    description: 'Optional stable identifier for the agent creating the task',
                  },
                  external_ref: {
                    type: 'string',
                    maxLength: 160,
                    description:
                      'Optional idempotency/reference id from the calling agent system. Requires source_agent_id; replays with the same source_agent_id and external_ref return the existing task.',
                  },
                  agent_metadata: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Optional structured metadata from the calling agent',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Created task',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    task: { $ref: '#/components/schemas/Task' },
                  },
                },
              },
            },
          },
          ...actionErrorResponses,
        },
        security: [{ BearerAuth: [] }],
      },
    },
    '/api/mcp/actions/complete_task': {
      post: {
        operationId: 'completeTask',
        summary: 'Complete a task',
        description: 'Mark a task as completed.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['task_id'],
                properties: {
                  task_id: {
                    type: 'string',
                    description: 'The ID of the task to complete',
                  },
                  source_agent_id: {
                    type: 'string',
                    maxLength: 160,
                    description: 'Optional stable identifier for the agent completing the task',
                  },
                  external_ref: {
                    type: 'string',
                    maxLength: 160,
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
                    additionalProperties: true,
                    description: 'Optional structured metadata from the calling agent',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated task',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    task: { $ref: '#/components/schemas/Task' },
                  },
                },
              },
            },
          },
          ...actionErrorResponses,
        },
        security: [{ BearerAuth: [] }],
      },
    },
    '/api/mcp/actions/update_task': {
      post: {
        operationId: 'updateTask',
        summary: 'Update a task',
        description: 'Update an existing task. Only provide fields you want to change.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['task_id'],
                properties: {
                  task_id: {
                    type: 'string',
                    description: 'The ID of the task to update',
                  },
                  title: {
                    type: 'string',
                    maxLength: 500,
                    description: 'New title for the task',
                  },
                  priority: {
                    type: 'string',
                    enum: ['urgent', 'high', 'medium', 'low'],
                    description: 'New priority level',
                  },
                  due_date: {
                    type: 'string',
                    format: 'date',
                    description: 'New due date in YYYY-MM-DD format',
                  },
                  status: {
                    type: 'string',
                    enum: ['todo', 'in_progress', 'waiting', 'done'],
                    description: 'New status',
                  },
                  context: {
                    type: 'string',
                    maxLength: 4000,
                    description: 'Additional context or notes about the task',
                  },
                  source_agent_id: {
                    type: 'string',
                    maxLength: 160,
                    description: 'Optional stable identifier for the agent updating the task',
                  },
                  external_ref: {
                    type: 'string',
                    maxLength: 160,
                    description: 'Optional idempotency/reference id from the calling agent system',
                  },
                  ingestion_intent: {
                    type: 'string',
                    enum: ['create', 'update', 'complete', 'auto'],
                    description: 'How the agent intended this task mutation to be interpreted',
                  },
                  agent_metadata: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Optional structured metadata from the calling agent',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated task',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    task: { $ref: '#/components/schemas/Task' },
                  },
                },
              },
            },
          },
          ...actionErrorResponses,
        },
        security: [{ BearerAuth: [] }],
      },
    },
    '/api/mcp/actions/get_briefing': {
      post: {
        operationId: 'getBriefing',
        summary: 'Get daily briefing',
        description: "Get today's AI-generated briefing including top priorities, overdue tasks, quick wins, and tasks where someone is waiting.",
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Daily briefing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Briefing' },
              },
            },
          },
          ...actionErrorResponses,
        },
        security: [{ BearerAuth: [] }],
      },
    },
    '/api/mcp/actions/search_tasks': {
      post: {
        operationId: 'searchTasks',
        summary: 'Search tasks',
        description: 'Search tasks by keyword. Searches in title, context, and tags.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: {
                    type: 'string',
                    maxLength: 200,
                    description: 'Search query',
                  },
                  limit: {
                    type: 'integer',
                    description: 'Maximum results (default 10)',
                    minimum: 1,
                    maximum: 50,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tasks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Task' },
                    },
                  },
                },
              },
            },
          },
          ...actionErrorResponses,
        },
        security: [{ BearerAuth: [] }],
      },
    },
    '/api/mcp/actions/get_task': {
      post: {
        operationId: 'getTask',
        summary: 'Get task details',
        description: 'Get full details of a specific task including agent output.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['task_id'],
                properties: {
                  task_id: {
                    type: 'string',
                    description: 'The ID of the task',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    task: { $ref: '#/components/schemas/TaskDetails' },
                  },
                },
              },
            },
          },
          ...actionErrorResponses,
        },
        security: [{ BearerAuth: [] }],
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Your Nexdo API key (starts with nxd_)',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          source: {
            type: 'string',
            enum: ['manual', 'email', 'voice', 'api', 'agent'],
          },
          priority: {
            type: 'string',
            enum: ['urgent', 'high', 'medium', 'low'],
          },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'waiting', 'done'],
          },
          due_date: { type: 'string', format: 'date', nullable: true },
          due_time: { type: 'string', nullable: true },
          context: { type: 'string', nullable: true },
          action_type: {
            type: 'string',
            enum: ['manual', 'research', 'draft', 'prep', 'remind'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            nullable: true,
          },
          people: {
            type: 'array',
            items: { type: 'string' },
            nullable: true,
          },
          estimated_minutes: { type: 'integer', nullable: true },
          source_agent_id: { type: 'string', nullable: true },
          external_ref: { type: 'string', nullable: true },
          idempotent_replay: { type: 'boolean' },
          ingestion_intent: {
            type: 'string',
            enum: ['create', 'update', 'complete', 'auto'],
            nullable: true,
          },
        },
      },
      TaskDetails: {
        allOf: [
          { $ref: '#/components/schemas/Task' },
          {
            type: 'object',
            properties: {
              description: { type: 'string', nullable: true },
              raw_input: { type: 'string', nullable: true },
              energy_level: {
                type: 'string',
                enum: ['deep', 'light', 'quick'],
                nullable: true,
              },
              agent_output: { type: 'object', nullable: true },
              completed_at: { type: 'string', format: 'date-time', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      Briefing: {
        type: 'object',
        properties: {
          greeting: { type: 'string' },
          top_priorities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task_id: { type: 'string' },
                title: { type: 'string' },
                reasoning: { type: 'string' },
              },
            },
          },
          overdue: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task_id: { type: 'string' },
                title: { type: 'string' },
                days_overdue: { type: 'integer' },
              },
            },
          },
          quick_wins: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task_id: { type: 'string' },
                title: { type: 'string' },
                estimated_minutes: { type: 'integer' },
              },
            },
          },
          someone_waiting: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task_id: { type: 'string' },
                title: { type: 'string' },
                person: { type: 'string' },
              },
            },
          },
          summary: { type: 'string' },
        },
      },
    },
  },
}

// ChatGPT fetches the OpenAPI spec from a browser context, so CORS must
// permit the request. We keep this public (the spec is not sensitive),
// but tighten CORS on the action endpoints themselves separately.
export async function GET(request: Request) {
  return NextResponse.json({
    ...openApiSpec,
    servers: [
      {
        url: resolveServerUrl(request),
        description: 'Nexdo API',
      },
    ],
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
