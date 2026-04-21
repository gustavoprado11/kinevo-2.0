import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type ResetPasswordResult =
    | { success: true; newPassword: string }
    | { success: false; error: string };

export function useResetStudentPassword() {
    const [isResetting, setIsResetting] = useState(false);

    const resetPassword = useCallback(
        async (studentId: string): Promise<ResetPasswordResult> => {
            setIsResetting(true);
            try {
                const { data: session } = await supabase.auth.getSession();
                if (!session?.session?.access_token) {
                    return {
                        success: false,
                        error: "Sessão expirada. Faça login novamente.",
                    };
                }

                const response = await supabase.functions.invoke(
                    "reset-student-password",
                    { body: { studentId } }
                );

                if (response.error) {
                    let backendMessage: string | undefined;
                    const ctx = (response.error as { context?: Response }).context;
                    if (ctx && typeof ctx.json === "function") {
                        try {
                            const parsed = (await ctx.json()) as { error?: string } | null;
                            backendMessage = parsed?.error;
                        } catch {
                            // body not JSON — fall through
                        }
                    }
                    const data = response.data as { error?: string } | null;
                    const message =
                        backendMessage ||
                        data?.error ||
                        response.error.message ||
                        "Erro ao redefinir a senha do aluno.";
                    return { success: false, error: message };
                }

                const data = response.data as
                    | { success: true; newPassword: string }
                    | { success: false; error: string }
                    | null;

                if (!data) {
                    return {
                        success: false,
                        error: "Resposta inválida do servidor.",
                    };
                }

                if (data.success === true && typeof data.newPassword === "string") {
                    return { success: true, newPassword: data.newPassword };
                }

                return {
                    success: false,
                    error:
                        ("error" in data && data.error) ||
                        "Erro ao redefinir a senha do aluno.",
                };
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Erro inesperado.";
                return { success: false, error: message };
            } finally {
                setIsResetting(false);
            }
        },
        []
    );

    return { resetPassword, isResetting };
}
