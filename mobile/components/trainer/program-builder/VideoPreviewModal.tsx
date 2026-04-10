import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import { X, AlertCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { extractYoutubeId, isDirectVideoUrl } from "../../../lib/youtube";

// Lazy-load expo-av to avoid crash when native module is not linked
let ExpoVideo: any = null;
let ExpoResizeMode: any = null;
let expoAvLoaded = false;

try {
    const av = require("expo-av");
    ExpoVideo = av.Video;
    ExpoResizeMode = av.ResizeMode;
    expoAvLoaded = true;
} catch {
    // expo-av not available — direct video playback will be disabled
}

interface VideoPreviewModalProps {
    visible: boolean;
    videoUrl: string | null;
    exerciseName: string;
    onClose: () => void;
}

export function VideoPreviewModal({ visible, videoUrl, exerciseName, onClose }: VideoPreviewModalProps) {
    const insets = useSafeAreaInsets();
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const PLAYER_WIDTH = SCREEN_WIDTH - 32;
    const PLAYER_HEIGHT = PLAYER_WIDTH * (9 / 16);

    const [isLoading, setIsLoading] = useState(true);

    const videoId = extractYoutubeId(videoUrl);
    const isDirect = isDirectVideoUrl(videoUrl);

    // Reset loading state when modal opens
    useEffect(() => {
        if (visible) {
            setIsLoading(true);
        }
    }, [visible]);

    const onYoutubeStateChange = useCallback((state: string) => {
        if (state === "playing") {
            setIsLoading(false);
        }
    }, []);

    const canPlayDirect = isDirect && videoUrl && expoAvLoaded && ExpoVideo;
    const canPlay = !!videoId || canPlayDirect;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.92)",
                justifyContent: "center",
                alignItems: "center",
            }}>
                {/* Header */}
                <View style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 20,
                    paddingBottom: 16,
                    zIndex: 10,
                }}>
                    <Text
                        style={{ fontSize: 16, fontWeight: "700", color: "#ffffff", flex: 1 }}
                        numberOfLines={1}
                    >
                        {exerciseName}
                    </Text>
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Fechar vídeo"
                        hitSlop={12}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: "rgba(255,255,255,0.15)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginLeft: 12,
                        }}
                    >
                        <X size={18} color="#ffffff" />
                    </TouchableOpacity>
                </View>

                {/* Player container */}
                <View style={{
                    width: PLAYER_WIDTH,
                    height: PLAYER_HEIGHT,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#000",
                }}>
                    {videoId ? (
                        /* YouTube video */
                        <>
                            {isLoading && (
                                <ActivityIndicator
                                    size="large"
                                    color="#ffffff"
                                    style={{
                                        position: "absolute",
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        zIndex: 5,
                                    }}
                                />
                            )}
                            <YoutubePlayer
                                height={PLAYER_HEIGHT}
                                width={PLAYER_WIDTH}
                                videoId={videoId}
                                play={visible}
                                onChangeState={onYoutubeStateChange}
                                webViewProps={{
                                    allowsInlineMediaPlayback: true,
                                }}
                            />
                        </>
                    ) : canPlayDirect ? (
                        /* Direct video (mp4, mov, webm) via expo-av */
                        <>
                            {isLoading && (
                                <ActivityIndicator
                                    size="large"
                                    color="#ffffff"
                                    style={{
                                        position: "absolute",
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        zIndex: 5,
                                    }}
                                />
                            )}
                            <ExpoVideo
                                source={{ uri: videoUrl }}
                                style={{ width: PLAYER_WIDTH, height: PLAYER_HEIGHT }}
                                useNativeControls
                                resizeMode={ExpoResizeMode?.CONTAIN}
                                shouldPlay={visible}
                                isLooping
                                onLoad={() => setIsLoading(false)}
                                onError={() => setIsLoading(false)}
                            />
                        </>
                    ) : (
                        /* No playable video */
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
                            <AlertCircle size={36} color="rgba(255,255,255,0.4)" />
                            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center" }}>
                                {videoUrl
                                    ? "Formato de vídeo não suportado"
                                    : "Vídeo não disponível"}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}
