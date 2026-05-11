export interface ShareableCardProps {
    workoutName: string;
    duration: string;
    exerciseCount: number;
    volume: number;
    date: string;
    studentName: string;
    coach: { name: string; avatar_url: string | null } | null;
    completedSets?: number;
    totalSets?: number;
    rpe?: number;
    // For Photo Template
    backgroundImageUri?: string;
    // For Max Loads Template
    maxLoads?: {
        exerciseName: string;
        weight: number;
        reps: number;
        isPr?: boolean;
    }[];
    // For Full Workout Template
    exerciseDetails?: {
        name: string;
        sets: number;
        reps: number;
        weight: number;
    }[];

    // ── NOVOS CAMPOS (todos opcionais) ──
    /** Streak de dias consecutivos com treino (para banners e badges). */
    streakDays?: number;
    /** Delta de volume vs último treino do mesmo nome (positivo = melhor). */
    deltaVolumePercent?: number;
    /** Quantidade de PRs ganhos nesta sessão. */
    prCount?: number;
}
