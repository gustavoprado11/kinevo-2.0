'use client'

import { useState } from 'react'
import { Shield, Bot, Loader2, CheckCircle2 } from 'lucide-react'
import { approveOAuthConsent } from '@/actions/api-keys/approve-oauth-consent'

interface OAuthConsentFormProps {
  trainerName: string
  trainerEmail: string
  clientId: string
  clientName: string | null
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  state?: string
  scope?: string
}

export function OAuthConsentForm({
  trainerName,
  trainerEmail,
  clientId,
  clientName,
  redirectUri,
  codeChallenge,
  codeChallengeMethod,
  state,
  scope,
}: OAuthConsentFormProps) {
  // Host do destino para onde o código de autorização será enviado. Mostrar isto
  // (e o nome do cliente) deixa o treinador reconhecer um app falso — o registro
  // de clientes é aberto, então qualquer um pode registrar "Claude" com um
  // redirect_uri próprio. React escapa o texto automaticamente (sem risco de XSS).
  let redirectHost = redirectUri
  try {
    redirectHost = new URL(redirectUri).host
  } catch {
    // mantém o valor bruto se não for uma URL válida
  }
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setLoading(true)
    setError(null)
    // trainerId is resolved server-side from the authenticated session — not sent by the client.
    const result = await approveOAuthConsent({
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      state,
      scope,
    })

    if (result.redirect) {
      setDone(true)
      window.location.href = result.redirect
    } else {
      setError(result.error ?? 'Falha ao autorizar.')
      setLoading(false)
    }
  }

  function handleDeny() {
    const url = new URL(redirectUri)
    url.searchParams.set('error', 'access_denied')
    if (state) url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  if (done) {
    return (
      <div className="max-w-md mx-4 w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 shadow-lg text-center">
        <div className="flex items-center justify-center mb-4">
          <CheckCircle2 size={48} className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Autorizado!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Voce pode fechar esta janela e voltar ao aplicativo.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-4 w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 shadow-lg">
      <div className="flex items-center justify-center mb-6">
        <div className="rounded-2xl bg-violet-500/10 p-4">
          <Bot size={32} className="text-violet-500" />
        </div>
      </div>

      <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-1">
        Autorizar acesso ao Kinevo
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
        <span className="font-semibold text-gray-900 dark:text-white">{clientName || 'Um aplicativo externo'}</span>{' '}
        quer acessar sua conta Kinevo.
      </p>

      <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{trainerName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{trainerEmail}</p>
      </div>

      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mb-6">
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Após autorizar, o Kinevo vai enviar o acesso para:
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white break-all">{redirectHost}</p>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Só continue se você reconhece este aplicativo e este destino. Autorizar dá
          acesso à sua conta (alunos, mensagens e financeiro).
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-3">
          <Shield size={16} className="mt-0.5 text-violet-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Permissoes solicitadas</p>
            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <li>Gerenciar alunos e programas de treino</li>
              <li>Enviar mensagens para alunos</li>
              <li>Consultar dados financeiros (somente leitura)</li>
              <li>Acompanhar progresso e metricas</li>
            </ul>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleDeny}
          className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Autorizar'}
        </button>
      </div>
    </div>
  )
}
