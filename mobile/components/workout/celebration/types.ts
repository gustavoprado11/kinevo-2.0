// CelebrationData expandido (campos novos opcionais → fallback graceful).
export interface CelebrationData {
    duration: string;          // "24:09"
    completedSets: number;
    totalSets: number;
    totalVolume: number;       // kg
    rpe: number;

    // ── NOVOS (opcionais) ──
    /** Sessão aeróbia: variantes trocam séries/volume por blocos/tempo. */
    sessionType?: 'strength' | 'cardio';
    cardioBlocksCompleted?: number;
    cardioBlocksTotal?: number;
    cardioMinutes?: number;
    workoutName?: string;
    endDate?: Date;            // pra pickVariant. Default: new Date()
    prCount?: number;          // >0 ativa BadgePR
    streakDays?: number;       // >0 ativa BadgeStreak
    deltaVolumePct?: number;   // >0 ativa DeltaPill
    coach?: {
        name: string;
        initial: string;
    };
}

export interface CelebrationVariantProps {
    data: CelebrationData;
    onComplete: () => void;
    onShare: () => void;
}
