'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
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
import { useUserStore } from '@/lib/store'

const MCP_SERVER_URL = 'https://nexdo-web-staging.up.railway.app/api/mcp'
const OPENAPI_URL = 'https://nexdo-web-staging.up.railway.app/api/mcp/openapi'

export default function MCPSettingsPage() {
  const { profile } = useUserStore()
  const apiKey = profile?.api_key || ''

  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [copiedOpenApi, setCopiedOpenApi] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        nexdo: {
          url: MCP_SERVER_URL,
          headers: {
            Authorization: `Bearer ${apiKey || 'YOUR_NEXDO_API_KEY'}`,
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

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestStatus('error')
      setTestMessage('No API key found. Generate one in Settings > API.')
      return
    }

    setTestStatus('loading')
    setTestMessage('')

    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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
        setTestMessage(data.error?.message || 'Connection failed')
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
          >
            {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </section>

      {/* API Key */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Your API Key</h2>
        {apiKey ? (
          <div className="flex gap-2">
            <code className="flex-1 bg-zinc-800 px-4 py-2.5 rounded-lg text-sm text-zinc-300 font-mono">
              {apiKey.slice(0, 8)}{'•'.repeat(24)}{apiKey.slice(-4)}
            </code>
            <Button
              variant="secondary"
              onClick={() => handleCopy(apiKey, setCopiedKey)}
            >
              {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-400">
              No API key found.{' '}
              <Link href="/settings" className="underline">
                Generate one in Settings &gt; API
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* Test Connection */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Test Connection</h2>
        <div className="flex items-center gap-4">
          <Button onClick={handleTestConnection} disabled={testStatus === 'loading'}>
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
      </section>

      {/* Setup Instructions */}
      <section className="space-y-6">
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
            >
              {copiedConfig ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
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
            <li>5. Paste your Nexdo API key</li>
          </ol>
          <div className="flex gap-2">
            <code className="flex-1 bg-zinc-800 px-4 py-2.5 rounded-lg text-sm text-zinc-300 font-mono overflow-x-auto">
              {OPENAPI_URL}
            </code>
            <Button
              variant="secondary"
              onClick={() => handleCopy(OPENAPI_URL, setCopiedOpenApi)}
            >
              {copiedOpenApi ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <a href={OPENAPI_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
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
        </div>
      </section>

      {/* Available Tools */}
      <section className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Available Tools</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { name: 'list_tasks', desc: 'List and filter your tasks' },
            { name: 'create_task', desc: 'Create tasks with natural language' },
            { name: 'complete_task', desc: 'Mark tasks as done' },
            { name: 'update_task', desc: 'Update task details' },
            { name: 'get_briefing', desc: 'Get your daily AI briefing' },
            { name: 'search_tasks', desc: 'Search tasks by keyword' },
            { name: 'get_task', desc: 'Get full task details' },
          ].map((tool) => (
            <div
              key={tool.name}
              className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg"
            >
              <code className="text-sm text-accent font-mono whitespace-nowrap">
                {tool.name}
              </code>
              <span className="text-sm text-zinc-500">{tool.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
