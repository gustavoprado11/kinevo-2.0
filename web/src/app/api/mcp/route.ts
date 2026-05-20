import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateRequest, McpAuthError } from '@/lib/mcp/auth'
import { createMcpServer } from '@/lib/mcp/server'
import { logToolUsage } from '@/lib/mcp/logger'

function jsonRpcError(code: number, message: string, status: number = 400) {
  return Response.json(
    { jsonrpc: '2.0', error: { code, message }, id: null },
    { status }
  )
}

export async function GET() {
  return Response.json({
    name: 'kinevo',
    version: '1.0.0',
    description:
      'Kinevo MCP Server — Gerencie sua plataforma de personal training com IA',
  })
}

// Methods that work without authentication (discovery + tool catalog)
// Tool names/descriptions are not sensitive — only tools/call accesses real data
const PUBLIC_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'tools/list',
])

export async function POST(request: Request) {
  // Pre-parse body to determine method
  const body = await request.json()
  const method =
    body && typeof body === 'object' && 'method' in body
      ? (body as { method: string }).method
      : null

  // Public methods: discovery handshake + tool catalog
  // Use a placeholder trainerId — tools register their schemas (static),
  // no data is accessed until tools/call which requires auth
  if (method && PUBLIC_METHODS.has(method)) {
    const server = createMcpServer('__discovery__')

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    await server.connect(transport)
    return transport.handleRequest(request, { parsedBody: body })
  }

  // All other methods (tools/call, etc.) require authentication
  let context: { trainerId: string; keyId: string } | null = null

  try {
    context = await authenticateRequest(request)
  } catch (error) {
    if (error instanceof McpAuthError) {
      return jsonRpcError(-32600, error.message, error.statusCode)
    }
    return jsonRpcError(-32603, 'Internal server error', 500)
  }

  const server = createMcpServer(context.trainerId)

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  await server.connect(transport)

  // Extract tool name for logging
  let toolName: string | null = null
  if (
    method === 'tools/call' &&
    'params' in body &&
    (body as { params: { name?: string } }).params?.name
  ) {
    toolName = (body as { params: { name: string } }).params.name
  }

  const startTime = Date.now()

  const response = await transport.handleRequest(request, { parsedBody: body })

  // Log tool usage (fire-and-forget)
  if (toolName) {
    const durationMs = Date.now() - startTime
    const isError = response.status >= 400
    logToolUsage(
      context.trainerId,
      context.keyId,
      toolName,
      durationMs,
      !isError,
      isError ? `HTTP ${response.status}` : undefined
    )
  }

  return response
}

export async function DELETE() {
  return jsonRpcError(
    -32600,
    'Session management not supported in stateless mode',
    400
  )
}
