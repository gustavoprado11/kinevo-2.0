import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { EventSubscription } from "expo-modules-core";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";
import { useNotificationStore } from "../stores/notification-store";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

/**
 * Resolve the EAS projectId in the order Expo recommends:
 * 1. Constants.expoConfig?.extra?.eas?.projectId  (managed config — set in app.json)
 * 2. Constants.easConfig?.projectId               (legacy)
 * 3. process.env.EXPO_PUBLIC_EAS_PROJECT_ID       (escape hatch via env)
 *
 * In standalone builds, env vars are baked at build time and may not be present.
 * The app.json value is always available, so it must be the primary source.
 */
function resolveProjectId(): string | undefined {
    const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId;
    const fromLegacy = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    return fromExtra ?? fromLegacy ?? fromEnv;
}

function getCategoryFromType(type: string): string {
    if (['form_request', 'feedback', 'form_submission'].includes(type)) return 'forms';
    if (['payment_received', 'payment_failed', 'payment_overdue', 'subscription_canceled', 'cancellation_alert', 'charge_created'].includes(type)) return 'payments';
    if (['program_assigned', 'program_expired'].includes(type)) return 'programs';
    return 'students';
}

/**
 * Registers for push notifications and sends the token to the backend.
 * Called every time the app opens in trainer mode (upsert = idempotent).
 */
async function registerForPushNotificationsAsync(): Promise<string | null> {
    if (Platform.OS === "web") return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== "granted") {
        if (__DEV__) console.log("[push] Permission not granted");
        return null;
    }

    const projectId = resolveProjectId();
    if (!projectId) {
        console.error(
            "[push] Missing EAS projectId. Set extra.eas.projectId in app.json or EXPO_PUBLIC_EAS_PROJECT_ID in .env.",
        );
        return null;
    }

    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        return tokenData.data;
    } catch (err) {
        console.error("[push] Failed to obtain Expo push token:", err);
        return null;
    }
}

async function registerTokenOnBackend(expoPushToken: string, role: "trainer" | "student") {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch(`${API_URL}/api/notifications/register-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                expoPushToken,
                role,
                platform: Platform.OS,
            }),
        });

        if (!res.ok) {
            console.error("[push] Failed to register token:", res.status);
        } else {
            if (__DEV__) console.log("[push] Token registered successfully");
        }
    } catch (err) {
        if (__DEV__) console.error("[push] Error registering token:", err);
    }
}

/**
 * Hook: manages push notification lifecycle.
 * - Requests permission + registers token on mount
 * - Sets up foreground notification handler
 * - Listens for notification taps and navigates via deep link
 * @param role - 'trainer' | 'student' | null (null = disabled)
 */
export function usePushNotifications(role: "trainer" | "student" | null) {
    const router = useRouter();
    const notificationListener = useRef<EventSubscription>(null);
    const responseListener = useRef<EventSubscription>(null);
    const incrementUnread = useNotificationStore((s) => s.incrementUnread);

    useEffect(() => {
        if (!role) return;

        // Register token with the correct role
        registerForPushNotificationsAsync().then((token) => {
            if (token) {
                registerTokenOnBackend(token, role);
            }
        });

        // Foreground: show notification as banner + list
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });

        // Listen for incoming notifications (foreground) — persist to DB
        notificationListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
            if (__DEV__) console.log("[push] Notification received:", notification.request.content.title);

            if (role === "trainer") {
                const content = notification.request.content;
                const notifData = (content.data ?? {}) as Record<string, string>;
                const notifType = notifData.type ?? "unknown";

                // trainer_notifications.trainer_id referencia trainers.id (não auth.uid).
                const authUid = (await supabase.auth.getUser()).data.user?.id;
                if (!authUid) return;
                const { data: trainerRow } = await (supabase as any)
                    .from("trainers")
                    .select("id")
                    .eq("auth_user_id", authUid)
                    .single();
                const trainerId = trainerRow?.id as string | undefined;
                if (!trainerId) {
                    if (__DEV__) console.warn("[push] Sem perfil de treinador para o usuário; notificação não persistida");
                    return;
                }

                const { error } = await (supabase as any).from("trainer_notifications").insert({
                    trainer_id: trainerId,
                    type: notifType,
                    category: getCategoryFromType(notifType),
                    title: content.title ?? "Notificação",
                    body: content.body ?? null,
                    data: notifData,
                });

                if (!error) {
                    incrementUnread();
                } else if (__DEV__) {
                    console.error("[push] Failed to persist notification:", error.message);
                }
            }
        });

        // Listen for notification taps — deep link based on data.type
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            if (__DEV__) console.log("[push] Notification tapped, data:", data);

            const type = data?.type as string | undefined;

            switch (type) {
                case "form_request":
                case "feedback":
                    if (data?.inbox_item_id) {
                        router.push({
                            pathname: "/inbox/[id]",
                            params: { id: data.inbox_item_id as string },
                        });
                    }
                    break;
                case "message":
                case "student_message":
                case "text_message":
                    if (role === 'trainer' && (data?.studentId || data?.student_id)) {
                        const sid = (data.studentId || data.student_id) as string;
                        router.push({
                            pathname: '/messages/[studentId]',
                            params: { studentId: sid },
                        } as any);
                    } else {
                        router.push("/(tabs)/inbox");
                    }
                    break;
                case "program_assigned":
                    // Navigate to home so the student sees the new program
                    router.push("/(tabs)/home");
                    break;
                case "workout_completed":
                    if (data?.student_id) {
                        router.push({
                            pathname: "/student/[id]",
                            params: { id: data.student_id as string },
                        });
                    } else {
                        router.push("/(trainer-tabs)/dashboard");
                    }
                    break;
                case "new_student":
                case "program_expired":
                    if (data?.student_id) {
                        router.push({
                            pathname: "/student/[id]",
                            params: { id: data.student_id as string },
                        });
                    }
                    break;
                case "payment_received":
                case "payment_failed":
                case "payment_overdue":
                case "subscription_canceled":
                case "cancellation_alert":
                    if (data?.contract_id) {
                        router.push({
                            pathname: "/financial/contract/[id]",
                            params: { id: data.contract_id as string },
                        });
                    } else {
                        router.push("/financial");
                    }
                    break;
                case "charge_created":
                    // Push do ALUNO: nova cobrança do treinador → paga in-app.
                    router.push("/payment");
                    break;
                default:
                    // Fallback: legacy routing by field presence
                    if (data?.contract_id) {
                        router.push({
                            pathname: "/financial/contract/[id]",
                            params: { id: data.contract_id as string },
                        });
                    } else if (data?.student_id) {
                        router.push({
                            pathname: "/student/[id]",
                            params: { id: data.student_id as string },
                        });
                    }
                    break;
            }
        });

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, [role, router, incrementUnread]);
}
