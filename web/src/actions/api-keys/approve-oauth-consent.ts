'use server'

import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

interface ApproveParams {
  trainerId: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  state?: string
  scope?: string
}

export async function approveOAuthConsent(params: ApproveParams) {
  const supabaseAdmin = createAdminClient()

  // Validate client exists
  const { data: client } = await supabaseAdmin
    .from('mcp_oauth_clients')
    .select('client_id')
    .eq('client_id', params.clientId)
    .single()

  if (!client) {
    return { error: 'Client not found' }
  }

  // Generate authorization code (plain text — short-lived, single-use)
  const code = randomUUID()

  const { error } = await supabaseAdmin.from('mcp_oauth_codes').insert({
    code,
    client_id: params.clientId,
    trainer_id: params.trainerId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    scope: params.scope ?? 'mcp',
    state: params.state,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
  })

  if (error) {
    return { error: 'Failed to create authorization code' }
  }

  // Build redirect URL
  const url = new URL(params.redirectUri)
  url.searchParams.set('code', code)
  if (params.state) url.searchParams.set('state', params.state)

  return { redirect: url.toString() }
}
