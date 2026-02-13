import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface StudentProfile {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    status: string;
    coach?: {
        name: string;
        avatar_url: string | null;
    } | null;
}

export function useStudentProfile() {
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error }: { data: any; error: any } = await supabase
                .from("students" as any)
                .select("id, name, email, phone, avatar_url, status, trainers:coach_id (name, avatar_url)")
                .eq("auth_user_id", user.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setProfile({
                    id: data.id,
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    avatar_url: data.avatar_url,
                    status: data.status,
                    coach: data.trainers ? {
                        name: data.trainers.name,
                        avatar_url: data.trainers.avatar_url
                    } : null
                });
            }
        } catch (err) {
            console.error("[useStudentProfile] Error fetching profile:", err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const updateAvatar = useCallback(async (localUri: string) => {
        if (!user || !profile) return;

        try {
            setIsUploading(true);

            // Read the file as blob
            const response = await fetch(localUri);
            const blob = await response.blob();

            // Convert blob to ArrayBuffer for Supabase upload
            const arrayBuffer = await new Response(blob).arrayBuffer();

            const filePath = `${user.id}/avatar.jpg`;

            // Upload (upsert to replace existing)
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, arrayBuffer, {
                    contentType: "image/jpeg",
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(filePath);

            // Append cache-bust to force UI refresh
            const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

            // Update student record via RPC (students have SELECT-only RLS)
            const { error: updateError } = await supabase
                .rpc("update_student_avatar" as any, { p_avatar_url: publicUrl });

            if (updateError) throw updateError;

            // Update local state
            setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
        } catch (err) {
            console.error("[useStudentProfile] Error uploading avatar:", err);
            throw err;
        } finally {
            setIsUploading(false);
        }
    }, [user, profile]);

    const deleteAccount = useCallback(async () => {
        try {
            const { error } = await supabase.rpc("delete_student_account" as any);
            if (error) throw error;
            await signOut();
        } catch (err) {
            console.error("[useStudentProfile] Error deleting account:", err);
            throw err;
        }
    }, [signOut]);

    return {
        profile,
        isLoading,
        isUploading,
        refreshProfile: fetchProfile,
        updateAvatar,
        deleteAccount,
    };
}
