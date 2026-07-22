'use client'

/**
 * AssistantComposer — barra de composição do modo Assistente (design "Assistente
 * Composer"). Componente apresentacional compartilhado pela home (/assistente) e
 * pela conversa: textarea que cresce + toolbar inline (escopo · modo · ditado ·
 * enviar) com animações premium (foco em anel violeta, glow do enviar, pulso do
 * ditado, pop dos menus). Estado e envio vêm de quem monta (useAssistantThread).
 *
 * Escopo (Geral ⇄ aluno, com busca) aparece só onde faz sentido escolher antes de
 * abrir a thread (home) — na conversa o escopo já está fixo no cabeçalho, então
 * `scope` é omitido. O Modo (Agir/Planejar/Analisar) aparece nas duas.
 *
 * "Anexar" do design foi adiado (o Assistente ainda não recebe arquivos), então a
 * toolbar começa no escopo/modo — sem botão morto.
 */

import { useEffect, useRef, useState } from 'react'
import {
    Globe, Check, ChevronDown, Search, Zap, ListChecks, TrendingUp, ArrowUp, Square,
} from 'lucide-react'
import { MicButton } from './mic-button'
import type { AssistantTurnMode } from '@/lib/assistant/command-engine'

export type { AssistantTurnMode }

interface ComposerStudent { id: string; name: string }
interface ComposerChip { label: string; onClick: () => void }
interface ScopeConfig {
    students: ComposerStudent[]
    focusedStudentId: string | null
    onFocusStudent: (id: string | null) => void
    /** Âncora do tour (data-onboarding) no botão de escopo. */
    anchor?: string
}

interface AssistantComposerProps {
    input: string
    onInput: (v: string) => void
    onSend: () => void
    onStop?: () => void
    sending: boolean
    placeholder: string
    mode: AssistantTurnMode
    onModeChange: (m: AssistantTurnMode) => void
    /** Chips de sugestão acima do composer (opcional). */
    chips?: ComposerChip[]
    /** Seletor de escopo Geral ⇄ aluno (home). Omitir → sem botão de escopo. */
    scope?: ScopeConfig
    /** Direção de abertura dos menus: 'up' (composer no rodapé) ou 'down' (home). */
    menuDirection?: 'up' | 'down'
    /** Slot antes do microfone (ex.: toggle de modo voz da conversa). */
    toolbarLead?: React.ReactNode
    /** Esconde o botão de ditado (ex.: conversa em modo voz hands-free). */
    hideMic?: boolean
    /** Desabilita o textarea (conversa desabilita durante o turno). */
    textareaDisabled?: boolean
    /** Ref externa do textarea (foco/scroll a partir de quem monta). */
    textareaRef?: React.RefObject<HTMLTextAreaElement | null>
    /** Altura máx. do textarea antes de rolar (home 280, conversa 200). */
    maxTextareaHeight?: number
    /** Âncora do tour (data-onboarding) no card do composer. */
    anchor?: string
    /** Rótulo acessível do textarea. */
    ariaLabel?: string
}

const MODE_META: Record<AssistantTurnMode, { label: string; icon: typeof Zap; desc: string }> = {
    agir: { label: 'Agir', icon: Zap, desc: 'Executa ações no Kinevo' },
    planejar: { label: 'Planejar', icon: ListChecks, desc: 'Propõe um plano antes de agir' },
    analisar: { label: 'Analisar', icon: TrendingUp, desc: 'Só lê e responde, não altera nada' },
}
const MODE_ORDER: AssistantTurnMode[] = ['agir', 'planejar', 'analisar']

function initialsOf(name: string) {
    return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export function AssistantComposer({
    input, onInput, onSend, onStop, sending, placeholder, mode, onModeChange,
    chips, scope, menuDirection = 'up', toolbarLead, hideMic, textareaDisabled, textareaRef,
    maxTextareaHeight = 200, anchor, ariaLabel,
}: AssistantComposerProps) {
    const rootRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLTextAreaElement>(null)
    const [open, setOpen] = useState<'scope' | 'mode' | null>(null)
    const [scopeSearch, setScopeSearch] = useState('')

    const canSend = input.trim().length > 0 && !sending

    // Textarea cresce com o conteúdo (até maxTextareaHeight; depois rola).
    useEffect(() => {
        const el = innerRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, maxTextareaHeight)}px`
    }, [input, maxTextareaHeight])

    // Fecha os menus ao clicar fora ou apertar Esc (mesmo comportamento do design).
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const setRefs = (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (textareaRef) textareaRef.current = node
    }

    const focusedStudent = scope?.focusedStudentId
        ? scope.students.find((s) => s.id === scope.focusedStudentId) ?? null
        : null
    const filteredStudents = (scope?.students ?? []).filter((s) =>
        s.name.toLowerCase().includes(scopeSearch.trim().toLowerCase()))

    // Menu abre pra cima (rodapé) ou pra baixo (home) a partir do botão.
    const menuPos = menuDirection === 'up'
        ? 'bottom-[calc(100%+8px)] origin-bottom-left'
        : 'top-[calc(100%+8px)] origin-top-left'

    // Pílula de controle (escopo/modo): controle suave que ganha fundo no hover.
    const controlPill =
        'inline-flex h-[34px] items-center gap-1.5 rounded-full border border-k-border-subtle bg-[#F4F4F6] px-2.5 text-[12.5px] font-semibold text-k-text-secondary transition-transform active:scale-[0.93] hover:bg-[#ECECF0] dark:bg-white/[0.055] dark:hover:bg-white/[0.11]'
    const menuShell =
        `absolute z-modal ${menuPos} kv-pop rounded-2xl border border-k-border-subtle bg-white dark:bg-surface-card p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]`
    const ModeIcon = MODE_META[mode].icon

    return (
        <div ref={rootRef} className="w-full">
            {chips && chips.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {chips.map((c) => (
                        <button key={c.label} onClick={c.onClick} disabled={sending}
                            className="inline-flex items-center rounded-full border border-k-border-subtle bg-white px-[13px] py-1.5 text-[12.5px] font-medium text-k-text-secondary transition-transform active:scale-[0.96] hover:border-k-border-primary hover:bg-surface-inset hover:text-k-text-primary disabled:opacity-50 dark:bg-surface-elevated dark:text-muted-foreground/80 dark:hover:border-k-border-primary dark:hover:bg-glass-bg dark:hover:text-foreground">
                            {c.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Card: foco em anel violeta (idioma da marca do Assistente). */}
            <div className="rounded-[22px] border border-k-border-subtle bg-white p-2 transition-[border-color,box-shadow] duration-200 focus-within:border-[#C4B5FD] focus-within:shadow-[0_0_0_4px_rgba(124,58,237,0.15)] dark:bg-surface-elevated dark:focus-within:border-primary/60 dark:focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.25)]"
                data-onboarding={anchor}>
                <textarea
                    ref={setRefs}
                    data-assistant-composer
                    value={input}
                    onChange={(e) => onInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
                    onFocus={() => setOpen(null)}
                    disabled={textareaDisabled}
                    rows={2}
                    aria-label={ariaLabel ?? placeholder}
                    placeholder={placeholder}
                    // outline inline: vence a regra global unlayered `:focus-visible`; o
                    // foco fica no anel do card (focus-within), não no textarea.
                    style={{ outline: 'none' }}
                    className="block max-h-[280px] w-full resize-none overflow-y-auto bg-transparent px-2.5 pb-1 pt-2 text-[15.5px] leading-[1.5] text-k-text-primary placeholder:text-k-text-quaternary dark:text-foreground dark:placeholder:text-muted-foreground/60"
                />

                <div className="flex items-center gap-1.5 px-1 pt-0.5">
                    {/* Escopo (home): Geral ⇄ aluno em foco, com busca. */}
                    {scope && (
                        <div className="relative">
                            <button
                                onClick={() => setOpen((o) => (o === 'scope' ? null : 'scope'))}
                                data-onboarding={scope.anchor}
                                aria-haspopup="menu" aria-expanded={open === 'scope'}
                                className={`${controlPill} max-w-[200px] pl-2`}>
                                {focusedStudent ? (
                                    <>
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F1ECFE] text-[9px] font-bold text-[#6D28D9] dark:bg-primary/20 dark:text-violet-300">{initialsOf(focusedStudent.name)}</span>
                                        <span className="max-w-[120px] truncate text-k-text-primary dark:text-foreground">{focusedStudent.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Globe className="h-[15px] w-[15px] text-k-text-tertiary" strokeWidth={1.7} />
                                        <span>Geral</span>
                                    </>
                                )}
                                <ChevronDown className="h-3.5 w-3.5 text-k-text-quaternary" strokeWidth={2} />
                            </button>

                            {open === 'scope' && (
                                <div className={`${menuShell} w-[288px]`} role="menu">
                                    <div className="flex items-center gap-2 px-2.5 pb-2 pt-1.5">
                                        <Search className="h-[15px] w-[15px] text-k-text-tertiary" strokeWidth={2} />
                                        <input value={scopeSearch} onChange={(e) => setScopeSearch(e.target.value)}
                                            placeholder="Buscar aluno…" autoFocus
                                            style={{ outline: 'none' }}
                                            className="flex-1 bg-transparent text-[13px] text-k-text-primary placeholder:text-k-text-quaternary dark:text-foreground dark:placeholder:text-muted-foreground/60" />
                                    </div>
                                    <button onClick={() => { scope.onFocusStudent(null); setOpen(null); setScopeSearch('') }}
                                        className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13px] font-medium text-k-text-primary transition hover:bg-surface-inset dark:text-foreground dark:hover:bg-glass-bg">
                                        <Globe className="h-[17px] w-[17px] shrink-0 text-primary dark:text-violet-400" strokeWidth={1.9} />
                                        <span className="flex-1 text-left">Geral · todos os alunos</span>
                                        {!focusedStudent && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} />}
                                    </button>
                                    <div className="mx-1.5 my-1 h-px bg-k-border-subtle" />
                                    <div className="kv-scroll max-h-[196px] overflow-y-auto pb-0.5">
                                        {filteredStudents.length === 0 ? (
                                            <p className="px-3 py-2.5 text-[12.5px] text-k-text-tertiary dark:text-muted-foreground">Nenhum aluno encontrado.</p>
                                        ) : filteredStudents.map((s, i) => (
                                            <button key={s.id} onClick={() => { scope.onFocusStudent(s.id); setOpen(null); setScopeSearch('') }}
                                                style={{ animationDelay: `${Math.min(i, 6) * 22}ms` }}
                                                className="kv-menu-item flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13px] text-k-text-primary transition hover:bg-surface-inset dark:text-foreground dark:hover:bg-glass-bg">
                                                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#F1ECFE] text-[10px] font-bold text-[#6D28D9] dark:bg-primary/20 dark:text-violet-300">{initialsOf(s.name)}</span>
                                                <span className="flex-1 truncate text-left">{s.name}</span>
                                                {scope.focusedStudentId === s.id && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Modo: Agir / Planejar / Analisar. */}
                    <div className="relative">
                        <button
                            onClick={() => setOpen((o) => (o === 'mode' ? null : 'mode'))}
                            aria-haspopup="menu" aria-expanded={open === 'mode'}
                            className={`${controlPill} pl-2.5`}>
                            <ModeIcon className="h-[15px] w-[15px] text-primary dark:text-violet-400" strokeWidth={1.8} />
                            <span className="text-k-text-primary dark:text-foreground">{MODE_META[mode].label}</span>
                            <ChevronDown className="h-3.5 w-3.5 text-k-text-quaternary" strokeWidth={2} />
                        </button>

                        {open === 'mode' && (
                            <div className={`${menuShell} w-[266px]`} role="menu">
                                {MODE_ORDER.map((m, i) => {
                                    const meta = MODE_META[m]
                                    const Icon = meta.icon
                                    return (
                                        <button key={m} onClick={() => { onModeChange(m); setOpen(null) }}
                                            style={{ animationDelay: `${30 + i * 40}ms` }}
                                            className="kv-menu-item flex w-full items-center gap-2.5 rounded-[10px] p-2.5 text-left transition hover:bg-surface-inset dark:hover:bg-glass-bg">
                                            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-surface-inset dark:bg-white/[0.06]">
                                                <Icon className="h-4 w-4 text-primary dark:text-violet-400" strokeWidth={1.8} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <b className="block text-[13px] font-semibold text-k-text-primary dark:text-foreground">{meta.label}</b>
                                                <span className="block text-[11.5px] text-k-text-tertiary dark:text-muted-foreground">{meta.desc}</span>
                                            </span>
                                            {mode === m && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} />}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <span className="flex-1" />

                    {sending ? (
                        <button onClick={onStop} type="button" title="Parar" aria-label="Parar"
                            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-k-border-subtle bg-surface-inset text-k-text-primary transition-transform active:scale-90 hover:bg-surface-card dark:text-foreground dark:hover:bg-glass-bg">
                            <Square className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            {toolbarLead}
                            {!hideMic && (
                                <MicButton disabled={sending} value={input} onChange={onInput}
                                    studentId={scope?.focusedStudentId ?? undefined} variant="ghost" />
                            )}
                            <button onClick={onSend} disabled={!canSend} title="Enviar" aria-label="Enviar"
                                style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 74%, #000))' }}
                                className={`flex h-[38px] w-[38px] items-center justify-center rounded-full text-white transition-[transform,opacity] duration-200 active:scale-90 ${canSend ? 'kv-send-glow opacity-100' : 'opacity-[0.45]'}`}>
                                <ArrowUp className="h-[19px] w-[19px]" strokeWidth={2.1} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
