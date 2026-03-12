import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { ChevronLeft, Upload, CheckCircle2, MessageCircle } from "lucide-react-native";
import Animated, { FadeInUp, FadeIn, ZoomIn } from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { PressableScale } from "../../components/shared/PressableScale";
import { FormRenderer } from "../../components/forms/FormRenderer";
import type { Question } from "../../components/forms/FormFieldRenderer";

interface InboxItem {
    id: string;
    type: "form_request" | "feedback" | "system_alert" | "text_message";
    status: "unread" | "pending_action" | "completed" | "archived";
    title: string;
    subtitle: string | null;
    payload: Record<string, any>;
}

interface Submission {
    id: string;
    status: "draft" | "submitted" | "reviewed";
    schema_snapshot_json: { questions?: Question[] };
    answers_json: { answers?: Record<string, any> } | null;
    submitted_at: string | null;
    trainer_feedback: { message?: string } | null;
}

interface LocalDraft {
    answers: Record<string, any>;
    saved_at: string;
    schema_version: string | null;
    template_version: number | null;
}

export default function InboxItemDetailScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [isLoading, setIsLoading] = useState(true);
    const [item, setItem] = useState<InboxItem | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [draftReady, setDraftReady] = useState(false);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [templateDescription, setTemplateDescription] = useState<string | null>(null);

    // Resolve student table ID from auth UID
    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data }: { data: any; error: any } = await supabase
                .from("students" as any)
                .select("id")
                .eq("auth_user_id", user.id)
                .single();
            if (data?.id) setStudentId(data.id);
        })();
    }, [user]);

    const draftKey = useMemo(() => {
        if (!id) return null;
        return `forms.draft.${id}`;
    }, [id]);

    const schemaVersion = useMemo(() => {
        const raw = (submission?.schema_snapshot_json as any)?.schema_version;
        return raw ? String(raw) : null;
    }, [submission?.schema_snapshot_json]);

    const templateVersion = useMemo(() => {
        const raw = item?.payload?.form_template_version;
        if (typeof raw === "number") return raw;
        if (typeof raw === "string") {
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }, [item?.payload]);

    const discardLocalDraft = useCallback(async () => {
        if (!draftKey) return;
        try {
            await SecureStore.deleteItemAsync(draftKey);
        } catch (err) {
            if (__DEV__) console.error("[inbox/[id]] discard draft error:", err);
        }
    }, [draftKey]);

    const fetchData = useCallback(async () => {
        if (!id || !studentId) return;
        setIsLoading(true);
        setDraftReady(false);

        try {
            const { data: inboxData, error: inboxError }: { data: any; error: any } = await supabase
                .from("student_inbox_items" as any)
                .select("id, type, status, title, subtitle, payload")
                .eq("id", id)
                .eq("student_id", studentId)
                .single();

            if (inboxError || !inboxData) {
                if (__DEV__) console.error("[inbox/[id]] inbox fetch error:", inboxError);
                Alert.alert("Erro", "Item não encontrado.");
                router.back();
                return;
            }

            setItem(inboxData as InboxItem);

            // Fetch template description for form requests
            const templateId = inboxData.payload?.form_template_id as string | undefined;
            if (templateId) {
                const { data: tplData }: { data: any } = await supabase
                    .from("form_templates" as any)
                    .select("description")
                    .eq("id", templateId)
                    .maybeSingle();
                if (tplData?.description) setTemplateDescription(tplData.description);
            }

            if (inboxData.type === "form_request" || inboxData.type === "feedback") {
                const submissionId = inboxData.payload?.submission_id as string | undefined;

                let submissionQuery = supabase
                    .from("form_submissions" as any)
                    .select("id, status, schema_snapshot_json, answers_json, submitted_at, trainer_feedback")
                    .eq("student_id", studentId);

                if (submissionId) {
                    submissionQuery = submissionQuery.eq("id", submissionId);
                } else {
                    submissionQuery = submissionQuery.eq("inbox_item_id", inboxData.id);
                }

                const { data: submissionData, error: submissionError }: { data: any; error: any } = await submissionQuery.maybeSingle();
                if (submissionError) {
                    if (__DEV__) console.error("[inbox/[id]] submission fetch error:", submissionError);
                } else if (submissionData) {
                    setSubmission(submissionData as Submission);
                    const initialAnswers = submissionData?.answers_json?.answers || {};
                    setAnswers(initialAnswers);

                    const isDraftSubmission = submissionData?.status === "draft";
                    if (isDraftSubmission && draftKey) {
                        try {
                            const rawDraft = await SecureStore.getItemAsync(draftKey);
                            if (rawDraft) {
                                const localDraft = JSON.parse(rawDraft) as LocalDraft;
                                const localAnswers = localDraft?.answers || {};

                                const localSchemaVersion = localDraft?.schema_version || null;
                                const localTemplateVersion = localDraft?.template_version ?? null;
                                const currentSchemaVersion = submissionData?.schema_snapshot_json?.schema_version
                                    ? String(submissionData?.schema_snapshot_json?.schema_version)
                                    : null;
                                const currentTemplateVersion = (() => {
                                    const raw = inboxData?.payload?.form_template_version;
                                    if (typeof raw === "number") return raw;
                                    if (typeof raw === "string") {
                                        const parsed = Number(raw);
                                        return Number.isFinite(parsed) ? parsed : null;
                                    }
                                    return null;
                                })();

                                const hasVersionConflict =
                                    localSchemaVersion !== currentSchemaVersion ||
                                    localTemplateVersion !== currentTemplateVersion;

                                const hasLocalAnswers = Object.keys(localAnswers).length > 0;

                                if (hasVersionConflict) {
                                    await SecureStore.deleteItemAsync(draftKey);
                                } else if (hasLocalAnswers) {
                                    await new Promise<void>((resolve) => {
                                        Alert.alert(
                                            "Rascunho encontrado",
                                            "Encontramos um rascunho salvo neste formulário. Deseja restaurar?",
                                            [
                                                {
                                                    text: "Descartar",
                                                    style: "destructive",
                                                    onPress: async () => {
                                                        await SecureStore.deleteItemAsync(draftKey);
                                                        resolve();
                                                    },
                                                },
                                                {
                                                    text: "Restaurar",
                                                    onPress: () => {
                                                        setAnswers(localAnswers);
                                                        resolve();
                                                    },
                                                },
                                            ]
                                        );
                                    });
                                }
                            }
                        } catch (err) {
                            if (__DEV__) console.error("[inbox/[id]] restore draft error:", err);
                        }
                    } else if (!isDraftSubmission && draftKey) {
                        await SecureStore.deleteItemAsync(draftKey);
                    }
                }
            }
        } catch (err) {
            if (__DEV__) console.error("[inbox/[id]] fetchData unhandled error:", err);
            Alert.alert("Erro", "Não foi possível carregar o item.");
            router.back();
        } finally {
            setIsLoading(false);
            setDraftReady(true);
        }
    }, [draftKey, id, router, studentId]);

    useEffect(() => {
        if (studentId) fetchData();
    }, [fetchData, studentId]);

    const questions = useMemo(
        () => (submission?.schema_snapshot_json?.questions || []).map((q: any) => ({
            ...q,
            options: q.options
                ? q.options.map((opt: any, i: number) =>
                    typeof opt === "string" ? { value: `opt_${i + 1}`, label: opt } : opt
                )
                : undefined,
        })),
        [submission]
    );

    // Note: auto-save is now managed by FormRenderer in full mode.
    // We keep local answers state for draft recovery during fetchData,
    // the feedback read-only view, and handlePickImage.
    const setAnswer = (questionId: string, value: any) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    };

    const handlePickImage = async (questionId: string) => {
        if (!user || !submission) return;

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Permissão necessária", "Permita acesso à galeria para enviar fotos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];

        try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();

            const ext = asset.fileName?.split(".").pop() || "jpg";
            const filePath = `students/${user.id}/submissions/${submission.id}/${questionId}-${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from("form-uploads")
                .upload(filePath, arrayBuffer, {
                    contentType: asset.mimeType || "image/jpeg",
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            const { data: signedData } = await supabase.storage
                .from("form-uploads")
                .createSignedUrl(filePath, 3600);

            setAnswer(questionId, {
                type: "photo",
                files: [
                    {
                        path: filePath,
                        url: signedData?.signedUrl || null,
                        width: asset.width,
                        height: asset.height,
                    },
                ],
            });
        } catch (err: any) {
            if (__DEV__) console.error("[inbox/[id]] upload error:", err);
            Alert.alert("Erro", err?.message || "Falha ao enviar imagem.");
        }
    };


    // handleSubmit adapted for FormRenderer — receives answers from the renderer
    const handleFormRendererSubmit = useCallback(async (formAnswers: Record<string, any>) => {
        if (!submission) return;

        try {
            const payload = {
                submitted_from: "mobile",
                app_version: "1.0.0",
                answers: formAnswers,
            };

            const { error }: { error: any } = await supabase.rpc("submit_form_submission" as any, {
                p_submission_id: submission.id,
                p_answers_json: payload,
            });

            if (error) {
                Alert.alert("Validação", error.message || "Não foi possível enviar o formulário.");
                return;
            }

            await discardLocalDraft();

            Alert.alert("Enviado", "Seu formulário foi enviado com sucesso.", [
                { text: "OK", onPress: () => router.replace("/(tabs)/inbox") },
            ]);
        } catch (err: any) {
            Alert.alert("Erro", err?.message || "Falha ao enviar.");
        }
    }, [discardLocalDraft, router, submission]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 12,
                    paddingBottom: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#F2F2F7",
                }}
            >
                <Pressable onPress={() => router.back()} style={{ marginRight: 10 }}>
                    <ChevronLeft size={22} color="#64748b" />
                </Pressable>
                <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 17 }}>Detalhe da Inbox</Text>
            </View>

            {isLoading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color="#7c3aed" />
                    <Text style={{ marginTop: 10, color: "#94a3b8" }}>Carregando item...</Text>
                </View>
            ) : !item ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#94a3b8" }}>Item não encontrado.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
                    {/* Title card */}
                    <Animated.View
                        entering={FadeInUp.delay(50).springify().damping(18)}
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 20,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(0, 0, 0, 0.04)',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 16 }}>{item.title}</Text>
                        {!!templateDescription && (
                            <Text style={{ color: "#64748b", marginTop: 6, fontSize: 13, lineHeight: 19 }}>{templateDescription}</Text>
                        )}
                        {!!item.subtitle && item.subtitle !== "Novo formulário" && (
                            <Text style={{ color: "#94a3b8", marginTop: 4, fontSize: 12 }}>{item.subtitle}</Text>
                        )}
                    </Animated.View>

                    {item.type === "feedback" && (
                        <>
                            {/* Feedback card — VIP Glow */}
                            <Animated.View
                                entering={
                                    FadeIn.delay(150).duration(400)
                                        .springify().damping(18).stiffness(100)
                                }
                            >
                                <PressableScale
                                    pressScale={0.97}
                                    style={{
                                        marginTop: 12,
                                        borderRadius: 20,
                                        overflow: 'hidden',
                                        shadowColor: '#10b981',
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 20,
                                        elevation: 6,
                                    }}
                                >
                                    <View
                                        style={{
                                            backgroundColor: '#f0fdf9',
                                            borderRadius: 20,
                                            padding: 20,
                                            borderWidth: 1,
                                            borderColor: 'rgba(16, 185, 129, 0.15)',
                                            position: 'relative',
                                        }}
                                    >
                                        {/* Watermark icon */}
                                        <View style={{ position: 'absolute', top: 14, right: 14, opacity: 0.12 }}>
                                            <MessageCircle size={32} color="#10b981" fill="#10b981" />
                                        </View>

                                        {/* Left accent bar */}
                                        <View
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 16,
                                                bottom: 16,
                                                width: 3,
                                                backgroundColor: '#10b981',
                                                borderTopRightRadius: 2,
                                                borderBottomRightRadius: 2,
                                            }}
                                        />

                                        <Text style={{ color: "#059669", fontWeight: "700", fontSize: 14, marginBottom: 8 }}>
                                            Feedback do treinador
                                        </Text>
                                        <Text style={{ color: "#1e293b", lineHeight: 22, fontSize: 15 }}>
                                            {submission?.trainer_feedback?.message ||
                                                item.payload?.feedback_preview ||
                                                "Novo feedback disponível."}
                                        </Text>
                                    </View>
                                </PressableScale>
                            </Animated.View>

                            {submission && questions.length > 0 && (
                                <View style={{ marginTop: 20 }}>
                                    <Animated.View entering={FadeInUp.delay(250).springify().damping(18)}>
                                        <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, paddingLeft: 1 }}>
                                            Suas respostas
                                        </Text>
                                    </Animated.View>
                                    {questions.map((question, qIdx) => {
                                        const answer = answers[question.id];
                                        const rawValue = answer?.value ?? answer?.files?.[0]?.url;
                                        // For select/radio questions, map value to label
                                        let answerText = "—";
                                        if (rawValue != null) {
                                            const matchedOption = question.options?.find(
                                                (opt: any) => opt.value === rawValue
                                            );
                                            answerText = matchedOption?.label ?? String(rawValue);
                                        }
                                        return (
                                            <Animated.View
                                                key={question.id}
                                                entering={FadeInUp.delay(300 + qIdx * 80).springify().damping(18).stiffness(100)}
                                            >
                                                <View
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        borderRadius: 16,
                                                        padding: 14,
                                                        marginBottom: 10,
                                                        borderWidth: 1,
                                                        borderColor: 'rgba(0, 0, 0, 0.04)',
                                                        shadowColor: '#000',
                                                        shadowOffset: { width: 0, height: 1 },
                                                        shadowOpacity: 0.03,
                                                        shadowRadius: 4,
                                                        elevation: 1,
                                                    }}
                                                >
                                                    <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                                                        {question.label}
                                                    </Text>
                                                    <Text style={{ color: "#0f172a", fontSize: 14, lineHeight: 20 }}>{answerText}</Text>
                                                </View>
                                            </Animated.View>
                                        );
                                    })}
                                </View>
                            )}
                        </>
                    )}

                    {item.type === "form_request" && submission && (
                        <View style={{ marginTop: 14 }}>
                            {submission.status !== "draft" && (
                                <View
                                    style={{
                                        borderWidth: 1,
                                        borderColor: "#bbf7d0",
                                        backgroundColor: "#f0fdf4",
                                        borderRadius: 12,
                                        padding: 12,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 12,
                                    }}
                                >
                                    <CheckCircle2 size={16} color="#16a34a" />
                                    <Text style={{ color: "#16a34a", fontWeight: "500" }}>Formulário já enviado.</Text>
                                </View>
                            )}

                            <FormRenderer
                                mode="full"
                                schema={{ questions }}
                                initialAnswers={answers}
                                onSubmit={handleFormRendererSubmit}
                                submitLabel="Enviar Formulário"
                                disabled={submission.status !== "draft"}
                                draftKey={draftKey}
                                schemaVersion={schemaVersion}
                                templateVersion={templateVersion}
                                onPickImage={handlePickImage}
                            />
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
