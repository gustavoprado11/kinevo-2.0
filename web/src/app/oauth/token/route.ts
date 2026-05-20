import { createHash, randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const ACCESS_TOKEN_TTL = 60 * 60 * 1000          // 1 hour
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// PKCE: base64url(sha256(code_verifier)) must match code_challenge
function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash('sha256').update(codeVerifier).digest('base64url')
  return hash === codeChallenge
}

function generateToken(prefix: string): { raw: string; hash: string } {
  const raw = `${prefix}_${randomUUID()}`
  return { raw, hash: sha256(raw) }
}

export async function POST(request: Request) {
  let body: URLSearchParams
  try {
    const text = await request.text()
    body = new URLSearchParams(text)
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  const grantType = body.get('grant_type')
  const clientId = body.get('client_id')

  if (!clientId) {
    return Response.json({ error: 'invalid_request', error_description: 'client_id required' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  if (grantType === 'authorization_code') {
    return handleAuthorizationCode(supabaseAdmin, body, clientId)
  }

  if (grantType === 'refresh_token') {
    return handleRefreshToken(supabaseAdmin, body, clientId)
  }

  return Response.json({ error: 'unsupported_grant_type' }, { status: 400 })
}

async function handleAuthorizationCode(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  body: URLSearchParams,
  clientId: string
) {
  const code = body.get('code')
  const codeVerifier = body.get('code_verifier')
  const redirectUri = body.get('redirect_uri')

  if (!code || !codeVerifier) {
    return Response.json({ error: 'invalid_request', error_description: 'code and code_verifier required' }, { status: 400 })
  }

  // Look up the code
  const { data: authCode } = await supabaseAdmin
    .from('mcp_oauth_codes')
    .select('*')
    .eq('code', code)
    .eq('client_id', clientId)
    .is('used_at', null)
    .single()

  if (!authCode) {
    return Response.json({ error: 'invalid_grant', error_description: 'Invalid or expired code' }, { status: 400 })
  }

  // Check expiry
  if (new Date(authCode.expires_at) < new Date()) {
    return Response.json({ error: 'invalid_grant', error_description: 'Code expired' }, { status: 400 })
  }

  // Check redirect_uri matches
  if (redirectUri && redirectUri !== authCode.redirect_uri) {
    return Response.json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' }, { status: 400 })
  }

  // Verify PKCE
  if (!verifyPkce(codeVerifier, authCode.code_challenge)) {
    return Response.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, { status: 400 })
  }

  // Mark code as used
  await supabaseAdmin
    .from('mcp_oauth_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', authCode.id)

  // Generate tokens
  const accessToken = generateToken('kinevo_at')
  const refreshToken = generateToken('kinevo_rt')
  const now = Date.now()

  await supabaseAdmin.from('mcp_oauth_tokens').insert({
    access_token_hash: accessToken.hash,
    refresh_token_hash: refreshToken.hash,
    client_id: clientId,
    trainer_id: authCode.trainer_id,
    scope: authCode.scope,
    expires_at: new Date(now + ACCESS_TOKEN_TTL).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL).toISOString(),
  })

  return Response.json({
    access_token: accessToken.raw,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL / 1000,
    refresh_token: refreshToken.raw,
    scope: authCode.scope ?? 'mcp',
  })
}

async function handleRefreshToken(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  body: URLSearchParams,
  clientId: string
) {
  const refreshTokenRaw = body.get('refresh_token')
  if (!refreshTokenRaw) {
    return Response.json({ error: 'invalid_request', error_description: 'refresh_token required' }, { status: 400 })
  }

  const refreshHash = sha256(refreshTokenRaw)

  const { data: tokenRow } = await supabaseAdmin
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('refresh_token_hash', refreshHash)
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .single()

  if (!tokenRow) {
    return Response.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, { status: 400 })
  }

  if (tokenRow.refresh_expires_at && new Date(tokenRow.refresh_expires_at) < new Date()) {
    return Response.json({ error: 'invalid_grant', error_description: 'Refresh token expired' }, { status: 400 })
  }

  // Revoke old token
  await supabaseAdmin
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  // Issue new tokens (rotation)
  const newAccess = generateToken('kinevo_at')
  const newRefresh = generateToken('kinevo_rt')
  const now = Date.now()

  await supabaseAdmin.from('mcp_oauth_tokens').insert({
    access_token_hash: newAccess.hash,
    refresh_token_hash: newRefresh.hash,
    client_id: clientId,
    trainer_id: tokenRow.trainer_id,
    scope: tokenRow.scope,
    expires_at: new Date(now + ACCESS_TOKEN_TTL).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL).toISOString(),
  })

  return Response.json({
    access_token: newAccess.raw,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL / 1000,
    refresh_token: newRefresh.raw,
    scope: tokenRow.scope ?? 'mcp',
  })
}
