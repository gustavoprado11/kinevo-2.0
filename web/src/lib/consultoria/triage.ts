// Engine de triagem de risco da Consultoria IA (determinística, zero LLM).
//
// Lê as respostas da "Avaliação Inicial" (form_templates.system_key =
// 'initial_assessment', migration 065 — inclui os 7 itens PAR-Q) e classifica:
//   🔴 red    → contraindicação: NENHUM rascunho é gerado; conduta manual +
//               liberação médica (PARADA do loop — PLANO.md §5.1 estágio 1)
//   🟡 yellow → sinais de alerta: gera rascunho, mas a validação humana exige
//               reconhecimento explícito das flags
//   🟢 green  → segue o fluxo padrão
//
// Regras ancoradas no PAR-Q/ACSM: respostas "sim" nos itens cardiovasculares
// (1-4) são vermelhas; osteoarticular/medicação/outros (5-7) são amarelas.
// A engine é conservadora: PAR-Q incompleto nunca passa verde.

import { type AnswersMap, answerAgeYears, answerString, answerValues, answerYesNo } from './answers'

export type TriageLevel = 'green' | 'yellow' | 'red'

export interface TriageFlag {
    key: string
    severity: 'yellow' | 'red'
    label: string
    detail?: string
}

export interface TriageResult {
    level: TriageLevel
    flags: TriageFlag[]
}

// PAR-Q — itens cuja resposta "sim" é contraindicação (vermelho).
const PARQ_RED: Array<{ id: string; label: string }> = [
    { id: 'parq_heart_condition', label: 'Condição cardíaca diagnosticada (PAR-Q 1)' },
    { id: 'parq_chest_pain_exercise', label: 'Dor no peito durante exercício (PAR-Q 2)' },
    { id: 'parq_chest_pain_recent', label: 'Dor no peito recente em repouso (PAR-Q 3)' },
    { id: 'parq_dizziness', label: 'Tontura ou perda de consciência (PAR-Q 4)' },
]

// PAR-Q — itens cuja resposta "sim" pede atenção reforçada (amarelo).
const PARQ_YELLOW: Array<{ id: string; label: string }> = [
    { id: 'parq_bone_joint', label: 'Problema ósseo/articular que pode piorar com exercício (PAR-Q 5)' },
    { id: 'parq_medication', label: 'Medicação para pressão arterial ou coração (PAR-Q 6)' },
    { id: 'parq_other_reason', label: 'Outro motivo para não praticar atividade física (PAR-Q 7)' },
]

const PAIN_SITES: Array<{ id: string; label: string }> = [
    { id: 'has_lower_back_pain', label: 'lombar' },
    { id: 'has_thoracic_pain', label: 'torácica' },
    { id: 'has_cervical_pain', label: 'cervical' },
]

const LONG_INACTIVITY = new Set(['6m_to_1y', 'over_1y'])

/**
 * Classifica o risco do aluno a partir das respostas da Avaliação Inicial.
 * `today` é injetável para testes determinísticos do cálculo de idade.
 */
export function runTriage(answers: AnswersMap, today: Date = new Date()): TriageResult {
    const flags: TriageFlag[] = []

    // ── PAR-Q vermelho ──
    const missingParq: string[] = []
    for (const q of PARQ_RED) {
        const v = answerYesNo(answers, q.id)
        if (v === true) flags.push({ key: q.id, severity: 'red', label: q.label })
        if (v === null) missingParq.push(q.id)
    }

    // Cirurgia recente (últimos 6 meses, pergunta do template 065) → vermelho.
    if (answerYesNo(answers, 'recent_surgery') === true) {
        flags.push({ key: 'recent_surgery', severity: 'red', label: 'Cirurgia nos últimos 6 meses' })
    }

    // ── PAR-Q amarelo ──
    for (const q of PARQ_YELLOW) {
        const v = answerYesNo(answers, q.id)
        if (v === true) flags.push({ key: q.id, severity: 'yellow', label: q.label })
        if (v === null) missingParq.push(q.id)
    }

    if (missingParq.length > 0) {
        flags.push({
            key: 'parq_incomplete',
            severity: 'yellow',
            label: 'PAR-Q incompleto — revisar com o aluno',
            detail: `Sem resposta: ${missingParq.join(', ')}`,
        })
    }

    // ── Restrições médicas declaradas ──
    if (answerYesNo(answers, 'has_medical_restriction') === true) {
        flags.push({
            key: 'has_medical_restriction',
            severity: 'yellow',
            label: 'Restrição médica declarada',
            detail: answerString(answers, 'medical_restriction_description') ?? undefined,
        })
    }

    // ── Dor crônica ──
    if (answerYesNo(answers, 'has_chronic_pain') === true) {
        const sites = PAIN_SITES
            .filter(s => answerYesNo(answers, s.id) === true)
            .map(s => s.label)
        const description = answerString(answers, 'pain_description')
        const detailParts = [
            sites.length > 0 ? `Região: ${sites.join(', ')}` : null,
            description,
        ].filter((p): p is string => !!p)
        flags.push({
            key: 'has_chronic_pain',
            severity: 'yellow',
            label: 'Dor crônica relatada',
            detail: detailParts.length > 0 ? detailParts.join(' — ') : undefined,
        })
    }

    // ── Retorno após longa inatividade ──
    const inactivity = answerString(answers, 'inactivity_duration')
    if (
        answerYesNo(answers, 'currently_training') === false &&
        inactivity !== null &&
        LONG_INACTIVITY.has(inactivity)
    ) {
        flags.push({
            key: 'long_inactivity',
            severity: 'yellow',
            label: 'Retorno após mais de 6 meses sem treinar',
        })
    }

    // ── Idade ≥ 60 ──
    const age = answerAgeYears(answers, 'birth_date', today)
    if (age !== null && age >= 60) {
        flags.push({
            key: 'age_60_plus',
            severity: 'yellow',
            label: `Idade ${age} anos — atenção a progressão e impacto`,
        })
    }

    const level: TriageLevel = flags.some(f => f.severity === 'red')
        ? 'red'
        : flags.length > 0
            ? 'yellow'
            : 'green'

    return { level, flags }
}

// Extras defensivos: multi_choice não usada hoje na triagem, mas mantida
// exportada para o painel exibir barreiras/objetivos sem reimplementar parsing.
export { answerValues as triageAnswerValues }
