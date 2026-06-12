import { NextRequest } from 'next/server'
import { corsPreflight, CORS_HEADERS } from '@/lib/mcp/cors'

export function OPTIONS() {
  return corsPreflight()
}

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'www.kinevoapp.com'
  return `${proto}://${host}`
}

// RFC 9728 §3.1 — variante com o path do resource inserido após o segmento
// well-known. Para o resource `${baseUrl}/api/mcp`, clientes (ex.: ChatGPT)
// podem buscar `/.well-known/oauth-protected-resource/api/mcp`. Espelha a raiz.
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)

  return Response.json(
    {
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [baseUrl],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
      resource_documentation: `${baseUrl}/privacy`,
    },
    { headers: CORS_HEADERS }
  )
}
