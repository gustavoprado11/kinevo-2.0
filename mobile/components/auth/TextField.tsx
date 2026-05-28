import React, { useState } from "react";
import {
    KeyboardTypeOptions,
    NativeSyntheticEvent,
    ReturnKeyTypeOptions,
    StyleSheet,
    TextInput,
    TextInputSubmitEditingEventData,
    View,
} from "react-native";
import Animated, {
    Easing,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { LucideIcon } from "lucide-react-native";
import { AuthTheme, FONT } from "./authTheme";

interface TextFieldProps {
    icon: LucideIcon;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    theme: AuthTheme;
    keyboardType?: KeyboardTypeOptions;
    autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
    autoCapitalize?: React.ComponentProps<typeof TextInput>["autoCapitalize"];
    secureTextEntry?: boolean;
    returnKeyType?: ReturnKeyTypeOptions;
    onSubmitEditing?: (
        e: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
    ) => void;
    rightSlot?: React.ReactNode;
    accessibilityLabel?: string;
}

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);

export const TextField = React.forwardRef<TextInput, TextFieldProps>(
    function TextField(
        {
            icon: Icon,
            value,
            onChangeText,
            placeholder,
            theme,
            keyboardType,
            autoComplete,
            autoCapitalize = "none",
            secureTextEntry,
            returnKeyType,
            onSubmitEditing,
            rightSlot,
            accessibilityLabel,
        },
        ref,
    ) {
        const [focused, setFocused] = useState(false);
        const focus = useSharedValue(0);

        const containerStyle = useAnimatedStyle(() => ({
            borderColor: interpolateColor(
                focus.value,
                [0, 1],
                [theme.fieldBorder, theme.fieldBorderFocus],
            ),
            backgroundColor: interpolateColor(
                focus.value,
                [0, 1],
                [theme.fieldBg, "rgba(0,0,0,0)"],
            ),
        }));

        const handleFocus = () => {
            setFocused(true);
            focus.value = withTiming(1, { duration: 240, easing: EXPO });
        };
        const handleBlur = () => {
            setFocused(false);
            focus.value = withTiming(0, { duration: 240, easing: EXPO });
        };

        return (
            <Animated.View style={[styles.field, containerStyle]}>
                <Icon size={18} color={focused ? theme.fgPrimary : theme.fgTertiary} />
                <TextInput
                    ref={ref}
                    style={[styles.input, { color: theme.fgPrimary }]}
                    placeholder={placeholder}
                    placeholderTextColor={theme.fgTertiary}
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType={keyboardType}
                    autoComplete={autoComplete}
                    autoCapitalize={autoCapitalize}
                    secureTextEntry={secureTextEntry}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    selectionColor={theme.fgPrimary}
                    accessibilityLabel={accessibilityLabel ?? placeholder}
                />
                {rightSlot}
            </Animated.View>
        );
    },
);

const styles = StyleSheet.create({
    field: {
        flexDirection: "row",
        alignItems: "center",
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 16,
        gap: 10,
    },
    input: {
        flex: 1,
        fontFamily: FONT.medium,
        fontWeight: "500",
        fontSize: 16,
        letterSpacing: -0.16,
        padding: 0,
    },
});
