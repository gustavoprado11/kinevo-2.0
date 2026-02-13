import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useStudentProfile } from "./useStudentProfile";

interface StudentAccess {
    allowed: boolean;
    reason: string;
    isLoading: boolean;
    refresh: () => void;
}

export function useStudentAccess(): StudentAccess {
    const { profile } = useStudentProfile();
    const [allowed, setAllowed] = useState(true);
    const [reason, setReason] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const checkAccess = useCallback(async () => {
        if (!profile?.id) {
            // No profile yet — allow access (safety / legacy student)
            setAllowed(true);
            setReason("no_profile");
            setIsLoading(false);
            return;
        }

        try {
            const { data, error }: { data: any; error: any } = await supabase
                .rpc("check_student_access" as any, { p_student_id: profile.id });

            if (error) {
                console.error("[useStudentAccess] RPC error:", error);
                // On error, allow access (safety — don't lock out)
                setAllowed(true);
                setReason("error");
                return;
            }

            if (data) {
                setAllowed(data.allowed ?? true);
                setReason(data.reason ?? "");
            } else {
                // No data returned — allow access
                setAllowed(true);
                setReason("no_data");
            }
        } catch (err) {
            console.error("[useStudentAccess] Error:", err);
            setAllowed(true);
            setReason("error");
        } finally {
            setIsLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        checkAccess();
    }, [checkAccess]);

    return { allowed, reason, isLoading, refresh: checkAccess };
}
