export interface FinancialStudent {
    student_id: string
    student_name: string
    avatar_url: string | null
    phone: string | null
    contract_id: string | null
    billing_type: string | null
    contract_status: string | null
    amount: number | null
    current_period_end: string | null
    block_on_fail: boolean | null
    cancel_at_period_end: boolean | null
    canceled_by: string | null
    canceled_at: string | null
    stripe_subscription_id: string | null
    plan_title: string | null
    plan_interval: string | null
    display_status: DisplayStatus
}

export type DisplayStatus =
    | 'courtesy'
    | 'awaiting_payment'
    | 'active'
    | 'grace_period'
    | 'canceling'
    | 'overdue'
    | 'canceled'
    | 'expired'

export interface ContractEvent {
    id: string
    student_id: string
    trainer_id: string
    contract_id: string | null
    event_type: ContractEventType
    metadata: Record<string, unknown>
    created_at: string
}

export type ContractEventType =
    | 'student_registered'
    | 'contract_created'
    | 'contract_migrated'
    | 'payment_received'
    | 'payment_failed'
    | 'contract_canceled'
    | 'contract_overdue'
    | 'plan_changed'
    | 'access_blocked'
    | 'access_unblocked'
    | 'student_archived'
