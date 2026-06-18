'use client'

/**
 * AssistantHome — landing do modo Assistente (estilo Cowork). Hero + composer +
 * "Precisa de atenção" (insights) + "Comece por aqui" + "Conversas recentes".
 * Apresentacional; envia ações via callbacks do AssistantWorkspace.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
    Sparkles, Send, Loader2, ChevronDown, ChevronRight, Globe, Check,
    Wallet, Users, Dumbbell, MessageCircle, TrendingDown, TrendingUp, FileText, Coins, UserPlus,
} from 'lucide-react'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { avatarFor, greeting, timeShort } from './ui-util'
import { AssistantBanner, type AssistantBannerData } from './assistant-banner'
import { MicButton } from './mic-button'

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
        label: 'Alunos', icon: Users, color: '#7C3AED', bg: '#EDE9FE', prompts: [
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

/** Tipo visual do card de atenção, derivado de category/priority do insight. */
type AttentionKind = 'estagnado' | 'pronto_para_evoluir' | 'nota'

function attentionKind(item: AttentionItem): AttentionKind {
    if (item.category === 'progression') return 'pronto_para_evoluir'
    if (item.category === 'suggestion' || item.category === 'summary') return 'nota'
    return 'estagnado' // alert / desconhecido
}

const KIND_TAG: Record<AttentionKind, { label: string; bg: string; fg: string; icon: typeof TrendingDown }> = {
    estagnado: { label: 'Estagnado', bg: '#FFFBEB', fg: '#B45309', icon: TrendingDown },
    pronto_para_evoluir: { label: 'Pronto p/ evoluir', bg: '#F0FDF4', fg: '#15803D', icon: TrendingUp },
    nota: { label: 'Nota', bg: '#EFF6FF', fg: '#2563EB', icon: FileText },
}

/** Prompt otimizado p/ o card de atenção: contexto do insight + o que produzir. */
function attentionPrompt(item: AttentionItem): string {
    const ctx = item.studentName ? `${item.studentName}: ${item.title}` : item.title
    const ofWho = item.studentName ? ` de ${item.studentName}` : ''
    switch (attentionKind(item)) {
        case 'pronto_para_evoluir':
            return `Sobre ${ctx}. Analise o histórico recente${ofWho} e proponha uma progressão concreta — quais exercícios, novo alvo de carga/reps/volume e o porquê — para o próximo ciclo.`
        case 'estagnado':
            return `Sobre ${ctx}. Identifique em quais exercícios está o platô e proponha uma estratégia para destravar a evolução (variação de estímulo, deload ou ajuste de volume), com os próximos passos.`
        default:
            return `Sobre ${ctx}. Resuma a situação e recomende o próximo passo.`
    }
}

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
}

export function AssistantHome({
    trainerName, summary, attention, recents, focusedStudentId, students, hasStudents, input, sending, banner,
    onDismissBanner, onInput, onSend, onStarter, onFocusStudent, onOpenConversation,
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
                    <span className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-[#F5F3FF] dark:bg-violet-500/15">
                        <Sparkles className="h-[26px] w-[26px] text-[#7C3AED] dark:text-violet-400" strokeWidth={1.6} />
                    </span>
                    <div className="mb-2 text-[14px] font-medium text-[#86868B] dark:text-muted-foreground">{greeting()}, {firstName}.</div>
                    <h1 className="font-display text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F] dark:text-foreground">
                        O que vamos resolver hoje?
                    </h1>
                </div>

                {/* Composer — mesma moldura/foco da conversa (flat, cinza suave) */}
                <div className="rounded-[22px] border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-elevated p-2 transition focus-within:border-[#C7C7CC] dark:focus-within:border-k-border-primary focus-within:shadow-[0_0_0_4px_rgba(60,60,67,0.07)]">
                    <textarea
                        ref={composerRef}
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
                        className="max-h-[280px] w-full resize-none overflow-y-auto bg-transparent px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/60"
                    />
                    <div className="flex items-center gap-2.5 px-2 pb-1 pt-1">
                        <MicButton disabled={sending} onTranscript={(t) => onInput(input ? `${input} ${t}` : t)} />
                        <span className="flex-1" />
                        <button onClick={onSend} disabled={sending || !input.trim()}
                            className="flex h-10 items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-[18px] text-[14px] font-bold text-white transition hover:brightness-[1.07] disabled:opacity-50">
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
                        <Link href="/students" className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.25)] dark:border-violet-400/30 bg-[rgba(124,58,237,0.08)] dark:bg-violet-500/10 px-3.5 py-[7px] text-[12.5px] font-semibold text-[#7C3AED] dark:text-violet-300 transition hover:bg-[rgba(124,58,237,0.14)] dark:hover:bg-violet-500/20">
                            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} /> Crie seu primeiro aluno
                        </Link>
                    ) : (
                        <div className="relative" ref={scopeRef}>
                            {/* Seletor de escopo único: Geral (todos) ⇄ aluno em foco. */}
                            <button onClick={() => setScopeOpen((o) => !o)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold transition ${focusedStudent
                                    ? 'border-[rgba(124,58,237,0.25)] dark:border-violet-400/30 bg-[rgba(124,58,237,0.08)] dark:bg-violet-500/10 text-[#7C3AED] dark:text-violet-300'
                                    : 'border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-card text-[#6E6E73] dark:text-muted-foreground/80 hover:bg-[#FAFAFA] dark:hover:bg-glass-bg'}`}>
                                {focusedStudent ? (
                                    <>
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[9px] font-bold text-white">{initialsOf(focusedStudent.name)}</span>
                                        <span className="max-w-[160px] truncate">{focusedStudent.name}</span>
                                        <span role="button" tabIndex={0} aria-label="Voltar para Geral"
                                            onClick={(e) => { e.stopPropagation(); onFocusStudent(null) }}
                                            className="ml-0.5 text-[14px] leading-none text-[#a78bfa] dark:text-violet-400 hover:text-[#7C3AED]">×</span>
                                    </>
                                ) : (
                                    <>
                                        <Globe className="h-3.5 w-3.5 text-[#8b5cf6] dark:text-violet-400" strokeWidth={2} /> Geral · todos os alunos
                                    </>
                                )}
                                <ChevronDown className="h-3.5 w-3.5 text-[#AEAEB2] dark:text-muted-foreground/60" strokeWidth={2} />
                            </button>

                            {scopeOpen && (
                                <div className="absolute left-0 top-full z-modal mt-1.5 w-[264px] overflow-hidden rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-xl">
                                    <button onClick={() => { onFocusStudent(null); setScopeOpen(false) }}
                                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium text-[#1D1D1F] dark:text-foreground transition hover:bg-[#F5F5F7] dark:hover:bg-glass-bg">
                                        <Globe className="h-4 w-4 shrink-0 text-[#8b5cf6] dark:text-violet-400" strokeWidth={2} />
                                        <span className="flex-1 text-left">Geral · todos os alunos</span>
                                        {!focusedStudent && <Check className="h-4 w-4 shrink-0 text-[#7C3AED]" strokeWidth={2.4} />}
                                    </button>
                                    <div className="border-t border-[#EDEDF0] dark:border-k-border-subtle" />
                                    <div className="p-2">
                                        <input value={scopeSearch} onChange={(e) => setScopeSearch(e.target.value)} placeholder="Buscar aluno…"
                                            className="w-full rounded-lg border border-[#EDEDF0] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-glass-bg px-3 py-1.5 text-[13px] text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/60 focus:outline-none" />
                                    </div>
                                    <div className="max-h-[220px] overflow-y-auto pb-1">
                                        {filteredStudents.length === 0 ? (
                                            <p className="px-3 py-3 text-[12.5px] text-[#86868B] dark:text-muted-foreground">Nenhum aluno encontrado.</p>
                                        ) : filteredStudents.map((s) => (
                                            <button key={s.id} onClick={() => { onFocusStudent(s.id); setScopeOpen(false); setScopeSearch('') }}
                                                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-[#F5F5F7] dark:hover:bg-glass-bg">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[10px] font-bold text-white">{initialsOf(s.name)}</span>
                                                <span className="flex-1 truncate text-left text-[#1D1D1F] dark:text-foreground">{s.name}</span>
                                                {focusedStudentId === s.id && <Check className="h-4 w-4 shrink-0 text-[#7C3AED]" strokeWidth={2.4} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#86868B] dark:text-muted-foreground">
                        <Coins className="h-[15px] w-[15px] text-[#F59E0B]" strokeWidth={1.8} />
                        <b className="font-bold text-[#1D1D1F] dark:text-foreground [font-variant-numeric:tabular-nums]">{summary.creditsRemaining.toLocaleString('pt-BR')}</b> de {summary.creditsTotal.toLocaleString('pt-BR')} créditos
                    </span>
                </div>

                {/* Precisa de atenção */}
                {attention.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B] dark:text-muted-foreground">Precisa de atenção</span>
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
                                    <button key={a.id} onClick={() => fillFromCard(prompt)}
                                        className="group flex items-center gap-3.5 rounded-[14px] border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-card py-[14px] pl-4 pr-4 text-left transition hover:bg-[#FAFAFA] dark:hover:bg-white/5">
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
                                            <span className="mt-0.5 block truncate text-[12.5px] text-[#86868B] dark:text-muted-foreground">{a.studentName ? a.title : a.body}</span>
                                        </span>
                                        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#C7C7CC] dark:text-muted-foreground/50" strokeWidth={2} />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Comece por aqui */}
                <section className="mt-9">
                    <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B] dark:text-muted-foreground">Comece por aqui</div>
                    <div className="grid grid-cols-2 gap-2.5">
                        {STARTERS.map((s) => (
                            <div key={s.label} className="rounded-[14px] border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-card p-4">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: s.bg, color: s.color }}>
                                        <s.icon className="h-[15px] w-[15px]" strokeWidth={2} />
                                    </span>
                                    <b className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868B] dark:text-muted-foreground">{s.label}</b>
                                </div>
                                {s.prompts.map((p, i) => (
                                    <button key={p.label} onClick={() => fillFromCard(p.prompt)}
                                        className={`flex w-full items-center justify-between gap-2 py-[5px] text-left text-[13px] text-[#1D1D1F] dark:text-foreground transition hover:text-[#7C3AED] dark:hover:text-violet-400 ${i > 0 ? 'border-t border-[#F5F5F7] dark:border-white/5' : ''}`}>
                                        {p.label} <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#AEAEB2] dark:text-muted-foreground/60" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Conversas recentes */}
                {recents.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B] dark:text-muted-foreground">Conversas recentes</div>
                        <div className="flex flex-col">
                            {recents.slice(0, 5).map((c) => {
                                const av = avatarFor(c.studentName)
                                const isGeneral = !c.student_id
                                return (
                                    <button key={c.id} onClick={() => onOpenConversation(c.id)}
                                        className="group flex items-center gap-3 -mx-2.5 rounded-xl border-b border-[#EDEDF0] px-2.5 py-2.5 text-left transition-colors last:border-0 hover:border-transparent hover:bg-[#F5F5F7] dark:border-k-border-subtle dark:hover:bg-glass-bg">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold transition-transform group-hover:scale-[1.04]" style={isGeneral ? { background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff' } : { background: av.bg, color: av.fg }}>
                                            {isGeneral ? <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} /> : av.initials}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <b className="block text-[13.5px] text-[#1D1D1F] transition-colors group-hover:text-[#7C3AED] dark:text-foreground dark:group-hover:text-violet-300">{c.studentName ?? 'Geral · estúdio'}</b>
                                            <span className="block truncate text-[12px] text-[#86868B] dark:text-muted-foreground">{c.title}</span>
                                        </span>
                                        <span className="shrink-0 text-[11px] text-[#AEAEB2] transition-opacity group-hover:opacity-0 dark:text-muted-foreground/60">{timeShort(c.last_message_at)}</span>
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
