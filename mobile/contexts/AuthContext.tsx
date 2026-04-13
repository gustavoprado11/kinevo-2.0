import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { Platform, View, Text, ActivityIndicator, TouchableOpacity, AppState } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    isEmailVerified: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    if (__DEV__) console.log("[AuthProvider] Renderizando, isLoading:", isLoading);

    const loadSession = useCallback(async () => {
        if (__DEV__) console.log("[AuthProvider] Buscando sessão...");
        setIsLoading(true);
        setError(null);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (__DEV__) console.log("[AuthProvider] getSession resultado:", {
                hasSession: !!session,
                error: sessionError?.message,
            });
            if (sessionError) {
                setError(sessionError.message);
            }
            setSession(session);
        } catch (err: any) {
            const msg = err?.message ?? "Erro desconhecido";
            console.error("[AuthProvider] Erro ao buscar sessão:", __DEV__ ? err : "");

            // SecureStore "User interaction is not allowed" — transient error when
            // app launches in background (e.g., after Watch workout). Auto-retry
            // when app comes to foreground.
            if (msg.includes("User interaction is not allowed")) {
                setError("keychain_locked");
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSession();

        // Escutar mudanças de auth
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (__DEV__) console.log("[AuthProvider] onAuthStateChange:", _event);
            setSession(session);
            // If we had a keychain error and auth state changed, clear error
            setError(null);
        });

        // Auto-retry when app comes to foreground (covers Watch background launch)
        const appStateSub = AppState.addEventListener("change", (state) => {
            if (state === "active" && error === "keychain_locked") {
                if (__DEV__) console.log("[AuthProvider] App foregrounded — retrying session load");
                loadSession();
            }
        });

        return () => {
            subscription.unsubscribe();
            appStateSub.remove();
        };
    }, [loadSession]);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error: error as Error | null };
    };

    const signOut = async () => {
        // Clear Watch workout state so the old account's workout doesn't persist.
        if (Platform.OS === "ios") {
            try {
                const { syncProgramToWatch } = require("../modules/watch-connectivity");
                syncProgramToWatch(null);
                if (__DEV__) console.log("[AuthContext] Cleared Watch program on sign out");
            } catch (e: any) {
                if (__DEV__) console.warn("[AuthContext] Failed to clear Watch (non-critical):", e?.message);
            }
        }
        await supabase.auth.signOut();
    };

    // Mostrar loading visual enquanto carrega
    if (isLoading) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#18181b",
                }}
            >
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: "#71717a", marginTop: 16 }}>
                    Carregando sessão...
                </Text>
            </View>
        );
    }

    // Mostrar erro se houver
    if (error) {
        const isKeychainError = error === "keychain_locked";
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#18181b",
                    padding: 20,
                }}
            >
                <Text style={{ color: "#ef4444", fontSize: 18, fontWeight: "bold" }}>
                    {isKeychainError ? "Aguardando Desbloqueio" : "Erro de Conexão"}
                </Text>
                <Text
                    style={{ color: "#71717a", marginTop: 8, textAlign: "center", lineHeight: 20 }}
                >
                    {isKeychainError
                        ? "O app foi aberto em segundo plano e precisa ser desbloqueado para acessar suas credenciais."
                        : error}
                </Text>
                <TouchableOpacity
                    onPress={loadSession}
                    style={{
                        marginTop: 24,
                        backgroundColor: "#7c3aed",
                        borderRadius: 12,
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                    }}
                >
                    <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
                        Tentar Novamente
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isEmailVerified = !!session?.user?.email_confirmed_at;

    return (
        <AuthContext.Provider
            value={{
                session,
                user: session?.user ?? null,
                isLoading,
                isEmailVerified,
                error,
                signIn,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
