/**
 * useExerciseHistory — últimas execuções de um exercício por um aluno.
 *
 * Alimenta o sheet de histórico da Sala de Treino (treinador) e da tela de
 * execução (aluno). Busca sob demanda: o hook só chama o banco quando recebe os
 * dois ids, ou seja, quando o sheet abre — a entrada no treino continua com o
 * mesmo custo de antes.
 *
 * A RLS decide o que cada um enxerga (aluno: as próprias sessões; treinador: as
 * dos seus alunos), então o RPC é o mesmo para as duas telas.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    groupExerciseHistory,
    summarizeExerciseHistory,
    type ExerciseHistoryRow,
    type ExerciseHistorySummary,
} from '@kinevo/shared/lib/exercise-history';

export const EXERCISE_HISTORY_SESSIONS = 5;

const EMPTY: ExerciseHistorySummary = { sessions: [], best: null, last: null, deltaKg: null };

interface UseExerciseHistoryResult {
    history: ExerciseHistorySummary;
    isLoading: boolean;
    error: string | null;
    reload: () => void;
}

export function useExerciseHistory(
    studentId: string | null | undefined,
    exerciseId: string | null | undefined,
    limit: number = EXERCISE_HISTORY_SESSIONS,
): UseExerciseHistoryResult {
    const [history, setHistory] = useState<ExerciseHistorySummary>(EMPTY);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);

    const reload = useCallback(() => setReloadToken((n) => n + 1), []);

    useEffect(() => {
        if (!studentId || !exerciseId) {
            setHistory(EMPTY);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        (async () => {
            const { data, error: rpcError } = await supabase.rpc('get_exercise_history' as any, {
                p_student_id: studentId,
                p_exercise_id: exerciseId,
                p_limit: limit,
            });

            if (cancelled) return;

            if (rpcError) {
                setError('Não foi possível carregar o histórico.');
                setHistory(EMPTY);
            } else {
                const rows = (data ?? []) as ExerciseHistoryRow[];
                setHistory(summarizeExerciseHistory(groupExerciseHistory(rows)));
            }
            setIsLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [studentId, exerciseId, limit, reloadToken]);

    return { history, isLoading, error, reload };
}
