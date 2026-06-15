export interface McpContext {
  trainerId: string
  // Prefixed identifier used only for the rate-limit key (e.g. `oauth:<uuid>`
  // for OAuth tokens, the raw key id for API keys). Never use for DB writes.
  keyId: string
  // Raw uuid of the API key for telemetry (`mcp_tool_usage_logs.api_key_id`,
  // a uuid column). Null for OAuth tokens — those have no API key row.
  apiKeyId: string | null
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
