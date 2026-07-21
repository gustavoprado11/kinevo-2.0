export interface MuscleGroup {
    id: string
    name: string
    owner_id: string | null
    /** Optional parent group — when set, this is a sub-category (e.g. "Mobilidade Quadril" under "Mobilidade"). */
    parent_id?: string | null
    created_at: string
}

export interface Exercise {
    id: string
    name: string

    // M:N Relation
    muscle_groups: MuscleGroup[]

    /** Funções de treino ("pra quê": mobilidade, ativação, potência…) — terceiro
     *  eixo da biblioteca; opcional porque nem todo fetch traz o join. */
    functions?: { id: string; name: string }[]

    // Standard fields
    equipment: string | null
    video_url: string | null
    thumbnail_url: string | null
    instructions: string | null

    /** Padrão de movimento (squat, hinge, lunge, push_h/v, pull_h/v, core, isolation, mobility, locomotion, jump, integrated, carry). */
    movement_pattern?: string | null

    // Ownership
    owner_id: string | null // NULL = System, UUID = Trainer

    // System fields
    original_system_id?: string | null
    is_archived: boolean
    created_at: string
    updated_at: string
}
