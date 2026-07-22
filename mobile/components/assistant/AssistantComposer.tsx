/**
 * AssistantComposer — barra de composição do Assistente (design "Assistente
 * Composer").
 *
 * Três formas:
 *  - "tap to open" (passe `onPress`): a pill vira um botão que abre o chat.
 *    Usado na Home Assistente (Frame 1).
 *  - "input pill" (passe `value`/`onChangeText`/`onSend`): TextInput controlado com
 *    botão de envio gradiente — o lançador da Home (sem seletor de modo).
 *  - "input card" (input pill + `mode`/`onModeChange`): card com textarea + toolbar
 *    (Modo Agir/Planejar/Analisar · ditado · enviar). Usado na tela de conversa,
 *    onde o modo é enviado a cada turno.
 *
 * "Anexar" e o seletor de escopo do design foram adiados no mobile (o escopo já
 * vem por parâmetro da conversa). Chips de sugestão opcionais aparecem acima.
 * Tokens DS v2 + Plus Jakarta + haptics.
 */
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, ArrowUp, Square, Zap, ListChecks, TrendingUp, Check, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing } = v2;

/** Modo do turno (espelha AssistantTurnMode do web). */
export type AssistantTurnMode = 'agir' | 'planejar' | 'analisar';

const MODE_META: Record<
    AssistantTurnMode,
    { label: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; desc: string }
> = {
    agir: { label: 'Agir', icon: Zap, desc: 'Executa ações no Kinevo' },
    planejar: { label: 'Planejar', icon: ListChecks, desc: 'Propõe um plano antes de agir' },
    analisar: { label: 'Analisar', icon: TrendingUp, desc: 'Só lê e responde, não altera nada' },
};
const MODE_ORDER: AssistantTurnMode[] = ['agir', 'planejar', 'analisar'];

export interface AssistantComposerProps {
    placeholder?: string;
    suggestions?: string[];
    onSuggestionPress?: (suggestion: string) => void;
    onPressMic?: () => void;
    /** Ditado ativo: pinta o mic em vermelho (gravando). */
    listening?: boolean;
    /** false = módulo de voz indisponível no binário → esconde o mic (antes ficava
     *  um botão morto silencioso). Default true. */
    micAvailable?: boolean;
    /** Modo "tap to open": a pill inteira é um botão. */
    onPress?: () => void;
    /** Modo "input": TextInput controlado. */
    value?: string;
    onChangeText?: (text: string) => void;
    onSend?: () => void;
    /** Turno em andamento → o botão de enviar vira "parar". */
    sending?: boolean;
    onStop?: () => void;
    /** Modo do turno (Agir/Planejar/Analisar). Presente → mostra o seletor + toolbar. */
    mode?: AssistantTurnMode;
    onModeChange?: (mode: AssistantTurnMode) => void;
}

export interface AssistantComposerHandle {
    focus: () => void;
}

export const AssistantComposer = forwardRef<AssistantComposerHandle, AssistantComposerProps>(
    function AssistantComposer(
        {
            placeholder = 'Pergunte ou peça algo…',
            suggestions,
            onSuggestionPress,
            onPressMic,
            listening,
            micAvailable = true,
            onPress,
            value,
            onChangeText,
            onSend,
            sending,
            onStop,
            mode,
            onModeChange,
        },
        ref,
    ) {
    const colors = useV2Colors();
    const inputRef = useRef<TextInput>(null);
    const [modeSheet, setModeSheet] = useState(false);
    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
    const isInput = !onPress;
    const canSend = isInput && !!value && value.trim().length > 0;
    // Toolbar (com seletor de Modo) só na conversa, onde os turnos são enviados.
    const showToolbar = isInput && !!mode && !!onModeChange;

    const handleSend = () => {
        if (!canSend) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSend?.();
    };

    // ── Botões reutilizados (mic · enviar · parar) ──
    const MicBtn = onPressMic && micAvailable ? (
        <Pressable
            onPress={() => {
                Haptics.selectionAsync();
                onPressMic?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Parar ditado' : 'Ditar'}
            accessibilityState={{ selected: !!listening }}
            hitSlop={6}
            style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: listening ? colors.semantic.danger.bg : 'transparent',
            }}
        >
            <Mic
                size={20}
                color={listening ? colors.semantic.danger.default : colors.text.secondary}
                strokeWidth={1.7}
            />
        </Pressable>
    ) : null;

    const SendOrStop = sending && onStop ? (
        <Pressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onStop();
            }}
            accessibilityRole="button"
            accessibilityLabel="Parar"
            hitSlop={6}
            style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface.card2,
                borderWidth: 1,
                borderColor: colors.border.default,
            }}
        >
            <Square size={14} color={colors.text.secondary} strokeWidth={2.4} fill={colors.text.secondary} />
        </Pressable>
    ) : (
        <Pressable
            onPress={handleSend}
            disabled={isInput && !canSend}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            hitSlop={6}
            style={{ borderRadius: 20, overflow: 'hidden', opacity: isInput && !canSend ? 0.55 : 1 }}
        >
            <LinearGradient
                colors={[colors.purple[500], colors.purple[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
                <ArrowUp size={19} color="#FFFFFF" strokeWidth={2.1} />
            </LinearGradient>
        </Pressable>
    );

    const ModeIcon = mode ? MODE_META[mode].icon : Zap;

    return (
        <View>
            {suggestions && suggestions.length > 0 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[3] }}
                >
                    {suggestions.map((s) => (
                        <Pressable
                            key={s}
                            onPress={() => {
                                Haptics.selectionAsync();
                                onSuggestionPress?.(s);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={s}
                            style={{
                                backgroundColor: colors.surface.card,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                paddingVertical: 8,
                                paddingHorizontal: 13,
                                borderRadius: 18,
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: 'MonaSans_500Medium',
                                    fontSize: 12.5,
                                    color: colors.text.secondary,
                                }}
                            >
                                {s}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            ) : null}

            {showToolbar ? (
                // ── Card com textarea + toolbar (Modo · ditado · enviar) ──
                <View
                    style={{
                        backgroundColor: colors.surface.card,
                        borderWidth: 1,
                        borderColor: colors.purple[200],
                        borderRadius: 24,
                        paddingTop: 14,
                        paddingHorizontal: 14,
                        paddingBottom: 8,
                        shadowColor: colors.purple[600],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 20,
                        elevation: 2,
                    }}
                >
                    <TextInput
                        ref={inputRef}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor={colors.text.quaternary}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                        multiline
                        style={{
                            fontFamily: 'MonaSans_500Medium',
                            fontSize: 15,
                            color: colors.text.primary,
                            maxHeight: 120,
                            paddingHorizontal: 4,
                            paddingTop: 0,
                            paddingBottom: 0,
                            minHeight: 24,
                        }}
                    />

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 10 }}>
                        {/* Seletor de Modo */}
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync();
                                setModeSheet(true);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Modo: ${mode ? MODE_META[mode].label : ''}`}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                height: 34,
                                paddingHorizontal: 11,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                backgroundColor: colors.surface.card2,
                            }}
                        >
                            <ModeIcon size={15} color={colors.purple[600]} strokeWidth={1.8} />
                            <Text
                                style={{
                                    fontFamily: 'MonaSans_600SemiBold',
                                    fontSize: 12.5,
                                    color: colors.text.primary,
                                }}
                            >
                                {mode ? MODE_META[mode].label : ''}
                            </Text>
                            <ChevronDown size={14} color={colors.text.quaternary} strokeWidth={2} />
                        </Pressable>

                        <View style={{ flex: 1 }} />

                        {!sending ? MicBtn : null}
                        {SendOrStop}
                    </View>
                </View>
            ) : (
                // ── Pill (lançador da Home / tap-to-open) ──
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing[2],
                        backgroundColor: colors.surface.card,
                        borderWidth: 1,
                        borderColor: colors.purple[200],
                        borderRadius: 26,
                        paddingVertical: 8,
                        paddingLeft: 18,
                        paddingRight: 8,
                        shadowColor: colors.purple[600],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 20,
                        elevation: 2,
                    }}
                >
                    {isInput ? (
                        <TextInput
                            ref={inputRef}
                            value={value}
                            onChangeText={onChangeText}
                            placeholder={placeholder}
                            placeholderTextColor={colors.text.quaternary}
                            onSubmitEditing={handleSend}
                            returnKeyType="send"
                            multiline
                            style={{
                                flex: 1,
                                fontFamily: 'MonaSans_500Medium',
                                fontSize: 14.5,
                                color: colors.text.primary,
                                maxHeight: 96,
                                paddingTop: 0,
                                paddingBottom: 0,
                            }}
                        />
                    ) : (
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onPress?.();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={placeholder}
                            style={{ flex: 1, paddingVertical: 4 }}
                        >
                            <Text
                                style={{
                                    fontFamily: 'MonaSans_500Medium',
                                    fontSize: 14.5,
                                    color: colors.text.quaternary,
                                }}
                            >
                                {placeholder}
                            </Text>
                        </Pressable>
                    )}

                    {canSend || !micAvailable ? null : MicBtn}
                    {SendOrStop}
                </View>
            )}

            {/* Sheet do seletor de Modo */}
            <Modal visible={modeSheet} transparent animationType="fade" onRequestClose={() => setModeSheet(false)}>
                <Pressable
                    onPress={() => setModeSheet(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: colors.surface.card,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 12,
                            paddingTop: 10,
                            paddingBottom: 32,
                        }}
                    >
                        <View
                            style={{
                                alignSelf: 'center',
                                width: 40,
                                height: 5,
                                borderRadius: 999,
                                backgroundColor: colors.border.default,
                                marginBottom: 12,
                            }}
                        />
                        {MODE_ORDER.map((m) => {
                            const meta = MODE_META[m];
                            const Icon = meta.icon;
                            const active = mode === m;
                            return (
                                <Pressable
                                    key={m}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        onModeChange?.(m);
                                        setModeSheet(false);
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12,
                                        paddingVertical: 12,
                                        paddingHorizontal: 8,
                                        borderRadius: 14,
                                        backgroundColor: active ? colors.surface.card2 : 'transparent',
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 11,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: colors.surface.card2,
                                        }}
                                    >
                                        <Icon size={18} color={colors.purple[600]} strokeWidth={1.8} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 14.5, color: colors.text.primary }}>
                                            {meta.label}
                                        </Text>
                                        <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12.5, color: colors.text.tertiary, marginTop: 1 }}>
                                            {meta.desc}
                                        </Text>
                                    </View>
                                    {active ? <Check size={18} color={colors.purple[600]} strokeWidth={2.4} /> : null}
                                </Pressable>
                            );
                        })}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
    },
);
