import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function toDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

interface UsePerfectWeekOpts {
    studentId?: string | null;
    trainerId?: string | null;
    /** Segunda-feira da semana atual (getWeekRange().start). */
    weekStart: Date;
    isWeekComplete: boolean;
    completedCount: number;
    expectedCount: number;
    assignedProgramId?: string | null;
    programWeek?: number | null;
}

/**
 * Persiste a "semana perfeita" (idempotente por student_id + week_start_date) e
 * devolve quantas semanas perfeitas consecutivas terminam na semana atual.
 * Best-effort: erro/sem tabela → consecutiveCount 0 (feature degrada graciosa).
 */
export function usePerfectWeek(opts: UsePerfectWeekOpts) {
    const {
        studentId, trainerId, weekStart, isWeekComplete,
        completedCount, expectedCount, assignedProgramId, programWeek,
    } = opts;

    const [consecutiveCount, setConsecutiveCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const weekKey = toDateOnly(weekStart);

    useEffect(() => {
        if (!studentId) return;
        const shouldRecord = isWeekComplete && expectedCount > 0;
        let cancelled = false;

        (async () => {
            try {
                if (shouldRecord) {
                    await supabase
                        .from('perfect_weeks' as any)
                        .upsert(
                            {
                                student_id: studentId,
                                trainer_id: trainerId ?? null,
                                week_start_date: weekKey,
                                assigned_program_id: assignedProgramId ?? null,
                                program_week: programWeek ?? null,
                                completed_count: completedCount,
                                expected_count: expectedCount,
                            },
                            { onConflict: 'student_id,week_start_date', ignoreDuplicates: true },
                        );
                }

                const { data } = await supabase
                    .from('perfect_weeks' as any)
                    .select('week_start_date')
                    .eq('student_id', studentId)
                    .order('week_start_date', { ascending: false })
                    .limit(260);
                if (cancelled) return;

                const rows = (data || []) as any[];
                const set = new Set<string>(rows.map((r) => r.week_start_date));
                setTotalCount(rows.length);
                let count = 0;
                const cursor = new Date(weekStart);
                cursor.setHours(12, 0, 0, 0);
                while (set.has(toDateOnly(cursor))) {
                    count++;
                    cursor.setDate(cursor.getDate() - 7);
                }
                setConsecutiveCount(count);
            } catch (err) {
                if (__DEV__) console.error('[usePerfectWeek]', err);
            }
        })();

        return () => { cancelled = true; };
    }, [studentId, weekKey, isWeekComplete, completedCount, expectedCount]);

    return { consecutiveCount, totalCount };
}
