'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  TestTube2,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/lib/store'
import {
  API_KEY_SCOPE_LABELS,
  API_ACCESS_REQUIRED_MESSAGE,
  canUseApiAccess,
  normalizeApiKeyScopes,
  requiredScopeForTool,
} from '@/lib/agent-scopes'

const MCP_TOOL_DETAILS = [
  { name: 'list_tasks', desc: 'List and filter your tasks' },
  { name: 'create_task', desc: 'Create tasks with natural language' },
  { name: 'complete_task', desc: 'Mark tasks as done' },
  { name: 'update_task', desc: 'Update task details' },
  { name: 'get_briefing', desc: 'Get your daily AI briefing' },
  { name: 'search_tasks', desc: 'Search tasks by keyword' },
  { name: 'get_task', desc: 'Get full task details' },
]

type AgentEvent = {
  id: string
  tool_name: string
  source_agent_id: string | null
  external_ref: string | null
  ingestion_intent: string | null
  success: boolean
  error: string | null
  duration_ms: number | null
  created_at: string
}

/**
 * Resolve the public origin for the MCP URLs shown to users. We prefer the
 * env-provided NEXT_PUBLIC_APP_URL (set in prod), and fall back to the
 * current window origin so preview deploys "just work".
 */
function resolvePublicOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function subscribeToOrigin(_onStoreChange: () => void) {
  return () => {}
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback

  const data = payload as {
    message?: unknown
    error?: unknown
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error
  }

  if (
    data.error &&
    typeof data.error === 'object' &&
    'message' in data.error
  ) {
    const nestedMessage = (data.error as { message?: unknown }).message
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage
    }
  }

  return fallback
}

export default function MCPSettingsPage() {
  const { profile } = useUserStore()
  const apiKeyHint = profile?.api_key_hint || ''
  const hasApiKey = Boolean(apiKeyHint)
  const apiKeyScopes = normalizeApiKeyScopes(profile?.api_key_scopes)
  const hasApiAccess = canUseApiAccess(profile?.subscription_tier)
  const hasUsableApiKey = hasApiAccess && hasApiKey
  const canTestConnection = hasUsableApiKey
  const setupStatusMessage = !hasApiAccess
    ? 'Upgrade to Power or Team before connecting external AI tools.'
    : hasApiKey
      ? 'Ready to configure. Replace placeholders with the full API key copied when it was generated.'
      : 'Generate a scoped API key in Settings > API before connecting external AI tools.'

  const origin = useSyncExternalStore(
    subscribeToOrigin,
    resolvePublicOrigin,
    resolvePublicOrigin
  )

  const MCP_SERVER_URL = origin ? `${origin}/api/mcp` : '/api/mcp'
  const OPENAPI_URL = origin ? `${origin}/api/mcp/openapi` : '/api/mcp/openapi'

  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [copiedOpenApi, setCopiedOpenApi] = useState(false)
  const [testApiKey, setTestApiKey] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        nexdo: {
          url: MCP_SERVER_URL,
          headers: {
            Authorization: 'Bearer YOUR_NEXDO_API_KEY',
          },
        },
      },
    },
    null,
    2
  )

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  useEffect(() => {
    if (!hasUsableApiKey) return

    let cancelled = false

    const loadEvents = async () => {
      setIsLoadingEvents(true)
      setEventsError(null)

      try {
        const response = await fetch('/api/mcp/events')
        const data = await response.json()

        if (cancelled) return

        if (response.ok) {
          setEvents(data.events || [])
        } else {
          setEventsError(apiErrorMessage(data, 'Unable to load agent activity'))
        }
      } catch {
        if (!cancelled) {
          setEventsError('Unable to load agent activity')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEvents(false)
        }
      }
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [hasUsableApiKey])

  const handleTestConnection = async () => {
    if (!canTestConnection) {
      setTestStatus('error')
      setTestMessage('API access and a generated key are required before testing a connection.')
      return
    }

    const connectionKey = testApiKey.trim()

    if (!connectionKey) {
      setTestStatus('error')
      setTestMessage('Paste an API key to test the connection.')
      return
    }

    setTestStatus('loading')
    setTestMessage('')

    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connectionKey}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
        }),
      })

      const data = await response.json()

      if (response.ok && data.result) {
        setTestStatus('success')
        setTestMessage(`Connected to Nexdo MCP v${data.result.serverInfo?.version || '1.0.0'}`)
      } else {
        setTestStatus('error')
        setTestMessage(apiErrorMessage(data, 'Connection failed'))
      }
    } catch (error) {
      setTestStatus('error')
      setTestMessage('Network error. Check your connection.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-zinc-100">Connect AI Tools</h1>
        <p className="text-zinc-500 mt-1">
          Use Nexdo from Claude Desktop, ChatGPT, Cursor, and any MCP-compatible AI tool.
        </p>
      </header>

      {/* Server URL */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">MCP Server URL</h2>
        <div className="flex gap-2">
          <code className="flex-1 bg-zinc-800 px-4 py-2.5 rounded-lg text-sm text-zinc-300 font-mono overflow-x-auto">
            {MCP_SERVER_URL}
          </code>
          <Button
            variant="secondary"
            onClick={() => handleCopy(MCP_SERVER_URL, setCopiedUrl)}
            aria-label="Copy MCP server URL"
          >
            {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </section>

      {/* API Key */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Your API Key</h2>
        {!hasApiAccess ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-400">
              {API_ACCESS_REQUIRED_MESSAGE}{' '}
              <Link href="/settings?tab=billing" className="underline">
                Open billing
              </Link>
            </p>
            {hasApiKey && (
              <p className="mt-2 text-xs text-amber-300">
                Existing API keys are disabled until API access is active again.
              </p>
            )}
          </div>
        ) : hasApiKey ? (
          <div className="flex gap-2">
            <code className="flex-1 bg-zinc-800 px-4 py-2.5 rounded-lg text-sm text-zinc-300 font-mono">
              {apiKeyHint}
            </code>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-400">
              No API key found.{' '}
              <Link href="/settings?tab=api" className="underline">
                Generate one in Settings &gt; API
              </Link>
            </p>
          </div>
        )}

        {hasUsableApiKey && (
          <p className="mt-3 text-xs text-zinc-500">
            Existing keys are stored as hashes and cannot be revealed. The hint above identifies the key but cannot be used as a token. Regenerate a key in Settings &gt; API when you need a new copy.
          </p>
        )}

        {hasUsableApiKey && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Current key scopes
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {apiKeyScopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                >
                  {API_KEY_SCOPE_LABELS[scope]}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Test Connection */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Test Connection</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Paste the full one-time API key, not the stored key hint.
        </p>
        <div className="mb-4 flex gap-2">
          <Input
            label="Full API key"
            type="password"
            value={testApiKey}
            onChange={(event) => setTestApiKey(event.target.value)}
            placeholder="Paste API key"
            className="font-mono"
            disabled={!canTestConnection}
          />
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleTestConnection} disabled={!canTestConnection || testStatus === 'loading'}>
            {testStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube2 className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          {testStatus === 'success' && (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{testMessage}</span>
            </div>
          )}
          {testStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">{testMessage}</span>
            </div>
          )}
        </div>
        {!canTestConnection && (
          <p className="mt-3 text-sm text-amber-400">
            API access and a generated key are required before this tester is enabled.
          </p>
        )}
      </section>

      {/* Agent Activity */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Recent Agent Activity
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Recent MCP and ChatGPT Actions calls made with your Nexdo API key.
            </p>
          </div>
          <Activity className="h-5 w-5 text-zinc-500" />
        </div>

        {!hasApiAccess ? (
          <p className="text-sm text-zinc-500">
            Upgrade to Power or Team before agent activity can appear here.
          </p>
        ) : !hasApiKey ? (
          <p className="text-sm text-zinc-500">
            Generate an API key before agent activity can appear here.
          </p>
        ) : isLoadingEvents ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agent activity
          </div>
        ) : eventsError ? (
          <p className="text-sm text-red-400">{eventsError}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">No agent activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 rounded-lg bg-zinc-800/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-sm text-accent font-mono">
                      {event.tool_name}
                    </code>
                    <span
                      className={
                        event.success
                          ? 'text-xs text-emerald-400'
                          : 'text-xs text-red-400'
                      }
                    >
                      {event.success ? 'success' : 'failed'}
                    </span>
                    {event.source_agent_id && (
                      <span className="text-xs text-zinc-500">
                        {event.source_agent_id}
                      </span>
                    )}
                  </div>
                  {event.error ? (
                    <p className="mt-1 truncate text-xs text-red-300">
                      {event.error}
                    </p>
                  ) : event.external_ref ? (
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {event.external_ref}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-xs text-zinc-500">
                  {new Date(event.created_at).toLocaleString()}
                  {event.duration_ms !== null ? ` · ${event.duration_ms}ms` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Setup Instructions */}
      <section className="space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Setup Status</h2>
          <p className={canTestConnection ? 'text-sm text-emerald-400' : 'text-sm text-amber-400'}>
            {setupStatusMessage}
          </p>
        </div>

        {/* Claude Desktop */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">1. Claude Desktop</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Add this to your <code className="text-zinc-400">claude_desktop_config.json</code> file:
          </p>
          <div className="relative">
            <pre className="bg-zinc-800 p-4 rounded-lg text-sm text-zinc-300 font-mono overflow-x-auto">
              {claudeConfig}
            </pre>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => handleCopy(claudeConfig, setCopiedConfig)}
              aria-label="Copy Claude Desktop MCP config"
            >
              {copiedConfig ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Replace <code className="text-zinc-500">YOUR_NEXDO_API_KEY</code> with the full key copied from Settings &gt; API.
          </p>
          <p className="text-xs text-zinc-600 mt-3">
            Config file location:
            <br />
            macOS: <code className="text-zinc-500">~/Library/Application Support/Claude/claude_desktop_config.json</code>
            <br />
            Windows: <code className="text-zinc-500">%APPDATA%\Claude\claude_desktop_config.json</code>
          </p>
        </div>

        {/* ChatGPT */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">2. ChatGPT Custom GPT</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Create a custom GPT with Actions that connect to Nexdo:
          </p>
          <ol className="text-sm text-zinc-400 space-y-2 mb-4">
            <li>1. Go to <strong>Explore GPTs</strong> → <strong>Create</strong></li>
            <li>2. Click <strong>Configure</strong> → <strong>Create new action</strong></li>
            <li>3. Import from URL: paste the OpenAPI spec URL below</li>
            <li>4. Under <strong>Authentication</strong>, select <strong>API Key</strong> (Bearer)</li>
            <li>5. Paste the full Nexdo API key copied from Settings &gt; API</li>
          </ol>
          <div className="flex gap-2">
            <code className="flex-1 bg-zinc-800 px-4 py-2.5 rounded-lg text-sm text-zinc-300 font-mono overflow-x-auto">
              {OPENAPI_URL}
            </code>
            <Button
              variant="secondary"
              onClick={() => handleCopy(OPENAPI_URL, setCopiedOpenApi)}
              aria-label="Copy OpenAPI spec URL"
            >
              {copiedOpenApi ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <a href={OPENAPI_URL} target="_blank" rel="noopener noreferrer" aria-label="Open OpenAPI spec"
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            ChatGPT Actions can only call tools allowed by the scopes on the key you paste.
          </p>
        </div>

        {/* Cursor / Other */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">3. Cursor / Other MCP Clients</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Most MCP clients support HTTP transport. Use these settings:
          </p>
          <div className="bg-zinc-800 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Server URL:</span>
              <code className="text-zinc-300 font-mono">{MCP_SERVER_URL}</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Transport:</span>
              <span className="text-zinc-300">HTTP with SSE</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Auth Header:</span>
              <code className="text-zinc-300 font-mono">Authorization: Bearer nxd_...</code>
            </div>
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Use the full one-time key value. The stored key hint is only for identifying which key is active.
          </p>
        </div>
      </section>

      {/* Available Tools */}
      <section className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Available Tools</h2>
        {!canTestConnection && (
          <p className="mb-4 text-sm text-zinc-500">
            Tools become available to external clients after API access is active and a scoped key exists.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {MCP_TOOL_DETAILS.map((tool) => {
            const requiredScope = requiredScopeForTool(tool.name)
            const isEnabled = hasUsableApiKey && apiKeyScopes.includes(requiredScope)

            return (
              <div
                key={tool.name}
                className={
                  isEnabled
                    ? 'flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg'
                    : 'flex items-start gap-3 p-3 bg-zinc-900/60 rounded-lg opacity-75'
                }
              >
                {isEnabled ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-sm text-accent font-mono">
                      {tool.name}
                    </code>
                    <span className="text-xs text-zinc-500">
                      {API_KEY_SCOPE_LABELS[requiredScope]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{tool.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
