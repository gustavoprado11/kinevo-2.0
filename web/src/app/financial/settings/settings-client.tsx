'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
    ChevronLeft, Wallet, CreditCard, Percent, ShieldAlert,
    BellRing, Settings as SettingsIcon, Check, Link2, MessageCircle,
    RefreshCw, Loader2, ExternalLink, KeyRound, AlertCircle,
} from 'lucide-react'
import { AppLayout } from '@/components/layout'
import { ASAAS_FEES, formatPercent, formatBRL } from '@/lib/asaas/fees'
import type { KinevoWalletSummary } from '@/lib/asaas'
import type { FinancialSettings } from '@/lib/financial/settings'

interface Props {
    trainer: {
        name: string
        email: string
        avatarUrl: string | null
        theme: 'light' | 'dark' | 'system' | null
    }
    wallet: KinevoWalletSummary
    hasStripeLegacyContracts: boolean
    initialSettings: FinancialSettings
}

const statusLabels = {
    not_started: 'Não ativada',
    pending: 'Em análise',
    awaiting: 'Em análise',
    approved: 'Aprovada',
    rejected: 'Reprovada',
    blocked: 'Bloqueada',
} as const

const statusColors = {
    not_started: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
    awaiting: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
    blocked: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
} as const

export function FinancialSettingsClient({
    trainer, wallet, hasStripeLegacyContracts, initialSettings,
}: Props) {
    const router = useRouter()

    // Estado centralizado das configurações (persistidas no banco)
    const [settings, setSettings] = useState<FinancialSettings>(initialSettings)
    const [savingFor, setSavingFor] = useState<keyof FinancialSettings | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [savedFor, setSavedFor] = useState<keyof FinancialSettings | null>(null)
    const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [syncing, setSyncing] = useState(false)

    // Debounce timer pro slider (graceDays — só salva quando o usuário para de arrastar)
    const graceDaysDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
            if (graceDaysDebounce.current) clearTimeout(graceDaysDebounce.current)
        }
    }, [])

    /**
     * Atualiza estado local imediatamente (optimistic) e dispara PATCH no
     * servidor. Se falhar, reverte. Aceita patch parcial — sempre passa
     * apenas os campos que mudaram.
     */
    async function save<K extends keyof FinancialSettings>(
        key: K,
        value: FinancialSettings[K]
    ) {
        const previous = settings
        setSettings(s => ({ ...s, [key]: value }))
        setSavingFor(key)
        setSaveError(null)

        try {
            const res = await fetch('/api/financial/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha ao salvar (${res.status})`)
            }
            const updated = await res.json() as FinancialSettings
            setSettings(updated)
            setSavedFor(key)
            if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
            savedTimeoutRef.current = setTimeout(() => setSavedFor(null), 1500)
        } catch (err) {
            // Reverte
            setSettings(previous)
            setSaveError(err instanceof Error ? err.message : 'Erro ao salvar')
        } finally {
            setSavingFor(null)
        }
    }

    /** Toggle imediato — usado pra todos os booleanos. */
    function toggleBool<K extends keyof FinancialSettings>(
        key: K,
        currentValue: FinancialSettings[K]
    ) {
        return () => void save(key, (!currentValue) as FinancialSettings[K])
    }

    /** Slider com debounce de 400ms — evita PATCH a cada arrastar. */
    function setGraceDays(value: number) {
        setSettings(s => ({ ...s, overdueGraceDays: value }))
        if (graceDaysDebounce.current) clearTimeout(graceDaysDebounce.current)
        graceDaysDebounce.current = setTimeout(() => {
            void save('overdueGraceDays', value)
        }, 400)
    }

    async function syncWallet() {
        setSyncing(true)
        try {
            await fetch('/api/wallet/sync', { method: 'POST' })
            router.refresh()
        } finally {
            setSyncing(false)
        }
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatarUrl}
            trainerTheme={trainer.theme}
        >
            <div className="max-w-4xl mx-auto">
                {/* Voltar */}
                <Link
                    href="/financial"
                    className="inline-flex items-center gap-1 text-sm text-[#86868B] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-colors mb-4"
                >
                    <ChevronLeft size={16} />
                    Voltar pro Financeiro
                </Link>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary">Configurações</h1>
                    <p className="text-sm text-[#86868B] dark:text-k-text-tertiary mt-1">
                        Ajustes da sua Carteira, métodos padrão, notificações e regras de inadimplência.
                    </p>
                </div>

                {/* Banner global de erro de save */}
                {saveError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-500/[0.08] border border-red-200 dark:border-red-500/20 p-3 mb-4 flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-900 dark:text-red-200">Não foi possível salvar</p>
                            <p className="text-xs text-red-800 dark:text-red-300 mt-0.5">{saveError}</p>
                        </div>
                        <button
                            onClick={() => setSaveError(null)}
                            className="text-xs text-red-700 dark:text-red-300 hover:underline"
                        >
                            Fechar
                        </button>
                    </div>
                )}

                {/* ─── Carteira ──────────────────────────────────────────── */}
                <Section
                    icon={<Wallet size={18} className="text-[#007AFF] dark:text-violet-400" />}
                    title="Carteira"
                    description="Status atual da conta financeira que recebe as cobranças."
                >
                    <Row
                        label="Status"
                        help="Última verificação automática quando você abre o financeiro."
                    >
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${statusColors[wallet.status]}`}>
                                {wallet.status === 'approved' && <Check size={10} strokeWidth={3} />}
                                {statusLabels[wallet.status]}
                            </span>
                            {wallet.status === 'approved' && (
                                <button
                                    onClick={syncWallet}
                                    disabled={syncing}
                                    className="text-xs text-[#007AFF] dark:text-violet-400 hover:text-[#0056B3] dark:hover:text-violet-300 inline-flex items-center gap-1"
                                >
                                    {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                                    Atualizar
                                </button>
                            )}
                        </div>
                    </Row>

                    {wallet.status === 'approved' && (
                        <Row
                            label="Modo"
                            help={wallet.mode === 'linked'
                                ? 'Sua conta na Asaas conectada à Kinevo via chave de API.'
                                : 'Conta criada e gerenciada via Kinevo, em parceria com a Asaas.'}
                        >
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300">
                                {wallet.mode === 'linked' ? <Link2 size={11} /> : <Wallet size={11} />}
                                {wallet.mode === 'linked' ? 'Vinculada à Asaas' : 'Criada via Kinevo'}
                            </span>
                        </Row>
                    )}

                    {wallet.ownerLabel && (
                        <Row label="Titular" help={wallet.ownerLabel}>
                            <Link
                                href="/financial/wallet"
                                className="text-xs text-[#007AFF] dark:text-violet-400 hover:underline"
                            >
                                Ver detalhes
                            </Link>
                        </Row>
                    )}

                    {wallet.status === 'rejected' && wallet.rejectionReason && (
                        <Row label="Motivo da reprovação" help={wallet.rejectionReason}>
                            <Link
                                href="/financial/wallet"
                                className="text-xs px-3 py-1.5 rounded-lg bg-[#007AFF] dark:bg-violet-600 text-white hover:bg-[#0056B3] dark:hover:bg-violet-500"
                            >
                                Refazer cadastro
                            </Link>
                        </Row>
                    )}

                    {wallet.status === 'not_started' && (
                        <div className="p-4 mx-5 mb-4 rounded-xl bg-violet-50 dark:bg-violet-500/[0.06] border border-violet-200 dark:border-violet-500/20">
                            <p className="text-sm text-[#1D1D1F] dark:text-k-text-primary font-medium mb-1">Carteira ainda não ativada</p>
                            <p className="text-xs text-[#6E6E73] dark:text-k-text-secondary mb-3">
                                Sem Carteira ativa, você não consegue cobrar via PIX/Cartão direto no app.
                            </p>
                            <Link
                                href="/financial/wallet"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#007AFF] dark:bg-violet-600 text-white text-xs font-medium hover:bg-[#0056B3] dark:hover:bg-violet-500"
                            >
                                Ativar agora
                                <ExternalLink size={11} />
                            </Link>
                        </div>
                    )}
                </Section>

                {/* ─── Métodos de pagamento padrão ──────────────────────── */}
                <Section
                    icon={<CreditCard size={18} className="text-[#007AFF] dark:text-violet-400" />}
                    title="Métodos de pagamento padrão"
                    description="Pré-seleção que aparece ao criar novos planos. Você pode mudar plano a plano depois."
                >
                    <Toggle
                        label="PIX"
                        help={`Taxa ${formatPercent(ASAAS_FEES.PIX.percent)} + ${formatBRL(ASAAS_FEES.PIX.fixed)} por recebimento. Liberação em até 1 dia útil.`}
                        on={settings.defaultAllowPix}
                        onChange={v => save('defaultAllowPix', v)}
                        saving={savingFor === 'defaultAllowPix'}
                        saved={savedFor === 'defaultAllowPix'}
                    />
                    <Toggle
                        label="Cartão de Crédito"
                        help={`Taxa ${formatPercent(ASAAS_FEES.CREDIT_CARD.percent)} + ${formatBRL(ASAAS_FEES.CREDIT_CARD.fixed)} por cobrança. Liberação em 30 dias.`}
                        on={settings.defaultAllowCreditCard}
                        onChange={v => save('defaultAllowCreditCard', v)}
                        saving={savingFor === 'defaultAllowCreditCard'}
                        saved={savedFor === 'defaultAllowCreditCard'}
                    />
                    <Toggle
                        label="Boleto bancário"
                        help={`Taxa ${formatBRL(ASAAS_FEES.BOLETO.fixed)} por boleto pago. Liberação em 3 dias úteis.`}
                        on={settings.defaultAllowBoleto}
                        onChange={v => save('defaultAllowBoleto', v)}
                        saving={savingFor === 'defaultAllowBoleto'}
                        saved={savedFor === 'defaultAllowBoleto'}
                    />
                </Section>

                {/* ─── Taxas ──────────────────────────────────────────────── */}
                <Section
                    icon={<Percent size={18} className="text-[#007AFF] dark:text-violet-400" />}
                    title="Taxas vigentes"
                    description="Cobradas pela Asaas (parceira financeira). A Kinevo não cobra taxa em cima."
                >
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[11px] uppercase tracking-wider text-[#6E6E73] dark:text-k-text-secondary border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-glass-bg">
                                <th className="text-left font-medium px-5 py-2">Método</th>
                                <th className="text-right font-medium px-5 py-2">Taxa</th>
                                <th className="text-right font-medium px-5 py-2">Liberação</th>
                            </tr>
                        </thead>
                        <tbody className="text-[#1D1D1F] dark:text-k-text-primary">
                            <FeeRowDisplay
                                method="PIX"
                                detail="Recebimento à vista"
                                fee={`${formatPercent(ASAAS_FEES.PIX.percent)} + ${formatBRL(ASAAS_FEES.PIX.fixed)}`}
                                release="Até 1 dia útil"
                            />
                            <FeeRowDisplay
                                method="Cartão de Crédito"
                                detail="À vista ou parcelado"
                                fee={`${formatPercent(ASAAS_FEES.CREDIT_CARD.percent)} + ${formatBRL(ASAAS_FEES.CREDIT_CARD.fixed)}`}
                                release="30 dias (à vista)"
                            />
                            <FeeRowDisplay
                                method="Boleto bancário"
                                detail="Por boleto pago"
                                fee={`${formatBRL(ASAAS_FEES.BOLETO.fixed)}`}
                                release="3 dias úteis"
                            />
                        </tbody>
                    </table>
                </Section>

                {/* ─── Inadimplência ──────────────────────────────────────── */}
                <Section
                    icon={<ShieldAlert size={18} className="text-[#007AFF] dark:text-violet-400" />}
                    title="Inadimplência"
                    description="O que acontece quando um aluno atrasa o pagamento."
                >
                    <Toggle
                        label="Bloquear acesso ao app após inadimplência"
                        help="Se ativado, o aluno perde acesso aos treinos no app dele até regularizar."
                        on={settings.blockOnOverdue}
                        onChange={v => save('blockOnOverdue', v)}
                        saving={savingFor === 'blockOnOverdue'}
                        saved={savedFor === 'blockOnOverdue'}
                    />
                    {settings.blockOnOverdue && (
                        <Row
                            label="Período de tolerância"
                            help={
                                <span className="flex items-center gap-2 flex-wrap">
                                    <span>Quantos dias de atraso antes de bloquear o acesso.</span>
                                    {settings.overdueGraceDays === 3 ? (
                                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                            Padrão recomendado
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => void save('overdueGraceDays', 3)}
                                            className="text-[#007AFF] dark:text-violet-400 font-medium hover:underline"
                                        >
                                            Restaurar padrão (3 dias)
                                        </button>
                                    )}
                                </span>
                            }
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={1}
                                    max={15}
                                    value={settings.overdueGraceDays}
                                    onChange={e => setGraceDays(Number(e.target.value))}
                                    className="w-32 accent-[#007AFF] dark:accent-violet-500"
                                />
                                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary min-w-[60px] text-center px-2.5 py-1 bg-[#F5F5F7] dark:bg-glass-bg rounded-md">
                                    {settings.overdueGraceDays} {settings.overdueGraceDays === 1 ? 'dia' : 'dias'}
                                </span>
                                {savingFor === 'overdueGraceDays' && (
                                    <Loader2 size={12} className="animate-spin text-[#86868B]" />
                                )}
                                {savedFor === 'overdueGraceDays' && (
                                    <Check size={12} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                )}
                            </div>
                        </Row>
                    )}
                </Section>

                {/* ─── Notificações ──────────────────────────────────────── */}
                <Section
                    icon={<BellRing size={18} className="text-[#007AFF] dark:text-violet-400" />}
                    title="Notificações"
                    description="Avisos por push no app sobre o que acontece no seu Financeiro."
                >
                    <Toggle
                        label="Quando um aluno pagar"
                        help="Push assim que a cobrança for confirmada."
                        on={settings.notifyOnPaymentReceived}
                        onChange={v => save('notifyOnPaymentReceived', v)}
                        saving={savingFor === 'notifyOnPaymentReceived'}
                        saved={savedFor === 'notifyOnPaymentReceived'}
                    />
                    <Toggle
                        label="Quando um aluno cancelar a assinatura"
                        help="Push assim que o aluno cancelar pelo app dele."
                        on={settings.notifyOnSubscriptionCanceled}
                        onChange={v => save('notifyOnSubscriptionCanceled', v)}
                        saving={savingFor === 'notifyOnSubscriptionCanceled'}
                        saved={savedFor === 'notifyOnSubscriptionCanceled'}
                    />
                    <Toggle
                        label="Quando um saque cair na conta"
                        help="Push quando o PIX cair na sua chave bancária."
                        on={settings.notifyOnPayoutCompleted}
                        onChange={v => save('notifyOnPayoutCompleted', v)}
                        saving={savingFor === 'notifyOnPayoutCompleted'}
                        saved={savedFor === 'notifyOnPayoutCompleted'}
                    />
                    <Toggle
                        label="Alertas de documentação"
                        help="Push se algum documento precisar ser reenviado ou houver problema na conta."
                        on={settings.notifyOnKycAlert}
                        onChange={v => save('notifyOnKycAlert', v)}
                        saving={savingFor === 'notifyOnKycAlert'}
                        saved={savedFor === 'notifyOnKycAlert'}
                    />
                </Section>

                {/* ─── Atalho: Chaves PIX ────────────────────────────────── */}
                <Link
                    href="/financial/pix-keys"
                    className="block rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card p-5 mb-4 transition-all hover:border-[#86868B] dark:hover:border-k-text-tertiary"
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-[#5856D6]/10 dark:bg-violet-500/10 p-2.5">
                                <KeyRound size={17} className="text-[#5856D6] dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Chaves PIX para saque</p>
                                <p className="text-xs text-[#86868B] dark:text-k-text-tertiary mt-0.5">
                                    Onde você quer receber o dinheiro quando sacar
                                </p>
                            </div>
                        </div>
                        <span className="text-xs text-[#007AFF] dark:text-violet-400 font-medium">
                            Gerenciar →
                        </span>
                    </div>
                </Link>

                {/* ─── Avançado ──────────────────────────────────────────── */}
                <Section
                    icon={<SettingsIcon size={18} className="text-[#86868B] dark:text-k-text-tertiary" />}
                    title="Avançado"
                    description="Configurações pra casos específicos."
                >
                    {hasStripeLegacyContracts && (
                        <Toggle
                            label="Mostrar contratos Stripe legados"
                            help="Você tem contratos antigos via Stripe. Mantém eles visíveis pra continuar gerenciando — novos planos sempre usam a Carteira Kinevo."
                            on={settings.showStripeLegacy}
                            onChange={v => save('showStripeLegacy', v)}
                            saving={savingFor === 'showStripeLegacy'}
                            saved={savedFor === 'showStripeLegacy'}
                        />
                    )}
                    <Row
                        label="Suporte da Kinevo"
                        help="Algum problema com a Carteira? A gente ajuda."
                    >
                        <a
                            href="mailto:suporte@kinevoapp.com"
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary text-[#1D1D1F] dark:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg"
                        >
                            <MessageCircle size={12} />
                            Falar com suporte
                        </a>
                    </Row>
                </Section>
            </div>
        </AppLayout>
    )
}

// ─── Helpers visuais ──────────────────────────────────────────────────────

function Section({
    icon, title, description, children,
}: {
    icon: React.ReactNode
    title: string
    description: string
    children: React.ReactNode
}) {
    return (
        <section className="rounded-2xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card mb-4 overflow-hidden">
            <header className="px-5 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary flex items-center gap-2">
                    {icon}
                    {title}
                </h3>
                <p className="text-xs text-[#86868B] dark:text-k-text-tertiary mt-1 max-w-[60ch]">
                    {description}
                </p>
            </header>
            <div className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                {children}
            </div>
        </section>
    )
}

function Row({
    label, help, children,
}: {
    label: string
    help?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">{label}</p>
                {help && (
                    <div className="text-xs text-[#86868B] dark:text-k-text-tertiary mt-0.5">{help}</div>
                )}
            </div>
            <div className="flex-shrink-0">
                {children}
            </div>
        </div>
    )
}

function Toggle({
    label, help, on, onChange, saving, saved,
}: {
    label: string
    help?: string
    on: boolean
    onChange: (v: boolean) => void
    saving?: boolean
    saved?: boolean
}) {
    return (
        <Row label={label} help={help}>
            <div className="flex items-center gap-2">
                {saving && <Loader2 size={12} className="animate-spin text-[#86868B] dark:text-k-text-tertiary" />}
                {saved && !saving && <Check size={13} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />}
                <ToggleSwitch on={on} onChange={onChange} disabled={saving} />
            </div>
        </Row>
    )
}

function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            disabled={disabled}
            onClick={() => onChange(!on)}
            className={`w-10 h-6 rounded-full relative transition-colors ${
                on ? 'bg-[#007AFF] dark:bg-violet-600' : 'bg-[#E8E8ED] dark:bg-k-border-primary'
            } ${disabled ? 'opacity-60 cursor-wait' : ''}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                on ? 'translate-x-4' : 'translate-x-0'
            }`} />
        </button>
    )
}

function FeeRowDisplay({ method, detail, fee, release }: {
    method: string; detail: string; fee: string; release: string
}) {
    return (
        <tr className="border-b border-[#E8E8ED] dark:border-k-border-subtle last:border-b-0">
            <td className="px-5 py-3">
                <p className="font-medium">{method}</p>
                <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary">{detail}</p>
            </td>
            <td className="px-5 py-3 text-right tabular-nums">{fee}</td>
            <td className="px-5 py-3 text-right text-sm text-[#6E6E73] dark:text-k-text-secondary">{release}</td>
        </tr>
    )
}
