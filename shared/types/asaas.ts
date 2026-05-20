// ============================================================================
// Asaas — domain types shared between web and mobile
// ============================================================================
// These mirror Asaas API v3 payloads but use camelCase consistently and only
// expose the fields Kinevo actually consumes. Add fields here as the surface
// area grows — don't import Asaas SDK types directly into UI code.
//
// Reference: https://docs.asaas.com/reference/comece-por-aqui
// ============================================================================

// ---------------------------------------------------------------------------
// Subaccount (one per trainer, lives inside the Kinevo CNPJ marketplace)
// ---------------------------------------------------------------------------

export type AsaasAccountStatus =
    | 'PENDING'    // criada, aguardando primeiros dados
    | 'AWAITING'   // documentação enviada, em análise
    | 'APPROVED'   // pronta pra receber e sacar
    | 'REJECTED'   // negada (motivo em rejectionReason)
    | 'BLOCKED'    // suspensa por compliance

export interface AsaasAccount {
    id: string                   // ex.: "acc_000000123"
    walletId: string             // usado em split de pagamentos
    name: string
    email: string
    cpfCnpj: string              // sem máscara
    apiKey?: string              // só retorna na criação — guardar criptografado
    accountStatus: AsaasAccountStatus
    rejectReason?: string | null
    createdAt: string            // ISO
}

export interface CreateAsaasAccountInput {
    name: string
    email: string
    cpfCnpj: string              // CPF (11 dígitos) ou CNPJ (14), sem máscara
    birthDate: string            // YYYY-MM-DD (obrigatório para PF)
    mobilePhone: string          // só dígitos
    address: string
    addressNumber: string
    province: string             // bairro
    postalCode: string           // 8 dígitos sem máscara
    incomeValue?: number         // faturamento mensal estimado (BRL)
    companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'
}

// ---------------------------------------------------------------------------
// Customer (one per Kinevo student inside a trainer's subaccount)
// ---------------------------------------------------------------------------

export interface AsaasCustomer {
    id: string                   // ex.: "cus_000000789"
    name: string
    email?: string | null
    cpfCnpj?: string | null
    mobilePhone?: string | null
    externalReference?: string | null  // Kinevo student_id
}

export interface CreateAsaasCustomerInput {
    name: string
    cpfCnpj?: string             // obrigatório para boleto/cartão; opcional para PIX puro
    email?: string
    mobilePhone?: string
    externalReference?: string   // Kinevo student_id
}

// ---------------------------------------------------------------------------
// Payment / Charge
// ---------------------------------------------------------------------------

export type AsaasBillingType =
    | 'UNDEFINED'    // aluno escolhe no checkout (recomendado)
    | 'PIX'
    | 'CREDIT_CARD'
    | 'BOLETO'

export type AsaasPaymentStatus =
    | 'PENDING'              // aguardando pagamento
    | 'RECEIVED'             // pago e confirmado
    | 'CONFIRMED'            // confirmação prévia (cartão)
    | 'OVERDUE'              // venceu sem pagamento
    | 'REFUNDED'             // estornado
    | 'RECEIVED_IN_CASH'     // marcado manualmente
    | 'REFUND_REQUESTED'
    | 'CHARGEBACK_REQUESTED'
    | 'CHARGEBACK_DISPUTE'
    | 'AWAITING_CHARGEBACK_REVERSAL'
    | 'DUNNING_REQUESTED'
    | 'DUNNING_RECEIVED'
    | 'AWAITING_RISK_ANALYSIS'

export interface AsaasSplit {
    walletId: string             // walletId do destinatário (Kinevo, ex.)
    fixedValue?: number          // valor fixo em BRL
    percentualValue?: number     // ou % do valor da cobrança
}

export interface CreateAsaasPaymentInput {
    customer: string             // id do customer (Asaas)
    billingType: AsaasBillingType
    value: number                // BRL
    dueDate: string              // YYYY-MM-DD
    description?: string
    externalReference?: string   // Kinevo contract_id
    split?: AsaasSplit[]         // take rate da Kinevo, se houver
    postalService?: boolean
    callback?: { successUrl: string; autoRedirect?: boolean }
}

export interface AsaasPayment {
    id: string
    customer: string
    value: number
    netValue: number
    status: AsaasPaymentStatus
    billingType: AsaasBillingType
    dueDate: string
    paymentDate?: string | null
    clientPaymentDate?: string | null
    invoiceUrl: string           // página pública de checkout
    bankSlipUrl?: string | null  // boleto PDF
    transactionReceiptUrl?: string | null
    pixQrCodeId?: string | null
    externalReference?: string | null
    /** Se a cobrança veio de um Payment Link, vem o id aqui (ex: "pll_abc"). */
    paymentLink?: string | null
    /** Se veio de uma assinatura Asaas, vem o id da subscription. */
    subscription?: string | null
}

// ---------------------------------------------------------------------------
// Payment Link (checkout self-service do Asaas)
// ---------------------------------------------------------------------------
// Diferença pra `createPayment`: aqui o trainer NÃO precisa ter customer
// (CPF, email, telefone do aluno). Ele gera um link, manda pro aluno, e o
// aluno preenche os próprios dados no checkout hospedado.
//
// Asaas cria o customer + payment internamente quando o aluno paga, e
// dispara PAYMENT_CREATED/RECEIVED — a gente cruza pelo `payment.paymentLink`.

export type AsaasChargeType =
    | 'DETACHED'      // cobrança avulsa (one-off)
    | 'RECURRENT'     // assinatura (precisa subscriptionCycle)
    | 'INSTALLMENT'   // parcelado

export interface CreateAsaasPaymentLinkInput {
    name: string                        // título exibido no checkout (ex: "Consultoria Maio — João")
    description?: string                // descrição extra (opcional)
    value: number                       // BRL — obrigatório pra DETACHED/RECURRENT
    billingType: AsaasBillingType
    chargeType: AsaasChargeType
    /** Obrigatório quando chargeType=RECURRENT. */
    subscriptionCycle?: AsaasSubscriptionCycle
    /** Dias entre criação do link e vencimento da cobrança gerada. Default Asaas: 10. */
    dueDateLimitDays?: number
    /** Take rate Kinevo via split. */
    split?: AsaasSplit[]
    /** Notifica aluno por email/SMS (default true na Asaas — a gente desliga porque controla notificação). */
    notificationEnabled?: boolean
    /** Quantidade max de parcelas (só pra INSTALLMENT). */
    maxInstallmentCount?: number
    /** Data fim opcional. */
    endDate?: string
    /** Callback opcional quando o aluno paga. */
    callback?: { successUrl: string; autoRedirect?: boolean }
}

export interface AsaasPaymentLink {
    id: string                          // ex: "pll_abc123"
    name: string
    description?: string | null
    url: string                         // https://www.asaas.com/c/{id}
    active: boolean
    value: number
    billingType: AsaasBillingType
    chargeType: AsaasChargeType
    subscriptionCycle?: AsaasSubscriptionCycle | null
    endDate?: string | null
    notificationEnabled: boolean
    dueDateLimitDays?: number | null
    deleted?: boolean
}

// ---------------------------------------------------------------------------
// Subscription (assinatura recorrente Asaas)
// ---------------------------------------------------------------------------

export type AsaasSubscriptionCycle =
    | 'WEEKLY'        // semanal
    | 'BIWEEKLY'      // quinzenal
    | 'MONTHLY'       // mensal
    | 'QUARTERLY'     // trimestral
    | 'SEMIANNUALLY'  // semestral
    | 'YEARLY'        // anual

export type AsaasSubscriptionStatus =
    | 'ACTIVE'
    | 'INACTIVE'
    | 'EXPIRED'

export interface CreateAsaasSubscriptionInput {
    customer: string                  // id do customer no Asaas
    billingType: AsaasBillingType
    /** Valor de cada cobrança em BRL. */
    value: number
    /** Data da primeira cobrança (YYYY-MM-DD). */
    nextDueDate: string
    cycle: AsaasSubscriptionCycle
    description?: string
    /** Nossa referência interna (student_contracts.id). */
    externalReference?: string
    /** Take rate Kinevo via split. */
    split?: AsaasSplit[]
    /** Limite opcional de cobranças. */
    maxPayments?: number
    /** Data final opcional. */
    endDate?: string
}

export interface AsaasSubscription {
    id: string
    customer: string
    value: number
    nextDueDate: string
    cycle: AsaasSubscriptionCycle
    billingType: AsaasBillingType
    status: AsaasSubscriptionStatus
    description?: string | null
    externalReference?: string | null
    deleted?: boolean
}

// ---------------------------------------------------------------------------
// PIX
// ---------------------------------------------------------------------------

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'

export interface PixKeyValidation {
    valid: boolean
    ownerName?: string
    ownerType?: 'PF' | 'PJ'
    bankName?: string
}

// ---------------------------------------------------------------------------
// Transfer (PIX out — saque do treinador)
// ---------------------------------------------------------------------------

export type AsaasTransferStatus =
    | 'PENDING'      // solicitada
    | 'BANK_PROCESSING'
    | 'DONE'
    | 'CANCELLED'
    | 'FAILED'

export interface CreateAsaasTransferInput {
    value: number
    pixAddressKey: string
    pixAddressKeyType: PixKeyType
    description?: string
}

export interface AsaasTransfer {
    id: string
    value: number
    netValue: number
    status: AsaasTransferStatus
    endToEndIdentifier?: string | null
    failReason?: string | null
    scheduleDate?: string | null
    effectiveDate?: string | null
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export interface AsaasBalance {
    balance: number              // saldo já liberado (saque possível)
    totalBalance?: number        // total no Asaas (incluindo a liberar)
}

// ---------------------------------------------------------------------------
// Webhook events
// ---------------------------------------------------------------------------
// We only enumerate the ones we currently handle. Asaas sends many more.
// See: https://docs.asaas.com/docs/sobre-as-notificacoes-via-webhooks

export type AsaasWebhookEventType =
    | 'PAYMENT_CREATED'
    | 'PAYMENT_UPDATED'
    | 'PAYMENT_CONFIRMED'           // cartão aprovado (ainda não liberado)
    | 'PAYMENT_RECEIVED'            // dinheiro caiu na subconta
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_REFUNDED'
    | 'PAYMENT_DELETED'
    | 'PAYMENT_CHARGEBACK_REQUESTED'
    | 'PAYMENT_CHARGEBACK_DISPUTE'
    | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
    | 'TRANSFER_CREATED'
    | 'TRANSFER_PENDING'
    | 'TRANSFER_IN_BANK_PROCESSING'
    | 'TRANSFER_DONE'
    | 'TRANSFER_FAILED'
    | 'TRANSFER_CANCELLED'
    | 'ACCOUNT_STATUS_UPDATED'
    | 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED'
    | 'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED'

export interface AsaasWebhookEvent<TPayload = unknown> {
    id: string                     // unique event id — use for idempotency
    event: AsaasWebhookEventType
    dateCreated: string            // ISO
    payment?: AsaasPayment
    transfer?: AsaasTransfer
    account?: Partial<AsaasAccount>
    payload?: TPayload             // raw passthrough for debug
}

// ---------------------------------------------------------------------------
// Document groups (subaccount KYC)
// ---------------------------------------------------------------------------
// Asaas returns the list of documents required to approve a subaccount.
// Each "group" represents one type of document (identification, selfie,
// contract, etc). Some groups carry an `onboardingUrl` → must be submitted
// via the white-labelled cadastro.io flow. Others accept upload via API.

export type AsaasDocumentGroupStatus =
    | 'NOT_SENT'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'

export type AsaasDocumentType =
    | 'IDENTIFICATION'
    | 'MINUTES_OF_ELECTION'
    | 'CUSTOM'        // catch-all for new types we haven't enumerated yet
    | string          // forward-compat

export interface AsaasResponsibleParty {
    name?: string
    cpfCnpj?: string
    type?: 'PROFESSIONAL' | 'COMPANY_OWNER' | string
}

export interface AsaasDocument {
    id: string
    type?: string
    title?: string
    description?: string
    status?: AsaasDocumentGroupStatus
}

export interface AsaasDocumentGroup {
    id: string                   // use this on POST /v3/myAccount/documents/{id}
    status: AsaasDocumentGroupStatus
    type: AsaasDocumentType
    title: string
    description: string
    responsible?: AsaasResponsibleParty | null
    onboardingUrl?: string | null  // when present → must use this link
    documents?: AsaasDocument[]    // already-sent files inside this group
}

export interface KinevoDocumentSubmission {
    /** True if any document in this group is still PENDING/NOT_SENT */
    requiresAction: boolean
    /** True if the URL must be opened externally (cadastro.io) */
    requiresOnboardingLink: boolean
    /** True if the trainer can upload directly via the Kinevo UI */
    acceptsApiUpload: boolean
}

// ---------------------------------------------------------------------------
// Kinevo-side wallet state (mirrors trainer_payment_accounts row)
// ---------------------------------------------------------------------------

export type KinevoWalletStatus =
    | 'not_started'   // treinador ainda não ativou
    | 'pending'       // dados enviados, criando no Asaas
    | 'awaiting'      // Asaas analisando documentos
    | 'approved'      // pronto pra receber
    | 'rejected'      // negado (mostrar motivo + permitir refazer)
    | 'blocked'       // suspenso por compliance

export type KinevoWalletMode =
    | 'subaccount'    // Kinevo criou subconta via API (KYC pela Kinevo)
    | 'linked'        // Trainer trouxe API key da própria conta Asaas

export interface KinevoWalletSummary {
    status: KinevoWalletStatus
    mode: KinevoWalletMode
    asaasAccountId: string | null
    asaasWalletId: string | null
    rejectionReason?: string | null
    canReceivePayments: boolean
    canPayout: boolean
    activatedAt?: string | null
    /** Nome ou identificador exibível do dono da conta (útil em modo linked). */
    ownerLabel?: string | null
}
