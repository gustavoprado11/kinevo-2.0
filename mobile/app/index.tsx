import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

export default function IndexScreen() {
    const { session, isLoading, isEmailVerified } = useAuth();

    // 1. Estado Loading — aguardar sessão do Supabase
    if (isLoading) {
        return (
            <View className="flex-1 justify-center items-center bg-zinc-900">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    // 2. Estado Deslogado — se não há sessão, ir para login
    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }

    // 3. Estado Não Verificado — sessão existe mas e-mail NÃO verificado
    if (!isEmailVerified) {
        return <Redirect href="/(auth)/verify-email" />;
    }

    // 4. Estado Sucesso — sessão existe e e-mail está verificado
    return <Redirect href="/(tabs)/home" />;
}

