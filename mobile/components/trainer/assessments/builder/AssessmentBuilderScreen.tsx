import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Loader2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '@/hooks/useV2Colors';
import { supabase } from '../../../../lib/supabase';
import { useRoleMode } from '../../../../contexts/RoleModeContext';
import { toast } from '../../../../lib/toast';
import {
    useAssessmentTemplateDraftStore,
    NEW_TEMPLATE_DRAFT_KEY,
} from '../../../../stores/assessmentTemplateDraftStore';
import type {
    AssessmentTemplateSchema,
    AssessmentSection,
    AssessmentTest,
} from '@kinevo/shared/types/assessments';
import { SectionCard } from './SectionCard';
import { TestLibrarySheet } from './TestLibrarySheet';
import { TestPropertiesSheet } from './TestPropertiesSheet';
import type { CatalogEntry } from './test-catalog';

interface Props {
    /** ID do template existente (edit) ou null (criação). */
    templateId: string | null;
}

const EMPTY_SCHEMA: AssessmentTemplateSchema = {
    schema_version: '1.0',
    sections: [],
};

function genId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// M10A/B1 — tela principal do builder mobile.
// State management:
//   - title/description/schema vivem aqui no React state.
//   - Draft é persistido em MMKV via assessmentTemplateDraftStore (auto-save em
//     cada mutation, debounced via batched setState).
//   - Save chama Supabase direto (RLS) — NÃO usa server actions web.
//
// B1 entrega: criar/editar/remover seções com título inline. Adicionar testes
// é placeholder (B2 entrega TestLibrarySheet/TestPropertiesSheet).
export function AssessmentBuilderScreen({ templateId }: Props) {
    const colors = useV2Colors();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { trainerId } = useRoleMode();

    const draftKey = templateId ?? NEW_TEMPLATE_DRAFT_KEY;
    const upsertDraft = useAssessmentTemplateDraftStore(s => s.upsertDraft);
    const removeDraft = useAssessmentTemplateDraftStore(s => s.removeDraft);
    const getDraft = useAssessmentTemplateDraftStore(s => s.getDraft);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [schema, setSchema] = useState<AssessmentTemplateSchema>(EMPTY_SCHEMA);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [restoredFromDraft, setRestoredFromDraft] = useState(false);

    // B2 — sheets state
    const [librarySheetSectionId, setLibrarySheetSectionId] = useState<string | null>(null);
    const [propertiesSheetTest, setPropertiesSheetTest] = useState<AssessmentTest | null>(null);

    // Hydrate na primeira render: tenta draft local, senão fetcha do server (edit).
    useEffect(() => {
        let mounted = true;
        (async () => {
            const draft = getDraft(draftKey);
            if (draft) {
                if (mounted) {
                    setTitle(draft.title);
                    setDescription(draft.description ?? '');
                    setSchema(draft.schema);
                    setRestoredFromDraft(true);
                    setLoading(false);
                }
                return;
            }
            if (templateId) {
                // Edit mode: fetcha template existente via Supabase + RLS
                const { data, error } = await supabase
                    .from('form_templates')
                    .select('id, title, description, schema_json, category, trainer_id')
                    .eq('id', templateId)
                    .single();
                if (!mounted) return;
                if (error || !data) {
                    toast.error('Template não encontrado');
                    router.back();
                    return;
                }
                if (data.category !== 'assessment') {
                    toast.error('Esse template não é de avaliação');
                    router.back();
                    return;
                }
                setTitle(data.title ?? 'Avaliação Presencial');
                setDescription(data.description ?? '');
                setSchema(
                    (data.schema_json as AssessmentTemplateSchema | null) ?? EMPTY_SCHEMA,
                );
            } else {
                // Create mode: defaults
                setTitle('Avaliação Presencial');
            }
            if (mounted) setLoading(false);
        })();
        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId, draftKey]);

    // Auto-save em MMKV em cada mutation. Pula durante hydration inicial.
    useEffect(() => {
        if (loading) return;
        upsertDraft({
            template_key: draftKey,
            title,
            description: description || null,
            schema,
        });
    }, [loading, draftKey, title, description, schema, upsertDraft]);

    // ─── Mutations ────────────────────────────────────────────────
    const addSection = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSchema(s => ({
            ...s,
            sections: [
                ...s.sections,
                { id: genId('sec'), title: `Seção ${s.sections.length + 1}`, tests: [] },
            ],
        }));
    }, []);

    const renameSection = useCallback((sectionId: string, nextTitle: string) => {
        setSchema(s => ({
            ...s,
            sections: s.sections.map(sec =>
                sec.id === sectionId ? { ...sec, title: nextTitle } : sec,
            ),
        }));
    }, []);

    const removeSection = useCallback((sectionId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSchema(s => ({
            ...s,
            sections: s.sections.filter(sec => sec.id !== sectionId),
        }));
    }, []);

    // ─── Test mutations (B2) ──────────────────────────────────────
    const addTestFromCatalog = useCallback(
        (sectionId: string, entry: CatalogEntry) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const baseTest = entry.make();
            const newTest = { ...baseTest, id: genId('test') } as AssessmentTest;
            setSchema(s => ({
                ...s,
                sections: s.sections.map(sec =>
                    sec.id === sectionId ? { ...sec, tests: [...sec.tests, newTest] } : sec,
                ),
            }));
        },
        [],
    );

    const updateTest = useCallback((testId: string, next: AssessmentTest) => {
        setSchema(s => ({
            ...s,
            sections: s.sections.map(sec => ({
                ...sec,
                tests: sec.tests.map(t => (t.id === testId ? next : t)),
            })),
        }));
    }, []);

    const removeTest = useCallback((testId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSchema(s => ({
            ...s,
            sections: s.sections.map(sec => ({
                ...sec,
                tests: sec.tests.filter(t => t.id !== testId),
            })),
        }));
    }, []);

    // ─── Validation ───────────────────────────────────────────────
    const titleValid = title.trim().length > 0;
    const hasSections = schema.sections.length > 0;
    const allTests = useMemo(() => schema.sections.flatMap(s => s.tests), [schema.sections]);
    const hasTests = allTests.length > 0;
    // Detecta metric_keys duplicados — bloqueia save (igual web).
    const duplicateMetricKeys = useMemo(() => {
        const counts = new Map<string, number>();
        for (const t of allTests) {
            const k = (t as { metric_key?: string }).metric_key ?? '';
            if (!k) continue;
            counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k));
    }, [allTests]);
    const canSave =
        !saving
        && titleValid
        && hasSections
        && hasTests
        && duplicateMetricKeys.size === 0;

    // ─── Save direto via Supabase (RLS) ───────────────────────────
    const handleSave = useCallback(async () => {
        if (!canSave) {
            if (!titleValid) {
                toast.error('Título é obrigatório');
            } else if (!hasSections) {
                toast.error('Adicione pelo menos uma seção');
            } else if (!hasTests) {
                toast.error('Adicione pelo menos um teste');
            } else if (duplicateMetricKeys.size > 0) {
                toast.error('Existem chaves de métrica duplicadas');
            }
            return;
        }
        if (!trainerId) {
            toast.error('Sessão expirada');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim() || null,
                category: 'assessment' as const,
                schema_json: schema,
                trainer_id: trainerId,
                is_active: true,
            };

            if (templateId) {
                // Edit existing: só atualiza colunas mutáveis. Server-side no web
                // já chama updateAssessmentTemplate que clona system templates;
                // aqui mantemos lógica simples — RLS impede edit de templates
                // de outro trainer ou system templates (trainer_id IS NULL).
                const { error } = await supabase
                    .from('form_templates')
                    .update({
                        title: payload.title,
                        description: payload.description,
                        schema_json: payload.schema_json,
                    } as any)
                    .eq('id', templateId);
                if (error) throw new Error(error.message);
                toast.success('Template atualizado');
            } else {
                const { data, error } = await supabase
                    .from('form_templates')
                    .insert(payload as any)
                    .select('id')
                    .single();
                if (error) throw new Error(error.message);
                toast.success('Template criado');
                if (__DEV__) console.log('[AssessmentBuilder] created template id:', data?.id);
            }

            // Limpa draft e volta
            removeDraft(draftKey);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
        } catch (err: any) {
            if (__DEV__) console.error('[AssessmentBuilder] save error:', err);
            toast.error(err?.message ?? 'Erro ao salvar template');
        } finally {
            setSaving(false);
        }
    }, [canSave, titleValid, hasSections, hasTests, duplicateMetricKeys.size, trainerId, title, description, schema, templateId, removeDraft, draftKey, router]);

    const handleBack = useCallback(() => {
        // Draft fica em MMKV; trainer pode voltar e continuar depois.
        router.back();
    }, [router]);

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.surface.canvas, paddingTop: insets.top }}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={colors.purple[600]} />
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.surface.canvas }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View
                style={{
                    paddingTop: insets.top,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.default,
                    backgroundColor: colors.surface.card,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                        onPress={handleBack}
                        style={{ padding: 6, marginLeft: -6 }}
                        hitSlop={8}
                    >
                        <ChevronLeft size={22} color={colors.text.secondary} />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text.primary }}>
                        {templateId ? 'Editar template' : 'Novo template'}
                    </Text>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!canSave}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 10,
                            backgroundColor: canSave ? colors.purple[600] : colors.surface.card2,
                            opacity: saving ? 0.7 : 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        {saving && <Loader2 size={14} color="#fff" />}
                        <Text style={{ color: canSave ? '#fff' : colors.text.tertiary, fontSize: 13, fontWeight: '600' }}>
                            Salvar
                        </Text>
                    </TouchableOpacity>
                </View>
                {restoredFromDraft && (
                    <Text style={{ marginTop: 6, fontSize: 11, color: colors.purple[600] }}>
                        Rascunho restaurado
                    </Text>
                )}
            </View>

            {/* Body */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* Title */}
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.tertiary, marginBottom: 6, letterSpacing: 1 }}>
                        TÍTULO
                    </Text>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Ex.: Avaliação Inicial"
                        placeholderTextColor={colors.text.quaternary}
                        style={{
                            backgroundColor: colors.surface.card,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 15,
                            color: colors.text.primary,
                        }}
                    />
                </View>

                {/* Description */}
                <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.tertiary, marginBottom: 6, letterSpacing: 1 }}>
                        DESCRIÇÃO
                    </Text>
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Opcional"
                        placeholderTextColor={colors.text.quaternary}
                        multiline
                        style={{
                            backgroundColor: colors.surface.card,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 14,
                            color: colors.text.primary,
                            minHeight: 60,
                            textAlignVertical: 'top',
                        }}
                    />
                </View>

                {/* Sections */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.tertiary, letterSpacing: 1 }}>
                        SEÇÕES ({schema.sections.length})
                    </Text>
                </View>

                {schema.sections.length === 0 ? (
                    <TouchableOpacity
                        onPress={addSection}
                        style={{
                            borderWidth: 1.5,
                            borderColor: colors.border.default,
                            borderStyle: 'dashed',
                            borderRadius: 12,
                            padding: 24,
                            alignItems: 'center',
                            backgroundColor: colors.surface.card,
                        }}
                    >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.purple[600] + '14', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                            <Plus size={18} color={colors.purple[600]} />
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.primary }}>
                            Adicionar primeira seção
                        </Text>
                        <Text style={{ marginTop: 2, fontSize: 11, color: colors.text.tertiary }}>
                            Agrupe testes relacionados (ex.: Antropometria)
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {schema.sections.map((section: AssessmentSection) => (
                            <SectionCard
                                key={section.id}
                                section={section}
                                onRename={(t) => renameSection(section.id, t)}
                                onRemove={() =>
                                    Alert.alert(
                                        'Remover seção?',
                                        `"${section.title}" e todos os testes serão removidos.`,
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            { text: 'Remover', style: 'destructive', onPress: () => removeSection(section.id) },
                                        ],
                                    )
                                }
                                onAddTest={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setLibrarySheetSectionId(section.id);
                                }}
                                onEditTest={(t) => setPropertiesSheetTest(t)}
                                onRemoveTest={removeTest}
                            />
                        ))}
                        <TouchableOpacity
                            onPress={addSection}
                            style={{
                                marginTop: 8,
                                borderWidth: 1,
                                borderColor: colors.purple[600] + '40',
                                borderRadius: 10,
                                paddingVertical: 10,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 6,
                            }}
                        >
                            <Plus size={14} color={colors.purple[600]} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.purple[600] }}>
                                Adicionar seção
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            {/* B2 sheets — montados sempre; controle por visible prop. */}
            <TestLibrarySheet
                visible={librarySheetSectionId !== null}
                onClose={() => setLibrarySheetSectionId(null)}
                onSelect={(entry) => {
                    if (librarySheetSectionId) {
                        addTestFromCatalog(librarySheetSectionId, entry);
                    }
                }}
            />
            <TestPropertiesSheet
                test={propertiesSheetTest}
                duplicateKey={
                    propertiesSheetTest != null
                    && 'metric_key' in propertiesSheetTest
                    && duplicateMetricKeys.has((propertiesSheetTest as { metric_key: string }).metric_key)
                }
                onSave={(next) => updateTest(next.id, next)}
                onClose={() => setPropertiesSheetTest(null)}
            />
        </KeyboardAvoidingView>
    );
}
