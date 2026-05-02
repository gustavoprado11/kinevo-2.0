'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidateTrainerLibrary } from '@/lib/exercises/get-trainer-library'

// Called from client components after a successful mutation on the exercises
// table (create / edit / archive / delete). The client-side mutation already
// went through Supabase RLS so we don't re-authorize here — we just bust the
// per-trainer Next cache so other tabs / future page loads see the change
// before the 60s TTL expires.
export async function revalidateMyExerciseLibrary(): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false }

    await revalidateTrainerLibrary(trainer.id)
    return { success: true }
}
