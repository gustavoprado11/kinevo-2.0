import { supabase } from './supabase';
import { loadSessionStats } from '../hooks/useSessionStats';

// Extras que ativam os badges da celebração (prCount/streak/delta). Todos
// best-effort: qualquer falha → 0 (badge simplesmente não renderiza, já que as
// variações da celebração só mostram quando o valor é > 0).
export interface CelebrationExtras {
    prCount: number;
    streakDays: number;
    deltaVolumePct: number;
}

const ZERO: CelebrationExtras = { prCount: 0, streakDays: 0, deltaVolumePct: 0 };

function localDayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Dias consecutivos com treino concluído terminando hoje. A sessão recém-finalizada
 * conta sempre (force-add de hoje, robusto a race de gravação no DB).
 */
async function fetchStreakDays(studentId: string): Promise<number> {
    try {
        const { data } = await supabase
            .from('workout_sessions' as any)
            .select('completed_at, started_at')
            .eq('student_id', studentId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false, nullsFirst: false })
            .limit(400);

        const days = new Set<string>();
        for (const s of (data || []) as any[]) {
            days.add(localDayKey(new Date(s.completed_at ?? s.started_at)));
        }
        // Sessão de hoje pode ainda não ter aterrissado na query — garante hoje.
        days.add(localDayKey(new Date()));

        let streak = 0;
        const cursor = new Date();
        cursor.setHours(12, 0, 0, 0); // meio-dia evita borda de DST
        while (days.has(localDayKey(cursor))) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
    } catch (err) {
        if (__DEV__) console.error('[celebrationStats] streak failed:', err);
        return 0;
    }
}

/**
 * % de volume vs. o último treino concluído de mesmo nome. Positivo só quando
 * houve ganho (a celebração esconde delta <= 0). currentVolume vem in-memory do
 * fim do treino (já main-only).
 */
async function fetchDeltaVolumePct(
    sessionId: string,
    studentId: string,
    workoutName: string,
    currentVolume: number,
): Promise<number> {
    try {
        if (!workoutName || currentVolume <= 0) return 0;

        const { data } = await supabase
            .from('workout_sessions' as any)
            .select('id, completed_at, started_at, assigned_workouts:assigned_workout_id (name)')
            .eq('student_id', studentId)
            .eq('status', 'completed')
            .neq('id', sessionId)
            .order('completed_at', { ascending: false, nullsFirst: false })
            .limit(60);

        const prev = ((data || []) as any[]).find((s) => {
            const aw = s.assigned_workouts;
            const name = Array.isArray(aw) ? aw[0]?.name : aw?.name;
            return name === workoutName;
        });
        if (!prev?.id) return 0;

        const { volume: prevVolume } = await loadSessionStats(prev.id as string);
        if (prevVolume <= 0) return 0;

        return Math.round(((currentVolume - prevVolume) / prevVolume) * 100);
    } catch (err) {
        if (__DEV__) console.error('[celebrationStats] delta failed:', err);
        return 0;
    }
}

async function fetchPrCount(sessionId: string): Promise<number> {
    try {
        const { prCount } = await loadSessionStats(sessionId);
        return prCount;
    } catch (err) {
        if (__DEV__) console.error('[celebrationStats] prCount failed:', err);
        return 0;
    }
}

/**
 * Reúne os extras da celebração em paralelo. Pensado pra ser awaited em
 * executeFinish ANTES de exibir a celebração (badges entram na animação inicial).
 */
export async function fetchCelebrationExtras(params: {
    sessionId: string;
    studentId?: string | null;
    workoutName?: string;
    currentVolume: number;
}): Promise<CelebrationExtras> {
    const { sessionId, studentId, workoutName, currentVolume } = params;
    if (!sessionId) return ZERO;

    const [prCount, streakDays, deltaVolumePct] = await Promise.all([
        fetchPrCount(sessionId),
        studentId ? fetchStreakDays(studentId) : Promise.resolve(0),
        studentId && workoutName
            ? fetchDeltaVolumePct(sessionId, studentId, workoutName, currentVolume)
            : Promise.resolve(0),
    ]);

    return { prCount, streakDays, deltaVolumePct };
}
