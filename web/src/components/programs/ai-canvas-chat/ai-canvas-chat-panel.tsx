'use client'

// Painel de chat "Gerar com IA" — monta/ajusta o programa AO VIVO no canvas do
// builder (feature: docs/feature-ia-builder-chat.md). Stream NDJSON do
// /api/programs/ai-canvas: aplica o evento `program` no canvas pela ponte.

import { useRef, useState, type KeyboardEvent } from 'react'
import { X, Send, FileText, Loader2 } from 'lucide-react'
import { Z } from '@/lib/z-index'
import type { Exercise } from '@/types/exercise'
import type { CanvasStreamEvent, RenderedProgram } from '@/lib/programs/ai-canvas/types'
import { getCanvasApi } from '../helpers/builder-canvas-bridge'
import { compactCatalog, renderedToWorkouts, workoutsToSnapshot } from './rendered-to-workouts'
import { AssistantMark } from '@/components/assistant/assistant-mark'

interface ChatMsg { role: 'user' | 'assistant'; content: string }

interface AiCanvasChatPanelProps {
    open: boolean
    studentId: string
    studentName: string
    exercises: Exercise[]
    currentName: string
    currentDurationWeeks: number | null
    onApplyMeta: (meta: { name?: string; durationWeeks?: number }) => void
    onUseForm: () => void
    onClose: () => void
}

const GOALS = ['Hipertrofia', 'Perda de peso', 'Performance', 'Saúde']
const DAYS: Array<{ key: number; label: string }> = [
    { key: 1, label: 'Seg' }, { key: 2, label: 'Ter' }, { key: 3, label: 'Qua' },
    { key: 4, label: 'Qui' }, { key: 5, label: 'Sex' }, { key: 6, label: 'Sáb' }, { key: 0, label: 'Dom' },
]

export function AiCanvasChatPanel({
    open, studentId, studentName, exercises,
    currentName, currentDurationWeeks, onApplyMeta, onUseForm, onClose,
}: AiCanvasChatPanelProps) {
    const [messages, setMessages] = useState<ChatMsg[]>([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [progress, setProgress] = useState<string | null>(null)
    const [goal, setGoal] = useState<string | null>(null)
    const [days, setDays] = useState<number[]>([1, 2, 4, 5])
    const scrollRef = useRef<HTMLDivElement>(null)

    if (!open) return null

    const toggleDay = (d: number) =>
        setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

    const applyProgram = (program: RenderedProgram) => {
        const api = getCanvasApi()
        if (!api) return
        const workouts = renderedToWorkouts(program, exercises)
        api.apply(() => workouts)
        if (workouts[0]) api.setActiveWorkout(workouts[0].id)
        onApplyMeta({
            name: program.name ?? undefined,
            durationWeeks: program.duration_weeks ?? undefined,
        })
    }

    const send = async () => {
        if (sending) return
        const isFirst = messages.length === 0
        const typed = input.trim()
        let text = typed
        if (isFirst) {
            const dayLabels = days.map(d => DAYS.find(x => x.key === d)?.label).filter(Boolean).join('/')
            const ctx = [
                goal ? `Objetivo: ${goal}.` : '',
                days.length ? `Dias: ${dayLabels} (${days.length}x/semana).` : '',
            ].filter(Boolean).join(' ')
            if (!typed) text = `Monte um novo programa de treino para ${studentName}. ${ctx}`.trim()
            else if (ctx) text = `${typed}\n\n(${ctx})`
        }
        if (!text) return

        setMessages(prev => [...prev, { role: 'user', content: text }])
        setInput('')
        setSending(true)
        setProgress('Pensando…')

        try {
            const api = getCanvasApi()
            const currentProgram = workoutsToSnapshot(api?.getWorkouts() ?? [], currentName || null, currentDurationWeeks)
            const res = await fetch('/api/programs/ai-canvas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId,
                    message: text,
                    history: messages.slice(-10),
                    exercises: compactCatalog(exercises),
                    currentProgram,
                }),
            })

            if (!res.ok || !res.body) {
                let msg = 'Não consegui gerar agora.'
                try { const j = await res.json(); msg = j.message || j.error || msg } catch { /* ignore */ }
                setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${msg}` }])
                return
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let assistantText = ''
            for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''
                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed) continue
                    let ev: CanvasStreamEvent
                    try { ev = JSON.parse(trimmed) as CanvasStreamEvent } catch { continue }
                    if (ev.type === 'progress') setProgress(ev.label)
                    else if (ev.type === 'program') applyProgram(ev.program)
                    else if (ev.type === 'done') {
                        assistantText = ev.text
                        // Só avisa na DEGRADAÇÃO real (fallback pro mini). Sonnet e
                        // Gemini são modelos de build válidos — não disparam aviso.
                        if (ev.model === 'gpt-4.1-mini') {
                            assistantText += `\n\n⚠️ Gerado com gpt-4.1-mini (modelo forte indisponível). A qualidade fica abaixo do ideal.`
                        }
                    }
                    else if (ev.type === 'error') assistantText = `⚠️ ${ev.message}`
                }
            }
            setMessages(m => [...m, { role: 'assistant', content: assistantText || 'Pronto.' }])
        } catch {
            setMessages(m => [...m, { role: 'assistant', content: '⚠️ Falha de conexão. Tenta de novo.' }])
        } finally {
            setSending(false)
            setProgress(null)
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }))
        }
    }

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/20" style={{ zIndex: Z.DRAWER }} onClick={onClose} aria-hidden />
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-[440px] bg-white dark:bg-surface-card border-l border-k-border-primary shadow-2xl flex flex-col" style={{ zIndex: Z.DRAWER }}>
                <div className="flex items-center gap-2 px-4 h-14 border-b border-k-border-subtle flex-shrink-0">
                    <AssistantMark className="w-5 h-5 text-violet-500" />
                    <h3 className="font-bold text-[#1C1C1E] dark:text-white text-sm flex-1 truncate">IA · {studentName}</h3>
                    <button onClick={onUseForm} className="text-[11px] font-medium text-k-text-tertiary hover:text-violet-500 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-violet-500/10 transition-colors">
                        <FileText className="w-3.5 h-3.5" /> usar formulário
                    </button>
                    <button onClick={onClose} aria-label="Fechar" className="p-1.5 text-k-text-tertiary hover:text-k-text-primary rounded-lg hover:bg-glass-bg-active transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {messages.length === 0 && (
                        <div className="space-y-4">
                            <p className="text-sm text-k-text-secondary">
                                Vou montar o programa do <strong>{studentName}</strong> aqui no canvas, ao vivo. Escolha um ponto de partida ou me diga o que quer:
                            </p>
                            <div>
                                <p className="text-[11px] font-bold text-k-text-quaternary uppercase mb-1.5">Objetivo</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {GOALS.map(g => (
                                        <button key={g} onClick={() => setGoal(g)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${goal === g ? 'bg-violet-600 text-white border-violet-600' : 'border-k-border-subtle text-k-text-secondary hover:border-violet-400'}`}>
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-k-text-quaternary uppercase mb-1.5">Dias</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {DAYS.map(d => (
                                        <button key={d.key} onClick={() => toggleDay(d.key)}
                                            className={`w-10 py-1.5 rounded-lg text-xs font-bold border transition-colors ${days.includes(d.key) ? 'bg-violet-600 text-white border-violet-600' : 'border-k-border-subtle text-k-text-secondary hover:border-violet-400'}`}>
                                            {d.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-glass-bg text-k-text-primary'}`}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {progress && (
                        <div className="flex items-center gap-2 text-xs text-k-text-tertiary">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress}
                        </div>
                    )}
                </div>

                <div className="border-t border-k-border-subtle p-3 flex-shrink-0">
                    <div className="flex items-end gap-2">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            rows={1}
                            placeholder={messages.length === 0 ? 'Ex.: ênfase em glúteo e posterior…' : 'Ajuste: "troca agachamento por leg press"…'}
                            className="flex-1 resize-none rounded-xl border border-k-border-subtle bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-400 max-h-32"
                        />
                        <button onClick={() => void send()} disabled={sending}
                            className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white flex items-center gap-1.5 text-sm font-bold transition-colors">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {messages.length === 0 ? 'Gerar' : ''}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
