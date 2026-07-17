/**
 * app/assistant — tela de conversa do Assistente do treinador.
 *
 * Ligada ao backend real via useAssistantChat (endpoints Bearer
 * /api/trainer/assistant/*). O turno chega em STREAMING NDJSON: rótulo de
 * progresso ("Pensando…"/tool em execução), tokens da resposta ao vivo
 * (streamingText — U-STREAM) e o payload final com os parts (ações, perguntas
 * clicáveis, confirmações/propostas HITL acionáveis). Parar aborta o turno de
 * verdade no servidor.
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
import { AssistantComposer, type AssistantComposerHandle } from '../components/assistant/AssistantComposer';
import { AssistantParts } from '../components/assistant/AssistantParts';
import { AssistantConversationsSheet } from '../components/assistant/AssistantConversationsSheet';
import { CreditMeter } from '../components/assistant/CreditMeter';
import { CHAT_STARTERS } from '../lib/assistantPrompts';

const { spacing } = v2;

export default function AssistantChatScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // q = prompt inicial · send=1 = envia o q na chegada (composer real do
    // dashboard) · c = conversa a reabrir · studentId/studentName = escopo por
    // aluno (Onda 3): a conversa nasce ligada ao aluno.
    const params = useLocalSearchParams<{ q?: string; send?: string; c?: string; studentId?: string; studentName?: string }>();
    const q = typeof params.q === 'string' ? params.q : undefined;
    const autoSend = params.send === '1';
    const conversationParam = typeof params.c === 'string' ? params.c : undefined;
    const scopedStudentId = typeof params.studentId === 'string' ? params.studentId : undefined;
    const scopedStudentName = typeof params.studentName === 'string' ? params.studentName : undefined;

    const { messages, isSending, progress, streamingText, error, summary, send, stop, confirmAction, cancelAction, loadConversation, reset, clearError } =
        useAssistantChat({ studentId: scopedStudentId });
    const [input, setInput] = useState('');
    const [showConversations, setShowConversations] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const voice = useVoiceInput((t) => setInput(t));
    const scrollRef = useRef<ScrollView>(null);
    const composerRef = useRef<AssistantComposerHandle>(null);
    const didInit = useRef(false);

    // Preenche o composer com um prompt (sem enviar) e foca, pro usuário editar.
    const fillInput = (text: string) => {
        setInput(text);
        requestAnimationFrame(() => composerRef.current?.focus());
    };

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

    // Init: reabre uma conversa (param c) OU trata o prompt inicial (param q):
    //   - send=1 → ENVIA direto (o treinador já digitou e apertou enviar no
    //     composer do dashboard; pedir um segundo envio quebraria a promessa);
    //   - sem o flag → só pré-preenche pro usuário revisar/editar (chips).
    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;
        if (conversationParam) void loadConversation(conversationParam);
        if (q && q.trim()) {
            if (autoSend) {
                void send(q.trim());
                scrollToEnd();
            } else {
                fillInput(q.trim());
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-scroll: segue mensagens novas e o texto em streaming — mas NÃO rola
    // quando o conteúdo muda por digitação num card editável (antes o
    // onContentSizeChange puxava o scroll e tirava o campo de foco da vista).
    useEffect(() => {
        scrollToEnd();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length, isSending, streamingText, progress]);

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
                    <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 16, color: colors.text.primary }}>
                        Assistente
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11, color: colors.text.tertiary }}>
                        {scopedStudentName ? `Sobre ${scopedStudentName}` : 'Contexto dos seus alunos'}
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
                    <EmptyState onPick={(s) => fillInput(s)} />
                ) : (
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: spacing[4], gap: spacing[5] }}
                        showsVerticalScrollIndicator={false}
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
                                        onOpenStudent={(studentId) =>
                                            router.push({ pathname: '/student/[id]', params: { id: studentId } } as never)
                                        }
                                        onOpenMessages={(studentId) =>
                                            router.push({ pathname: '/messages/[studentId]', params: { studentId } } as never)
                                        }
                                        disabled={isSending}
                                    />
                                ) : null}
                            </AssistantMessageBubble>
                        ))}
                        {/* U-STREAM: resposta ao vivo token a token; o `done` a substitui pela persistida. */}
                        {isSending && streamingText ? (
                            <AssistantMessageBubble role="assistant" text={streamingText} />
                        ) : null}
                        {isSending && !streamingText ? <ThinkingRow label={progress} /> : null}
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
                        ref={composerRef}
                        placeholder={scopedStudentName ? `O que fazer com ${scopedStudentName.split(' ')[0]}?` : 'Responder…'}
                        value={input}
                        onChangeText={setInput}
                        onSend={() => submit()}
                        onPressMic={voice.toggle}
                        listening={voice.isListening}
                        micAvailable={voice.available}
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
                <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 13, color: colors.text.tertiary }}>
                    {label || 'Pensando…'}
                </Text>
            </View>
        </View>
    );
}

function ErrorBanner({ error, onDismiss }: { error: AssistantError; onDismiss: () => void }) {
    const colors = useV2Colors();
    // Paredes de upsell do free (cota/teste/tier) + rate-limit = tom de aviso, não erro.
    const isWarn =
        error.kind === 'quota_exceeded' ||
        error.kind === 'free_trial_used' ||
        error.kind === 'tier_locked' ||
        error.kind === 'rate_limited';
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
            <Text style={{ flex: 1, fontFamily: 'MonaSans_500Medium', fontSize: 12.5, color: tone.fg, lineHeight: 17 }}>
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
            <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 18, color: colors.text.primary, textAlign: 'center' }}>
                Pergunte ou peça algo
            </Text>
            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 13, color: colors.text.tertiary, textAlign: 'center' }}>
                O assistente conhece seus alunos, programas e financeiro.
            </Text>
            <View style={{ gap: spacing[2], alignSelf: 'stretch', marginTop: spacing[2] }}>
                {CHAT_STARTERS.map((s) => (
                    <Pressable
                        key={s.label}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onPick(s.prompt);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={s.label}
                        style={{
                            backgroundColor: colors.surface.card,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            borderRadius: 14,
                            paddingVertical: 13,
                            paddingHorizontal: 16,
                        }}
                    >
                        <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 13.5, color: colors.text.secondary }}>
                            {s.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}
