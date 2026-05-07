'use server'

import { createClient } from '@/lib/supabase/server'
import type { MeasurementInput } from '@kinevo/shared/types/assessments'

interface SaveAssessmentMeasurementsInput {
    sessionId: string
    measurements: MeasurementInput[]
}

export async function saveAssessmentMeasurements(
    input: SaveAssessmentMeasurementsInput,
): Promise<{ success: boolean; saved?: number; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    if (!input.sessionId || !Array.isArray(input.measurements)) {
        return { success: false, error: 'sessionId e measurements são obrigatórios' }
    }

    const { data, error } = await supabase.rpc('save_assessment_measurements' as never, {
        p_session_id: input.sessionId,
        p_measurements: input.measurements,
    } as never)

    if (error) {
        console.error('[saveAssessmentMeasurements] error:', error)
        return { success: false, error: error.message }
    }

    return { success: true, saved: (data as unknown as number) ?? 0 }
}
