import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { translateAuthError } from "../../lib/auth-errors";
import { useResponsive } from "../../hooks/useResponsive";
import { useRotatingIndex } from "../../hooks/useRotatingIndex";
import { useReduceMotion } from "../../components/workout/celebration/_shared/useReduceMotion";
import { AmbientBlob } from "../../components/auth/AmbientBlob";
import { EditorialHeader } from "../../components/auth/EditorialHeader";
import { NeutralButton } from "../../components/auth/NeutralButton";
import { TextField } from "../../components/auth/TextField";
import { RoleChoiceSheet } from "../../components/auth/RoleChoiceSheet";
import { FONT, useAuthTheme } from "../../components/auth/authTheme";
import type { Phrase } from "../../components/auth/RotatingHeadline";

const HEADLINES: Phrase[] = [
    { lead: "Treine onde", accent: "estiver." },
    { lead: "Sua evolução,", accent: "guiada." },
    { lead: "Conectado", accent: "ao seu personal." },
    { lead: "Do programa", accent: "ao pagamento." },
];

const DWELL_MS = 3500;

export default function LoginScreen() {
    const theme = useAuthTheme();
    const reduceMotion = useReduceMotion();
    const { signIn } = useAuth();
    const router = useRouter();
    const { isTablet } = useResponsive();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [showRoleSheet, setShowRoleSheet] = useState(false);

    const passwordRef = useRef<TextInput>(null);

    useEffect(() => {
        const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
        const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
        const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const activeIndex = useRotatingIndex({
        count: HEADLINES.length,
        dwellMs: DWELL_MS,
        paused: keyboardOpen,
        reduceMotion,
    });

    const handleSignIn = async () => {
        if (!email || !password) {
            Alert.alert(
                "Campos incompletos",
                "Por favor, preencha seu e-mail e senha para continuar.",
            );
            return;
        }
        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);
        if (error) {
            Alert.alert("Não foi possível entrar", translateAuthError(error.message));
        } else {
            router.replace("/");
        }
    };

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]}>
            <AmbientBlob theme={theme} position="top-left" />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex}
            >
                <View
                    style={[
                        styles.content,
                        isTablet && styles.contentTablet,
                    ]}
                >
                    <EditorialHeader
                        mode="login"
                        eyebrow="BEM-VINDO DE VOLTA"
                        theme={theme}
                        reduceMotion={reduceMotion}
                        phrases={HEADLINES}
                        activeIndex={activeIndex}
                        dwellMs={DWELL_MS}
                        keyboardOpen={keyboardOpen}
                    />

                    <View style={styles.form}>
                        <TextField
                            icon={Mail}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="E-mail"
                            theme={theme}
                            keyboardType="email-address"
                            autoComplete="email"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordRef.current?.focus()}
                        />

                        <TextField
                            ref={passwordRef}
                            icon={Lock}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Senha"
                            theme={theme}
                            secureTextEntry={!showPassword}
                            autoComplete="password"
                            returnKeyType="done"
                            onSubmitEditing={handleSignIn}
                            rightSlot={
                                <Pressable
                                    onPress={() => setShowPassword((v) => !v)}
                                    hitSlop={12}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        showPassword ? "Ocultar senha" : "Mostrar senha"
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} color={theme.fgTertiary} />
                                    ) : (
                                        <Eye size={18} color={theme.fgTertiary} />
                                    )}
                                </Pressable>
                            }
                        />

                        <Pressable
                            style={styles.forgotWrap}
                            onPress={() => router.push("/(auth)/forgot-password")}
                            accessibilityRole="link"
                            accessibilityLabel="Esqueceu a senha?"
                        >
                            <Text style={[styles.forgot, { color: theme.fgSecondary }]}>
                                Esqueceu a senha?
                            </Text>
                        </Pressable>

                        <View style={styles.ctaWrap}>
                            <NeutralButton
                                label="Entrar"
                                onPress={handleSignIn}
                                theme={theme}
                                loading={loading}
                            />
                        </View>

                        <Pressable
                            style={styles.createWrap}
                            onPress={() => setShowRoleSheet(true)}
                            accessibilityRole="link"
                            accessibilityLabel="Criar conta"
                        >
                            <Text style={[styles.createText, { color: theme.fgSecondary }]}>
                                Não tem conta?{" "}
                                <Text style={{ color: theme.fgPrimary }}>Criar conta</Text>
                            </Text>
                        </Pressable>
                    </View>

                    {!keyboardOpen && (
                        <View style={styles.footer} pointerEvents="none">
                            <Text style={[styles.footerText, { color: theme.fgTertiary }]}>
                                KINEVO · SUA EVOLUÇÃO, GUIADA
                            </Text>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>

            <RoleChoiceSheet
                visible={showRoleSheet}
                onClose={() => setShowRoleSheet(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 24,
    },
    contentTablet: {
        maxWidth: 480,
        alignSelf: "center",
        width: "100%",
        paddingHorizontal: 32,
    },
    form: {
        marginTop: 40,
        gap: 12,
    },
    forgotWrap: {
        alignSelf: "flex-end",
        paddingVertical: 4,
        paddingHorizontal: 2,
    },
    forgot: {
        fontFamily: FONT.medium,
        fontWeight: "500",
        fontSize: 14,
    },
    ctaWrap: {
        marginTop: 12,
    },
    createWrap: {
        alignSelf: "center",
        paddingVertical: 10,
    },
    createText: {
        fontFamily: FONT.medium,
        fontWeight: "500",
        fontSize: 14,
    },
    footer: {
        position: "absolute",
        bottom: 16,
        left: 0,
        right: 0,
        alignItems: "center",
    },
    footerText: {
        fontFamily: FONT.medium,
        fontWeight: "500",
        fontSize: 11,
        letterSpacing: 1,
    },
});
