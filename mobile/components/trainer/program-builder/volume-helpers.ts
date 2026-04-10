// Pure calculation helpers for volume summary (exported for testing)

export function calculateVolume(
    workouts: { frequency: string[]; items: { item_type: string; sets: number; exercise_muscle_groups: string[] }[] }[]
): Record<string, number> {
    return workouts.reduce((acc, workout) => {
        const frequency = Math.max(1, workout.frequency.length);
        workout.items.forEach(item => {
            if (item.item_type === 'exercise' && item.sets > 0) {
                const weeklySets = item.sets * frequency;
                item.exercise_muscle_groups.forEach(group => {
                    acc[group] = (acc[group] || 0) + weeklySets;
                });
            }
        });
        return acc;
    }, {} as Record<string, number>);
}

export function getVolumeColor(sets: number): string {
    if (sets < 10) return '#60a5fa';    // azul — baixo
    if (sets <= 20) return '#34d399';   // verde — produtivo
    return '#fbbf24';                    // amarelo — alto
}

export function getVolumeHint(sets: number): string {
    if (sets < 10) return 'Volume baixo';
    if (sets <= 20) return 'Faixa produtiva';
    return 'Volume alto';
}
