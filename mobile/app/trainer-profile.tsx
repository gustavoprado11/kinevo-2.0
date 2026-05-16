// Tela de edição do perfil do trainer. Hoje (Fase atual) só edita o
// instagram_handle — campo usado no rodapé dos cards de share que o
// aluno posta nas redes (mobile/components/workout/sharing/_shared/
// ShareBrandFooter.tsx). Estrutura preparada pra ganhar mais campos
// (bio, especialidade, etc.) sem refator grande.
//
// Padrão visual: segue mesmo padrão das outras telas stack do app
// (header custom com botão Salvar trailing à direita, KCard, fontes
// PlusJakartaSans_*, tokens de spacing/colors). Botão no header em
// vez de footer porque footer com KeyboardAvoidingView é frágil
// (pode sumir quando teclado abre) e Salvar-no-header é o padrão iOS.

import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Instagram } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v2 } from '@kinevo/shared/tokens';
import { KCard } from '../components/v2';
import { supabase } from '../lib/supabase';
import { useRoleMode } from '../contexts/RoleModeContext';
import { useV2Colors, type V2Palette } from '../hooks/useV2Colors';
import { toast } from '../lib/toast';

const { spacing, radius } = v2;

// Regra Instagram pública (espelha o check constraint da migração 133):
// 1–30 chars, [A-Za-z0-9._] sem '@'.
const INSTAGRAM_HANDLE_REGEX = /^[A-Za-z0-9._]{1,30}$/;

/** Normaliza input: remove @ inicial, espaços e quebras de linha. */
function normalizeHandle(raw: string): string {
    return raw.replace(/^@+/, '').trim();
}

export default function TrainerProfileEditScreen() {
    const colors = useV2Colors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const { trainerProfile, refreshRoleMode } = useRoleMode();

    const initialHandle = trainerProfile?.instagram_handle ?? '';
    const [handle, setHandle] = useState<string>(initialHandle);
    const [isSaving, setIsSaving] = useState(false);

    const normalized = normalizeHandle(handle);
    const isEmpty = normalized.length === 0;
    const isValid = isEmpty || INSTAGRAM_HANDLE_REGEX.test(normalized);
    const hasChanged = normalized !== (initialHandle ?? '');
    const canSave = isValid && hasChanged && !isSaving;

    const handleSave = async () => {
        if (!canSave || !trainerProfile?.id) return;
        setIsSaving(true);
        try {
            // RLS `trainers_update` (auth_user_id = auth.uid()) permite
            // update direto. .select() pra confirmar persistência —
            // sem isso, RLS que bloqueia retorna 0 rows SEM error e o
            // save aparenta sucesso mas nada persiste.
            const newHandle = isEmpty ? null : normalized;
            const { data, error } = await supabase
                .from('trainers' as any)
                .update({ instagram_handle: newHandle })
                .eq('id', trainerProfile.id)
                .select('id, instagram_handle');

            if (__DEV__) {
                console.log('[TrainerProfileEdit] update result:', { data, error });
            }

            if (error) throw error;
            if (!data || (Array.isArray(data) && data.length === 0)) {
                throw new Error('Update retornou 0 linhas — possível bloqueio de RLS.');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            toast.success(
                'Perfil atualizado',
                isEmpty
                    ? 'Instagram removido.'
                    : `Agora aparece como @${normalized} nos cards de treino.`,
            );
            await refreshRoleMode();
            router.back();
        } catch (e: any) {
            if (__DEV__) console.error('[TrainerProfileEdit] save failed:', e?.message ?? e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            toast.error(
                'Não foi possível salvar',
                e?.message ?? 'Tente novamente em alguns instantes.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
            {/* Header custom (root _layout tem headerShown:false global).
                Estrutura espelha `financial/plans/index.tsx`: back + título
                centralizado + ação trailing à direita. Salvar fica no header
                em vez de footer pra não brigar com o teclado. */}
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
            >
                <Text style={styles.sectionLabel}>REDES SOCIAIS</Text>

                <KCard variant="default">
                    <View style={styles.fieldHeader}>
                        <View style={styles.iconBox}>
                            <Instagram size={16} color={colors.purple[700]} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.fieldLabel}>Instagram</Text>
                    </View>

                    <View
                        style={[
                            styles.inputRow,
                            !isValid && styles.inputRowError,
                        ]}
                    >
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
                            onSubmitEditing={() => canSave && handleSave()}
                        />
                    </View>

                    {!isValid && (
                        <Text style={styles.errorHint}>
                            Use só letras, números, ponto ou underscore (até 30 caracteres).
                        </Text>
                    )}
                    <Text style={styles.helper}>
                        Aparece no rodapé dos cards de treino que seus alunos postam nas redes.
                        Deixe vazio pra remover.
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
        // Largura fixa nos slots laterais pra título ficar centralizado
        // visualmente, mesmo se Salvar tiver largura diferente do botão back.
        headerSide: {
            minWidth: 64,
            height: 36,
            justifyContent: 'center',
        },
        headerAction: {
            alignItems: 'flex-end',
        },
        headerTitle: {
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 17,
            color: c.text.primary,
            letterSpacing: -0.2,
        },
        headerActionText: {
            fontFamily: 'PlusJakartaSans_700Bold',
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
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 11,
            letterSpacing: 1.4,
            color: c.text.tertiary,
            textTransform: 'uppercase',
            marginBottom: spacing[2],
            paddingLeft: 2,
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
            fontFamily: 'PlusJakartaSans_700Bold',
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
            fontFamily: 'PlusJakartaSans_600SemiBold',
            fontSize: 16,
            color: c.text.tertiary,
        },
        input: {
            flex: 1,
            fontFamily: 'PlusJakartaSans_500Medium',
            fontSize: 16,
            color: c.text.primary,
            padding: 0,
        },
        errorHint: {
            fontFamily: 'PlusJakartaSans_500Medium',
            fontSize: 12,
            color: c.semantic.danger.fg,
            lineHeight: 16,
            marginTop: spacing[2],
        },
        helper: {
            fontFamily: 'PlusJakartaSans_500Medium',
            fontSize: 12,
            color: c.text.tertiary,
            lineHeight: 16,
            marginTop: spacing[2],
        },
    });
}
