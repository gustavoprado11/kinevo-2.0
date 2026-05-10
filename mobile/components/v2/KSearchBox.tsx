/**
 * KSearchBox — input de busca com ícone + slot opcional (clear / ⌘K hint).
 *
 * Tokens: shared/tokens/v2.
 */
import React, { useState } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing, radius, shadows } = v2;

export interface KSearchBoxProps {
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    showShortcutHint?: boolean;
    onClear?: () => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

function nativeShadow(token: typeof shadows.xs) {
    return Platform.OS === 'ios' ? token.ios : token.android;
}

export function KSearchBox({
    value,
    onChangeText,
    placeholder = 'Buscar…',
    showShortcutHint = false,
    onClear,
    accessibilityLabel,
    style,
}: KSearchBoxProps) {
    const colors = useV2Colors();
    const [focused, setFocused] = useState(false);

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surface.card,
                    borderColor: focused ? colors.purple[300] : colors.border.default,
                },
                nativeShadow(shadows.xs),
                style,
            ]}
        >
            <Search size={16} color={colors.text.quaternary} strokeWidth={2.2} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.text.quaternary}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={[styles.input, { color: colors.text.primary }]}
                accessibilityLabel={accessibilityLabel ?? placeholder}
                returnKeyType="search"
            />
            {value.length > 0 && onClear ? (
                <Pressable
                    onPress={() => {
                        onChangeText('');
                        onClear();
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar busca"
                    style={styles.trailing}
                >
                    <X size={14} color={colors.text.tertiary} strokeWidth={2.2} />
                </Pressable>
            ) : showShortcutHint ? (
                <View style={[styles.hint, { backgroundColor: colors.neutral[100] }]}>
                    <Text style={[styles.hintText, { color: colors.text.tertiary }]}>⌘K</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        paddingVertical: 11,
        paddingHorizontal: 14,
        gap: spacing[2],
        minHeight: 44,
    },
    input: {
        flex: 1,
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: 14,
        padding: 0,
    },
    trailing: {
        padding: 2,
    },
    hint: {
        borderRadius: radius.sm,
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
    },
    hintText: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 11,
        letterSpacing: 0.4,
    },
});
