import { NextRequest, NextResponse } from 'next/server'
import { MCP_TOOLS, executeTool, validateApiKey } from '@/lib/mcp-tools'

// MCP Protocol version
const PROTOCOL_VERSION = '2024-11-05'

// JSON-RPC types
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// Error codes
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  }
}

function jsonRpcSuccess(id: string | number, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  }
}

// Extract Bearer token from Authorization header
function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

// GET /api/mcp — SSE stream for MCP protocol
export async function GET(request: NextRequest) {
  const token = extractBearerToken(request)

  // Validate auth
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

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Send the endpoint event
      const baseUrl = request.nextUrl.origin
      const endpointEvent = `event: endpoint\ndata: ${baseUrl}/api/mcp\n\n`
      controller.enqueue(encoder.encode(endpointEvent))

      // Keep-alive interval
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
        } catch {
          clearInterval(keepAlive)
        }
      }, 30000)

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// POST /api/mcp — JSON-RPC message handling
export async function POST(request: NextRequest) {
  const token = extractBearerToken(request)

  // Validate auth
  if (!token) {
    return NextResponse.json(
      jsonRpcError(null, INVALID_REQUEST, 'Authorization header with Bearer token required'),
      { status: 401 }
    )
  }

  const auth = await validateApiKey(token)
  if (!auth) {
    return NextResponse.json(
      jsonRpcError(null, INVALID_REQUEST, 'Invalid API key'),
      { status: 401 }
    )
  }

  // Parse request body
  let body: JsonRpcRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      jsonRpcError(null, PARSE_ERROR, 'Invalid JSON'),
      { status: 400 }
    )
  }

  // Validate JSON-RPC format
  if (body.jsonrpc !== '2.0' || !body.method || body.id === undefined) {
    return NextResponse.json(
      jsonRpcError(body?.id ?? null, INVALID_REQUEST, 'Invalid JSON-RPC request'),
      { status: 400 }
    )
  }

  const { id, method, params } = body

  // Route to appropriate handler
  try {
    switch (method) {
      case 'initialize':
        return NextResponse.json(
          jsonRpcSuccess(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'nexdo',
              version: '1.0.0',
            },
          })
        )

      case 'tools/list':
        return NextResponse.json(
          jsonRpcSuccess(id, {
            tools: MCP_TOOLS,
          })
        )

      case 'tools/call': {
        const toolName = params?.name as string
        const toolArgs = (params?.arguments || {}) as Record<string, unknown>

        if (!toolName) {
          return NextResponse.json(
            jsonRpcError(id, INVALID_PARAMS, 'Tool name is required')
          )
        }

        const tool = MCP_TOOLS.find((t) => t.name === toolName)
        if (!tool) {
          return NextResponse.json(
            jsonRpcError(id, METHOD_NOT_FOUND, `Unknown tool: ${toolName}`)
          )
        }

        const result = await executeTool(toolName, toolArgs, auth.userId)
        return NextResponse.json(jsonRpcSuccess(id, result))
      }

      case 'resources/list':
        return NextResponse.json(
          jsonRpcSuccess(id, { resources: [] })
        )

      case 'prompts/list':
        return NextResponse.json(
          jsonRpcSuccess(id, { prompts: [] })
        )

      case 'notifications/initialized':
        // Client notification that initialization is complete
        return NextResponse.json(jsonRpcSuccess(id, {}))

      default:
        return NextResponse.json(
          jsonRpcError(id, METHOD_NOT_FOUND, `Unknown method: ${method}`)
        )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      jsonRpcError(id, INTERNAL_ERROR, message),
      { status: 500 }
    )
  }
}
