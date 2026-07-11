import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MessageCircle, Search, Image as ImageIcon } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp, Easing } from 'react-native-reanimated';
import {
    useTrainerConversations,
    type Conversation,
} from '../../hooks/useTrainerConversations';
import { v2 } from '@kinevo/shared/tokens';
import {
    KCard,
    KSearchBox,
    KSegmented,
    Avatar,
    KSkeleton,
    KSkeletonRow,
    type AvatarStatus,
} from '../../components/v2';
import { useV2Colors } from '../../hooks/useV2Colors';

// Palette light fallback usada em arrays/configs module-level. Componentes
// chamam useV2Colors() para tokens sensíveis a modo.
const { colors, typography, spacing, radius } = v2;

type MessagesFilter = 'all' | 'unread' | 'attention';

function relativeTimestamp(iso: string): string {
    const now = new Date();
    const d = new Date(iso);
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days === 0) {
        const hours = Math.floor(diffMs / 3600000);
        if (hours === 0) {
            const min = Math.floor(diffMs / 60000);
            return min <= 1 ? 'agora' : `${min} min`;
        }
        return `${hours}h`;
    }
    if (days === 1) return 'ontem';
    if (days < 7) return `${days} dias`;
    if (days < 30) return `${Math.floor(days / 7)} sem`;
    return `${Math.floor(days / 30)}m`;
}

function avatarStatusFor(s: Conversation['student']): AvatarStatus | undefined {
    if (s.status === 'inactive') return 'inactive';
    if (s.status === 'pending') return 'attention';
    return undefined;
}

export default function MessagesScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { conversations, totalUnread, isLoading, isRefreshing, refresh } = useTrainerConversations();

    // M17: revalida ao voltar o foco (ex.: depois de ler uma conversa). O hook só
    // escuta INSERT e não tinha refetch no foco, então o badge/indicador de
    // não-lida ficava errado até pull-to-refresh. Pula o foco inicial (mount já
    // carrega).
    const didInitialFocusRef = useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (!didInitialFocusRef.current) {
                didInitialFocusRef.current = true;
                return;
            }
            refresh();
        }, [refresh])
    );

    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filter, setFilter] = useState<MessagesFilter>('all');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = useCallback((text: string) => {
        setSearchText(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(text);
        }, 300);
    }, []);

    const filteredConversations = useMemo(() => {
        let list = conversations;
        if (debouncedSearch.trim()) {
            const q = debouncedSearch.trim().toLowerCase();
            list = list.filter((c) => c.student.name.toLowerCase().includes(q));
        }
        if (filter === 'unread') list = list.filter((c) => c.unreadCount > 0);
        if (filter === 'attention') {
            list = list.filter(
                (c) => c.student.status === 'inactive' || c.student.status === 'pending',
            );
        }
        return list;
    }, [conversations, debouncedSearch, filter]);

    const unreadCount = useMemo(
        () => conversations.filter((c) => c.unreadCount > 0).length,
        [conversations],
    );
    const attentionCount = useMemo(
        () =>
            conversations.filter(
                (c) => c.student.status === 'inactive' || c.student.status === 'pending',
            ).length,
        [conversations],
    );

    const handleConversationPress = useCallback(
        (conv: Conversation) => {
            router.push({
                pathname: '/messages/[studentId]',
                params: { studentId: conv.student.id },
            } as never);
        },
        [router],
    );

    const renderItem = useCallback(
        ({ item, index }: { item: Conversation; index: number }) => (
            <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 25).duration(220).easing(Easing.out(Easing.cubic))}>
                <ConversationRow
                    conversation={item}
                    onPress={() => handleConversationPress(item)}
                />
            </Animated.View>
        ),
        [handleConversationPress],
    );

    const keyExtractor = useCallback((item: Conversation) => item.student.id, []);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={['top']}>
            <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)} style={{ paddingTop: spacing[4] }}>
                    <Text
                        style={{
                            fontFamily: 'PlusJakartaSans_800ExtraBold',
                            fontSize: typography.display.size,
                            lineHeight: typography.display.lineHeight,
                            letterSpacing: typography.display.letterSpacing,
                            color: colors.text.primary,
                        }}
                    >
                        Mensagens
                    </Text>
                    <Text
                        style={{
                            fontFamily: 'PlusJakartaSans_500Medium',
                            fontSize: typography.bodySm.size,
                            color: colors.text.tertiary,
                            marginTop: spacing[1],
                        }}
                    >
                        {totalUnread > 0 ? `${totalUnread} não lida${totalUnread === 1 ? '' : 's'} · ` : ''}
                        {conversations.length} conversa{conversations.length === 1 ? '' : 's'}
                    </Text>
                </Animated.View>

                {/* Search */}
                <Animated.View
                    entering={FadeInUp.delay(40).duration(280)}
                    style={{ marginTop: spacing[4] }}
                >
                    <KSearchBox
                        value={searchText}
                        onChangeText={handleSearchChange}
                        placeholder="Buscar aluno…"
                        onClear={() => {
                            setSearchText('');
                            setDebouncedSearch('');
                        }}
                        accessibilityLabel="Buscar aluno"
                    />
                </Animated.View>

                {/* Segmented */}
                <Animated.View
                    entering={FadeInUp.delay(70).duration(280)}
                    style={{ marginTop: spacing[3], marginBottom: spacing[3] }}
                >
                    <KSegmented<MessagesFilter>
                        value={filter}
                        onChange={setFilter}
                        items={[
                            { value: 'all', label: 'Todas', count: conversations.length },
                            { value: 'unread', label: 'Não lidas', count: unreadCount },
                            { value: 'attention', label: 'Atenção', count: attentionCount },
                        ]}
                        accessibilityLabel="Filtro de conversas"
                    />
                </Animated.View>

                {/* Content */}
                {isLoading ? (
                    <View style={{ gap: spacing[2], paddingTop: spacing[2] }}>
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                    </View>
                ) : (
                    <FlatList
                        data={filteredConversations}
                        renderItem={renderItem}
                        keyExtractor={keyExtractor}
                        contentContainerStyle={{
                            paddingBottom: 120,
                            gap: spacing[2],
                            flexGrow: 1,
                        }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={refresh}
                                tintColor={colors.purple[600]}
                            />
                        }
                        ListEmptyComponent={<MessagesEmpty searching={!!debouncedSearch.trim()} />}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

function ConversationRow({
    conversation,
    onPress,
}: {
    conversation: Conversation;
    onPress: () => void;
}) {
    const colors = useV2Colors();
    const { student, lastMessage, unreadCount } = conversation;
    const isUnread = unreadCount > 0;
    const isFromTrainer = lastMessage?.sender_type === 'trainer';
    const hasImage = !!lastMessage?.image_url;
    const previewText = lastMessage?.content || (hasImage ? 'Imagem' : 'Sem mensagens ainda');

    return (
        <KCard
            onPress={onPress}
            accessibilityLabel={`Conversa com ${student.name}${isUnread ? `, ${unreadCount} não lidas` : ''}`}
        >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
                <Avatar
                    name={student.name}
                    size="md"
                    src={student.avatar_url ?? undefined}
                    status={avatarStatusFor(student)}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                        <Text
                            style={{
                                fontFamily: isUnread
                                    ? 'PlusJakartaSans_800ExtraBold'
                                    : 'PlusJakartaSans_600SemiBold',
                                fontSize: typography.title3.size,
                                color: colors.text.primary,
                                flex: 1,
                                letterSpacing: typography.title3.letterSpacing,
                            }}
                            numberOfLines={1}
                        >
                            {student.name}
                        </Text>
                        {lastMessage ? (
                            <Text
                                style={{
                                    fontFamily: isUnread
                                        ? 'PlusJakartaSans_700Bold'
                                        : 'PlusJakartaSans_500Medium',
                                    fontSize: 12,
                                    color: isUnread ? colors.purple[600] : colors.neutral[500],
                                }}
                            >
                                {relativeTimestamp(lastMessage.created_at)}
                            </Text>
                        ) : null}
                    </View>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 4,
                            gap: spacing[1],
                        }}
                    >
                        {hasImage ? (
                            <ImageIcon size={12} color={colors.neutral[500]} strokeWidth={2.2} />
                        ) : null}
                        <Text
                            style={{
                                fontFamily: 'PlusJakartaSans_500Medium',
                                fontSize: 13,
                                color: isUnread ? colors.neutral[700] : colors.neutral[500],
                                flex: 1,
                            }}
                            numberOfLines={1}
                        >
                            {isFromTrainer ? (
                                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>Você: </Text>
                            ) : null}
                            {previewText}
                        </Text>
                        {isUnread ? (
                            <View
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: colors.purple[600],
                                    shadowColor: colors.purple[600],
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.6,
                                    shadowRadius: 4,
                                }}
                            />
                        ) : null}
                    </View>
                </View>
            </View>
        </KCard>
    );
}

function MessagesEmpty({ searching }: { searching: boolean }) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 60,
            }}
        >
            <View
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.pill,
                    backgroundColor: colors.neutral[100],
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                }}
            >
                {searching ? (
                    <Search size={24} color={colors.text.quaternary} />
                ) : (
                    <MessageCircle size={24} color={colors.text.quaternary} />
                )}
            </View>
            <Text
                style={{
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    fontSize: 14,
                    color: colors.text.secondary,
                    textAlign: 'center',
                }}
            >
                {searching ? 'Nenhum aluno encontrado' : 'Você ainda não tem alunos'}
            </Text>
        </View>
    );
}
