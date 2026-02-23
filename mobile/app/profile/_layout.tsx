import { Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";

export default function ProfileLayout() {
    const router = useRouter();

    const goToProfile = () => {
        router.navigate("/(tabs)/profile");
    };

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: "#F2F2F7" },
                headerTintColor: "#0f172a",
                headerTitleStyle: { fontWeight: "600", fontSize: 16, color: "#0f172a" },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: "#F2F2F7" },
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
