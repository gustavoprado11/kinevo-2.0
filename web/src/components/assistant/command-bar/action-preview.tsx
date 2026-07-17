'use client'

/**
 * ActionPreview — render do resultado de um turno da barra de comando (Trilha 1).
 *
 * Mostra (espelhando o mock `ai-trainer-mock-commandbar.html`):
 *   - "Ação entendida": o card de confirmação (HITL) quando há um write pausado.
 *   - a resposta da IA (o que foi feito/encontrado nas leituras e writes simples).
 *   - chips das ações já executadas no turno.
 *
 * Só apresentação: a confirmação real é delegada ao ToolConfirmationCard.
 */

import { CheckCircle2 } from 'lucide-react'
import { ToolConfirmationCard } from '@/components/assistant/tool-confirmation-card'
import { executedText } from '@/lib/assistant/tool-labels'
import type { ToolConfirmationRequest, ToolConfirmationResult } from '@/lib/assistant/hitl-types'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { AssistantMark } from '@/components/assistant/assistant-mark'

export interface CommandTurnResult {
    text: string
    confirmation: ToolConfirmationRequest | null
    executed: { toolName: string; result: unknown }[]
    credits: number
    summary: AiUsageSummary
}

interface ActionPreviewProps {
    result: CommandTurnResult
    onConfirmationResolved: (result: ToolConfirmationResult, toolResult?: unknown) => void
}

export function ActionPreview({ result, onConfirmationResolved }: ActionPreviewProps) {
    const { text, confirmation, executed } = result

    return (
        <div className="py-2">
            {confirmation && (
                <>
                    <p className="px-[18px] pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8A8A8E] dark:text-muted-foreground/80">
                        Ação entendida
                    </p>
                    <ToolConfirmationCard
                        request={confirmation}
                        surface="command_bar"
                        onResolved={onConfirmationResolved}
                    />
                </>
            )}

            {text && (
                <div className="flex items-start gap-2.5 px-[18px] py-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#EDE9FE] dark:bg-violet-500/15 text-primary dark:text-violet-400">
                        <AssistantMark className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-k-text-primary dark:text-foreground">
                        {text}
                    </p>
                </div>
            )}

            {executed.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-[18px] pb-2">
                    {executed.map((e, i) => (
                        <span
                            key={`${e.toolName}-${i}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#DCFCE7] dark:bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-[#15803D] dark:text-emerald-400"
                        >
                            <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                            {executedText(e.toolName, e.result)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}
