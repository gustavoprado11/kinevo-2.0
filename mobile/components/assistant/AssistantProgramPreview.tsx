/**
 * AssistantProgramPreview — a PRÉVIA do programa no chat do app (preview-first).
 *
 * Renderiza a part `confirmation` pendente de kinevo_create_student_draft_program
 * com o payload EXATO que será criado: sessões com dias da semana, exercícios com
 * prescrição ("4×10 · 90s" / esquema por série), superset e blocos aeróbios.
 * Nada existe ainda — o treinador escolhe Salvar rascunho, Ativar agora (2º
 * toque de confirmação) ou Descartar; ajustes finos são conversa ("troca X por
 * Y" → o motor emite uma nova prévia). Paridade com o card do web.
 *
 * Tokens DS v2 + Mona Sans; nomes de exercício resolvidos via Supabase (RLS).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X, Zap, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import { supabase } from '../../lib/supabase';
import type { ConfirmationPart } from '../../hooks/useAssistantChat';

const { spacing, radius } = v2;

interface SetScheme { reps?: string }
interface SupersetChild { exercise_id: string; sets?: number; reps?: string }
interface CardioConfig {
    mode?: string;
    equipment?: string;
    duration_minutes?: number;
    distance_km?: number;
    intervals?: { work_seconds?: number; rest_seconds?: number; rounds?: number };
    segments?: unknown[];
    intensity_target?: { type?: string; zone?: number; rpe?: number; hr_min_bpm?: number; hr_max_bpm?: number; pace_min_per_km?: string | number };
}
interface PreviewItem {
    exercise_id?: string;
    sets?: number;
    reps?: string;
    rest_seconds?: number;
    method_key?: string;
    set_scheme?: SetScheme[];
    rounds?: number;
    superset?: SupersetChild[];
    cardio?: CardioConfig;
}
interface PreviewSession { name?: string; scheduled_days?: number[]; items?: PreviewItem[] }
interface PreviewPayload { name?: string; duration_weeks?: number; sessions?: PreviewSession[] }

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const METHOD_LABELS: Record<string, string> = {
    pyramid_down: 'Pirâmide desc.',
    pyramid_up: 'Pirâmide cresc.',
    drop_set: 'Drop-set',
    top_backoff: 'Top + backoff',
    '5x5': '5×5',
    cluster: 'Cluster',
};

const EQUIPMENT_LABELS: Record<string, string> = {
    treadmill: 'Esteira',
    bike: 'Bike',
    elliptical: 'Elíptico',
    rower: 'Remo',
    stairmaster: 'Escada',
    jump_rope: 'Corda',
    outdoor_run: 'Corrida (rua)',
    outdoor_bike: 'Pedal (rua)',
    swimming: 'Natação',
    other: 'Outro',
};

function prescriptionOf(item: PreviewItem): string {
    if (item.set_scheme && item.set_scheme.length > 0) {
        const reps = item.set_scheme.map((s) => s.reps ?? '?').join('/');
        const rounds = item.rounds && item.rounds > 1 ? ` ×${item.rounds}` : '';
        const method = item.method_key ? METHOD_LABELS[item.method_key] : null;
        return `${reps}${rounds}${method ? ` · ${method}` : ''}`;
    }
    const rest = item.rest_seconds != null ? ` · ${item.rest_seconds}s` : '';
    return `${item.sets ?? 3}×${item.reps ?? '10'}${rest}`;
}

function intensityOf(t: CardioConfig['intensity_target']): string | null {
    if (!t) return null;
    if (t.type === 'zone' && t.zone) return `Z${t.zone}`;
    if (t.type === 'rpe' && t.rpe) return `RPE ${t.rpe}`;
    if (t.type === 'hr' && t.hr_min_bpm) return `${t.hr_min_bpm}–${t.hr_max_bpm ?? '?'} bpm`;
    if (t.type === 'pace' && t.pace_min_per_km) return `${t.pace_min_per_km}/km`;
    return null;
}

function cardioLabel(c: CardioConfig): string {
    const bits: string[] = [];
    if (c.equipment) bits.push(EQUIPMENT_LABELS[c.equipment] ?? c.equipment);
    if (c.mode === 'interval' && c.intervals) {
        bits.push(`${c.intervals.work_seconds ?? '?'}s/${c.intervals.rest_seconds ?? '?'}s ×${c.intervals.rounds ?? '?'}`);
    } else if (c.mode === 'phased' && Array.isArray(c.segments)) {
        bits.push(`${c.segments.length} fases`);
    } else {
        if (c.duration_minutes) bits.push(`${c.duration_minutes} min`);
        if (c.distance_km) bits.push(`${c.distance_km} km`);
    }
    const intensity = intensityOf(c.intensity_target);
    if (intensity) bits.push(intensity);
    return bits.join(' · ') || 'bloco aeróbio';
}

function collectExerciseIds(payload: PreviewPayload): string[] {
    const ids = new Set<string>();
    for (const s of payload.sessions ?? []) {
        for (const it of s.items ?? []) {
            if (it.cardio) continue;
            if (it.superset) for (const c of it.superset) ids.add(c.exercise_id);
            else if (it.exercise_id) ids.add(it.exercise_id);
        }
    }
    return Array.from(ids);
}

interface Props {
    part: ConfirmationPart;
    disabled?: boolean;
    /** salvar rascunho / criar+ativar / descartar (useAssistantChat.previewAction). */
    onAction: (part: ConfirmationPart, action: 'save' | 'activate' | 'discard') => void;
}

export function AssistantProgramPreview({ part, disabled, onAction }: Props) {
    const colors = useV2Colors();
    const payload = part.request.args as PreviewPayload;
    const sessions = payload.sessions ?? [];
    const [armActivate, setArmActivate] = useState(false);
    const [names, setNames] = useState<Record<string, string>>({});

    const exerciseIds = useMemo(() => collectExerciseIds(payload), [payload]);
    useEffect(() => {
        if (exerciseIds.length === 0) return;
        let cancelled = false;
        void (async () => {
            const { data } = await supabase.from('exercises').select('id, name').in('id', exerciseIds);
            if (cancelled || !data) return;
            const map: Record<string, string> = {};
            for (const e of data as Array<{ id: string; name: string }>) map[e.id] = e.name;
            setNames(map);
        })();
        return () => {
            cancelled = true;
        };
    }, [exerciseIds]);
    const nameOf = (id?: string) => (id ? names[id] ?? 'Exercício' : 'Exercício');

    const rowText: TextStyle = { fontFamily: 'MonaSans_500Medium', fontSize: 12.5, color: colors.text.primary };
    const rxText: TextStyle = {
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 11.5,
        color: colors.text.secondary,
        fontVariant: ['tabular-nums'],
    };

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: radius.lg,
                overflow: 'hidden',
            }}
        >
            {/* Cabeçalho */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    padding: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.default,
                }}
            >
                <LinearGradient
                    colors={[colors.purple[500], colors.purple[700]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                >
                    <Sparkles size={16} color="#FFFFFF" strokeWidth={1.7} />
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }} numberOfLines={1}>
                        {payload.name ?? 'Programa'}
                    </Text>
                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 10, color: colors.semantic.warning.fg, marginTop: 2 }}>
                        Prévia — nada foi criado ainda
                    </Text>
                </View>
                <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 11, color: colors.text.tertiary, fontVariant: ['tabular-nums'] }}>
                    {sessions.length}t{payload.duration_weeks ? ` · ${payload.duration_weeks}sem` : ''}
                </Text>
            </View>

            {/* Sessões */}
            {sessions.map((s, si) => (
                <View
                    key={si}
                    style={{
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[3],
                        borderTopWidth: si > 0 ? 1 : 0,
                        borderTopColor: colors.border.default,
                        gap: 5,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] }}>
                        <Text style={{ flex: 1, fontFamily: 'MonaSans_600SemiBold', fontSize: 13, color: colors.text.primary }} numberOfLines={1}>
                            {s.name ?? `Treino ${si + 1}`}
                        </Text>
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 10, color: colors.text.tertiary }}>
                            {(s.scheduled_days ?? []).map((d) => DAY_LABELS[d] ?? '?').join(' · ') || 'sem dia'}
                        </Text>
                    </View>
                    {(s.items ?? []).map((it, ii) => {
                        if (it.cardio) {
                            return (
                                <View key={ii} style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] }}>
                                    <Text style={{ ...rowText, flex: 1 }} numberOfLines={1}>Aeróbio</Text>
                                    <Text style={rxText}>{cardioLabel(it.cardio)}</Text>
                                </View>
                            );
                        }
                        if (it.superset) {
                            return (
                                <View key={ii} style={{ gap: 3 }}>
                                    <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 9.5, color: colors.text.tertiary }}>
                                        SUPERSET
                                    </Text>
                                    <View style={{ borderLeftWidth: 2, borderLeftColor: colors.border.default, paddingLeft: spacing[3], gap: 3 }}>
                                        {it.superset.map((c, ci) => (
                                            <View key={ci} style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] }}>
                                                <Text style={{ ...rowText, flex: 1 }} numberOfLines={1}>{nameOf(c.exercise_id)}</Text>
                                                <Text style={rxText}>{c.sets ?? '?'}×{c.reps ?? '?'}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            );
                        }
                        return (
                            <View key={ii} style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] }}>
                                <Text style={{ ...rowText, flex: 1 }} numberOfLines={1}>{nameOf(it.exercise_id)}</Text>
                                <Text style={rxText}>{prescriptionOf(it)}</Text>
                            </View>
                        );
                    })}
                </View>
            ))}

            {/* Ações */}
            <View style={{ padding: spacing[4], borderTopWidth: 1, borderTopColor: colors.border.default, gap: spacing[2] }}>
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                    <Pressable
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onAction(part, 'save');
                        }}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel="Salvar rascunho"
                        style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden', opacity: disabled ? 0.55 : 1 }}
                    >
                        <LinearGradient
                            colors={[colors.purple[500], colors.purple[700]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                        >
                            <Check size={15} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 13, color: '#FFFFFF' }}>Salvar rascunho</Text>
                        </LinearGradient>
                    </Pressable>
                    {armActivate ? (
                        <Pressable
                            onPress={() => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                onAction(part, 'activate');
                            }}
                            disabled={disabled}
                            accessibilityRole="button"
                            accessibilityLabel="Confirmar ativação"
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                paddingVertical: 12,
                                borderRadius: radius.md,
                                backgroundColor: colors.semantic.warning.fg,
                                opacity: disabled ? 0.55 : 1,
                            }}
                        >
                            <Zap size={15} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 13, color: '#FFFFFF' }}>Confirmar ativação</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setArmActivate(true);
                            }}
                            disabled={disabled}
                            accessibilityRole="button"
                            accessibilityLabel="Ativar agora"
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                paddingVertical: 12,
                                borderRadius: radius.md,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                opacity: disabled ? 0.55 : 1,
                            }}
                        >
                            <Zap size={15} color={colors.text.secondary} strokeWidth={2} />
                            <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13, color: colors.text.secondary }}>Ativar agora</Text>
                        </Pressable>
                    )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <Text style={{ flex: 1, fontFamily: 'MonaSans_500Medium', fontSize: 11, lineHeight: 15, color: colors.text.tertiary }}>
                        {armActivate
                            ? 'Ativar cria o programa e o coloca no app do aluno na hora.'
                            : 'Quer ajustar? Responda na conversa que eu refaço a prévia.'}
                    </Text>
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onAction(part, 'discard');
                        }}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel="Descartar prévia"
                        hitSlop={6}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: disabled ? 0.55 : 1 }}
                    >
                        <X size={13} color={colors.text.tertiary} strokeWidth={2.2} />
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 12, color: colors.text.tertiary }}>Descartar</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
