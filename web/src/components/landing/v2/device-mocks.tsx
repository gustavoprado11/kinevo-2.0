/**
 * Device mocks da landing — molduras REALISTAS (iPhone com Dynamic Island,
 * Apple Watch com case squircle + coroa digital + alças) e TELAS FIÉIS ao app
 * real (dashboard do treinador + execução no Watch), conforme o ground truth da
 * Fase 0. Renderizados em React e portados para slots no HTML do design.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Wifi, Signal, BatteryFull, Play, Users, Dumbbell, DollarSign, TrendingUp, Heart, Check } from 'lucide-react'

/* ────────────────────────────── iPhone ────────────────────────────── */

export function IPhoneMock({ width = 190, children }: { width?: number; children: ReactNode }) {
    return (
        <div
            style={{
                width,
                aspectRatio: '193 / 400',
                background: 'linear-gradient(145deg,#43434a 0%,#1b1b1f 48%,#2b2b30 100%)',
                borderRadius: 34,
                padding: 5,
                boxShadow: '0 24px 50px rgba(20,10,50,0.36), inset 0 0 0 1.5px rgba(255,255,255,0.10), inset 0 0 0 3.5px #0b0b0d',
                position: 'relative',
            }}
        >
            {/* botões laterais */}
            <span style={{ position: 'absolute', left: -2, top: '23%', width: 3, height: '8%', background: '#3a3a40', borderRadius: 3 }} />
            <span style={{ position: 'absolute', left: -2, top: '34%', width: 3, height: '11%', background: '#3a3a40', borderRadius: 3 }} />
            <span style={{ position: 'absolute', right: -2, top: '30%', width: 3, height: '13%', background: '#3a3a40', borderRadius: 3 }} />
            <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--kv-neutral-100)', borderRadius: 29, overflow: 'hidden' }}>
                {/* Dynamic Island */}
                <div
                    style={{
                        position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)',
                        width: '33%', height: 17, background: '#000', borderRadius: 999, zIndex: 6,
                    }}
                />
                {children}
            </div>
        </div>
    )
}

/** Tela FIEL: dashboard do treinador no mobile (rótulos/seções reais). */
export function MobileDashboardScreen() {
    const kpi = (Icon: typeof Users, label: string, value: string, color: string, bg: string) => (
        <div style={{ background: '#fff', border: '1px solid var(--kv-border-subtle)', borderRadius: 11, padding: '8px 9px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={9} strokeWidth={2} />
                </span>
                <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--kv-text-tertiary)' }}>{label}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--kv-text-primary)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        </div>
    )
    const seg = (txt: string, active: boolean): CSSProperties => ({
        flex: 1, textAlign: 'center', fontSize: 8.5, fontWeight: 700, padding: '5px 0', borderRadius: 8,
        color: active ? 'var(--kv-text-primary)' : 'var(--kv-text-tertiary)',
        background: active ? '#fff' : 'transparent',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    })
    return (
        <div style={{ width: '100%', height: '100%', background: 'var(--kv-neutral-100)', padding: '30px 13px 0', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* status bar */}
            <div style={{ position: 'absolute', top: 9, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, fontWeight: 700, color: 'var(--kv-text-primary)' }}>
                <span>10:21</span>
                <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Signal size={10} strokeWidth={2.4} /><Wifi size={10} strokeWidth={2.4} /><BatteryFull size={13} strokeWidth={2} />
                </span>
            </div>
            {/* header */}
            <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--kv-text-primary)', lineHeight: 1.05 }}>Boa tarde, treinador</div>
                <div style={{ fontSize: 8, color: 'var(--kv-text-tertiary)', marginTop: 2 }}>Sexta-feira · 12 alunos ativos</div>
            </div>
            {/* toggle Clássico / Assistente */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--kv-neutral-200)', borderRadius: 10, padding: 2 }}>
                <span style={seg('Clássico', true)}>Clássico</span>
                <span style={seg('Assistente', false)}>Assistente</span>
            </div>
            {/* Sala de Treino */}
            <div style={{ background: 'linear-gradient(120deg,#7c3aed,#9333ea)', borderRadius: 13, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--kv-shadow-brand-sm)' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={13} color="#fff" fill="#fff" />
                </span>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Sala de Treino</div>
                    <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.82)' }}>Toque para entrar</div>
                </div>
            </div>
            {/* resumo da semana */}
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--kv-text-tertiary)', marginTop: 1 }}>RESUMO DA SEMANA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {kpi(Users, 'ALUNOS', '12', 'var(--kv-brand-600)', 'var(--kv-brand-50)')}
                {kpi(Dumbbell, 'TREINOS', '38', '#16a34a', '#dcfce7')}
                {kpi(DollarSign, 'RECEITA MENSAL', 'R$ 4.200', 'var(--kv-info)', '#eff6ff')}
                {kpi(TrendingUp, 'ADERÊNCIA', '87%', 'var(--kv-warning)', '#fffbeb')}
            </div>
        </div>
    )
}

export const HeroPhone = () => (
    <IPhoneMock width={188}>
        <MobileDashboardScreen />
    </IPhoneMock>
)

/* ──────────────────────────── Apple Watch ──────────────────────────── */

export function AppleWatchMock({ width = 108, children }: { width?: number; children: ReactNode }) {
    const caseW = width
    return (
        <div style={{ width: caseW, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* alça superior */}
            <div style={{ width: '64%', height: caseW * 0.34, background: 'linear-gradient(180deg,#2a2a30,#1a1a1f)', borderRadius: '14px 14px 7px 7px', marginBottom: -caseW * 0.16, boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.3)' }} />
            {/* case */}
            <div
                style={{
                    position: 'relative', width: caseW, aspectRatio: '0.83',
                    background: 'linear-gradient(145deg,#3a3a40,#0b0b0d)',
                    borderRadius: '34%', padding: 4, zIndex: 2,
                    boxShadow: '0 16px 34px rgba(20,10,50,0.4), inset 0 0 0 1px rgba(255,255,255,0.08)',
                }}
            >
                {/* coroa digital */}
                <span style={{ position: 'absolute', right: -3, top: '32%', width: 5, height: '17%', background: 'linear-gradient(90deg,#6a6a72,#26262b)', borderRadius: 3, boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
                {/* botão lateral */}
                <span style={{ position: 'absolute', right: -2, top: '55%', width: 3.5, height: '13%', background: 'linear-gradient(90deg,#4a4a50,#1c1c20)', borderRadius: 2 }} />
                {/* tela OLED */}
                <div style={{ width: '100%', height: '100%', background: '#000', borderRadius: '30%', overflow: 'hidden' }}>
                    {children}
                </div>
            </div>
            {/* alça inferior */}
            <div style={{ width: '64%', height: caseW * 0.34, background: 'linear-gradient(0deg,#2a2a30,#1a1a1f)', borderRadius: '7px 7px 14px 14px', marginTop: -caseW * 0.16, boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.3)' }} />
        </div>
    )
}

/** Tela FIEL: execução de treino no Apple Watch (exercício + carga/reps + bpm). */
export function WatchExerciseScreen({ name, kg, set, reps, bpm }: { name: string; kg: number; set: number; reps: number; bpm: number }) {
    return (
        <div style={{ width: '100%', height: '100%', padding: '11px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.04em' }}>{name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.05, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {kg}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}> kg</span>
            </div>
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>Série {set} · {reps} reps</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
                <Heart size={11} color="#ff4d6d" fill="#ff4d6d" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{bpm}</span>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.55)' }}>bpm</span>
            </div>
        </div>
    )
}

export const HeroWatch = () => (
    <AppleWatchMock width={104}>
        <WatchExerciseScreen name="SUPINO RETO" kg={60} set={3} reps={12} bpm={128} />
    </AppleWatchMock>
)

export const AlunoWatch = () => (
    <AppleWatchMock width={112}>
        <WatchExerciseScreen name="STIFF" kg={50} set={2} reps={10} bpm={132} />
    </AppleWatchMock>
)

/* ─── Tela FIEL: execução do treino (app do aluno) — reproduz ExerciseCard/SetRow reais ─── */

const C2 = '#EFEFF4' // surface.card2 (fundo dos inputs)

function SetRowMock({ n, prev, peso, reps, done, active }: { n: number; prev: string; peso: string; reps: string; done?: boolean; active?: boolean }) {
    const cell: CSSProperties = {
        flex: 1, height: 26, borderRadius: 8, background: done ? 'rgba(124,58,237,0.08)' : C2,
        color: done ? 'var(--kv-brand-600)' : 'var(--kv-text-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        ...(active ? { boxShadow: 'inset 0 0 0 1.5px var(--kv-brand-300)' } : {}),
    }
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 2px', borderRadius: 9, marginBottom: 3, ...(done ? { background: 'rgba(124,58,237,0.06)' } : {}) }}>
            <span style={{ width: 19, height: 19, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, background: done ? 'rgba(124,58,237,0.15)' : C2, color: done ? 'var(--kv-brand-600)' : 'var(--kv-text-tertiary)' }}>{n}</span>
            <span style={{ width: 34, textAlign: 'center', fontSize: 10, color: 'var(--kv-text-quaternary)', fontVariantNumeric: 'tabular-nums' }}>{prev}</span>
            <span style={cell}>{peso}</span>
            <span style={cell}>{reps}</span>
            <span style={{ width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--kv-brand-600)' : C2, flexShrink: 0 }}>
                <Check size={14} color={done ? '#fff' : 'var(--kv-text-quaternary)'} strokeWidth={2.6} />
            </span>
        </div>
    )
}

export function StudentWorkoutScreen() {
    const colHead = (txt: string, w?: number) => (
        <span style={{ ...(w ? { width: w } : { flex: 1 }), textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--kv-text-tertiary)' }}>{txt}</span>
    )
    return (
        <div style={{ width: '100%', height: '100%', background: '#F4F5F8', display: 'flex', flexDirection: 'column' }}>
            {/* top bar: nome do treino + cronômetro (monospace) */}
            <div style={{ paddingTop: 30, paddingBottom: 10, paddingLeft: 14, paddingRight: 14, background: '#fff', borderBottom: '1px solid var(--kv-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--kv-text-primary)' }}>Treino B · Posterior</span>
                <span style={{ fontSize: 12, color: 'var(--kv-text-secondary)', fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace" }}>12:34</span>
            </div>
            <div style={{ padding: '11px 11px 0', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
                {/* card do exercício atual */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '12px 11px', boxShadow: 'var(--kv-shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--kv-text-primary)' }}>Stiff</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--kv-brand-700)', background: 'rgba(124,58,237,0.12)', padding: '2px 8px', borderRadius: 999, letterSpacing: 0.2 }}>2 / 4</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--kv-text-secondary)', marginBottom: 9 }}>4 séries • 10 reps • 90s descanso</div>
                    {/* cabeçalho das colunas */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 2px', marginBottom: 3 }}>
                        {colHead('#', 19)}{colHead('Anterior', 34)}{colHead('Peso')}{colHead('Reps')}<span style={{ width: 26 }} />
                    </div>
                    <SetRowMock n={1} prev="50×10" peso="50" reps="10" done />
                    <SetRowMock n={2} prev="50×10" peso="50" reps="10" done />
                    <SetRowMock n={3} prev="50×10" peso="52" reps="10" active />
                    <SetRowMock n={4} prev="—" peso="kg" reps="" />
                </div>
                {/* próximo exercício (recolhido) */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '11px 11px', boxShadow: 'var(--kv-shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--kv-text-primary)' }}>Mesa flexora</span>
                    <span style={{ fontSize: 11.5, color: 'var(--kv-text-tertiary)' }}>3 séries • 12 reps</span>
                </div>
            </div>
        </div>
    )
}

export const StudentPhone = () => (
    <IPhoneMock width={234}>
        <StudentWorkoutScreen />
    </IPhoneMock>
)
