import { useState, useCallback } from "react";
import {
    FunctionsHttpError,
    FunctionsRelayError,
    FunctionsFetchError,
} from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface CreateStudentData {
    name: string;
    email: string;
    phone: string;
    modality: "online" | "presential";
}

export interface CreateStudentResult {
    success: boolean;
    studentId?: string;
    email?: string;
    password?: string;
    name?: string;
    whatsapp?: string | null;
    error?: string;
}

export function useCreateStudent() {
    const [isCreating, setIsCreating] = useState(false);

    const createStudent = useCallback(async (data: CreateStudentData): Promise<CreateStudentResult> => {
        setIsCreating(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            if (!session?.session?.access_token) {
                return { success: false, error: "Sessão expirada. Faça login novamente." };
            }

            const response = await supabase.functions.invoke("create-student", {
                body: data,
            });

            if (response.error) {
                if (response.error instanceof FunctionsHttpError) {
                    try {
                        const errorBody = await response.error.context.json();
                        return {
                            success: false,
                            error:
                                errorBody?.error ??
                                errorBody?.message ??
                                "Erro ao criar aluno.",
                        };
                    } catch {
                        return {
                            success: false,
                            error: "Erro ao criar aluno. Tente novamente.",
                        };
                    }
                }
                if (
                    response.error instanceof FunctionsRelayError ||
                    response.error instanceof FunctionsFetchError
                ) {
                    return {
                        success: false,
                        error: "Erro de rede. Verifique sua conexão.",
                    };
                }
                return { success: false, error: response.error.message || "Erro ao criar aluno" };
            }

            return response.data as CreateStudentResult;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Erro inesperado.";
            return { success: false, error: message };
        } finally {
            setIsCreating(false);
        }
    }, []);

    return { createStudent, isCreating };
}
