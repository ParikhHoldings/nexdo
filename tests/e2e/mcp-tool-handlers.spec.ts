import { expect, test } from '@playwright/test'
import {
  executeToolWithDependencies,
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
  TaskStatus,
} from '../../lib/database.types'

type TableName = 'tasks' | 'profiles' | 'agent_action_events'
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

function parseResult<T>(result: ToolResult): T {
  return JSON.parse(result.content[0].text) as T
}

class FakeSupabase {
  tasks: Row[]
  profiles: Row[]
  agentActionEvents: Row[]
  private idCounter = 1

  constructor(input: { tasks?: Row[]; profiles?: Row[] } = {}) {
    this.tasks = input.tasks ? [...input.tasks] : []
    this.profiles = input.profiles ? [...input.profiles] : []
    this.agentActionEvents = []
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
        title: 'Follow up with design',
        due_date: null,
        status: 'waiting',
        context: 'Client approval needed',
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
      { query: 'client', limit: 10 },
      'user-1',
      deps
    )
  )
  expect(searched.map((task) => task.id)).toEqual(['waiting-task'])

  const task = parseResult<{ id: string; agent_output: unknown }>(
    await executeToolWithDependencies(
      'get_task',
      { task_id: 'waiting-task' },
      'user-1',
      deps
    )
  )
  expect(task.id).toBe('waiting-task')
  expect(task.agent_output).toBeNull()

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
    'get_briefing',
  ])
  expect(db.agentActionEvents.every((event) => event.success)).toBe(true)
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
    source_agent_id: string
    external_ref: string
  }>(
    await executeToolWithDependencies(
      'update_task',
      {
        task_id: 'owned-task',
        title: 'Updated by agent',
        status: 'waiting',
        context: '  Needs customer input  ',
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
    status: 'waiting',
    context: 'Needs customer input',
    source_agent_id: 'agent-beta',
    external_ref: 'ticket-456',
  })
  expect(db.tasks.find((task) => task.id === 'owned-task')).toMatchObject({
    source: 'agent',
    ingestion_intent: 'update',
    agent_metadata: { confidence: 'high' },
  })

  const completed = parseResult<{ id: string; status: TaskStatus }>(
    await executeToolWithDependencies(
      'complete_task',
      { task_id: 'owned-task' },
      'user-1',
      deps
    )
  )
  expect(completed).toMatchObject({ id: 'owned-task', status: 'done' })
  expect(db.tasks.find((task) => task.id === 'owned-task')?.completed_at).toBeTruthy()
  expect(db.tasks.find((task) => task.id === 'other-task')?.status).toBe('todo')

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
  expect(db.agentActionEvents.map((event) => event.success)).toEqual([
    true,
    true,
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
