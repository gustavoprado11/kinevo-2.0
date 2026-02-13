import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { AvatarPicker } from "../../components/profile/AvatarPicker";
import { useRouter } from "expo-router";
import { LogOut, Settings, HelpCircle, Shield, ChevronRight, CreditCard } from "lucide-react-native";

export default function ProfileScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { profile, isUploading, updateAvatar } = useStudentProfile();

    const handleSignOut = async () => {
        Alert.alert(
            "Sair da conta",
            "Deseja realmente sair?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sair",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await signOut();
                            router.replace("/login");
                        } catch (error) {
                            console.error("Error signing out:", error);
                            Alert.alert("Erro", "Não foi possível sair da conta.");
                        }
                    },
                },
            ]
        );
    };

    const displayName = profile?.name ?? user?.email?.split("@")[0] ?? "Atleta";
    const displayEmail = profile?.email ?? user?.email;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D17" }} edges={["top"]}>
            <View style={{ flex: 1, paddingHorizontal: 20 }}>
                {/* Profile Card */}
                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 20,
                        padding: 32,
                        alignItems: "center",
                        marginTop: 24,
                        marginBottom: 28,
                    }}
                >
                    {/* Avatar with upload */}
                    <View style={{ marginBottom: 20 }}>
                        <AvatarPicker
                            avatarUrl={profile?.avatar_url ?? null}
                            isUploading={isUploading}
                            onPick={updateAvatar}
                            size={80}
                        />
                    </View>

                    {/* Name */}
                    <Text
                        style={{
                            fontSize: 20,
                            fontWeight: "700",
                            color: "#f1f5f9",
                            marginBottom: 4,
                        }}
                    >
                        {displayName}
                    </Text>

                    {/* Email */}
                    <Text
                        style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.40)",
                        }}
                    >
                        {displayEmail}
                    </Text>
                </View>

                {/* Menu Section */}
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: "rgba(255,255,255,0.35)",
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        marginBottom: 12,
                        paddingLeft: 4,
                    }}
                >
                    Geral
                </Text>

                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 28,
                    }}
                >
                    <MenuItem
                        icon={<Settings size={20} color="#64748b" strokeWidth={1.5} />}
                        label="Configurações"
                        onPress={() => router.push("/profile/settings")}
                    />
                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 20 }} />
                    <MenuItem
                        icon={<CreditCard size={20} color="#64748b" strokeWidth={1.5} />}
                        label="Minha Assinatura"
                        onPress={() => router.push("/profile/subscription")}
                    />
                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 20 }} />
                    <MenuItem
                        icon={<HelpCircle size={20} color="#64748b" strokeWidth={1.5} />}
                        label="Suporte"
                        onPress={() => router.push("/profile/support")}
                    />
                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 20 }} />
                    <MenuItem
                        icon={<Shield size={20} color="#64748b" strokeWidth={1.5} />}
                        label="Privacidade"
                        onPress={() => router.push("/profile/privacy")}
                    />
                </View>

                {/* Logout */}
                <TouchableOpacity
                    onPress={handleSignOut}
                    activeOpacity={0.7}
                    style={{
                        backgroundColor: "rgba(239,68,68,0.08)",
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                    }}
                >
                    <View
                        style={{
                            height: 40,
                            width: 40,
                            borderRadius: 12,
                            backgroundColor: "rgba(239,68,68,0.1)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <LogOut size={18} color="#f87171" strokeWidth={1.5} />
                    </View>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: "#f87171",
                            flex: 1,
                        }}
                    >
                        Sair da conta
                    </Text>
                    <ChevronRight size={16} color="rgba(248,113,113,0.5)" strokeWidth={1.5} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

/* ─── Menu Item ─── */

function MenuItem({
    icon,
    label,
    onPress,
}: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.6}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                paddingHorizontal: 20,
            }}
        >
            <View
                style={{
                    height: 40,
                    width: 40,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                }}
            >
                {icon}
            </View>
            <Text
                style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#cbd5e1",
                    flex: 1,
                }}
            >
                {label}
            </Text>
            <ChevronRight size={16} color="#475569" strokeWidth={1.5} />
        </TouchableOpacity>
    );
}
