export interface McpContext {
  trainerId: string
  keyId: string
}

export interface McpToolResult {
  [x: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export function mcpSuccess(data: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }
}

export function mcpError(message: string): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}
