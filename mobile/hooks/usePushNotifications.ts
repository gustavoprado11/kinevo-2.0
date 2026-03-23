import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { EventSubscription } from "expo-modules-core";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

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

    const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });

    return tokenData.data;
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

        // Listen for incoming notifications (foreground)
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            if (__DEV__) console.log("[push] Notification received:", notification.request.content.title);
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
    }, [role, router]);
}
