import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Feather } from "@expo/vector-icons";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}${local[1]}${"*".repeat(Math.min(local.length - 2, 5))}@${domain}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function VerifyEmailScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const currentEmail = user?.email ?? "";

    const [mode, setMode] = useState<"confirm" | "change">("confirm");
    const [newEmail, setNewEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [isNewEmailFocused, setIsNewEmailFocused] = useState(false);

    // ── Enviar OTP para o e-mail atual ──────────────────────────────────────
    const handleSendOtp = async () => {
        setLoading(true);
        const { error } = await supabase.auth.resend({
            type: "signup",
            email: currentEmail,
        });
        setLoading(false);

        if (error) {
            console.error("[VerifyEmail] Erro ao enviar OTP:", error.message);
            Alert.alert("Erro", "Não foi possível enviar o código. Tente novamente.");
            return;
        }

        router.push({
            pathname: "/(auth)/enter-code",
            params: { email: currentEmail, otpType: "email" },
        });
    };

    // ── Trocar e-mail e enviar OTP ──────────────────────────────────────────
    const handleChangeEmail = async () => {
        const trimmed = newEmail.trim().toLowerCase();

        if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
            Alert.alert("E-mail inválido", "Por favor, insira um e-mail válido.");
            return;
        }

        setLoading(true);

        // 1. Atualizar e-mail no Supabase Auth (envia OTP automaticamente)
        const { error: authError } = await supabase.auth.updateUser({
            email: trimmed,
        });

        if (authError) {
            setLoading(false);
            console.error("[VerifyEmail] Erro ao atualizar e-mail Auth:", authError.message);
            Alert.alert("Erro", authError.message);
            return;
        }

        // 2. Atualizar e-mail na tabela students (manter consistência)
        const { error: dbError } = await supabase
            .from("students")
            .update({ email: trimmed })
            .eq("user_id", user!.id);

        if (dbError) {
            console.error("[VerifyEmail] Erro ao atualizar students:", dbError.message);
            // Não bloqueia o fluxo - auth email é a fonte de verdade
        }

        setLoading(false);

        router.push({
            pathname: "/(auth)/enter-code",
            params: { email: trimmed, otpType: "email_change" },
        });
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
                            <Feather name="mail" size={40} color="#a855f7" />
                        </View>
                        <Text className="text-3xl font-bold text-white tracking-tight mb-2">
                            Verifique seu e-mail
                        </Text>
                        <Text className="text-gray-400 text-base text-center leading-6">
                            Para sua segurança, precisamos confirmar{"\n"}que você tem acesso ao seu e-mail.
                        </Text>
                    </View>

                    {mode === "confirm" ? (
                        /* ── Modo Confirmar ────────────────────────────── */
                        <View>
                            {/* Card com e-mail mascarado */}
                            <View className="bg-gray-900 rounded-2xl p-5 mb-8 border border-gray-800">
                                <Text className="text-gray-400 text-sm mb-2">
                                    Este é o seu e-mail?
                                </Text>
                                <Text className="text-white text-lg font-semibold">
                                    {maskEmail(currentEmail)}
                                </Text>
                            </View>

                            {/* Botão: Sim, enviar código */}
                            <TouchableOpacity
                                className={`bg-purple-600 rounded-xl py-4 items-center mb-4 ${loading ? "opacity-70" : ""}`}
                                onPress={handleSendOtp}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <View className="flex-row items-center">
                                        <Feather name="send" size={18} color="white" style={{ marginRight: 8 }} />
                                        <Text className="text-white font-bold text-base">
                                            Sim, enviar código
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Botão: Trocar e-mail */}
                            <TouchableOpacity
                                className="py-4 items-center"
                                onPress={() => setMode("change")}
                                disabled={loading}
                            >
                                <Text className="text-purple-400 font-medium text-sm">
                                    Não, quero trocar o e-mail
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* ── Modo Trocar E-mail ────────────────────────── */
                        <View>
                            <Text className="text-gray-400 text-sm mb-3">
                                Digite seu novo e-mail:
                            </Text>

                            {/* Input novo e-mail */}
                            <View
                                className={`flex-row items-center bg-gray-900 rounded-xl border ${
                                    isNewEmailFocused ? "border-purple-500" : "border-transparent"
                                } px-4 py-1 mb-6`}
                            >
                                <Feather
                                    name="mail"
                                    size={20}
                                    color={isNewEmailFocused ? "#a855f7" : "#9ca3af"}
                                    style={{ marginRight: 12 }}
                                />
                                <TextInput
                                    className="flex-1 text-white text-base py-4 font-medium"
                                    placeholder="novo@email.com"
                                    placeholderTextColor="#6b7280"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    value={newEmail}
                                    onChangeText={setNewEmail}
                                    onFocus={() => setIsNewEmailFocused(true)}
                                    onBlur={() => setIsNewEmailFocused(false)}
                                    editable={!loading}
                                />
                            </View>

                            {/* Botão: Atualizar e enviar */}
                            <TouchableOpacity
                                className={`bg-purple-600 rounded-xl py-4 items-center mb-4 ${loading ? "opacity-70" : ""}`}
                                onPress={handleChangeEmail}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-base">
                                        Atualizar e enviar código
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {/* Botão: Voltar */}
                            <TouchableOpacity
                                className="py-4 items-center flex-row justify-center"
                                onPress={() => {
                                    setMode("confirm");
                                    setNewEmail("");
                                }}
                                disabled={loading}
                            >
                                <Feather name="arrow-left" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
                                <Text className="text-gray-400 font-medium text-sm">
                                    Voltar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}
