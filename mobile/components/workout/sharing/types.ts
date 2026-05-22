export interface ShareableCardProps {
    workoutName: string;
    duration: string;
    exerciseCount: number;
    volume: number;
    date: string;
    studentName: string;
    coach: {
        name: string;
        avatar_url: string | null;
        /** Handle real do Instagram do trainer (sem @). Null/undefined = esconde linha do @ no footer. */
        instagram_handle?: string | null;
    } | null;
    completedSets?: number;
    totalSets?: number;
    rpe?: number;
    // For Photo Template
    backgroundImageUri?: string;
    // For Max Loads / Recorde Template
    maxLoads?: {
        exerciseName: string;
        weight: number;
        reps: number | string;
        isPr?: boolean;
        /** Ganho em kg vs. melhor anterior do mesmo exercício (para o delta pill do T2). */
        delta?: number | null;
        /** Data do recorde anterior (ex.: "15 mai"), para "+2,5 kg desde 15 mai". */
        previousDate?: string | null;
    }[];
    // For Full Workout / Lista Template
    exerciseDetails?: {
        name: string;
        sets: number;
        reps: number | string;
        weight: number | null;
        isPr?: boolean;
    }[];

    // ── NOVOS CAMPOS (todos opcionais) ──
    /** Streak de dias consecutivos com treino (para banners e badges). */
    streakDays?: number;
    /** Delta de volume vs último treino do mesmo nome (positivo = melhor). */
    deltaVolumePercent?: number;
    /** Quantidade de PRs ganhos nesta sessão. */
    prCount?: number;
    /** Semana do programa (T4 Lista): chip "SEMANA current/total". */
    programWeek?: { current: number; total: number };
}
