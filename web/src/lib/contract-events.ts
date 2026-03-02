import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ContractEventType } from '@/types/financial'

interface LogContractEventParams {
    studentId: string
    trainerId: string
    contractId?: string | null
    eventType: ContractEventType
    metadata?: Record<string, unknown>
}

export async function logContractEvent({
    studentId,
    trainerId,
    contractId,
    eventType,
    metadata = {},
}: LogContractEventParams): Promise<void> {
    try {
        const { error } = await supabaseAdmin.from('contract_events').insert({
            student_id: studentId,
            trainer_id: trainerId,
            contract_id: contractId ?? null,
            event_type: eventType,
            metadata,
        })
        if (error) {
            console.error('[contract-events] Insert failed:', error.message)
        }
    } catch (err) {
        console.error('[contract-events] Unexpected error:', err)
    }
}
