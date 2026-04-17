// ============================================================================
// Program Report — Rascunho automático de observações do treinador
// ============================================================================
// Monta um texto em PT-BR a partir do metrics_json. O treinador recebe isso
// pré-populado no campo de observações e edita em cima.
//
// Princípios da v2 (esta versão):
// - Os KPIs já aparecem nos cards do PDF. O rascunho NÃO repete números —
//   ele COMENTA os dados em tom de treinador falando com aluno.
// - Máximo 3-4 parágrafos curtos. Silêncio > ruído: se uma dimensão não tem
//   algo relevante a dizer, a linha não aparece.
// - Vocabulário de conversa ("frequência sólida", "intensidade estável"),
//   não de planilha ("aderência", "PSE 7.9").
// - Quando faz sentido, termina com um próximo passo implícito — é o que
//   um treinador de verdade escreveria.
// - O treinador edita por cima. O objetivo é economizar 80% da digitação,
//   não substituir o julgamento dele.
//
// Se precisar ajustar o tom, mexa aqui, não nos call sites.
// ============================================================================
//
// Exemplo de saída (caso real — 4 semanas, 87.5% de frequência, progressão
// forte em panturrilha, dois exercícios estagnados, PSE estável em ~8,
// volume de panturrilha baixo):
//
//   Frequência sólida essas 4 semanas — sequência completa sem falhas.
//
//   Destaque na evolução da Panturrilha em pé Máquina (de 70kg pra 120kg).
//   Mesa Flexora e Agachamento Smith ficaram parados — se já estão no
//   peso-alvo, mantém; senão, próxima semana tenta subir.
//
//   Panturrilha ficou com volume bem abaixo dos outros grupos — se foi
//   intencional, mantém; senão, vale incluir mais séries no próximo ciclo.

import type { ProgramReportMetrics } from './program-report-service'

export interface BuildDraftOptions {
    /** Programa encerrado? Muda o tempo verbal. */
    isCompleted: boolean
    /** Duração prevista em semanas. Usado pra detectar fim antecipado. */
    durationWeeks: number | null
    /** Nome do aluno — opcional, usado só se ficar natural. */
    studentFirstName?: string | null
}

/**
 * Constrói o rascunho de observações a partir das métricas. Retorna null quando
 * não há nada relevante a dizer (ex.: programa recém-criado sem sessões).
 */
export function buildTrainerNotesDraft(
    m: ProgramReportMetrics,
    opts: BuildDraftOptions,
): string | null {
    const paragraphs: string[] = []

    const freq = buildFrequencyParagraph(m, opts)
    if (freq) paragraphs.push(freq)

    const progression = buildProgressionParagraph(m)
    if (progression) paragraphs.push(progression)

    const intensity = buildIntensityParagraph(m)
    if (intensity) paragraphs.push(intensity)

    const balance = buildBalanceParagraph(m)
    if (balance) paragraphs.push(balance)

    if (paragraphs.length === 0) return null

    // Parágrafos separados por linha em branco — o renderer do PDF quebra com
    // whitespace-pre-wrap, então vira prosa respirável em vez de parede.
    return paragraphs.join('\n\n')
}

// ── Parágrafos ──────────────────────────────────────────────────────────────

/**
 * Frequência: só entra se tem algo qualitativo a dizer. Meio-termo (50–75%)
 * fica de fora — o número do card fala por si.
 */
function buildFrequencyParagraph(
    m: ProgramReportMetrics,
    opts: BuildDraftOptions,
): string | null {
    const f = m.frequency
    if (!f || f.planned_sessions <= 0) return null

    const pct = f.percentage
    const weeksDone = f.weekly_breakdown.filter(w => w > 0).length
    const streak = f.best_streak_weeks
    // Sequência completa = streak cobre todas as semanas com sessão prevista.
    // Se streak === weeksDone e weeksDone >= 2, é sinal de consistência real.
    const fullStreak = streak >= 2 && streak === weeksDone

    // Faixas qualitativas. Sem citar o %.
    if (pct >= 90) {
        const base = opts.isCompleted
            ? `Frequência sólida do começo ao fim`
            : `Frequência sólida essas ${weeksDone} semanas`
        return fullStreak
            ? `${base} — sequência completa sem falhas.`
            : `${base}.`
    }

    if (pct >= 75) {
        return opts.isCompleted
            ? `Boa frequência no programa — sem grandes quebras de ritmo.`
            : `Frequência boa até aqui.`
    }

    // Zona de alerta: abaixo de 50%, a consistência virou o problema principal
    // e precisa ser nomeada direto.
    if (pct < 50) {
        return opts.isCompleted
            ? `Frequência ficou bem abaixo do planejado — vale conversar sobre o que atrapalhou antes de montar o próximo ciclo.`
            : `Frequência tá abaixo do planejado — vale entender o que tá atrapalhando antes de seguir.`
    }

    // 50–75%: silêncio. O card já mostra o número.
    return null
}

/**
 * Progressão: nomeia o maior destaque em carga e chama atenção pros
 * estagnados como DECISÃO pro treinador, não como fato. Número só quando
 * ajuda a dar peso ("+50kg" impressiona), nunca porcentagem junto.
 */
function buildProgressionParagraph(
    m: ProgramReportMetrics,
): string | null {
    const top = m.progression?.top_exercises ?? []
    if (top.length === 0) return null

    const withData = top.filter(e => e.start_weight > 0 || e.end_weight > 0)
    if (withData.length === 0) return null

    const sortedByGain = [...withData].sort((a, b) => b.change_kg - a.change_kg)
    const bestGain = sortedByGain[0]
    const stalled = withData.filter(e => e.change_kg === 0)

    const parts: string[] = []

    // Destaque: só se o ganho foi significativo. <2.5kg é barulho de ajuste
    // de carga semanal, não evolução — não vale a pena mencionar.
    if (bestGain && bestGain.change_kg >= 2.5) {
        const ex = bestGain.exercise_name
        // Ganho grande (>=20% ou >=20kg) merece número. Abaixo disso, só nomeia.
        const isBigGain = bestGain.change_pct >= 20 || bestGain.change_kg >= 20
        if (isBigGain) {
            parts.push(
                `Destaque na evolução de ${ex} (de ${formatKg(bestGain.start_weight)} pra ${formatKg(bestGain.end_weight)})`,
            )
        } else {
            parts.push(`${ex} subiu bem ao longo do programa`)
        }
    }

    // Estagnados: frase que empurra decisão pro treinador. Evita tom de alerta.
    if (stalled.length > 0) {
        const names = stalled.slice(0, 2).map(e => e.exercise_name)
        const nameList =
            stalled.length === 1
                ? names[0]
                : stalled.length === 2
                    ? `${names[0]} e ${names[1]}`
                    : `${names[0]}, ${names[1]} e outros`
        // Plural/singular do verbo.
        const verb = stalled.length === 1 ? 'ficou parado' : 'ficaram parados'
        const decision =
            stalled.length === 1
                ? `se já tá no peso-alvo, mantém; senão, próxima semana tenta subir`
                : `se já estão no peso-alvo, mantém; senão, próxima semana tenta subir`

        // Se já tem destaque, concatena; senão abre a frase sozinha (capitalizada).
        if (parts.length > 0) {
            parts.push(`${nameList} ${verb} — ${decision}.`)
        } else {
            parts.push(`${nameList} ${verb} — ${decision}.`)
        }
    }

    if (parts.length === 0) return null

    // Só destaque: fecha com ponto.
    if (parts.length === 1) {
        return parts[0].endsWith('.') ? parts[0] : parts[0] + '.'
    }

    // Destaque + estagnados: garante ponto no destaque e junta com espaço.
    const first = parts[0].endsWith('.') ? parts[0] : parts[0] + '.'
    return `${first} ${parts[1]}`
}

/**
 * Intensidade (PSE): comenta tendência, não valor. O número tá no card.
 * Só entra se há sinal claro (tendência ou ponto fora).
 */
function buildIntensityParagraph(m: ProgramReportMetrics): string | null {
    const rpe = m.rpe
    if (!rpe || rpe.overall_avg === null) return null

    const weekly = rpe.weekly_avg.filter((v): v is number => typeof v === 'number')
    if (weekly.length < 2) return null

    const last = weekly[weekly.length - 1]
    const prev = weekly[weekly.length - 2]
    const diff = last - prev
    const avg = rpe.overall_avg

    // Subida forte na última semana: sinaliza, mas sem pânico.
    if (diff >= 0.8) {
        return `Intensidade subiu na última semana — vale checar sono e recuperação antes de manter o volume atual.`
    }

    // Queda forte: pode ser recuperação ou desengajamento, treinador decide.
    if (diff <= -0.8) {
        return `Intensidade caiu na última semana — se foi deload planejado, ok; senão, vale perguntar se tá treinando no peso certo.`
    }

    // PSE cronicamente alto (>= 8.5) merece comentário: risco de overreach.
    if (avg >= 8.5) {
        return `Intensidade subjetiva alta e constante — fica de olho em sinais de fadiga acumulada.`
    }

    // PSE cronicamente baixo (< 6): provável que o peso está conservador.
    if (avg < 6) {
        return `Intensidade subjetiva baixa — talvez dê pra subir a carga nos principais.`
    }

    // Tudo normal: silêncio. Não enche o relatório com "tá estável".
    return null
}

/**
 * Desbalanço muscular: só entra quando é dramático (menor grupo <30% da
 * média), e mesmo assim em tom de pergunta — o treinador é quem sabe se foi
 * intencional.
 */
function buildBalanceParagraph(m: ProgramReportMetrics): string | null {
    const total = m.volume?.series_by_muscle_group?.total ?? {}
    const entries = Object.entries(total).filter(
        ([k, v]) => v > 0 && k !== '__unclassified',
    )
    if (entries.length < 4) return null

    entries.sort(([, a], [, b]) => a - b)
    const lowest = entries[0]
    const avg = entries.reduce((s, [, v]) => s + v, 0) / entries.length

    // Só menciona se o desbalanço é grande (<30% da média). Entre 30–50% é
    // variação natural entre priorização de grupos.
    if (lowest[1] >= avg * 0.3) return null

    return `${lowest[0]} ficou com volume bem abaixo dos outros grupos — se foi intencional, mantém; senão, vale incluir mais séries no próximo ciclo.`
}

// ── Formatadores ────────────────────────────────────────────────────────────

function formatKg(v: number): string {
    const rounded = Math.round(v * 10) / 10
    return Number.isInteger(rounded) ? `${rounded}kg` : `${rounded.toFixed(1)}kg`
}
