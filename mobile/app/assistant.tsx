/**
 * app/assistant — tela de conversa do Assistente do treinador.
 *
 * Fase 2: ligada ao backend real via useAssistantChat (endpoints Bearer
 * /api/trainer/assistant/*). Envio NÃO-streaming — mostra "Pensando…" enquanto
 * o turno roda e renderiza o texto + parts (ações, perguntas clicáveis,
 * confirmações/propostas read-only). HITL acionável e streaming = fases futuras.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Sparkles, Plus, X, AlertCircle, MessagesSquare } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../hooks/useV2Colors';
import { useAssistantChat, type AssistantError } from '../hooks/useAssistantChat';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { AssistantMessageBubble } from '../components/assistant/AssistantMessageBubble';
import { AssistantComposer } from '../components/assistant/AssistantComposer';
import { AssistantParts } from '../components/assistant/AssistantParts';
import { AssistantConversationsSheet } from '../components/assistant/AssistantConversationsSheet';
import { CreditMeter } from '../components/assistant/CreditMeter';

const { spacing } = v2;

export default function AssistantChatScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { q } = useLocalSearchParams<{ q?: string }>();

    const { messages, isSending, progress, error, summary, send, stop, confirmAction, cancelAction, loadConversation, reset, clearError } =
        useAssistantChat();
    const [input, setInput] = useState('');
    const [showConversations, setShowConversations] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const voice = useVoiceInput((t) => setInput(t));
    const scrollRef = useRef<ScrollView>(null);
    const didInit = useRef(false);

    // Quando o teclado sobe, o próprio teclado cobre a área do home-indicator,
    // então colapsamos o inset de baixo do composer (senão sobra um vão).
    useEffect(() => {
        const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const s = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
        const h = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
        return () => {
            s.remove();
            h.remove();
        };
    }, []);

    const scrollToEnd = () => {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    };

    // Envia a pergunta inicial (vinda da Home Assistente) uma única vez.
    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;
        if (q && q.trim()) void send(q.trim());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = (raw?: string) => {
        const text = (raw ?? input).trim();
        if (!text) return;
        setInput('');
        void send(text);
        scrollToEnd();
    };

    const newChat = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        reset();
        setInput('');
    };

    const hasContent = messages.length > 0 || isSending;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Nav header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.subtle,
                }}
            >
                <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10}>
                    <ChevronLeft size={24} color={colors.text.secondary} strokeWidth={1.9} />
                </Pressable>
                <LinearGradient
                    colors={[colors.purple[500], colors.purple[700]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}
                >
                    <Sparkles size={18} color="#FFFFFF" strokeWidth={1.6} />
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text.primary }}>
                        Assistente
                    </Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: colors.text.tertiary }}>
                        Contexto dos seus alunos
                    </Text>
                </View>
                <CreditMeter summary={summary} />
                <Pressable
                    onPress={() => setShowConversations(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Histórico de conversas"
                    hitSlop={10}
                    style={{ marginRight: spacing[1], marginLeft: spacing[1] }}
                >
                    <MessagesSquare size={21} color={colors.text.secondary} strokeWidth={1.9} />
                </Pressable>
                <Pressable onPress={newChat} accessibilityRole="button" accessibilityLabel="Nova conversa" hitSlop={10}>
                    <Plus size={22} color={colors.text.secondary} strokeWidth={1.9} />
                </Pressable>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {!hasContent ? (
                    <EmptyState onPick={(s) => submit(s)} />
                ) : (
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: spacing[4], gap: spacing[5] }}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={scrollToEnd}
                        keyboardShouldPersistTaps="handled"
                    >
                        {messages.map((m) => (
                            <AssistantMessageBubble key={m.id} role={m.role} text={m.content}>
                                {m.role === 'assistant' && m.parts.length > 0 ? (
                                    <AssistantParts
                                        parts={m.parts}
                                        onAnswer={(t) => submit(t)}
                                        onConfirm={(part, editedArgs) => void confirmAction(part, editedArgs)}
                                        onCancel={(part) => void cancelAction(part)}
                                        onOpenDraft={(programId) =>
                                            router.push(`/program-builder/edit/${programId}` as never)
                                        }
                                        disabled={isSending}
                                    />
                                ) : null}
                            </AssistantMessageBubble>
                        ))}
                        {isSending ? <ThinkingRow label={progress} /> : null}
                    </ScrollView>
                )}

                {error ? <ErrorBanner error={error} onDismiss={clearError} /> : null}

                {/* Composer */}
                <View
                    style={{
                        paddingHorizontal: spacing[4],
                        paddingTop: spacing[2],
                        paddingBottom: keyboardVisible ? spacing[2] : insets.bottom + spacing[2],
                    }}
                >
                    <AssistantComposer
                        placeholder="Responder…"
                        value={input}
                        onChangeText={setInput}
                        onSend={() => submit()}
                        onPressMic={voice.toggle}
                        listening={voice.isListening}
                        sending={isSending}
                        onStop={stop}
                    />
                </View>
            </KeyboardAvoidingView>

            <AssistantConversationsSheet
                visible={showConversations}
                onClose={() => setShowConversations(false)}
                onSelect={(id) => void loadConversation(id)}
            />
        </SafeAreaView>
    );
}

function ThinkingRow({ label }: { label?: string | null }) {
    const colors = useV2Colors();
    return (
        <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center' }}>
            <LinearGradient
                colors={[colors.purple[500], colors.purple[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
            >
                <Sparkles size={16} color="#FFFFFF" strokeWidth={1.6} />
            </LinearGradient>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <ActivityIndicator size="small" color={colors.purple[600]} />
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: colors.text.tertiary }}>
                    {label || 'Pensando…'}
                </Text>
            </View>
        </View>
    );
}

function ErrorBanner({ error, onDismiss }: { error: AssistantError; onDismiss: () => void }) {
    const colors = useV2Colors();
    const isWarn = error.kind === 'quota_exceeded' || error.kind === 'rate_limited';
    const tone = isWarn ? colors.semantic.warning : colors.semantic.danger;
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: spacing[2],
                marginHorizontal: spacing[4],
                marginBottom: spacing[2],
                backgroundColor: tone.bg,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
            }}
        >
            <AlertCircle size={16} color={tone.fg} strokeWidth={2} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: tone.fg, lineHeight: 17 }}>
                {error.message}
            </Text>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dispensar" hitSlop={8}>
                <X size={16} color={tone.fg} strokeWidth={2} />
            </Pressable>
        </View>
    );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
    const colors = useV2Colors();
    const prompts = ['Quem precisa de atenção?', 'Como está a aderência e o financeiro?', 'Gerar programa para um aluno'];
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[4] }}>
            <LinearGradient
                colors={[colors.purple[500], colors.purple[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
            >
                <Sparkles size={26} color="#FFFFFF" strokeWidth={1.6} />
            </LinearGradient>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text.primary, textAlign: 'center' }}>
                Pergunte ou peça algo
            </Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: colors.text.tertiary, textAlign: 'center' }}>
                O assistente conhece seus alunos, programas e financeiro.
            </Text>
            <View style={{ gap: spacing[2], alignSelf: 'stretch', marginTop: spacing[2] }}>
                {prompts.map((p) => (
                    <Pressable
                        key={p}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onPick(p);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={p}
                        style={{
                            backgroundColor: colors.surface.card,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            borderRadius: 14,
                            paddingVertical: 13,
                            paddingHorizontal: 16,
                        }}
                    >
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13.5, color: colors.text.secondary }}>
                            {p}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}
