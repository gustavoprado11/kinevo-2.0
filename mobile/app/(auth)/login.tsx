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
    Image,
    TouchableWithoutFeedback,
    Keyboard
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { MaterialIcons, Feather } from "@expo/vector-icons";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // UI States for Focus interaction
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const { signIn } = useAuth();
    const router = useRouter();

    const handleSignIn = async () => {
        if (!email || !password) {
            Alert.alert("Campos incompletos", "Por favor, preencha seu e-mail e senha para continuar.");
            return;
        }

        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);

        if (error) {
            Alert.alert("Não foi possível entrar", error.message);
        } else {
            // Delega ao index.tsx (The Gate) a decisão: home ou verificação de e-mail
            router.replace("/");
        }
    };

    const handleCreateAccount = () => {
        Alert.alert(
            "Como acessar?",
            "O Kinevo é uma plataforma exclusiva para alunos de treinadores parceiros. Se você contratou um plano, verifique seu e-mail em busca do convite de acesso ou fale com seu treinador."
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-950">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 justify-center px-8"
                >
                    {/* 1. TOPO (Header) */}
                    <View className="items-center mb-12">
                        <View className="shadow-lg shadow-purple-900/20">
                            {/* Placeholder para logo - usando bg-gray-800 caso imagem falhe, mas tentando carregar */}
                            <Image
                                source={require('../../assets/images/logo-icon.jpg')}
                                style={{ width: 80, height: 80, borderRadius: 20 }}
                                className="mb-6 rounded-2xl"
                                resizeMode="contain"
                            />
                        </View>

                        <Text className="text-3xl font-bold text-white tracking-tight mb-2">
                            Bem-vindo ao Kinevo
                        </Text>
                        <Text className="text-gray-400 text-base font-medium tracking-wide">
                            Sua evolução, guiada.
                        </Text>
                    </View>

                    {/* 2. MEIO (Formulário) */}
                    <View className="space-y-5 gap-5">
                        {/* Input E-mail */}
                        <View>
                            <View
                                className={`flex-row items-center bg-gray-900 rounded-xl border ${isEmailFocused ? "border-purple-500" : "border-transparent"
                                    } px-4 py-1 transition-all duration-200`}
                            >
                                <Feather
                                    name="mail"
                                    size={20}
                                    color={isEmailFocused ? "#a855f7" : "#9ca3af"}
                                    style={{ marginRight: 12 }}
                                />
                                <TextInput
                                    className="flex-1 text-white text-base py-4 font-medium"
                                    placeholder="E-mail"
                                    placeholderTextColor="#6b7280"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    value={email}
                                    onChangeText={setEmail}
                                    onFocus={() => setIsEmailFocused(true)}
                                    onBlur={() => setIsEmailFocused(false)}
                                />
                            </View>
                        </View>

                        {/* Input Senha */}
                        <View>
                            <View
                                className={`flex-row items-center bg-gray-900 rounded-xl border ${isPasswordFocused ? "border-purple-500" : "border-transparent"
                                    } px-4 py-1 transition-all duration-200`}
                            >
                                <Feather
                                    name="lock"
                                    size={20}
                                    color={isPasswordFocused ? "#a855f7" : "#9ca3af"}
                                    style={{ marginRight: 12 }}
                                />
                                <TextInput
                                    className="flex-1 text-white text-base py-4 font-medium"
                                    placeholder="Senha"
                                    placeholderTextColor="#6b7280"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setIsPasswordFocused(true)}
                                    onBlur={() => setIsPasswordFocused(false)}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    className="p-2"
                                >
                                    <Feather
                                        name={showPassword ? "eye" : "eye-off"}
                                        size={20}
                                        color="#6b7280"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Botão Esqueci a senha (Opcional, apenas visual por enquanto) */}
                        <TouchableOpacity className="items-end">
                            <Text className="text-purple-400 text-sm font-medium">
                                Esqueceu a senha?
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* 3. RODAPÉ (Ações) */}
                    <View className="mt-10">
                        <TouchableOpacity
                            className={`bg-purple-600 rounded-xl py-4 items-center shadow-lg shadow-purple-900/30 ${loading ? "opacity-70" : "active:bg-purple-700"
                                }`}
                            onPress={handleSignIn}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg tracking-wide">
                                    Entrar
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleCreateAccount}
                            className="mt-6 py-4 items-center flex-row justify-center"
                        >
                            <Text className="text-gray-400 text-sm mr-1">
                                Ainda não tem acesso?
                            </Text>
                            <Text className="text-purple-400 font-bold text-sm">
                                Saiba como funciona.
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer Pequeno */}
                    <View className="absolute bottom-10 left-0 right-0 items-center opacity-30">
                        {/* Espaço reservado se precisar de algo fixo no rodapé */}
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}
