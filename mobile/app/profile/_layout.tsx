import { Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useV2Colors } from "../../hooks/useV2Colors";

export default function ProfileLayout() {
    const router = useRouter();
    const colors = useV2Colors();

    const goToProfile = () => {
        router.navigate("/(tabs)/profile");
    };

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface.canvas },
                headerTintColor: colors.text.primary,
                headerTitleStyle: { fontWeight: "600", fontSize: 16, color: colors.text.primary },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.surface.canvas },
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                animation: 'slide_from_right',
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={goToProfile}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginLeft: -8,
                        }}
                    >
                        <ChevronLeft size={24} color="#7c3aed" strokeWidth={2} />
                        <Text
                            style={{
                                fontSize: 15,
                                color: "#7c3aed",
                                fontWeight: "500",
                            }}
                        >
                            Perfil
                        </Text>
                    </TouchableOpacity>
                ),
            }}
        />
    );
}
