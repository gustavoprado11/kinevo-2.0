/**
 * AssistantConversationsSheet — histórico de conversas do Assistente (paridade
 * com a sidebar do web). Abre como sheet a partir do header do chat; tocar numa
 * conversa reabre; renomear (inline) e arquivar por linha.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Pencil, Archive, MessagesSquare, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import { AdaptiveModal } from '../shared/AdaptiveModal';
import { useAssistantConversations } from '../../hooks/useAssistantConversations';

const { spacing, radius } = v2;

function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const diff = Math.max(0, Date.now() - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `há ${d}d`;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (id: string) => void;
}

export function AssistantConversationsSheet({ visible, onClose, onSelect }: Props) {
    const colors = useV2Colors();
    const { items, loading, refresh, rename, archive } = useAssistantConversations();
    const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);

    useEffect(() => {
        if (visible) {
            void refresh();
            setRenaming(null);
        }
    }, [visible, refresh]);

    const confirmArchive = (id: string, title: string) => {
        Alert.alert('Arquivar conversa?', `"${title}" sairá da lista.`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Arquivar',
                style: 'destructive',
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    void archive(id);
                },
            },
        ]);
    };

    const saveRename = () => {
        if (!renaming) return;
        void rename(renaming.id, renaming.text);
        setRenaming(null);
    };

    return (
        <AdaptiveModal visible={visible} onClose={onClose} title="Conversas">
            {renaming ? (
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing[2],
                        paddingHorizontal: spacing[5],
                        paddingTop: spacing[3],
                    }}
                >
                    <TextInput
                        value={renaming.text}
                        onChangeText={(t) => setRenaming((r) => (r ? { ...r, text: t } : r))}
                        autoFocus
                        placeholder="Novo título"
                        placeholderTextColor={colors.text.quaternary}
                        onSubmitEditing={saveRename}
                        style={{
                            flex: 1,
                            fontFamily: 'MonaSans_600SemiBold',
                            fontSize: 14,
                            color: colors.text.primary,
                            backgroundColor: colors.surface.card2,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.purple[200],
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                        }}
                    />
                    <Pressable onPress={saveRename} accessibilityRole="button" accessibilityLabel="Salvar título" hitSlop={8}>
                        <Check size={22} color={colors.purple[600]} strokeWidth={2.2} />
                    </Pressable>
                    <Pressable onPress={() => setRenaming(null)} accessibilityRole="button" accessibilityLabel="Cancelar" hitSlop={8}>
                        <X size={22} color={colors.text.tertiary} strokeWidth={2.2} />
                    </Pressable>
                </View>
            ) : null}

            <ScrollView
                style={{ maxHeight: 460 }}
                contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[6] }}
                showsVerticalScrollIndicator={false}
            >
                {loading && items.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: spacing[6] }}>
                        <ActivityIndicator color={colors.purple[600]} />
                    </View>
                ) : items.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: spacing[6], gap: spacing[2] }}>
                        <MessagesSquare size={28} color={colors.text.quaternary} strokeWidth={1.8} />
                        <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 13, color: colors.text.tertiary }}>
                            Nenhuma conversa ainda
                        </Text>
                    </View>
                ) : (
                    <View style={{ gap: spacing[2] }}>
                        {items.map((c) => (
                            <View
                                key={c.id}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: spacing[2],
                                    backgroundColor: colors.surface.card,
                                    borderRadius: radius.md,
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                    paddingVertical: 11,
                                    paddingHorizontal: 13,
                                }}
                            >
                                <Pressable
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        onSelect(c.id);
                                        onClose();
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Abrir conversa ${c.title}`}
                                    style={{ flex: 1, minWidth: 0 }}
                                >
                                    <Text
                                        style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 14, color: colors.text.primary }}
                                        numberOfLines={1}
                                    >
                                        {c.title || 'Nova conversa'}
                                    </Text>
                                    <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11.5, color: colors.text.tertiary, marginTop: 1 }}>
                                        {[c.studentName, timeAgo(c.last_message_at)].filter(Boolean).join(' · ')}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setRenaming({ id: c.id, text: c.title || '' })}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Renomear ${c.title}`}
                                    hitSlop={8}
                                    style={{ padding: 6 }}
                                >
                                    <Pencil size={17} color={colors.text.tertiary} strokeWidth={1.9} />
                                </Pressable>
                                <Pressable
                                    onPress={() => confirmArchive(c.id, c.title || 'Conversa')}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Arquivar ${c.title}`}
                                    hitSlop={8}
                                    style={{ padding: 6 }}
                                >
                                    <Archive size={17} color={colors.text.tertiary} strokeWidth={1.9} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </AdaptiveModal>
    );
}
