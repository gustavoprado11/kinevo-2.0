import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import { FormFieldRenderer, type Question } from "./FormFieldRenderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormSchema {
    questions: Question[];
}

interface LocalDraft {
    answers: Record<string, any>;
    saved_at: string;
    schema_version: string | null;
    template_version: number | null;
}

interface FormRendererBaseProps {
    schema: FormSchema;
    initialAnswers?: Record<string, any>;
    onSubmit: (answers: Record<string, any>) => Promise<void>;
    submitLabel?: string;
    isLoading?: boolean;
    disabled?: boolean;
}

interface FormRendererInlineProps extends FormRendererBaseProps {
    mode: "inline";
    onSkip?: () => void;
    skipLabel?: string;
}

interface FormRendererFullProps extends FormRendererBaseProps {
    mode: "full";
    draftKey?: string | null;
    schemaVersion?: string | null;
    templateVersion?: number | null;
    /** Called when user taps the photo upload button. */
    onPickImage?: (questionId: string) => void;
}

export type FormRendererProps = FormRendererInlineProps | FormRendererFullProps;

// ---------------------------------------------------------------------------
// Normalize options — inbox stores options as strings or {value,label}
// ---------------------------------------------------------------------------

function normalizeQuestions(raw: any[]): Question[] {
    return (raw || []).map((q: any) => ({
        ...q,
        options: q.options
            ? q.options.map((opt: any, i: number) =>
                  typeof opt === "string" ? { value: `opt_${i + 1}`, label: opt } : opt
              )
            : undefined,
    }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormRenderer(props: FormRendererProps) {
    const {
        schema,
        initialAnswers,
        onSubmit,
        submitLabel = "Enviar",
        isLoading: externalLoading,
        disabled = false,
        mode,
    } = props;

    const questions = useMemo(() => normalizeQuestions(schema?.questions || []), [schema]);
    const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers || {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draftReady, setDraftReady] = useState(mode !== "full");

    // Update answers if initialAnswers change externally (e.g. draft restore)
    useEffect(() => {
        if (initialAnswers) setAnswers(initialAnswers);
    }, [initialAnswers]);

    const setAnswer = useCallback((questionId: string, value: any) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }, []);

    // ── Draft auto-save (full mode only) ──
    useEffect(() => {
        if (mode !== "full") return;
        const { draftKey, schemaVersion, templateVersion } = props as FormRendererFullProps;
        if (!draftKey || !draftReady || disabled) return;

        const timeout = setTimeout(async () => {
            try {
                const payload: LocalDraft = {
                    answers,
                    saved_at: new Date().toISOString(),
                    schema_version: schemaVersion ?? null,
                    template_version: templateVersion ?? null,
                };
                await SecureStore.setItemAsync(draftKey, JSON.stringify(payload));
            } catch (err) {
                if (__DEV__) console.error("[FormRenderer] autosave draft error:", err);
            }
        }, 450);

        return () => clearTimeout(timeout);
    }, [answers, mode, draftReady, disabled, props]);

    // ── Draft recovery (full mode only) ──
    useEffect(() => {
        if (mode !== "full") return;
        const { draftKey, schemaVersion, templateVersion } = props as FormRendererFullProps;
        if (!draftKey || disabled) {
            setDraftReady(true);
            return;
        }

        (async () => {
            try {
                const rawDraft = await SecureStore.getItemAsync(draftKey);
                if (!rawDraft) {
                    setDraftReady(true);
                    return;
                }

                const localDraft = JSON.parse(rawDraft) as LocalDraft;
                const localAnswers = localDraft?.answers || {};

                const hasVersionConflict =
                    localDraft.schema_version !== (schemaVersion ?? null) ||
                    localDraft.template_version !== (templateVersion ?? null);

                if (hasVersionConflict) {
                    await SecureStore.deleteItemAsync(draftKey);
                } else if (Object.keys(localAnswers).length > 0) {
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
            } catch (err) {
                if (__DEV__) console.error("[FormRenderer] restore draft error:", err);
            } finally {
                setDraftReady(true);
            }
        })();
    }, [mode, disabled]);

    // ── Validation & Submit ──
    const handleSubmit = useCallback(async () => {
        // Client-side required validation for inline mode
        if (mode === "inline") {
            for (const q of questions) {
                if (!q.required) continue;
                const a = answers[q.id];
                if (a === undefined || a === null || a === "") {
                    Alert.alert("Campo obrigatório", q.label);
                    return;
                }
                if (typeof a === "object") {
                    const hasValue =
                        a.value !== undefined && a.value !== "" && a.value !== null;
                    const hasValues = Array.isArray(a.values) && a.values.length > 0;
                    if (!hasValue && !hasValues) {
                        Alert.alert("Campo obrigatório", q.label);
                        return;
                    }
                }
            }
        }

        setIsSubmitting(true);
        try {
            await onSubmit(answers);
        } finally {
            setIsSubmitting(false);
        }
    }, [answers, mode, onSubmit, questions]);

    const showLoading = externalLoading || isSubmitting;
    const isDisabled = disabled || showLoading;

    // ── Render ──
    if (mode === "inline") {
        const { onSkip, skipLabel = "Pular" } = props as FormRendererInlineProps;

        return (
            <View style={{ gap: 12 }}>
                {questions.map((question) => (
                    <View
                        key={question.id}
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 20,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: "rgba(0, 0, 0, 0.04)",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                            {question.label}
                            {question.required ? <Text style={{ color: "#ef4444" }}> *</Text> : null}
                        </Text>
                        <FormFieldRenderer
                            question={question}
                            answer={answers[question.id]}
                            onChangeAnswer={setAnswer}
                            disabled={isDisabled}
                        />
                    </View>
                ))}

                {/* Action buttons */}
                <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    {onSkip && (
                        <Pressable
                            onPress={onSkip}
                            disabled={isDisabled}
                            style={{
                                flex: 1,
                                height: 50,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: "#e2e8f0",
                                backgroundColor: "#f8fafc",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isDisabled ? 0.5 : 1,
                            }}
                        >
                            <Text style={{ color: "#64748b", fontWeight: "600", fontSize: 15 }}>
                                {skipLabel}
                            </Text>
                        </Pressable>
                    )}

                    <Pressable
                        onPress={handleSubmit}
                        disabled={isDisabled}
                        style={{
                            flex: 1,
                            height: 50,
                            borderRadius: 14,
                            backgroundColor: "#7c3aed",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: isDisabled ? 0.5 : 1,
                        }}
                    >
                        {showLoading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                                {submitLabel}
                            </Text>
                        )}
                    </Pressable>
                </View>
            </View>
        );
    }

    // ── Full mode (inbox) ──
    const { onPickImage } = props as FormRendererFullProps;

    return (
        <View style={{ gap: 0 }}>
            {questions.map((question) => (
                <BlurView
                    key={question.id}
                    intensity={60}
                    tint="light"
                    style={{
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                        borderRadius: 20,
                        padding: 14,
                        marginBottom: 12,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.5)",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                    }}
                >
                    <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                        {question.label}
                        {question.required ? <Text style={{ color: "#ef4444" }}> *</Text> : null}
                    </Text>
                    <FormFieldRenderer
                        question={question}
                        answer={answers[question.id]}
                        onChangeAnswer={setAnswer}
                        onPickImage={onPickImage}
                        disabled={isDisabled}
                    />
                </BlurView>
            ))}

            {!disabled && (
                <Pressable
                    onPress={handleSubmit}
                    disabled={isDisabled}
                    style={{
                        marginTop: 10,
                        borderRadius: 16,
                        overflow: "hidden",
                        shadowColor: "#8b5cf6",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                        elevation: 6,
                    }}
                >
                    <BlurView intensity={80} tint="light" style={{ backgroundColor: "rgba(124, 58, 237, 0.85)" }}>
                        <LinearGradient
                            colors={["rgba(139, 92, 246, 0.5)", "rgba(109, 40, 217, 0.5)"]}
                            style={{
                                paddingVertical: 16,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.2)",
                                borderRadius: 16,
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 }}>
                                {showLoading ? "ENVIANDO..." : submitLabel.toUpperCase()}
                            </Text>
                        </LinearGradient>
                    </BlurView>
                </Pressable>
            )}
        </View>
    );
}
