import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Keyboard,
    StyleSheet,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, ChevronLeft, CheckCircle2 } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useResponsive } from "../../hooks/useResponsive";

const WEB_URL =
    process.env.EXPO_PUBLIC_WEB_URL ?? "https://www.kinevoapp.com";

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEmailFocused, setIsEmailFocused] = useState(false);

    const router = useRouter();
    const { isTablet } = useResponsive();

    const handleReset = async () => {
        const trimmed = email.trim();
        if (!trimmed) {
            setError("Por favor, digite seu e-mail.");
            return;
        }

        setError(null);
        setLoading(true);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
            trimmed,
            {
                redirectTo: `${WEB_URL}/auth/update-password`,
            }
        );

        setLoading(false);

        if (resetError) {
            // Mantém o pattern do web — não revelamos se o email existe
            // por segurança (email enumeration). Mostramos erro só se
            // for problema de rede/servidor.
            const msg = resetError.message?.toLowerCase() ?? "";
            if (msg.includes("rate") || msg.includes("network") || msg.includes("fetch")) {
                setError("Não foi possível enviar agora. Tente novamente em alguns instantes.");
                return;
            }
            // Erros não-críticos: tratamos como sucesso silencioso
            // (Supabase também faz isso pra emails inexistentes).
        }

        setSuccess(true);
    };

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
            <View style={styles.bgGlowTop} pointerEvents="none" />
            <View style={styles.bgGlowBottom} pointerEvents="none" />

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={[styles.container, isTablet && styles.containerTablet]}
                >
                    {/* Back button */}
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar ao login"
                    >
                        <ChevronLeft size={22} color="#FAFAFA" />
                        <Text style={styles.backText}>Login</Text>
                    </TouchableOpacity>

                    {/* Logo + Hero */}
                    <View style={styles.logoBlock}>
                        <View style={styles.logoTile}>
                            <Image
                                source={require("../../assets/images/logo-icon.jpg")}
                                style={styles.logoImage}
                                resizeMode="cover"
                            />
                        </View>

                        <Text style={styles.heroTitle}>
                            {success ? "Verifique seu e-mail" : "Recuperar senha"}
                        </Text>
                        <Text style={styles.heroSub}>
                            {success
                                ? "Enviamos um link de recuperação."
                                : "Enviaremos um link pra você redefinir sua senha."}
                        </Text>
                    </View>

                    {success ? (
                        /* ─── SUCCESS STATE ─── */
                        <>
                            <View style={styles.successCard}>
                                <View style={styles.successIconCircle}>
                                    <CheckCircle2 size={28} color="#34D399" strokeWidth={2.2} />
                                </View>
                                <Text style={styles.successTitle}>E-mail enviado!</Text>
                                <Text style={styles.successBody}>
                                    Verifique sua caixa de entrada (e a pasta de spam) para encontrar o link de redefinição de senha.
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleBack}
                                style={styles.ctaSecondary}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel="Voltar para o login"
                            >
                                <Text style={styles.ctaSecondaryText}>Voltar para o login</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        /* ─── FORM STATE ─── */
                        <>
                            {error && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            <View style={[styles.field, isEmailFocused && styles.fieldFocused]}>
                                <Mail size={18} color={isEmailFocused ? "#A78BFA" : "#71717A"} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="seu@email.com"
                                    placeholderTextColor="#71717A"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    keyboardType="email-address"
                                    value={email}
                                    onChangeText={setEmail}
                                    onFocus={() => setIsEmailFocused(true)}
                                    onBlur={() => setIsEmailFocused(false)}
                                    editable={!loading}
                                    returnKeyType="send"
                                    onSubmitEditing={handleReset}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleReset}
                                disabled={loading || !email.trim()}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="Enviar link de recuperação"
                            >
                                <LinearGradient
                                    colors={["#7C3AED", "#A78BFA"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[
                                        styles.ctaPrimary,
                                        (loading || !email.trim()) && styles.ctaPrimaryDisabled,
                                    ]}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.ctaPrimaryText}>
                                            Enviar link de recuperação
                                        </Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Footer */}
                    <View style={styles.footer} pointerEvents="none">
                        <Text style={styles.footerText}>Kinevo · Sua evolução, guiada.</Text>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#09090B",
    },
    bgGlowTop: {
        position: "absolute",
        top: -200,
        left: -100,
        right: -100,
        height: 500,
        backgroundColor: "rgba(124,58,237,0.18)",
        borderRadius: 9999,
        opacity: 0.6,
    },
    bgGlowBottom: {
        position: "absolute",
        bottom: -150,
        right: -100,
        width: 360,
        height: 360,
        backgroundColor: "rgba(244,114,182,0.10)",
        borderRadius: 9999,
    },
    container: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    containerTablet: {
        maxWidth: 440,
        alignSelf: "center",
        width: "100%",
    },
    backButton: {
        position: "absolute",
        top: 16,
        left: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingVertical: 8,
        paddingRight: 12,
    },
    backText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FAFAFA",
    },
    logoBlock: {
        alignItems: "center",
        marginBottom: 32,
    },
    logoTile: {
        width: 76,
        height: 76,
        borderRadius: 20,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#3F1B91",
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 20,
        marginBottom: 24,
    },
    logoImage: {
        width: "100%",
        height: "100%",
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: "900",
        color: "#FAFAFA",
        textAlign: "center",
        letterSpacing: -0.78,
        lineHeight: 28.6,
        marginBottom: 6,
    },
    heroSub: {
        fontSize: 14,
        fontWeight: "500",
        color: "#A1A1AA",
        textAlign: "center",
        paddingHorizontal: 8,
        lineHeight: 20,
    },
    errorBox: {
        backgroundColor: "rgba(239,68,68,0.12)",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.3)",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
    },
    errorText: {
        fontSize: 13,
        fontWeight: "500",
        color: "#FCA5A5",
        lineHeight: 18,
    },
    field: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    fieldFocused: {
        borderColor: "rgba(124,58,237,0.4)",
        backgroundColor: "rgba(124,58,237,0.05)",
    },
    input: {
        flex: 1,
        fontSize: 14,
        fontWeight: "500",
        color: "#FAFAFA",
        padding: 0,
    },
    ctaPrimary: {
        marginTop: 20,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 32,
        elevation: 12,
    },
    ctaPrimaryDisabled: {
        opacity: 0.55,
    },
    ctaPrimaryText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
        letterSpacing: 0.15,
    },
    ctaSecondary: {
        marginTop: 20,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    ctaSecondaryText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FAFAFA",
    },
    // Success state
    successCard: {
        backgroundColor: "rgba(52,211,153,0.08)",
        borderWidth: 1,
        borderColor: "rgba(52,211,153,0.25)",
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
    },
    successIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(52,211,153,0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    successTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#FAFAFA",
        marginBottom: 6,
    },
    successBody: {
        fontSize: 13,
        fontWeight: "400",
        color: "#A1A1AA",
        textAlign: "center",
        lineHeight: 19,
        paddingHorizontal: 8,
    },
    footer: {
        position: "absolute",
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: "center",
    },
    footerText: {
        fontSize: 12,
        fontWeight: "500",
        color: "#52525B",
    },
});
