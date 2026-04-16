import React, { useCallback, useEffect, useState } from 'react';
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

// Default ratio for direct-uploaded videos before we know the file's natural
// size. Trainer videos are almost always filmed vertically on a phone (9:16),
// so we start with a portrait-friendly container to avoid a flash of tiny
// letterboxed video. For YouTube we keep 16:9 since those are landscape.
const DEFAULT_DIRECT_ASPECT = 9 / 16;
const YOUTUBE_ASPECT = 16 / 9;

export function ExerciseVideoModal({ visible, onClose, videoUrl }: ExerciseVideoModalProps) {
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    const MAX_WIDTH = SCREEN_WIDTH - 32;
    // Leave room for the close button and safe-area padding at top/bottom.
    const MAX_HEIGHT = SCREEN_HEIGHT * 0.82;

    const videoId = extractYoutubeId(videoUrl);
    const isDirect = isDirectVideoUrl(videoUrl);

    // For direct uploads, expo-av reports the file's natural dimensions via
    // onReadyForDisplay — we use them to fit the container exactly so portrait
    // videos (the common case) render at full vertical real-estate instead of
    // being letterboxed inside a hardcoded 16:9 box.
    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

    // Reset the measured ratio whenever the URL changes, otherwise a new video
    // briefly inherits the previous one's container size.
    useEffect(() => {
        setNaturalRatio(null);
    }, [videoUrl]);

    const onStateChange = useCallback((state: string) => {
        if (state === 'ended') {
            onClose();
        }
    }, [onClose]);

    const handleReadyForDisplay = useCallback((event: any) => {
        const w = event?.naturalSize?.width;
        const h = event?.naturalSize?.height;
        if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
            // iOS reports orientation separately when the file has a portrait
            // rotation tag; honour it so a 1920x1080 MOV filmed vertically is
            // treated as 1080x1920.
            const orientation = event?.naturalSize?.orientation;
            const rotated = orientation === 'portrait';
            setNaturalRatio(rotated ? h / w : w / h);
        }
    }, []);

    // Pick the container ratio: measured → provided → default portrait.
    const activeRatio = videoId
        ? YOUTUBE_ASPECT
        : (naturalRatio ?? DEFAULT_DIRECT_ASPECT);

    // Fit (MAX_WIDTH × MAX_HEIGHT) while preserving `activeRatio`.
    let playerWidth = MAX_WIDTH;
    let playerHeight = playerWidth / activeRatio;
    if (playerHeight > MAX_HEIGHT) {
        playerHeight = MAX_HEIGHT;
        playerWidth = playerHeight * activeRatio;
    }

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
                        width: playerWidth,
                        height: playerHeight,
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: '#000',
                    }}
                >
                    {videoId ? (
                        <YoutubePlayer
                            height={playerHeight}
                            width={playerWidth}
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
                            style={{ width: playerWidth, height: playerHeight }}
                            useNativeControls
                            resizeMode={ExpoResizeMode?.CONTAIN}
                            shouldPlay={visible}
                            onReadyForDisplay={handleReadyForDisplay}
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
