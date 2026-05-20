// ============================================================================
// CobrarCarteiraModal — venda via Carteira Kinevo (Asaas)
// ============================================================================
// Modal Asaas-first: trainer escolhe aluno + plano + tipo (avulsa/recorrente)
// e a UI mostra a simulação de quanto ele recebe líquido por método.
// Submit chama:
//   - POST /api/wallet/charges          (avulsa, one-off)
//   - POST /api/wallet/subscriptions    (recorrente, herda ciclo do plano)
//
// Resultado: invoiceUrl + botões Copiar / WhatsApp.
// ============================================================================

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    X, Loader2, AlertCircle, Copy, Check,
    MessageCircle, Wallet, CalendarClock, Receipt,
} from 'lucide-react'
import { FeesSimulationCard } from './fees-simulation-card'

interface Plan {
    id: string
    title: string
    price: number
    interval: string
    allow_pix?: boolean
    allow_credit_card?: boolean
    allow_boleto?: boolean
}

interface Student {
    id: string
    name: string
    email: string
}

type ChargeMode = 'one_off' | 'recurring'

interface CobrarCarteiraModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialStudent?: { id: string; name: string } | null
    students: Student[]
    plans: Plan[]
    /** Se a Carteira do trainer ainda não está aprovada, dispara CTA pra ativar */
    walletStatus: 'not_started' | 'pending' | 'awaiting' | 'approved' | 'rejected' | 'blocked'
    /** Pré-seleciona o tipo de cobrança quando abre. Default: 'one_off'. */
    initialMode?: ChargeMode
}

const intervalLabel = (interval: string): string => {
    switch (interval) {
        case 'month': return 'mensal'
        case 'quarter': return 'trimestral'
        case 'year': return 'anual'
        default: return interval
    }
}

const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CobrarCarteiraModal({
    isOpen,
    onClose,
    onSuccess,
    initialStudent,
    students,
    plans,
    walletStatus,
    initialMode = 'one_off',
}: CobrarCarteiraModalProps) {
    const [studentId, setStudentId] = useState('')
    const [planId, setPlanId] = useState('')
    const [mode, setMode] = useState<ChargeMode>(initialMode)
    const [dueDate, setDueDate] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setStudentId(initialStudent?.id ?? '')
            setPlanId('')
            // Respeita o modo que o caller pediu (ex: dropdown "Nova assinatura"
            // já abre o modal em recurring).
            setMode(initialMode)
            // dueDate padrão: hoje + 3 dias
            const d = new Date()
            d.setDate(d.getDate() + 3)
            setDueDate(d.toISOString().slice(0, 10))
            setLoading(false)
            setError('')
            setInvoiceUrl(null)
            setCopied(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialMode])

    const selectedPlan = useMemo(
        () => plans.find(p => p.id === planId) ?? null,
        [plans, planId]
    )

    const allowedMethods = useMemo(() => {
        if (!selectedPlan) return ['PIX', 'CREDIT_CARD'] as const
        const m: Array<'PIX' | 'CREDIT_CARD' | 'BOLETO'> = []
        if (selectedPlan.allow_pix ?? true) m.push('PIX')
        if (selectedPlan.allow_credit_card ?? true) m.push('CREDIT_CARD')
        if (selectedPlan.allow_boleto) m.push('BOLETO')
        return m.length > 0 ? m : (['PIX', 'CREDIT_CARD'] as const)
    }, [selectedPlan])

    const canSubmit = !loading && studentId && planId && dueDate && selectedPlan

    if (!isOpen) return null

    // ---- Wallet not ready guard ----
    if (walletStatus !== 'approved') {
        return (
            <ModalShell title="Carteira Kinevo" onClose={onClose}>
                <div className="text-center py-4">
                    <Wallet className="w-10 h-10 mx-auto mb-3 text-violet-500" strokeWidth={1.5} />
                    <p className="text-sm text-k-text-secondary mb-1">
                        Sua Carteira ainda não está liberada
                    </p>
                    <p className="text-xs text-k-text-quaternary mb-4">
                        {walletStatus === 'not_started'
                            ? 'Ative sua Carteira pra começar a cobrar via PIX e cartão direto no app.'
                            : 'Estamos validando seus dados. Te avisamos por push assim que liberar.'}
                    </p>
                    <div className="flex gap-2 justify-center">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg border border-k-border-subtle text-k-text-secondary hover:bg-glass-bg transition-colors"
                        >
                            Fechar
                        </button>
                        {walletStatus === 'not_started' && (
                            <a
                                href="/financial/wallet"
                                className="px-4 py-2 text-sm rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-colors"
                            >
                                Ativar Carteira
                            </a>
                        )}
                    </div>
                </div>
            </ModalShell>
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (!studentId || !planId || !selectedPlan) {
            setError('Selecione aluno e plano.')
            return
        }

        setLoading(true)
        try {
            // Avulsa e recorrente agora compartilham UX: ambas retornam um
            // Payment Link URL que o trainer manda pro aluno. A diferença é só
            // o chargeType no backend.
            const endpoint = mode === 'recurring' ? '/api/wallet/subscriptions' : '/api/wallet/charges'
            const requestBody = mode === 'recurring'
                ? { studentId, planId, nextDueDate: dueDate }
                : {
                    studentId,
                    planId,
                    value: selectedPlan.price,
                    dueDate,
                    description: selectedPlan.title,
                }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha (${res.status})`)
            }
            const body = await res.json() as { url?: string; invoiceUrl?: string }
            const link = body.url ?? body.invoiceUrl
            if (!link) throw new Error('Resposta do servidor não trouxe link de pagamento.')
            setInvoiceUrl(link)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
        } finally {
            setLoading(false)
        }
    }

    // ---- After-success: invoice URL ----
    if (invoiceUrl) {
        const studentName = students.find(s => s.id === studentId)?.name ?? 'seu aluno'
        const message = `Olá ${studentName}! Aqui está o link para você pagar: ${invoiceUrl}`
        const wpUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
        return (
            <ModalShell title="Cobrança criada" onClose={() => { onClose(); onSuccess() }}>
                <div className="text-center py-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                        <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                    </div>
                    <p className="text-sm text-k-text-secondary mb-1">
                        Compartilhe esse link com seu aluno
                    </p>
                    <p className="text-xs text-k-text-quaternary mb-4">
                        Ele preenche o CPF na hora do pagamento e o status atualiza aqui automaticamente.
                    </p>
                    <div className="rounded-lg border border-k-border-subtle bg-surface-inset p-3 text-xs text-k-text-secondary break-all mb-4 text-left max-h-20 overflow-auto">
                        {invoiceUrl}
                    </div>
                    <div className="flex gap-2 justify-center flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(invoiceUrl)
                                setCopied(true)
                                setTimeout(() => setCopied(false), 1500)
                            }}
                            className="px-4 py-2 text-sm rounded-lg border border-k-border-subtle text-k-text-secondary hover:bg-glass-bg transition-colors inline-flex items-center gap-2"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copiado!' : 'Copiar link'}
                        </button>
                        <a
                            href={wpUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors inline-flex items-center gap-2"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Enviar no WhatsApp
                        </a>
                    </div>
                    <button
                        type="button"
                        onClick={() => { onClose(); onSuccess() }}
                        className="mt-5 text-xs text-k-text-quaternary hover:text-k-text-secondary transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </ModalShell>
        )
    }

    // ---- Main form ----
    return (
        <ModalShell title="Cobrar pela Carteira" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Aluno */}
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">Aluno</label>
                    {initialStudent ? (
                        <div className="px-3 py-2.5 rounded-lg border border-k-border-subtle bg-surface-inset text-sm text-k-text-primary">
                            {initialStudent.name}
                        </div>
                    ) : (
                        <select
                            value={studentId}
                            onChange={e => setStudentId(e.target.value)}
                            className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-sm text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                        >
                            <option value="">Selecione...</option>
                            {students.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Plano */}
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">Plano</label>
                    <select
                        value={planId}
                        onChange={e => setPlanId(e.target.value)}
                        className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-sm text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    >
                        <option value="">Selecione...</option>
                        {plans.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.title} — {formatBRL(Number(p.price))} ({intervalLabel(p.interval)})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Tipo (avulsa vs recorrente) */}
                <div>
                    <label className="mb-2 block text-xs font-medium text-k-text-tertiary">Tipo de cobrança</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setMode('one_off')}
                            className={`relative rounded-lg border-2 px-3 py-2.5 pr-7 text-left transition-all ${
                                mode === 'one_off'
                                    ? 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/20'
                                    : 'border-k-border-subtle bg-glass-bg hover:border-violet-500/40'
                            }`}
                        >
                            {mode === 'one_off' && (
                                <Check className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-violet-600 dark:text-violet-400" strokeWidth={3} />
                            )}
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Receipt className={`w-3.5 h-3.5 ${mode === 'one_off' ? 'text-violet-600 dark:text-violet-400' : 'text-k-text-tertiary'}`} />
                                <span className={`text-xs font-semibold ${mode === 'one_off' ? 'text-violet-700 dark:text-violet-300' : 'text-k-text-primary'}`}>Avulsa</span>
                            </div>
                            <p className="text-[11px] text-k-text-tertiary leading-tight">
                                Uma cobrança única
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('recurring')}
                            className={`relative rounded-lg border-2 px-3 py-2.5 pr-7 text-left transition-all ${
                                mode === 'recurring'
                                    ? 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/20'
                                    : 'border-k-border-subtle bg-glass-bg hover:border-violet-500/40'
                            }`}
                        >
                            {mode === 'recurring' && (
                                <Check className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-violet-600 dark:text-violet-400" strokeWidth={3} />
                            )}
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <CalendarClock className={`w-3.5 h-3.5 ${mode === 'recurring' ? 'text-violet-600 dark:text-violet-400' : 'text-k-text-tertiary'}`} />
                                <span className={`text-xs font-semibold ${mode === 'recurring' ? 'text-violet-700 dark:text-violet-300' : 'text-k-text-primary'}`}>Recorrente</span>
                            </div>
                            <p className="text-[11px] text-k-text-tertiary leading-tight">
                                Cobra automático {selectedPlan ? `(${intervalLabel(selectedPlan.interval)})` : ''}
                            </p>
                        </button>
                    </div>
                </div>

                {/* Vencimento */}
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                        {mode === 'recurring' ? 'Primeira cobrança em' : 'Vencimento'}
                    </label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-sm text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    />
                </div>

                {/* Simulação de taxas */}
                {selectedPlan && (
                    <FeesSimulationCard
                        value={selectedPlan.price}
                        methods={[...allowedMethods] as Array<'PIX' | 'CREDIT_CARD' | 'BOLETO'>}
                        compact
                        title="Valor que entra na sua Carteira"
                    />
                )}

                {/* Erro */}
                {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                {/* Submit */}
                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg text-k-text-secondary hover:bg-glass-bg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="px-4 py-2 text-sm rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {mode === 'recurring' ? 'Criar assinatura' : 'Gerar cobrança'}
                    </button>
                </div>
            </form>
        </ModalShell>
    )
}

// ---- Shell reutilizável (mesmo visual de outros modais) ----
function ModalShell({ title, onClose, children }: {
    title: string
    onClose: () => void
    children: React.ReactNode
}) {
    // Body scroll lock enquanto o modal está aberto — evita que tentar
    // rolar o modal acabe rolando a página de fundo em telas baixas.
    useEffect(() => {
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previous
        }
    }, [])

    return (
        // Wrapper externo permite rolar o modal todo quando ele não cabe
        // na viewport (mobile / telas baixas). overscroll-contain evita que
        // o overscroll volte a rolar a página.
        <div className="fixed inset-0 z-modal overflow-y-auto overscroll-contain">
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />
            <div className="relative flex min-h-full items-start sm:items-center justify-center p-4">
                <div className="relative w-full max-w-md flex flex-col max-h-[calc(100dvh-2rem)] rounded-3xl border border-transparent bg-surface-card backdrop-blur-xl shadow-2xl ring-1 ring-k-border-primary animate-in fade-in zoom-in-95 duration-200">
                    {/* Header fixo */}
                    <div className="flex-shrink-0 flex items-center justify-between border-b border-k-border-subtle bg-surface-inset px-6 py-4 rounded-t-3xl">
                        <h2 className="text-base font-bold text-k-text-primary tracking-tight">{title}</h2>
                        <button
                            onClick={onClose}
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground/50 hover:text-k-text-primary hover:bg-glass-bg rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                    </div>
                    {/* Body com scroll interno */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
