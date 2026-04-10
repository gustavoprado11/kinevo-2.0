import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

// Types
export interface QuestionOption {
    value: string;
    label: string;
}

export interface ScaleConfig {
    min: number;
    max: number;
    min_label?: string;
    max_label?: string;
}

export type QuestionType = "short_text" | "long_text" | "single_choice" | "scale" | "photo";

export interface Question {
    id: string;
    type: QuestionType;
    label: string;
    required?: boolean;
    placeholder?: string;
    options?: QuestionOption[];
    scale?: ScaleConfig;
}

export interface FormSchema {
    schema_version: "1.0";
    layout: {
        estimated_minutes: number;
        progress_mode: "per_question";
    };
    questions: Question[];
}

export type FormCategory = "anamnese" | "checkin" | "survey";

export interface CreateFormTemplateData {
    title: string;
    description?: string | null;
    category: FormCategory;
    schema: FormSchema;
}

export interface UpdateFormTemplateData extends CreateFormTemplateData {
    templateId: string;
}

function validateSchema(schema: FormSchema): string | null {
    if (!schema.questions || schema.questions.length === 0) {
        return "Adicione pelo menos uma pergunta";
    }
    for (const q of schema.questions) {
        if (!q.label.trim()) return "Todas as perguntas precisam de um texto";
        if (q.type === "single_choice") {
            if (!q.options || q.options.length < 2) {
                return `Pergunta "${q.label}" precisa de pelo menos 2 opções`;
            }
            if (q.options.some((o) => !o.label.trim())) {
                return `Pergunta "${q.label}" tem opções sem texto`;
            }
        }
        if (q.type === "scale" && q.scale) {
            if (q.scale.min >= q.scale.max) {
                return `Pergunta "${q.label}": valor mínimo deve ser menor que máximo`;
            }
        }
    }
    return null;
}

function estimateMinutes(questions: Question[]): number {
    return Math.max(1, Math.ceil(questions.length * 0.5));
}

export function useFormTemplateCrud(onSuccess?: () => void) {
    const { trainerId } = useRoleMode();
    const [isSaving, setIsSaving] = useState(false);

    const createTemplate = useCallback(
        async (data: CreateFormTemplateData) => {
            const validationError = validateSchema(data.schema);
            if (validationError) throw new Error(validationError);
            if (!trainerId) throw new Error("Não autenticado como treinador");

            setIsSaving(true);
            try {
                const schema: FormSchema = {
                    ...data.schema,
                    layout: {
                        ...data.schema.layout,
                        estimated_minutes: estimateMinutes(data.schema.questions),
                    },
                };

                const { error } = await (supabase.from as any)("form_templates").insert({
                    trainer_id: trainerId,
                    title: data.title.trim(),
                    description: data.description?.trim() || null,
                    category: data.category,
                    schema_json: schema,
                    created_source: "manual",
                });

                if (error) throw new Error(error.message);
                onSuccess?.();
            } finally {
                setIsSaving(false);
            }
        },
        [trainerId, onSuccess],
    );

    const updateTemplate = useCallback(
        async (data: UpdateFormTemplateData) => {
            const validationError = validateSchema(data.schema);
            if (validationError) throw new Error(validationError);
            if (!trainerId) throw new Error("Não autenticado como treinador");

            setIsSaving(true);
            try {
                const { data: existing } = await (supabase.from as any)("form_templates")
                    .select("id, version, trainer_id")
                    .eq("id", data.templateId)
                    .single();

                if (!existing) throw new Error("Template não encontrado");

                const schema: FormSchema = {
                    ...data.schema,
                    layout: {
                        ...data.schema.layout,
                        estimated_minutes: estimateMinutes(data.schema.questions),
                    },
                };

                // System template → clone as trainer's own
                if (existing.trainer_id === null) {
                    const { error } = await (supabase.from as any)("form_templates").insert({
                        trainer_id: trainerId,
                        title: data.title.trim(),
                        description: data.description?.trim() || null,
                        category: data.category,
                        schema_json: schema,
                        created_source: "manual",
                    });
                    if (error) throw new Error(error.message);
                } else {
                    // Trainer's template → update in-place
                    if (existing.trainer_id !== trainerId) {
                        throw new Error("Sem permissão para editar este template");
                    }
                    const { error } = await (supabase.from as any)("form_templates")
                        .update({
                            title: data.title.trim(),
                            description: data.description?.trim() || null,
                            category: data.category,
                            schema_json: schema,
                            version: (existing.version || 1) + 1,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", data.templateId)
                        .eq("trainer_id", trainerId);
                    if (error) throw new Error(error.message);
                }

                onSuccess?.();
            } finally {
                setIsSaving(false);
            }
        },
        [trainerId, onSuccess],
    );

    const deleteTemplate = useCallback(
        async (templateId: string) => {
            if (!trainerId) throw new Error("Não autenticado como treinador");

            const { error } = await (supabase.from as any)("form_templates")
                .delete()
                .eq("id", templateId)
                .eq("trainer_id", trainerId);

            if (error) throw new Error(error.message);
            onSuccess?.();
        },
        [trainerId, onSuccess],
    );

    const fetchTemplateSchema = useCallback(
        async (
            templateId: string,
        ): Promise<{
            id: string;
            title: string;
            description: string | null;
            category: FormCategory;
            schema_json: FormSchema;
            trainer_id: string | null;
        }> => {
            const { data, error } = await (supabase.from as any)("form_templates")
                .select("id, title, description, category, schema_json, trainer_id")
                .eq("id", templateId)
                .single();

            if (error || !data) throw new Error("Template não encontrado");
            return data;
        },
        [],
    );

    return {
        createTemplate,
        updateTemplate,
        deleteTemplate,
        fetchTemplateSchema,
        isSaving,
    };
}
