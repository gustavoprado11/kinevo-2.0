// CORS for browser-based MCP/OAuth flows. The MCP endpoint and the OAuth
// metadata/token/registration endpoints may be fetched cross-origin by
// browser-based clients (e.g. claude.ai), so they must answer preflight
// (OPTIONS) and echo permissive CORS headers. Bearer-token auth (not cookies)
// means a wildcard origin is safe here.
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, mcp-protocol-version, mcp-session-id, Accept',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id',
  'Access-Control-Max-Age': '86400',
}

// 204 response for CORS preflight (OPTIONS) requests.
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// Returns a copy of `res` with the CORS headers merged in.
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value)
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}
