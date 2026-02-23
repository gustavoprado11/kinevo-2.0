import React from "react";
import { View, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { User, Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

interface AvatarPickerProps {
    avatarUrl: string | null;
    isUploading: boolean;
    onPick: (uri: string) => Promise<void>;
    size?: number;
}

export function AvatarPicker({ avatarUrl, isUploading, onPick, size = 80 }: AvatarPickerProps) {
    const borderRadius = size / 2;
    const badgeSize = 28;

    const handlePress = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== "granted") {
            Alert.alert(
                "Permissão necessária",
                "Precisamos de acesso à sua galeria para alterar a foto de perfil."
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            try {
                await onPick(result.assets[0].uri);
            } catch {
                Alert.alert("Erro", "Não foi possível atualizar a foto. Tente novamente.");
            }
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            disabled={isUploading}
            style={{ alignItems: "center" }}
        >
            <View style={{ width: size, height: size, borderRadius, position: "relative" }}>
                {/* Avatar or fallback */}
                {avatarUrl ? (
                    <Image
                        source={{ uri: avatarUrl }}
                        style={{
                            width: size,
                            height: size,
                            borderRadius,
                        }}
                    />
                ) : (
                    <View
                        style={{
                            width: size,
                            height: size,
                            borderRadius,
                            backgroundColor: "#f1f5f9",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <User size={size * 0.45} color="#94a3b8" strokeWidth={1.5} />
                    </View>
                )}

                {/* Upload spinner overlay */}
                {isUploading && (
                    <View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: size,
                            height: size,
                            borderRadius,
                            backgroundColor: "rgba(0,0,0,0.5)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ActivityIndicator color="#fff" />
                    </View>
                )}

                {/* Camera badge */}
                {!isUploading && (
                    <View
                        style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: badgeSize,
                            height: badgeSize,
                            borderRadius: badgeSize / 2,
                            backgroundColor: "#7c3aed",
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 4,
                            borderColor: "#ffffff",
                            shadowColor: '#7c3aed',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 4,
                        }}
                    >
                        <Camera size={14} color="#fff" strokeWidth={2} />
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
