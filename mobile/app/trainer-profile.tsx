// Tela de edição do perfil do trainer. Edita: foto, nome, foco de
// atendimento (modality_focus), publicação automática de relatórios
// (auto_publish_reports) e instagram_handle (rodapé dos cards de share).
//
// A foto é salva imediatamente ao escolher (mesmo padrão do perfil do
// aluno); os demais campos persistem no botão Salvar do header.
//
// Padrão visual: header custom com botão Salvar trailing à direita, KCard,
// fontes MonaSans_*, tokens de spacing/colors.

import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Instagram } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v2 } from '@kinevo/shared/tokens';
import { KCard } from '../components/v2';
import { AvatarPicker } from '../components/profile/AvatarPicker';
import { supabase } from '../lib/supabase';
import { useRoleMode, type TrainerModalityFocus } from '../contexts/RoleModeContext';
import { useAuth } from '../contexts/AuthContext';
import { useV2Colors, type V2Palette } from '../hooks/useV2Colors';
import { toast } from '../lib/toast';

const { spacing, radius } = v2;

// Regra Instagram pública (espelha o check constraint da migração 133):
// 1–30 chars, [A-Za-z0-9._] sem '@'.
const INSTAGRAM_HANDLE_REGEX = /^[A-Za-z0-9._]{1,30}$/;

const MODALITY_OPTIONS: { value: TrainerModalityFocus; label: string }[] = [
    { value: 'presencial', label: 'Presencial' },
    { value: 'online', label: 'Online' },
    { value: 'ambos', label: 'Ambos' },
];

/** Normaliza input: remove @ inicial, espaços e quebras de linha. */
function normalizeHandle(raw: string): string {
    return raw.replace(/^@+/, '').trim();
}

export default function TrainerProfileEditScreen() {
    const colors = useV2Colors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const { user } = useAuth();
    const { trainerProfile, refreshRoleMode } = useRoleMode();

    const initialName = trainerProfile?.name ?? '';
    const initialHandle = trainerProfile?.instagram_handle ?? '';
    const initialModality = trainerProfile?.modality_focus ?? null;
    const initialAutoPublish = trainerProfile?.auto_publish_reports ?? false;

    const [name, setName] = useState<string>(initialName);
    const [handle, setHandle] = useState<string>(initialHandle);
    const [modality, setModality] = useState<TrainerModalityFocus | null>(initialModality);
    const [autoPublish, setAutoPublish] = useState<boolean>(initialAutoPublish);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(trainerProfile?.avatar_url ?? null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const trimmedName = name.trim();
    const nameValid = trimmedName.length >= 2;
    const normalized = normalizeHandle(handle);
    const handleEmpty = normalized.length === 0;
    const handleValid = handleEmpty || INSTAGRAM_HANDLE_REGEX.test(normalized);

    const hasChanged =
        trimmedName !== (initialName ?? '') ||
        normalized !== (initialHandle ?? '') ||
        modality !== initialModality ||
        autoPublish !== initialAutoPublish;

    const canSave = nameValid && handleValid && hasChanged && !isSaving;

    const handlePickAvatar = async (uri: string) => {
        if (!user || !trainerProfile?.id) return;
        setIsUploadingAvatar(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();
            const filePath = `${user.id}/avatar.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

            // Trainer RLS allows direct update (auth_user_id = auth.uid()). A
            // DB trigger syncs this avatar to the trainer's student profile too.
            const { data, error } = await supabase
                .from('trainers' as any)
                .update({ avatar_url: publicUrl })
                .eq('id', trainerProfile.id)
                .select('id');
            if (error) throw error;
            if (!data || (Array.isArray(data) && data.length === 0)) {
                throw new Error('Update bloqueado por RLS.');
            }

            setAvatarUrl(publicUrl);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            toast.success('Foto atualizada');
            await refreshRoleMode();
        } catch (e: any) {
            if (__DEV__) console.error('[TrainerProfileEdit] avatar upload failed:', e?.message ?? e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            toast.error('Erro', 'Não foi possível atualizar a foto.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        if (!canSave || !trainerProfile?.id) return;
        setIsSaving(true);
        try {
            const updates: Record<string, unknown> = {};
            if (trimmedName !== (initialName ?? '')) updates.name = trimmedName;
            if (normalized !== (initialHandle ?? '')) updates.instagram_handle = handleEmpty ? null : normalized;
            if (modality !== initialModality) updates.modality_focus = modality;
            if (autoPublish !== initialAutoPublish) updates.auto_publish_reports = autoPublish;

            if (Object.keys(updates).length === 0) {
                router.back();
                return;
            }

            // .select() confirma persistência — RLS que bloqueia retorna 0
            // linhas SEM error e o save aparenta sucesso mas nada persiste.
            const { data, error } = await supabase
                .from('trainers' as any)
                .update(updates)
                .eq('id', trainerProfile.id)
                .select('id');

            if (error) throw error;
            if (!data || (Array.isArray(data) && data.length === 0)) {
                throw new Error('Update retornou 0 linhas — possível bloqueio de RLS.');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            toast.success('Perfil atualizado');
            await refreshRoleMode();
            router.back();
        } catch (e: any) {
            if (__DEV__) console.error('[TrainerProfileEdit] save failed:', e?.message ?? e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            toast.error('Não foi possível salvar', e?.message ?? 'Tente novamente em alguns instantes.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
                    hitSlop={12}
                    style={styles.headerSide}
                >
                    <ChevronLeft size={26} color={colors.text.primary} strokeWidth={2} />
                </Pressable>

                <Text style={styles.headerTitle}>Editar perfil</Text>

                <Pressable
                    onPress={handleSave}
                    disabled={!canSave}
                    accessibilityRole="button"
                    accessibilityLabel="Salvar"
                    accessibilityState={{ disabled: !canSave }}
                    hitSlop={12}
                    style={[styles.headerSide, styles.headerAction]}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={colors.purple[600]} />
                    ) : (
                        <Text
                            style={[
                                styles.headerActionText,
                                canSave ? styles.headerActionEnabled : styles.headerActionDisabled,
                            ]}
                        >
                            Salvar
                        </Text>
                    )}
                </Pressable>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
            >
                {/* PERFIL — foto + nome */}
                <Text style={styles.sectionLabel}>PERFIL</Text>
                <KCard variant="default">
                    <View style={styles.avatarRow}>
                        <AvatarPicker
                            avatarUrl={avatarUrl}
                            isUploading={isUploadingAvatar}
                            onPick={handlePickAvatar}
                            size={72}
                        />
                        <View style={styles.avatarHint}>
                            <Text style={styles.fieldLabel}>Foto de perfil</Text>
                            <Text style={styles.helper}>Toque para alterar. JPG, PNG ou WebP.</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <Text style={[styles.fieldLabel, { marginBottom: spacing[2] }]}>Nome</Text>
                    <View style={[styles.inputRow, !nameValid && styles.inputRowError]}>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Seu nome"
                            placeholderTextColor={colors.text.quaternary}
                            maxLength={80}
                            style={styles.input}
                            returnKeyType="done"
                        />
                    </View>
                    {!nameValid && (
                        <Text style={styles.errorHint}>Informe um nome válido (mínimo 2 caracteres).</Text>
                    )}
                </KCard>

                {/* ATENDIMENTO — modalidade */}
                <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>ATENDIMENTO</Text>
                <KCard variant="default">
                    <Text style={[styles.fieldLabel, { marginBottom: spacing[3] }]}>Foco de atendimento</Text>
                    <View style={styles.segmented}>
                        {MODALITY_OPTIONS.map((opt) => {
                            const selected = modality === opt.value;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => {
                                        Haptics.selectionAsync().catch(() => {});
                                        setModality(opt.value);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    style={[styles.segment, selected && styles.segmentSelected]}
                                >
                                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                                        {opt.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </KCard>

                {/* PREFERÊNCIAS — auto-publish */}
                <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>PREFERÊNCIAS</Text>
                <KCard variant="default">
                    <View style={styles.toggleRow}>
                        <View style={{ flex: 1, marginRight: spacing[3] }}>
                            <Text style={styles.fieldLabel}>Publicar relatórios automaticamente</Text>
                            <Text style={styles.helper}>
                                Ao concluir a edição de um programa, o relatório fica visível pro aluno sem
                                precisar publicar manualmente.
                            </Text>
                        </View>
                        <Switch
                            value={autoPublish}
                            onValueChange={(v) => {
                                Haptics.selectionAsync().catch(() => {});
                                setAutoPublish(v);
                            }}
                            trackColor={{ false: colors.border.default, true: colors.purple[600] }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </KCard>

                {/* REDES SOCIAIS — instagram */}
                <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>REDES SOCIAIS</Text>
                <KCard variant="default">
                    <View style={styles.fieldHeader}>
                        <View style={styles.iconBox}>
                            <Instagram size={16} color={colors.purple[700]} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.fieldLabel}>Instagram</Text>
                    </View>

                    <View style={[styles.inputRow, !handleValid && styles.inputRowError]}>
                        <Text style={styles.atPrefix}>@</Text>
                        <TextInput
                            value={handle}
                            onChangeText={setHandle}
                            placeholder="seu.usuario"
                            placeholderTextColor={colors.text.quaternary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="off"
                            maxLength={31}
                            style={styles.input}
                            returnKeyType="done"
                        />
                    </View>

                    {!handleValid && (
                        <Text style={styles.errorHint}>
                            Use só letras, números, ponto ou underscore (até 30 caracteres).
                        </Text>
                    )}
                    <Text style={styles.helper}>
                        Aparece no rodapé dos cards de treino que seus alunos postam nas redes. Deixe vazio
                        pra remover.
                    </Text>
                </KCard>
            </ScrollView>
        </SafeAreaView>
    );
}

function createStyles(c: V2Palette) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: c.surface.canvas,
        },
        // ── Header ─────────────────────────────────────────────────
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing[3],
            paddingTop: spacing[2],
            paddingBottom: spacing[3],
        },
        headerSide: {
            minWidth: 64,
            height: 36,
            justifyContent: 'center',
        },
        headerAction: {
            alignItems: 'flex-end',
        },
        headerTitle: {
            fontFamily: 'MonaSans_700Bold',
            fontSize: 17,
            color: c.text.primary,
            letterSpacing: -0.2,
        },
        headerActionText: {
            fontFamily: 'MonaSans_700Bold',
            fontSize: 15,
        },
        headerActionEnabled: {
            color: c.purple[600],
        },
        headerActionDisabled: {
            color: c.text.quaternary,
        },
        // ── Content ────────────────────────────────────────────────
        scroll: {
            paddingHorizontal: spacing[5],
            paddingTop: spacing[3],
            paddingBottom: spacing[8],
        },
        sectionLabel: {
            fontFamily: 'MonaSans_700Bold',
            fontSize: 11,
            letterSpacing: 1.4,
            color: c.text.tertiary,
            textTransform: 'uppercase',
            marginBottom: spacing[2],
            paddingLeft: 2,
        },
        // ── Avatar / name ──────────────────────────────────────────
        avatarRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[4],
        },
        avatarHint: {
            flex: 1,
        },
        divider: {
            height: 1,
            backgroundColor: c.border.subtle,
            marginVertical: spacing[4],
        },
        fieldHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
            marginBottom: spacing[3],
        },
        iconBox: {
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            backgroundColor: c.purple[100],
            alignItems: 'center',
            justifyContent: 'center',
        },
        fieldLabel: {
            fontFamily: 'MonaSans_700Bold',
            fontSize: 14,
            color: c.text.primary,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: c.surface.canvas,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: c.border.default,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
            gap: 4,
        },
        inputRowError: {
            borderColor: c.semantic.danger.fg,
        },
        atPrefix: {
            fontFamily: 'MonaSans_600SemiBold',
            fontSize: 16,
            color: c.text.tertiary,
        },
        input: {
            flex: 1,
            fontFamily: 'MonaSans_500Medium',
            fontSize: 16,
            color: c.text.primary,
            padding: 0,
        },
        // ── Segmented (modality) ───────────────────────────────────
        segmented: {
            flexDirection: 'row',
            backgroundColor: c.surface.canvas,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: c.border.default,
            padding: 3,
            gap: 3,
        },
        segment: {
            flex: 1,
            paddingVertical: spacing[3],
            borderRadius: radius.sm - 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        segmentSelected: {
            backgroundColor: c.purple[600],
        },
        segmentText: {
            fontFamily: 'MonaSans_600SemiBold',
            fontSize: 14,
            color: c.text.secondary,
        },
        segmentTextSelected: {
            color: '#ffffff',
        },
        // ── Toggle (auto-publish) ──────────────────────────────────
        toggleRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        errorHint: {
            fontFamily: 'MonaSans_500Medium',
            fontSize: 12,
            color: c.semantic.danger.fg,
            lineHeight: 16,
            marginTop: spacing[2],
        },
        helper: {
            fontFamily: 'MonaSans_500Medium',
            fontSize: 12,
            color: c.text.tertiary,
            lineHeight: 16,
            marginTop: spacing[2],
        },
    });
}
