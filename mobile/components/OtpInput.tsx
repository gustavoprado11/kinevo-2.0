import React, { useRef, useState, useEffect } from "react";
import { View, TextInput, Pressable } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OtpInputProps {
    length?: number;
    value: string;
    onChangeText: (value: string) => void;
    onComplete?: (code: string) => void;
    disabled?: boolean;
    error?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function OtpInput({
    length = 6,
    value,
    onChangeText,
    onComplete,
    disabled = false,
    error = false,
}: OtpInputProps) {
    const inputRefs = useRef<(TextInput | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    // Converte a string do value em array de dígitos
    const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

    // Auto-focus no primeiro input ao montar
    useEffect(() => {
        const timer = setTimeout(() => {
            inputRefs.current[0]?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Dispara onComplete quando todos os dígitos estão preenchidos
    useEffect(() => {
        if (value.length === length && onComplete) {
            onComplete(value);
        }
    }, [value, length, onComplete]);

    const handleChangeText = (text: string, index: number) => {
        // Suporte a paste: se colar código inteiro
        if (text.length > 1) {
            const cleaned = text.replace(/[^0-9]/g, "").slice(0, length);
            onChangeText(cleaned);
            if (cleaned.length === length) {
                inputRefs.current[length - 1]?.blur();
            } else {
                inputRefs.current[cleaned.length]?.focus();
            }
            return;
        }

        // Input de um único dígito
        const cleaned = text.replace(/[^0-9]/g, "");
        const newDigits = [...digits];
        newDigits[index] = cleaned;
        const newValue = newDigits.join("").replace(/\s/g, "");
        onChangeText(newValue);

        // Auto-focus no próximo
        if (cleaned && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        // Backspace: limpa o atual e volta para o anterior
        if (e.nativeEvent.key === "Backspace") {
            if (!digits[index] && index > 0) {
                const newDigits = [...digits];
                newDigits[index - 1] = "";
                onChangeText(newDigits.join("").trimEnd());
                inputRefs.current[index - 1]?.focus();
            }
        }
    };

    const handlePress = (index: number) => {
        // Ao tocar num input, foca no primeiro vazio ou no último preenchido
        const firstEmpty = digits.findIndex((d) => !d);
        const targetIndex = firstEmpty === -1 ? length - 1 : firstEmpty;
        inputRefs.current[targetIndex]?.focus();
    };

    const getBorderColor = (index: number): string => {
        if (error) return "border-red-500";
        if (focusedIndex === index) return "border-purple-500";
        if (digits[index]) return "border-gray-600";
        return "border-gray-700";
    };

    return (
        <View className="flex-row justify-center gap-3">
            {Array.from({ length }).map((_, index) => (
                <Pressable key={index} onPress={() => handlePress(index)}>
                    <TextInput
                        ref={(ref) => { inputRefs.current[index] = ref; }}
                        className={`w-12 h-14 bg-gray-900 rounded-xl border-2 ${getBorderColor(index)} text-white text-2xl font-bold text-center`}
                        keyboardType="number-pad"
                        maxLength={1}
                        value={digits[index] || ""}
                        onChangeText={(text) => handleChangeText(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(null)}
                        editable={!disabled}
                        selectTextOnFocus
                        caretHidden
                    />
                </Pressable>
            ))}
        </View>
    );
}
