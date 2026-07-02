/**
 * AssistantComposer — barra de composição do Assistente.
 *
 * Dois modos:
 *  - "tap to open" (passe `onPress`): a pill vira um botão que abre o chat.
 *    Usado na Home Assistente (Frame 1).
 *  - "input" (passe `value`/`onChangeText`/`onSend`): TextInput controlado com
 *    botão de envio gradiente. Usado na tela de conversa (Frames 2/4).
 *
 * Chips de sugestão opcionais aparecem acima da pill (scroll horizontal).
 * Tokens DS v2 + Plus Jakarta + haptics.
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, ArrowUp, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing } = v2;

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
        },
        ref,
    ) {
    const colors = useV2Colors();
    const inputRef = useRef<TextInput>(null);
    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
    const isInput = !onPress;
    const canSend = isInput && !!value && value.trim().length > 0;

    const handleSend = () => {
        if (!canSend) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSend?.();
    };

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
                                    fontFamily: 'PlusJakartaSans_500Medium',
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
                            fontFamily: 'PlusJakartaSans_500Medium',
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
                                fontFamily: 'PlusJakartaSans_500Medium',
                                fontSize: 14.5,
                                color: colors.text.quaternary,
                            }}
                        >
                            {placeholder}
                        </Text>
                    </Pressable>
                )}

                {canSend || !micAvailable ? null : (
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
                )}

                {sending && onStop ? (
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
                            style={{
                                width: 40,
                                height: 40,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <ArrowUp size={19} color="#FFFFFF" strokeWidth={2.1} />
                        </LinearGradient>
                    </Pressable>
                )}
            </View>
        </View>
    );
    },
);
