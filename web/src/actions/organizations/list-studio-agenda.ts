'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrgAgenda, type OrgAgendaOccurrence } from '@/lib/studio/org-agenda'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface StudioAgendaResult {
    success: boolean
    error?: string
    occurrences?: OrgAgendaOccurrence[]
    /** Nomes p/ o calendário — aluno de colega vem sufixado com o coach. */
    studentsById?: Record<string, { name: string; avatarUrl: string | null }>
}

/**
 * Agenda consolidada do estúdio para a tela /schedule (visão de TODOS os
 * coaches — decisão 16/jul: qualquer membro ATIVO vê; agendar segue pessoal).
 */
export async function listStudioAgendaInRange(input: {
    rangeStart: string
    rangeEnd: string
}): Promise<StudioAgendaResult> {
    if (!DATE_RE.test(input.rangeStart) || !DATE_RE.test(input.rangeEnd)) {
        return { success: false, error: 'Range inválido' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    // Membro ATIVO de estúdio (qualquer papel).
    const { data: membership } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
    if (!membership) return { success: false, error: 'Você não pertence a um estúdio' }

    const occurrences = await getOrgAgenda(
        (membership as { organization_id: string }).organization_id,
        input.rangeStart,
        input.rangeEnd,
    )

    // Map de nomes p/ o calendário: aluno de colega ganha "· Coach" pra
    // ficar legível na visão "Todos" sem mexer nos componentes do calendário.
    const studentsById: Record<string, { name: string; avatarUrl: string | null }> = {}
    for (const o of occurrences) {
        if (!studentsById[o.studentId]) {
            const suffix = o.trainerId === trainer.id ? '' : ` · ${o.coachName.split(' ')[0]}`
            studentsById[o.studentId] = { name: `${o.studentName}${suffix}`, avatarUrl: null }
        }
    }

    return { success: true, occurrences, studentsById }
}
