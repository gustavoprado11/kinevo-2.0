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

export type TrainerModalityFocus = "presencial" | "online" | "ambos";

interface TrainerProfile {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    /** Handle do Instagram (sem @). Null = trainer ainda não cadastrou. */
    instagram_handle: string | null;
    /** Foco de atendimento. Null = ainda não definido. */
    modality_focus: TrainerModalityFocus | null;
    /** Publica automaticamente os relatórios de treino pros alunos. */
    auto_publish_reports: boolean;
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
    refreshRoleMode: () => Promise<void>;
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

    const resolveRole = useCallback(async (currentUser: typeof user, cancelledRef?: { current: boolean }) => {
        if (!currentUser) {
            setRole(null);
            setIsTrainer(false);
            setTrainerProfile(null);
            setSubscriptionStatus(null);
            setIsLoadingRole(false);
            return;
        }

        const isCancelled = () => cancelledRef?.current === true;
        setIsLoadingRole(true);

        try {
            const { data: trainerCheck } = await supabase.rpc("is_trainer" as any);
            const userIsTrainer = trainerCheck === true;

            if (isCancelled()) return;
            setIsTrainer(userIsTrainer);

            if (userIsTrainer) {
                const { data: trainer }: { data: any } = await supabase
                    .from("trainers" as any)
                    .select("id, name, email, avatar_url, instagram_handle, modality_focus, auto_publish_reports")
                    .eq("auth_user_id", currentUser.id)
                    .single();

                if (isCancelled()) return;

                if (trainer) {
                    setTrainerProfile({
                        id: trainer.id,
                        name: trainer.name,
                        email: trainer.email,
                        avatar_url: trainer.avatar_url,
                        instagram_handle: trainer.instagram_handle ?? null,
                        modality_focus: (trainer.modality_focus as TrainerModalityFocus | null) ?? null,
                        auto_publish_reports: trainer.auto_publish_reports ?? false,
                    });

                    const { data: sub }: { data: any } = await supabase
                        .from("subscriptions" as any)
                        .select("status, current_period_end")
                        .eq("trainer_id", trainer.id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (isCancelled()) return;

                    if (sub) {
                        setSubscriptionStatus(sub.status as SubscriptionStatus);
                    } else {
                        setSubscriptionStatus("none");
                    }
                }

                const savedRole = await SecureStore.getItemAsync(ROLE_KEY, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }).catch(() => SecureStore.getItemAsync(ROLE_KEY).catch(() => null));
                if (isCancelled()) return;

                if (savedRole === "trainer" || savedRole === "student") {
                    setRole(savedRole);
                } else {
                    setRole(null);
                }
            } else {
                setRole("student");
                setTrainerProfile(null);
                setSubscriptionStatus(null);
            }
        } catch (err) {
            if (__DEV__) console.error("[RoleModeContext] Error resolving role:", err);
            if (!isCancelled()) setRole("student");
        } finally {
            if (!isCancelled()) setIsLoadingRole(false);
        }
    }, []);

    // Resolve role when user changes
    useEffect(() => {
        const cancelledRef = { current: false };
        resolveRole(user, cancelledRef);
        return () => {
            cancelledRef.current = true;
        };
    }, [user, resolveRole]);

    const refreshRoleMode = useCallback(async () => {
        await resolveRole(user);
    }, [user, resolveRole]);

    const switchToTrainer = useCallback(() => {
        setRole("trainer");
        SecureStore.setItemAsync(ROLE_KEY, "trainer", { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }).catch(() => {});
    }, []);

    const switchToStudent = useCallback(() => {
        setRole("student");
        SecureStore.setItemAsync(ROLE_KEY, "student", { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }).catch(() => {});
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
            refreshRoleMode,
        }),
        [role, isTrainer, trainerProfile, subscriptionStatus, isLoadingRole, switchToTrainer, switchToStudent, refreshRoleMode]
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
