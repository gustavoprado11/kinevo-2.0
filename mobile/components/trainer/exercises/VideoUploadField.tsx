import React from "react";
import { View, Text, TouchableOpacity, ActionSheetIOS, Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Video, Film, Trash2 } from "lucide-react-native";

interface VideoFile {
    uri: string;
    name: string;
    type: string;
}

interface Props {
    videoFile: VideoFile | null;
    currentVideoUrl: string | null;
    onSelectVideo: (file: VideoFile | null) => void;
    onRemoveCurrentVideo: () => void;
}

async function pickVideo(source: "library" | "camera"): Promise<VideoFile | null> {
    const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["videos"],
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 120,
    };

    const result =
        source === "camera"
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    const fileName = asset.fileName || `video-${Date.now()}.mp4`;
    const mimeType = asset.mimeType || "video/mp4";

    return { uri: asset.uri, name: fileName, type: mimeType };
}

export function VideoUploadField({ videoFile, currentVideoUrl, onSelectVideo, onRemoveCurrentVideo }: Props) {
    const handleSelect = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ["Cancelar", "Gravar vídeo", "Escolher da galeria"],
                    cancelButtonIndex: 0,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 1) {
                        const file = await pickVideo("camera");
                        if (file) onSelectVideo(file);
                    } else if (buttonIndex === 2) {
                        const file = await pickVideo("library");
                        if (file) onSelectVideo(file);
                    }
                }
            );
        } else {
            Alert.alert("Selecionar vídeo", "", [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Gravar vídeo",
                    onPress: async () => {
                        const file = await pickVideo("camera");
                        if (file) onSelectVideo(file);
                    },
                },
                {
                    text: "Escolher da galeria",
                    onPress: async () => {
                        const file = await pickVideo("library");
                        if (file) onSelectVideo(file);
                    },
                },
            ]);
        }
    };

    const hasVideo = videoFile || currentVideoUrl;

    return (
        <View>
            {hasVideo ? (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#f5f3ff",
                        borderRadius: 12,
                        padding: 14,
                        gap: 12,
                    }}
                >
                    <Film size={20} color="#7c3aed" />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "500", color: "#7c3aed" }} numberOfLines={1}>
                        {videoFile ? videoFile.name : "Vídeo atual"}
                    </Text>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onSelectVideo(null);
                            onRemoveCurrentVideo();
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Remover vídeo"
                        accessibilityRole="button"
                    >
                        <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    onPress={handleSelect}
                    activeOpacity={0.7}
                    accessibilityLabel="Selecionar vídeo"
                    accessibilityRole="button"
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#ffffff",
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.08)",
                        borderStyle: "dashed",
                        gap: 8,
                    }}
                >
                    <Video size={18} color="#94a3b8" />
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#94a3b8" }}>
                        Selecionar vídeo
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
