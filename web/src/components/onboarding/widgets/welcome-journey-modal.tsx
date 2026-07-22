'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, Smartphone, Lock, Check, X, ArrowRight } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { updateTrainerModality } from '@/actions/trainer/update-trainer-modality'
import type { TrainerModalityFocus } from '@kinevo/shared/types/onboarding'
import { track } from '@/lib/analytics'
import { WelcomeMobileStep } from './welcome-mobile-step'
import { ModeSwitchMockup } from './mode-switch-mockup'

interface WelcomeJourneyModalProps {
    trainerName: string
    /** Perfil de treino do próprio treinador (trigger 031). CTA final leva ao builder dele. */
    selfStudentId?: string | null
}

const MODALITY_OPTIONS: Array<{ value: Exclude<TrainerModalityFocus, null>; title: string; desc: string }> = [
    { value: 'presencial', title: 'Presencial', desc: 'Sala de Treino e avaliação' },
    { value: 'online', title: 'Online', desc: 'Formulários, Stripe e mensagens' },
    { value: 'ambos', title: 'Os dois', desc: 'Presencial e online' },
]

const TOTAL_STEPS = 5

function initials(name: string): string {
    return (
        name
            .split(/\s+/)
            .filter(Boolean)
            .map((p) => p[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'K'
    )
}

/**
 * Jornada de boas-vindas do treinador (substitui o TrainerProfileBanner + o
 * WelcomeModal antigo). 5 passos num modal central: boas-vindas + modalidade →
 * baixar o app (QR) → login no mobile → alternar Aluno⇄Treinador → "você já é
 * seu primeiro aluno" com CTA que abre o builder do próprio perfil.
 *
 * Filosofia travada: cancelável a qualquer momento (ESC/overlay/X) e nunca
 * reaparece — `completeWelcomeTour()` marca `welcome_tour_completed` no estado
 * aditivo persistido. O tour do menu lateral (`welcome`) fica sob demanda no
 * botão "?" do dashboard; esta jornada NÃO o auto-inicia.
 */
export function WelcomeJourneyModal({ trainerName, selfStudentId }: WelcomeJourneyModalProps) {
    const router = useRouter()
    const isHydrated = useOnboardingStore((s) => s.isHydrated)
    const welcomeCompleted = useOnboardingStore((s) => s.state.welcome_tour_completed)
    const completeWelcomeTour = useOnboardingStore((s) => s.completeWelcomeTour)
    const setModalityFocus = useOnboardingStore((s) => s.setModalityFocus)

    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState(0)
    const [modality, setModality] = useState<Exclude<TrainerModalityFocus, null> | null>(null)

    const firstName = trainerName.split(' ')[0]
    const avatarInitials = useMemo(() => initials(trainerName), [trainerName])

    useEffect(() => {
        if (isHydrated && !welcomeCompleted) {
            const timer = setTimeout(() => setIsOpen(true), 400)
            return () => clearTimeout(timer)
        }
    }, [isHydrated, welcomeCompleted])

    // "Pular"/overlay/X — marca concluído (não reaparece), sem navegar.
    const handleSkipForever = useCallback(() => {
        completeWelcomeTour()
        setIsOpen(false)
    }, [completeWelcomeTour])

    const goTo = useCallback((next: number) => {
        setStep(next)
        track('welcome_journey_step', { step: next + 1 })
    }, [])

    // Passo 0 → persiste a modalidade escolhida (load-bearing p/ checklist e copy
    // dos tours) e avança. Fire-and-forget: não bloqueia a UX no roundtrip.
    const handleContinueFromWelcome = useCallback(() => {
        if (modality) {
            setModalityFocus(modality)
            void updateTrainerModality(modality).catch(() => {})
        }
        goTo(1)
    }, [modality, setModalityFocus, goTo])

    // CTA final — abre o builder do próprio perfil com o flag que auto-inicia o
    // tour do builder após o wizard de preferências.
    const handleBuildFirstProgram = useCallback(() => {
        track('welcome_journey_build_cta')
        completeWelcomeTour()
        setIsOpen(false)
        const target = selfStudentId
            ? `/students/${selfStudentId}/program/new?welcome=1`
            : '/programs/new?welcome=1'
        router.push(target)
    }, [completeWelcomeTour, router, selfStudentId])

    // ESC: passo > 0 volta um passo; passo 0 fecha (skip forever).
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            if (step > 0) setStep((s) => s - 1)
            else handleSkipForever()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, step, handleSkipForever])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-onboarding flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={handleSkipForever}
                        className="absolute inset-0 cursor-pointer bg-black/80 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-k-border-primary bg-surface-card shadow-2xl"
                        role="dialog"
                        aria-label="Boas-vindas ao Kinevo"
                    >
                        <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-blue-500/[0.08] blur-3xl" />

                        {/* Header: progresso + pular/fechar */}
                        <div className="relative z-10 flex items-center justify-between px-8 pt-7">
                            <div className="flex gap-1.5">
                                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                                    <span
                                        key={i}
                                        className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-primary' : 'w-1.5 bg-k-border-primary'}`}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleSkipForever}
                                    className="text-xs font-medium text-muted-foreground/60 underline underline-offset-4 transition-colors hover:text-muted-foreground"
                                >
                                    Pular
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkipForever}
                                    className="rounded-lg p-1.5 text-muted-foreground/40 transition-colors hover:bg-glass-bg hover:text-foreground"
                                    aria-label="Fechar"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="relative z-10 overflow-y-auto px-8 pb-8 pt-5">
                            {step === 0 && (
                                <>
                                    <IconBadge>
                                        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                                            <Dumbbell className="h-9 w-9 text-violet-500 dark:text-violet-400" />
                                        </motion.div>
                                    </IconBadge>
                                    <Title>Vamos testar o Kinevo do jeito que seu aluno vai usar, {firstName}</Title>
                                    <Sub>Em poucos minutos você baixa o app, entra como seu próprio aluno e cria seu primeiro programa. Antes, como você atende?</Sub>
                                    <div className="mt-6 flex gap-2.5">
                                        {MODALITY_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setModality(opt.value)}
                                                className={`flex-1 rounded-xl border p-3 text-left transition-all ${
                                                    modality === opt.value
                                                        ? 'border-violet-500/60 bg-violet-500/[0.06]'
                                                        : 'border-k-border-subtle bg-glass-bg hover:border-violet-500/40 hover:bg-violet-500/5'
                                                }`}
                                            >
                                                <div className="text-sm font-bold text-foreground">{opt.title}</div>
                                                <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <Actions primaryLabel="Continuar" onPrimary={handleContinueFromWelcome} onGhost={handleSkipForever} ghostLabel="Explorar sozinho" />
                                </>
                            )}

                            {step === 1 && (
                                <>
                                    <IconBadge><Smartphone className="h-9 w-9 text-violet-500 dark:text-violet-400" /></IconBadge>
                                    <Title>Baixe o app do Kinevo</Title>
                                    <Sub>Aponte a câmera do celular pro QR pra abrir a loja. É o mesmo app que seus alunos usam pra treinar.</Sub>
                                    <WelcomeMobileStep />
                                    <Actions primaryLabel="Já baixei, continuar" onPrimary={() => goTo(2)} />
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <IconBadge><Lock className="h-9 w-9 text-violet-500 dark:text-violet-400" /></IconBadge>
                                    <Title>Entre com o mesmo login</Title>
                                    <Sub>No app, use exatamente o e-mail e a senha que você usa aqui no web. É a mesma conta.</Sub>
                                    <div className="mt-5 flex justify-center">
                                        <div className="w-full max-w-sm rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                                            <div className="rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2.5 text-sm">
                                                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">E-mail</div>
                                                <div className="font-mono text-k-text-secondary">voce@email.com</div>
                                            </div>
                                            <div className="mt-2.5 rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2.5 text-sm">
                                                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Senha</div>
                                                <div className="font-mono text-k-text-secondary">••••••••••</div>
                                            </div>
                                            <div className="mt-3.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                <Check size={14} /> Mesma conta do web
                                            </div>
                                        </div>
                                    </div>
                                    <Actions primaryLabel="Entrei no app" onPrimary={() => goTo(3)} />
                                </>
                            )}

                            {step === 3 && (
                                <>
                                    <Title>No app você vira seu próprio aluno num toque</Title>
                                    <Sub>
                                        Na aba <span className="font-semibold text-foreground">Mais</span>, toque em{' '}
                                        <span className="font-semibold text-foreground">Modo Aluno</span> pra ver o Kinevo do lado de quem treina.
                                    </Sub>
                                    <div className="mt-5">
                                        <ModeSwitchMockup />
                                    </div>
                                    <p className="mt-3 text-center text-xs text-muted-foreground">
                                        Toque em <span className="font-semibold text-violet-500 dark:text-violet-400">Modo Aluno</span> → vira o app do aluno. Você volta pra Treinador na aba Perfil.
                                    </p>
                                    <Actions primaryLabel="Entendi" onPrimary={() => goTo(4)} />
                                </>
                            )}

                            {step === 4 && (
                                <>
                                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <Check className="h-8 w-8" />
                                    </div>
                                    <Title>Você já é seu primeiro aluno</Title>
                                    <Sub>Criamos seu perfil de treino automaticamente. Prescreva um programa pra você e teste no app — do jeitinho que seu aluno vai receber.</Sub>
                                    <div className="mt-6 flex items-center gap-3.5 rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                                        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">{avatarInitials}</span>
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                                                {trainerName}
                                                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-px text-[10px] font-bold text-violet-600 dark:text-violet-400">Você</span>
                                            </div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">Perfil de treino · acesso de cortesia vitalício</div>
                                        </div>
                                    </div>
                                    <Actions primaryLabel="Criar meu primeiro programa" onPrimary={handleBuildFirstProgram} onGhost={handleSkipForever} ghostLabel="Explorar sozinho" />
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

function IconBadge({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
            {children}
        </div>
    )
}

function Title({ children }: { children: React.ReactNode }) {
    return <h2 className="text-balance text-center text-[22px] font-black tracking-tight text-foreground">{children}</h2>
}

function Sub({ children }: { children: React.ReactNode }) {
    return <p className="mx-auto mt-2.5 max-w-md text-center text-sm leading-relaxed text-muted-foreground">{children}</p>
}

function Actions({
    primaryLabel,
    onPrimary,
    onGhost,
    ghostLabel,
}: {
    primaryLabel: string
    onPrimary: () => void
    onGhost?: () => void
    ghostLabel?: string
}) {
    return (
        <div className="mt-7 flex flex-col items-center gap-3">
            <button
                type="button"
                onClick={onPrimary}
                className="flex items-center gap-2 rounded-control bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 active:scale-[0.98]"
            >
                {primaryLabel}
                <ArrowRight size={16} />
            </button>
            {onGhost && ghostLabel && (
                <button
                    type="button"
                    onClick={onGhost}
                    className="text-xs font-medium text-muted-foreground/60 underline underline-offset-4 transition-colors hover:text-muted-foreground"
                >
                    {ghostLabel}
                </button>
            )}
        </div>
    )
}
