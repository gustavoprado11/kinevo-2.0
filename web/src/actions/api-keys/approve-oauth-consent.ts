'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface ApproveParams {
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  state?: string
  scope?: string
}

export async function approveOAuthConsent(params: ApproveParams) {
  // 1. Authenticate the caller. NEVER trust a client-supplied trainerId —
  //    the authorization code must be bound to the logged-in trainer only.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!trainer) {
    return { error: 'Trainer not found' }
  }

  const supabaseAdmin = createAdminClient()

  // 2. Validate the client exists AND that redirect_uri is one it registered.
  //    Without this, an attacker can exfiltrate the auth code to an arbitrary URL.
  const { data: client } = await supabaseAdmin
    .from('mcp_oauth_clients')
    .select('client_id, redirect_uris')
    .eq('client_id', params.clientId)
    .single()

  if (!client) {
    return { error: 'Client not found' }
  }

  if (!client.redirect_uris?.includes(params.redirectUri)) {
    return { error: 'Invalid redirect_uri' }
  }

  // 3. Generate authorization code bound to the AUTHENTICATED trainer.
  const code = randomUUID()

  const { error } = await supabaseAdmin.from('mcp_oauth_codes').insert({
    code,
    client_id: params.clientId,
    trainer_id: trainer.id,
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
