import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { formatActionToolResult } from '../../lib/mcp-action-results'
import { MCP_TOOLS } from '../../lib/mcp-tools'

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
  const insertGrant = migration.match(
    /grant insert \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  const updateGrant = migration.match(
    /grant update \(([\s\S]*?)\) on table tasks to authenticated;/i
  )?.[1]
  expect(insertGrant).toBeTruthy()
  expect(updateGrant).toBeTruthy()

  for (const grant of [insertGrant, updateGrant]) {
    expect(grant).not.toContain('agent_output')
    expect(grant).not.toContain('source_agent_id')
    expect(grant).not.toContain('external_ref')
    expect(grant).not.toContain('ingestion_intent')
    expect(grant).not.toContain('agent_metadata')
    expect(grant).not.toContain('completed_at')
    expect(grant).not.toContain('updated_at')
  }

  const taskRoute = readFileSync('app/api/tasks/[id]/route.ts', 'utf8')
  expect(taskRoute).toContain('createClient, createServiceClient')
  expect(taskRoute).toContain('validateTaskPatch(body)')
  expect(taskRoute).toContain('const service = await createServiceClient()')
  expect(taskRoute).toContain('.update(updates)')
  expect(taskRoute).toContain(".eq('user_id', user.id)")

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
