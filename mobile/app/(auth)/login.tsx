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
    StyleSheet,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { translateAuthError } from "../../lib/auth-errors";
import { useResponsive } from "../../hooks/useResponsive";
import { WelcomeRoleSheet } from "../../components/auth/WelcomeRoleSheet";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showWelcomeSheet, setShowWelcomeSheet] = useState(false);

    // UI States for Focus interaction
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const { signIn } = useAuth();
    const router = useRouter();
    const { isTablet } = useResponsive();

    const handleSignIn = async () => {
        if (!email || !password) {
            Alert.alert("Campos incompletos", "Por favor, preencha seu e-mail e senha para continuar.");
            return;
        }

        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);

        if (error) {
            Alert.alert("Não foi possível entrar", translateAuthError(error.message));
        } else {
            // Delega ao index.tsx (The Gate) a decisão: home ou verificação de e-mail
            router.replace("/");
        }
    };

    const handleCreateAccount = () => {
        setShowWelcomeSheet(true);
    };

    return (
        <SafeAreaView style={styles.safe}>
            {/* Background glow blobs */}
            <View style={styles.bgGlowTop} pointerEvents="none" />
            <View style={styles.bgGlowBottom} pointerEvents="none" />

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={[styles.container, isTablet && styles.containerTablet]}
                >
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
                            Treine com seu personal,{"\n"}do seu jeito.
                        </Text>
                        <Text style={styles.heroSub}>
                            Acompanhe sua evolução. Em qualquer lugar.
                        </Text>
                    </View>

                    {/* Email input */}
                    <View style={[styles.field, isEmailFocused && styles.fieldFocused]}>
                        <Mail size={18} color={isEmailFocused ? "#A78BFA" : "#71717A"} />
                        <TextInput
                            style={styles.input}
                            placeholder="E-mail"
                            placeholderTextColor="#71717A"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                            onFocus={() => setIsEmailFocused(true)}
                            onBlur={() => setIsEmailFocused(false)}
                        />
                    </View>

                    {/* Password input */}
                    <View style={[styles.field, isPasswordFocused && styles.fieldFocused, { marginTop: 12 }]}>
                        <Lock size={18} color={isPasswordFocused ? "#A78BFA" : "#71717A"} />
                        <TextInput
                            style={styles.input}
                            placeholder="Senha"
                            placeholderTextColor="#71717A"
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                            onFocus={() => setIsPasswordFocused(true)}
                            onBlur={() => setIsPasswordFocused(false)}
                        />
                        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                            {showPassword ? (
                                <EyeOff size={18} color="#71717A" />
                            ) : (
                                <Eye size={18} color="#71717A" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Esqueceu a senha */}
                    <TouchableOpacity
                        style={styles.forgotWrap}
                        onPress={() => router.push("/(auth)/forgot-password")}
                        accessibilityRole="button"
                        accessibilityLabel="Esqueceu a senha"
                    >
                        <Text style={styles.forgot}>Esqueceu a senha?</Text>
                    </TouchableOpacity>

                    {/* CTA Entrar */}
                    <TouchableOpacity onPress={handleSignIn} disabled={loading} activeOpacity={0.85}>
                        <LinearGradient
                            colors={["#7C3AED", "#A78BFA"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.ctaPrimary, loading && styles.ctaPrimaryLoading]}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.ctaPrimaryText}>Entrar</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Divider OU */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OU</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* CTA Cadastre-se */}
                    <TouchableOpacity onPress={handleCreateAccount} style={styles.ctaSecondary} activeOpacity={0.8}>
                        <Text style={styles.ctaSecondaryText}>Cadastre-se</Text>
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={styles.footer} pointerEvents="none">
                        <Text style={styles.footerText}>Kinevo · Sua evolução, guiada.</Text>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>

            <WelcomeRoleSheet
                visible={showWelcomeSheet}
                onClose={() => setShowWelcomeSheet(false)}
            />
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
    forgotWrap: {
        alignSelf: "flex-end",
        paddingTop: 8,
        paddingHorizontal: 4,
    },
    forgot: {
        fontSize: 12,
        fontWeight: "600",
        color: "#C4B5FD",
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
    ctaPrimaryLoading: {
        opacity: 0.85,
    },
    ctaPrimaryText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
        letterSpacing: 0.15,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginVertical: 16,
        paddingHorizontal: 4,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    dividerText: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 2,
        color: "#71717A",
    },
    ctaSecondary: {
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
