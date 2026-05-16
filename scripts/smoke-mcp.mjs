#!/usr/bin/env node

const args = new Set(process.argv.slice(2))
const baseUrlArg = process.argv.find((arg) => arg.startsWith('--url='))
const baseUrl = (
  baseUrlArg?.slice('--url='.length) ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '')
const apiKey = process.env.NEXDO_API_KEY || process.env.NEXDO_MCP_API_KEY
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

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
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

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(data)}`)
  }

  return data
}

async function rpc(method, params) {
  const data = await postJson('/api/mcp', {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  })

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
    const createdResult = await rpc('tools/call', {
      name: 'create_task',
      arguments: { input: `${title} today high priority` },
    })
    const created = parseToolContent(createdResult)
    if (!created?.id) throw new Error('create_task did not return a task id.')
    console.log('ok create_task')

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

  console.log('MCP smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
