import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { formatActionToolResult } from '../../lib/mcp-action-results'
import { isToolArgumentRecord, MCP_TOOLS } from '../../lib/mcp-tools'

const actionTools = MCP_TOOLS.map((tool) => tool.name)

test('OpenAPI exposes the agent action contract', async ({ request }) => {
  const response = await request.get('/api/mcp/openapi')
  expect(response.ok()).toBeTruthy()

  const spec = await response.json()
  const advertisedServerUrl = new URL(spec.servers[0].url)
  expect(spec.openapi).toBe('3.0.0')
  expect(spec.info.title).toBe('Nexdo API')
  expect(advertisedServerUrl.protocol).toBe('http:')
  expect(['127.0.0.1', 'localhost']).toContain(advertisedServerUrl.hostname)
  expect(advertisedServerUrl.port).toBe('3001')
  expect(spec.components.securitySchemes.BearerAuth).toMatchObject({
    type: 'http',
    scheme: 'bearer',
  })

  const operationIds = new Set<string>()
  for (const tool of actionTools) {
    const path = spec.paths[`/api/mcp/actions/${tool}`]
    expect(path, `${tool} path should exist`).toBeTruthy()
    expect(path.post.security).toEqual([{ BearerAuth: [] }])
    expect(path.post.responses['400'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    })
    expect(path.post.responses['401'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    })
    expect(path.post.responses['403'].description).toContain('scope')
    expect(path.post.responses['500'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    })
    expect(path.post.responses['503'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    })
    expect(path.post.operationId).toBeTruthy()
    operationIds.add(path.post.operationId)
  }

  expect(operationIds.size).toBe(actionTools.length)
  const listTaskSchema =
    spec.paths['/api/mcp/actions/list_tasks'].post.requestBody.content[
      'application/json'
    ].schema
  expect(listTaskSchema.properties.status.enum).toEqual([
    'todo',
    'in_progress',
    'waiting',
    'done',
    'cancelled',
  ])
  const createTaskSchema =
    spec.paths['/api/mcp/actions/create_task'].post.requestBody.content[
      'application/json'
    ].schema
  expect(createTaskSchema.properties.source_agent_id).toBeTruthy()
  expect(createTaskSchema.properties.input.maxLength).toBe(2000)
  expect(createTaskSchema.properties.source_agent_id.maxLength).toBe(160)
  expect(createTaskSchema.properties.external_ref.description).toContain(
    'source_agent_id'
  )
  expect(createTaskSchema.properties.external_ref.maxLength).toBe(160)
  expect(createTaskSchema.properties.agent_metadata).toBeTruthy()
  const completeTaskSchema =
    spec.paths['/api/mcp/actions/complete_task'].post.requestBody.content[
      'application/json'
    ].schema
  expect(completeTaskSchema.properties.source_agent_id.maxLength).toBe(160)
  expect(completeTaskSchema.properties.external_ref.description).toContain(
    'source_agent_id'
  )
  expect(completeTaskSchema.properties.agent_metadata).toBeTruthy()
  const updateTaskSchema =
    spec.paths['/api/mcp/actions/update_task'].post.requestBody.content[
      'application/json'
    ].schema
  expect(updateTaskSchema.properties.title.maxLength).toBe(500)
  expect(updateTaskSchema.properties.context.maxLength).toBe(4000)
  expect(updateTaskSchema.properties.due_date.nullable).toBe(true)
  expect(updateTaskSchema.properties.due_time.nullable).toBe(true)
  expect(updateTaskSchema.properties.context.nullable).toBe(true)
  expect(updateTaskSchema.properties.status.enum).toEqual([
    'todo',
    'in_progress',
    'waiting',
    'done',
    'cancelled',
  ])
  expect(updateTaskSchema.properties.action_type.enum).toEqual([
    'manual',
    'research',
    'draft',
    'prep',
    'remind',
  ])
  expect(updateTaskSchema.properties.estimated_minutes.maximum).toBe(10080)
  expect(updateTaskSchema.properties.energy_level.enum).toEqual([
    'deep',
    'light',
    'quick',
  ])
  expect(updateTaskSchema.properties.people.maxItems).toBe(50)
  expect(updateTaskSchema.properties.tags.items.maxLength).toBe(120)
  expect(updateTaskSchema.properties.external_ref.description).toContain(
    'source_agent_id'
  )
  const addTaskNoteSchema =
    spec.paths['/api/mcp/actions/add_task_note'].post.requestBody.content[
      'application/json'
    ].schema
  expect(addTaskNoteSchema.required).toEqual(['task_id', 'content'])
  expect(addTaskNoteSchema.properties.content.maxLength).toBe(2000)
  expect(addTaskNoteSchema.properties.source_agent_id.maxLength).toBe(160)
  expect(addTaskNoteSchema.properties.external_ref.description).toContain(
    'source_agent_id'
  )
  expect(
    spec.paths['/api/mcp/actions/add_task_note'].post.responses['200'].content[
      'application/json'
    ].schema.properties.note
  ).toEqual({ $ref: '#/components/schemas/TaskNote' })
  const searchTaskSchema =
    spec.paths['/api/mcp/actions/search_tasks'].post.requestBody.content[
      'application/json'
    ].schema
  expect(searchTaskSchema.properties.query.maxLength).toBe(200)
  expect(
    spec.paths['/api/mcp/actions/search_tasks'].post.description
  ).toContain('people')
  expect(spec.components.schemas.ErrorResponse.required).toContain('error')
  expect(spec.components.schemas.Task.properties.status.enum).toEqual([
    'todo',
    'in_progress',
    'waiting',
    'done',
    'cancelled',
  ])
  expect(spec.components.schemas.Task.properties.source_agent_id).toBeTruthy()
  expect(spec.components.schemas.Task.properties.idempotent_replay).toBeTruthy()
  expect(spec.components.schemas.Task.properties.ingestion_intent).toBeTruthy()
  expect(spec.components.schemas.Task.properties.energy_level).toBeTruthy()
  expect(spec.components.schemas.TaskDetails.allOf[1].properties.notes.items).toEqual({
    $ref: '#/components/schemas/TaskNote',
  })
  expect(spec.components.schemas.TaskNote.properties.note_type.enum).toEqual([
    'note',
    'agent_result',
    'link',
    'file',
  ])
})

test('ChatGPT Action formatter matches advertised response shapes', () => {
  expect(
    formatActionToolResult('list_tasks', {
      content: [{ type: 'text', text: JSON.stringify([{ id: 'task-1' }]) }],
    })
  ).toEqual({
    body: { tasks: [{ id: 'task-1' }] },
    status: 200,
  })

  expect(
    formatActionToolResult('search_tasks', {
      content: [{ type: 'text', text: JSON.stringify([{ id: 'task-2' }]) }],
    })
  ).toEqual({
    body: { tasks: [{ id: 'task-2' }] },
    status: 200,
  })

  expect(
    formatActionToolResult('get_briefing', {
      content: [{ type: 'text', text: JSON.stringify({ greeting: 'Good morning' }) }],
    })
  ).toEqual({
    body: { greeting: 'Good morning' },
    status: 200,
  })

  expect(
    formatActionToolResult('get_task', {
      content: [{ type: 'text', text: JSON.stringify({ id: 'task-3' }) }],
    })
  ).toEqual({
    body: { task: { id: 'task-3' } },
    status: 200,
  })

  expect(
    formatActionToolResult('add_task_note', {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            note: { id: 'note-1', task_id: 'task-3' },
            task: { id: 'task-3' },
          }),
        },
      ],
    })
  ).toEqual({
    body: {
      note: { id: 'note-1', task_id: 'task-3' },
      task: { id: 'task-3' },
    },
    status: 200,
  })

  expect(
    formatActionToolResult('create_task', {
      content: [{ type: 'text', text: 'Error: input is required' }],
      isError: true,
    })
  ).toEqual({
    body: { error: 'Error: input is required' },
    status: 400,
  })

  expect(
    formatActionToolResult('list_tasks', {
      content: [{ type: 'text', text: 'Database not configured' }],
      isError: true,
    })
  ).toEqual({
    body: { error: 'Database not configured' },
    status: 503,
  })

  expect(
    formatActionToolResult('update_task', {
      content: [
        {
          type: 'text',
          text: 'Error: Failed to record agent action event: audit table unavailable',
        },
      ],
      isError: true,
    })
  ).toEqual({
    body: {
      error: 'Error: Failed to record agent action event: audit table unavailable',
    },
    status: 500,
  })
})

test('agent endpoints enforce auth and advertise CORS for action clients', async ({
  request,
}) => {
  const preflight = await request.fetch('/api/mcp/actions/list_tasks', {
    method: 'OPTIONS',
  })
  expect(preflight.status()).toBe(204)
  expect(preflight.headers()['access-control-allow-origin']).toBe('*')
  expect(preflight.headers()['access-control-allow-headers']).toContain(
    'Authorization'
  )

  const action = await request.post('/api/mcp/actions/list_tasks', {
    data: { limit: 1 },
  })
  expect(action.status()).toBe(401)
  expect(action.headers()['access-control-allow-origin']).toBe('*')
  const actionBody = await action.json()
  expect(actionBody.error).toContain('Authorization header')

  const rpc = await request.post('/api/mcp', {
    data: { jsonrpc: '2.0', id: 1, method: 'initialize' },
  })
  expect(rpc.status()).toBe(401)
  const rpcBody = await rpc.json()
  expect(rpcBody.error.message).toContain('Authorization header')

  const sse = await request.get('/api/mcp')
  expect(sse.status()).toBe(401)
  const sseBody = await sse.json()
  expect(sseBody.error).toContain('Authorization header')

  const events = await request.get('/api/mcp/events')
  expect([401, 503]).toContain(events.status())
  const eventsBody = await events.json()
  expect(eventsBody.error).toBeTruthy()
})

test('agent endpoints reject non-object tool arguments before execution', () => {
  expect(isToolArgumentRecord({ limit: 1 })).toBe(true)
  expect(isToolArgumentRecord([])).toBe(false)
  expect(isToolArgumentRecord('limit=1')).toBe(false)
  expect(isToolArgumentRecord(null)).toBe(false)

  const rpcRoute = readFileSync('app/api/mcp/route.ts', 'utf8')
  const actionRoute = readFileSync('app/api/mcp/actions/[tool]/route.ts', 'utf8')

  expect(rpcRoute).toContain('Tool call params must be an object')
  expect(rpcRoute).toContain('Tool arguments must be a JSON object')
  expect(rpcRoute).toContain('!isToolArgumentRecord(params.arguments)')
  expect(actionRoute).toContain('Request body must be a JSON object')
  expect(actionRoute).toContain('!isToolArgumentRecord(parsed)')
})

test('billing checkout rejects unsupported client-selected plans', async ({
  request,
}) => {
  const response = await request.post('/api/stripe/checkout', {
    data: { plan: 'team', priceId: 'price_client_supplied' },
  })

  expect(response.status()).toBe(400)
  const body = await response.json()
  expect(body.error).toContain('Invalid plan')
})

test('agent execution maps quota service failures through shared status helper', () => {
  const source = readFileSync('app/api/agent/execute/route.ts', 'utf8')
  const servicePreflightIndex = source.indexOf(
    'const service = await createServiceClient()'
  )

  expect(source).toContain('status: quotaFailureStatus(preQuota)')
  expect(source).not.toContain(
    'quotaExceededResponse(preQuota), { status: 402 }'
  )
  expect(servicePreflightIndex).toBeGreaterThan(-1)
  expect(servicePreflightIndex).toBeLessThan(
    source.indexOf('const gate = await consumeRateLimit')
  )
  expect(servicePreflightIndex).toBeLessThan(
    source.indexOf('result = await executeResearch')
  )
  expect(servicePreflightIndex).toBeLessThan(
    source.indexOf("consumeQuota(auth.userId, 'agent_execute')")
  )
  expect(source.match(/const service = await createServiceClient\(\)/g)).toHaveLength(1)
})

test('server-managed task fields stay on service-role write paths', () => {
  const migration = readFileSync(
    'supabase/migrations/007_task_column_grants.sql',
    'utf8'
  )
  const sourceMigration = readFileSync(
    'supabase/migrations/009_task_source_grants.sql',
    'utf8'
  )
  const relationshipMigration = readFileSync(
    'supabase/migrations/016_task_relationship_grants.sql',
    'utf8'
  )
  const contentMigration = readFileSync(
    'supabase/migrations/010_task_content_constraints.sql',
    'utf8'
  )
  const noteMigration = readFileSync(
    'supabase/migrations/008_task_note_column_grants.sql',
    'utf8'
  )
  const metadataInsertGrant = migration.match(
    /grant insert \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  const metadataUpdateGrant = migration.match(
    /grant update \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  const insertGrant = sourceMigration.match(
    /grant insert \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  const updateGrant = sourceMigration.match(
    /grant update \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  const relationshipInsertGrant = relationshipMigration.match(
    /grant insert \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  const relationshipUpdateGrant = relationshipMigration.match(
    /grant update \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  expect(metadataInsertGrant).toBeTruthy()
  expect(metadataUpdateGrant).toBeTruthy()
  expect(insertGrant).toBeTruthy()
  expect(updateGrant).toBeTruthy()
  expect(relationshipInsertGrant).toBeTruthy()
  expect(relationshipUpdateGrant).toBeTruthy()
  expect(sourceMigration).toContain('revoke insert on table tasks from authenticated')
  expect(sourceMigration).toContain('revoke update on table tasks from authenticated')
  expect(relationshipMigration).toContain('revoke insert on table tasks from authenticated')
  expect(relationshipMigration).toContain('revoke update on table tasks from authenticated')
  expect(contentMigration).toContain('tasks_title_length')
  expect(contentMigration).toContain('char_length(btrim(title)) between 1 and 500')
  expect(contentMigration).toContain('tasks_context_length')
  expect(contentMigration).toContain('char_length(context) <= 4000')
  expect(contentMigration).toContain('tasks_estimated_minutes_bounds')
  expect(contentMigration).toContain('estimated_minutes between 0 and 10080')
  expect(contentMigration).toContain('tasks_people_bounds')
  expect(contentMigration).toContain('tasks_tags_bounds')
  expect(contentMigration).toContain('text_array_within_bounds')

  for (const grant of [metadataInsertGrant, metadataUpdateGrant, insertGrant, updateGrant]) {
    expect(grant).not.toContain('agent_output')
    expect(grant).not.toContain('source_agent_id')
    expect(grant).not.toContain('external_ref')
    expect(grant).not.toContain('ingestion_intent')
    expect(grant).not.toContain('agent_metadata')
    expect(grant).not.toContain('completed_at')
    expect(grant).not.toContain('updated_at')
  }
  expect(insertGrant).not.toMatch(/\bsource\b/)
  expect(updateGrant).not.toMatch(/\bsource\b/)
  for (const grant of [relationshipInsertGrant, relationshipUpdateGrant]) {
    expect(grant).not.toContain('parent_task_id')
    expect(grant).not.toContain('related_task_ids')
  }

  expect(noteMigration).toContain('revoke insert on table task_notes from authenticated')
  expect(noteMigration).toContain('revoke update on table task_notes from authenticated')
  expect(noteMigration).toContain('task_notes_content_length')
  expect(noteMigration).toContain('between 1 and 2000')
  const noteInsertGrant = noteMigration.match(
    /grant insert \(([\s\S]*?)\) on table task_notes to authenticated;/i
  )?.[1]
  expect(noteInsertGrant).toBeTruthy()
  expect(noteInsertGrant).toContain('task_id')
  expect(noteInsertGrant).toContain('content')
  expect(noteInsertGrant).not.toContain('note_type')
  expect(noteInsertGrant).not.toContain('created_at')

  const taskRoute = readFileSync('app/api/tasks/[id]/route.ts', 'utf8')
  expect(taskRoute).toContain('createClient, createServiceClient')
  expect(taskRoute).toContain('validateTaskPatch(body)')
  expect(taskRoute).toContain('const service = await createServiceClient()')
  expect(taskRoute).toContain('.update(updates)')
  expect(taskRoute).toContain(".eq('user_id', user.id)")

  const createTaskRoute = readFileSync('app/api/tasks/route.ts', 'utf8')
  expect(createTaskRoute).toContain('createClient, createServiceClient')
  expect(createTaskRoute).toContain('const service = await createServiceClient()')
  expect(createTaskRoute).toContain('const db = service as any')
  expect(createTaskRoute).toContain('source: validatedTask.source')

  const executeRoute = readFileSync('app/api/agent/execute/route.ts', 'utf8')
  expect(executeRoute).toContain('createClient, createServiceClient')
  expect(executeRoute).toContain('const service = await createServiceClient()')
  expect(executeRoute).toContain('agent_output: agentOutput')
  expect(executeRoute).toContain(".eq('user_id', auth.userId)")

  const reviewRoute = readFileSync(
    'app/api/tasks/[id]/agent-review/route.ts',
    'utf8'
  )
  expect(reviewRoute).toContain('createClient, createServiceClient')
  expect(reviewRoute).toContain('const service = await createServiceClient()')
  expect(reviewRoute).toContain('agent_output: reviewedOutput')
  expect(reviewRoute).toContain(".eq('user_id', user.id)")

  const notesRoute = readFileSync('app/api/tasks/[id]/notes/route.ts', 'utf8')
  expect(notesRoute).toContain('createClient, createServiceClient')
  expect(notesRoute).toContain('const service = await createServiceClient()')
  expect(notesRoute).toContain("note_type: 'note'")

  const supabaseSmoke = readFileSync('scripts/smoke-supabase.mjs', 'utf8')
  expect(supabaseSmoke).toContain('task_notes schema')
  expect(supabaseSmoke).toContain('direct task insert cannot spoof task source')
  expect(supabaseSmoke).toContain('direct task update cannot spoof task source')
  expect(supabaseSmoke).toContain('direct task insert cannot write relationship metadata')
  expect(supabaseSmoke).toContain('direct task update cannot write relationship metadata')
  expect(supabaseSmoke).toContain('direct task insert enforces task content bounds')
  expect(supabaseSmoke).toContain('direct task update enforces task content bounds')
  expect(supabaseSmoke).toContain('direct task note insert cannot write metadata columns')
  expect(supabaseSmoke).toContain('ok RLS task note insert')
  expect(supabaseSmoke).toContain('direct task note insert enforces content length')

  for (const route of [
    'csv',
    'google',
    'ics',
    'json',
    'microsoft',
    'todoist',
  ]) {
    const source = readFileSync(`app/api/import/${route}/route.ts`, 'utf8')
    expect(source).toContain('createClient, createServiceClient')
    expect(source).toContain('const service = await createServiceClient()')
    expect(source).toContain('const dbClient = service as any')
    expect(source).not.toContain('const dbClient = supabase as any')
    expect(source).toContain('checkImportQuota(userId')
    expect(source).toContain('recordImportQuota(')
  }
})

test('browser profile preference writes stay bounded', () => {
  const grants = readFileSync('supabase/migrations/006_profile_column_grants.sql', 'utf8')
  const insertGrants = readFileSync(
    'supabase/migrations/012_profile_insert_grants.sql',
    'utf8'
  )
  const constraints = readFileSync(
    'supabase/migrations/011_profile_content_constraints.sql',
    'utf8'
  )
  const profileRoute = readFileSync('app/api/profile/route.ts', 'utf8')
  const supabaseSmoke = readFileSync('scripts/smoke-supabase.mjs', 'utf8')
  const signupPage = readFileSync('app/auth/signup/page.tsx', 'utf8')

  expect(grants).toContain('grant update (full_name, timezone, work_type)')
  expect(grants).not.toContain('subscription_tier)')
  expect(grants).not.toContain('stripe_customer_id')
  expect(grants).not.toContain('api_key_hash')
  expect(insertGrants).toContain('revoke insert on table profiles from authenticated')
  expect(insertGrants).not.toContain('grant insert')

  expect(constraints).toContain('profiles_full_name_length')
  expect(constraints).toContain('char_length(btrim(full_name)) between 1 and 120')
  expect(constraints).toContain('profiles_timezone_allowed')
  expect(constraints).toContain("'America/Chicago'")
  expect(constraints).toContain("'America/Los_Angeles'")
  expect(constraints).toContain("'UTC'")

  expect(supabaseSmoke).toContain('profile self-update enforces content bounds')
  expect(supabaseSmoke).toContain('profile rows require server-owned creation')
  expect(supabaseSmoke).toContain('direct profile update accepted')
  expect(supabaseSmoke).toContain('direct profile insert was unexpectedly allowed')
  expect(profileRoute).toContain('const normalizedName = body.full_name.trim()')
  expect(profileRoute).toContain('updates.full_name = normalizedName || null')
  expect(signupPage).toContain('const normalizedFullName = fullName.trim()')
  expect(signupPage).toContain('full_name: normalizedFullName')
  expect(signupPage).toContain('maxLength={MAX_FULL_NAME}')
})

test('Stripe webhook event records stay service-owned', () => {
  const migration = readFileSync(
    'supabase/migrations/013_stripe_event_grants.sql',
    'utf8'
  )
  const webhookRoute = readFileSync('app/api/stripe/webhook/route.ts', 'utf8')
  const supabaseSmoke = readFileSync('scripts/smoke-supabase.mjs', 'utf8')

  expect(migration).toContain('alter table stripe_events enable row level security')
  expect(migration).toContain('revoke all on table stripe_events from anon')
  expect(migration).toContain('revoke all on table stripe_events from authenticated')
  expect(migration).not.toContain('grant ')

  expect(webhookRoute).toContain('createServiceClient')
  expect(webhookRoute).toContain(".from('stripe_events')")
  expect(webhookRoute).toContain("insert({ id: event.id, type: event.type })")

  expect(supabaseSmoke).toContain('Stripe event idempotency service insert')
  expect(supabaseSmoke).toContain('public cannot read Stripe webhook event records')
  expect(supabaseSmoke).toContain('browser clients cannot read Stripe webhook event records')
  expect(supabaseSmoke).toContain('Stripe webhook event records require service-owned writes')
  expect(supabaseSmoke).toContain('browser client could insert Stripe webhook event records')
})

test('quota telemetry and rate-limit buckets stay service-mutated', () => {
  const migration = readFileSync(
    'supabase/migrations/014_usage_rate_limit_grants.sql',
    'utf8'
  )
  const supabaseSmoke = readFileSync('scripts/smoke-supabase.mjs', 'utf8')
  const quotaSource = readFileSync('lib/quota.ts', 'utf8')
  const rateLimitSource = readFileSync('lib/rate-limit.ts', 'utf8')

  expect(migration).toContain('revoke insert, update, delete on table usage_events from anon')
  expect(migration).toContain(
    'revoke insert, update, delete on table usage_events from authenticated'
  )
  expect(migration).toContain('revoke all on table rate_limits from anon')
  expect(migration).toContain('revoke all on table rate_limits from authenticated')
  expect(migration).not.toContain('grant insert')
  expect(migration).not.toContain('grant update')

  expect(quotaSource).toContain("rpc('increment_usage'")
  expect(rateLimitSource).toContain("rpc('consume_rate_limit'")

  expect(supabaseSmoke).toContain('browser clients cannot insert usage events')
  expect(supabaseSmoke).toContain('browser clients cannot insert rate-limit buckets')
  expect(supabaseSmoke).toContain('usage events remain service-mutated')
  expect(supabaseSmoke).toContain('rate-limit buckets remain service-owned')
  expect(supabaseSmoke).toContain('browser client could update usage events directly')
  expect(supabaseSmoke).toContain('browser client could read rate-limit buckets directly')
})

test('daily briefing cache writes stay service-owned', () => {
  const migration = readFileSync(
    'supabase/migrations/015_daily_briefing_grants.sql',
    'utf8'
  )
  const supabaseSmoke = readFileSync('scripts/smoke-supabase.mjs', 'utf8')
  const briefingRoute = readFileSync('app/api/briefing/route.ts', 'utf8')

  expect(migration).toContain(
    'revoke insert, update, delete on table daily_briefings from anon'
  )
  expect(migration).toContain(
    'revoke insert, update, delete on table daily_briefings from authenticated'
  )
  expect(migration).not.toContain('grant insert')
  expect(migration).not.toContain('grant update')

  expect(supabaseSmoke).toContain('daily_briefings schema')
  expect(supabaseSmoke).toContain('daily briefing cache requires service-owned writes')
  expect(supabaseSmoke).toContain('browser client could insert daily briefing cache rows directly')

  expect(briefingRoute).not.toContain(".from('daily_briefings')")
})

test('Connect AI no-key guidance deep-links to API settings', () => {
  const source = readFileSync('app/(app)/settings/mcp/page.tsx', 'utf8')

  expect(source).toContain('href="/settings?tab=api"')
  expect(source).not.toContain('href="/settings" className="underline"')
})

test('MCP smoke can provision disposable scoped API keys', () => {
  const source = readFileSync('scripts/smoke-mcp.mjs', 'utf8')

  expect(source).toContain("const provisionKeys = args.has('--provision')")
  expect(source).toContain('async function assertMcpSseEndpoint')
  expect(source).toContain('async function rpcNotification')
  expect(source).toContain("await rpcNotification('notifications/initialized')")
  expect(source).toContain("'add_task_note'")
  expect(source).toContain("'/api/mcp/actions/add_task_note'")
  expect(source).toContain('VERCEL_AUTOMATION_BYPASS_SECRET')
  expect(source).toContain("'x-vercel-protection-bypass'")
  expect(source).toContain("completed?.source_agent_id !== sourceAgentId")
  expect(source).toContain("completed?.external_ref !== completeRef")
  expect(source).toContain("completed?.ingestion_intent !== 'complete'")
  expect(source).toContain("contentType.includes('text/event-stream')")
  expect(source).toContain("text.includes('event: endpoint')")
  expect(source).toContain('await assertMcpSseEndpoint()')
  expect(source).toContain('async function provisionSmokeKeys()')
  expect(source).toContain('async function createProvisionedProfile(')
  expect(source).toContain("subscription_tier: 'power'")
  expect(source).toContain('api_key_hash: hashApiKey(key)')
  expect(source).toContain("api_key_scopes: scopes")
  expect(source).toContain("password: randomBytes(24).toString('base64url')")
  const readOnlyProvision = source.match(
    /const readOnly = await createProvisionedProfile\(supabase, 'readonly', \[([\s\S]*?)\]\)/
  )
  expect(readOnlyProvision).toBeTruthy()
  const readOnlyScopes = readOnlyProvision?.[1] ?? ''
  expect(readOnlyScopes).toContain("'tasks:read'")
  expect(readOnlyScopes).toContain("'briefing:read'")
  expect(readOnlyScopes).not.toContain("'tasks:write'")
  expect(source).toContain(".from('profiles')")
  expect(source).toContain('await cleanupProvisionedUsers(supabase, users)')
  expect(source).toContain('await cleanupProvisionedUsers(provisioned.supabase, provisioned.users)')
})

test('MCP route accepts initialized notifications without a JSON-RPC id', () => {
  const source = readFileSync('app/api/mcp/route.ts', 'utf8')

  expect(source).toContain("method !== 'notifications/initialized'")
  expect(source).toContain('JSON-RPC id is required for this method')
  expect(source).toContain('return new NextResponse(null, { status: 204 })')
})
