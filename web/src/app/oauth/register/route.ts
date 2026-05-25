import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

// Dynamic Client Registration (RFC7591) é aberto por design (MCP), mas precisa
// de rate-limit pra não virar vetor de DB-fill, e de validação dos redirect_uris.
function isValidRedirectUri(u: string): boolean {
  try {
    const url = new URL(u)
    // Só https (evita exfiltração via http/esquemas custom). localhost http é
    // tolerado pra clientes de desenvolvimento.
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  // Rate-limit por IP.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rlKey = `oauth-register:${ip}`
  const rl = checkRateLimit(rlKey, { perMinute: 5, perDay: 50 })
  if (!rl.allowed) {
    return Response.json({ error: 'rate_limited', error_description: rl.error }, { status: 429 })
  }
  recordRequest(rlKey)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name : 'MCP Client'
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === 'string')
    : []

  // Exigir ao menos um redirect_uri válido (https/localhost).
  if (redirectUris.length === 0 || !redirectUris.every(isValidRedirectUri)) {
    return Response.json(
      { error: 'invalid_redirect_uri', error_description: 'redirect_uris deve conter ao menos uma URL https válida.' },
      { status: 400 }
    )
  }

  const clientId = `kinevo_client_${randomUUID()}`

  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.from('mcp_oauth_clients').insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
  })

  if (error) {
    return Response.json({ error: 'server_error' }, { status: 500 })
  }

  return Response.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    { status: 201 }
  )
}
