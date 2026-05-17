import type { ToolResult } from '@/lib/mcp-tools'

export type ActionToolResponse = {
  body: Record<string, unknown>
  status: number
}

function actionErrorStatus(message: string): number {
  if (message === 'Database not configured') return 503
  if (message.startsWith('Error: Failed to record agent action event')) return 500
  return 400
}

export function formatActionToolResult(
  toolName: string,
  result: ToolResult
): ActionToolResponse {
  const text = result.content[0]?.text || ''

  if (result.isError) {
    return {
      body: { error: text || 'Unknown error' },
      status: actionErrorStatus(text),
    }
  }

  try {
    const data = JSON.parse(text || '{}')

    if (toolName === 'list_tasks' || toolName === 'search_tasks') {
      return {
        body: { tasks: Array.isArray(data) ? data : [] },
        status: 200,
      }
    }

    if (toolName === 'get_briefing') {
      return {
        body: data && typeof data === 'object' && !Array.isArray(data) ? data : {},
        status: 200,
      }
    }

    if (toolName === 'add_task_note') {
      return {
        body: data && typeof data === 'object' && !Array.isArray(data) ? data : {},
        status: 200,
      }
    }

    return {
      body: { task: data },
      status: 200,
    }
  } catch {
    return {
      body: { result: text },
      status: 200,
    }
  }
}
