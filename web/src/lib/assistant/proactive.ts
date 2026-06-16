/**
 * Modo proativo do Assistente (Fase C) — briefing diário.
 *
 * NÃO duplica a detecção de alertas: o cron `generate-insights` já produz os
 * insights determinísticos por aluno. Aqui o valor é um RESUMO DO DIA telegráfico
 * — alertas ativos + agenda + pagamentos do dia — gerado pelo motor compartilhado
 * (`runAssistantTurn`, surface 'proactive') a partir do contexto + tools de leitura.
 *
 * Entregue por notificação + push (mesmo canal dos insights). O turno proativo é
 * registrado no trace (surface 'proactive') como qualquer outro.
 *
 * Nota de custo: o briefing consome tokens reais e é contabilizado no uso do
 * treinador (recordAiUsage dentro de runAssistantTurn). É 1 turno/dia e só para
 * quem tem algo a reportar — barato. Um orçamento separado pode vir no futuro.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runAssistantTurn } from '@/lib/assistant/command-engine'

/** Input sintético do briefing (não vem do treinador — é um gatilho do sistema). */
export const BRIEFING_INPUT =
    '[BRIEFING DA MANHÃ] Monte o resumo do dia para o treinador: o que precisa de ' +
    'atenção hoje — alunos sem treinar, alertas ativos, sessões da agenda de hoje e ' +
    'pagamentos vencendo. Use o contexto e as tools de leitura quando precisar. Seja ' +
    'telegráfico: poucos tópicos curtos, cada um com o que merece atenção e a ação ' +
    'sugerida. Não cumprimente. Não execute nenhuma ação sensível.'

export function buildBriefingInput(): string {
    return BRIEFING_INPUT
}

export interface BriefingResult {
    text: string
    credits: number
}

/**
 * Gera o briefing proativo de um treinador via o motor compartilhado.
 * Pressupõe que o caller já filtrou tier/elegibilidade. Ignora qualquer
 * confirmação pendente (proativo nunca confirma — não há humano no loop).
 */
export async function generateBriefing(
    admin: SupabaseClient,
    opts: { trainerId: string; trainerName: string | null },
): Promise<BriefingResult> {
    const turn = await runAssistantTurn({
        admin,
        trainerId: opts.trainerId,
        trainerName: opts.trainerName,
        input: buildBriefingInput(),
        surface: 'proactive',
        periodType: 'month',
    })
    return { text: turn.text.trim(), credits: turn.credits }
}

/**
 * Elegibilidade barata: o treinador tem ao menos 1 insight ativo (algo a reportar).
 * Roda ANTES do tier/LLM para não gastar com quem não tem nada no dia.
 */
export async function hasSomethingToBrief(
    admin: SupabaseClient,
    trainerId: string,
): Promise<boolean> {
    const { count } = await admin
        .from('assistant_insights')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainerId)
        .in('status', ['new', 'read'])
    return (count ?? 0) > 0
}
