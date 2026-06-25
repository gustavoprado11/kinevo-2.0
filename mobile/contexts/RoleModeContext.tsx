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
import { useBrandStore } from "../stores/brandStore";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Role = "student" | "trainer" | null;
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none" | null;

/**
 * Paridade com a WEB (Fase 1 · Trilha 3): o HARD-BLOCK por assinatura foi
 * REMOVIDO. Nenhum treinador é barrado na entrada do modo treinador — quem não
 * tem plano pago ativo entra como "free" (limitado), exatamente como na web
 * (`web/.../lib/auth/get-ai-tier.ts`: sem assinatura ativa resolve p/ 'free' e
 * ENTRA; o `/subscription/blocked` virou tela de upgrade OPCIONAL).
 *
 * O gate antigo trancava indevidamente:
 *   • treinadores PAGANTES por um blip de rede / status transitório (`null`);
 *   • TODOS os treinadores de plano gratuito ("none"/"canceled"/"past_due"),
 *     que na web têm acesso.
 *
 * Limites por tier no mobile (cap de alunos, créditos de IA) são aplicados por
 * FEATURE e no SERVIDOR — não negando acesso ao modo treinador. Mantido como
 * no-op (em vez de remover os call sites) para reversão trivial se a política
 * mudar. O parâmetro é preservado p/ não mexer nos 4 chamadores.
 */
export function isTrainerSubscriptionBlocked(_status: SubscriptionStatus): boolean {
    return false;
}

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
    /** Marca personalizada (white-label leve). Aplicada ao app inteiro
     *  do trainer e ao app do aluno via brandStore. */
    brand_color: string | null;
    brand_logo_url: string | null;
    brand_name: string | null;
    brand_show_powered_by: boolean | null;
    branding_enabled: boolean | null;
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
                    .select("id, name, email, avatar_url, instagram_handle, modality_focus, auto_publish_reports, brand_color, brand_logo_url, brand_name, brand_show_powered_by, branding_enabled")
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
                        brand_color: trainer.brand_color ?? null,
                        brand_logo_url: trainer.brand_logo_url ?? null,
                        brand_name: trainer.brand_name ?? null,
                        brand_show_powered_by: trainer.brand_show_powered_by ?? null,
                        branding_enabled: trainer.branding_enabled ?? null,
                    });

                    // Aplica a marca do próprio trainer no app — pinta tab bar,
                    // CTAs e demais surfaces que consomem `colors.brand.*` via
                    // useV2Colors. No modo aluno, a home sobrescreve com a
                    // marca do coach (mesma store).
                    useBrandStore.getState().setBrandFromCoach({
                        brand_color: trainer.brand_color,
                        brand_logo_url: trainer.brand_logo_url,
                        brand_name: trainer.brand_name,
                        brand_show_powered_by: trainer.brand_show_powered_by,
                        branding_enabled: trainer.branding_enabled,
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
            // Não rebaixa o treinador por erro transitório de rede: restaura o
            // último papel salvo; só cai em "student" se nunca houve papel salvo.
            const savedRole = await SecureStore.getItemAsync(ROLE_KEY, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
                .catch(() => SecureStore.getItemAsync(ROLE_KEY).catch(() => null));
            if (!isCancelled()) {
                setRole(savedRole === "trainer" || savedRole === "student" ? savedRole : "student");
            }
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

    // Reaplica a marca do próprio trainer ao entrar no modo trainer — sem
    // isso, alunos dual-role veriam a marca do coach (setada por
    // app/(tabs)/home.tsx) "vazar" pra UI do trainer.
    useEffect(() => {
        if (role !== "trainer" || !trainerProfile) return;
        useBrandStore.getState().setBrandFromCoach({
            brand_color: trainerProfile.brand_color,
            brand_logo_url: trainerProfile.brand_logo_url,
            brand_name: trainerProfile.brand_name,
            brand_show_powered_by: trainerProfile.brand_show_powered_by,
            branding_enabled: trainerProfile.branding_enabled,
        });
    }, [role, trainerProfile]);

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
