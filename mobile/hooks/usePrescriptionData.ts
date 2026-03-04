import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export interface PrescriptionProfile {
    id: string;
    training_level: "beginner" | "intermediate" | "advanced";
    goal: "hypertrophy" | "weight_loss" | "performance" | "health";
    available_days: number[];
    session_duration_minutes: number;
    available_equipment: string[];
    medical_restrictions: { description: string }[];
    ai_mode: "auto" | "copilot" | "assistant";
    updated_at: string;
}

export function usePrescriptionData(studentId: string | null) {
    const { trainerId } = useRoleMode();
    const [profile, setProfile] = useState<PrescriptionProfile | null>(null);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!trainerId || !studentId) return;

        try {
            // Fetch prescription profile from student detail RPC
            const { data, error: rpcError } = await supabase.rpc(
                "get_student_profile_detail" as any,
                { p_student_id: studentId }
            );
            if (rpcError) throw new Error(rpcError.message);

            const result = data as any;
            setProfile(result?.prescriptionProfile || null);
            setAiEnabled(result?.aiEnabled || false);
            setError(null);
        } catch (err: any) {
            console.error("[usePrescriptionData] fetch error:", err);
            setError(err.message);
        }
    }, [trainerId, studentId]);

    useEffect(() => {
        if (!trainerId || !studentId) return;

        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchData();
            if (mounted) setIsLoading(false);
        })();

        return () => { mounted = false; };
    }, [trainerId, studentId, fetchData]);

    return { profile, aiEnabled, isLoading, error, refresh: fetchData };
}
