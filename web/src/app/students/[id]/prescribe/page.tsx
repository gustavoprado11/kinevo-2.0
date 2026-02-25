import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { fetchPrescriptionDataDirect } from '@/actions/prescription/get-prescription-data'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import { PrescribeClient } from './prescribe-client'

export default async function PrescribePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Same pattern as students/[id]/page.tsx — direct query, RLS handles ownership
    const { data: student } = await supabase
        .from('students')
        .select('id, name, email, avatar_url')
        .eq('id', id)
        .single()

    if (!student) {
        redirect('/students')
    }

    // Fetch prescription data using the same authenticated supabase client.
    // Wrapped in try-catch: if prescription tables (migrations 034-036) don't
    // exist yet, we still render the page with safe defaults.
    let prescriptionData: PrescriptionData
    try {
        prescriptionData = await fetchPrescriptionDataDirect(supabase, id, trainer.id)
    } catch (err) {
        console.error('[PrescribePage] fetchPrescriptionDataDirect error:', err)
        prescriptionData = {
            profile: null,
            exercises: [],
            recentSessions: [],
            activeProgram: null,
            aiEnabled: false,
        }
    }

    return (
        <PrescribeClient
            trainer={trainer}
            student={student as any}
            prescriptionData={prescriptionData}
        />
    )
}
