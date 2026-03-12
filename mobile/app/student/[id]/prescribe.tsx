import React, { useState, useCallback, useRef, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import { usePrescriptionData } from "../../../hooks/usePrescriptionData";
import { PrescriptionProfileForm } from "../../../components/trainer/prescription/PrescriptionProfileForm";
import { GenerationStatus } from "../../../components/trainer/prescription/GenerationStatus";
import { ProgramPreview } from "../../../components/trainer/prescription/ProgramPreview";

type WizardStep = "anamnese" | "generating" | "preview" | "error";

export default function PrescribeScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { profile, isLoading } = usePrescriptionData(id || null);

    const [step, setStep] = useState<WizardStep>("anamnese");
    const [isSaving, setIsSaving] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [generationResult, setGenerationResult] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const abortRef = useRef<AbortController | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTimer = () => {
        setElapsedSeconds(0);
        timerRef.current = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleSubmitProfile = useCallback(
        async (data: {
            training_level: string;
            goal: string;
            available_days: number[];
            session_duration_minutes: number;
            available_equipment: string[];
            medical_restrictions: { description: string; severity?: string }[];
            ai_mode: string;
        }) => {
            if (!id) return;
            setIsSaving(true);

            try {
                // 1. Save prescription profile via RPC
                const { error: upsertError } = await supabase.rpc(
                    "upsert_prescription_profile" as any,
                    {
                        p_student_id: id,
                        p_training_level: data.training_level,
                        p_goal: data.goal,
                        p_available_days: data.available_days,
                        p_session_duration_minutes: data.session_duration_minutes,
                        p_available_equipment: data.available_equipment,
                        p_medical_restrictions: JSON.stringify(data.medical_restrictions),
                        p_ai_mode: data.ai_mode,
                    }
                );

                if (upsertError) throw new Error(upsertError.message);

                // 2. Start generation
                setStep("generating");
                startTimer();

                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData?.session?.access_token;
                if (!token) throw new Error("Sessão expirada");

                const apiUrl = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";
                abortRef.current = new AbortController();

                const response = await fetch(`${apiUrl}/api/prescription/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ studentId: id }),
                    signal: abortRef.current.signal,
                });

                stopTimer();

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || "Falha ao gerar programa");
                }

                setGenerationResult(result);
                setStep("preview");
            } catch (err: any) {
                stopTimer();
                if (err.name === "AbortError") {
                    setStep("anamnese");
                    return;
                }
                setErrorMessage(err.message || "Erro ao gerar programa");
                setStep("error");
            } finally {
                setIsSaving(false);
            }
        },
        [id]
    );

    const handleCancel = useCallback(() => {
        abortRef.current?.abort();
        stopTimer();
        setStep("anamnese");
    }, []);

    const handleRetry = useCallback(() => {
        setStep("anamnese");
        setErrorMessage("");
    }, []);

    const handleApprove = useCallback(async () => {
        if (!generationResult?.outputSnapshot || !id) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsApproving(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Sessão expirada");

            const apiUrl = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

            // The outputSnapshot IS the template data — we need to save it as a program
            // and assign it. The assign API route expects a templateId.
            // For AI-generated programs, we pass the generationId and the assign route
            // will handle creating the program from the generation.
            const response = await fetch(`${apiUrl}/api/programs/assign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    studentId: id,
                    generationId: generationResult.generationId,
                    outputSnapshot: generationResult.outputSnapshot,
                    startDate: new Date().toISOString(),
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Falha ao atribuir programa");

            Alert.alert("Programa Atribuído!", "O programa gerado por IA foi atribuído com sucesso.", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao atribuir programa.");
        } finally {
            setIsApproving(false);
        }
    }, [generationResult, id, router]);

    const handleDiscard = useCallback(() => {
        Alert.alert(
            "Descartar Programa?",
            "O programa gerado será descartado. Você pode gerar um novo a qualquer momento.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Descartar",
                    style: "destructive",
                    onPress: () => {
                        setGenerationResult(null);
                        setStep("anamnese");
                    },
                },
            ]
        );
    }, []);

    const stepTitle = {
        anamnese: "Prescrição IA",
        generating: "Gerando...",
        preview: "Programa Gerado",
        error: "Erro",
    }[step];

    return (
        <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
            {/* Header */}
            <View
                style={{
                    backgroundColor: "#ffffff",
                    paddingTop: insets.top,
                    paddingBottom: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "rgba(0,0,0,0.08)",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8 }}>
                    <TouchableOpacity
                        onPress={() => {
                            if (step === "generating") {
                                handleCancel();
                            }
                            router.back();
                        }}
                        style={{ flexDirection: "row", alignItems: "center" }}
                    >
                        <ChevronLeft size={22} color="#7c3aed" />
                        <Text style={{ fontSize: 16, color: "#7c3aed", marginLeft: 2 }}>Voltar</Text>
                    </TouchableOpacity>
                    <Text
                        style={{
                            flex: 1,
                            fontSize: 17,
                            fontWeight: "700",
                            color: "#1a1a2e",
                            textAlign: "center",
                            marginRight: 60, // compensate for back button
                        }}
                    >
                        {stepTitle}
                    </Text>
                </View>
            </View>

            {/* Content */}
            {step === "anamnese" && (
                <PrescriptionProfileForm
                    existingProfile={profile}
                    isSaving={isSaving}
                    onSubmit={handleSubmitProfile}
                />
            )}

            {step === "generating" && (
                <GenerationStatus elapsedSeconds={elapsedSeconds} onCancel={handleCancel} />
            )}

            {step === "preview" && generationResult?.outputSnapshot && (
                <ProgramPreview
                    output={generationResult.outputSnapshot}
                    source={generationResult.source}
                    violations={generationResult.violations}
                    isApproving={isApproving}
                    onApprove={handleApprove}
                    onDiscard={handleDiscard}
                />
            )}

            {step === "error" && (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
                    <Text style={{ fontSize: 40, marginBottom: 16 }}>!</Text>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#1a1a2e", marginBottom: 8, textAlign: "center" }}>
                        Erro na Geração
                    </Text>
                    <Text style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
                        {errorMessage}
                    </Text>
                    <TouchableOpacity
                        onPress={handleRetry}
                        style={{
                            backgroundColor: "#7c3aed",
                            borderRadius: 14,
                            paddingHorizontal: 32,
                            paddingVertical: 14,
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>Tentar Novamente</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
                        <Text style={{ fontSize: 14, color: "#64748b" }}>Voltar</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
