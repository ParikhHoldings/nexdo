#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

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
const requireAudit = args.has('--audit') || process.env.NEXDO_MCP_REQUIRE_AUDIT === '1'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const requiredReadTools = [
  'list_tasks',
  'search_tasks',
  'get_task',
  'get_briefing',
]
const requiredWriteTools = ['create_task', 'complete_task', 'update_task']

if (!apiKey) {
  console.error('Missing NEXDO_API_KEY or NEXDO_MCP_API_KEY.')
  process.exit(1)
}

if (requireAudit && !allowWrite) {
  console.error('Audit smoke requires --write so there is a disposable agent write to verify.')
  process.exit(1)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hashApiKey(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
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

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`)
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

function createAuditClient() {
  if (!requireAudit) return null

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Audit smoke requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function resolveAuditUserId(supabase) {
  const apiKeyHash = hashApiKey(apiKey)
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('api_key_hash', apiKeyHash)
    .maybeSingle()

  const missingHashColumn =
    error?.message?.includes('api_key_hash') &&
    (error.message.includes('does not exist') || error.message.includes('schema cache'))

  if (missingHashColumn || !profile) {
    const legacyResult = await supabase
      .from('profiles')
      .select('id')
      .eq('api_key', apiKey)
      .maybeSingle()

    profile = legacyResult.data
    error = legacyResult.error
  }

  if (error) {
    throw new Error(`Failed to resolve MCP API-key profile for audit smoke: ${error.message}`)
  }
  if (!profile?.id) {
    throw new Error('Could not find a profile for NEXDO_API_KEY while checking audit events.')
  }

  return profile.id
}

async function assertAuditEvent(supabase, userId, label, predicate) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: events, error } = await supabase
      .from('agent_action_events')
      .select('tool_name, source_agent_id, external_ref, success, error, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      throw new Error(`Failed to load agent_action_events for audit smoke: ${error.message}`)
    }

    if ((events || []).some(predicate)) {
      console.log(`ok audit event (${label})`)
      return
    }

    await sleep(500)
  }

  throw new Error(`Missing agent_action_events audit row for ${label}.`)
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

  const openApi = await getJson('/api/mcp/openapi')
  if (!openApi.paths?.['/api/mcp/actions/list_tasks']) {
    throw new Error('OpenAPI spec missing list_tasks action path.')
  }
  console.log('ok openapi')

  const auditClient = createAuditClient()
  const auditUserId = auditClient ? await resolveAuditUserId(auditClient) : null

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

  const actionList = await postJson('/api/mcp/actions/list_tasks', { limit: 5 })
  if (!Array.isArray(actionList.tasks)) {
    throw new Error('ChatGPT Actions list_tasks did not return a { tasks } array.')
  }
  console.log(`ok actions/list_tasks (${actionList.tasks.length} returned)`)

  const searchResult = await rpc('tools/call', {
    name: 'search_tasks',
    arguments: { query: 'smoke', limit: 5 },
  })
  const searchedTasks = parseToolContent(searchResult)
  if (!Array.isArray(searchedTasks)) throw new Error('search_tasks did not return an array.')
  console.log(`ok search_tasks (${searchedTasks.length} returned)`)

  const actionSearch = await postJson('/api/mcp/actions/search_tasks', {
    query: 'smoke',
    limit: 5,
  })
  if (!Array.isArray(actionSearch.tasks)) {
    throw new Error('ChatGPT Actions search_tasks did not return a { tasks } array.')
  }
  console.log(`ok actions/search_tasks (${actionSearch.tasks.length} returned)`)

  const briefingResult = await rpc('tools/call', {
    name: 'get_briefing',
    arguments: {},
  })
  const briefing = parseToolContent(briefingResult)
  if (!briefing || typeof briefing !== 'object' || typeof briefing.summary !== 'string') {
    throw new Error('get_briefing did not return a briefing object with a summary.')
  }
  console.log('ok get_briefing')

  const taskForReadCheck = tasks[0] || searchedTasks[0] || actionList.tasks?.[0]
  if (taskForReadCheck?.id) {
    const taskResult = await rpc('tools/call', {
      name: 'get_task',
      arguments: { task_id: taskForReadCheck.id },
    })
    const task = parseToolContent(taskResult)
    if (task?.id !== taskForReadCheck.id) {
      throw new Error('get_task did not return the requested task.')
    }
    console.log('ok get_task')
  } else {
    console.log('skip get_task read check; no existing task returned')
  }

  await assertReadOnlyKeyScope()

  if (allowWrite) {
    const writeStartedAt = Date.now()
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

    const createdTaskResult = await rpc('tools/call', {
      name: 'get_task',
      arguments: { task_id: created.id },
    })
    const createdTask = parseToolContent(createdTaskResult)
    if (createdTask?.id !== created.id) {
      throw new Error('get_task did not return the created smoke task.')
    }
    console.log('ok get_task smoke task')

    const updateRef = `${externalRef}-update`
    const updatedResult = await rpc('tools/call', {
      name: 'update_task',
      arguments: {
        task_id: created.id,
        status: 'in_progress',
        context: 'Updated by MCP smoke before completion.',
        source_agent_id: sourceAgentId,
        external_ref: updateRef,
        ingestion_intent: 'update',
        agent_metadata: { smoke: true },
      },
    })
    const updated = parseToolContent(updatedResult)
    if (updated?.id !== created.id || updated?.status !== 'in_progress') {
      throw new Error('update_task did not update the smoke task.')
    }
    console.log('ok update_task')

    const completeRef = `${externalRef}-complete`
    const completedResult = await rpc('tools/call', {
      name: 'complete_task',
      arguments: {
        task_id: created.id,
        source_agent_id: sourceAgentId,
        external_ref: completeRef,
        ingestion_intent: 'complete',
        agent_metadata: { smoke: true },
      },
    })
    const completed = parseToolContent(completedResult)
    if (completed?.status !== 'done') {
      throw new Error('complete_task did not mark the smoke task done.')
    }
    console.log('ok complete_task')

    if (auditClient && auditUserId) {
      await assertAuditEvent(
        auditClient,
        auditUserId,
        'create_task write',
        (event) =>
          event.tool_name === 'create_task' &&
          event.source_agent_id === sourceAgentId &&
          event.external_ref === externalRef &&
          event.success === true
      )
      await assertAuditEvent(
        auditClient,
        auditUserId,
        'update_task write',
        (event) =>
          event.tool_name === 'update_task' &&
          event.source_agent_id === sourceAgentId &&
          event.external_ref === updateRef &&
          event.success === true
      )
      await assertAuditEvent(
        auditClient,
        auditUserId,
        'complete_task write',
        (event) =>
          event.tool_name === 'complete_task' &&
          event.source_agent_id === sourceAgentId &&
          event.external_ref === completeRef &&
          event.success === true &&
          new Date(event.created_at).getTime() >= writeStartedAt - 5000
      )
    } else if (requireAudit) {
      throw new Error('Audit smoke was requested but no Supabase audit client is available.')
    } else {
      console.log('skip audit checks; pass --write --audit with Supabase service env')
    }
  } else {
    console.log('skip write tools; pass --write to create and complete a smoke task')
    console.log('skip audit checks; pass --write --audit to verify agent_action_events')
  }

  console.log('MCP smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
