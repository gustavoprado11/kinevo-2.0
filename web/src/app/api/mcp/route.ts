import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateRequest, McpAuthError } from '@/lib/mcp/auth'
import { createMcpServer } from '@/lib/mcp/server'
import { logToolUsage } from '@/lib/mcp/logger'
import { corsPreflight, withCors, CORS_HEADERS } from '@/lib/mcp/cors'

export function OPTIONS() {
  return corsPreflight()
}

function getBaseUrl(request: Request): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    'www.kinevoapp.com'
  return `${proto}://${host}`
}

function jsonRpcError(
  code: number,
  message: string,
  status: number = 400,
  extraHeaders?: Record<string, string>
) {
  return Response.json(
    { jsonrpc: '2.0', error: { code, message }, id: null },
    { status, headers: { ...CORS_HEADERS, ...extraHeaders } }
  )
}

// Origin allowlist — previne DNS rebinding (requisito de segurança do Directory).
// Requests server-to-server (Claude backend) não enviam Origin: isso é permitido.
// Browsers que mandam Origin precisam vir de uma origem conhecida.
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // sem Origin = chamada server-side, não é navegador

  try {
    const { protocol, hostname } = new URL(origin)
    if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return false
    }
    return (
      hostname === 'claude.ai' ||
      hostname === 'claude.com' ||
      hostname.endsWith('.claude.ai') ||
      hostname.endsWith('.claude.com') ||
      hostname === 'chatgpt.com' ||
      hostname.endsWith('.chatgpt.com') ||
      hostname === 'openai.com' ||
      hostname.endsWith('.openai.com') ||
      hostname.endsWith('.oaiusercontent.com') ||
      hostname === 'kinevoapp.com' ||
      hostname.endsWith('.kinevoapp.com') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    )
  } catch {
    return false
  }
}

export async function GET() {
  return Response.json(
    {
      name: 'kinevo',
      version: '1.0.0',
      description:
        'Kinevo MCP Server — Gerencie sua plataforma de personal training com IA',
    },
    { headers: CORS_HEADERS }
  )
}

// Methods that work without authentication (discovery + tool catalog)
// Tool names/descriptions are not sensitive — only tools/call accesses real data
const PUBLIC_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'tools/list',
])

export async function POST(request: Request) {
  // Origin allowlist (DNS rebinding protection)
  if (!isAllowedOrigin(request)) {
    return jsonRpcError(-32600, 'Origem não permitida.', 403)
  }

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
    return withCors(await transport.handleRequest(request, { parsedBody: body }))
  }

  // All other methods (tools/call, etc.) require authentication
  let context: { trainerId: string; keyId: string } | null = null

  try {
    context = await authenticateRequest(request)
  } catch (error) {
    if (error instanceof McpAuthError) {
      // 401 deve apontar o resource metadata (RFC 9728) para o cliente
      // descobrir o authorization server e iniciar o fluxo OAuth.
      const headers =
        error.statusCode === 401
          ? {
              'WWW-Authenticate': `Bearer resource_metadata="${getBaseUrl(request)}/.well-known/oauth-protected-resource"`,
            }
          : undefined
      return jsonRpcError(-32600, error.message, error.statusCode, headers)
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

  return withCors(response)
}

export async function DELETE() {
  return jsonRpcError(
    -32600,
    'Session management not supported in stateless mode',
    400
  )
}
