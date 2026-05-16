import { expect, test } from '@playwright/test'

const actionTools = [
  'list_tasks',
  'create_task',
  'complete_task',
  'update_task',
  'get_briefing',
  'search_tasks',
  'get_task',
]

test('OpenAPI exposes the agent action contract', async ({ request }) => {
  const response = await request.get('/api/mcp/openapi')
  expect(response.ok()).toBeTruthy()

  const spec = await response.json()
  expect(spec.openapi).toBe('3.0.0')
  expect(spec.info.title).toBe('Nexdo API')
  expect(spec.components.securitySchemes.BearerAuth).toMatchObject({
    type: 'http',
    scheme: 'bearer',
  })

  const operationIds = new Set<string>()
  for (const tool of actionTools) {
    const path = spec.paths[`/api/mcp/actions/${tool}`]
    expect(path, `${tool} path should exist`).toBeTruthy()
    expect(path.post.security).toEqual([{ BearerAuth: [] }])
    expect(path.post.responses['401']).toBeTruthy()
    expect(path.post.responses['403'].description).toContain('scope')
    expect(path.post.operationId).toBeTruthy()
    operationIds.add(path.post.operationId)
  }

  expect(operationIds.size).toBe(actionTools.length)
  const createTaskSchema =
    spec.paths['/api/mcp/actions/create_task'].post.requestBody.content[
      'application/json'
    ].schema
  expect(createTaskSchema.properties.source_agent_id).toBeTruthy()
  expect(createTaskSchema.properties.external_ref.description).toContain(
    'source_agent_id'
  )
  expect(createTaskSchema.properties.agent_metadata).toBeTruthy()
  expect(spec.components.schemas.Task.properties.source_agent_id).toBeTruthy()
  expect(spec.components.schemas.Task.properties.idempotent_replay).toBeTruthy()
  expect(spec.components.schemas.Task.properties.ingestion_intent).toBeTruthy()
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
