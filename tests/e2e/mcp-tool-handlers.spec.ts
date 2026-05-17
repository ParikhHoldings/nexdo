import { expect, test } from '@playwright/test'
import {
  executeToolWithDependencies,
  MCP_TOOLS,
  type MCPToolDependencies,
  type ToolResult,
  validateApiKeyWithDependencies,
} from '../../lib/mcp-tools'
import { apiKeyHint, hashApiKey } from '../../lib/api-keys'
import { getLocalDateKey } from '../../lib/dates'
import type {
  BriefingContent,
  ParsedTask,
  Task,
  TaskNote,
  TaskStatus,
} from '../../lib/database.types'

type TableName = 'tasks' | 'profiles' | 'agent_action_events' | 'task_notes'
type Row = Record<string, any>
type QueryError = { message: string; code?: string } | null
type QueryResult = { data: any; error: QueryError }

interface Filter {
  field: string
  value: unknown
}

interface InFilter {
  field: string
  values: unknown[]
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Review launch plan',
    raw_input: 'Review launch plan',
    description: null,
    status: 'todo',
    priority: 'high',
    due_date: '2026-05-18',
    due_time: null,
    context: 'Launch checklist',
    source: 'manual',
    action_type: 'prep',
    estimated_minutes: 25,
    energy_level: 'deep',
    people: [],
    tags: ['launch'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: '2026-05-16T12:00:00.000Z',
    updated_at: '2026-05-16T12:00:00.000Z',
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
    ...overrides,
  }
}

function makeTaskNote(overrides: Partial<TaskNote> = {}): TaskNote {
  return {
    id: 'note-1',
    task_id: 'task-1',
    content: 'Preserve this handoff context.',
    note_type: 'note',
    created_at: '2026-05-16T12:05:00.000Z',
    ...overrides,
  }
}

function parseResult<T>(result: ToolResult): T {
  return JSON.parse(result.content[0].text) as T
}

class FakeSupabase {
  tasks: Row[]
  taskNotes: Row[]
  profiles: Row[]
  agentActionEvents: Row[]
  insertErrors: Partial<Record<TableName, NonNullable<QueryError>>>
  private idCounter = 1

  constructor(input: {
    tasks?: Row[]
    taskNotes?: Row[]
    profiles?: Row[]
    insertErrors?: Partial<Record<TableName, NonNullable<QueryError>>>
  } = {}) {
    this.tasks = input.tasks ? [...input.tasks] : []
    this.taskNotes = input.taskNotes ? [...input.taskNotes] : []
    this.profiles = input.profiles ? [...input.profiles] : []
    this.agentActionEvents = []
    this.insertErrors = input.insertErrors ?? {}
  }

  from(table: TableName) {
    return new FakeQuery(this, table)
  }

  nextId(prefix: string) {
    const id = `${prefix}-${this.idCounter}`
    this.idCounter += 1
    return id
  }

  tableRows(table: TableName) {
    if (table === 'tasks') return this.tasks
    if (table === 'task_notes') return this.taskNotes
    if (table === 'profiles') return this.profiles
    return this.agentActionEvents
  }
}

class FakeQuery {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private filters: Filter[] = []
  private inFilters: InFilter[] = []
  private limitCount: number | null = null
  private orderBy: { field: string; ascending: boolean; nullsFirst?: boolean } | null =
    null
  private insertRows: Row[] = []
  private updateFields: Row | null = null

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: TableName
  ) {}

  select(_columns = '*') {
    return this
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, value })
    return this
  }

  in(field: string, values: unknown[]) {
    this.inFilters.push({ field, values })
    return this
  }

  order(
    field: string,
    options: { ascending?: boolean; nullsFirst?: boolean } = {}
  ) {
    this.orderBy = {
      field,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst,
    }
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  insert(payload: Row | Row[]) {
    this.operation = 'insert'
    this.insertRows = Array.isArray(payload) ? payload : [payload]
    return this
  }

  update(payload: Row) {
    this.operation = 'update'
    this.updateFields = payload
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  async maybeSingle(): Promise<QueryResult> {
    const result = await this.execute()
    if (result.error) return result
    const rows = Array.isArray(result.data) ? result.data : [result.data]
    return { data: rows[0] ?? null, error: null }
  }

  async single(): Promise<QueryResult> {
    const result = await this.execute()
    if (result.error) return result
    const rows = Array.isArray(result.data) ? result.data : [result.data]
    if (!rows[0]) return { data: null, error: { message: 'No rows returned' } }
    return { data: rows[0], error: null }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<QueryResult> {
    if (this.operation === 'insert') {
      return this.executeInsert()
    }

    if (this.operation === 'update') {
      return this.executeUpdate()
    }

    if (this.operation === 'delete') {
      return this.executeDelete()
    }

    return { data: this.applyQuery(this.db.tableRows(this.table)), error: null }
  }

  private executeInsert(): QueryResult {
    const insertError = this.db.insertErrors[this.table]
    if (insertError) {
      return { data: null, error: insertError }
    }

    const rows = this.db.tableRows(this.table)
    const inserted = this.insertRows.map((row) => ({
      id:
        row.id ??
        this.db.nextId(this.table === 'agent_action_events' ? 'event' : 'row'),
      created_at: row.created_at ?? '2026-05-16T12:00:00.000Z',
      updated_at: row.updated_at ?? '2026-05-16T12:00:00.000Z',
      ...row,
    }))
    rows.push(...inserted)
    return { data: inserted, error: null }
  }

  private executeUpdate(): QueryResult {
    const rows = this.db.tableRows(this.table)
    const matched = this.applyFilters(rows)
    matched.forEach((row) => Object.assign(row, this.updateFields))
    return { data: matched, error: null }
  }

  private executeDelete(): QueryResult {
    const rows = this.db.tableRows(this.table)
    const matched = new Set(this.applyFilters(rows))
    const deleted = rows.filter((row) => matched.has(row))
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (matched.has(rows[index])) rows.splice(index, 1)
    }
    return { data: deleted, error: null }
  }

  private applyQuery(rows: Row[]) {
    let result = [...this.applyFilters(rows)]

    if (this.orderBy) {
      const { field, ascending, nullsFirst } = this.orderBy
      result = result.sort((a, b) => {
        const left = a[field]
        const right = b[field]
        if (left == null && right == null) return 0
        if (left == null) return nullsFirst ? -1 : 1
        if (right == null) return nullsFirst ? 1 : -1
        if (left === right) return 0
        const direction = left > right ? 1 : -1
        return ascending ? direction : -direction
      })
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount)
    }

    return result
  }

  private applyFilters(rows: Row[]) {
    return rows
      .filter((row) =>
        this.filters.every((filter) => row[filter.field] === filter.value)
      )
      .filter((row) =>
        this.inFilters.every((filter) =>
          filter.values.includes(row[filter.field])
        )
      )
  }
}

function dependenciesFor(
  db: FakeSupabase,
  overrides: Partial<MCPToolDependencies> = {}
): MCPToolDependencies {
  const parsedTask: ParsedTask = {
    title: 'Parsed launch task',
    due_date: '2026-05-18',
    due_time: '09:30',
    priority: 'high',
    context: 'Parsed context',
    people: ['Nate'],
    tags: ['launch'],
    action_type: 'draft',
    estimated_minutes: 20,
    energy_level: 'light',
  }

  return {
    createServiceClient: async () => db as any,
    parseTaskInput: async () => parsedTask,
    generateBriefing: async (tasks, userName): Promise<BriefingContent> => ({
      greeting: `Good morning, ${userName}`,
      top_priorities: tasks.map((task, index) => ({
        task_id: task.id,
        title: task.title,
        reasoning: `Priority ${index + 1}`,
      })),
      overdue: [],
      quick_wins: [],
      someone_waiting: [],
      summary: `${tasks.length} active tasks`,
    }),
    checkQuota: async (userId, kind) => ({
      allowed: true,
      limit: 100,
      used: 1,
      tier: 'power',
      reason: `${userId}:${kind}`,
    }),
    consumeQuota: async (userId, kind) => ({
      allowed: true,
      limit: 100,
      used: 1,
      tier: 'power',
      reason: `${userId}:${kind}`,
    }),
    ...overrides,
  }
}

test('DB-backed MCP read handlers filter, search, brief, and audit owned tasks', async () => {
  const today = getLocalDateKey()
  const db = new FakeSupabase({
    profiles: [{ id: 'user-1', full_name: 'Maya' }],
    taskNotes: [
      makeTaskNote({
        id: 'waiting-note',
        task_id: 'waiting-task',
        content: 'Casey owns the approval context.',
      }),
    ],
    tasks: [
      makeTask({
        id: 'today-task',
        user_id: 'user-1',
        title: 'Prepare launch briefing',
        due_date: today,
        status: 'todo',
        tags: ['launch'],
      }),
      makeTask({
        id: 'waiting-task',
        user_id: 'user-1',
        title: 'Follow up with approval',
        due_date: null,
        status: 'waiting',
        context: 'Client approval needed',
        people: ['Casey Lee'],
        tags: ['client'],
      }),
      makeTask({
        id: 'done-task',
        user_id: 'user-1',
        title: 'Archived launch note',
        status: 'done',
        tags: ['archive'],
      }),
      makeTask({
        id: 'other-user-task',
        user_id: 'user-2',
        title: 'Prepare launch briefing',
        due_date: today,
      }),
    ],
  })
  const deps = dependenciesFor(db)

  const listed = parseResult<Array<{ id: string }>>(
    await executeToolWithDependencies(
      'list_tasks',
      { status: 'todo', due_today: true, limit: 10 },
      'user-1',
      deps
    )
  )
  expect(listed.map((task) => task.id)).toEqual(['today-task'])

  const searched = parseResult<Array<{ id: string }>>(
    await executeToolWithDependencies(
      'search_tasks',
      { query: 'casey', limit: 10 },
      'user-1',
      deps
    )
  )
  expect(searched.map((task) => task.id)).toEqual(['waiting-task'])

  const task = parseResult<{
    id: string
    agent_output: unknown
    notes: Array<{ id: string; content: string }>
  }>(
    await executeToolWithDependencies(
      'get_task',
      { task_id: 'waiting-task' },
      'user-1',
      deps
    )
  )
  expect(task.id).toBe('waiting-task')
  expect(task.agent_output).toBeNull()
  expect(task.notes).toEqual([
    expect.objectContaining({
      id: 'waiting-note',
      content: 'Casey owns the approval context.',
    }),
  ])

  const missingTask = await executeToolWithDependencies(
    'get_task',
    { task_id: 'other-user-task' },
    'user-1',
    deps
  )
  expect(missingTask.isError).toBe(true)
  expect(missingTask.content[0].text).toContain('Task not found')

  const briefing = parseResult<BriefingContent>(
    await executeToolWithDependencies('get_briefing', {}, 'user-1', deps)
  )
  expect(briefing.greeting).toBe('Good morning, Maya')
  expect(briefing.top_priorities.map((item) => item.task_id)).toEqual([
    'today-task',
    'waiting-task',
  ])
  expect(db.agentActionEvents.map((event) => event.tool_name)).toEqual([
    'list_tasks',
    'search_tasks',
    'get_task',
    'get_task',
    'get_briefing',
  ])
  expect(db.agentActionEvents.map((event) => event.success)).toEqual([
    true,
    true,
    true,
    false,
    true,
  ])
})

test('DB-backed MCP execution fails closed before mutation when audit logging is unavailable', async () => {
  const db = new FakeSupabase({
    tasks: [
      makeTask({
        id: 'owned-task',
        user_id: 'user-1',
        title: 'Original task title',
      }),
    ],
    insertErrors: {
      agent_action_events: { message: 'audit table unavailable' },
    },
  })
  const deps = dependenciesFor(db)

  const result = await executeToolWithDependencies(
    'update_task',
    {
      task_id: 'owned-task',
      title: 'Unaudited update',
      source_agent_id: 'agent-audit',
      external_ref: 'trace-123',
    },
    'user-1',
    deps
  )

  expect(result.isError).toBe(true)
  expect(result.content[0].text).toContain(
    'Failed to record agent action event'
  )
  expect(db.tasks.find((task) => task.id === 'owned-task')?.title).toBe(
    'Original task title'
  )
  expect(db.agentActionEvents).toEqual([])
})

test('MCP tool schemas advertise all accepted task statuses', () => {
  const listTasks = MCP_TOOLS.find((tool) => tool.name === 'list_tasks')
  const updateTask = MCP_TOOLS.find((tool) => tool.name === 'update_task')
  const addTaskNote = MCP_TOOLS.find((tool) => tool.name === 'add_task_note')

  expect(listTasks?.inputSchema.properties.status).toMatchObject({
    enum: ['todo', 'in_progress', 'waiting', 'done', 'cancelled'],
  })
  expect(updateTask?.inputSchema.properties.status).toMatchObject({
    enum: ['todo', 'in_progress', 'waiting', 'done', 'cancelled'],
  })
  expect(updateTask?.inputSchema.properties.due_date).toMatchObject({
    type: ['string', 'null'],
  })
  expect(updateTask?.inputSchema.properties.context).toMatchObject({
    type: ['string', 'null'],
  })
  expect(updateTask?.inputSchema.properties.external_ref).toMatchObject({
    description: expect.stringContaining('source_agent_id'),
  })
  expect(addTaskNote?.inputSchema.properties.content).toMatchObject({
    maxLength: 2000,
  })
  expect(addTaskNote?.inputSchema.required).toEqual(['task_id', 'content'])
})

test('DB-backed MCP create_task pre-checks quota, inserts parsed agent tasks, records quota, and logs metadata', async () => {
  const db = new FakeSupabase()
  const callOrder: string[] = []
  const deps = dependenciesFor(db, {
    checkQuota: async (userId, kind) => {
      callOrder.push(`quota-check:${userId}:${kind}`)
      expect(db.tasks).toHaveLength(0)
      return {
        allowed: true,
        limit: 100,
        used: 2,
        tier: 'power',
      }
    },
    parseTaskInput: async (input) => {
      callOrder.push(`parse:${input}`)
      return {
        title: 'Draft investor update',
        due_date: '2026-05-18',
        due_time: '10:15',
        priority: 'urgent',
        context: 'Use launch readiness status',
        people: ['Ari'],
        tags: ['investors'],
        action_type: 'draft',
        estimated_minutes: 30,
        energy_level: 'deep',
      }
    },
    consumeQuota: async (userId, kind) => {
      callOrder.push(`quota-consume:${userId}:${kind}`)
      expect(db.tasks).toHaveLength(1)
      return {
        allowed: true,
        limit: 100,
        used: 2,
        tier: 'power',
      }
    },
  })

  const result = parseResult<{
    id: string
    title: string
    source: string
    source_agent_id: string
    external_ref: string
    idempotent_replay: boolean
  }>(
    await executeToolWithDependencies(
      'create_task',
      {
        input: ' Draft an investor update ',
        source_agent_id: 'agent-alpha',
        external_ref: 'msg-123',
        agent_metadata: { channel: 'slack' },
      },
      'user-1',
      deps
    )
  )

  expect(callOrder).toEqual([
    'quota-check:user-1:task_create',
    'parse:Draft an investor update',
    'quota-consume:user-1:task_create',
  ])
  expect(result).toMatchObject({
    title: 'Draft investor update',
    source: 'agent',
    source_agent_id: 'agent-alpha',
    external_ref: 'msg-123',
    idempotent_replay: false,
  })
  expect(db.tasks).toHaveLength(1)
  expect(db.tasks[0]).toMatchObject({
    user_id: 'user-1',
    raw_input: 'Draft an investor update',
    due_time: '10:15',
    source: 'agent',
    source_agent_id: 'agent-alpha',
    external_ref: 'msg-123',
    ingestion_intent: 'create',
    agent_metadata: { channel: 'slack' },
  })
  expect(db.agentActionEvents[0]).toMatchObject({
    user_id: 'user-1',
    tool_name: 'create_task',
    source_agent_id: 'agent-alpha',
    external_ref: 'msg-123',
    success: true,
  })
  expect(db.agentActionEvents[0].metadata.argument_keys).toEqual([
    'agent_metadata',
    'external_ref',
    'input',
    'source_agent_id',
  ])
})

test('DB-backed MCP create_task stops before parsing when quota pre-check fails', async () => {
  const db = new FakeSupabase()
  const deps = dependenciesFor(db, {
    checkQuota: async () => ({
      allowed: false,
      limit: 25,
      used: 25,
      tier: 'free',
      reason: 'Monthly task limit reached',
    }),
    parseTaskInput: async () => {
      throw new Error('parse should not run when quota pre-check fails')
    },
    consumeQuota: async () => {
      throw new Error('quota should not be consumed when pre-check fails')
    },
  })

  const result = await executeToolWithDependencies(
    'create_task',
    { input: 'Draft a launch recap' },
    'user-1',
    deps
  )

  expect(result.isError).toBe(true)
  expect(result.content[0].text).toContain('Monthly task limit reached')
  expect(db.tasks).toHaveLength(0)
  expect(db.agentActionEvents[0]).toMatchObject({
    tool_name: 'create_task',
    success: false,
  })
})

test('DB-backed MCP create_task removes inserted tasks when quota accounting fails', async () => {
  const db = new FakeSupabase()
  const deps = dependenciesFor(db, {
    consumeQuota: async () => ({
      allowed: false,
      limit: 100,
      used: 3,
      tier: 'power',
      reason: 'Failed to record usage',
    }),
  })

  const result = await executeToolWithDependencies(
    'create_task',
    { input: 'Draft a launch recap' },
    'user-1',
    deps
  )

  expect(result.isError).toBe(true)
  expect(result.content[0].text).toContain('Failed to record usage')
  expect(db.tasks).toHaveLength(0)
  expect(db.agentActionEvents[0]).toMatchObject({
    tool_name: 'create_task',
    success: false,
  })
})

test('DB-backed MCP create_task replays idempotent agent refs without parsing or quota', async () => {
  const db = new FakeSupabase({
    tasks: [
      makeTask({
        id: 'existing-task',
        user_id: 'user-1',
        title: 'Existing agent task',
        source: 'agent',
        source_agent_id: 'agent-alpha',
        external_ref: 'msg-123',
        ingestion_intent: 'create',
      }),
    ],
  })
  const deps = dependenciesFor(db, {
    checkQuota: async () => {
      throw new Error('quota pre-check should not run for idempotent replay')
    },
    parseTaskInput: async () => {
      throw new Error('parse should not run for idempotent replay')
    },
    consumeQuota: async () => {
      throw new Error('quota should not run for idempotent replay')
    },
  })

  const result = parseResult<{ id: string; idempotent_replay: boolean }>(
    await executeToolWithDependencies(
      'create_task',
      {
        input: 'Existing agent task',
        source_agent_id: 'agent-alpha',
        external_ref: 'msg-123',
      },
      'user-1',
      deps
    )
  )

  expect(result).toEqual(
    expect.objectContaining({
      id: 'existing-task',
      idempotent_replay: true,
    })
  )
  expect(db.tasks).toHaveLength(1)
  expect(db.agentActionEvents[0]).toMatchObject({
    tool_name: 'create_task',
    success: true,
  })
})

test('DB-backed MCP mutation handlers update owned tasks and log failures', async () => {
  const db = new FakeSupabase({
    tasks: [
      makeTask({
        id: 'owned-task',
        user_id: 'user-1',
        status: 'todo',
        context: 'Original context',
      }),
      makeTask({
        id: 'other-task',
        user_id: 'user-2',
        status: 'todo',
      }),
    ],
  })
  const deps = dependenciesFor(db)

  const updated = parseResult<{
    id: string
    title: string
    status: TaskStatus
    context: string
    due_date: string
    due_time: string
    action_type: string
    estimated_minutes: number
    energy_level: string
    people: string[]
    tags: string[]
    source_agent_id: string
    external_ref: string
  }>(
    await executeToolWithDependencies(
      'update_task',
      {
        task_id: 'owned-task',
        title: 'Updated by agent',
        status: 'cancelled',
        context: '  Needs customer input  ',
        due_date: '2026-05-19',
        due_time: '14:30',
        action_type: 'prep',
        estimated_minutes: 45.4,
        energy_level: 'deep',
        people: [' Customer Lead ', 'Ops'],
        tags: [' launch ', 'customer'],
        source_agent_id: 'agent-beta',
        external_ref: 'ticket-456',
        ingestion_intent: 'update',
        agent_metadata: { confidence: 'high' },
      },
      'user-1',
      deps
    )
  )
  expect(updated).toMatchObject({
    id: 'owned-task',
    title: 'Updated by agent',
    status: 'cancelled',
    context: 'Needs customer input',
    due_date: '2026-05-19',
    due_time: '14:30',
    action_type: 'prep',
    estimated_minutes: 45,
    energy_level: 'deep',
    people: ['Customer Lead', 'Ops'],
    tags: ['launch', 'customer'],
    source_agent_id: 'agent-beta',
    external_ref: 'ticket-456',
  })
  expect(db.tasks.find((task) => task.id === 'owned-task')).toMatchObject({
    source: 'agent',
    due_date: '2026-05-19',
    due_time: '14:30',
    action_type: 'prep',
    estimated_minutes: 45,
    energy_level: 'deep',
    people: ['Customer Lead', 'Ops'],
    tags: ['launch', 'customer'],
    ingestion_intent: 'update',
    agent_metadata: { confidence: 'high' },
  })

  const completed = parseResult<{ id: string; status: TaskStatus }>(
    await executeToolWithDependencies(
      'complete_task',
      {
        task_id: 'owned-task',
        source_agent_id: 'agent-beta',
        external_ref: 'ticket-456-complete',
        ingestion_intent: 'complete',
        agent_metadata: { confidence: 'high' },
      },
      'user-1',
      deps
    )
  )
  expect(completed).toMatchObject({ id: 'owned-task', status: 'done' })
  expect(db.tasks.find((task) => task.id === 'owned-task')).toMatchObject({
    completed_at: expect.any(String),
    source: 'agent',
    source_agent_id: 'agent-beta',
    external_ref: 'ticket-456-complete',
    ingestion_intent: 'complete',
    agent_metadata: { confidence: 'high' },
  })
  expect(db.tasks.find((task) => task.id === 'other-task')?.status).toBe('todo')
  expect(db.agentActionEvents[1]).toMatchObject({
    tool_name: 'complete_task',
    source_agent_id: 'agent-beta',
    external_ref: 'ticket-456-complete',
    ingestion_intent: 'complete',
    success: true,
  })

  const invalid = await executeToolWithDependencies(
    'update_task',
    {
      task_id: 'owned-task',
      agent_metadata: ['not allowed'],
    },
    'user-1',
    deps
  )
  expect(invalid.isError).toBe(true)
  expect(invalid.content[0].text).toContain('agent_metadata must be an object')

  const invalidStructuredField = await executeToolWithDependencies(
    'update_task',
    {
      task_id: 'owned-task',
      energy_level: 'whenever',
    },
    'user-1',
    deps
  )
  expect(invalidStructuredField.isError).toBe(true)
  expect(invalidStructuredField.content[0].text).toContain('energy_level')

  const invalidDueDate = await executeToolWithDependencies(
    'update_task',
    {
      task_id: 'owned-task',
      due_date: '2026-02-30',
    },
    'user-1',
    deps
  )
  expect(invalidDueDate.isError).toBe(true)
  expect(invalidDueDate.content[0].text).toContain('due_date')

  const invalidDueTime = await executeToolWithDependencies(
    'update_task',
    {
      task_id: 'owned-task',
      due_time: '29:00',
    },
    'user-1',
    deps
  )
  expect(invalidDueTime.isError).toBe(true)
  expect(invalidDueTime.content[0].text).toContain('due_time')

  const invalidUpdateTrace = await executeToolWithDependencies(
    'update_task',
    {
      task_id: 'owned-task',
      external_ref: 'missing-source',
    },
    'user-1',
    deps
  )
  expect(invalidUpdateTrace.isError).toBe(true)
  expect(invalidUpdateTrace.content[0].text).toContain(
    'source_agent_id is required'
  )

  const invalidComplete = await executeToolWithDependencies(
    'complete_task',
    {
      task_id: 'owned-task',
      external_ref: 'missing-source',
    },
    'user-1',
    deps
  )
  expect(invalidComplete.isError).toBe(true)
  expect(invalidComplete.content[0].text).toContain(
    'source_agent_id is required'
  )

  const missingUpdate = await executeToolWithDependencies(
    'update_task',
    { task_id: 'other-task', title: 'Should not update' },
    'user-1',
    deps
  )
  expect(missingUpdate.isError).toBe(true)
  expect(missingUpdate.content[0].text).toContain('Task not found')

  const missingComplete = await executeToolWithDependencies(
    'complete_task',
    { task_id: 'missing-task' },
    'user-1',
    deps
  )
  expect(missingComplete.isError).toBe(true)
  expect(missingComplete.content[0].text).toContain('Task not found')

  expect(db.agentActionEvents.map((event) => event.success)).toEqual([
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ])
})

test('DB-backed MCP add_task_note appends owned notes, validates input, and logs trace metadata', async () => {
  const db = new FakeSupabase({
    tasks: [
      makeTask({
        id: 'owned-task',
        user_id: 'user-1',
        title: 'Task with agent handoff',
      }),
      makeTask({
        id: 'other-task',
        user_id: 'user-2',
        title: 'Other user task',
      }),
    ],
  })
  const deps = dependenciesFor(db)

  const added = parseResult<{
    note: { id: string; task_id: string; content: string; note_type: string }
    task: { id: string; title: string }
  }>(
    await executeToolWithDependencies(
      'add_task_note',
      {
        task_id: 'owned-task',
        content: '  Agent found the decision link and next owner.  ',
        source_agent_id: 'agent-notes',
        external_ref: 'note-123',
        ingestion_intent: 'update',
        agent_metadata: { confidence: 'medium' },
      },
      'user-1',
      deps
    )
  )

  expect(added).toMatchObject({
    note: {
      task_id: 'owned-task',
      content: 'Agent found the decision link and next owner.',
      note_type: 'note',
    },
    task: {
      id: 'owned-task',
      title: 'Task with agent handoff',
    },
  })
  expect(db.taskNotes).toHaveLength(1)
  expect(db.taskNotes[0]).toMatchObject({
    task_id: 'owned-task',
    content: 'Agent found the decision link and next owner.',
    note_type: 'note',
  })
  expect(db.agentActionEvents[0]).toMatchObject({
    tool_name: 'add_task_note',
    source_agent_id: 'agent-notes',
    external_ref: 'note-123',
    ingestion_intent: 'update',
    success: true,
  })

  const details = parseResult<{
    id: string
    notes: Array<{ task_id: string; content: string }>
  }>(
    await executeToolWithDependencies(
      'get_task',
      { task_id: 'owned-task' },
      'user-1',
      deps
    )
  )
  expect(details.notes).toEqual([
    expect.objectContaining({
      task_id: 'owned-task',
      content: 'Agent found the decision link and next owner.',
    }),
  ])

  const invalidContent = await executeToolWithDependencies(
    'add_task_note',
    { task_id: 'owned-task', content: ' ' },
    'user-1',
    deps
  )
  expect(invalidContent.isError).toBe(true)
  expect(invalidContent.content[0].text).toContain('Note content is required')

  const invalidTrace = await executeToolWithDependencies(
    'add_task_note',
    {
      task_id: 'owned-task',
      content: 'Trace without a source should fail.',
      external_ref: 'missing-source',
    },
    'user-1',
    deps
  )
  expect(invalidTrace.isError).toBe(true)
  expect(invalidTrace.content[0].text).toContain('source_agent_id is required')

  const missingTask = await executeToolWithDependencies(
    'add_task_note',
    { task_id: 'other-task', content: 'Should not attach across users.' },
    'user-1',
    deps
  )
  expect(missingTask.isError).toBe(true)
  expect(missingTask.content[0].text).toContain('Task not found')
  expect(db.taskNotes).toHaveLength(1)
  expect(db.agentActionEvents.map((event) => event.success)).toEqual([
    true,
    true,
    false,
    false,
    false,
  ])
})

test('MCP API-key validation accepts hashed paid keys and records last use', async () => {
  const apiKey = 'nxd_power_key_123'
  const db = new FakeSupabase({
    profiles: [
      {
        id: 'power-user',
        api_key_hash: hashApiKey(apiKey),
        api_key_scopes: ['tasks:read'],
        subscription_tier: 'power',
        api_key_last_used_at: null,
      },
    ],
  })

  const result = await validateApiKeyWithDependencies(apiKey, dependenciesFor(db))

  expect(result).toEqual({
    userId: 'power-user',
    scopes: ['tasks:read'],
  })
  expect(db.profiles[0]).toMatchObject({
    api_key_hash: hashApiKey(apiKey),
    api_key_last_used_at: expect.any(String),
  })
})

test('MCP API-key validation migrates paid legacy keys to hashed storage', async () => {
  const apiKey = 'nxd_legacy_key_123'
  const db = new FakeSupabase({
    profiles: [
      {
        id: 'team-user',
        api_key: apiKey,
        api_key_hash: null,
        api_key_hint: null,
        api_key_scopes: ['tasks:read', 'briefing:read'],
        subscription_tier: 'team',
        api_key_last_used_at: null,
      },
    ],
  })

  const result = await validateApiKeyWithDependencies(apiKey, dependenciesFor(db))

  expect(result).toEqual({
    userId: 'team-user',
    scopes: ['tasks:read', 'briefing:read'],
  })
  expect(db.profiles[0]).toMatchObject({
    api_key: null,
    api_key_hash: hashApiKey(apiKey),
    api_key_hint: apiKeyHint(apiKey),
    api_key_last_used_at: expect.any(String),
  })
})

test('MCP API-key validation denies invalid prefixes and non-API tiers', async () => {
  const apiKey = 'nxd_free_key_123'
  const db = new FakeSupabase({
    profiles: [
      {
        id: 'free-user',
        api_key_hash: hashApiKey(apiKey),
        api_key_scopes: ['tasks:read'],
        subscription_tier: 'free',
        api_key_last_used_at: null,
      },
    ],
  })
  const deps = dependenciesFor(db)

  await expect(validateApiKeyWithDependencies('not-a-nexdo-key', deps)).resolves.toBeNull()
  await expect(validateApiKeyWithDependencies(apiKey, deps)).resolves.toBeNull()
  expect(db.profiles[0].api_key_last_used_at).toBeNull()
})
