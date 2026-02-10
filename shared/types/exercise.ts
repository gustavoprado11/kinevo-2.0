export interface MuscleGroup {
    id: string
    name: string
    owner_id: string | null
    created_at: string
}

export interface Exercise {
    id: string
    name: string

    // M:N Relation
    muscle_groups: MuscleGroup[]

    // Standard fields
    equipment: string | null
    video_url: string | null
    thumbnail_url: string | null
    instructions: string | null

    // Ownership
    owner_id: string | null // NULL = System, UUID = Trainer

    // System fields
    original_system_id?: string | null
    is_archived: boolean
    created_at: string
    updated_at: string
}
