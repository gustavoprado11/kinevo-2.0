'use client'

import { useState, useCallback } from 'react'
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, Loader2, Bot } from 'lucide-react'
import { generateApiKey } from '@/actions/api-keys/generate-api-key'
import { revokeApiKey } from '@/actions/api-keys/revoke-api-key'
import { ConnectionInstructions } from './connection-instructions'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

interface ApiKeysListProps {
  initialKeys: ApiKey[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return 'Nunca usado'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d atrás`
  return formatDate(dateStr)
}

export function ApiKeysList({ initialKeys }: ApiKeysListProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [keyName, setKeyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await generateApiKey(keyName || undefined)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setGeneratedKey(result.data.raw_key)
    setKeys(prev => [
      {
        id: result.data.id,
        name: result.data.name,
        key_prefix: result.data.key_prefix,
        created_at: result.data.created_at,
        last_used_at: null,
      },
      ...prev,
    ])
  }, [keyName])

  const handleRevoke = useCallback(async (keyId: string) => {
    setLoading(true)
    const result = await revokeApiKey(keyId)
    setLoading(false)

    if (result.success) {
      setKeys(prev => prev.filter(k => k.id !== keyId))
    }
    setShowRevokeConfirm(null)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!generatedKey) return
    await navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedKey])

  const closeGenerateModal = useCallback(() => {
    setShowGenerateModal(false)
    setGeneratedKey(null)
    setKeyName('')
    setError(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-xl bg-violet-500/10 p-2.5">
            <Bot size={20} className="text-violet-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-k-text-primary">Conectar com IA</h2>
            <p className="text-sm text-k-text-tertiary mt-0.5">
              Use o Claude.ai ou o ChatGPT para gerenciar alunos e treinos por voz.
            </p>
          </div>
        </div>
        <ConnectionInstructions />
      </div>

      {/* Keys list */}
      <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-k-text-primary">Suas API Keys</h3>
          <button
            onClick={() => setShowGenerateModal(true)}
            disabled={keys.length >= 5}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Gerar nova
          </button>
        </div>

        {keys.length === 0 ? (
          <div className="text-center py-8 text-sm text-k-text-quaternary">
            <Key size={24} className="mx-auto mb-2 opacity-40" />
            Nenhuma API Key gerada ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map(k => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-k-text-primary truncate">{k.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-k-text-quaternary">
                    <span className="font-mono">{k.key_prefix}...</span>
                    <span>Criada em {formatDate(k.created_at)}</span>
                    <span>{formatTimeAgo(k.last_used_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowRevokeConfirm(k.id)}
                  className="ml-4 shrink-0 rounded-lg p-1.5 text-k-text-quaternary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Revogar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-xl">
            {!generatedKey ? (
              <>
                <h3 className="text-lg font-bold text-k-text-primary mb-1">Gerar nova API Key</h3>
                <p className="text-sm text-k-text-tertiary mb-4">
                  Dê um nome para identificar onde esta key será usada.
                </p>
                <input
                  type="text"
                  value={keyName}
                  onChange={e => setKeyName(e.target.value)}
                  placeholder="Minha API Key"
                  className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                />
                {error && (
                  <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {error}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={closeGenerateModal}
                    className="flex-1 rounded-lg border border-k-border-subtle px-4 py-2 text-sm font-semibold text-k-text-secondary hover:bg-glass-bg-active transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex-1 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Gerar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-k-text-primary mb-1">Key gerada</h3>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                  <p className="text-xs text-amber-300 font-medium">
                    Copie esta chave agora. Ela não será exibida novamente.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-xs font-mono text-k-text-primary break-all select-all">
                    {generatedKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded-lg border border-k-border-subtle p-2 hover:bg-glass-bg-active transition-colors"
                    title="Copiar"
                  >
                    {copied ? (
                      <Check size={16} className="text-emerald-400" />
                    ) : (
                      <Copy size={16} className="text-k-text-tertiary" />
                    )}
                  </button>
                </div>
                <button
                  onClick={closeGenerateModal}
                  className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 transition-colors"
                >
                  Pronto, copiei a chave
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revoke Confirmation */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-xl">
            <h3 className="text-base font-bold text-k-text-primary mb-2">Revogar API Key?</h3>
            <p className="text-sm text-k-text-tertiary">
              Conexões usando esta key deixarão de funcionar imediatamente.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowRevokeConfirm(null)}
                className="flex-1 rounded-lg border border-k-border-subtle px-4 py-2 text-sm font-semibold text-k-text-secondary hover:bg-glass-bg-active transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRevoke(showRevokeConfirm)}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Revogar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
