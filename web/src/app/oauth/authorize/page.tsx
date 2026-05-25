import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { OAuthConsentForm } from '@/components/settings/oauth-consent-form'

function InvalidRequest({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] dark:bg-[#09090B]">
      <div className="max-w-md mx-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 text-center">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Requisicao invalida</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

interface PageProps {
  searchParams: Promise<{
    client_id?: string
    redirect_uri?: string
    response_type?: string
    code_challenge?: string
    code_challenge_method?: string
    state?: string
    scope?: string
  }>
}

export default async function OAuthAuthorizePage({ searchParams }: PageProps) {
  const params = await searchParams
  const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope } = params

  // Validate required params
  if (!client_id || !redirect_uri || response_type !== 'code' || !code_challenge) {
    return <InvalidRequest message="Parametros de autorizacao ausentes ou incorretos." />
  }

  // Validate the client exists and that redirect_uri is one it registered.
  // Prevents showing a consent screen that would leak the auth code to an
  // attacker-controlled URL (open redirect / code exfiltration).
  const supabaseAdmin = createAdminClient()
  const { data: oauthClient } = await supabaseAdmin
    .from('mcp_oauth_clients')
    .select('client_id, redirect_uris')
    .eq('client_id', client_id)
    .single()

  if (!oauthClient || !oauthClient.redirect_uris?.includes(redirect_uri)) {
    return <InvalidRequest message="Cliente ou redirect_uri nao autorizado." />
  }

  // Check if trainer is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login, then back here
    const currentUrl = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`
    redirect(`/login?redirect=${encodeURIComponent(currentUrl)}`)
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, email')
    .eq('auth_user_id', user.id)
    .single()

  if (!trainer) {
    return <InvalidRequest message="Treinador nao encontrado para este usuario." />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] dark:bg-[#09090B]">
      <OAuthConsentForm
        trainerName={trainer.name}
        trainerEmail={trainer.email}
        clientId={client_id}
        redirectUri={redirect_uri}
        codeChallenge={code_challenge}
        codeChallengeMethod={code_challenge_method ?? 'S256'}
        state={state}
        scope={scope}
      />
    </div>
  )
}
