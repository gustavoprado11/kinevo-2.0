import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, FlatList, TextInput, Pressable, Image,
    KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Alert, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, ImagePlus, X, Check, CheckCheck, MessageCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useTrainerChat, type ChatMessage } from '../../hooks/useTrainerChat';
import { ChatImage } from './ChatImage';
import { useV2Colors } from '../../hooks/useV2Colors';
import { useBrand } from '../../stores/brandStore';
import { toRgba } from '../../lib/brandColor';

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
    const colors = useV2Colors();
    const brand = useBrand();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Track keyboard visibility so we can drop the tab-bar padding when the
    // keyboard is on screen (the tab bar hides automatically on iOS).
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    // When inline in a tab, add padding for the absolutely-positioned tab bar
    // (V2 glass nav: 64pt altura + 8pt offset acima da safe area) — só quando
    // o teclado está escondido (no iOS a nav some com o teclado).
    const tabBarPadding = showBackButton ? 0 : (keyboardVisible ? 0 : 72 + insets.bottom);

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
    const flatListRef = useRef<FlatList>(null);

    // A11: refs estáveis pra fetchMessages/markAsRead. Como deps de effect eles
    // re-rodavam a cada mensagem (markAsRead muda com unreadCount), causando
    // refetch total + flash de loading + churn do canal Realtime. Lemos a versão
    // atual via ref e mantemos os effects presos só a `studentId`.
    const fetchMessagesRef = useRef(fetchMessages);
    fetchMessagesRef.current = fetchMessages;
    const markAsReadRef = useRef(markAsRead);
    markAsReadRef.current = markAsRead;
    // A13: guard síncrono contra duplo-tap no envio.
    const isSendingRef = useRef(false);

    // Load initial messages
    useEffect(() => {
        if (!studentId) return;
        setIsLoading(true);

        fetchMessagesRef.current().then(result => {
            setMessages(result.messages);
            setHasMore(result.hasMore);
            setIsLoading(false);
            markAsReadRef.current();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId]);

    // M3 (auditoria 11/jul): o Realtime NÃO reentrega eventos perdidos enquanto
    // o app esteve em background (socket cai) — a thread aberta ficava sem as
    // mensagens novas mesmo com o badge subindo. Ao voltar ao foreground,
    // re-busca a página mais recente e MESCLA por id (preserva histórico já
    // paginado; fresh chega em ordem ascendente, igual ao append do realtime).
    useEffect(() => {
        if (!studentId) return;
        const sub = AppState.addEventListener('change', (state) => {
            if (state !== 'active') return;
            fetchMessagesRef.current().then(result => {
                setMessages(prev => {
                    const known = new Set(prev.map(m => m.id));
                    const fresh = result.messages.filter(m => !known.has(m.id));
                    return fresh.length === 0 ? prev : [...prev, ...fresh];
                });
                markAsReadRef.current();
            }).catch(() => {});
        });
        return () => sub.remove();
    }, [studentId]);

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
                        markAsReadRef.current();
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId]);

    // Load more (older messages)
    // M19: sinaliza (síncrono) que estamos prependando histórico, pra o
    // onContentSizeChange NÃO rolar pro fim. O state isLoadingMore já era false
    // quando o content size mudava (batch no mesmo tick), jogando a lista de volta
    // pro fim e impedindo ler mensagens antigas.
    const isPrependingRef = useRef(false);

    const loadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore || messages.length === 0) return;
        setIsLoadingMore(true);

        const oldestCreatedAt = messages[0].created_at;
        const result = await fetchMessages(oldestCreatedAt);

        isPrependingRef.current = true;
        setMessages(prev => [...result.messages, ...prev]);
        setHasMore(result.hasMore);
        setIsLoadingMore(false);
        setTimeout(() => { isPrependingRef.current = false; }, 50);
    }, [hasMore, isLoadingMore, messages, fetchMessages]);

    // Send message
    const handleSend = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed && !imageUri) return;
        if (isSendingRef.current) return; // A13: ignora duplo-tap (state é assíncrono)
        isSendingRef.current = true;

        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        let msg: ChatMessage | null = null;
        try {
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
            } else {
                // A13: falha de envio não pode ser silenciosa — o texto/imagem
                // continua no input pra reenviar.
                Alert.alert('Não foi possível enviar', 'Verifique sua conexão e tente novamente. Sua mensagem não foi perdida.');
            }
        } finally {
            setIsSending(false);
            isSendingRef.current = false;
        }
    }, [text, imageUri, imageMimeType, sendTextMessage, sendImageMessage]);

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
                            fontSize: 10, fontWeight: '500', color: colors.text.tertiary,
                            backgroundColor: colors.surface.card2, paddingHorizontal: 12, paddingVertical: 4,
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
                        backgroundColor: isStudent ? brand.color : colors.surface.card,
                        ...(isStudent ? {} : {
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
                                mutedColor={isStudent ? 'rgba(255,255,255,0.4)' : colors.text.tertiary}
                                mutedBg={isStudent ? 'rgba(255,255,255,0.1)' : colors.surface.card2}
                            />
                        )}

                        {item.content && (
                            <Text style={{
                                fontSize: 15, lineHeight: 20,
                                color: isStudent ? '#FFFFFF' : colors.text.primary,
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
                                color: isStudent ? 'rgba(255,255,255,0.5)' : colors.text.tertiary,
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
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface.card2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <MessageCircle size={24} color={colors.text.tertiary} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, textAlign: 'center' }}>
                    Você ainda não tem um treinador vinculado.
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
        >
            {/* Header */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 16, paddingVertical: 10,
                backgroundColor: colors.surface.card,
                borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
            }}>
                {showBackButton && (
                    <Pressable onPress={() => router.back()} hitSlop={12}>
                        <ChevronLeft size={24} color={colors.text.primary} />
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
                        backgroundColor: toRgba(brand.color, 0.16),
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: brand.color }}>
                            {getInitials(trainer.name)}
                        </Text>
                    </View>
                ) : null}

                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary, flex: 1 }}>
                    {trainer?.name || 'Treinador'}
                </Text>
            </View>

            {/* Messages */}
            {isLoading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color={brand.color} />
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
                            <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>
                                Nenhuma mensagem ainda. Envie a primeira!
                            </Text>
                        </View>
                    }
                    ListHeaderComponent={
                        hasMore ? (
                            <Pressable onPress={loadMore} style={{ alignItems: 'center', paddingVertical: 12 }}>
                                {isLoadingMore ? (
                                    <ActivityIndicator size="small" color={brand.color} />
                                ) : (
                                    <Text style={{ fontSize: 12, color: brand.color, fontWeight: '600' }}>
                                        Carregar anteriores
                                    </Text>
                                )}
                            </Pressable>
                        ) : null
                    }
                    onContentSizeChange={() => {
                        if (!isPrependingRef.current) {
                            flatListRef.current?.scrollToEnd({ animated: false });
                        }
                    }}
                />
            )}

            {/* Input area */}
            <View style={{
                backgroundColor: colors.surface.card,
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
                                backgroundColor: colors.text.primary,
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <X size={10} color={colors.surface.card} strokeWidth={3} />
                        </Pressable>
                    </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                    {/* Upload de imagem reabilitado: upload agora via expo-file-system File().bytes()
                        + supabase.storage (sem o FormData/XMLHttpRequest que falhava no RN). */}
                    <Pressable onPress={pickImage} hitSlop={8} style={{ paddingBottom: 6 }}>
                        <ImagePlus size={22} color={colors.text.tertiary} strokeWidth={1.5} />
                    </Pressable>

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
                            backgroundColor: canSend ? brand.color : colors.border.default,
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
