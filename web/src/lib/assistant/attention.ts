/**
 * Mapeamento visual + prompts dos insights "Precisa de atenção".
 *
 * Extraído de `assistant-home.tsx` (F0) para ser reusado pela home, pelo rail e
 * pela coluna de contexto do aluno (`student-context-panel` / `student-panel-data`).
 * Puro: sem estado, importável tanto por client components quanto por código de
 * servidor (a rota do painel reusa `attentionKind`/`attentionPrompt` para montar
 * o alerta). Nenhuma mudança de comportamento na extração.
 */

import { TrendingDown, TrendingUp, FileText } from 'lucide-react'
import type { AttentionItem } from '@/lib/assistant/home-data'

/**
 * Ordem de severidade dos insights (menor = mais urgente). Fonte única —
 * home-data e student-panel-data importam daqui. Inclui 'critical' (o CHECK da
 * tabela permite, embora nenhum detector emita hoje).
 */
export const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

/** Tipo visual do card de atenção, derivado de insight_key/category do insight. */
export type AttentionKind = 'estagnado' | 'pronto_para_evoluir' | 'nota'

export function attentionKind(item: AttentionItem): AttentionKind {
    // insight_key é o contrato estável. O detector de estagnação grava
    // category='progression' (pré-existente), o que pintaria o card de verde
    // "Pronto p/ evoluir" num aluno ESTAGNADO — a key corrige a leitura.
    if (item.insightKey?.startsWith('stagnation')) return 'estagnado'
    if (item.category === 'progression') return 'pronto_para_evoluir'
    if (item.category === 'suggestion' || item.category === 'summary') return 'nota'
    return 'estagnado' // alert / desconhecido
}

export const KIND_TAG: Record<AttentionKind, { label: string; bg: string; fg: string; icon: typeof TrendingDown }> = {
    estagnado: { label: 'Estagnado', bg: '#FFFBEB', fg: '#B45309', icon: TrendingDown },
    pronto_para_evoluir: { label: 'Pronto p/ evoluir', bg: '#F0FDF4', fg: '#15803D', icon: TrendingUp },
    nota: { label: 'Nota', bg: '#EFF6FF', fg: '#2563EB', icon: FileText },
}

/** Prompt otimizado p/ o card de atenção: contexto do insight + o que produzir. */
export function attentionPrompt(item: AttentionItem): string {
    const ctx = item.studentName ? `${item.studentName}: ${item.title}` : item.title
    const ofWho = item.studentName ? ` de ${item.studentName}` : ''
    switch (attentionKind(item)) {
        case 'pronto_para_evoluir':
            return `Sobre ${ctx}. Analise o histórico recente${ofWho} e proponha uma progressão concreta — quais exercícios, novo alvo de carga/reps/volume e o porquê — para o próximo ciclo.`
        case 'estagnado':
            return `Sobre ${ctx}. Identifique em quais exercícios está o platô e proponha uma estratégia para destravar a evolução (variação de estímulo, deload ou ajuste de volume), com os próximos passos.`
        default:
            return `Sobre ${ctx}. Resuma a situação e recomende o próximo passo.`
    }
}
