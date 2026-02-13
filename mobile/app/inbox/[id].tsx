import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { ChevronLeft, Upload, CheckCircle2 } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

type QuestionType = "short_text" | "long_text" | "single_choice" | "scale" | "photo";

interface Question {
    id: string;
    type: QuestionType;
    label: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    scale?: { min?: number; max?: number };
}

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [item, setItem] = useState<InboxItem | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [draftReady, setDraftReady] = useState(false);

    const draftKey = useMemo(() => {
        if (!id) return null;
        return `forms:draft:${id}`;
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
            console.error("[inbox/[id]] discard draft error:", err);
        }
    }, [draftKey]);

    const fetchData = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        setDraftReady(false);

        const { data: inboxData, error: inboxError }: { data: any; error: any } = await supabase
            .from("student_inbox_items" as any)
            .select("id, type, status, title, subtitle, payload")
            .eq("id", id)
            .single();

        if (inboxError || !inboxData) {
            console.error("[inbox/[id]] inbox fetch error:", inboxError);
            Alert.alert("Erro", "Item não encontrado.");
            router.back();
            return;
        }

        setItem(inboxData as InboxItem);

        if (inboxData.type === "form_request" || inboxData.type === "feedback") {
            const submissionId = inboxData.payload?.submission_id as string | undefined;

            let submissionQuery = supabase
                .from("form_submissions" as any)
                .select("id, status, schema_snapshot_json, answers_json, submitted_at, trainer_feedback");

            if (submissionId) {
                submissionQuery = submissionQuery.eq("id", submissionId);
            } else {
                submissionQuery = submissionQuery.eq("inbox_item_id", inboxData.id);
            }

            const { data: submissionData, error: submissionError }: { data: any; error: any } = await submissionQuery.single();
            if (submissionError) {
                console.error("[inbox/[id]] submission fetch error:", submissionError);
            } else {
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
                        console.error("[inbox/[id]] restore draft error:", err);
                    }
                } else if (!isDraftSubmission && draftKey) {
                    await SecureStore.deleteItemAsync(draftKey);
                }
            }
        }

        setIsLoading(false);
        setDraftReady(true);
    }, [draftKey, id, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const questions = useMemo(
        () => submission?.schema_snapshot_json?.questions || [],
        [submission]
    );

    useEffect(() => {
        if (!draftKey || !draftReady || !submission || submission.status !== "draft") return;

        const timeout = setTimeout(async () => {
            try {
                const payload: LocalDraft = {
                    answers,
                    saved_at: new Date().toISOString(),
                    schema_version: schemaVersion,
                    template_version: templateVersion,
                };
                await SecureStore.setItemAsync(draftKey, JSON.stringify(payload));
            } catch (err) {
                console.error("[inbox/[id]] autosave draft error:", err);
            }
        }, 450);

        return () => clearTimeout(timeout);
    }, [answers, draftKey, draftReady, submission, schemaVersion, templateVersion]);

    const setAnswer = (questionId: string, value: any) => {
        setAnswers((prev) => ({
            ...prev,
            [questionId]: value,
        }));
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
            console.error("[inbox/[id]] upload error:", err);
            Alert.alert("Erro", err?.message || "Falha ao enviar imagem.");
        }
    };

    const handleSubmit = useCallback(async () => {
        if (!submission) return;

        setIsSubmitting(true);
        try {
            const payload = {
                submitted_from: "mobile",
                app_version: "1.0.0",
                answers,
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
        } finally {
            setIsSubmitting(false);
        }
    }, [answers, discardLocalDraft, router, submission]);

    const renderQuestion = (question: Question) => {
        const answer = answers[question.id];

        if (question.type === "short_text" || question.type === "long_text") {
            return (
                <TextInput
                    value={answer?.value || ""}
                    onChangeText={(text) =>
                        setAnswer(question.id, { type: question.type, value: text })
                    }
                    multiline={question.type === "long_text"}
                    placeholder="Digite sua resposta"
                    style={{
                        borderWidth: 1,
                        borderColor: "rgba(148,163,184,0.25)",
                        borderRadius: 10,
                        padding: 10,
                        color: "#f1f5f9",
                        minHeight: question.type === "long_text" ? 90 : 44,
                        textAlignVertical: "top",
                        marginTop: 8,
                    }}
                    placeholderTextColor="#64748b"
                />
            );
        }

        if (question.type === "single_choice") {
            return (
                <View style={{ marginTop: 8, gap: 8 }}>
                    {(question.options || []).map((opt) => {
                        const isSelected = answer?.value === opt.value;
                        return (
                            <Pressable
                                key={opt.value}
                                onPress={() => setAnswer(question.id, { type: "single_choice", value: opt.value })}
                                style={{
                                    borderWidth: 1,
                                    borderColor: isSelected ? "#8b5cf6" : "rgba(148,163,184,0.25)",
                                    backgroundColor: isSelected ? "rgba(139,92,246,0.18)" : "transparent",
                                    borderRadius: 10,
                                    padding: 10,
                                }}
                            >
                                <Text style={{ color: "#e2e8f0", fontSize: 14 }}>{opt.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            );
        }

        if (question.type === "scale") {
            const min = question.scale?.min ?? 1;
            const max = question.scale?.max ?? 5;
            const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
            return (
                <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
                    {values.map((value) => {
                        const selected = Number(answer?.value) === value;
                        return (
                            <Pressable
                                key={value}
                                onPress={() => setAnswer(question.id, { type: "scale", value })}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderWidth: 1,
                                    borderColor: selected ? "#8b5cf6" : "rgba(148,163,184,0.25)",
                                    backgroundColor: selected ? "rgba(139,92,246,0.2)" : "transparent",
                                }}
                            >
                                <Text style={{ color: "#f1f5f9", fontWeight: "700" }}>{value}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            );
        }

        if (question.type === "photo") {
            const file = answer?.files?.[0];
            return (
                <View style={{ marginTop: 8 }}>
                    <Pressable
                        onPress={() => handlePickImage(question.id)}
                        style={{
                            borderWidth: 1,
                            borderColor: "rgba(148,163,184,0.25)",
                            borderRadius: 10,
                            padding: 10,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Upload size={16} color="#94a3b8" />
                        <Text style={{ color: "#e2e8f0" }}>
                            {file ? "Trocar foto" : "Selecionar foto"}
                        </Text>
                    </Pressable>

                    {!!file?.url && (
                        <Image
                            source={{ uri: file.url }}
                            style={{ width: "100%", height: 180, borderRadius: 10, marginTop: 10 }}
                            resizeMode="cover"
                        />
                    )}
                </View>
            );
        }

        return null;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D17" }} edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center" }}>
                <Pressable onPress={() => router.back()} style={{ marginRight: 10 }}>
                    <ChevronLeft size={22} color="#94a3b8" />
                </Pressable>
                <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 17 }}>Detalhe da Inbox</Text>
            </View>

            {isLoading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color="#8b5cf6" />
                    <Text style={{ marginTop: 10, color: "#64748b" }}>Carregando item...</Text>
                </View>
            ) : !item ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#64748b" }}>Item não encontrado.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
                    <View
                        style={{
                            backgroundColor: "#1A1A2E",
                            borderWidth: 1,
                            borderColor: "rgba(148,163,184,0.2)",
                            borderRadius: 14,
                            padding: 14,
                        }}
                    >
                        <Text style={{ color: "#f1f5f9", fontWeight: "800", fontSize: 16 }}>{item.title}</Text>
                        {!!item.subtitle && <Text style={{ color: "#94a3b8", marginTop: 6 }}>{item.subtitle}</Text>}
                    </View>

                    {item.type === "feedback" && (
                        <View
                            style={{
                                marginTop: 12,
                                backgroundColor: "#1A1A2E",
                                borderWidth: 1,
                                borderColor: "rgba(34,197,94,0.35)",
                                borderRadius: 14,
                                padding: 14,
                            }}
                        >
                            <Text style={{ color: "#86efac", fontWeight: "700", marginBottom: 6 }}>Feedback do treinador</Text>
                            <Text style={{ color: "#e2e8f0" }}>
                                {submission?.trainer_feedback?.message ||
                                    item.payload?.feedback_preview ||
                                    "Novo feedback disponível."}
                            </Text>
                        </View>
                    )}

                    {item.type === "form_request" && submission && (
                        <View style={{ marginTop: 14 }}>
                            {submission.status !== "draft" && (
                                <View
                                    style={{
                                        borderWidth: 1,
                                        borderColor: "rgba(34,197,94,0.35)",
                                        backgroundColor: "rgba(34,197,94,0.12)",
                                        borderRadius: 12,
                                        padding: 10,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 12,
                                    }}
                                >
                                    <CheckCircle2 size={16} color="#4ade80" />
                                    <Text style={{ color: "#86efac" }}>Formulário já enviado.</Text>
                                </View>
                            )}

                            {questions.map((question) => (
                                <View
                                    key={question.id}
                                    style={{
                                        backgroundColor: "#1A1A2E",
                                        borderWidth: 1,
                                        borderColor: "rgba(148,163,184,0.2)",
                                        borderRadius: 14,
                                        padding: 12,
                                        marginBottom: 10,
                                    }}
                                >
                                    <Text style={{ color: "#f1f5f9", fontWeight: "600" }}>
                                        {question.label} {question.required ? "*" : ""}
                                    </Text>
                                    {renderQuestion(question)}
                                </View>
                            ))}

                            {submission.status === "draft" && (
                                <Pressable
                                    onPress={handleSubmit}
                                    disabled={isSubmitting}
                                    style={{
                                        marginTop: 6,
                                        backgroundColor: isSubmitting ? "#4c1d95" : "#7c3aed",
                                        borderRadius: 12,
                                        paddingVertical: 13,
                                        alignItems: "center",
                                    }}
                                >
                                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                                        {isSubmitting ? "Enviando..." : "Enviar formulário"}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
