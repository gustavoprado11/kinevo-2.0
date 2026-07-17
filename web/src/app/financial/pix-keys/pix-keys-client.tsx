'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
    ChevronLeft, KeyRound, Plus, Loader2, Star, X, Check,
    Smartphone, Mail, IdCard, Building2, Hash, Info,
} from 'lucide-react'
import { AppLayout } from '@/components/layout'
// Importa direto do submódulo (não do barrel) pra evitar que o webpack puxe
// `encryption.ts` (que usa `node:crypto`, exclusivo do server) no bundle client.
import { isPixKeyFormatValid as isFormatValidLocal } from '@/lib/asaas/pix'
import type { PixKeyType } from '@/lib/asaas'

interface PixKeyRow {
    id: string
    alias: string
    pix_key: string
    key_type: PixKeyType
    owner_name: string | null
    bank_name: string | null
    is_default: boolean
    created_at: string
}

interface Props {
    trainer: {
        name: string
        email: string
        avatarUrl: string | null
        theme: 'light' | 'dark' | 'system' | null
    }
    pixKeys: PixKeyRow[]
}

const keyTypeLabels: Record<PixKeyType, string> = {
    CPF: 'CPF',
    CNPJ: 'CNPJ',
    EMAIL: 'Email',
    PHONE: 'Telefone',
    EVP: 'Chave aleatória',
}

function KeyTypeIcon({ type }: { type: PixKeyType }) {
    const size = 18
    switch (type) {
        case 'CPF': return <IdCard size={size} />
        case 'CNPJ': return <Building2 size={size} />
        case 'EMAIL': return <Mail size={size} />
        case 'PHONE': return <Smartphone size={size} />
        case 'EVP': return <Hash size={size} />
    }
}

function maskPixKey(key: string, type: PixKeyType): string {
    const k = key.replace(/\D/g, '')
    switch (type) {
        case 'CPF':
            if (k.length === 11) return `${k.slice(0, 3)}.●●●.●●●-${k.slice(-2)}`
            return key
        case 'CNPJ':
            if (k.length === 14) return `${k.slice(0, 2)}.●●●.●●●/●●●●-${k.slice(-2)}`
            return key
        case 'PHONE':
            if (k.length >= 10) return `(${k.slice(0, 2)}) ●●●●●-${k.slice(-4)}`
            return key
        case 'EMAIL':
            const [user, domain] = key.split('@')
            if (!user || !domain) return key
            const masked = user.length <= 2 ? user[0] + '●' : user[0] + '●●●●' + user.slice(-1)
            return `${masked}@${domain}`
        case 'EVP':
            if (key.length > 12) return `${key.slice(0, 8)}-●●●●-●●●●-●●●●-${key.slice(-4)}`
            return key
    }
}

export function PixKeysClient({ trainer, pixKeys }: Props) {
    const router = useRouter()
    const [adding, setAdding] = useState(false)
    const [pending, startTx] = useTransition()
    const [error, setError] = useState<string | null>(null)

    async function removeKey(id: string) {
        if (!confirm('Remover essa chave PIX? Se ela era a padrão, escolha outra como padrão depois.')) return
        startTx(async () => {
            const res = await fetch(`/api/wallet/pix-keys/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(body.error || 'Erro ao remover')
                return
            }
            router.refresh()
        })
    }

    async function setDefault(id: string) {
        startTx(async () => {
            const res = await fetch(`/api/wallet/pix-keys/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDefault: true }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(body.error || 'Erro ao definir padrão')
                return
            }
            router.refresh()
        })
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatarUrl}
            trainerTheme={trainer.theme}
        >
            <div className="max-w-3xl mx-auto">
                {/* Voltar */}
                <Link
                    href="/financial"
                    className="inline-flex items-center gap-1 text-sm text-[#86868B] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-colors mb-4"
                >
                    <ChevronLeft size={16} />
                    Voltar pro Financeiro
                </Link>

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary">Chaves PIX</h1>
                        <p className="text-sm text-[#86868B] dark:text-k-text-tertiary mt-1">
                            Onde você quer receber o dinheiro quando sacar da sua Carteira.
                        </p>
                    </div>
                    {!adding && (
                        <button
                            onClick={() => setAdding(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium transition-colors active:scale-[0.98]"
                        >
                            <Plus size={15} />
                            Adicionar chave
                        </button>
                    )}
                </div>

                {/* Aviso CPF/CNPJ */}
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-500/20 p-3 mb-4 flex gap-3">
                    <Info size={16} className="text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 dark:text-amber-200">
                        A chave precisa estar no <b>mesmo CPF/CNPJ</b> da sua conta na Asaas — não é permitido sacar pra terceiros.
                        Confirmamos automaticamente o dono da chave antes de salvar.
                    </p>
                </div>

                {/* Erro */}
                {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-500/[0.08] border border-red-200 dark:border-red-500/20 p-3 mb-4 flex items-start gap-3">
                        <p className="text-sm text-red-900 dark:text-red-200 flex-1">{error}</p>
                        <button onClick={() => setError(null)} className="text-red-700 dark:text-red-300">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Form de adicionar */}
                {adding && (
                    <AddKeyForm
                        onCancel={() => setAdding(false)}
                        onSuccess={() => { setAdding(false); router.refresh() }}
                        isFirstKey={pixKeys.length === 0}
                    />
                )}

                {/* Lista */}
                {pixKeys.length === 0 && !adding ? (
                    <div className="rounded-2xl border border-dashed border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card p-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-[#F5F5F7] dark:bg-glass-bg mx-auto flex items-center justify-center mb-3">
                            <KeyRound size={20} className="text-[#86868B] dark:text-k-text-tertiary" />
                        </div>
                        <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary mb-1">
                            Nenhuma chave cadastrada ainda
                        </p>
                        <p className="text-xs text-[#86868B] dark:text-k-text-tertiary mb-4 max-w-xs mx-auto">
                            Você precisa adicionar pelo menos uma chave PIX pra poder sacar o saldo da sua Carteira.
                        </p>
                        <button
                            onClick={() => setAdding(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium"
                        >
                            <Plus size={15} />
                            Adicionar primeira chave
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {pixKeys.map(k => (
                            <div
                                key={k.id}
                                className={`rounded-2xl border p-4 flex items-center gap-4 transition-colors ${
                                    k.is_default
                                        ? 'border-amber-300 dark:border-amber-500/40 bg-gradient-to-r from-amber-50 to-white dark:from-amber-500/[0.05] dark:to-surface-card'
                                        : 'border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    k.is_default
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                        : 'bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-violet-500/10 dark:text-violet-400'
                                }`}>
                                    <KeyTypeIcon type={k.key_type} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                            {k.alias}
                                        </p>
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F5F5F7] dark:bg-glass-bg text-[#6E6E73] dark:text-k-text-secondary">
                                            {keyTypeLabels[k.key_type]}
                                        </span>
                                        {k.is_default && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                                                <Star size={9} fill="currentColor" />
                                                Padrão
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[#6E6E73] dark:text-k-text-secondary font-mono mt-0.5">
                                        {maskPixKey(k.pix_key, k.key_type)}
                                    </p>
                                    {(k.owner_name || k.bank_name) && (
                                        <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary mt-1 inline-flex items-center gap-1">
                                            <Check size={10} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                            {k.owner_name ?? '—'}
                                            {k.bank_name && ` · ${k.bank_name}`}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {!k.is_default && (
                                        <button
                                            onClick={() => setDefault(k.id)}
                                            disabled={pending}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary text-[#1D1D1F] dark:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg disabled:opacity-50"
                                        >
                                            Definir como padrão
                                        </button>
                                    )}
                                    <button
                                        onClick={() => removeKey(k.id)}
                                        disabled={pending}
                                        className="text-xs px-3 py-1.5 rounded-lg text-[#FF3B30] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.08] disabled:opacity-50"
                                    >
                                        Remover
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}

// ─── Form pra adicionar chave ────────────────────────────────────────────

const keyTypeMeta: Record<PixKeyType, {
    placeholder: string
    helper: string
    inputMode: 'text' | 'numeric' | 'email' | 'tel'
}> = {
    CPF: {
        placeholder: '000.000.000-00',
        helper: '11 dígitos. Pode digitar com ou sem pontuação — a gente padroniza.',
        inputMode: 'numeric',
    },
    CNPJ: {
        placeholder: '00.000.000/0000-00',
        helper: '14 dígitos. Pode digitar com ou sem pontuação.',
        inputMode: 'numeric',
    },
    EMAIL: {
        placeholder: 'voce@email.com',
        helper: 'Email que você cadastrou como chave PIX no seu banco.',
        inputMode: 'email',
    },
    PHONE: {
        placeholder: '(11) 99999-9999',
        helper: 'Com DDD. Você pode incluir +55 ou só DDD — a gente formata.',
        inputMode: 'tel',
    },
    EVP: {
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        helper: 'Chave aleatória que o seu banco gera (formato UUID). Tem 36 caracteres com traços.',
        inputMode: 'text',
    },
}

// Validação local agora usa `isPixKeyFormatValid` importada de @/lib/asaas
// no topo do arquivo — garante paridade exata com o backend (inclui
// validação de checksum CPF/CNPJ, não só formato).

function AddKeyForm({
    onCancel, onSuccess, isFirstKey,
}: {
    onCancel: () => void
    onSuccess: () => void
    isFirstKey: boolean
}) {
    const [alias, setAlias] = useState('')
    const [pixKey, setPixKey] = useState('')
    const [keyType, setKeyType] = useState<PixKeyType>('CPF')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const meta = keyTypeMeta[keyType]
    const formatOk = isFormatValidLocal(pixKey, keyType)
    const formatTouched = pixKey.trim().length > 0

    async function submit() {
        if (!formatOk) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/wallet/pix-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alias: alias.trim(),
                    pixKey: pixKey.trim(),
                    keyType,
                    isDefault: isFirstKey,
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha ao salvar (${res.status})`)
            }
            onSuccess()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
        } finally {
            setBusy(false)
        }
    }

    const canSubmit = alias.trim().length >= 2 && formatOk && !busy

    /**
     * Mensagem indicando o que falta pra habilitar o submit. Quando o botão
     * fica cinza sem explicação, o usuário não sabe o que fazer.
     */
    const missingFieldHint = (() => {
        if (busy) return null
        const aliasMissing = alias.trim().length < 2
        const keyMissing = !formatOk
        if (aliasMissing && keyMissing) return 'Preencha o apelido e a chave PIX.'
        if (aliasMissing) return 'Falta preencher o apelido.'
        if (keyMissing) return 'Verifique o formato da chave acima.'
        return null
    })()

    return (
        <div className="rounded-2xl border border-[#7C3AED]/20 dark:border-violet-500/20 bg-[#7C3AED]/[0.03] dark:bg-violet-500/[0.04] p-5 mb-4">
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary mb-3">
                Adicionar nova chave PIX
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <Field label="Apelido (pra você identificar)">
                    <input
                        className={inputCls}
                        value={alias}
                        onChange={e => setAlias(e.target.value)}
                        placeholder="Ex: Nubank PJ"
                    />
                </Field>
                <Field label="Tipo de chave">
                    <select
                        className={inputCls}
                        value={keyType}
                        onChange={e => {
                            setKeyType(e.target.value as PixKeyType)
                            setPixKey('') // limpa input ao trocar tipo
                        }}
                    >
                        <option value="CPF">CPF</option>
                        <option value="CNPJ">CNPJ</option>
                        <option value="EMAIL">Email</option>
                        <option value="PHONE">Telefone</option>
                        <option value="EVP">Aleatória (EVP)</option>
                    </select>
                </Field>
            </div>

            <Field label="Chave PIX">
                <div className="relative">
                    <input
                        className={`${inputCls} ${
                            formatTouched && !formatOk
                                ? 'border-red-300 dark:border-red-500/40 focus:ring-red-500/30 focus:border-red-500'
                                : formatTouched && formatOk
                                ? 'border-emerald-300 dark:border-emerald-500/40 focus:ring-emerald-500/30 focus:border-emerald-500'
                                : ''
                        } pr-8`}
                        value={pixKey}
                        onChange={e => setPixKey(e.target.value)}
                        placeholder={meta.placeholder}
                        inputMode={meta.inputMode}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {formatTouched && formatOk && (
                        <Check
                            size={16}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400"
                            strokeWidth={3}
                        />
                    )}
                    {formatTouched && !formatOk && (
                        <X
                            size={16}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400"
                        />
                    )}
                </div>
                <p className={`text-[11px] mt-1.5 ${
                    formatTouched && !formatOk
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-[#86868B] dark:text-k-text-tertiary'
                }`}>
                    {meta.helper}
                </p>
            </Field>

            {error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-3">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
                {missingFieldHint && (
                    <span className="text-[11px] text-[#86868B] dark:text-k-text-tertiary flex-1 text-left">
                        {missingFieldHint}
                    </span>
                )}
                <button
                    onClick={onCancel}
                    disabled={busy}
                    className="text-sm px-4 py-2 rounded-xl text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg"
                >
                    Cancelar
                </button>
                <button
                    onClick={submit}
                    disabled={!canSubmit}
                    title={missingFieldHint ?? undefined}
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-control bg-primary hover:opacity-90 text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Validar e salvar
                </button>
            </div>
        </div>
    )
}

const inputCls =
    'w-full px-3.5 py-2 rounded-lg border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 dark:focus:ring-violet-500/30 focus:border-[#7C3AED] dark:focus:border-violet-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-[11px] font-medium text-[#6E6E73] dark:text-k-text-secondary mb-1.5 block uppercase tracking-wide">
                {label}
            </span>
            {children}
        </label>
    )
}
