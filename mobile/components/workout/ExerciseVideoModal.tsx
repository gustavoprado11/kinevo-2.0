import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { X } from 'lucide-react-native';
import { extractYoutubeId, isDirectVideoUrl } from '../../lib/youtube';

// Lazy-load expo-av to avoid crash when native module is not linked
let ExpoVideo: any = null;
let ExpoResizeMode: any = null;
let expoAvLoaded = false;

try {
    const av = require('expo-av');
    ExpoVideo = av.Video;
    ExpoResizeMode = av.ResizeMode;
    expoAvLoaded = true;
} catch {
    // expo-av not available — direct video playback will be disabled
}

interface ExerciseVideoModalProps {
    visible: boolean;
    onClose: () => void;
    videoUrl: string | null;
}

export function ExerciseVideoModal({ visible, onClose, videoUrl }: ExerciseVideoModalProps) {
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const PLAYER_WIDTH = SCREEN_WIDTH - 32;
    const PLAYER_HEIGHT = PLAYER_WIDTH * (9 / 16);

    const videoId = extractYoutubeId(videoUrl);
    const isDirect = isDirectVideoUrl(videoUrl);

    const onStateChange = useCallback((state: string) => {
        if (state === 'ended') {
            onClose();
        }
    }, [onClose]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {/* Close button */}
                <TouchableOpacity
                    onPress={onClose}
                    activeOpacity={0.7}
                    style={{
                        position: 'absolute',
                        top: 60,
                        right: 20,
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                    }}
                >
                    <X size={22} color="#fff" strokeWidth={2} />
                </TouchableOpacity>

                {/* Player container */}
                <View
                    style={{
                        width: PLAYER_WIDTH,
                        height: PLAYER_HEIGHT,
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: '#000',
                    }}
                >
                    {videoId ? (
                        <YoutubePlayer
                            height={PLAYER_HEIGHT}
                            width={PLAYER_WIDTH}
                            videoId={videoId}
                            play={visible}
                            onChangeState={onStateChange}
                            webViewProps={{
                                allowsInlineMediaPlayback: true,
                            }}
                        />
                    ) : isDirect && videoUrl && expoAvLoaded && ExpoVideo ? (
                        <ExpoVideo
                            source={{ uri: videoUrl }}
                            style={{ width: PLAYER_WIDTH, height: PLAYER_HEIGHT }}
                            useNativeControls
                            resizeMode={ExpoResizeMode?.CONTAIN}
                            shouldPlay={visible}
                        />
                    ) : (
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text style={{ color: '#64748b', fontSize: 14 }}>
                                Vídeo não disponível
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}
