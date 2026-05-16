import { NextRequest, NextResponse } from 'next/server'
import {
  MCP_TOOLS,
  canUseTool,
  executeTool,
  missingScopeMessage,
  validateApiKey,
} from '@/lib/mcp-tools'
import { formatActionToolResult } from '@/lib/mcp-action-results'

const ACTION_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Extract Bearer token from Authorization header
function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

// POST /api/mcp/actions/[tool] — REST wrapper for ChatGPT Actions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  const { tool: toolName } = await params

  // Validate auth
  const token = extractBearerToken(request)
  if (!token) {
    return NextResponse.json(
      { error: 'Authorization header with Bearer token required' },
      { status: 401, headers: ACTION_CORS_HEADERS }
    )
  }

  const auth = await validateApiKey(token)
  if (!auth) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401, headers: ACTION_CORS_HEADERS }
    )
  }

  // Validate tool exists
  const tool = MCP_TOOLS.find((t) => t.name === toolName)
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown tool: ${toolName}` },
      { status: 404, headers: ACTION_CORS_HEADERS }
    )
  }

  if (!canUseTool(auth.scopes, toolName)) {
    return NextResponse.json(
      { error: missingScopeMessage(toolName) },
      { status: 403, headers: ACTION_CORS_HEADERS }
    )
  }

  // Parse request body
  let args: Record<string, unknown> = {}
  try {
    const body = await request.text()
    if (body) {
      args = JSON.parse(body)
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400, headers: ACTION_CORS_HEADERS }
    )
  }

  // Execute tool
  try {
    const result = await executeTool(toolName, args, auth.userId)
    const actionResult = formatActionToolResult(toolName, result)

    return NextResponse.json(actionResult.body, {
      status: actionResult.status,
      headers: ACTION_CORS_HEADERS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: ACTION_CORS_HEADERS }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...ACTION_CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  })
}
