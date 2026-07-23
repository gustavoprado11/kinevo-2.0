'use client'

/**
 * Mocks ANIMADOS do hero — telas FIÉIS do produto, portadas do Claude Design
 * (AssistantDash.dc.html / AssistantPhone.dc.html do projeto Kinevo.dc.html).
 * Este é o diferencial da landing: o Assistente montando um programa AO VIVO.
 *
 *  • HeroDashMock  — dashboard do treinador (desktop). Loop: Clássico (4,2s) →
 *    Assistente (home) → digita o pedido → "pensando" → resposta digitada →
 *    prévia do programa → recomeça.
 *  • HeroPhoneMock — o mesmo fluxo no celular (hero ≤820px).
 *
 * A máquina de estados roda num useSequence (async cancelável). Ícones = Lucide
 * React; o sparkle preenchido é SVG inline (fiel ao design).
 */
import { memo, useEffect, useState, type CSSProperties } from 'react'
import {
    LayoutGrid, Users, Megaphone, Calendar, ClipboardList, Wallet, Book, Settings,
    HelpCircle, Search, Bell, Monitor, MessageCircle, Dumbbell, Share2, CreditCard,
    Filter, Eye, ChevronRight, Globe, Zap, Mic, ArrowUp, ChevronDown, Coins, Plus, Check, X,
    type LucideIcon,
} from 'lucide-react'

/* ────────────────────────────── átomos ────────────────────────────── */

function Spark({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block', flexShrink: 0 }}>
            <path d="M9.94 14.06 4 12l5.94-2.06L12 4l2.06 5.94L20 12l-5.94 2.06L12 20z" />
        </svg>
    )
}

function Avatar({ init, size = 36, bg = '#EEF0F3', fg = '#5B6472' }: { init: string; size?: number; bg?: string; fg?: string }) {
    return (
        <div style={{ width: size, height: size, borderRadius: 999, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.34), flexShrink: 0, letterSpacing: '0.02em' }}>
            {init}
        </div>
    )
}

const MONO = 'var(--kv-font-mono)'
const caret = (h: number): CSSProperties => ({ width: 2, height: h, background: 'var(--kv-brand-600)', display: 'inline-block', marginLeft: 1, flexShrink: 0, animation: 'kvblink 1s step-end infinite' })

/* ─────────────────────── máquina de estados (loop) ─────────────────────── */

type Msg =
    | { role: 'user'; text: string }
    | { role: 'assistant'; thinking?: boolean; text?: string; showCard?: boolean }

interface Ctx<S> { set: (u: Partial<S> | ((p: S) => Partial<S>)) => void; sleep: (ms: number) => Promise<void>; alive: () => boolean }

function useSequence<S>(initial: S, loop: (ctx: Ctx<S>) => Promise<void>): S {
    const [state, setState] = useState<S>(initial)
    useEffect(() => {
        let alive = true
        const timers = new Set<ReturnType<typeof setTimeout>>()
        const sleep = (ms: number) => new Promise<void>((res) => { const id = setTimeout(() => { timers.delete(id); res() }, ms); timers.add(id) })
        const set = (u: Partial<S> | ((p: S) => Partial<S>)) => {
            if (!alive) return
            setState((prev) => ({ ...prev, ...(typeof u === 'function' ? (u as (p: S) => Partial<S>)(prev) : u) }))
        }
        const ctx: Ctx<S> = { set, sleep, alive: () => alive }
        // Inicia num microtask: sem setState síncrono no effect e sem depender de
        // rAF (que pausa em aba de fundo e deixaria o mock sem montar/animar).
        queueMicrotask(async () => { while (alive) await loop(ctx) })
        return () => { alive = false; timers.forEach(clearTimeout) }
    }, [initial, loop])
    return state
}

/* ─────────────────────────── dados do dashboard ─────────────────────────── */

type NavRow = [LucideIcon | 'spark', string, boolean?, boolean?]
const CLASSIC_NAV: NavRow[] = [
    [LayoutGrid, 'Dashboard', true], [Users, 'Alunos'], [Megaphone, 'Marketing'], [Calendar, 'Agenda'],
    [ClipboardList, 'Formulários e Avaliações'], [Wallet, 'Financeiro'], ['spark', 'Assistente IA'],
    [Book, 'Bibliotecas', false, true], [Settings, 'Configurações'],
]
const QUICK: [LucideIcon, string][] = [
    [Users, 'Novo aluno'], [Dumbbell, 'Novo programa'], [ClipboardList, 'Enviar avaliação'],
    [Share2, 'Compartilhar aplicativo'], [CreditCard, 'Vender plano'],
]
type Stat = [string, string, string | null, 'bars' | 'eye' | 'bar' | null]
const STATS: Stat[] = [
    ['ALUNOS ATIVOS', '28', null, null],
    ['TREINOS ESTA SEMANA', '36 / 103', '-44% vs anterior', 'bars'],
    ['RECEITA MENSAL', 'R$ 6.538,00', null, 'eye'],
    ['ADERÊNCIA GERAL', '35%', null, 'bar'],
]
const AK_LIST: [string, string, string, string][] = [
    ['F', 'Felipe Andrade', 'Felipe Andrade sumiu', '40 dias sem registrar treino. Programa parado há semanas.'],
    ['R', 'Renata Almeida', 'Renata Almeida está inativa', '28 dias sem treinar. A adesão caiu drasticamente — vale um contato de reengajamento.'],
    ['P', 'Priscila Gomes', 'Priscila Gomes com pagamento em atraso', 'A mensalidade deste mês não foi paga. Um lembrete gentil costuma resolver.'],
]
const PROGRAMAS: [string, string, string, string][] = [
    ['M', 'Marcelo Pinto', 'Hipertrofia — Upper/Lower 4x · Semana 12/12 · Encerrou', 'Criar próximo'],
    ['M', 'Marina Figueiredo', 'Emagrecimento — Força & Cardio · Semana 12/12 · Termina em 3 dias', 'Renovar'],
    ['T', 'Thiago Nunes', 'Hipertrofia — Upper/Lower 4x · Semana 12/12 · Termina em 3 dias', 'Renovar'],
    ['T', 'Tatiane Rocha', 'Hipertrofia — Upper/Lower 4x · Semana 12/12 · Termina em 3 dias', 'Renovar'],
    ['F', 'Felipe Andrade', 'Full Body — Adaptação · Semana 8/8 · Termina em 5 dias', 'Renovar'],
]
const ATTENTION: [string, string, string, 'amber' | 'green', string][] = [
    ['FA', 'Felipe Andrade', 'ESTAGNADO', 'amber', 'Felipe Andrade sumiu'],
    ['RA', 'Renata Almeida', 'ESTAGNADO', 'amber', 'Renata Almeida está inativa'],
    ['PG', 'Priscila Gomes', 'ESTAGNADO', 'amber', 'Priscila Gomes com pagamento em atraso'],
    ['IN', 'Isabela Nogueira', 'PRONTO P/ EVOLUIR', 'green', 'Isabela Nogueira pronta para evoluir'],
    ['MP', 'Marcelo Pinto', 'ESTAGNADO', 'amber', 'Programa de Marcelo Pinto expirou'],
    ['RT', 'Rafael Torres', 'PRONTO P/ EVOLUIR', 'green', 'Rafael Torres pronto para progredir'],
]
const STUDENTS: [string, string, string?, string?][] = [
    ['AR', 'Amanda Ribeiro'], ['AB', 'Ana Beatriz Ramos'], ['AL', 'André Luiz Ferraz'], ['BC', 'Beatriz Cardoso'],
    ['BC', 'Bruno Carvalho'], ['CF', 'Camila Ferreira'], ['CM', 'Carla Menezes'], ['DS', 'Diego Santana'],
    ['FA', 'Felipe Andrade', 'alert', 'Felipe Andrade sumiu'], ['FD', 'Fernanda Dias'], ['GA', 'Gustavo Almeida'], ['HL', 'Helena Lima'],
]
const PROGRAM_DASH = {
    name: 'Hipertrofia — Full 3x · Raquel Souza',
    weeks: 8,
    sessions: [
        { name: 'Treino A — Peito & Tríceps', days: 'Seg', items: [['Supino reto com halteres', '4×8-12 · 90s'], ['Supino inclinado (barra)', '3×10 · 75s'], ['Crucifixo na máquina', '3×12 · 60s'], ['Tríceps na corda', '3×12 · 60s']] },
        { name: 'Treino B — Costas & Bíceps', days: 'Qua', items: [['Puxada frontal', '4×8-10 · 90s'], ['Remada curvada', '3×10 · 75s'], ['Rosca direta', '3×10 · 60s'], ['Rosca martelo', '3×12 · 45s']] },
        { name: 'Treino C — Pernas', days: 'Sex', items: [['Agachamento livre', '4×6-8 · 2min'], ['Leg press 45°', '3×10 · 90s'], ['Cadeira extensora', '3×12 · 60s'], ['Panturrilha em pé', '4×15 · 45s']] },
    ],
}
const Q_DASH = 'Monte um programa de treino para a Raquel considerando o histórico e o objetivo dela.'
const A_DASH = 'Com base no histórico da Raquel — foco em hipertrofia, 3x por semana, nível intermediário — montei esta prévia de programa. Nada foi criado ainda: revise os treinos e ative quando quiser.'

interface DashState { mode: 'classic' | 'assistant'; phase: 'home' | 'chat'; typed: string; thread: Msg[] }
const DASH_INIT: DashState = { mode: 'classic', phase: 'home', typed: '', thread: [] }

async function dashLoop({ set, sleep, alive }: Ctx<DashState>) {
    set({ mode: 'classic', phase: 'home', typed: '', thread: [] }); await sleep(4200); if (!alive()) return
    set({ mode: 'assistant', phase: 'home', typed: '', thread: [] }); await sleep(2000)
    for (let i = 1; i <= Q_DASH.length; i++) { if (!alive()) return; set({ typed: Q_DASH.slice(0, i) }); await sleep(30) }
    await sleep(550)
    set({ phase: 'chat', typed: '', thread: [{ role: 'user', text: Q_DASH }] }); await sleep(650)
    set((s) => ({ thread: [...s.thread, { role: 'assistant', thinking: true }] })); await sleep(1550)
    set((s) => ({ thread: [...s.thread.slice(0, -1), { role: 'assistant', text: '', showCard: false }] }))
    for (let i = 1; i <= A_DASH.length; i++) {
        if (!alive()) return
        set((s) => { const t = s.thread.slice(); t[t.length - 1] = { ...t[t.length - 1], text: A_DASH.slice(0, i) }; return { thread: t } }); await sleep(13)
    }
    await sleep(400)
    set((s) => { const t = s.thread.slice(); t[t.length - 1] = { ...(t[t.length - 1] as Extract<Msg, { role: 'assistant' }>), showCard: true }; return { thread: t } }); await sleep(6200)
}

/* ─────────────────────────── peças do dashboard ─────────────────────────── */

function ThinkingDots({ size = 7 }: { size?: number }) {
    return (
        <div style={{ display: 'flex', gap: size - 2, padding: '6px 2px' }}>
            {[0, 1, 2].map((d) => <span key={d} style={{ width: size, height: size, borderRadius: 999, background: 'var(--kv-brand-400)', display: 'inline-block', animation: `kvdot 1.1s ${d * 0.15}s infinite ease-in-out` }} />)}
        </div>
    )
}

function ClassicSidebar() {
    const seg = (active: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 13.5, fontWeight: 600, ...(active ? { background: '#fff', color: 'var(--kv-text-primary)', boxShadow: 'var(--kv-shadow-xs)' } : { color: 'var(--kv-text-tertiary)' }) })
    return (
        <>
            <div style={{ display: 'flex', gap: 4, background: 'var(--kv-neutral-100)', borderRadius: 11, padding: 4, margin: '14px 0' }}>
                <div style={seg(true)}><LayoutGrid size={15} /> Clássico</div>
                <div style={seg(false)}><Spark size={15} color="var(--kv-text-tertiary)" /> Assistente</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {CLASSIC_NAV.map(([icon, label, active, chev]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 10, fontSize: 14, fontWeight: active ? 600 : 500, color: active ? 'var(--kv-text-primary)' : 'var(--kv-text-secondary)', background: active ? 'var(--kv-neutral-100)' : 'transparent' }}>
                        {icon === 'spark'
                            ? <Spark size={18} color={active ? 'var(--kv-brand-600)' : 'var(--kv-text-secondary)'} />
                            : (() => { const I = icon; return <I size={18} color={active ? 'var(--kv-text-primary)' : 'var(--kv-text-secondary)'} strokeWidth={1.5} /> })()}
                        <span style={{ flex: 1 }}>{label}</span>
                        {chev ? <ChevronRight size={15} color="var(--kv-text-tertiary)" strokeWidth={1.5} /> : null}
                    </div>
                ))}
            </div>
        </>
    )
}

function AssistantSidebar() {
    const seg = (active: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 13.5, fontWeight: 600, ...(active ? { background: '#fff', color: 'var(--kv-text-primary)', boxShadow: 'var(--kv-shadow-xs)' } : { color: 'var(--kv-text-tertiary)' }) })
    const tab = (label: string, count: string, active: boolean) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: active ? 'var(--kv-text-primary)' : 'var(--kv-text-tertiary)', background: active ? '#fff' : 'transparent', boxShadow: active ? 'var(--kv-shadow-xs)' : 'none' }}>
            {label}<span style={{ fontSize: 12, color: 'var(--kv-text-tertiary)' }}>{count}</span>
        </div>
    )
    return (
        <>
            <div style={{ display: 'flex', gap: 4, background: 'var(--kv-neutral-100)', borderRadius: 11, padding: 4, margin: '14px 0' }}>
                <div style={seg(false)}><LayoutGrid size={15} color="var(--kv-text-tertiary)" /> Clássico</div>
                <div style={seg(true)}><Spark size={15} color="var(--kv-brand-600)" /> Assistente</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'var(--kv-brand-700)' }}>
                    <Plus size={18} color="var(--kv-brand-600)" strokeWidth={2} /><span style={{ flex: 1 }}>Nova conversa</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'var(--kv-text-secondary)' }}>
                    <LayoutGrid size={18} color="var(--kv-text-secondary)" strokeWidth={1.5} /><span style={{ flex: 1 }}>Ir para...</span><ChevronRight size={15} color="var(--kv-text-tertiary)" strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--kv-text-tertiary)', textTransform: 'uppercase', padding: '14px 10px 8px' }}>Conversas &amp; alunos</div>
                <div style={{ display: 'flex', gap: 4, background: 'var(--kv-neutral-100)', borderRadius: 10, padding: 3, marginBottom: 10 }}>{tab('Alunos', '31', true)}{tab('Conversas', '3', false)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--kv-neutral-50)', border: '1px solid var(--kv-border-subtle)', borderRadius: 10, padding: '9px 12px', color: 'var(--kv-text-tertiary)', fontSize: 13, marginBottom: 8 }}>
                    <Search size={15} color="var(--kv-text-tertiary)" strokeWidth={1.5} /> Buscar aluno...
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
                    {STUDENTS.map((s) => (
                        <div key={s[1] + s[0]} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 8px', borderRadius: 10 }}>
                            <Avatar init={s[0]} size={34} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{s[1]}</div>
                                {s[3] ? <div style={{ fontSize: 12, color: 'var(--kv-text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s[3]}</div> : null}
                            </div>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: s[2] === 'alert' ? 'var(--kv-warning)' : 'var(--kv-success)', flexShrink: 0 }} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}

// Memoizado: mode estavel durante a digitacao, evita re-render dos ~30 icones da
// sidebar por caractere (que travava o typing).
const Sidebar = memo(function Sidebar({ mode }: { mode: 'classic' | 'assistant' }) {
    return (
        <aside style={{ background: 'var(--kv-surface-sidebar)', borderRight: '1px solid var(--kv-border-subtle)', padding: '20px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ height: 6 }} />
            {mode === 'classic' ? <ClassicSidebar /> : <AssistantSidebar />}
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--kv-border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar init="PA" size={36} bg="var(--kv-brand-soft)" fg="var(--kv-brand-700)" />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Pedro Andrade</div>
                    <div style={{ fontSize: 11, color: 'var(--kv-text-tertiary)' }}>pedro.demo@kinevo.app</div>
                </div>
            </div>
        </aside>
    )
})

function IconBtn({ icon: Icon, badge }: { icon: LucideIcon; badge?: string }) {
    return (
        <div style={{ position: 'relative', width: 32, height: 32, borderRadius: 9, background: '#fff', border: '1px solid var(--kv-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kv-text-secondary)', flexShrink: 0 }}>
            <Icon size={16} color="var(--kv-text-secondary)" strokeWidth={1.5} />
            {badge ? <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: 'var(--kv-error)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
        </div>
    )
}

function TopBtn({ icon, label, primary }: { icon: LucideIcon | 'spark'; label: string; primary?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, ...(primary ? { background: 'var(--kv-brand-600)', color: '#fff', boxShadow: 'var(--kv-shadow-brand-sm)' } : { background: '#fff', color: 'var(--kv-text-primary)', border: '1px solid var(--kv-border-subtle)' }) }}>
            {icon === 'spark'
                ? <Spark size={15} color={primary ? '#fff' : 'var(--kv-brand-600)'} />
                : (() => { const I = icon; return <I size={15} color={primary ? '#fff' : 'var(--kv-text-secondary)'} strokeWidth={1.5} /> })()}
            {label}
        </div>
    )
}

function StatCard({ s }: { s: Stat }) {
    const [label, value, delta, kind] = s
    const [head, tail] = value.includes(' / ') ? value.split(' / ') : [value, null]
    return (
        <div style={{ background: '#fff', border: '1px solid var(--kv-border-subtle)', borderRadius: 16, padding: '15px 17px', boxShadow: 'var(--kv-shadow-sm)', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--kv-text-tertiary)', textTransform: 'uppercase' }}>{label}</div>
                {kind === 'eye' ? <div style={{ marginLeft: 'auto' }}><Eye size={14} color="var(--kv-text-quaternary)" strokeWidth={1.5} /></div> : null}
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span>{head}</span>
                {tail ? <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--kv-text-tertiary)' }}>/ {tail}</span> : null}
                {delta ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--kv-warning)' }}>{delta}</span> : null}
            </div>
            {kind === 'bars' ? (
                <div style={{ display: 'flex', gap: 5, marginTop: 11 }}>
                    {[1, 1, 1, 0, 0, 0, 0].map((v, i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 3, background: v ? 'var(--kv-neutral-400)' : 'var(--kv-neutral-150)' }} />)}
                </div>
            ) : null}
            {kind === 'bar' ? (
                <div style={{ height: 6, borderRadius: 3, background: 'var(--kv-neutral-150)', marginTop: 13, overflow: 'hidden' }}>
                    <div style={{ width: '35%', height: '100%', background: 'var(--kv-warning)', borderRadius: 3 }} />
                </div>
            ) : null}
        </div>
    )
}

const ClassicMain = memo(function ClassicMain() {
    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
                <div style={{ flexShrink: 0 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, whiteSpace: 'nowrap' }}>Boa noite, Pedro</h1>
                    <div style={{ fontSize: 13, color: 'var(--kv-text-secondary)', marginTop: 2, whiteSpace: 'nowrap' }}>Quarta-feira, 22 de julho</div>
                </div>
                <div style={{ flex: 1, minWidth: 12 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                    <IconBtn icon={HelpCircle} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid var(--kv-border-subtle)', borderRadius: 10, padding: '8px 11px', width: 148, color: 'var(--kv-text-tertiary)', fontSize: 13, flexShrink: 0 }}>
                        <Search size={14} color="var(--kv-text-tertiary)" strokeWidth={1.5} /> Buscar
                        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, background: 'var(--kv-neutral-100)', padding: '2px 6px', borderRadius: 5 }}>⌘K</span>
                    </div>
                    <IconBtn icon={Bell} badge="9+" />
                    <TopBtn icon="spark" label="Assistente" />
                    <TopBtn icon={MessageCircle} label="Mensagens" />
                    <TopBtn icon={Monitor} label="Sala de Treino" primary />
                </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {QUICK.map(([Icon, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 11, background: '#fff', border: '1px solid var(--kv-border-subtle)', fontSize: 13, fontWeight: 600, boxShadow: 'var(--kv-shadow-xs)', whiteSpace: 'nowrap' }}>
                        <Icon size={16} color="var(--kv-text-secondary)" strokeWidth={1.5} /> {label}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--kv-text-tertiary)', fontWeight: 600 }}>
                    <Filter size={14} color="var(--kv-text-tertiary)" strokeWidth={1.5} /> Personalizar
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
                {STATS.map((s) => <StatCard key={s[0]} s={s} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid var(--kv-border-subtle)', borderRadius: 20, boxShadow: 'var(--kv-shadow-sm)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '15px 18px', borderBottom: '1px solid var(--kv-border-subtle)' }}>
                        <Spark size={16} color="var(--kv-brand-600)" />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--kv-text-tertiary)', textTransform: 'uppercase' }}>Assistente Kinevo</span>
                        <span style={{ fontSize: 11, color: 'var(--kv-text-tertiary)' }}>20</span>
                    </div>
                    {AK_LIST.map((a, i) => (
                        <div key={i} style={{ padding: '15px 18px', borderBottom: i < AK_LIST.length - 1 ? '1px solid var(--kv-border-subtle)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <Avatar init={a[0]} size={34} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{a[1]}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--kv-error)' }}>ALERTA</span>
                                        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--kv-error)' }} />
                                    </div>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{a[2]}</div>
                                    <div style={{ fontSize: 13, color: 'var(--kv-text-tertiary)', marginTop: 3, lineHeight: 1.45 }}>{a[3]}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--kv-text-secondary)', border: '1px solid var(--kv-border-subtle)', padding: '6px 12px', borderRadius: 9 }}>
                                            <MessageCircle size={14} color="var(--kv-text-secondary)" strokeWidth={1.5} /> Mensagem
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kv-brand-700)' }}>Analisar ›</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--kv-border-subtle)', borderRadius: 20, boxShadow: 'var(--kv-shadow-sm)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '15px 18px', borderBottom: '1px solid var(--kv-border-subtle)' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--kv-text-tertiary)', textTransform: 'uppercase' }}>Programas encerrando</span>
                        <span style={{ fontSize: 11, color: 'var(--kv-text-tertiary)' }}>5</span>
                    </div>
                    {PROGRAMAS.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < PROGRAMAS.length - 1 ? '1px solid var(--kv-border-subtle)' : 'none' }}>
                            <Avatar init={p[0]} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{p[1]}</div>
                                <div style={{ fontSize: 12, color: 'var(--kv-text-tertiary)', marginTop: 2 }}>{p[2]}</div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kv-brand-700)', whiteSpace: 'nowrap' }}>{p[3]} →</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
})

function Composer({ typed, active }: { typed: string; active: boolean }) {
    const pill = (Icon: LucideIcon, label: string, violet?: boolean) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 9999, border: '1px solid var(--kv-border-subtle)', background: '#fff', fontSize: 13.5, fontWeight: 600, color: 'var(--kv-text-secondary)' }}>
            <Icon size={15} color={violet ? 'var(--kv-brand-600)' : 'var(--kv-text-secondary)'} strokeWidth={1.6} />{label}<ChevronDown size={14} color="var(--kv-text-tertiary)" strokeWidth={1.6} />
        </div>
    )
    return (
        <div style={{ border: '1px solid var(--kv-border-default)', background: '#fff', borderRadius: 18, padding: 18, boxShadow: 'var(--kv-shadow-sm)' }}>
            <div style={{ fontSize: 16, lineHeight: 1.5, color: typed ? 'var(--kv-text-primary)' : 'var(--kv-text-tertiary)', minHeight: 26, display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {typed
                    ? <><span style={{ whiteSpace: 'pre-wrap' }}>{typed}</span>{active && <span style={caret(20)} />}</>
                    : <><span>Diga o que fazer no Kinevo — ou escolha um aluno...</span>{active && <span style={{ ...caret(20), marginLeft: 2 }} />}</>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
                {pill(Globe, 'Geral')}{pill(Zap, 'Agir', true)}
                <div style={{ flex: 1 }} />
                <div style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mic size={18} color="var(--kv-text-tertiary)" strokeWidth={1.6} /></div>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--kv-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--kv-shadow-brand-sm)' }}><ArrowUp size={18} color="#fff" strokeWidth={2} /></div>
            </div>
        </div>
    )
}

const DashProgramCard = memo(function DashProgramCard() {
    const p = PROGRAM_DASH
    const actBtn = (Icon: LucideIcon, label: string, style: CSSProperties, sw = 1.8) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, ...style }}>
            <Icon size={14} color={(style.color as string) || 'var(--kv-text-secondary)'} strokeWidth={sw} />{label}
        </div>
    )
    return (
        <div style={{ maxWidth: 560, border: '1px solid var(--kv-border-subtle)', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--kv-shadow-md)', animation: 'kvfadeup .45s var(--kv-ease-out) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--kv-border-subtle)', padding: '13px 16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--kv-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--kv-shadow-brand-sm)' }}><Spark size={16} color="#fff" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B45309', marginTop: 3 }}>Prévia — nada foi criado ainda</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--kv-text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{p.sessions.length} treinos · {p.weeks} sem</div>
            </div>
            {p.sessions.map((s, si) => (
                <div key={si} style={{ padding: '12px 16px', borderTop: si > 0 ? '1px solid var(--kv-border-subtle)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <b style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</b>
                        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--kv-text-tertiary)', flexShrink: 0 }}>{s.days}</span>
                    </div>
                    <ul style={{ listStyle: 'none', margin: '7px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {s.items.map((it, ii) => (
                            <li key={ii} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                                <span style={{ minWidth: 0, color: 'var(--kv-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it[0]}</span>
                                <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 11, color: 'var(--kv-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{it[1]}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            <div style={{ borderTop: '1px solid var(--kv-border-subtle)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {actBtn(Check, 'Salvar rascunho', { background: 'var(--kv-brand-600)', color: '#fff', boxShadow: 'var(--kv-shadow-brand-sm)' }, 2.4)}
                    {actBtn(Zap, 'Ativar agora', { border: '1px solid var(--kv-border-default)', color: 'var(--kv-text-secondary)' }, 2)}
                    <div style={{ marginLeft: 'auto' }}>{actBtn(X, 'Descartar', { color: 'var(--kv-text-tertiary)', fontWeight: 500, padding: '7px 8px' }, 2.2)}</div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: 'var(--kv-text-quaternary)' }}>Quer ajustar algo? Responda na conversa (ex.: “troca o supino por crucifixo”) que eu refaço a prévia.</div>
            </div>
        </div>
    )
})

// Memoizada: nao depende de typed, evita reprocessar os 6 cards por tecla.
const AttentionList = memo(function AttentionList() {
    return (
        <div style={{ background: '#fff', border: '1px solid var(--kv-border-subtle)', borderRadius: 18, boxShadow: 'var(--kv-shadow-sm)', overflow: 'hidden' }}>
            {ATTENTION.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: i < ATTENTION.length - 1 ? '1px solid var(--kv-border-subtle)' : 'none' }}>
                    <Avatar init={a[0]} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{a[1]}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', color: a[3] === 'green' ? 'var(--kv-success)' : '#B45309' }}>{a[2]}</span>
                        </div>
                        <div style={{ fontSize: 13.5, color: 'var(--kv-text-tertiary)', marginTop: 2 }}>{a[4]}</div>
                    </div>
                    <ChevronRight size={18} color="var(--kv-text-quaternary)" strokeWidth={1.5} />
                </div>
            ))}
        </div>
    )
})

function AssistantHome({ typed }: { typed: string }) {
    return (
        <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Spark size={42} color="var(--kv-brand-600)" /></div>
                <div style={{ fontSize: 15, color: 'var(--kv-text-secondary)', marginBottom: 8 }}>Boa noite, Pedro.</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--kv-text-primary)' }}>O que vamos resolver hoje?</div>
            </div>
            <Composer typed={typed} active />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12, fontSize: 13, color: 'var(--kv-text-tertiary)' }}>
                <Coins size={15} color="var(--kv-text-tertiary)" strokeWidth={1.6} /><strong style={{ color: 'var(--kv-text-secondary)', fontWeight: 700 }}>1.000</strong> de 1.000 créditos
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--kv-text-tertiary)', textTransform: 'uppercase', margin: '30px 0 12px' }}>Precisa de atenção <span style={{ color: 'var(--kv-warning)' }}>6</span></div>
            <AttentionList />
        </div>
    )
}

function AssistantChat({ thread }: { thread: Msg[] }) {
    return (
        <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {thread.map((m, i) => {
                if (m.role === 'user') return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', animation: 'kvfadeup .3s var(--kv-ease-out) both' }}>
                        <div style={{ background: 'var(--kv-brand-600)', color: '#fff', borderRadius: '16px 5px 16px 16px', padding: '12px 16px', fontSize: 15, lineHeight: 1.5, maxWidth: 440, boxShadow: 'var(--kv-shadow-brand-sm)' }}>{m.text}</div>
                    </div>
                )
                return (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'kvfadeup .4s var(--kv-ease-out) both' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--kv-gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(124,58,237,.3)' }}><Spark size={16} color="#fff" /></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                            <div style={{ background: '#fff', border: '1px solid var(--kv-border-subtle)', borderRadius: '5px 16px 16px 16px', padding: '13px 16px', fontSize: 15, lineHeight: 1.6, color: 'var(--kv-text-primary)', maxWidth: 520, boxShadow: 'var(--kv-shadow-sm)' }}>
                                {m.thinking ? <ThinkingDots /> : <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>}
                            </div>
                            {m.showCard ? <DashProgramCard /> : null}
                        </div>
                    </div>
                )
            })}
            <Composer typed="" active={false} />
        </div>
    )
}

export function HeroDashMock() {
    const { mode, phase, typed, thread } = useSequence<DashState>(DASH_INIT, dashLoop)
    return (
        <div style={{ height: '100%', minHeight: 940, background: 'var(--kv-surface-canvas)', fontFamily: 'var(--kv-font-sans)', color: 'var(--kv-text-primary)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '318px 1fr', height: '100%', minHeight: 940 }}>
                <Sidebar mode={mode} />
                <main style={{ padding: mode === 'assistant' ? '40px 40px 28px' : '26px 34px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {mode === 'classic'
                        ? <ClassicMain />
                        : phase === 'chat' ? <AssistantChat thread={thread} /> : <AssistantHome typed={typed} />}
                </main>
            </div>
        </div>
    )
}

/* ─────────────────────────── Assistente (mobile) ─────────────────────────── */

const PHONE_PROGRAM = {
    name: 'Hipertrofia 3x · Raquel',
    sessions: [['A', 'Peito & Tríceps', '4 exercícios'], ['B', 'Costas & Bíceps', '4 exercícios'], ['C', 'Pernas', '4 exercícios']] as const,
}
const Q_PHONE = 'Monta um treino de hipertrofia 3x pra Raquel'
const A_PHONE = 'Rascunhei um Hipertrofia 3x pra Raquel: Peito/Tríceps, Costas/Bíceps e Pernas. Revise e ative quando quiser.'

interface PhoneState { phase: 'home' | 'chat'; typed: string; thread: Msg[] }
const PHONE_INIT: PhoneState = { phase: 'home', typed: '', thread: [] }

async function phoneLoop({ set, sleep, alive }: Ctx<PhoneState>) {
    set({ typed: '', phase: 'home', thread: [] }); await sleep(2000)
    for (let i = 1; i <= Q_PHONE.length; i++) { if (!alive()) return; set({ typed: Q_PHONE.slice(0, i) }); await sleep(45) }
    await sleep(500)
    set({ phase: 'chat', typed: '', thread: [{ role: 'user', text: Q_PHONE }] }); await sleep(600)
    set((s) => ({ thread: [...s.thread, { role: 'assistant', thinking: true }] })); await sleep(1500)
    set((s) => ({ thread: [...s.thread.slice(0, -1), { role: 'assistant', text: '', showCard: false }] }))
    for (let i = 1; i <= A_PHONE.length; i++) {
        if (!alive()) return
        set((s) => { const t = s.thread.slice(); t[t.length - 1] = { ...t[t.length - 1], text: A_PHONE.slice(0, i) }; return { thread: t } }); await sleep(16)
    }
    await sleep(350)
    set((s) => { const t = s.thread.slice(); t[t.length - 1] = { ...(t[t.length - 1] as Extract<Msg, { role: 'assistant' }>), showCard: true }; return { thread: t } }); await sleep(5200)
}

function PhoneProgramCard() {
    const p = PHONE_PROGRAM
    return (
        <div style={{ background: 'var(--kv-surface-card)', border: '1px solid var(--kv-border-subtle)', borderRadius: 15, overflow: 'hidden', boxShadow: 'var(--kv-shadow-sm)', animation: 'kvfadeup .4s var(--kv-ease-out) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderBottom: '1px solid var(--kv-border-subtle)' }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--kv-gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spark size={13} color="#fff" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B45309' }}>Prévia — nada criado</div>
                </div>
            </div>
            <div>
                {p.sessions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderTop: i > 0 ? '1px solid var(--kv-border-subtle)' : 'none' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--kv-brand-soft)', color: 'var(--kv-brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{s[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{s[1]}</div></div>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--kv-text-tertiary)', flexShrink: 0 }}>{s[2]}</span>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '11px 13px', borderTop: '1px solid var(--kv-border-subtle)' }}>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--kv-brand-600)', borderRadius: 10, padding: '9px 0', boxShadow: 'var(--kv-shadow-brand-sm)' }}>Ativar agora</div>
                <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--kv-text-secondary)', border: '1px solid var(--kv-border-default)', borderRadius: 10, padding: '9px 14px' }}>Editar</div>
            </div>
        </div>
    )
}

function PhoneBody({ phase, thread }: { phase: 'home' | 'chat'; thread: Msg[] }) {
    if (phase === 'home') {
        return (
            <div style={{ flex: 1, minHeight: 0, padding: '22px 16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--kv-gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(124,58,237,.35)' }}><Spark size={22} color="#fff" /></div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--kv-text-secondary)' }}>Boa noite, Pedro.</div>
                <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4, lineHeight: 1.15 }}>O que vamos resolver hoje?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 22 }}>
                    {['Montar um treino', 'Quem faltou esta semana?', 'Renovar programas'].map((c) => (
                        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--kv-surface-card)', border: '1px solid var(--kv-border-subtle)', borderRadius: 12, padding: '11px 13px', fontSize: 13, fontWeight: 600, boxShadow: 'var(--kv-shadow-xs)' }}>
                            <Spark size={13} color="var(--kv-brand-600)" />{c}
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    return (
        <div style={{ flex: 1, minHeight: 0, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            {thread.map((m, i) => {
                if (m.role === 'user') return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', animation: 'kvfadeup .3s var(--kv-ease-out) both' }}>
                        <div style={{ background: 'var(--kv-brand-600)', color: '#fff', borderRadius: '15px 5px 15px 15px', padding: '9px 13px', fontSize: 13.5, lineHeight: 1.45, maxWidth: '82%', boxShadow: 'var(--kv-shadow-brand-sm)' }}>{m.text}</div>
                    </div>
                )
                return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'kvfadeup .4s var(--kv-ease-out) both' }}>
                        <div style={{ background: 'var(--kv-surface-card)', border: '1px solid var(--kv-border-subtle)', borderRadius: '5px 15px 15px 15px', padding: '10px 13px', fontSize: 13.5, lineHeight: 1.5, maxWidth: '86%', boxShadow: 'var(--kv-shadow-sm)' }}>
                            {m.thinking ? <ThinkingDots size={6} /> : m.text}
                        </div>
                        {m.showCard ? <PhoneProgramCard /> : null}
                    </div>
                )
            })}
        </div>
    )
}

export function HeroPhoneMock() {
    const { phase, typed, thread } = useSequence<PhoneState>(PHONE_INIT, phoneLoop)
    const active = phase === 'home'
    return (
        <div style={{ position: 'relative', width: 300, height: 610, background: '#0b0a12', borderRadius: 46, padding: 11, boxShadow: '0 30px 70px rgba(9,7,22,.55), 0 0 0 1px rgba(255,255,255,.06)', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', width: 92, height: 26, background: '#000', borderRadius: 20, zIndex: 6 }} />
            <div style={{ width: '100%', height: '100%', background: 'var(--kv-surface-canvas)', borderRadius: 36, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--kv-font-sans)', color: 'var(--kv-text-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px 6px', fontSize: 13, fontWeight: 700 }}>
                    <span>9:41</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--kv-text-primary)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /></svg>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--kv-text-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13a10 10 0 0 1 14 0" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M12 20h.01" /></svg>
                        <div style={{ width: 22, height: 12, borderRadius: 3, border: '1.5px solid var(--kv-text-primary)', padding: 1.5, display: 'flex' }}><div style={{ flex: 1, background: 'var(--kv-text-primary)', borderRadius: 1 }} /></div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 12px', borderBottom: '1px solid var(--kv-border-subtle)', background: 'var(--kv-surface-card)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--kv-gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(124,58,237,.3)' }}><Spark size={15} color="#fff" /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>Assistente</div>
                        <div style={{ fontSize: 11, color: 'var(--kv-text-tertiary)' }}>Kinevo · co-piloto</div>
                    </div>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--kv-neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--kv-text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></svg>
                    </div>
                </div>
                <PhoneBody phase={phase} thread={thread} />
                <div style={{ padding: '10px 12px 8px', borderTop: '1px solid var(--kv-border-subtle)', background: 'var(--kv-surface-card)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--kv-neutral-100)', borderRadius: 9999, padding: '8px 8px 8px 14px' }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: typed ? 'var(--kv-text-primary)' : 'var(--kv-text-tertiary)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                            {typed
                                ? <><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{typed}</span>{active && <span style={caret(15)} />}</>
                                : 'Pergunte ao Assistente…'}
                        </div>
                        <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'var(--kv-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--kv-shadow-brand-sm)' }}><ArrowUp size={16} color="#fff" strokeWidth={2.2} /></div>
                    </div>
                    <div style={{ width: 110, height: 4, borderRadius: 3, background: 'var(--kv-neutral-300)', margin: '10px auto 2px' }} />
                </div>
            </div>
        </div>
    )
}
