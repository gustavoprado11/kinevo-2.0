'use client'

/**
 * AssistantHome — landing do modo Assistente (estilo Cowork). Hero + composer +
 * "Precisa de atenção" (insights) + "Comece por aqui" + "Conversas recentes".
 * Apresentacional; envia ações via callbacks do AssistantShell.
 */

import {
    Sparkles, Plus, Send, Loader2, User, ChevronDown, ChevronRight,
    Wallet, Users, Dumbbell, MessageSquare, AlertTriangle, TrendingUp, Coins,
} from 'lucide-react'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { avatarFor, greeting, timeShort } from './ui-util'

const STARTERS: { label: string; icon: typeof Wallet; color: string; bg: string; prompts: string[] }[] = [
    { label: 'Financeiro', icon: Wallet, color: '#007AFF', bg: 'rgba(0,122,255,.1)', prompts: ['Mostrar os alunos inadimplentes do mês', 'Qual o MRR atual?', 'Gerar um resumo financeiro do mês'] },
    { label: 'Alunos', icon: Users, color: '#7C3AED', bg: 'rgba(124,58,237,.1)', prompts: ['Quais alunos estão sem treino ativo?', 'Resumo de adesão da semana', 'Quais alunos estão em risco de cancelar?'] },
    { label: 'Treinos', icon: Dumbbell, color: '#FF9F0A', bg: 'rgba(255,159,10,.12)', prompts: ['Gerar um programa para um aluno', 'Quais alunos estão estagnados?', 'Criar um template na biblioteca'] },
    { label: 'Comunicação', icon: MessageSquare, color: '#FF3B30', bg: 'rgba(255,59,48,.1)', prompts: ['Enviar uma mensagem motivacional para um aluno', 'Enviar formulário de check-in', 'Lembrar quem faltou ao treino'] },
]

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
    high: { color: '#FF3B30', bg: 'rgba(255,59,48,.1)' },
    medium: { color: '#FF9F0A', bg: 'rgba(255,159,10,.12)' },
    low: { color: '#007AFF', bg: 'rgba(0,122,255,.1)' },
}

interface Props {
    trainerName: string | null
    summary: AiUsageSummary
    attention: AttentionItem[]
    recents: ConversationListItem[]
    focusedStudentName: string | null
    input: string
    sending: boolean
    onInput: (v: string) => void
    onSend: () => void
    onStarter: (prompt: string) => void
    onPickFocus: () => void
    onClearFocus: () => void
    onOpenConversation: (id: string) => void
}

export function AssistantHome({
    trainerName, summary, attention, recents, focusedStudentName, input, sending,
    onInput, onSend, onStarter, onPickFocus, onClearFocus, onOpenConversation,
}: Props) {
    const firstName = (trainerName ?? '').split(' ')[0] || 'treinador'
    return (
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#F5F5F7]">
            <div className="mx-auto max-w-[720px] px-7 pb-16 pt-[72px]">
                {/* Hero */}
                <div className="mb-7 text-center">
                    <span className="mx-auto mb-3.5 flex h-[34px] w-[34px] items-center justify-center text-[#7C3AED]">
                        <Sparkles className="h-[34px] w-[34px]" strokeWidth={1.4} />
                    </span>
                    <div className="mb-1.5 text-[14px] font-semibold text-[#86868B]">{greeting()}, {firstName}.</div>
                    <h1 className="font-serif text-[36px] font-medium leading-[1.1] tracking-[-.015em] text-[#1D1D1F]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                        O que vamos resolver hoje?
                    </h1>
                </div>

                {/* Composer */}
                <div className="rounded-[18px] border border-[#D2D2D7] bg-white p-1.5 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.14)] transition focus-within:border-[#7C3AED] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]">
                    <textarea
                        value={input}
                        onChange={(e) => onInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
                        rows={2}
                        placeholder="Diga o que fazer no Kinevo — ou escolha um aluno…"
                        className="w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-relaxed outline-none placeholder:text-[#AEAEB2]"
                    />
                    <div className="flex items-center gap-2.5 px-2 pb-1 pt-1">
                        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-[#E8E8ED] text-[#86868B]">
                            <Plus className="h-[17px] w-[17px]" strokeWidth={2} />
                        </span>
                        <span className="flex-1" />
                        <button onClick={onSend} disabled={sending || !input.trim()}
                            className="flex h-[38px] items-center gap-2 rounded-[11px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-[18px] text-[13.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)] transition hover:brightness-105 disabled:opacity-50">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2} />} Agir
                        </button>
                    </div>
                </div>

                {/* Contexto */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    {focusedStudentName ? (
                        <button onClick={onClearFocus} className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.08)] px-3.5 py-[7px] text-[12.5px] font-semibold text-[#7C3AED]">
                            <User className="h-3.5 w-3.5" strokeWidth={2} /> {focusedStudentName}
                            <span className="text-[#a78bfa]">×</span>
                        </button>
                    ) : (
                        <button onClick={onPickFocus} className="inline-flex items-center gap-2 rounded-full border border-[#E8E8ED] bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-[#6E6E73] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            <User className="h-3.5 w-3.5 text-[#8b5cf6]" strokeWidth={2} /> Aluno em foco <ChevronDown className="h-3.5 w-3.5 text-[#AEAEB2]" strokeWidth={2} />
                        </button>
                    )}
                    {!focusedStudentName && (
                        <span className="rounded-full border border-dashed border-[#E8E8ED] px-3.5 py-[7px] text-[12.5px] font-semibold text-[#86868B]">Geral · visão geral dos alunos</span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#86868B]">
                        <Coins className="h-[15px] w-[15px] text-[#FF9F0A]" strokeWidth={1.8} />
                        <b className="font-bold text-[#1D1D1F]">{summary.creditsRemaining}</b> de {summary.creditsTotal} créditos
                    </span>
                </div>

                {/* Precisa de atenção */}
                {attention.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B]">Precisa de atenção</div>
                        <div className="flex flex-col gap-2.5">
                            {attention.map((a) => {
                                const st = PRIORITY_STYLE[a.priority] ?? PRIORITY_STYLE.medium
                                const prompt = a.studentName ? `Sobre ${a.studentName}: ${a.title}` : a.title
                                return (
                                    <button key={a.id} onClick={() => onStarter(prompt)}
                                        className="flex items-center gap-3.5 rounded-[14px] border border-[#E8E8ED] bg-white px-4 py-3.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                                        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={{ background: st.bg, color: st.color }}>
                                            {a.priority === 'high' ? <AlertTriangle className="h-[19px] w-[19px]" strokeWidth={1.9} /> : <TrendingUp className="h-[19px] w-[19px]" strokeWidth={1.9} />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <b className="block truncate text-[14px] tracking-[-.01em]">{a.title}</b>
                                            <span className="block truncate text-[12.5px] text-[#86868B]">{a.studentName ? `${a.studentName} · ` : ''}{a.body}</span>
                                        </span>
                                        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#AEAEB2]" strokeWidth={2} />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Comece por aqui */}
                <section className="mt-9">
                    <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B]">Comece por aqui</div>
                    <div className="grid grid-cols-2 gap-2.5">
                        {STARTERS.map((s) => (
                            <div key={s.label} className="rounded-[14px] border border-[#E8E8ED] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]" style={{ background: s.bg, color: s.color }}>
                                        <s.icon className="h-[15px] w-[15px]" strokeWidth={2} />
                                    </span>
                                    <b className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868B]">{s.label}</b>
                                </div>
                                {s.prompts.map((p, i) => (
                                    <button key={p} onClick={() => onStarter(p)}
                                        className={`flex w-full items-center justify-between gap-2 py-[5px] text-left text-[13px] text-[#1D1D1F] transition hover:text-[#7C3AED] ${i > 0 ? 'border-t border-[#F9F9FB]' : ''}`}>
                                        {p} <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#AEAEB2]" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Conversas recentes */}
                {recents.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B]">Conversas recentes</div>
                        <div className="flex flex-col">
                            {recents.slice(0, 5).map((c) => {
                                const av = avatarFor(c.studentName)
                                const isGeneral = !c.student_id
                                return (
                                    <button key={c.id} onClick={() => onOpenConversation(c.id)}
                                        className="flex items-center gap-3 border-b border-[#E8E8ED] py-2.5 text-left last:border-0">
                                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold text-white" style={{ background: isGeneral ? 'linear-gradient(135deg,#7C3AED,#A78BFA)' : av.bg }}>
                                            {isGeneral ? <Sparkles className="h-3.5 w-3.5" strokeWidth={2} /> : av.initials}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <b className="block text-[13.5px]">{c.studentName ?? 'Geral · estúdio'}</b>
                                            <span className="block truncate text-[12px] text-[#86868B]">{c.title}</span>
                                        </span>
                                        <span className="shrink-0 text-[11px] text-[#AEAEB2]">{timeShort(c.last_message_at)}</span>
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
