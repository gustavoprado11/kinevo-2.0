import React from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { Alert, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import "../global.css";

console.log("[Layout] Iniciando RootLayout");

// ── Premium iOS-like spring transition spec ──
const PREMIUM_SPRING = {
    animation: 'spring' as const,
    config: {
        stiffness: 800,
        damping: 100,
        mass: 3,
        overshootClamping: false,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
    },
};

function WatchBridge() {
    if (Platform.OS !== "ios") {
        return null;
    }

    const { useWatchConnectivity } = require("../hooks/useWatchConnectivity");
    const { finishWorkoutFromWatch, watchFinishState, processPendingWatchWorkouts } = require("../lib/finishWorkoutFromWatch");
    const { sendAckToWatch, syncWorkoutToWatch } = require("../modules/watch-connectivity");
    const { supabase } = require("../lib/supabase");
    const { getNextWorkoutForWatch } = require("../lib/getNextWorkoutForWatch");
    const router = useRouter();
    const pathname = usePathname();
    const lastStartRef = React.useRef<{ workoutId: string; ts: number } | null>(null);
    const lastFinishRef = React.useRef<{ workoutId: string; ts: number } | null>(null);

    const onWatchStartWorkout = React.useCallback(
        async ({ workoutId }: { workoutId: string }) => {
            const now = Date.now();
            const last = lastStartRef.current;

            if (last && last.workoutId === workoutId && now - last.ts < 1200) {
                return;
            }

            lastStartRef.current = { workoutId, ts: now };

            console.log(`[Layout] Watch requested START_WORKOUT: ${workoutId}`);

            // Pre-create workout_session (in_progress) so data survives even if
            // the app is killed before the workout screen mounts.
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: student }: { data: any } = await supabase
                        .from('students')
                        .select('id, coach_id')
                        .eq('auth_user_id', user.id)
                        .maybeSingle();

                    if (student) {
                        const { data: existing }: { data: any } = await supabase
                            .from('workout_sessions')
                            .select('id')
                            .eq('assigned_workout_id', workoutId)
                            .eq('student_id', student.id)
                            .eq('status', 'in_progress')
                            .maybeSingle();

                        if (!existing) {
                            const { data: workout }: { data: any } = await supabase
                                .from('assigned_workouts')
                                .select('assigned_program_id')
                                .eq('id', workoutId)
                                .maybeSingle();

                            const { data: session, error } = await supabase
                                .from('workout_sessions')
                                .insert({
                                    student_id: student.id,
                                    trainer_id: student.coach_id,
                                    assigned_workout_id: workoutId,
                                    assigned_program_id: workout?.assigned_program_id,
                                    status: 'in_progress',
                                    started_at: new Date().toISOString(),
                                    sync_status: 'synced',
                                })
                                .select('id')
                                .single();

                            if (error) {
                                console.error('[Layout] Failed to pre-create session:', error);
                            } else {
                                console.log(`[Layout] Pre-created in_progress session: ${session.id}`);
                            }
                        } else {
                            console.log(`[Layout] Session already exists for ${workoutId}: ${existing.id}`);
                        }
                    }
                }
            } catch (e: any) {
                console.warn(`[Layout] Non-critical: pre-create session failed: ${e?.message}`);
            }

            const targetPath = `/workout/${workoutId}`;
            if (pathname !== targetPath) {
                router.push({
                    pathname: "/workout/[id]",
                    params: { id: workoutId },
                });
            }
        },
        [pathname, router]
    );

    const onWatchFinishWorkout = React.useCallback(
        async ({ workoutId, rpe, startedAt, exercises }: {
            workoutId: string;
            rpe: number;
            startedAt?: string;
            exercises?: any[];
        }) => {
            const now = Date.now();
            const last = lastFinishRef.current;

            // Dedup: ignore duplicate events within 5 seconds
            if (last && last.workoutId === workoutId && now - last.ts < 5000) {
                return;
            }
            lastFinishRef.current = { workoutId, ts: now };

            console.log(`[Layout] Watch requested FINISH_WORKOUT: ${workoutId}`);

            try {
                const sessionId = await finishWorkoutFromWatch({
                    workoutId,
                    rpe,
                    startedAt,
                    exercises,
                });

                if (sessionId) {
                    console.log(`[Layout] Workout saved from watch: session ${sessionId}. Sending ACK.`);

                    // Send SYNC_SUCCESS ACK to Watch so it clears the pending finish entry.
                    try {
                        sendAckToWatch(workoutId);
                        console.log(`[Layout] SYNC_SUCCESS ACK sent for ${workoutId}`);
                    } catch (ackError: any) {
                        console.warn(`[Layout] Failed to send ACK (non-critical): ${ackError?.message}`);
                    }

                    // Re-sync: send the NEXT pending workout to Watch (or null if all done).
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            const nextPayload = await getNextWorkoutForWatch(user.id);
                            syncWorkoutToWatch(nextPayload);
                            console.log(`[Layout] Re-synced next workout after completion: ${nextPayload?.workoutName ?? 'none'}`);
                        }
                    } catch (syncError: any) {
                        console.warn(`[Layout] Failed to re-sync next workout (non-critical): ${syncError?.message}`);
                    }

                    Alert.alert(
                        "Treino Concluído!",
                        "Seu treino foi salvo com sucesso pelo Apple Watch.",
                        [{ text: "OK", onPress: () => router.replace('/(tabs)/home') }]
                    );
                } else {
                    console.error('[Layout] finishWorkoutFromWatch returned null');
                    Alert.alert("Erro", "Não foi possível salvar o treino do Apple Watch.");
                }
            } catch (error) {
                console.error('[Layout] Error finishing workout from watch:', error);
                Alert.alert("Erro", "Falha ao salvar o treino do Apple Watch.");
            }
        },
        [router]
    );

    useWatchConnectivity({ onWatchStartWorkout, onWatchFinishWorkout });

    // Lifecycle log for debugging Watch → iPhone data flow
    React.useEffect(() => {
        console.log('[WatchBridge] 🚀 MOUNTED');
        return () => console.log('[WatchBridge] 💀 UNMOUNTED');
    }, []);

    // Process any workouts queued in SecureStore (from previous failed auth attempts).
    // Immediate attempt + delayed retry (auth may still be loading on cold start).
    React.useEffect(() => {
        processPendingWatchWorkouts();
        const timer = setTimeout(() => processPendingWatchWorkouts(), 5000);
        return () => clearTimeout(timer);
    }, []);

    // Auto-sync: send today's next pending workout to Watch on app launch.
    // Multiple retries with increasing delays — auth may still be loading on cold start.
    React.useEffect(() => {
        let synced = false;

        async function trySyncNextWorkout() {
            if (synced) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const payload = await getNextWorkoutForWatch(user.id);
                syncWorkoutToWatch(payload); // null clears the Watch (hasWorkout: false)
                synced = true;
                console.log(`[WatchBridge] Auto-synced workout to Watch: ${payload?.workoutName ?? 'none (all done or rest day)'}`);
            } catch (e: any) {
                console.warn(`[WatchBridge] Failed to auto-sync workout: ${e?.message}`);
            }
        }

        trySyncNextWorkout();
        const t1 = setTimeout(trySyncNextWorkout, 3000);
        const t2 = setTimeout(trySyncNextWorkout, 8000);
        const t3 = setTimeout(trySyncNextWorkout, 15000);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, []);

    // Re-sync Watch when account changes (sign in / sign out).
    // signOut already clears Watch via AuthContext; this handles the new account sync.
    React.useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                console.log(`[WatchBridge] Auth SIGNED_IN detected — syncing Watch for new user`);
                try {
                    const payload = await getNextWorkoutForWatch(session.user.id);
                    syncWorkoutToWatch(payload);
                    console.log(`[WatchBridge] Re-synced Watch after account switch: ${payload?.workoutName ?? 'none'}`);
                } catch (e: any) {
                    console.warn(`[WatchBridge] Failed to re-sync Watch on SIGNED_IN: ${e?.message}`);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    return null;
}

export default function RootLayout() {
    console.log("[Layout] Renderizando Provider Wrapper");
    return (
        <>
            {/* WatchBridge MUST be outside AuthProvider so it mounts immediately,
                even while auth is still loading. It doesn't use useAuth() — all
                auth checks are done via supabase.auth.getUser() internally. */}
            {Platform.OS === 'ios' && <WatchBridge />}
            <AuthProvider>
                <SafeAreaProvider>
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: '#F2F2F7' },
                            gestureEnabled: true,
                            gestureDirection: 'horizontal',
                            animation: 'slide_from_right',
                            transitionSpec: {
                                open: PREMIUM_SPRING,
                                close: PREMIUM_SPRING,
                            },
                        }}
                    />
                </SafeAreaProvider>
            </AuthProvider>
        </>
    );
}
