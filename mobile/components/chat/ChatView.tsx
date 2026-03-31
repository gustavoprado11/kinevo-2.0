import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, FlatList, TextInput, Pressable, Image,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, ImagePlus, ImageOff, X, Check, CheckCheck, MessageCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useTrainerChat, type ChatMessage } from '../../hooks/useTrainerChat';

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

// ── Props ──

interface ChatViewProps {
    showBackButton?: boolean;
}

// ── Component ──

export function ChatView({ showBackButton = false }: ChatViewProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // When inline in a tab, add padding for the absolutely-positioned tab bar (50 + bottom inset)
    const tabBarPadding = showBackButton ? 0 : 50 + insets.bottom;

    const {
        studentId,
        trainer,
        fetchMessages,
        sendTextMessage,
        sendImageMessage,
        markAsRead,
    } = useTrainerChat();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [text, setText] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
    const [isSending, setIsSending] = useState(false);
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
    const flatListRef = useRef<FlatList>(null);

    // Load initial messages
    useEffect(() => {
        if (!studentId) return;
        setIsLoading(true);

        fetchMessages().then(result => {
            setMessages(result.messages);
            setHasMore(result.hasMore);
            setIsLoading(false);
            markAsRead();
        });
    }, [studentId, fetchMessages, markAsRead]);

    // Realtime: new messages
    useEffect(() => {
        if (!studentId) return;

        const channel = supabase
            .channel(`chatview_${studentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    const newMsg = payload.new as ChatMessage;
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                    if (newMsg.sender_type === 'trainer') {
                        markAsRead();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    const updated = payload.new as ChatMessage;
                    setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [studentId, markAsRead]);

    // Load more (older messages)
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore || messages.length === 0) return;
        setIsLoadingMore(true);

        const oldestCreatedAt = messages[0].created_at;
        const result = await fetchMessages(oldestCreatedAt);

        setMessages(prev => [...result.messages, ...prev]);
        setHasMore(result.hasMore);
        setIsLoadingMore(false);
    }, [hasMore, isLoadingMore, messages, fetchMessages]);

    // Send message
    const handleSend = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed && !imageUri) return;
        if (isSending) return;

        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        let msg: ChatMessage | null = null;

        if (imageUri) {
            msg = await sendImageMessage(imageUri, trimmed || undefined, imageMimeType);
        } else {
            msg = await sendTextMessage(trimmed);
        }

        if (msg) {
            setMessages(prev => {
                if (prev.some(m => m.id === msg!.id)) return prev;
                return [...prev, msg!];
            });
            setText('');
            setImageUri(null);
            setImageMimeType(undefined);
        }

        setIsSending(false);
    }, [text, imageUri, imageMimeType, isSending, sendTextMessage, sendImageMessage]);

    // Pick image
    const pickImage = useCallback(async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
        });

        if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
            setImageMimeType(result.assets[0].mimeType ?? undefined);
        }
    }, []);

    // ── Render message bubble ──
    const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
        const isStudent = item.sender_type === 'student';
        const showDate = index === 0 ||
            new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();

        return (
            <View>
                {showDate && (
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                        <Text style={{
                            fontSize: 10, fontWeight: '500', color: '#94a3b8',
                            backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 4,
                            borderRadius: 10, overflow: 'hidden',
                        }}>
                            {formatDateSeparator(item.created_at)}
                        </Text>
                    </View>
                )}

                <View style={{
                    alignSelf: isStudent ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    marginBottom: 4,
                    marginHorizontal: 16,
                }}>
                    <View style={{
                        borderRadius: 18,
                        borderBottomRightRadius: isStudent ? 6 : 18,
                        borderBottomLeftRadius: isStudent ? 18 : 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: isStudent ? '#7c3aed' : '#ffffff',
                        ...(isStudent ? {} : {
                            borderWidth: 1,
                            borderColor: 'rgba(0,0,0,0.06)',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.04,
                            shadowRadius: 4,
                            elevation: 1,
                        }),
                    }}>
                        {item.image_url && (
                            failedImages.has(item.id) ? (
                                <View style={{
                                    width: 220, height: 100, borderRadius: 12,
                                    backgroundColor: isStudent ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                    alignItems: 'center', justifyContent: 'center',
                                    marginBottom: item.content ? 6 : 0,
                                }}>
                                    <ImageOff size={24} color={isStudent ? 'rgba(255,255,255,0.4)' : '#94a3b8'} />
                                    <Text style={{ fontSize: 11, color: isStudent ? 'rgba(255,255,255,0.4)' : '#94a3b8', marginTop: 4 }}>
                                        Imagem indisponível
                                    </Text>
                                </View>
                            ) : (
                                <Image
                                    source={{ uri: item.image_url }}
                                    style={{
                                        width: 220, height: 160, borderRadius: 12,
                                        marginBottom: item.content ? 6 : 0,
                                    }}
                                    resizeMode="cover"
                                    onError={() => setFailedImages(prev => new Set(prev).add(item.id))}
                                />
                            )
                        )}

                        {item.content && (
                            <Text style={{
                                fontSize: 15, lineHeight: 20,
                                color: isStudent ? '#ffffff' : '#0f172a',
                            }}>
                                {item.content}
                            </Text>
                        )}

                        <View style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            justifyContent: isStudent ? 'flex-end' : 'flex-start',
                            marginTop: 4,
                        }}>
                            <Text style={{
                                fontSize: 10,
                                color: isStudent ? 'rgba(255,255,255,0.5)' : '#94a3b8',
                            }}>
                                {formatTime(item.created_at)}
                            </Text>
                            {isStudent && (
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

    const canSend = (text.trim().length > 0 || imageUri !== null) && !isSending;

    // No trainer linked
    if (!studentId && !isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <MessageCircle size={24} color="#94a3b8" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', textAlign: 'center' }}>
                    Você ainda não tem um treinador vinculado.
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={showBackButton ? 0 : 90}
        >
            {/* Header */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 16, paddingVertical: 10,
                backgroundColor: '#ffffff',
                borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
            }}>
                {showBackButton && (
                    <Pressable onPress={() => router.back()} hitSlop={12}>
                        <ChevronLeft size={24} color="#0f172a" />
                    </Pressable>
                )}

                {trainer?.avatar_url ? (
                    <Image
                        source={{ uri: trainer.avatar_url }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                ) : trainer ? (
                    <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: '#f5f3ff',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#7c3aed' }}>
                            {getInitials(trainer.name)}
                        </Text>
                    </View>
                ) : null}

                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 }}>
                    {trainer?.name || 'Treinador'}
                </Text>
            </View>

            {/* Messages */}
            {isLoading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#7c3aed" />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingVertical: 8, flexGrow: 1, justifyContent: messages.length === 0 ? 'center' : undefined }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                                Nenhuma mensagem ainda. Envie a primeira!
                            </Text>
                        </View>
                    }
                    ListHeaderComponent={
                        hasMore ? (
                            <Pressable onPress={loadMore} style={{ alignItems: 'center', paddingVertical: 12 }}>
                                {isLoadingMore ? (
                                    <ActivityIndicator size="small" color="#7c3aed" />
                                ) : (
                                    <Text style={{ fontSize: 12, color: '#7c3aed', fontWeight: '600' }}>
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
                backgroundColor: '#ffffff',
                borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
                paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 + tabBarPadding,
            }}>
                {/* Image preview */}
                {imageUri && (
                    <View style={{ marginBottom: 8, position: 'relative', alignSelf: 'flex-start' }}>
                        <Image
                            source={{ uri: imageUri }}
                            style={{ width: 80, height: 80, borderRadius: 12 }}
                        />
                        <Pressable
                            onPress={() => setImageUri(null)}
                            style={{
                                position: 'absolute', top: -6, right: -6,
                                width: 20, height: 20, borderRadius: 10,
                                backgroundColor: '#0f172a',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <X size={10} color="#ffffff" strokeWidth={3} />
                        </Pressable>
                    </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                    {/* TODO: Re-enable image upload after fixing RN XMLHttpRequest/FormData issue with Supabase Storage */}
                    {/*
                    <Pressable onPress={pickImage} hitSlop={8} style={{ paddingBottom: 6 }}>
                        <ImagePlus size={22} color="#94a3b8" strokeWidth={1.5} />
                    </Pressable>
                    */}

                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder="Mensagem..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        maxLength={2000}
                        style={{
                            flex: 1,
                            backgroundColor: '#f1f5f9',
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            fontSize: 15,
                            maxHeight: 100,
                            color: '#0f172a',
                        }}
                    />

                    <Pressable
                        onPress={handleSend}
                        disabled={!canSend}
                        style={{
                            width: 36, height: 36, borderRadius: 18,
                            backgroundColor: canSend ? '#7c3aed' : '#e2e8f0',
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Send size={16} color={canSend ? '#ffffff' : '#94a3b8'} strokeWidth={2} />
                        )}
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
