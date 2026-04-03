import { NextResponse } from 'next/server'

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
      url: 'https://nexdo-web-staging.up.railway.app',
      description: 'Production server',
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
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
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
                    description: 'Natural language task description (e.g., "Call John about the project tomorrow at 2pm - high priority")',
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
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
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
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
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
                    description: 'Additional context or notes about the task',
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
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
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
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
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
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
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
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
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
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
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
              action_type: {
                type: 'string',
                enum: ['manual', 'research', 'draft', 'prep', 'remind'],
              },
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

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
