import { NextRequest, NextResponse } from 'next/server'
import { MCP_TOOLS, executeTool, validateApiKey } from '@/lib/mcp-tools'

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
      { status: 401 }
    )
  }

  const auth = await validateApiKey(token)
  if (!auth) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Validate tool exists
  const tool = MCP_TOOLS.find((t) => t.name === toolName)
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown tool: ${toolName}` },
      { status: 404 }
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Execute tool
  try {
    const result = await executeTool(toolName, args, auth.userId)

    if (result.isError) {
      return NextResponse.json(
        { error: result.content[0]?.text || 'Unknown error' },
        { status: 400 }
      )
    }

    // Parse the JSON result from the tool
    try {
      const data = JSON.parse(result.content[0]?.text || '{}')
      // Wrap single objects in appropriate key
      if (toolName === 'list_tasks' || toolName === 'search_tasks') {
        return NextResponse.json({ tasks: Array.isArray(data) ? data : [] })
      } else if (toolName === 'get_briefing') {
        return NextResponse.json(data)
      } else {
        return NextResponse.json({ task: data })
      }
    } catch {
      // Return raw text if not JSON
      return NextResponse.json({ result: result.content[0]?.text })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
