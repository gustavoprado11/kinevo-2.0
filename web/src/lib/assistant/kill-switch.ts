/**
 * Kill-switch operacional do Assistente IA.
 *
 * Hoje o Assistente está aberto a todos os tiers e não há interruptor global (só
 * a voz tem flag). Se o motor degradar (provedor fora do ar, custo disparado,
 * bug de segurança), a única saída era um deploy. Esta flag é o freio de
 * emergência: `ASSISTANT_DISABLED=1` no ambiente server-side desliga o Assistente
 * inteiro SEM deploy —
 *   • os TURNOS (todas as superfícies web+mobile) caem no gate → 403 amigável;
 *   • as rotas GET de acesso devolvem `allowed:false` → as superfícies somem da UI.
 *
 * É server-only (não `NEXT_PUBLIC_`) — o cliente nunca decide isso. Qualquer valor
 * diferente de exatamente "1" mantém o Assistente LIGADO (fail-safe: uma env
 * malformada não derruba a feature sem querer).
 */
export function isAssistantDisabled(): boolean {
    return process.env.ASSISTANT_DISABLED === '1'
}

/** Copy exibida ao treinador quando o kill-switch está ativo. */
export const ASSISTANT_MAINTENANCE_MESSAGE =
    'O Assistente está em manutenção no momento. Tente novamente em alguns minutos — o resto do app segue normal.'
