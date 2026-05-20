// ============================================================================
// Asaas — Tabela de taxas + calculadora "quanto o trainer recebe"
// ============================================================================
// Fonte: calibrado via observação real (value vs netValue) em 2026-05.
// Atualizar quando o Asaas mudar pricing — único lugar a editar.
//
// IMPORTANTE: o número exposto na UI é o repasse direto do Asaas + take rate
// Kinevo (vindo de env KINEVO_TAKE_RATE_PCT, default 0).
//
// PIX: confirmado R$ 0,99 fixo (transação R$5 → netValue R$4,01).
// CREDIT_CARD/BOLETO/DEBIT_CARD: ainda calibrar via diagnostic + observação
// quando houver dados reais.
// ============================================================================

export type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD'

export interface FeeRule {
    /** Percentual aplicado sobre o valor da venda (ex.: 0.0199 = 1,99%). */
    percent: number
    /** Valor fixo em BRL adicionado à taxa percentual. */
    fixed: number
    /** Prazo de liberação (string descritiva, exibida ao trainer). */
    settlementLabel: string
}

/**
 * Taxas Asaas (calibrado 2026). Plano padrão, sem mensalidade. Cartão D+30.
 *
 * PIX: confirmado R$ 0,99 fixo por transação (observação direta). O valor
 * é o mesmo independente do valor da cobrança.
 *
 * Os outros métodos ainda estão na política pública da Asaas e podem
 * variar quando observarmos pagamentos reais. Use /api/diagnostic/asaas-fees
 * pra calibrar.
 */
export const ASAAS_FEES: Record<PaymentMethod, FeeRule> = {
    PIX: { percent: 0, fixed: 0.99, settlementLabel: 'Próximo dia útil' },
    BOLETO: { percent: 0, fixed: 1.99, settlementLabel: '1-2 dias úteis após pagamento' },
    CREDIT_CARD: { percent: 0.0299, fixed: 0.49, settlementLabel: '30 dias' },
    DEBIT_CARD: { percent: 0.0199, fixed: 0.49, settlementLabel: '1 dia útil' },
}

export interface NetSimulation {
    method: PaymentMethod
    /** Valor que o aluno paga. */
    grossValue: number
    /** Taxa do Asaas em R$. */
    asaasFee: number
    /** Take rate da Kinevo em R$ (zero por enquanto). */
    kinevoFee: number
    /** Valor líquido que o trainer recebe na carteira. */
    trainerNet: number
    /** Prazo de liberação descritivo. */
    settlementLabel: string
}

/** Lê o take rate Kinevo do env. Default 0 (zero markup). */
function getKinevoTakePct(): number {
    const raw = process.env.KINEVO_TAKE_RATE_PCT ?? '0'
    const n = parseFloat(raw)
    if (Number.isNaN(n) || n < 0) return 0
    return n / 100
}

/**
 * Simula quanto o trainer recebe líquido por método de pagamento.
 * Não arredonda no meio do cálculo — só no final (2 casas).
 */
export function simulateNet(
    grossValue: number,
    method: PaymentMethod,
    options?: { kinevoTakeOverride?: number }
): NetSimulation {
    const fee = ASAAS_FEES[method]
    const asaasFee = round2(grossValue * fee.percent + fee.fixed)
    const kinevoPct = options?.kinevoTakeOverride ?? getKinevoTakePct()
    const kinevoFee = round2(grossValue * kinevoPct)
    const trainerNet = round2(grossValue - asaasFee - kinevoFee)
    return {
        method,
        grossValue: round2(grossValue),
        asaasFee,
        kinevoFee,
        trainerNet,
        settlementLabel: fee.settlementLabel,
    }
}

/** Roda simulação pra todos os métodos de uma vez (útil pra UI). */
export function simulateAllMethods(
    grossValue: number,
    methods: PaymentMethod[] = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO']
): NetSimulation[] {
    return methods.map(m => simulateNet(grossValue, m))
}

/** Format helper pra exibir na UI ("R$ 245,01"). */
export function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

/** Format helper de percentual ("2,99%"). */
export function formatPercent(pct: number): string {
    return (pct * 100).toFixed(2).replace('.', ',') + '%'
}

/** Labels de UI por método de pagamento. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de crédito',
    DEBIT_CARD: 'Cartão de débito',
}

function round2(n: number): number {
    return Math.round(n * 100) / 100
}
