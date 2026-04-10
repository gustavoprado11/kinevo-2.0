import { useState, useCallback } from "react";
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
                return { success: false, error: response.error.message || "Erro ao criar aluno" };
            }

            return response.data as CreateStudentResult;
        } catch (err: any) {
            return { success: false, error: err.message || "Erro inesperado" };
        } finally {
            setIsCreating(false);
        }
    }, []);

    return { createStudent, isCreating };
}
