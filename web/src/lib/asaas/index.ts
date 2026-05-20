// Asaas integration — barrel file
export { asaasRequest, AsaasApiError, getKinevoMainApiKey, getKinevoWalletId } from './client'
export type { AsaasEnvironment, AsaasRequestOptions } from './client'

export { createSubaccount, getSubaccount, listSubaccounts, getMyAccountInfo } from './accounts'
export { createCustomer, findCustomerByExternalRef, findOrCreateCustomer } from './customers'
export { createPayment, getPayment, getPaymentPixQrCode, refundPayment, describeChargeForStudent } from './payments'
export { createPaymentLink, getPaymentLink, deactivatePaymentLink, listPaymentsByLink } from './payment-links'
export { createTransfer, getTransfer } from './transfers'
export { validatePixKey, isPixKeyFormatValid, normalizePixKey } from './pix'
export { getBalance } from './balance'
export { verifyWebhookSecret, parseWebhookEvent, ASAAS_WEBHOOK_TOKEN_HEADER } from './webhook'
export { ensureSubaccountWebhook, tryEnsureSubaccountWebhook } from './webhook-setup'
export { encryptApiKey, decryptApiKey } from './encryption'
export { listPendingDocuments, uploadDocument, summarizeDocuments } from './documents'
export { createSubscription, getSubscription, cancelSubscription, listSubscriptionsByCustomer } from './subscriptions'
export {
    ASAAS_FEES,
    PAYMENT_METHOD_LABELS,
    simulateNet,
    simulateAllMethods,
    formatBRL,
    formatPercent,
} from './fees'
export type { PaymentMethod, FeeRule, NetSimulation } from './fees'

// Re-export domain types so callers can `import { CreateAsaasPaymentInput } from '@/lib/asaas'`
export type {
    AsaasAccount,
    AsaasAccountStatus,
    CreateAsaasAccountInput,
    AsaasCustomer,
    CreateAsaasCustomerInput,
    AsaasPayment,
    AsaasBillingType,
    AsaasPaymentStatus,
    AsaasSplit,
    CreateAsaasPaymentInput,
    AsaasTransfer,
    AsaasTransferStatus,
    CreateAsaasTransferInput,
    AsaasBalance,
    AsaasWebhookEvent,
    AsaasWebhookEventType,
    PixKeyType,
    PixKeyValidation,
    KinevoWalletStatus,
    KinevoWalletMode,
    KinevoWalletSummary,
    AsaasDocumentGroup,
    AsaasDocumentGroupStatus,
    AsaasDocumentType,
    AsaasDocument,
    KinevoDocumentSubmission,
    AsaasSubscription,
    AsaasSubscriptionCycle,
    AsaasSubscriptionStatus,
    CreateAsaasSubscriptionInput,
    AsaasPaymentLink,
    AsaasChargeType,
    CreateAsaasPaymentLinkInput,
} from '@kinevo/shared/types/asaas'
