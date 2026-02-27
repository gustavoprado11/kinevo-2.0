import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
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

    console.log("[AuthProvider] Renderizando, isLoading:", isLoading);

    useEffect(() => {
        console.log("[AuthProvider] useEffect - Buscando sessão...");

        supabase.auth
            .getSession()
            .then(({ data: { session }, error }) => {
                console.log("[AuthProvider] getSession resultado:", {
                    hasSession: !!session,
                    error: error?.message,
                });
                if (error) {
                    setError(error.message);
                }
                setSession(session);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error("[AuthProvider] Erro ao buscar sessão:", err);
                setError(err.message);
                setIsLoading(false);
            });

        // Escutar mudanças de auth
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log("[AuthProvider] onAuthStateChange:", _event);
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

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
                const { syncWorkoutToWatch } = require("../modules/watch-connectivity");
                syncWorkoutToWatch(null);
                console.log("[AuthContext] Cleared Watch workout on sign out");
            } catch (e: any) {
                console.warn("[AuthContext] Failed to clear Watch (non-critical):", e?.message);
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
                    Erro de Conexão
                </Text>
                <Text
                    style={{ color: "#71717a", marginTop: 8, textAlign: "center" }}
                >
                    {error}
                </Text>
                <Text
                    style={{ color: "#3b82f6", marginTop: 16, fontSize: 12 }}
                >
                    Verifique o arquivo .env
                </Text>
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
