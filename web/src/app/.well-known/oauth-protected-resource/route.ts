import { NextRequest } from 'next/server'

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'www.kinevoapp.com'
  return `${proto}://${host}`
}

// RFC 9728 — Protected Resource Metadata. O cliente MCP (Claude) descobre por
// aqui qual authorization server emite tokens para este resource server.
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)

  return Response.json({
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/privacy`,
  })
}
