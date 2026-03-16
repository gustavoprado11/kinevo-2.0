import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Role = "student" | "trainer" | null;
type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none" | null;

interface TrainerProfile {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
}

interface RoleModeContextType {
    role: Role;
    isTrainer: boolean;
    isStudent: boolean;
    trainerId: string | null;
    trainerProfile: TrainerProfile | null;
    subscriptionStatus: SubscriptionStatus;
    isLoadingRole: boolean;
    switchToTrainer: () => void;
    switchToStudent: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_KEY = "kinevo-last-role";

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const RoleModeContext = createContext<RoleModeContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function RoleModeProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [role, setRole] = useState<Role>(null);
    const [isTrainer, setIsTrainer] = useState(false);
    const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
    const [isLoadingRole, setIsLoadingRole] = useState(true);

    // Resolve role when user changes
    useEffect(() => {
        if (!user) {
            setRole(null);
            setIsTrainer(false);
            setTrainerProfile(null);
            setSubscriptionStatus(null);
            setIsLoadingRole(false);
            return;
        }

        let cancelled = false;

        (async () => {
            setIsLoadingRole(true);

            try {
                // 1. Check if user is a trainer
                const { data: trainerCheck } = await supabase.rpc("is_trainer" as any);
                const userIsTrainer = trainerCheck === true;

                if (cancelled) return;
                setIsTrainer(userIsTrainer);

                if (userIsTrainer) {
                    // 2. Fetch trainer profile
                    const { data: trainer }: { data: any } = await supabase
                        .from("trainers" as any)
                        .select("id, name, email, avatar_url")
                        .eq("auth_user_id", user.id)
                        .single();

                    if (cancelled) return;

                    if (trainer) {
                        setTrainerProfile({
                            id: trainer.id,
                            name: trainer.name,
                            email: trainer.email,
                            avatar_url: trainer.avatar_url,
                        });

                        // 3. Fetch subscription status
                        const { data: sub }: { data: any } = await supabase
                            .from("subscriptions" as any)
                            .select("status, current_period_end")
                            .eq("trainer_id", trainer.id)
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (cancelled) return;

                        if (sub) {
                            setSubscriptionStatus(sub.status as SubscriptionStatus);
                        } else {
                            setSubscriptionStatus("none");
                        }
                    }

                    // 4. Read persisted role preference
                    const savedRole = await SecureStore.getItemAsync(ROLE_KEY);
                    if (cancelled) return;

                    if (savedRole === "trainer" || savedRole === "student") {
                        setRole(savedRole);
                    } else {
                        // No saved preference → show role picker
                        setRole(null);
                    }
                } else {
                    // Student-only user → auto-assign
                    setRole("student");
                    setTrainerProfile(null);
                    setSubscriptionStatus(null);
                }
            } catch (err) {
                if (__DEV__) console.error("[RoleModeContext] Error resolving role:", err);
                // Default to student on error
                if (!cancelled) setRole("student");
            } finally {
                if (!cancelled) setIsLoadingRole(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const switchToTrainer = useCallback(() => {
        setRole("trainer");
        SecureStore.setItemAsync(ROLE_KEY, "trainer").catch(() => {});
    }, []);

    const switchToStudent = useCallback(() => {
        setRole("student");
        SecureStore.setItemAsync(ROLE_KEY, "student").catch(() => {});
    }, []);

    const value = useMemo<RoleModeContextType>(
        () => ({
            role,
            isTrainer,
            isStudent: true, // Every user is always a student (migration 031)
            trainerId: trainerProfile?.id ?? null,
            trainerProfile,
            subscriptionStatus,
            isLoadingRole,
            switchToTrainer,
            switchToStudent,
        }),
        [role, isTrainer, trainerProfile, subscriptionStatus, isLoadingRole, switchToTrainer, switchToStudent]
    );

    return (
        <RoleModeContext.Provider value={value}>
            {children}
        </RoleModeContext.Provider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useRoleMode() {
    const context = useContext(RoleModeContext);
    if (context === undefined) {
        throw new Error("useRoleMode must be used within a RoleModeProvider");
    }
    return context;
}
