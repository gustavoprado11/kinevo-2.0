import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, FlatList, TextInput, Pressable, Image,
    KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send, Check, CheckCheck, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useTrainerChatRoom, type ChatMessage } from '../../hooks/useTrainerChatRoom';
import { ChatImage } from '../../components/chat/ChatImage';
import { useV2Colors } from '../../hooks/useV2Colors';

// ── Helpers ──

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Component ──

export default function TrainerChatScreen() {
    const colors = useV2Colors();
    const { studentId } = useLocalSearchParams<{ studentId: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const {
        messages,
        isLoading,
        hasMore,
        sendText,
        markAsRead,
        loadMore,
    } = useTrainerChatRoom(studentId!);

    const [student, setStudent] = useState<{ name: string; avatar_url: string | null } | null>(null);
    const [text, setText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Fetch student info
    useEffect(() => {
        if (!studentId) return;
        supabase
            .from('students' as any)
            .select('name, avatar_url')
            .eq('id', studentId)
            .single()
            .then(({ data }: { data: any }) => {
                if (data) setStudent(data);
            });
    }, [studentId]);

    // Mark as read on mount
    useEffect(() => {
        if (!isLoading && messages.length > 0) {
            markAsRead();
        }
    }, [isLoading]);

    // Load more (older messages)
    const handleLoadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore) return;
        setIsLoadingMore(true);
        await loadMore();
        setIsLoadingMore(false);
    }, [hasMore, isLoadingMore, loadMore]);

    // Send message
    const handleSend = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed || isSending) return;

        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const msg = await sendText(trimmed);

        if (msg) {
            setText('');
        }

        setIsSending(false);
    }, [text, isSending, sendText]);

    // ── Render message bubble ──
    const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
        const isTrainer = item.sender_type === 'trainer';
        const showDate = index === 0 ||
            new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();

        return (
            <View>
                {showDate && (
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                        <Text style={{
                            fontSize: 10, fontWeight: '500', color: colors.text.tertiary,
                            backgroundColor: colors.surface.card2, paddingHorizontal: 12, paddingVertical: 4,
                            borderRadius: 10, overflow: 'hidden',
                        }}>
                            {formatDateSeparator(item.created_at)}
                        </Text>
                    </View>
                )}

                <View style={{
                    alignSelf: isTrainer ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    marginBottom: 4,
                    marginHorizontal: 16,
                }}>
                    <View style={{
                        borderRadius: 18,
                        borderBottomRightRadius: isTrainer ? 6 : 18,
                        borderBottomLeftRadius: isTrainer ? 18 : 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: isTrainer ? colors.purple[600] : colors.surface.card,
                        ...(isTrainer ? {} : {
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.04,
                            shadowRadius: 4,
                            elevation: 1,
                        }),
                    }}>
                        {(item.image_path || item.image_url) && (
                            <ChatImage
                                path={item.image_path}
                                fallbackUrl={item.image_url}
                                hasContent={!!item.content}
                                mutedColor={isTrainer ? 'rgba(255,255,255,0.4)' : colors.text.tertiary}
                                mutedBg={isTrainer ? 'rgba(255,255,255,0.1)' : colors.surface.card2}
                            />
                        )}

                        {item.content && (
                            <Text style={{
                                fontSize: 15, lineHeight: 20,
                                color: isTrainer ? '#FFFFFF' : colors.text.primary,
                            }}>
                                {item.content}
                            </Text>
                        )}

                        <View style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            justifyContent: isTrainer ? 'flex-end' : 'flex-start',
                            marginTop: 4,
                        }}>
                            <Text style={{
                                fontSize: 10,
                                color: isTrainer ? 'rgba(255,255,255,0.5)' : colors.text.tertiary,
                            }}>
                                {formatTime(item.created_at)}
                            </Text>
                            {isTrainer && (
                                item.read_at
                                    ? <CheckCheck size={12} color="rgba(255,255,255,0.7)" />
                                    : <Check size={12} color="rgba(255,255,255,0.4)" />
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    }, [messages]);

    const canSend = text.trim().length > 0 && !isSending;

    if (!studentId) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text.secondary }}>Aluno não encontrado</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.surface.canvas }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
        >
            {/* Header */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 16, paddingVertical: 10,
                paddingTop: insets.top + 10,
                backgroundColor: colors.surface.card,
                borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
            }}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <ChevronLeft size={24} color={colors.text.primary} />
                </Pressable>

                {student?.avatar_url ? (
                    <Image
                        source={{ uri: student.avatar_url }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                ) : student ? (
                    <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: colors.purple[100],
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple[600] }}>
                            {getInitials(student.name)}
                        </Text>
                    </View>
                ) : null}

                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary, flex: 1 }}>
                    {student?.name || 'Aluno'}
                </Text>
            </View>

            {/* Messages */}
            {isLoading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color={colors.purple[600]} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{
                        paddingVertical: 8,
                        flexGrow: 1,
                        justifyContent: messages.length === 0 ? 'center' : undefined,
                    }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <View style={{
                                width: 56, height: 56, borderRadius: 28,
                                backgroundColor: colors.surface.card2,
                                alignItems: 'center', justifyContent: 'center',
                                marginBottom: 12,
                            }}>
                                <MessageCircle size={24} color={colors.text.tertiary} />
                            </View>
                            <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>
                                Nenhuma mensagem ainda. Envie a primeira!
                            </Text>
                        </View>
                    }
                    ListHeaderComponent={
                        hasMore ? (
                            <Pressable onPress={handleLoadMore} style={{ alignItems: 'center', paddingVertical: 12 }}>
                                {isLoadingMore ? (
                                    <ActivityIndicator size="small" color={colors.purple[600]} />
                                ) : (
                                    <Text style={{ fontSize: 12, color: colors.purple[600], fontWeight: '600' }}>
                                        Carregar anteriores
                                    </Text>
                                )}
                            </Pressable>
                        ) : null
                    }
                    onContentSizeChange={() => {
                        if (!isLoadingMore) {
                            flatListRef.current?.scrollToEnd({ animated: false });
                        }
                    }}
                />
            )}

            {/* Input area */}
            <View style={{
                backgroundColor: colors.surface.card,
                borderTopWidth: 1, borderTopColor: colors.border.default,
                paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 + insets.bottom,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder="Mensagem..."
                        placeholderTextColor={colors.text.tertiary}
                        multiline
                        maxLength={2000}
                        style={{
                            flex: 1,
                            backgroundColor: colors.surface.card2,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            fontSize: 15,
                            maxHeight: 100,
                            color: colors.text.primary,
                        }}
                    />

                    <Pressable
                        onPress={handleSend}
                        disabled={!canSend}
                        style={{
                            width: 36, height: 36, borderRadius: 18,
                            backgroundColor: canSend ? colors.purple[600] : colors.border.default,
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Send size={16} color={canSend ? '#FFFFFF' : colors.text.tertiary} strokeWidth={2} />
                        )}
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
