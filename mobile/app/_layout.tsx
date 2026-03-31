import React from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { Alert, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import { RoleModeProvider, useRoleMode } from "../contexts/RoleModeContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import "../global.css";

if (__DEV__) console.log("[Layout] Iniciando RootLayout");

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
    const { sendAckToWatch, syncProgramToWatch, sendMessage } = require("../modules/watch-connectivity");
    const { appEvents, WORKOUT_COMPLETED, WATCH_WORKOUT_FINISHED } = require("../lib/events");
    const { supabase } = require("../lib/supabase");
    const { getProgramSnapshotForWatch } = require("../lib/getProgramSnapshotForWatch");
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

            if (__DEV__) console.log(`[Layout] Watch requested START_WORKOUT: ${workoutId}`);

            // Send correct exercise order directly to Watch via sendMessage (immediate delivery).
            // applicationContext (syncProgramToWatch) is eventual and arrives too late —
            // the Watch has already loaded the workout from the cached snapshot by then.
            try {
                const { data: { user: syncUser } } = await supabase.auth.getUser();
                if (syncUser) {
                    const freshPayload = await getProgramSnapshotForWatch(syncUser.id);
                    syncProgramToWatch(freshPayload);

                    // Extract exercise IDs in correct order for this specific workout
                    const workoutData = freshPayload?.workouts?.find((w: any) => w.workoutId === workoutId);
                    if (workoutData?.exercises?.length) {
                        const exerciseIds = workoutData.exercises.map((e: any) => e.id);
                        sendMessage({
                            type: 'UPDATE_EXERCISE_ORDER',
                            payload: { workoutId, exerciseIds },
                        }).catch(() => {});  // fire-and-forget, Watch may not be reachable
                    }
                }
            } catch (syncErr: any) {
                if (__DEV__) console.warn(`[Layout] Re-sync failed (non-critical): ${syncErr?.message}`);
            }

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

                            if (!workout?.assigned_program_id || !student.coach_id) {
                                if (__DEV__) console.warn(
                                    `[Layout] Cannot pre-create session: assigned_program_id=${workout?.assigned_program_id}, coach_id=${student.coach_id}`
                                );
                            } else {
                                const { data: session, error } = await supabase
                                    .from('workout_sessions')
                                    .insert({
                                        student_id: student.id,
                                        trainer_id: student.coach_id,
                                        assigned_workout_id: workoutId,
                                        assigned_program_id: workout.assigned_program_id,
                                        status: 'in_progress',
                                        started_at: new Date().toISOString(),
                                        sync_status: 'synced',
                                    })
                                    .select('id')
                                    .single();

                                if (error) {
                                    if (__DEV__) console.error('[Layout] Failed to pre-create session:', error);
                                } else {
                                    if (__DEV__) console.log(`[Layout] Pre-created in_progress session: ${session.id}`);
                                }
                            }
                        } else {
                            if (__DEV__) console.log(`[Layout] Session already exists for ${workoutId}: ${existing.id}`);
                        }
                    }
                }
            } catch (e: any) {
                if (__DEV__) console.warn(`[Layout] Non-critical: pre-create session failed: ${e?.message}`);
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

            if (__DEV__) console.log(`[Layout] Watch requested FINISH_WORKOUT: ${workoutId}`);

            try {
                const sessionId = await finishWorkoutFromWatch({
                    workoutId,
                    rpe,
                    startedAt,
                    exercises,
                });

                if (sessionId) {
                    if (__DEV__) console.log(`[Layout] Workout saved from watch: session ${sessionId}. Sending ACK.`);

                    // Notify useActiveProgram to refresh (works even if user is already on Home tab)
                    appEvents.emit(WORKOUT_COMPLETED);

                    // Send SYNC_SUCCESS ACK to Watch so it clears the pending finish entry.
                    try {
                        sendAckToWatch(workoutId);
                        if (__DEV__) console.log(`[Layout] SYNC_SUCCESS ACK sent for ${workoutId}`);
                    } catch (ackError: any) {
                        if (__DEV__) console.warn(`[Layout] Failed to send ACK (non-critical): ${ackError?.message}`);
                    }

                    // Re-sync: send updated program snapshot to Watch (with completion status).
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            const programPayload = await getProgramSnapshotForWatch(user.id);
                            syncProgramToWatch(programPayload);
                            if (__DEV__) console.log(`[Layout] Re-synced program after completion: ${programPayload?.programName ?? 'none'}`);
                        }
                    } catch (syncError: any) {
                        if (__DEV__) console.warn(`[Layout] Failed to re-sync program (non-critical): ${syncError?.message}`);
                    }

                    // Notify the workout screen (if mounted) to stop timer and allow navigation.
                    appEvents.emit(WATCH_WORKOUT_FINISHED, { workoutId });

                    // Navigate directly — no Alert required. The user is on the Watch,
                    // so a blocking Alert would go unseen. The beforeRemove guard in
                    // workout/[id].tsx already allows navigation when watchFinishState.isFinished().
                    router.replace('/(tabs)/home');
                } else {
                    console.error('[Layout] finishWorkoutFromWatch returned null');
                }
            } catch (error: any) {
                console.error('[Layout] Error finishing workout from watch:', error?.message ?? error);
            }
        },
        [router]
    );

    const onWatchDiscardWorkout = React.useCallback(
        async ({ workoutId }: { workoutId: string }) => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: student }: { data: any } = await supabase
                    .from('students')
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .maybeSingle();
                if (!student) return;

                const { error } = await supabase
                    .from('workout_sessions')
                    .update({ status: 'abandoned' })
                    .eq('assigned_workout_id', workoutId)
                    .eq('student_id', student.id)
                    .eq('status', 'in_progress');

                if (error) {
                    if (__DEV__) console.error('[Layout] Failed to mark session as abandoned:', error);
                } else {
                    if (__DEV__) console.log(`[Layout] Marked session for ${workoutId} as abandoned (Watch discard)`);
                }
            } catch (e: any) {
                if (__DEV__) console.warn(`[Layout] Discard cleanup failed: ${e?.message}`);
            }

            // Close the workout screen on the phone (same pattern as onWatchFinishWorkout)
            appEvents.emit(WATCH_WORKOUT_FINISHED, { workoutId });
            router.replace('/(tabs)/home');
        },
        [router]
    );

    useWatchConnectivity({ onWatchStartWorkout, onWatchFinishWorkout, onWatchDiscardWorkout });

    // Lifecycle log for debugging Watch → iPhone data flow
    React.useEffect(() => {
        if (__DEV__) console.log('[WatchBridge] MOUNTED');
        return () => { if (__DEV__) console.log('[WatchBridge] UNMOUNTED'); };
    }, []);

    // Cleanup stale in_progress sessions (>24h old → abandoned)
    React.useEffect(() => {
        async function cleanupStaleSessions() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: student }: { data: any } = await supabase
                    .from('students')
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .maybeSingle();
                if (!student) return;
                const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { data: stale } = await supabase
                    .from('workout_sessions')
                    .update({ status: 'abandoned' })
                    .eq('student_id', student.id)
                    .eq('status', 'in_progress')
                    .lt('started_at', cutoff)
                    .select('id');
                if (stale && stale.length > 0) {
                    if (__DEV__) console.log(`[WatchBridge] Cleaned up ${stale.length} stale in_progress session(s)`);
                }
            } catch (e: any) {
                if (__DEV__) console.warn(`[WatchBridge] Stale session cleanup failed: ${e?.message}`);
            }
        }
        cleanupStaleSessions();
    }, []);

    // Process any workouts queued in SecureStore (from previous failed auth attempts).
    // Immediate attempt + delayed retry (auth may still be loading on cold start).
    React.useEffect(() => {
        processPendingWatchWorkouts();
        const timer = setTimeout(() => processPendingWatchWorkouts(), 5000);
        return () => clearTimeout(timer);
    }, []);

    // Auto-sync: send full program snapshot to Watch on app launch.
    // Multiple retries with increasing delays — auth may still be loading on cold start.
    React.useEffect(() => {
        let synced = false;

        async function trySyncProgram() {
            if (synced) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const payload = await getProgramSnapshotForWatch(user.id);
                syncProgramToWatch(payload); // null clears the Watch (hasProgram: false)
                synced = true;
                if (__DEV__) console.log(`[WatchBridge] Auto-synced program to Watch: ${payload?.programName ?? 'none (no active program)'}`);
            } catch (e: any) {
                if (__DEV__) console.warn(`[WatchBridge] Failed to auto-sync program: ${e?.message}`);
            }
        }

        trySyncProgram();
        const t1 = setTimeout(trySyncProgram, 3000);
        const t2 = setTimeout(trySyncProgram, 8000);
        const t3 = setTimeout(trySyncProgram, 15000);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, []);

    // Re-sync Watch when account changes (sign in / sign out).
    // signOut already clears Watch via AuthContext; this handles the new account sync.
    React.useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
            if (event === 'SIGNED_IN' && session?.user) {
                if (__DEV__) console.log(`[WatchBridge] Auth SIGNED_IN detected — syncing Watch for new user`);
                try {
                    const payload = await getProgramSnapshotForWatch(session.user.id);
                    syncProgramToWatch(payload);
                    if (__DEV__) console.log(`[WatchBridge] Re-synced Watch after account switch: ${payload?.programName ?? 'none'}`);
                } catch (e: any) {
                    if (__DEV__) console.warn(`[WatchBridge] Failed to re-sync Watch on SIGNED_IN: ${e?.message}`);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    return null;
}

/** Activates push notifications for both trainer and student modes. */
function PushNotificationBridge() {
    const { role } = useRoleMode();
    usePushNotifications(role);
    return null;
}

export default function RootLayout() {
    if (__DEV__) console.log("[Layout] Renderizando Provider Wrapper");
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            {/* WatchBridge MUST be outside AuthProvider so it mounts immediately,
                even while auth is still loading. It doesn't use useAuth() — all
                auth checks are done via supabase.auth.getUser() internally. */}
            {Platform.OS === 'ios' && <WatchBridge />}
            <AuthProvider>
                <RoleModeProvider>
                    <PushNotificationBridge />
                    <SafeAreaProvider>
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: '#F2F2F7' },
                                gestureEnabled: true,
                                gestureDirection: 'horizontal',
                                animation: 'slide_from_right',
                            }}
                        />
                    </SafeAreaProvider>
                </RoleModeProvider>
            </AuthProvider>
        </GestureHandlerRootView>
    );
}
