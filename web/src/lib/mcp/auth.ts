import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'
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

export async function validateApiKey(
  bearerToken: string
): Promise<{ trainerId: string; keyId: string } | null> {
  if (!bearerToken.startsWith('kinevo_trainer_')) return null

  const prefix = bearerToken.slice(0, 12)
  const supabaseAdmin = createAdminClient()

  const { data: keys } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id, trainer_id, key_hash')
    .eq('key_prefix', prefix)
    .is('revoked_at', null)

  if (!keys || keys.length === 0) return null

  for (const key of keys) {
    const match = await bcrypt.compare(bearerToken, key.key_hash)
    if (match) {
      // Update last_used_at (fire-and-forget)
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

export async function authenticateRequest(
  request: Request
): Promise<McpContext> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new McpAuthError(
      'Authorization header ausente ou inválido. Use: Bearer kinevo_trainer_<key>'
    )
  }

  const token = authHeader.slice(7)

  if (!token.startsWith('kinevo_trainer_')) {
    throw new McpAuthError(
      'Formato de API Key inválido. Keys começam com kinevo_trainer_'
    )
  }

  const result = await validateApiKey(token)

  if (!result) {
    throw new McpAuthError('API Key inválida ou revogada')
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
      'Sua assinatura Kinevo está inativa. Renove em kinevoapp.com/settings/billing',
      403
    )
  }

  // Rate limiting
  const rateLimitKey = `mcp:${result.keyId}`
  const limit = checkRateLimit(rateLimitKey, MCP_RATE_LIMIT)
  if (!limit.allowed) {
    throw new McpAuthError(limit.error ?? 'Rate limit exceeded', 429)
  }
  recordRequest(rateLimitKey)

  return result
}
