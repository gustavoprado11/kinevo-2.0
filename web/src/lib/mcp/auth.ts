import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import type { McpContext } from './types'

const MCP_RATE_LIMIT = { perMinute: 30, perDay: 1000 }
// Throttle por IP aplicado ANTES do bcrypt, só no caminho de API key (o caro).
// Limita amplificação de custo por tokens inválidos. Generoso p/ uso legítimo
// (integrações server-side de um trainer fazem poucas req/min) e fail-open.
const API_KEY_PREAUTH_LIMIT = { perMinute: 60, perDay: 5000 }

function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

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
): Promise<{ trainerId: string; keyId: string; apiKeyId: string | null } | null> {
  if (!token.startsWith('kinevo_trainer_')) return null

  // Prefixo único de 23 chars (keys novas) + fallback pro legado de 12 chars
  // ("kinevo_train", keys criadas antes do fix). Um token inválido casa ~0 keys
  // novas; só as legadas remanescentes ainda caem no fallback (e se auto-curam
  // abaixo no primeiro uso bem-sucedido).
  const newPrefix = token.slice(0, 23)
  const legacyPrefix = token.slice(0, 12)
  const supabaseAdmin = createAdminClient()

  const { data: keys } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id, trainer_id, key_hash, key_prefix')
    .in('key_prefix', [newPrefix, legacyPrefix])
    .is('revoked_at', null)

  if (!keys || keys.length === 0) return null

  for (const key of keys) {
    const match = await bcrypt.compare(token, key.key_hash)
    if (match) {
      // Auto-cura: migra o prefixo legado ("kinevo_train") pro formato único de
      // 23 chars no primeiro uso — temos a key crua aqui. Depois disso, tokens
      // inválidos param de casar essa key no fallback. Idempotente.
      const patch: { last_used_at: string; key_prefix?: string } = {
        last_used_at: new Date().toISOString(),
      }
      if (key.key_prefix !== newPrefix) patch.key_prefix = newPrefix

      supabaseAdmin
        .from('trainer_api_keys')
        .update(patch)
        .eq('id', key.id)
        .then()

      return { trainerId: key.trainer_id, keyId: key.id, apiKeyId: key.id }
    }
  }

  return null
}

// Validate a kinevo_at_* OAuth access token (sha256 hash)
async function validateOAuthToken(
  token: string
): Promise<{ trainerId: string; keyId: string; apiKeyId: string | null } | null> {
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

  // keyId is prefixed for the rate-limit key only; apiKeyId is null because an
  // OAuth token is not an API key (mcp_tool_usage_logs.api_key_id is nullable).
  return { trainerId: data.trainer_id, keyId: `oauth:${data.id}`, apiKeyId: null }
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

  // Try OAuth token first (fast sha256).
  let result = await validateOAuthToken(token)

  // API key path (slow bcrypt): throttle por IP ANTES do bcrypt para limitar
  // amplificação de custo por tokens inválidos repetidos.
  if (!result && token.startsWith('kinevo_trainer_')) {
    const pre = await consumeRateLimit(
      `mcp-apikey-ip:${clientIp(request)}`,
      API_KEY_PREAUTH_LIMIT
    )
    if (!pre.allowed) {
      throw new McpAuthError(pre.error ?? 'Rate limit exceeded', 429)
    }
    result = await validateApiKey(token)
  }

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
