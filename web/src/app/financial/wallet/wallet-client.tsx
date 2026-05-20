'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
    Wallet, CircleDollarSign, Send, Plus, ArrowDownToLine, KeyRound,
    Check, Loader2, AlertTriangle, RefreshCw, ChevronRight, Copy,
    FileText, ExternalLink, FileCheck2, FileX2, Link2, Sparkles,
    AlertCircle,
} from 'lucide-react'
import type { KinevoWalletSummary, PixKeyType, AsaasDocumentGroup } from '@/lib/asaas'

interface PixKeyRow {
    id: string
    alias: string
    pix_key: string
    key_type: PixKeyType
    owner_name: string | null
    bank_name: string | null
    is_default: boolean
}

interface StudentLite {
    id: string
    name: string
    email: string | null
}

interface Props {
    summary: KinevoWalletSummary
    balance: number | null
    balanceError: string | null
    pendingDocuments: AsaasDocumentGroup[]
    documentsError: string | null
    pixKeys: PixKeyRow[]
    students: StudentLite[]
    prefill: { name: string; email: string }
    trainer: {
        name: string
        email: string
        avatarUrl: string | null
        theme: 'light' | 'dark' | 'system' | null
    }
}

type View =
    | { kind: 'overview' }
    | { kind: 'choose_mode' }
    | { kind: 'wizard'; step: 1 | 2 | 3 }
    | { kind: 'link' }
    | { kind: 'payout' }
    | { kind: 'charge' }
    | { kind: 'pix_keys' }

export function WalletClient({ summary, balance, balanceError, pendingDocuments, documentsError, pixKeys, students, prefill, trainer }: Props) {
    const router = useRouter()
    const [view, setView] = useState<View>({ kind: 'overview' })

    // ─── Activation wizard state ────────────────────────────────────────────
    const [wiz, setWiz] = useState({
        name: prefill.name,
        email: prefill.email,
        cpfCnpj: '',
        birthDate: '',
        mobilePhone: '',
        postalCode: '',
        address: '',
        addressNumber: '',
        province: '',
        incomeValue: '',
        companyType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'MEI' | 'LIMITED' | 'ASSOCIATION',
    })
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function reload() {
        router.refresh()
    }

    async function submitActivation() {
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/wallet/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...wiz,
                    incomeValue: wiz.incomeValue ? Number(wiz.incomeValue) : undefined,
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha na ativação (${res.status})`)
            }
            setView({ kind: 'overview' })
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
        } finally {
            setBusy(false)
        }
    }

    async function submitLink(apiKey: string, walletId: string) {
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/wallet/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, walletId }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha ao vincular (${res.status})`)
            }
            setView({ kind: 'overview' })
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
            throw err
        } finally {
            setBusy(false)
        }
    }

    async function syncStatus() {
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/wallet/sync', { method: 'POST' })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(body.error || `Falha (${res.status})`)
                return
            }
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao sincronizar')
        } finally {
            setBusy(false)
        }
    }

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatarUrl}
            trainerTheme={trainer.theme}
        >
            <div className="container mx-auto max-w-5xl px-4 py-6 md:py-10">
                {/* Voltar pro Financeiro */}
                <a
                    href="/financial"
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
                    Voltar pro Financeiro
                </a>
                <header className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                            <Wallet className="size-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900 leading-tight">
                                Carteira Kinevo
                            </h1>
                            <p className="text-sm text-slate-500">
                                Receba alunos via PIX e Cartão sem sair do app
                            </p>
                        </div>
                    </div>
                </header>

                {view.kind === 'overview' && (
                    <>
                        <OverviewCard
                            summary={summary}
                            balance={balance}
                            balanceError={balanceError}
                            pixKeysCount={pixKeys.length}
                            onActivate={() => setView({ kind: 'choose_mode' })}
                            onSync={syncStatus}
                            syncError={error}
                            onOpenPayout={() => setView({ kind: 'payout' })}
                            onOpenCharge={() => setView({ kind: 'charge' })}
                            onOpenPixKeys={() => setView({ kind: 'pix_keys' })}
                            busy={busy}
                        />
                        {(summary.status === 'pending' || summary.status === 'awaiting' || summary.status === 'rejected') && (
                            <div className="mt-4">
                                <DocumentsPanel
                                    documents={pendingDocuments}
                                    error={documentsError}
                                />
                            </div>
                        )}
                    </>
                )}

                {view.kind === 'choose_mode' && (
                    <ChooseModeScreen
                        onChooseNew={() => setView({ kind: 'wizard', step: 1 })}
                        onChooseLink={() => setView({ kind: 'link' })}
                        onBack={() => setView({ kind: 'overview' })}
                    />
                )}

                {view.kind === 'link' && (
                    <LinkExistingScreen
                        onSubmit={submitLink}
                        onBack={() => setView({ kind: 'choose_mode' })}
                        busy={busy}
                        error={error}
                    />
                )}

                {view.kind === 'wizard' && (
                    <ActivationWizard
                        step={view.step}
                        state={wiz}
                        setState={setWiz}
                        onNext={(next) => setView({ kind: 'wizard', step: next })}
                        onBack={() => {
                            if (view.step === 1) setView({ kind: 'choose_mode' })
                            else setView({ kind: 'wizard', step: (view.step - 1) as 1 | 2 })
                        }}
                        onSubmit={submitActivation}
                        busy={busy}
                        error={error}
                    />
                )}

                {view.kind === 'payout' && (
                    <PayoutModal
                        balance={balance ?? 0}
                        pixKeys={pixKeys}
                        onClose={() => setView({ kind: 'overview' })}
                        onSuccess={() => { setView({ kind: 'overview' }); reload() }}
                    />
                )}

                {view.kind === 'charge' && (
                    <ChargeModal
                        students={students}
                        onClose={() => setView({ kind: 'overview' })}
                    />
                )}

                {view.kind === 'pix_keys' && (
                    <PixKeysPanel
                        pixKeys={pixKeys}
                        onClose={() => setView({ kind: 'overview' })}
                        onChange={reload}
                    />
                )}
            </div>
        </AppLayout>
    )
}

// ============================================================================
// Choose mode (Step 0): criar nova vs vincular existente
// ============================================================================

function ChooseModeScreen(props: {
    onChooseNew: () => void
    onChooseLink: () => void
    onBack: () => void
}) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Como você quer ativar?</h2>
            <p className="text-sm text-slate-600 mb-1">
                Escolha o caminho que faz mais sentido pra você.
            </p>
            <p className="text-xs text-slate-500 mb-6">
                A Kinevo tem parceria com a <b>Asaas</b> — uma empresa brasileira regulada pelo Banco Central
                que processa os pagamentos por baixo dos panos (PIX, cartão e saques). Você não precisa
                instalar nada da Asaas, mas ela aparece como nome do recebedor pros seus alunos.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={props.onChooseNew}
                    className="text-left rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 hover:border-primary hover:bg-primary/10 transition-all"
                >
                    <div className="flex items-start gap-3 mb-3">
                        <div className="rounded-xl bg-primary/15 p-2.5 shrink-0">
                            <Sparkles className="size-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Ainda não tenho conta Asaas</p>
                            <p className="text-xs text-primary mt-0.5 font-medium">Recomendado</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 mb-3">
                        A Kinevo cria e configura sua conta do zero, em parceria com a Asaas.
                        Você só preenche seus dados aqui — a gente cuida de tudo.
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1.5">
                        <li className="flex gap-1.5"><Check className="size-3.5 text-emerald-600 shrink-0 mt-0.5" /> Cadastro guiado em 3 passos, dentro do Kinevo</li>
                        <li className="flex gap-1.5"><Check className="size-3.5 text-emerald-600 shrink-0 mt-0.5" /> Envio de documentos pelo próprio app</li>
                        <li className="flex gap-1.5"><Check className="size-3.5 text-emerald-600 shrink-0 mt-0.5" /> Suporte da Kinevo se algo der errado</li>
                    </ul>
                </button>

                <button
                    onClick={props.onChooseLink}
                    className="text-left rounded-2xl border-2 border-slate-200 bg-white p-5 hover:border-slate-400 transition-all"
                >
                    <div className="flex items-start gap-3 mb-3">
                        <div className="rounded-xl bg-slate-100 p-2.5 shrink-0">
                            <Link2 className="size-5 text-slate-700" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Já tenho conta na Asaas</p>
                            <p className="text-xs text-slate-500 mt-0.5">Conectar conta existente</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 mb-3">
                        Você já usa a Asaas pra receber pagamentos? Conecte a conta que você já
                        tem ao Kinevo. A gente te mostra passo a passo onde achar as informações.
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1.5">
                        <li className="flex gap-1.5"><Check className="size-3.5 text-emerald-600 shrink-0 mt-0.5" /> Pula o cadastro — sua conta já está aprovada</li>
                        <li className="flex gap-1.5"><Check className="size-3.5 text-emerald-600 shrink-0 mt-0.5" /> Mantém o histórico de cobranças que você já tem</li>
                        <li className="flex gap-1.5"><AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" /> Precisa ter login no painel da Asaas</li>
                    </ul>
                </button>
            </div>

            <div className="mt-6 flex justify-start">
                <Button variant="ghost" onClick={props.onBack}>Voltar</Button>
            </div>
        </section>
    )
}

// ============================================================================
// Link existing account screen
// ============================================================================

function LinkExistingScreen(props: {
    onSubmit: (apiKey: string, walletId: string) => Promise<void>
    onBack: () => void
    busy: boolean
    error: string | null
}) {
    const [apiKey, setApiKey] = useState('')
    const [walletId, setWalletId] = useState('')

    const trimmedKey = apiKey.trim()
    const isSandboxKey = trimmedKey.startsWith('$aact_hmlg_') || trimmedKey.startsWith('$aact_sandbox_')
    const canSubmit = trimmedKey.startsWith('$aact_') && !isSandboxKey && walletId.trim().length >= 16 && !props.busy

    async function handleSubmit() {
        try {
            await props.onSubmit(trimmedKey, walletId.trim())
        } catch {
            // erro já é mostrado via props.error
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
            <div className="flex items-center gap-3 mb-1">
                <div className="rounded-lg bg-slate-100 p-2">
                    <Link2 className="size-4 text-slate-700" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Conectar sua conta Asaas</h2>
            </div>
            <p className="text-sm text-slate-600 mb-2">
                Vamos te guiar passo a passo. Você vai pegar duas informações no seu painel da
                Asaas e colar aqui. Leva 3-4 minutos.
            </p>
            <p className="text-xs text-slate-500 mb-6">
                🔒 Tudo fica guardado com criptografia. Essas informações servem só pra que a Kinevo
                consiga criar cobranças em nome da sua conta Asaas. Você pode revogar a qualquer
                momento no painel da Asaas.
            </p>

            {/* ─── Passo 1: Chave de API ─────────────────────────────────────── */}
            <div className="mb-6 rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-white text-xs font-bold">1</span>
                    <p className="font-semibold text-slate-900 text-sm">Gerar a Chave de API</p>
                </div>
                <div className="p-4 space-y-3">
                    <ol className="text-sm text-slate-700 space-y-2.5 list-decimal list-inside marker:text-slate-400 marker:font-medium">
                        <li>
                            Em outra aba, faça login na Asaas:{' '}
                            <a
                                href="https://www.asaas.com/login"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                            >
                                www.asaas.com/login
                                <ExternalLink className="size-3" />
                            </a>
                        </li>
                        <li>
                            No <b>canto superior direito</b> da tela da Asaas, clique no{' '}
                            <b>ícone de aplicativos</b> — parece um quadradinho com 4 quadrados
                            pequenos, fica ao lado do sino de notificações.
                        </li>
                        <li>
                            No painel que abrir, clique em <b>&ldquo;Integrações&rdquo;</b>.
                        </li>
                        <li>
                            Você vai ver várias abas no topo (Início, Chaves de API, Segurança…).
                            Clique na aba <b>&ldquo;Chaves de API&rdquo;</b>.
                        </li>
                        <li>
                            Clique no botão azul <b>&ldquo;Gerar chave de API&rdquo;</b>
                            (canto superior direito).
                        </li>
                        <li>
                            No formulário:
                            <ul className="mt-1.5 ml-5 space-y-1 list-disc list-outside marker:text-slate-400">
                                <li>
                                    Em <b>&ldquo;Nome da chave&rdquo;</b>, digite{' '}
                                    <code className="bg-slate-100 px-1 rounded text-xs">Kinevo</code>
                                </li>
                                <li>Deixe Data e Hora de expiração em branco</li>
                                <li className="text-amber-900">
                                    ✅ <b>Marque a opção &ldquo;Permitir que esta chave execute
                                    operações de saque via API&rdquo;</b> — sem isso, você não
                                    consegue sacar pelo Kinevo
                                </li>
                            </ul>
                        </li>
                        <li>
                            Clique em <b>&ldquo;Avançar&rdquo;</b> e confirme com sua senha. A
                            chave vai aparecer <b>uma única vez</b> — copie ela inteira (começa
                            com <code className="bg-slate-100 px-1 rounded text-xs">$aact_prod_</code>).
                        </li>
                    </ol>
                    <Field label="Cole a chave aqui">
                        <input
                            type="password"
                            className={inputCls}
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="$aact_prod_000MzkwOTcyMzg4..."
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </Field>
                    {isSandboxKey && (
                        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
                            <p className="font-semibold mb-1">Essa chave é de sandbox/homologação</p>
                            <p>
                                Você está logado em <code className="bg-red-100 px-1 rounded">sandbox.asaas.com</code>{' '}
                                (ambiente de testes). Pra usar com o Kinevo, gere uma chave em{' '}
                                <code className="bg-red-100 px-1 rounded">www.asaas.com</code> (produção).
                                A chave de produção começa com <code className="bg-red-100 px-1 rounded">$aact_prod_</code>.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Passo 2: Wallet ID ────────────────────────────────────────── */}
            <div className="mb-6 rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-white text-xs font-bold">2</span>
                    <p className="font-semibold text-slate-900 text-sm">Copiar o Wallet ID (ID da carteira)</p>
                </div>
                <div className="p-4 space-y-3">
                    <ol className="text-sm text-slate-700 space-y-2.5 list-decimal list-inside marker:text-slate-400 marker:font-medium">
                        <li>
                            Ainda no painel da Asaas, clique no{' '}
                            <b>ícone do seu perfil</b> no canto superior direito (último ícone da
                            barra de cima, parece uma pessoinha).
                        </li>
                        <li>
                            No menu que abrir, clique em <b>&ldquo;Minha Conta&rdquo;</b>.
                        </li>
                        <li>
                            Procure pela aba ou seção <b>&ldquo;Integrações&rdquo;</b> ou{' '}
                            <b>&ldquo;Dados da conta&rdquo;</b>. O Wallet ID aparece como um
                            código em formato{' '}
                            <code className="bg-slate-100 px-1 rounded text-xs">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>.
                        </li>
                        <li>Clique no botão de copiar ao lado do código e cole aqui embaixo.</li>
                    </ol>
                    <Field label="Cole o Wallet ID aqui">
                        <input
                            className={inputCls}
                            value={walletId}
                            onChange={e => setWalletId(e.target.value)}
                            placeholder="12345678-aaaa-bbbb-cccc-1234567890ab"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </Field>
                </div>
            </div>

            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                <p className="mb-1.5">
                    <b>Não encontrou o Wallet ID?</b> A Asaas reorganiza o painel de tempos em
                    tempos. Tente isso:
                </p>
                <ul className="ml-4 list-disc list-outside space-y-1">
                    <li>
                        Abra o chat de suporte da Asaas (botão <b>&ldquo;Posso ajudar?&rdquo;</b>{' '}
                        no canto inferior direito da tela deles) e pergunte: <i>&ldquo;onde encontro
                        o Wallet ID da minha conta?&rdquo;</i>
                    </li>
                    <li>Ou nos chame no suporte da Kinevo que ajudamos você a achar.</li>
                </ul>
            </div>

            {props.error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {props.error}
                </div>
            )}

            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={props.onBack} disabled={props.busy}>Voltar</Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                    {props.busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Conectar conta
                </Button>
            </div>
        </section>
    )
}

// ============================================================================
// Overview card (visible always; content varies by status)
// ============================================================================

function OverviewCard(props: {
    summary: KinevoWalletSummary
    balance: number | null
    balanceError: string | null
    pixKeysCount: number
    onActivate: () => void
    onSync: () => void
    syncError?: string | null
    onOpenPayout: () => void
    onOpenCharge: () => void
    onOpenPixKeys: () => void
    busy: boolean
}) {
    const { summary, balance, balanceError, pixKeysCount } = props

    if (summary.status === 'not_started') {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="text-center max-w-md mx-auto">
                    <div className="mx-auto mb-4 size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <CircleDollarSign className="size-7 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                        Ative sua Carteira Kinevo
                    </h2>
                    <p className="text-sm text-slate-600 mb-6">
                        Receba pagamentos dos seus alunos via <b>PIX</b> e <b>Cartão</b> direto no app.
                        Saque para sua conta bancária quando quiser, sem taxa.
                    </p>
                    <ul className="text-left text-sm text-slate-600 mb-6 space-y-2">
                        <li className="flex gap-2"><Check className="size-4 text-emerald-600 shrink-0 mt-0.5" /> Sem mensalidade extra</li>
                        <li className="flex gap-2"><Check className="size-4 text-emerald-600 shrink-0 mt-0.5" /> Liberação em até 3 dias úteis</li>
                        <li className="flex gap-2"><Check className="size-4 text-emerald-600 shrink-0 mt-0.5" /> Saque via PIX sem taxa, na hora</li>
                        <li className="flex gap-2"><Check className="size-4 text-emerald-600 shrink-0 mt-0.5" /> Kinevo não cobra taxa em cima do que você recebe</li>
                    </ul>
                    <Button size="lg" onClick={props.onActivate} className="w-full sm:w-auto">
                        Começar ativação
                    </Button>
                </div>
            </section>
        )
    }

    if (summary.status === 'pending' || summary.status === 'awaiting') {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-8">
                <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-amber-100 p-2.5 shrink-0">
                        <Loader2 className="size-5 text-amber-700 animate-spin" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-amber-900 mb-1">
                            Sua Carteira está em análise
                        </h2>
                        <p className="text-sm text-amber-800 mb-4">
                            Estamos validando seus dados. Geralmente leva de algumas horas a
                            3 dias úteis. Te avisamos por push assim que liberada.
                        </p>
                        <Button variant="outline" size="sm" onClick={props.onSync} disabled={props.busy}>
                            <RefreshCw className={`size-4 mr-2 ${props.busy ? 'animate-spin' : ''}`} />
                            Atualizar status
                        </Button>
                        {props.syncError && (
                            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                                {props.syncError}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        )
    }

    if (summary.status === 'rejected' || summary.status === 'blocked') {
        return (
            <section className="rounded-2xl border border-red-200 bg-red-50/40 p-8">
                <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-red-100 p-2.5 shrink-0">
                        <AlertTriangle className="size-5 text-red-700" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-red-900 mb-1">
                            Sua Carteira foi {summary.status === 'rejected' ? 'reprovada' : 'bloqueada'}
                        </h2>
                        {summary.rejectionReason && (
                            <p className="text-sm text-red-800 mb-4">
                                <b>Motivo:</b> {summary.rejectionReason}
                            </p>
                        )}
                        <p className="text-sm text-red-800 mb-4">
                            Entre em contato com o suporte da Kinevo pra revisar.
                        </p>
                        <Button variant="outline" size="sm" onClick={props.onSync} disabled={props.busy}>
                            <RefreshCw className={`size-4 mr-2 ${props.busy ? 'animate-spin' : ''}`} />
                            Tentar atualizar
                        </Button>
                    </div>
                </div>
            </section>
        )
    }

    // status === 'approved' → painel principal
    const balanceText =
        balance !== null
            ? balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : balanceError
                ? '—'
                : '...'

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-primary/5 to-primary/10 p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm text-slate-600">Saldo disponível</p>
                            {summary.mode === 'linked' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-medium px-2 py-0.5">
                                    <Link2 className="size-2.5" /> Conta vinculada
                                </span>
                            )}
                        </div>
                        <p className="text-4xl font-semibold text-slate-900 tabular-nums">
                            {balanceText}
                        </p>
                        {balanceError && (
                            <p className="text-xs text-red-600 mt-2">{balanceError}</p>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            size="lg"
                            onClick={props.onOpenCharge}
                            className="min-w-[170px]"
                        >
                            <Send className="size-4 mr-2" />
                            Cobrar aluno
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={props.onOpenPayout}
                            disabled={!balance || balance <= 0}
                            className="min-w-[170px]"
                        >
                            <ArrowDownToLine className="size-4 mr-2" />
                            Sacar via PIX
                        </Button>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <button
                    onClick={props.onOpenPixKeys}
                    className="w-full flex items-center justify-between text-left hover:bg-slate-50 -m-2 p-2 rounded-lg transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-100 p-2">
                            <KeyRound className="size-4 text-slate-600" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-900">Chaves PIX para saque</p>
                            <p className="text-sm text-slate-500">
                                {pixKeysCount === 0
                                    ? 'Adicione uma chave pra poder sacar'
                                    : `${pixKeysCount} chave${pixKeysCount === 1 ? '' : 's'} cadastrada${pixKeysCount === 1 ? '' : 's'}`}
                            </p>
                        </div>
                    </div>
                    <ChevronRight className="size-4 text-slate-400" />
                </button>
            </section>
        </div>
    )
}

// ============================================================================
// Activation Wizard (3 steps)
// ============================================================================

interface WizState {
    name: string; email: string; cpfCnpj: string; birthDate: string
    mobilePhone: string; postalCode: string; address: string; addressNumber: string
    province: string; incomeValue: string
    companyType: 'INDIVIDUAL' | 'MEI' | 'LIMITED' | 'ASSOCIATION'
}

function ActivationWizard(props: {
    step: 1 | 2 | 3
    state: WizState
    setState: (updater: (s: WizState) => WizState) => void
    onNext: (next: 1 | 2 | 3) => void
    onBack: () => void
    onSubmit: () => void
    busy: boolean
    error: string | null
}) {
    const { step, state, setState } = props

    function set<K extends keyof WizState>(key: K, value: WizState[K]) {
        setState(s => ({ ...s, [key]: value }))
    }

    async function lookupCep() {
        const cep = state.postalCode.replace(/\D/g, '')
        if (cep.length !== 8) return
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
            if (!res.ok) return
            const data = await res.json() as { logradouro?: string; bairro?: string; erro?: boolean }
            if (data.erro) return
            setState(s => ({
                ...s,
                address: data.logradouro || s.address,
                province: data.bairro || s.province,
            }))
        } catch { /* silent */ }
    }

    const canStep1 = state.name.trim() && state.email.includes('@') && state.cpfCnpj.replace(/\D/g, '').length >= 11 && state.birthDate && state.mobilePhone.replace(/\D/g, '').length >= 10
    const canStep2 = state.postalCode.replace(/\D/g, '').length === 8 && state.address.trim() && state.addressNumber.trim() && state.province.trim()
    const canStep3 = Number(state.incomeValue) > 0

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
            <ProgressDots current={step} total={3} />

            {step === 1 && (
                <>
                    <h2 className="text-lg font-semibold text-slate-900 mb-1 mt-4">Seus dados</h2>
                    <p className="text-sm text-slate-500 mb-6">
                        Validamos esses dados pra liberar sua Carteira.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Nome completo">
                            <input className={inputCls} value={state.name} onChange={e => set('name', e.target.value)} />
                        </Field>
                        <Field label="Email">
                            <input type="email" className={inputCls} value={state.email} onChange={e => set('email', e.target.value)} />
                        </Field>
                        <Field label="CPF ou CNPJ">
                            <input className={inputCls} value={state.cpfCnpj} onChange={e => set('cpfCnpj', e.target.value)} placeholder="apenas números" />
                        </Field>
                        <Field label="Data de nascimento">
                            <input type="date" className={inputCls} value={state.birthDate} onChange={e => set('birthDate', e.target.value)} />
                        </Field>
                        <Field label="Celular (com DDD)">
                            <input className={inputCls} value={state.mobilePhone} onChange={e => set('mobilePhone', e.target.value)} placeholder="11987654321" />
                        </Field>
                        <Field label="Tipo">
                            <select className={inputCls} value={state.companyType} onChange={e => set('companyType', e.target.value as WizState['companyType'])}>
                                <option value="INDIVIDUAL">Pessoa física</option>
                                <option value="MEI">MEI</option>
                                <option value="LIMITED">Empresa LTDA</option>
                                <option value="ASSOCIATION">Associação</option>
                            </select>
                        </Field>
                    </div>
                </>
            )}

            {step === 2 && (
                <>
                    <h2 className="text-lg font-semibold text-slate-900 mb-1 mt-4">Endereço</h2>
                    <p className="text-sm text-slate-500 mb-6">
                        Precisamos pra completar o cadastro da sua Carteira.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="CEP">
                            <input
                                className={inputCls}
                                value={state.postalCode}
                                onChange={e => set('postalCode', e.target.value)}
                                onBlur={lookupCep}
                                placeholder="01001000"
                                inputMode="numeric"
                            />
                        </Field>
                        <Field label="Bairro">
                            <input className={inputCls} value={state.province} onChange={e => set('province', e.target.value)} />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Rua">
                                <input className={inputCls} value={state.address} onChange={e => set('address', e.target.value)} />
                            </Field>
                        </div>
                        <Field label="Número">
                            <input className={inputCls} value={state.addressNumber} onChange={e => set('addressNumber', e.target.value)} />
                        </Field>
                    </div>
                </>
            )}

            {step === 3 && (
                <>
                    <h2 className="text-lg font-semibold text-slate-900 mb-1 mt-4">Faturamento estimado</h2>
                    <p className="text-sm text-slate-500 mb-6">
                        Ajuda a dimensionar os limites iniciais da sua Carteira. Pode ajustar depois.
                    </p>
                    <Field label="Quanto você espera receber por mês (R$)">
                        <input
                            type="number"
                            min="0"
                            step="500"
                            className={inputCls}
                            value={state.incomeValue}
                            onChange={e => set('incomeValue', e.target.value)}
                            placeholder="5000"
                        />
                    </Field>
                    <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                        <p className="font-medium mb-1">Antes de confirmar:</p>
                        <ul className="space-y-1 list-disc list-inside text-amber-800">
                            <li>Confira que o CPF/CNPJ está correto — é o nome que vai aparecer no recibo do aluno.</li>
                            <li>Durante os primeiros dias, podemos pedir documentos extras pra liberação completa.</li>
                        </ul>
                    </div>
                </>
            )}

            {props.error && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {props.error}
                </div>
            )}

            <div className="flex justify-between mt-8">
                <Button variant="ghost" onClick={props.onBack} disabled={props.busy}>
                    Voltar
                </Button>
                {step < 3 ? (
                    <Button
                        onClick={() => props.onNext((step + 1) as 2 | 3)}
                        disabled={step === 1 ? !canStep1 : !canStep2}
                    >
                        Continuar
                    </Button>
                ) : (
                    <Button onClick={props.onSubmit} disabled={!canStep3 || props.busy}>
                        {props.busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                        Confirmar e ativar
                    </Button>
                )}
            </div>
        </section>
    )
}

// ============================================================================
// Payout modal
// ============================================================================

function PayoutModal(props: {
    balance: number
    pixKeys: PixKeyRow[]
    onClose: () => void
    onSuccess: () => void
}) {
    const [pixKeyId, setPixKeyId] = useState(props.pixKeys.find(k => k.is_default)?.id ?? props.pixKeys[0]?.id ?? '')
    const [valueStr, setValueStr] = useState(props.balance.toFixed(2))
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    const value = Number(valueStr.replace(',', '.'))
    const canSubmit = pixKeyId && value > 0 && value <= props.balance && !busy

    if (props.pixKeys.length === 0) {
        return (
            <ModalShell title="Sacar via PIX" onClose={props.onClose}>
                <div className="text-center py-6">
                    <KeyRound className="size-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 mb-4">
                        Você precisa cadastrar uma chave PIX antes de sacar.
                    </p>
                    <Button onClick={props.onClose}>Entendi</Button>
                </div>
            </ModalShell>
        )
    }

    const [payoutResult, setPayoutResult] = useState<{ status: string; payoutId: string } | null>(null)

    async function submit() {
        setBusy(true); setError(null)
        try {
            const res = await fetch('/api/wallet/payouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pixKeyId, value }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha (${res.status})`)
            }
            const body = await res.json() as { id: string; status: string }
            setPayoutResult({ status: body.status, payoutId: body.id })
            setDone(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
        } finally {
            setBusy(false)
        }
    }

    if (done) {
        const isAwaitingMfa = payoutResult?.status === 'awaiting_authorization'
        return (
            <ModalShell title={isAwaitingMfa ? 'Saque aguardando confirmação' : 'Saque solicitado'} onClose={() => { props.onClose(); props.onSuccess() }}>
                {isAwaitingMfa ? (
                    // Asaas pediu MFA — trainer precisa abrir o painel e confirmar
                    // por SMS. Sem isso, dinheiro nunca cai. Banner laranja explica
                    // exatamente o que tem que fazer.
                    <div className="py-2">
                        <div className="size-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                            <AlertCircle className="size-7 text-amber-700" />
                        </div>
                        <p className="text-center text-slate-900 font-medium mb-1">Falta uma confirmação</p>
                        <p className="text-center text-sm text-slate-600 mb-4">
                            Por segurança, a Asaas mandou um código por SMS pro seu celular cadastrado.
                            Confirme no painel pra liberar o PIX.
                        </p>
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 mb-4">
                            <p className="font-medium mb-1">Como confirmar:</p>
                            <ol className="list-decimal pl-4 space-y-0.5">
                                <li>Abra o painel da Asaas (botão abaixo)</li>
                                <li>No banner amarelo no topo, clique <b>&ldquo;Enviar código&rdquo;</b></li>
                                <li>Receba o SMS no celular cadastrado na Asaas</li>
                                <li>Digite o código e clique <b>Autorizar</b></li>
                                <li>Volta aqui e clica em <b>Já confirmei</b></li>
                            </ol>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={() => window.open('https://www.asaas.com/home', '_blank')}
                                className="w-full"
                            >
                                Abrir painel da Asaas
                            </Button>
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        const r = await fetch(`/api/wallet/payouts/${payoutResult.payoutId}/sync`, { method: 'POST' })
                                        const b = await r.json()
                                        if (b.statusLocal === 'completed') {
                                            alert('Pagamento confirmado! Atualizando...')
                                        } else if (b.statusLocal === 'awaiting_authorization') {
                                            alert('Ainda aguardando autorização. Confirme no painel da Asaas e tente de novo.')
                                        } else {
                                            alert(`Status atual: ${b.statusLocal}`)
                                        }
                                        props.onSuccess()
                                    } catch {
                                        alert('Erro ao sincronizar')
                                    }
                                }}
                                className="w-full"
                            >
                                Já confirmei na Asaas
                            </Button>
                            <Button variant="ghost" onClick={() => { props.onClose(); props.onSuccess() }} className="w-full">
                                Fechar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <div className="size-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                            <Check className="size-7 text-emerald-700" />
                        </div>
                        <p className="text-slate-700 mb-1">Pedido enviado pra sua conta</p>
                        <p className="text-sm text-slate-500 mb-6">
                            O dinheiro entra em segundos. Vamos te avisar quando confirmar.
                        </p>
                        <Button onClick={() => { props.onClose(); props.onSuccess() }}>Fechar</Button>
                    </div>
                )}
            </ModalShell>
        )
    }

    return (
        <ModalShell title="Sacar via PIX" onClose={props.onClose}>
            <Field label="Chave PIX">
                <select className={inputCls} value={pixKeyId} onChange={e => setPixKeyId(e.target.value)}>
                    {props.pixKeys.map(k => (
                        <option key={k.id} value={k.id}>
                            {k.alias} — {k.pix_key} {k.is_default ? '★' : ''}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label={`Valor (saldo disponível: ${props.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`}>
                <input
                    className={inputCls}
                    inputMode="decimal"
                    value={valueStr}
                    onChange={e => setValueStr(e.target.value)}
                    placeholder="0,00"
                />
            </Field>
            {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={props.onClose} disabled={busy}>Cancelar</Button>
                <Button onClick={submit} disabled={!canSubmit}>
                    {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Confirmar saque
                </Button>
            </div>
        </ModalShell>
    )
}

// ============================================================================
// Charge modal (cria cobrança pra um aluno → mostra invoiceUrl)
// ============================================================================

function ChargeModal(props: { students: StudentLite[]; onClose: () => void }) {
    const [studentId, setStudentId] = useState(props.students[0]?.id ?? '')
    const [valueStr, setValueStr] = useState('250,00')
    const [description, setDescription] = useState('Mensalidade')
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 3)
        return d.toISOString().slice(0, 10)
    })
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<{ invoiceUrl: string; paymentId: string } | null>(null)

    const value = Number(valueStr.replace(',', '.'))
    const canSubmit = studentId && value >= 5 && dueDate && !busy

    async function submit() {
        setBusy(true); setError(null)
        try {
            const res = await fetch('/api/wallet/charges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId,
                    value,
                    dueDate,
                    description,
                    billingType: 'UNDEFINED',
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha (${res.status})`)
            }
            const body = await res.json() as { invoiceUrl: string; paymentId: string }
            setResult(body)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
        } finally {
            setBusy(false)
        }
    }

    if (result) {
        return (
            <ModalShell title="Cobrança criada" onClose={props.onClose}>
                <div className="text-center py-2">
                    <div className="size-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                        <Check className="size-7 text-emerald-700" />
                    </div>
                    <p className="text-slate-700 mb-4">Compartilhe esse link com seu aluno:</p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 break-all mb-3 text-left">
                        {result.invoiceUrl}
                    </div>
                    <div className="flex gap-2 justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(result.invoiceUrl)}
                        >
                            <Copy className="size-4 mr-2" /> Copiar link
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                const url = `https://wa.me/?text=${encodeURIComponent('Sua cobrança: ' + result.invoiceUrl)}`
                                window.open(url, '_blank')
                            }}
                        >
                            Enviar no WhatsApp
                        </Button>
                    </div>
                    <Button variant="ghost" className="mt-4" onClick={props.onClose}>Fechar</Button>
                </div>
            </ModalShell>
        )
    }

    if (props.students.length === 0) {
        return (
            <ModalShell title="Cobrar aluno" onClose={props.onClose}>
                <p className="text-slate-600 text-center py-4">
                    Você ainda não tem alunos ativos. Cadastre alunos pra poder gerar cobranças.
                </p>
                <div className="flex justify-end">
                    <Button onClick={props.onClose}>Fechar</Button>
                </div>
            </ModalShell>
        )
    }

    return (
        <ModalShell title="Cobrar aluno" onClose={props.onClose}>
            <Field label="Aluno">
                <select className={inputCls} value={studentId} onChange={e => setStudentId(e.target.value)}>
                    {props.students.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </Field>
            <Field label="Valor (mínimo R$ 5,00)">
                <input className={inputCls} inputMode="decimal" value={valueStr} onChange={e => setValueStr(e.target.value)} placeholder="250,00" />
            </Field>
            <Field label="Descrição">
                <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} />
            </Field>
            <Field label="Vencimento">
                <input type="date" className={inputCls} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Field>
            {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={props.onClose} disabled={busy}>Cancelar</Button>
                <Button onClick={submit} disabled={!canSubmit}>
                    {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Gerar link
                </Button>
            </div>
        </ModalShell>
    )
}

// ============================================================================
// PIX keys panel
// ============================================================================

function PixKeysPanel(props: { pixKeys: PixKeyRow[]; onClose: () => void; onChange: () => void }) {
    const [adding, setAdding] = useState(false)
    const [alias, setAlias] = useState('')
    const [pixKey, setPixKey] = useState('')
    const [keyType, setKeyType] = useState<PixKeyType>('EMAIL')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTx] = useTransition()

    async function add() {
        setBusy(true); setError(null)
        try {
            const res = await fetch('/api/wallet/pix-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alias, pixKey, keyType, isDefault: props.pixKeys.length === 0 }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha (${res.status})`)
            }
            setAlias(''); setPixKey(''); setAdding(false)
            props.onChange()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
        } finally {
            setBusy(false)
        }
    }

    async function remove(id: string) {
        if (!confirm('Remover esta chave PIX?')) return
        startTx(async () => {
            await fetch(`/api/wallet/pix-keys/${id}`, { method: 'DELETE' })
            props.onChange()
        })
    }

    return (
        <ModalShell title="Chaves PIX" onClose={props.onClose}>
            <div className="space-y-2 mb-4">
                {props.pixKeys.length === 0 && (
                    <p className="text-sm text-slate-500 py-3 text-center">
                        Nenhuma chave cadastrada ainda.
                    </p>
                )}
                {props.pixKeys.map(k => (
                    <div key={k.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                        <div>
                            <p className="font-medium text-slate-900 text-sm">{k.alias} {k.is_default && <span className="text-amber-600">★</span>}</p>
                            <p className="text-xs text-slate-500">{k.pix_key} ({k.key_type})</p>
                            {k.owner_name && <p className="text-xs text-slate-400">{k.owner_name}{k.bank_name ? ` · ${k.bank_name}` : ''}</p>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => remove(k.id)} disabled={pending}>
                            Remover
                        </Button>
                    </div>
                ))}
            </div>

            {adding ? (
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                    <Field label="Apelido">
                        <input className={inputCls} value={alias} onChange={e => setAlias(e.target.value)} placeholder="Nubank PJ" />
                    </Field>
                    <Field label="Tipo">
                        <select className={inputCls} value={keyType} onChange={e => setKeyType(e.target.value as PixKeyType)}>
                            <option value="CPF">CPF</option>
                            <option value="CNPJ">CNPJ</option>
                            <option value="EMAIL">Email</option>
                            <option value="PHONE">Telefone</option>
                            <option value="EVP">Aleatória (EVP)</option>
                        </select>
                    </Field>
                    <Field label="Chave">
                        <input className={inputCls} value={pixKey} onChange={e => setPixKey(e.target.value)} />
                    </Field>
                    {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={busy}>Cancelar</Button>
                        <Button size="sm" onClick={add} disabled={busy || !alias || !pixKey}>
                            {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                            Validar e salvar
                        </Button>
                    </div>
                </div>
            ) : (
                <Button variant="outline" onClick={() => setAdding(true)} className="w-full">
                    <Plus className="size-4 mr-2" /> Adicionar chave PIX
                </Button>
            )}

            <div className="mt-6 flex justify-end">
                <Button variant="ghost" onClick={props.onClose}>Fechar</Button>
            </div>
        </ModalShell>
    )
}

// ============================================================================
// DocumentsPanel — lista de docs pendentes pra liberação da Carteira
// ============================================================================

function DocumentsPanel({ documents, error }: { documents: AsaasDocumentGroup[]; error: string | null }) {
    if (error) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-sm text-slate-600">
                    Estamos preparando seus documentos. Volte aqui em alguns instantes —
                    geralmente leva menos de 1 minuto após a criação da Carteira.
                </p>
                <p className="text-xs text-slate-400 mt-2">Detalhe: {error}</p>
            </section>
        )
    }

    if (!documents.length) {
        return null
    }

    const allApproved = documents.every(d => d.status === 'APPROVED')
    if (allApproved) {
        return (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2">
                        <FileCheck2 className="size-5 text-emerald-700" />
                    </div>
                    <div>
                        <p className="font-medium text-emerald-900">Documentos aprovados</p>
                        <p className="text-sm text-emerald-800">
                            Estamos finalizando a liberação da sua Carteira.
                        </p>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                    Envie seus documentos pra liberar a Carteira
                </h2>
                <p className="text-sm text-slate-600">
                    Esse é o último passo. Por segurança, o envio é feito numa página externa
                    com criptografia ponta-a-ponta. Vai te levar 2-3 minutos.
                </p>
            </div>
            <ul className="space-y-3">
                {documents.map(g => (
                    <DocumentRow key={g.id} group={g} />
                ))}
            </ul>
        </section>
    )
}

function DocumentRow({ group }: { group: AsaasDocumentGroup }) {
    const router = useRouter()
    const isApproved = group.status === 'APPROVED'
    const isRejected = group.status === 'REJECTED'
    const isPending = !isApproved && !isRejected
    const needsAction = isPending || isRejected

    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [justSent, setJustSent] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    async function handleFile(file: File) {
        setBusy(true)
        setError(null)
        try {
            const form = new FormData()
            form.append('file', file)
            form.append('type', group.type)
            const res = await fetch(`/api/wallet/documents/${group.id}`, {
                method: 'POST',
                body: form,
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || `Falha no envio (${res.status})`)
            }
            setJustSent(true)
            // Recarrega o page.tsx pra puxar status atualizado dos docs
            setTimeout(() => router.refresh(), 600)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao enviar')
        } finally {
            setBusy(false)
        }
    }

    function onPick() {
        fileInputRef.current?.click()
    }

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        if (f) void handleFile(f)
        e.target.value = '' // permite reenviar mesmo arquivo
    }

    return (
        <li className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                    <div className={`rounded-lg p-2 shrink-0 ${isApproved ? 'bg-emerald-100' : isRejected ? 'bg-red-100' : 'bg-slate-100'}`}>
                        {isApproved
                            ? <FileCheck2 className="size-5 text-emerald-700" />
                            : isRejected
                                ? <FileX2 className="size-5 text-red-700" />
                                : <FileText className="size-5 text-slate-600" />}
                    </div>
                    <div className="flex-1">
                        <p className="font-medium text-slate-900 text-sm">{group.title || group.type}</p>
                        {group.description && !group.onboardingUrl && !needsAction && (
                            <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
                        )}
                        {!group.onboardingUrl && needsAction && !justSent && (
                            <p className="text-xs text-slate-500 mt-0.5">
                                Envie uma foto nítida ou PDF (até 10 MB).
                            </p>
                        )}
                        {isApproved && <p className="text-xs text-emerald-700 mt-1">Aprovado ✓</p>}
                        {isRejected && (
                            <p className="text-xs text-red-700 mt-1">Reprovado — envie novamente</p>
                        )}
                        {justSent && (
                            <p className="text-xs text-emerald-700 mt-1">Enviado ✓ Aguardando análise…</p>
                        )}
                    </div>
                </div>

                {needsAction && !justSent && group.onboardingUrl && (
                    <Button
                        size="sm"
                        variant={isRejected ? 'outline' : 'default'}
                        onClick={() => window.open(group.onboardingUrl!, '_blank', 'noopener,noreferrer')}
                    >
                        {isRejected ? 'Reenviar' : 'Enviar'}
                        <ExternalLink className="size-3.5 ml-1.5" />
                    </Button>
                )}

                {needsAction && !justSent && !group.onboardingUrl && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,application/pdf"
                            className="hidden"
                            onChange={onFileChange}
                        />
                        <Button
                            size="sm"
                            variant={isRejected ? 'outline' : 'default'}
                            onClick={onPick}
                            disabled={busy}
                        >
                            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                            {isRejected ? 'Reenviar arquivo' : 'Enviar arquivo'}
                        </Button>
                    </>
                )}
            </div>

            {error && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
                    {error}
                </div>
            )}
        </li>
    )
}

// ============================================================================
// Shared primitives (Field, ModalShell, ProgressDots, inputCls)
// ============================================================================

const inputCls = 'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-xs font-medium text-slate-700 mb-1.5 block">{label}</span>
            {children}
        </label>
    )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
                {children}
            </div>
        </div>
    )
}

function ProgressDots({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i + 1 < current
                        ? 'w-6 bg-primary'
                        : i + 1 === current
                            ? 'w-10 bg-primary'
                            : 'w-6 bg-slate-200'
                        }`}
                />
            ))}
        </div>
    )
}
