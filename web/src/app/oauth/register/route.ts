import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name : 'MCP Client'
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === 'string') : []

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
