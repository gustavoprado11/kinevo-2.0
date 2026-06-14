import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import type { McpContext } from './types'

const MCP_RATE_LIMIT = { perMinute: 30, perDay: 1000 }

export class McpAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'McpAuthError'
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// Validate a kinevo_trainer_* API Key (bcrypt hash)
async function validateApiKey(
  token: string
): Promise<{ trainerId: string; keyId: string } | null> {
  if (!token.startsWith('kinevo_trainer_')) return null

  const prefix = token.slice(0, 12)
  const supabaseAdmin = createAdminClient()

  const { data: keys } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id, trainer_id, key_hash')
    .eq('key_prefix', prefix)
    .is('revoked_at', null)

  if (!keys || keys.length === 0) return null

  for (const key of keys) {
    const match = await bcrypt.compare(token, key.key_hash)
    if (match) {
      supabaseAdmin
        .from('trainer_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id)
        .then()

      return { trainerId: key.trainer_id, keyId: key.id }
    }
  }

  return null
}

// Validate a kinevo_at_* OAuth access token (sha256 hash)
async function validateOAuthToken(
  token: string
): Promise<{ trainerId: string; keyId: string } | null> {
  if (!token.startsWith('kinevo_at_')) return null

  const tokenHash = sha256(token)
  const supabaseAdmin = createAdminClient()

  const { data } = await supabaseAdmin
    .from('mcp_oauth_tokens')
    .select('id, trainer_id, expires_at')
    .eq('access_token_hash', tokenHash)
    .is('revoked_at', null)
    .single()

  if (!data) return null

  if (new Date(data.expires_at) < new Date()) return null

  return { trainerId: data.trainer_id, keyId: `oauth:${data.id}` }
}

export async function authenticateRequest(
  request: Request
): Promise<McpContext> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new McpAuthError(
      'Authorization header ausente ou invalido.'
    )
  }

  const token = authHeader.slice(7)

  // Try OAuth token first (fast sha256), then API key (slow bcrypt)
  const result =
    (await validateOAuthToken(token)) ?? (await validateApiKey(token))

  if (!result) {
    throw new McpAuthError('Token invalido, expirado ou revogado')
  }

  // Check trainer has active subscription
  const supabaseAdmin = createAdminClient()
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('trainer_id', result.trainerId)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .maybeSingle()

  if (!subscription) {
    throw new McpAuthError(
      'Sua assinatura Kinevo esta inativa. Renove em kinevoapp.com/settings/billing',
      403
    )
  }

  // Rate limiting
  const rateLimitKey = `mcp:${result.keyId}`
  const limit = await consumeRateLimit(rateLimitKey, MCP_RATE_LIMIT)
  if (!limit.allowed) {
    throw new McpAuthError(limit.error ?? 'Rate limit exceeded', 429)
  }

  return result
}
