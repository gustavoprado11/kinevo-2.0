/**
 * AssistantParts — renderiza os "parts" de uma mensagem do assistente:
 *  - executed: chip "concluído" com rótulo amigável + deep-link p/ a tela nativa
 *    quando há destino óbvio (aluno criado → perfil; rascunho → builder).
 *  - question: pergunta + opções clicáveis (responder = novo turno).
 *  - confirmation: card HITL ACIONÁVEL (Confirmar/Cancelar, campo editável) via
 *    execute-tool; resolvida vira nota (mensagem enviada ganha "Ver conversa").
 *  - proposal: proposta editável (Aprovar/Cancelar).
 *
 * Tokens DS v2 + Plus Jakarta.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, ShieldAlert, HelpCircle, ListChecks, Check, X, User, Sparkles, ArrowUpRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import type { AssistantPart, ConfirmationPart } from '../../hooks/useAssistantChat';

const { spacing, radius } = v2;

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://www.kinevoapp.com';

const EXECUTED_LABEL: Record<string, string> = {
    generateProgram: 'Programa gerado (rascunho)',
    kinevo_create_student_draft_program: 'Rascunho criado no perfil do aluno',
    kinevo_create_program: 'Programa criado',
    kinevo_create_program_template: 'Modelo de programa criado',
    kinevo_assign_program: 'Programa atribuído',
    kinevo_send_message: 'Mensagem enviada',
    kinevo_send_form: 'Formulário enviado',
    kinevo_schedule_form: 'Formulário agendado',
    kinevo_create_appointment: 'Sessão agendada',
    kinevo_reschedule_appointment: 'Sessão remarcada',
    kinevo_mark_payment_as_paid: 'Pagamento marcado como pago',
    kinevo_generate_checkout_link: 'Link de cobrança gerado',
    kinevo_create_student: 'Aluno criado',
    kinevo_update_student: 'Aluno atualizado',
    kinevo_archive_student: 'Aluno arquivado',
    kinevo_correct_assessment: 'Avaliação corrigida',
    kinevo_duplicate_program: 'Programa duplicado',
    kinevo_send_message_batch: 'Mensagens enviadas',
};

function executedLabel(toolName: string): string {
    return EXECUTED_LABEL[toolName] ?? 'Ação concluída';
}

/** Desempacota o resultado de uma tool MCP (content[].text JSON). */
function parseMcpPayload(result: unknown): Record<string, unknown> | null {
    if (!result || typeof result !== 'object') return null;
    const content = (result as { content?: Array<{ text?: string }> }).content;
    if (Array.isArray(content) && typeof content[0]?.text === 'string') {
        try {
            return JSON.parse(content[0].text) as Record<string, unknown>;
        } catch {
            return null;
        }
    }
    return result as Record<string, unknown>;
}

interface AssistantPartsProps {
    parts: AssistantPart[];
    onAnswer: (text: string) => void;
    onConfirm?: (part: ConfirmationPart, editedArgs?: Record<string, unknown>) => void;
    onCancel?: (part: ConfirmationPart) => void;
    /** Abre um rascunho de programa no builder nativo (assignedProgramId). */
    onOpenDraft?: (programId: string) => void;
    /** Abre o perfil nativo de um aluno (deep-link pós-ação). */
    onOpenStudent?: (studentId: string) => void;
    /** Abre a thread de mensagens com um aluno (deep-link pós-envio). */
    onOpenMessages?: (studentId: string) => void;
    disabled?: boolean;
}

export function AssistantParts({ parts, onAnswer, onConfirm, onCancel, onOpenDraft, onOpenStudent, onOpenMessages, disabled }: AssistantPartsProps) {
    if (!parts || parts.length === 0) return null;
    return (
        <View style={{ gap: spacing[3] }}>
            {parts.map((part, idx) => {
                switch (part.type) {
                    case 'executed': {
                        const r = part.result as { success?: boolean; reviewUrl?: string } | null;
                        // generateProgram (motor determinístico): abre o builder web.
                        if (part.toolName === 'generateProgram' && r?.success !== false && typeof r?.reviewUrl === 'string') {
                            const url = r.reviewUrl.startsWith('http') ? r.reviewUrl : `${WEB_URL}${r.reviewUrl}`;
                            return (
                                <GeneratedProgramCard
                                    key={idx}
                                    title="Programa gerado (rascunho)"
                                    subtitle="Salvo para revisão — ainda não ativado."
                                    actionLabel="Revisar no builder"
                                    onPress={() => void Linking.openURL(url)}
                                />
                            );
                        }
                        // Rascunho criado no perfil do aluno (via MCP): abre o builder NATIVO.
                        if (part.toolName === 'kinevo_create_student_draft_program' && onOpenDraft) {
                            const payload = parseMcpPayload(part.result);
                            const prog = payload?.program as { id?: string; name?: string } | undefined;
                            if (!payload?.error && prog?.id) {
                                const programId = prog.id;
                                return (
                                    <GeneratedProgramCard
                                        key={idx}
                                        title={prog.name || 'Rascunho de programa'}
                                        subtitle="Rascunho no perfil do aluno — ainda não ativado."
                                        actionLabel="Revisar rascunho"
                                        onPress={() => onOpenDraft(programId)}
                                    />
                                );
                            }
                        }
                        // Aluno criado (auto-executado): chip + deep-link p/ o perfil nativo.
                        if (part.toolName === 'kinevo_create_student' && onOpenStudent) {
                            const payload = parseMcpPayload(part.result);
                            const student = payload?.student as { id?: string; name?: string } | undefined;
                            if (!payload?.error && student?.id) {
                                const sid = student.id;
                                return (
                                    <ExecutedChip
                                        key={idx}
                                        toolName={part.toolName}
                                        linkLabel="Abrir perfil"
                                        onLink={() => onOpenStudent(sid)}
                                    />
                                );
                            }
                        }
                        return <ExecutedChip key={idx} toolName={part.toolName} />;
                    }
                    case 'question':
                        return (
                            <QuestionBlock
                                key={idx}
                                request={part.request}
                                answered={part.status === 'answered'}
                                disabled={disabled}
                                onAnswer={onAnswer}
                            />
                        );
                    case 'confirmation': {
                        if (part.status === 'pending' && onConfirm && onCancel) {
                            return (
                                <ConfirmationCard
                                    key={idx}
                                    part={part}
                                    disabled={disabled}
                                    onConfirm={onConfirm}
                                    onCancel={onCancel}
                                />
                            );
                        }
                        // Mensagem enviada (confirmada): deep-link p/ a thread do aluno.
                        const msgStudentId =
                            part.status === 'confirmed' &&
                            part.request.toolName === 'kinevo_send_message' &&
                            typeof part.request.args?.student_id === 'string'
                                ? (part.request.args.student_id as string)
                                : null;
                        return (
                            <ConfirmationNote
                                key={idx}
                                title={part.request.title}
                                summary={part.request.summary}
                                destructive={part.request.destructive}
                                status={part.status}
                                link={
                                    msgStudentId && onOpenMessages
                                        ? { label: 'Ver conversa', onPress: () => onOpenMessages(msgStudentId) }
                                        : undefined
                                }
                            />
                        );
                    }
                    case 'proposal':
                        return (
                            <ProposalCard
                                key={idx}
                                request={part.request}
                                answered={part.status === 'answered'}
                                disabled={disabled}
                                onAnswer={onAnswer}
                            />
                        );
                    default:
                        return null;
                }
            })}
        </View>
    );
}

function ConfirmationCard({
    part,
    disabled,
    onConfirm,
    onCancel,
}: {
    part: ConfirmationPart;
    disabled?: boolean;
    onConfirm: (part: ConfirmationPart, editedArgs?: Record<string, unknown>) => void;
    onCancel: (part: ConfirmationPart) => void;
}) {
    const colors = useV2Colors();
    const { title, summary, destructive, editableField, editableLabel, recipientName } = part.request;
    const initialValue =
        editableField && typeof part.request.args[editableField] === 'string'
            ? (part.request.args[editableField] as string)
            : '';
    const [value, setValue] = useState(initialValue);
    const tone = destructive ? colors.semantic.danger : colors.semantic.warning;
    const confirmLabel = editableField === 'content' ? 'Enviar' : 'Confirmar';

    const handleConfirm = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConfirm(part, editableField ? { [editableField]: value } : undefined);
    };

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: tone.default,
                borderRadius: radius.lg,
                padding: spacing[4],
                gap: spacing[3],
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <ShieldAlert size={16} color={tone.fg} strokeWidth={2} />
                <Text style={{ flex: 1, fontFamily: 'MonaSans_700Bold', fontSize: 14, color: colors.text.primary }}>
                    {title}
                </Text>
                <View style={{ backgroundColor: tone.bg, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 10, color: tone.fg }}>
                        {destructive ? 'Ação destrutiva' : 'Requer confirmação'}
                    </Text>
                </View>
            </View>

            {recipientName ? (
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing[2],
                        backgroundColor: colors.surface.card2,
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 11,
                    }}
                >
                    <User size={14} color={colors.text.tertiary} strokeWidth={2} />
                    <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12.5, color: colors.text.tertiary }}>
                        Para
                    </Text>
                    <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 12.5, color: colors.text.primary }}>
                        {recipientName}
                    </Text>
                </View>
            ) : null}

            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12.5, color: colors.text.secondary, lineHeight: 18 }}>
                {summary}
            </Text>

            {editableField ? (
                <View style={{ gap: 6 }}>
                    {editableLabel ? (
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 11, color: colors.text.tertiary }}>
                            {editableLabel} · revise antes de enviar
                        </Text>
                    ) : null}
                    <TextInput
                        value={value}
                        onChangeText={setValue}
                        multiline
                        editable={!disabled}
                        style={{
                            fontFamily: 'MonaSans_500Medium',
                            fontSize: 13.5,
                            color: colors.text.primary,
                            backgroundColor: colors.surface.card2,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            padding: 12,
                            minHeight: 64,
                            maxHeight: 160,
                            textAlignVertical: 'top',
                        }}
                    />
                </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onCancel(part);
                    }}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar"
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.surface.card,
                        opacity: disabled ? 0.5 : 1,
                    }}
                >
                    <X size={15} color={colors.text.secondary} strokeWidth={2} />
                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13, color: colors.text.secondary }}>
                        Cancelar
                    </Text>
                </Pressable>
                <Pressable
                    onPress={handleConfirm}
                    disabled={disabled || (!!editableField && value.trim().length === 0)}
                    accessibilityRole="button"
                    accessibilityLabel={confirmLabel}
                    style={{
                        flex: 1,
                        borderRadius: radius.md,
                        overflow: 'hidden',
                        opacity: disabled || (!!editableField && value.trim().length === 0) ? 0.55 : 1,
                    }}
                >
                    <LinearGradient
                        colors={destructive ? [colors.semantic.danger.default, colors.semantic.danger.fg] : [colors.purple[500], colors.purple[700]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                    >
                        <Check size={15} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 13, color: '#FFFFFF' }}>
                            {confirmLabel}
                        </Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </View>
    );
}

function GeneratedProgramCard({
    title,
    subtitle,
    actionLabel,
    onPress,
}: {
    title: string;
    subtitle: string;
    actionLabel: string;
    onPress: () => void;
}) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.purple[200],
                borderRadius: radius.lg,
                padding: spacing[4],
                gap: spacing[3],
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                <LinearGradient
                    colors={[colors.purple[500], colors.purple[700]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                >
                    <Sparkles size={16} color="#FFFFFF" strokeWidth={1.7} />
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11.5, color: colors.text.tertiary, marginTop: 1 }}>
                        {subtitle}
                    </Text>
                </View>
            </View>
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                style={{ borderRadius: radius.md, overflow: 'hidden' }}
            >
                <LinearGradient
                    colors={[colors.purple[500], colors.purple[700]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 }}
                >
                    <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 13, color: '#FFFFFF' }}>
                        {actionLabel}
                    </Text>
                    <ArrowUpRight size={15} color="#FFFFFF" strokeWidth={2.2} />
                </LinearGradient>
            </Pressable>
        </View>
    );
}

function ExecutedChip({ toolName, linkLabel, onLink }: { toolName: string; linkLabel?: string; onLink?: () => void }) {
    const colors = useV2Colors();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                    alignSelf: 'flex-start',
                    backgroundColor: colors.semantic.success.bg,
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                }}
            >
                <CheckCircle2 size={15} color={colors.semantic.success.fg} strokeWidth={2.2} />
                <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 12.5, color: colors.semantic.success.fg }}>
                    {executedLabel(toolName)}
                </Text>
            </View>
            {linkLabel && onLink ? (
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onLink();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={linkLabel}
                    hitSlop={6}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        paddingVertical: 7,
                        paddingHorizontal: 11,
                    }}
                >
                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 12.5, color: colors.purple[600] }}>
                        {linkLabel}
                    </Text>
                    <ArrowUpRight size={13} color={colors.purple[600]} strokeWidth={2.2} />
                </Pressable>
            ) : null}
        </View>
    );
}

function QuestionBlock({
    request,
    answered,
    disabled,
    onAnswer,
}: {
    request: { question: string; options: string[]; multiple: boolean; allowOther: boolean };
    answered: boolean;
    disabled?: boolean;
    onAnswer: (text: string) => void;
}) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: radius.lg,
                padding: spacing[4],
                gap: spacing[3],
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <HelpCircle size={15} color={colors.purple[600]} strokeWidth={2} />
                <Text style={{ flex: 1, fontFamily: 'MonaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }}>
                    {request.question}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {request.options.map((opt) => (
                    <Pressable
                        key={opt}
                        disabled={answered || disabled}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onAnswer(opt);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={opt}
                        style={{
                            backgroundColor: answered ? colors.surface.card2 : colors.purple[50],
                            borderWidth: 1,
                            borderColor: answered ? colors.border.default : colors.purple[200],
                            borderRadius: 12,
                            paddingVertical: 9,
                            paddingHorizontal: 13,
                            opacity: disabled && !answered ? 0.5 : 1,
                        }}
                    >
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 12.5, color: answered ? colors.text.tertiary : colors.purple[700] }}>
                            {opt}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

function ConfirmationNote({
    title,
    summary,
    destructive,
    status,
    link,
}: {
    title: string;
    summary: string;
    destructive: boolean;
    status: 'pending' | 'confirmed' | 'cancelled';
    /** Deep-link pós-ação (ex.: mensagem enviada → "Ver conversa"). */
    link?: { label: string; onPress: () => void };
}) {
    const colors = useV2Colors();
    const tone = destructive ? colors.semantic.danger : colors.semantic.warning;
    const resolved = status !== 'pending';

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: resolved ? colors.border.default : tone.default,
                borderRadius: radius.lg,
                padding: spacing[4],
                gap: spacing[2],
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <ShieldAlert size={15} color={tone.fg} strokeWidth={2} />
                <Text style={{ flex: 1, fontFamily: 'MonaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }}>
                    {title}
                </Text>
            </View>
            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12.5, color: colors.text.secondary, lineHeight: 18 }}>
                {summary}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 }}>
                <View style={{ backgroundColor: resolved ? colors.surface.card2 : tone.bg, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 10, color: resolved ? colors.text.tertiary : tone.fg }}>
                        {status === 'confirmed' ? 'Confirmado' : status === 'cancelled' ? 'Cancelado' : destructive ? 'Ação destrutiva' : 'Requer confirmação'}
                    </Text>
                </View>
                {link ? (
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            link.onPress();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={link.label}
                        hitSlop={6}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                    >
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 11.5, color: colors.purple[600] }}>
                            {link.label}
                        </Text>
                        <ArrowUpRight size={12} color={colors.purple[600]} strokeWidth={2.2} />
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

function ProposalCard({
    request,
    answered,
    disabled,
    onAnswer,
}: {
    request: { items: { label: string; value: string }[]; approveLabel: string };
    answered: boolean;
    disabled?: boolean;
    onAnswer: (text: string) => void;
}) {
    const colors = useV2Colors();
    const [values, setValues] = useState<string[]>(() => request.items.map((it) => it.value));
    const [done, setDone] = useState<null | 'approved' | 'cancelled'>(null);

    // Resolvido (respondido antes, ou acabou de aprovar/cancelar) → chip read-only.
    if (answered || done) {
        const label = done === 'cancelled' ? 'Proposta cancelada' : 'Proposta aprovada';
        return (
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                    alignSelf: 'flex-start',
                    backgroundColor: colors.surface.card2,
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                }}
            >
                {done !== 'cancelled' ? (
                    <CheckCircle2 size={15} color={colors.semantic.success.fg} strokeWidth={2.2} />
                ) : null}
                <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 12.5, color: colors.text.tertiary }}>
                    {label}
                </Text>
            </View>
        );
    }

    const approve = () => {
        if (disabled) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const lines = request.items.map((it, i) => `${it.label}: ${values[i]}`).join('; ');
        setDone('approved');
        onAnswer(`Aprovado. Valores finais — ${lines}.`);
    };
    const cancel = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setDone('cancelled');
        onAnswer('Cancelar a proposta.');
    };

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: radius.lg,
                padding: spacing[4],
                gap: spacing[3],
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <ListChecks size={15} color={colors.purple[600]} strokeWidth={2} />
                <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }}>
                    Proposta · revise e aprove
                </Text>
            </View>

            {request.items.map((it, i) => {
                const multiline = /direç|estilo|brief|observ|nota/i.test(it.label) || (values[i]?.length ?? 0) > 44;
                return (
                    <View key={`${it.label}-${i}`} style={{ gap: 5 }}>
                        <Text
                            style={{
                                fontFamily: 'MonaSans_700Bold',
                                fontSize: 10.5,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                                color: colors.text.tertiary,
                            }}
                        >
                            {it.label}
                        </Text>
                        <TextInput
                            value={values[i]}
                            onChangeText={(t) => setValues((v) => v.map((x, j) => (j === i ? t : x)))}
                            multiline={multiline}
                            editable={!disabled}
                            style={{
                                fontFamily: 'MonaSans_500Medium',
                                fontSize: 13.5,
                                color: colors.text.primary,
                                backgroundColor: colors.surface.card2,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                paddingHorizontal: 11,
                                paddingVertical: 9,
                                minHeight: multiline ? 60 : undefined,
                                textAlignVertical: multiline ? 'top' : 'center',
                            }}
                        />
                    </View>
                );
            })}

            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: 2 }}>
                <Pressable
                    onPress={cancel}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar proposta"
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.surface.card,
                        opacity: disabled ? 0.5 : 1,
                    }}
                >
                    <X size={15} color={colors.text.secondary} strokeWidth={2} />
                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13, color: colors.text.secondary }}>
                        Cancelar
                    </Text>
                </Pressable>
                <Pressable
                    onPress={approve}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={request.approveLabel || 'Aprovar'}
                    style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden', opacity: disabled ? 0.55 : 1 }}
                >
                    <LinearGradient
                        colors={[colors.purple[500], colors.purple[700]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                    >
                        <Check size={15} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 13, color: '#FFFFFF' }} numberOfLines={1}>
                            {request.approveLabel || 'Aprovar'}
                        </Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </View>
    );
}
