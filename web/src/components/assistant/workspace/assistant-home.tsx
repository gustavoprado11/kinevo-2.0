'use client'

/**
 * AssistantHome — landing do modo Assistente (estilo Cowork). Hero + composer +
 * "Precisa de atenção" (insights) + "Comece por aqui" + "Conversas recentes".
 * Apresentacional; envia ações via callbacks do AssistantWorkspace.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, Loader2, ChevronDown, ChevronRight, Globe, Check, Wallet, Users, Dumbbell, MessageCircle, Coins, UserPlus, Wand2 } from 'lucide-react'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { attentionKind, KIND_TAG, attentionPrompt } from '@/lib/assistant/attention'
import { avatarFor, greeting, timeShort } from './ui-util'
import { AssistantBanner, type AssistantBannerData } from './assistant-banner'
import { MicButton } from './mic-button'
import { AssistantMark } from '@/components/assistant/assistant-mark'

/**
 * Cada atalho tem `label` (texto curto exibido no card) e `prompt` (instrução
 * expandida e bem-especificada que é inserida no composer). O prompt otimizado
 * pede formato/critérios/ordenação → respostas melhores do motor de IA por trás.
 */
const STARTERS: { label: string; icon: typeof Wallet; color: string; bg: string; prompts: { label: string; prompt: string }[] }[] = [
    {
        label: 'Financeiro', icon: Wallet, color: '#3B82F6', bg: '#EFF6FF', prompts: [
            { label: 'Mostrar os alunos inadimplentes do mês', prompt: 'Liste os alunos com pagamentos em atraso ou vencidos neste mês. Para cada um, traga nome, valor pendente, dias de atraso e data de vencimento. Ordene do mais crítico para o menos crítico e sugira uma ação de cobrança para os casos mais urgentes.' },
            { label: 'Qual o MRR atual?', prompt: 'Calcule o MRR (receita recorrente mensal) atual com base nas assinaturas ativas. Mostre o valor total, o número de alunos pagantes e o ticket médio, e comente a variação em relação ao mês anterior se houver dados.' },
            { label: 'Gerar um resumo financeiro do mês', prompt: 'Gere um resumo financeiro do mês atual: receita recebida, valores pendentes/inadimplência, MRR, novos contratos e cancelamentos. Destaque os pontos de atenção e finalize com 2 a 3 recomendações práticas.' },
        ],
    },
    {
        label: 'Alunos', icon: Users, color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 12%, transparent)', prompts: [
            { label: 'Quais alunos estão sem treino ativo?', prompt: 'Liste os alunos que não têm nenhum programa de treino ativo no momento. Para cada um, informe nome, há quanto tempo está sem treino e o status da assinatura. Priorize quem está pagando mas sem treino e sugira o próximo passo.' },
            { label: 'Resumo de adesão da semana', prompt: 'Faça um resumo da adesão aos treinos nesta semana: treinos concluídos vs. planejados, quem está em dia e quem está faltando. Destaque os alunos com baixa adesão e sugira ações de reengajamento.' },
            { label: 'Quais alunos estão em risco de cancelar?', prompt: 'Identifique os alunos com maior risco de cancelamento a partir de sinais como queda de frequência, faltas recentes, estagnação e inadimplência. Para cada um, explique o motivo do risco e sugira uma ação de retenção.' },
        ],
    },
    {
        label: 'Treinos', icon: Dumbbell, color: '#F59E0B', bg: '#FFFBEB', prompts: [
            { label: 'Gerar um programa para um aluno', prompt: 'Quero gerar um novo programa de treino. Pergunte para qual aluno e, com base no histórico, objetivo e nível dele, proponha a estrutura (divisão, frequência semanal, foco e duração) para eu aprovar antes de criar.' },
            { label: 'Quais alunos estão estagnados?', prompt: 'Identifique os alunos estagnados (sem progressão de carga ou repetições) nas últimas semanas. Para cada um, mostre em quais exercícios está o platô e sugira um ajuste de estímulo para destravar a evolução.' },
            { label: 'Criar um template na biblioteca', prompt: 'Quero criar um template de programa reutilizável na biblioteca. Me ajude a definir objetivo, divisão (ex.: ABC), frequência semanal e os exercícios principais de cada sessão, e então monte o template.' },
        ],
    },
    {
        label: 'Comunicação', icon: MessageCircle, color: '#16A34A', bg: '#ECFDF5', prompts: [
            { label: 'Enviar uma mensagem motivacional para um aluno', prompt: 'Quero enviar uma mensagem motivacional. Pergunte para qual aluno e, com base no progresso recente dele, escreva uma mensagem curta e personalizada no meu tom para eu revisar antes de enviar.' },
            { label: 'Enviar formulário de check-in', prompt: 'Quero enviar um formulário de check-in. Pergunte para qual aluno e qual modelo de formulário usar, e prepare o envio para eu confirmar.' },
            { label: 'Lembrar quem faltou ao treino', prompt: 'Liste os alunos que faltaram aos treinos planejados nos últimos dias e escreva, para cada um, uma mensagem de lembrete gentil e personalizada para eu revisar antes de enviar.' },
        ],
    },
]

interface Props {
    trainerName: string | null
    summary: AiUsageSummary
    attention: AttentionItem[]
    recents: ConversationListItem[]
    focusedStudentId: string | null
    students: { id: string; name: string; avatarUrl: string | null }[]
    hasStudents: boolean
    input: string
    sending: boolean
    banner: AssistantBannerData | null
    onDismissBanner: () => void
    onInput: (v: string) => void
    onSend: () => void
    onStarter: (prompt: string) => void
    onFocusStudent: (id: string | null) => void
    onOpenConversation: (id: string) => void
    /** Treinador ainda não configurou o estilo de prescrição → mostra o convite. */
    showStyleInvite: boolean
    onStartStyleInterview: () => void
}

export function AssistantHome({
    trainerName, summary, attention, recents, focusedStudentId, students, hasStudents, input, sending, banner,
    onDismissBanner, onInput, onSend, onStarter, onFocusStudent, onOpenConversation,
    showStyleInvite, onStartStyleInterview,
}: Props) {
    const firstName = (trainerName ?? '').split(' ')[0] || 'treinador'
    const composerRef = useRef<HTMLTextAreaElement>(null)

    // Seletor de escopo (Geral ⇄ aluno em foco): dropdown clicável.
    const [scopeOpen, setScopeOpen] = useState(false)
    const [scopeSearch, setScopeSearch] = useState('')
    const scopeRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!scopeOpen) return
        const onClick = (e: MouseEvent) => {
            if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [scopeOpen])
    const focusedStudent = focusedStudentId ? students.find((s) => s.id === focusedStudentId) ?? null : null
    const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    const filteredStudents = students.filter((s) => s.name.toLowerCase().includes(scopeSearch.trim().toLowerCase()))

    // O composer cresce com o conteúdo (até ~280px; depois rola internamente).
    // Recalcula a cada mudança de texto — inclusive ao ser preenchido por um card.
    useEffect(() => {
        const el = composerRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 280)}px`
    }, [input])

    // Clicar num card preenche o composer (não envia): o treinador revisa/ajusta e
    // dispara. Foca + traz o composer à vista, já que ele fica no topo da home.
    const fillFromCard = (prompt: string) => {
        onStarter(prompt)
        requestAnimationFrame(() => {
            const el = composerRef.current
            if (!el) return
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.focus()
            const end = prompt.length
            try { el.setSelectionRange(end, end) } catch { /* noop */ }
        })
    }

    return (
        <main className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-surface-card">
            <div className="mx-auto max-w-[720px] px-7 pb-16 pt-[72px]">
                {/* Hero — plano, sem glow (idioma da conversa) */}
                <div className="mb-7 text-center">
                    <span className="mx-auto mb-5 flex items-center justify-center">
                        <AssistantMark size={34} strokeWidth={1.2} className="text-primary" />
                    </span>
                    <div className="mb-2 text-[14px] font-medium text-k-text-tertiary dark:text-muted-foreground">{greeting()}, {firstName}.</div>
                    <h1 className="font-display text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-k-text-primary dark:text-foreground">
                        O que vamos resolver hoje?
                    </h1>
                </div>

                {/* Composer — mesma moldura/foco da conversa (flat, cinza suave) */}
                <div className="rounded-[22px] border border-k-border-subtle dark:border-k-border-subtle bg-white dark:bg-surface-elevated p-2 transition focus-within:border-[#C7C7CC] dark:focus-within:border-k-border-primary focus-within:shadow-[0_0_0_4px_rgba(60,60,67,0.07)]">
                    <textarea
                        ref={composerRef}
                        data-assistant-composer
                        value={input}
                        onChange={(e) => onInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
                        rows={2}
                        aria-label="Diga o que fazer no Kinevo"
                        placeholder="Diga o que fazer no Kinevo — ou escolha um aluno…"
                        // outline inline: vence a regra global unlayered `:focus-visible` do
                        // globals.css (Tailwind v4 layered perde p/ unlayered). O foco fica só
                        // na borda do card (focus-within), não no textarea interno.
                        style={{ outline: 'none' }}
                        className="max-h-[280px] w-full resize-none overflow-y-auto bg-transparent px-4 py-3 text-[16px] leading-relaxed text-k-text-primary dark:text-foreground placeholder:text-k-text-quaternary dark:placeholder:text-muted-foreground/60"
                    />
                    <div className="flex items-center gap-2.5 px-2 pb-1 pt-1">
                        <MicButton disabled={sending} value={input} onChange={onInput} />
                        <span className="flex-1" />
                        <button onClick={onSend} disabled={sending || !input.trim()}
                            className="flex h-10 items-center gap-2 rounded-[12px] bg-primary px-[18px] text-[14px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2} />} Agir
                        </button>
                    </div>
                </div>

                {/* Erro/cota — a aba não engole mais falhas em silêncio (B2). */}
                {banner && (
                    <div className="mt-3.5">
                        <AssistantBanner data={banner} onDismiss={onDismissBanner} />
                    </div>
                )}

                {/* Contexto */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    {!hasStudents ? (
                        <Link href="/students" className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.25)] dark:border-violet-400/30 bg-[rgba(124,58,237,0.08)] dark:bg-violet-500/10 px-3.5 py-[7px] text-[12.5px] font-semibold text-primary dark:text-violet-300 transition hover:bg-[rgba(124,58,237,0.14)] dark:hover:bg-violet-500/20">
                            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} /> Crie seu primeiro aluno
                        </Link>
                    ) : (
                        <div className="relative" ref={scopeRef}>
                            {/* Seletor de escopo único: Geral (todos) ⇄ aluno em foco. */}
                            <button onClick={() => setScopeOpen((o) => !o)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold transition ${focusedStudent
                                    ? 'border-[rgba(124,58,237,0.25)] dark:border-violet-400/30 bg-[rgba(124,58,237,0.08)] dark:bg-violet-500/10 text-primary dark:text-violet-300'
                                    : 'border-k-border-subtle dark:border-k-border-subtle bg-white dark:bg-surface-card text-k-text-secondary dark:text-muted-foreground/80 hover:bg-surface-canvas dark:hover:bg-glass-bg'}`}>
                                {focusedStudent ? (
                                    <>
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[9px] font-bold text-white">{initialsOf(focusedStudent.name)}</span>
                                        <span className="max-w-[160px] truncate">{focusedStudent.name}</span>
                                        <span role="button" tabIndex={0} aria-label="Voltar para Geral"
                                            onClick={(e) => { e.stopPropagation(); onFocusStudent(null) }}
                                            className="ml-0.5 text-[14px] leading-none text-[#a78bfa] dark:text-violet-400 hover:text-primary">×</span>
                                    </>
                                ) : (
                                    <>
                                        <Globe className="h-3.5 w-3.5 text-primary dark:text-violet-400" strokeWidth={2} /> Geral · todos os alunos
                                    </>
                                )}
                                <ChevronDown className="h-3.5 w-3.5 text-k-text-quaternary dark:text-muted-foreground/60" strokeWidth={2} />
                            </button>

                            {scopeOpen && (
                                <div className="absolute left-0 top-full z-modal mt-1.5 w-[264px] overflow-hidden rounded-xl border border-k-border-subtle dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-xl">
                                    <button onClick={() => { onFocusStudent(null); setScopeOpen(false) }}
                                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium text-k-text-primary dark:text-foreground transition hover:bg-surface-inset dark:hover:bg-glass-bg">
                                        <Globe className="h-4 w-4 shrink-0 text-primary dark:text-violet-400" strokeWidth={2} />
                                        <span className="flex-1 text-left">Geral · todos os alunos</span>
                                        {!focusedStudent && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} />}
                                    </button>
                                    <div className="border-t border-k-border-subtle dark:border-k-border-subtle" />
                                    <div className="p-2">
                                        <input value={scopeSearch} onChange={(e) => setScopeSearch(e.target.value)} placeholder="Buscar aluno…"
                                            className="w-full rounded-lg border border-k-border-subtle dark:border-k-border-subtle bg-surface-inset dark:bg-glass-bg px-3 py-1.5 text-[13px] text-k-text-primary dark:text-foreground placeholder:text-k-text-quaternary dark:placeholder:text-muted-foreground/60 focus:outline-none" />
                                    </div>
                                    <div className="max-h-[220px] overflow-y-auto pb-1">
                                        {filteredStudents.length === 0 ? (
                                            <p className="px-3 py-3 text-[12.5px] text-k-text-tertiary dark:text-muted-foreground">Nenhum aluno encontrado.</p>
                                        ) : filteredStudents.map((s) => (
                                            <button key={s.id} onClick={() => { onFocusStudent(s.id); setScopeOpen(false); setScopeSearch('') }}
                                                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-surface-inset dark:hover:bg-glass-bg">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[10px] font-bold text-white">{initialsOf(s.name)}</span>
                                                <span className="flex-1 truncate text-left text-k-text-primary dark:text-foreground">{s.name}</span>
                                                {focusedStudentId === s.id && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-k-text-tertiary dark:text-muted-foreground">
                        <Coins className="h-[15px] w-[15px] text-[#F59E0B]" strokeWidth={1.8} />
                        <b className="font-bold text-k-text-primary dark:text-foreground [font-variant-numeric:tabular-nums]">{summary.creditsRemaining.toLocaleString('pt-BR')}</b> de {summary.creditsTotal.toLocaleString('pt-BR')} créditos
                    </span>
                </div>

                {/* Precisa de atenção */}
                {attention.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-k-text-tertiary dark:text-muted-foreground">Precisa de atenção</span>
                            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#F59E0B] px-1.5 py-px text-[10.5px] font-bold leading-none text-white [font-variant-numeric:tabular-nums]">{attention.length}</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {attention.map((a) => {
                                const kind = attentionKind(a)
                                const tag = KIND_TAG[kind]
                                const av = avatarFor(a.studentName)
                                const prompt = attentionPrompt(a)
                                const heading = a.studentName ?? a.title
                                const TagIcon = tag.icon
                                return (
                                    <button key={a.id} onClick={() => { if (a.studentId) onFocusStudent(a.studentId); fillFromCard(prompt) }}
                                        className="group flex items-center gap-3.5 rounded-[14px] border border-k-border-subtle dark:border-k-border-subtle bg-white dark:bg-surface-card py-[14px] pl-4 pr-4 text-left transition hover:bg-surface-canvas dark:hover:bg-white/5">
                                        {a.studentName ? (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-[13px] font-bold" style={{ background: av.bg, color: av.fg }}>{av.initials}</span>
                                        ) : (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]" style={{ background: tag.bg, color: tag.fg }}>
                                                <TagIcon className="h-[19px] w-[19px]" strokeWidth={1.9} />
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <b className="truncate text-[14.5px] font-semibold tracking-[-.01em]">{heading}</b>
                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-none" style={{ background: tag.bg, color: tag.fg }}>
                                                    <TagIcon className="h-[11px] w-[11px]" strokeWidth={2.2} /> {tag.label}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-[12.5px] text-k-text-tertiary dark:text-muted-foreground">{a.studentName ? a.title : a.body}</span>
                                        </span>
                                        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-k-text-quaternary dark:text-muted-foreground/50" strokeWidth={2} />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Estilo já configurado: sinal discreto de que os builds seguem o
                    treinador (com o caminho para revisar). */}
                {!showStyleInvite && (
                    <section className="mt-9">
                        <Link
                            href="/settings#estilo"
                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.06)] px-3.5 py-[7px] text-[12.5px] font-semibold text-primary transition hover:bg-[rgba(124,58,237,0.12)] dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300"
                        >
                            <Wand2 className="h-[13px] w-[13px]" strokeWidth={2.2} />
                            Seu estilo está ativo — eu monto os treinos do seu jeito
                        </Link>
                    </section>
                )}

                {/* Convite: configurar o estilo de prescrição (some depois de configurado) */}
                {showStyleInvite && (
                    <section className="mt-9">
                        <button
                            onClick={onStartStyleInterview}
                            disabled={sending}
                            className="group flex w-full items-center gap-3.5 rounded-[14px] border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.04)] py-[14px] pl-4 pr-4 text-left transition hover:bg-[rgba(124,58,237,0.08)] disabled:opacity-60 dark:border-violet-400/25 dark:bg-violet-500/[0.07] dark:hover:bg-violet-500/[0.12]"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]" style={{ background: 'var(--primary)' }}>
                                <Wand2 className="h-[19px] w-[19px] text-white" strokeWidth={1.9} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <b className="block text-[14.5px] font-semibold tracking-[-.01em] text-k-text-primary dark:text-foreground">
                                    Ensine o seu estilo de prescrição
                                </b>
                                <span className="mt-0.5 block text-[12.5px] text-k-text-secondary dark:text-muted-foreground">
                                    Eu leio os programas que você já montou e pergunto só o resto. Depois, monto os treinos do seu jeito. Leva ~3 min.
                                </span>
                            </span>
                            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-primary dark:text-violet-400" strokeWidth={2} />
                        </button>
                    </section>
                )}

                {/* Comece por aqui */}
                <section className="mt-9">
                    <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-k-text-tertiary dark:text-muted-foreground">Comece por aqui</div>
                    <div className="grid grid-cols-2 gap-2.5">
                        {STARTERS.map((s) => (
                            <div key={s.label} className="rounded-[14px] border border-k-border-subtle dark:border-k-border-subtle bg-white dark:bg-surface-card p-4">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: s.bg, color: s.color }}>
                                        <s.icon className="h-[15px] w-[15px]" strokeWidth={2} />
                                    </span>
                                    <b className="text-[11px] font-bold uppercase tracking-[0.06em] text-k-text-tertiary dark:text-muted-foreground">{s.label}</b>
                                </div>
                                {s.prompts.map((p, i) => (
                                    <button key={p.label} onClick={() => fillFromCard(p.prompt)}
                                        className={`flex w-full items-center justify-between gap-2 py-[5px] text-left text-[13px] text-k-text-primary dark:text-foreground transition hover:text-primary dark:hover:text-violet-400 ${i > 0 ? 'border-t border-[#F5F5F7] dark:border-white/5' : ''}`}>
                                        {p.label} <ChevronRight className="h-3.5 w-3.5 shrink-0 text-k-text-quaternary dark:text-muted-foreground/60" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Conversas recentes */}
                {recents.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-k-text-tertiary dark:text-muted-foreground">Conversas recentes</div>
                        <div className="flex flex-col">
                            {recents.slice(0, 5).map((c) => {
                                const av = avatarFor(c.studentName)
                                const isGeneral = !c.student_id
                                return (
                                    <button key={c.id} onClick={() => onOpenConversation(c.id)}
                                        className="group flex items-center gap-3 -mx-2.5 rounded-xl border-b border-k-border-subtle px-2.5 py-2.5 text-left transition-colors last:border-0 hover:border-transparent hover:bg-surface-inset dark:border-k-border-subtle dark:hover:bg-glass-bg">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold transition-transform group-hover:scale-[1.04]" style={isGeneral ? { background: 'var(--primary)', color: '#fff' } : { background: av.bg, color: av.fg }}>
                                            {isGeneral ? <AssistantMark variant="filled" className="h-3.5 w-3.5 text-white" /> : av.initials}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <b className="block text-[13.5px] text-k-text-primary transition-colors group-hover:text-primary dark:text-foreground dark:group-hover:text-violet-300">{c.studentName ?? 'Geral · estúdio'}</b>
                                            <span className="block truncate text-[12px] text-k-text-tertiary dark:text-muted-foreground">{c.title}</span>
                                        </span>
                                        <span className="shrink-0 text-[11px] text-k-text-quaternary transition-opacity group-hover:opacity-0 dark:text-muted-foreground/60">{timeShort(c.last_message_at)}</span>
                                        <ChevronRight className="-ml-4 h-4 w-4 shrink-0 text-[#C4B5FD] opacity-0 transition-opacity group-hover:opacity-100 dark:text-violet-400" strokeWidth={2} />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
