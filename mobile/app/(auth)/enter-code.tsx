import { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Feather } from "@expo/vector-icons";
import OtpInput from "../../components/OtpInput";

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function EnterCodeScreen() {
    const router = useRouter();
    const { email, otpType } = useLocalSearchParams<{
        email: string;
        otpType: "email" | "email_change";
    }>();

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);

    // ── Timer de cooldown ───────────────────────────────────────────────────
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    // ── Verificar código OTP ────────────────────────────────────────────────
    const handleVerify = useCallback(
        async (otp?: string) => {
            const token = otp || code;
            if (token.length !== 6) return;

            setLoading(true);
            setError(null);

            const { error: verifyError } = await supabase.auth.verifyOtp({
                email: email!,
                token,
                type: otpType || "email",
            });

            setLoading(false);

            if (verifyError) {
                console.error("[EnterCode] Erro ao verificar OTP:", verifyError.message);
                setError("Código inválido ou expirado. Tente novamente.");
                setCode("");
                return;
            }

            console.log("[EnterCode] E-mail verificado com sucesso!");
            router.replace("/");
        },
        [code, email, otpType, router]
    );

    // ── Reenviar código ─────────────────────────────────────────────────────
    const handleResend = async () => {
        if (cooldown > 0) return;

        const { error: resendError } = await supabase.auth.resend({
            type: otpType === "email_change" ? "email_change" : "signup",
            email: email!,
        });

        if (resendError) {
            console.error("[EnterCode] Erro ao reenviar:", resendError.message);
            Alert.alert("Erro", "Não foi possível reenviar o código.");
            return;
        }

        setCooldown(60);
        setError(null);
        setCode("");
        Alert.alert("Código reenviado", "Verifique sua caixa de entrada.");
    };

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <SafeAreaView className="flex-1 bg-gray-950">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 justify-center px-8"
                >
                    {/* Header */}
                    <View className="items-center mb-10">
                        <View className="w-20 h-20 bg-gray-900 rounded-full items-center justify-center mb-6">
                            <Feather name="shield" size={40} color="#a855f7" />
                        </View>
                        <Text className="text-3xl font-bold text-white tracking-tight mb-2">
                            Digite o código
                        </Text>
                        <Text className="text-gray-400 text-base text-center leading-6">
                            Enviamos um código de 6 dígitos para{"\n"}
                            <Text className="text-white font-medium">{email}</Text>
                        </Text>
                    </View>

                    {/* OTP Input */}
                    <View className="mb-4">
                        <OtpInput
                            value={code}
                            onChangeText={setCode}
                            onComplete={handleVerify}
                            disabled={loading}
                            error={!!error}
                        />
                    </View>

                    {/* Mensagem de erro */}
                    {error && (
                        <Text className="text-red-400 text-sm text-center mb-4">
                            {error}
                        </Text>
                    )}

                    {/* Botão Verificar */}
                    <TouchableOpacity
                        className={`bg-purple-600 rounded-xl py-4 items-center mt-6 ${loading || code.length < 6 ? "opacity-50" : ""
                            }`}
                        onPress={() => handleVerify()}
                        disabled={loading || code.length < 6}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-base">
                                Verificar
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Reenviar código */}
                    <TouchableOpacity
                        className="mt-6 py-3 items-center"
                        onPress={handleResend}
                        disabled={cooldown > 0}
                    >
                        <Text
                            className={`font-medium text-sm ${cooldown > 0 ? "text-gray-600" : "text-purple-400"
                                }`}
                        >
                            {cooldown > 0
                                ? `Reenviar código (${cooldown}s)`
                                : "Reenviar código"}
                        </Text>
                    </TouchableOpacity>

                    {/* Voltar */}
                    <TouchableOpacity
                        className="mt-2 py-3 items-center flex-row justify-center"
                        onPress={() => router.back()}
                        disabled={loading}
                    >
                        <Feather name="arrow-left" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
                        <Text className="text-gray-400 font-medium text-sm">
                            Voltar
                        </Text>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}
