import React, { useCallback, useMemo, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, ClipboardList, Users, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '@/hooks/useV2Colors';
import { useTrainerStudentsList } from '../../../hooks/useTrainerStudentsList';
import {
    useTrainerAssessmentTemplates,
    type TrainerAssessmentTemplate,
} from '../../../hooks/useTrainerAssessmentTemplates';
import { useAssessmentSessionLifecycle } from '../../../hooks/useAssessmentSessionLifecycle';
import { toast } from '../../../lib/toast';
import { SUBJECT_AGE_KEY, SUBJECT_SEX_KEY } from '../../../lib/assessmentComputed';
import type { TrainerStudent } from '../../../hooks/useTrainerStudentsList';
import type { Sex } from '@kinevo/shared/lib/assessment-protocols';
import type { MeasurementInput } from '@kinevo/shared/types/assessments';

interface Props {
    visible: boolean;
    onClose: () => void;
    onCreated: (sessionId: string, student: TrainerStudent, template: TrainerAssessmentTemplate) => void;
}

type Step = 'student' | 'template' | 'confirm';

export function CreateSessionModal({ visible, onClose, onCreated }: Props) {
    const colors = useV2Colors();
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState<Step>('student');
    const [studentId, setStudentId] = useState<string | null>(null);
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [scheduleNow, setScheduleNow] = useState(true);
    const [notes, setNotes] = useState('');
    const [sex, setSex] = useState<Sex | null>(null);
    const [ageRaw, setAgeRaw] = useState('');

    const studentsList = useTrainerStudentsList();
    const templatesList = useTrainerAssessmentTemplates();
    const lifecycle = useAssessmentSessionLifecycle();

    React.useEffect(() => {
        if (!visible) {
            // Reset on hide so the next open starts clean.
            setStep('student');
            setStudentId(null);
            setTemplateId(null);
            setSearch('');
            setScheduleNow(true);
            setNotes('');
            setSex(null);
            setAgeRaw('');
        }
    }, [visible]);

    const filteredStudents = useMemo(() => {
        const list = studentsList.students ?? [];
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter((s) => s.name.toLowerCase().includes(q));
    }, [studentsList.students, search]);

    const selectedStudent = useMemo(
        () => (studentsList.students ?? []).find((s) => s.id === studentId) ?? null,
        [studentsList.students, studentId],
    );

    const selectedTemplate = useMemo(
        () => templatesList.templates.find((t) => t.id === templateId) ?? null,
        [templatesList.templates, templateId],
    );

    const ageParsed = useMemo(() => {
        const trimmed = ageRaw.trim();
        if (!trimmed) return null;
        const n = Number(trimmed.replace(',', '.'));
        if (!Number.isFinite(n)) return null;
        if (n < 5 || n > 120) return null;
        return Math.round(n);
    }, [ageRaw]);

    const canConfirm = !!selectedStudent && !!selectedTemplate && sex !== null && ageParsed !== null;

    const handleConfirm = useCallback(async () => {
        if (!selectedStudent || !selectedTemplate || !sex || ageParsed === null) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const id = await lifecycle.create({
            student_id: selectedStudent.id,
            template_id: selectedTemplate.id,
            scheduled_at: scheduleNow ? null : new Date().toISOString(),
            notes: notes.trim() || null,
        });
        if (!id) {
            toast.error(lifecycle.createError ?? 'Erro ao criar sessão');
            return;
        }
        // Persist subject context as two special measurements so the
        // engine can read sex/age at finalize time without a schema
        // migration on `assessment_sessions`. See assessmentComputed.ts.
        const subjectRows: MeasurementInput[] = [
            {
                metric_key: SUBJECT_SEX_KEY,
                value_text: sex,
                value_unit: null,
                side: null,
                attempt_number: 1,
                is_selected: true,
                raw_input: { kind: 'subject_context' },
            },
            {
                metric_key: SUBJECT_AGE_KEY,
                value_numeric: ageParsed,
                value_unit: null,
                side: null,
                attempt_number: 1,
                is_selected: true,
                raw_input: { kind: 'subject_context', unit_label: 'years' },
            },
        ];
        const ok = await lifecycle.syncBatch(id, subjectRows);
        if (!ok) {
            // Session row exists; subject context will be re-sent on next
            // sync because the rows are local-only at that point.
            toast.error('Sessão criada, mas contexto do aluno não sincronizou. Tente abrir a sessão.');
        } else {
            toast.success('Sessão criada');
        }
        onCreated(id, selectedStudent, selectedTemplate);
    }, [selectedStudent, selectedTemplate, sex, ageParsed, scheduleNow, notes, lifecycle, onCreated]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
                {/* Header */}
                <View
                    style={{
                        paddingTop: insets.top + 8,
                        paddingHorizontal: 16,
                        paddingBottom: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        backgroundColor: colors.surface.card,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.default,
                    }}>
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityLabel="Fechar"
                        accessibilityRole="button"
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{ padding: 6 }}>
                        <X size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text.primary, flex: 1 }}>
                        Nova avaliação
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.purple[600] }}>
                        {step === 'student' ? '1' : step === 'template' ? '2' : '3'}/3
                    </Text>
                </View>

                {step === 'student' && (
                    <View style={{ flex: 1 }}>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 10,
                                    paddingHorizontal: 14,
                                    backgroundColor: colors.surface.card,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                }}>
                                <Search size={18} color={colors.text.tertiary} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder="Buscar aluno"
                                    placeholderTextColor={colors.text.tertiary}
                                    style={{
                                        flex: 1,
                                        fontSize: 15,
                                        lineHeight: 20,
                                        color: colors.text.primary,
                                        paddingVertical: 10,
                                        paddingLeft: 2,
                                    }}
                                />
                            </View>
                        </View>
                        {studentsList.isLoading ? (
                            <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple[600]} />
                        ) : (
                            <FlatList
                                data={filteredStudents}
                                keyExtractor={(s) => s.id}
                                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 8 }}
                                ListEmptyComponent={
                                    <Text style={{ textAlign: 'center', color: colors.text.tertiary, padding: 40 }}>
                                        Nenhum aluno encontrado
                                    </Text>
                                }
                                renderItem={({ item }) => (
                                    <PickRow
                                        title={item.name}
                                        subtitle={item.modality ?? item.email}
                                        selected={item.id === studentId}
                                        onPress={() => {
                                            setStudentId(item.id);
                                            setStep('template');
                                        }}
                                        icon={<Users size={18} color={colors.purple[600]} />}
                                    />
                                )}
                            />
                        )}
                    </View>
                )}

                {step === 'template' && (
                    <View style={{ flex: 1 }}>
                        {templatesList.isLoading ? (
                            <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple[600]} />
                        ) : templatesList.templates.length === 0 ? (
                            <View style={{ padding: 24, gap: 12, alignItems: 'center' }}>
                                <ClipboardList size={36} color={colors.text.quaternary} />
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: '600',
                                        color: colors.text.secondary,
                                        textAlign: 'center',
                                    }}>
                                    Nenhum template de avaliação presencial criado ainda
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: colors.text.tertiary,
                                        textAlign: 'center',
                                        lineHeight: 18,
                                    }}>
                                    Crie via Avaliações ▸ Templates antes de iniciar uma sessão.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={templatesList.templates}
                                keyExtractor={(t) => t.id}
                                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 8 }}
                                renderItem={({ item }) => (
                                    <PickRow
                                        title={item.title}
                                        subtitle={item.description ?? `${item.section_count} ${item.section_count === 1 ? 'seção' : 'seções'}`}
                                        selected={item.id === templateId}
                                        onPress={() => {
                                            setTemplateId(item.id);
                                            setStep('confirm');
                                        }}
                                        icon={<ClipboardList size={18} color={colors.purple[600]} />}
                                    />
                                )}
                            />
                        )}
                    </View>
                )}

                {step === 'confirm' && (
                    <View style={{ flex: 1 }}>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
                            <Summary label="Aluno" value={selectedStudent?.name ?? '—'} />
                            <Summary label="Avaliação" value={selectedTemplate?.title ?? '—'} />

                            <View style={{ gap: 8 }}>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: colors.text.tertiary,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1.2,
                                    }}>
                                    Sexo
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <ScheduleChip
                                        label="Masculino"
                                        active={sex === 'male'}
                                        onPress={() => setSex('male')}
                                    />
                                    <ScheduleChip
                                        label="Feminino"
                                        active={sex === 'female'}
                                        onPress={() => setSex('female')}
                                    />
                                </View>
                                <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                                    Usado nos protocolos de composição corporal (Jackson & Pollock, Petroski).
                                </Text>
                            </View>

                            <View style={{ gap: 8 }}>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: colors.text.tertiary,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1.2,
                                    }}>
                                    Idade
                                </Text>
                                <TextInput
                                    value={ageRaw}
                                    onChangeText={setAgeRaw}
                                    placeholder="anos"
                                    placeholderTextColor={colors.text.tertiary}
                                    keyboardType="number-pad"
                                    inputMode="numeric"
                                    accessibilityLabel="Idade do aluno em anos"
                                    style={{
                                        backgroundColor: colors.surface.card,
                                        borderRadius: 12,
                                        paddingHorizontal: 14,
                                        paddingVertical: 12,
                                        fontSize: 16,
                                        fontWeight: '700',
                                        color: colors.text.primary,
                                        borderWidth: 1,
                                        borderColor:
                                            ageParsed !== null
                                                ? colors.purple[600]
                                                : colors.border.default,
                                    }}
                                />
                                {ageRaw.trim().length > 0 && ageParsed === null && (
                                    <Text style={{ fontSize: 11, color: colors.semantic.warning.default }}>
                                        Idade deve estar entre 5 e 120 anos.
                                    </Text>
                                )}
                            </View>

                            <View style={{ gap: 8 }}>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: colors.text.tertiary,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1.2,
                                    }}>
                                    Quando
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <ScheduleChip
                                        label="Agora"
                                        active={scheduleNow}
                                        onPress={() => setScheduleNow(true)}
                                    />
                                    <ScheduleChip
                                        label="Agendar"
                                        active={!scheduleNow}
                                        onPress={() => setScheduleNow(false)}
                                    />
                                </View>
                                <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                                    {scheduleNow
                                        ? 'Sessão será criada como "em andamento" e abrirá no checklist.'
                                        : 'Sessão será criada como "agendada" para hoje.'}
                                </Text>
                            </View>

                            <View style={{ gap: 8 }}>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: colors.text.tertiary,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1.2,
                                    }}>
                                    Notas (opcional)
                                </Text>
                                <TextInput
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Ex: foco em composição corporal"
                                    placeholderTextColor={colors.text.tertiary}
                                    multiline
                                    style={{
                                        backgroundColor: colors.surface.card,
                                        borderRadius: 12,
                                        padding: 12,
                                        fontSize: 14,
                                        color: colors.text.primary,
                                        minHeight: 80,
                                        textAlignVertical: 'top',
                                        borderWidth: 1,
                                        borderColor: colors.border.default,
                                    }}
                                />
                            </View>
                        </ScrollView>

                        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 8, paddingTop: 8 }}>
                            <TouchableOpacity
                                onPress={handleConfirm}
                                disabled={!canConfirm || lifecycle.creating}
                                accessibilityRole="button"
                                accessibilityLabel="Criar sessão"
                                accessibilityState={{ disabled: !canConfirm || lifecycle.creating }}
                                style={{
                                    backgroundColor: canConfirm ? colors.purple[600] : colors.border.default,
                                    borderRadius: 14,
                                    paddingVertical: 16,
                                    alignItems: 'center',
                                    opacity: lifecycle.creating ? 0.7 : 1,
                                }}>
                                {lifecycle.creating ? (
                                    <ActivityIndicator color={'#FFFFFF'} />
                                ) : (
                                    <Text
                                        style={{
                                            fontSize: 16,
                                            fontWeight: '800',
                                            color: canConfirm ? '#FFFFFF' : colors.text.tertiary,
                                        }}>
                                        Criar sessão
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

function PickRow(props: {
    title: string;
    subtitle?: string | null;
    selected: boolean;
    onPress: () => void;
    icon: React.ReactNode;
}) {
    const colors = useV2Colors();
    return (
        <TouchableOpacity
            onPress={props.onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={props.title}
            accessibilityState={{ selected: props.selected }}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                backgroundColor: colors.surface.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: props.selected ? colors.purple[600] : colors.border.default,
            }}>
            <View
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: colors.purple[100],
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                {props.icon}
            </View>
            <View style={{ flex: 1 }}>
                <Text
                    numberOfLines={1}
                    style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>
                    {props.title}
                </Text>
                {props.subtitle && (
                    <Text
                        numberOfLines={1}
                        style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                        {props.subtitle}
                    </Text>
                )}
            </View>
            {props.selected && <Check size={18} color={colors.purple[600]} />}
        </TouchableOpacity>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: 14,
                padding: 14,
                gap: 4,
            }}>
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                }}>
                {label}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary }}>{value}</Text>
        </View>
    );
}

function ScheduleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const colors = useV2Colors();
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: active ? colors.purple[600] : colors.surface.card,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: active ? colors.purple[600] : colors.border.default,
            }}>
            <Text
                style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : colors.text.primary,
                }}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}
