#!/usr/bin/env node

const args = new Set(process.argv.slice(2))
const baseUrlArg = process.argv.find((arg) => arg.startsWith('--url='))
const baseUrl = (
  baseUrlArg?.slice('--url='.length) ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '')
const apiKey = process.env.NEXDO_API_KEY || process.env.NEXDO_MCP_API_KEY
const readOnlyApiKey =
  process.env.NEXDO_READONLY_API_KEY || process.env.NEXDO_MCP_READONLY_API_KEY
const allowWrite = args.has('--write')

const requiredReadTools = [
  'list_tasks',
  'search_tasks',
  'get_task',
]
const requiredWriteTools = ['create_task', 'complete_task', 'update_task']

if (!apiKey) {
  console.error('Missing NEXDO_API_KEY or NEXDO_MCP_API_KEY.')
  process.exit(1)
}

async function requestJson(path, body, key = apiKey) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  return { response, data }
}

async function postJson(path, body, key = apiKey) {
  const { response, data } = await requestJson(path, body, key)

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(data)}`)
  }

  return data
}

async function rpc(method, params, key = apiKey) {
  const data = await postJson('/api/mcp', {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  }, key)

  if (data.error) {
    throw new Error(`${method} returned JSON-RPC error: ${JSON.stringify(data.error)}`)
  }

  return data.result
}

function parseToolContent(result) {
  const text = result?.content?.[0]?.text
  if (!text) return null
  return JSON.parse(text)
}

async function assertReadOnlyKeyScope() {
  if (!readOnlyApiKey) {
    console.log('skip read-only scope checks; set NEXDO_READONLY_API_KEY to verify')
    return
  }

  await rpc('initialize', undefined, readOnlyApiKey)
  const readOnlyToolList = await rpc('tools/list', undefined, readOnlyApiKey)
  const readOnlyToolNames = new Set((readOnlyToolList.tools || []).map((tool) => tool.name))

  for (const tool of requiredReadTools) {
    if (!readOnlyToolNames.has(tool)) {
      throw new Error(`Read-only key missing readable tool: ${tool}`)
    }
  }

  for (const tool of requiredWriteTools) {
    if (readOnlyToolNames.has(tool)) {
      throw new Error(`Read-only key unexpectedly listed write tool: ${tool}`)
    }
  }

  const forbiddenRpc = await requestJson(
    '/api/mcp',
    {
      jsonrpc: '2.0',
      id: 'readonly-write-check',
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: { input: 'Read-only smoke should not create this task' },
      },
    },
    readOnlyApiKey
  )

  if (forbiddenRpc.response.status !== 403) {
    throw new Error(`Read-only JSON-RPC write returned ${forbiddenRpc.response.status}, expected 403`)
  }
  if (!forbiddenRpc.data?.error?.message?.includes('tasks:write')) {
    throw new Error('Read-only JSON-RPC write did not report missing tasks:write scope')
  }

  const forbiddenAction = await requestJson(
    '/api/mcp/actions/create_task',
    { input: 'Read-only action smoke should not create this task' },
    readOnlyApiKey
  )

  if (forbiddenAction.response.status !== 403) {
    throw new Error(`Read-only action write returned ${forbiddenAction.response.status}, expected 403`)
  }
  if (!forbiddenAction.data?.error?.includes('tasks:write')) {
    throw new Error('Read-only action write did not report missing tasks:write scope')
  }

  console.log('ok read-only scoped API key denies writes')
}

async function main() {
  console.log(`Smoking MCP at ${baseUrl}`)

  const initialize = await rpc('initialize')
  if (initialize.serverInfo?.name !== 'nexdo') {
    throw new Error('Unexpected MCP server name.')
  }
  console.log('ok initialize')

  const toolList = await rpc('tools/list')
  const toolNames = new Set((toolList.tools || []).map((tool) => tool.name))
  for (const tool of requiredReadTools) {
    if (!toolNames.has(tool)) throw new Error(`Missing MCP tool: ${tool}`)
  }
  if (allowWrite) {
    for (const tool of requiredWriteTools) {
      if (!toolNames.has(tool)) throw new Error(`Missing MCP write tool: ${tool}`)
    }
  }
  console.log('ok tools/list')

  const listResult = await rpc('tools/call', {
    name: 'list_tasks',
    arguments: { limit: 5 },
  })
  const tasks = parseToolContent(listResult)
  if (!Array.isArray(tasks)) throw new Error('list_tasks did not return an array.')
  console.log(`ok list_tasks (${tasks.length} returned)`)

  if (allowWrite) {
    const title = `MCP smoke test ${new Date().toISOString()}`
    const sourceAgentId = 'nexdo-smoke'
    const externalRef = `mcp-smoke-${Date.now()}`
    const createdResult = await rpc('tools/call', {
      name: 'create_task',
      arguments: {
        input: `${title} today high priority`,
        source_agent_id: sourceAgentId,
        external_ref: externalRef,
      },
    })
    const created = parseToolContent(createdResult)
    if (!created?.id) throw new Error('create_task did not return a task id.')
    console.log('ok create_task')

    const replayResult = await rpc('tools/call', {
      name: 'create_task',
      arguments: {
        input: `${title} today high priority`,
        source_agent_id: sourceAgentId,
        external_ref: externalRef,
      },
    })
    const replayed = parseToolContent(replayResult)
    if (replayed?.id !== created.id || replayed?.idempotent_replay !== true) {
      throw new Error('create_task idempotency replay did not return the original task.')
    }
    console.log('ok create_task idempotency')

    const completedResult = await rpc('tools/call', {
      name: 'complete_task',
      arguments: { task_id: created.id },
    })
    const completed = parseToolContent(completedResult)
    if (completed?.status !== 'done') {
      throw new Error('complete_task did not mark the smoke task done.')
    }
    console.log('ok complete_task')
  } else {
    console.log('skip write tools; pass --write to create and complete a smoke task')
  }

  await assertReadOnlyKeyScope()

  console.log('MCP smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
