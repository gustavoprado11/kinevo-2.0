import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface AssignedWorkout {
    id: string;
    assigned_program_id: string;
    name: string;
    order_index: number;
    items?: { id: string }[]; // Added items for count
    scheduled_days?: number[]; // 0=Sun, 6=Sat
    // Add other fields as needed based on usage
    [key: string]: any;
}

interface AssignedProgram {
    id: string;
    student_id: string;
    program_id?: string;
    status: string;
    created_at: string;
    description?: string;
    // Add other fields as needed
    [key: string]: any;
}

interface WorkoutSession {
    id: string;
    assigned_workout_id: string;
    started_at: string;
    completed_at?: string;
    status: 'in_progress' | 'completed';
}

interface ActiveProgramData extends AssignedProgram {
    workouts: AssignedWorkout[];
    program: { name: string };
    sessions: WorkoutSession[];
    weeklyProgress: {
        totalSessions: number;
        targetSessions: number;
    };
}

export function useActiveProgram() {
    const { user } = useAuth();
    const [data, setData] = useState<ActiveProgramData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [studentName, setStudentName] = useState<string>("");
    const [studentId, setStudentId] = useState<string | null>(null);

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
                // 2. Get Workout Workouts with Items for count
                const { data: workouts, error: workoutsError }: { data: any; error: any } = await supabase
                    .from("assigned_workouts" as any)
                    .select("*, items:assigned_workout_items(id)")
                    .eq("assigned_program_id", program.id)
                    .order("order_index");

                if (workoutsError) throw workoutsError;

                programData = {
                    ...program,
                    workouts: workouts || []
                };
            }

            if (programData) {
                // 3. Get Recent Sessions (This Week)
                // Calculate start of week (Sunday)
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);

                // Use assigned_program_id and assigned_workout_id based on database.ts schema
                const { data: sessionsData, error: sessionsError }: { data: any; error: any } = await supabase
                    .from("workout_sessions" as any)
                    .select("id, assigned_workout_id, started_at, completed_at, status")
                    .eq("assigned_program_id", programData.id)
                    .gte("started_at", startOfWeek.toISOString())
                    .order("started_at", { ascending: false });

                if (sessionsError) {
                    console.error("[useActiveProgram] Error fetching sessions:", sessionsError);
                    // Don't block the whole hook if sessions fail, just return empty
                }

                // Sort workouts
                if (programData.workouts) {
                    programData.workouts.sort((a: AssignedWorkout, b: AssignedWorkout) => a.order_index - b.order_index);
                }

                // Calculate Progress
                const sessions: any[] = sessionsData || [];
                const completedSessionsCount = sessions.filter(s => s.status === 'completed').length;

                // Target: Sum of scheduled days for all workouts. If no schedules, default to 3 or number of workouts.
                let targetSessions = 0;
                let hasSchedules = false;

                programData.workouts.forEach((w: AssignedWorkout) => {
                    if (w.scheduled_days && w.scheduled_days.length > 0) {
                        hasSchedules = true;
                        targetSessions += w.scheduled_days.length;
                    }
                });

                if (!hasSchedules) {
                    targetSessions = programData.workouts.length > 0 ? 3 : 0; // Default target
                }

                const formattedData: ActiveProgramData = {
                    ...programData,
                    program: { name: programData.name }, // This might need adjustment if program name is separate
                    sessions,
                    weeklyProgress: {
                        totalSessions: completedSessionsCount,
                        targetSessions,
                    }
                };

                setData(formattedData);
            } else {
                setData(null);
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

    return {
        data,
        programName: data?.program?.name,
        workouts: data?.workouts || [],
        sessions: data?.sessions || [],
        weeklyProgress: data?.weeklyProgress,
        studentName,
        isLoading,
        error,
        refetch: fetchActiveProgram,
    };
}
