/**
 * Defaults para os campos da landing pública.
 *
 * Quando um trainer ainda não preencheu uma seção (ex.: ainda não escreveu
 * a FAQ), a landing renderiza esses defaults para nunca aparecer vazia.
 * Quando o trainer salvar, os valores customizados sobrescrevem.
 */

export const DEFAULT_HEADLINE = 'Treine com método.'
export const DEFAULT_HEADLINE_HIGHLIGHT = 'Sem desculpa.'

export const DEFAULT_SUBHEADLINE =
    'Programas pensados pra quem leva o corpo a sério — sem promessas mágicas, sem treino de revista.'

export const DEFAULT_SPECIALIZATIONS: ReadonlyArray<string> = [
    'Hipertrofia',
    'Emagrecimento',
    'Mobilidade',
    'Performance',
]

export interface ProcessStep {
    number: string
    title: string
    body: string
}

export const DEFAULT_PROCESS: ReadonlyArray<ProcessStep> = [
    { number: '01', title: 'Você fala comigo', body: 'Conversa rápida no WhatsApp pra entender objetivos e disponibilidade.' },
    { number: '02', title: 'Avaliação completa', body: 'Anamnese, histórico, fotos e medidas. Tudo pra desenhar o programa certo.' },
    { number: '03', title: 'Programa sob medida', body: 'Treino, mobilidade e cardio prontos no app em até 48h após a avaliação.' },
    { number: '04', title: 'Treine, eu acompanho', body: 'Cada série registrada, cada PR celebrado. Ajustes mensais comigo.' },
]

export interface FaqItem {
    question: string
    answer: string
}

export const DEFAULT_FAQ: ReadonlyArray<FaqItem> = [
    {
        question: 'Como funciona o plano?',
        answer: 'Programa de treino personalizado, app completo, ajustes mensais e acompanhamento próximo.',
    },
    {
        question: 'Preciso ir presencialmente?',
        answer: '100% remoto via app, com videochamadas mensais pra ajuste e revisão.',
    },
    {
        question: 'Posso cancelar quando quiser?',
        answer: 'Sim. Sem fidelidade, sem multa. Mensal, com renovação automática que você desliga quando quiser.',
    },
    {
        question: 'Preciso de academia?',
        answer: 'Adapto pra qualquer estrutura — academia completa, equipamento básico em casa, ou peso corporal.',
    },
]

export const GOAL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'emagrecer', label: 'Emagrecer' },
    { value: 'massa', label: 'Ganhar massa' },
    { value: 'performance', label: 'Performance' },
    { value: 'mobilidade', label: 'Mobilidade' },
    { value: 'saude', label: 'Saúde geral' },
]

export const LEVEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'iniciante', label: 'Iniciante' },
    { value: 'intermediario', label: 'Intermediário' },
    { value: 'avancado', label: 'Avançado' },
]

/* ── Stats type ── */
export interface LandingStats {
    students_count?: number | null
    rating?: number | null
    reviews_count?: number | null
}

/** Testimonial vindo de landing_testimonials JSONB. */
export interface Testimonial {
    name: string
    photo_url?: string | null
    quote: string
    role?: string | null
    goal?: string | null
}
