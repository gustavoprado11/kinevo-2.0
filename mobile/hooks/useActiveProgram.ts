import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { getWeekRange, toDateKey } from "@kinevo/shared/utils/schedule-projection";

interface AssignedWorkout {
    id: string;
    assigned_program_id: string;
    name: string;
    order_index: number;
    items?: { id: string }[];
    scheduled_days?: number[];
    [key: string]: any;
}

interface WorkoutSession {
    id: string;
    assigned_workout_id: string;
    started_at: string;
    completed_at?: string;
    status: 'in_progress' | 'completed';
}

interface ActiveProgramData {
    id: string;
    student_id: string;
    program_id?: string;
    status: string;
    created_at: string;
    description?: string;
    name: string;
    started_at?: string;
    duration_weeks?: number;
    workouts: AssignedWorkout[];
    program: { name: string };
    weeklyProgress: {
        totalSessions: number;
        targetSessions: number;
    };
    [key: string]: any;
}

export function useActiveProgram() {
    const { user } = useAuth();
    const [data, setData] = useState<ActiveProgramData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [studentName, setStudentName] = useState<string>("");
    const [studentId, setStudentId] = useState<string | null>(null);

    // Sessions cache: dateKey → WorkoutSession[]
    const [sessionsMap, setSessionsMap] = useState<Map<string, WorkoutSession[]>>(new Map());

    // Keep programId in ref for fetchRange
    const programIdRef = useRef<string | null>(null);

    // Fetch sessions for an arbitrary date range and merge into cache
    const fetchRange = useCallback(async (start: Date, end: Date) => {
        const pid = programIdRef.current;
        if (!pid) return;

        try {
            const { data: sessionsData, error: sessionsError }: { data: any; error: any } = await supabase
                .from("workout_sessions" as any)
                .select("id, assigned_workout_id, started_at, completed_at, status")
                .eq("assigned_program_id", pid)
                .gte("started_at", start.toISOString())
                .lte("started_at", end.toISOString())
                .order("started_at", { ascending: false });

            if (sessionsError) {
                console.error("[useActiveProgram] fetchRange error:", sessionsError);
                return;
            }

            const sessions: WorkoutSession[] = sessionsData || [];

            setSessionsMap((prev) => {
                const next = new Map(prev);
                // Index new sessions by date key
                for (const s of sessions) {
                    const key = toDateKey(new Date(s.started_at));
                    const existing = next.get(key) || [];
                    // Avoid duplicates by id
                    const ids = new Set(existing.map(e => e.id));
                    if (!ids.has(s.id)) {
                        existing.push(s);
                    }
                    next.set(key, existing);
                }
                return next;
            });
        } catch (err) {
            console.error("[useActiveProgram] fetchRange exception:", err);
        }
    }, []);

    const fetchActiveProgram = useCallback(async () => {
        if (!user) return;

        try {
            setIsLoading(true);
            setError(null);

            // 0. Get Student Name and ID
            const { data: student }: { data: any; error: any } = await supabase
                .from('students' as any)
                .select('id, name')
                .eq('auth_user_id', user.id)
                .maybeSingle();

            if (student) {
                setStudentName(student.name || "");
                setStudentId(student.id);
            } else {
                console.log('[useActiveProgram] Student not found for user:', user.id);
                setIsLoading(false);
                return;
            }

            // 1. Get Assigned Program
            const { data: program, error: programError }: { data: any; error: any } = await supabase
                .from("assigned_programs" as any)
                .select("*")
                .eq("student_id", student.id)
                .eq("status", "active")
                .maybeSingle();

            if (programError) throw programError;

            let programData: any = null;

            if (program) {
                programIdRef.current = program.id;

                // 2. Get Workouts with Items for count
                const { data: workouts, error: workoutsError }: { data: any; error: any } = await supabase
                    .from("assigned_workouts" as any)
                    .select("*, items:assigned_workout_items(id)")
                    .eq("assigned_program_id", program.id)
                    .order("order_index");

                if (workoutsError) throw workoutsError;

                programData = {
                    ...program,
                    workouts: (workouts || []).sort(
                        (a: AssignedWorkout, b: AssignedWorkout) => a.order_index - b.order_index,
                    ),
                };
            } else {
                programIdRef.current = null;
            }

            if (programData) {
                // 3. Fetch sessions for the current week
                const weekRange = getWeekRange(new Date());

                const { data: sessionsData, error: sessionsError }: { data: any; error: any } = await supabase
                    .from("workout_sessions" as any)
                    .select("id, assigned_workout_id, started_at, completed_at, status")
                    .eq("assigned_program_id", programData.id)
                    .gte("started_at", weekRange.start.toISOString())
                    .lte("started_at", weekRange.end.toISOString())
                    .order("started_at", { ascending: false });

                if (sessionsError) {
                    console.error("[useActiveProgram] Error fetching sessions:", sessionsError);
                }

                const sessions: WorkoutSession[] = sessionsData || [];

                // Populate sessions cache
                const newMap = new Map<string, WorkoutSession[]>();
                for (const s of sessions) {
                    const key = toDateKey(new Date(s.started_at));
                    const arr = newMap.get(key) || [];
                    arr.push(s);
                    newMap.set(key, arr);
                }
                setSessionsMap(newMap);

                // Calculate Progress
                const completedSessionsCount = sessions.filter(s => s.status === 'completed').length;

                let targetSessions = 0;
                let hasSchedules = false;

                programData.workouts.forEach((w: AssignedWorkout) => {
                    if (w.scheduled_days && w.scheduled_days.length > 0) {
                        hasSchedules = true;
                        targetSessions += w.scheduled_days.length;
                    }
                });

                if (!hasSchedules) {
                    targetSessions = programData.workouts.length > 0 ? 3 : 0;
                }

                const formattedData: ActiveProgramData = {
                    ...programData,
                    program: { name: programData.name },
                    weeklyProgress: {
                        totalSessions: completedSessionsCount,
                        targetSessions,
                    }
                };

                setData(formattedData);
            } else {
                setData(null);
                setSessionsMap(new Map());
            }
        } catch (err: any) {
            console.error("[useActiveProgram] Error:", err);
            setError(err.message || "Erro ao carregar programa.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchActiveProgram();

        if (!user || !studentId) return;

        // Realtime Subscription
        const channel = supabase
            .channel('active-program-setup')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'assigned_programs',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    console.log('Realtime change detected in assigned_programs:', payload);
                    fetchActiveProgram();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchActiveProgram, user, studentId]);

    // Flatten sessionsMap into a flat array (for backward compatibility)
    const allSessions: WorkoutSession[] = [];
    sessionsMap.forEach((arr) => {
        for (const s of arr) allSessions.push(s);
    });

    return {
        data,
        programName: data?.program?.name,
        workouts: data?.workouts || [],
        sessions: allSessions,
        sessionsMap,
        weeklyProgress: data?.weeklyProgress,
        studentName,
        programStartedAt: data?.started_at || null,
        programDurationWeeks: data?.duration_weeks || null,
        isLoading,
        error,
        refetch: fetchActiveProgram,
        fetchRange,
    };
}
