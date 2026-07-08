/**
 * GrowingVideoPlayer — player de vídeo ancorado embaixo no modo Foco, que CRESCE
 * conforme o aluno rola a área de séries (interação-âncora do design). Fase 4.
 *
 * D5 (decisão): em vez de um WebView do YouTube redimensionado a cada frame
 * (risco de jank/reflow), mostramos o THUMBNAIL do YouTube que cresce (Image é
 * barato de redimensionar) + toque/"Tela cheia" abrem o ExerciseVideoModal
 * (reprodução real, robusta). Crescimento fiel; playback no modal.
 *
 * Altura mapeada ao scrollY (Reanimated, thread de UI): 138→452px em ~190px de
 * rolagem: h = clamp(138, 452, 138 + scrollY*(452-138)/190).
 *
 * D1 (superset): recebe `childOptions` (um vídeo por filho) + um seletor (chips).
 * D2: cardio/aquecimento NÃO renderizam este player (decidido no caller).
 */
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated';
import { Repeat, Maximize2, Play, VideoOff } from 'lucide-react-native';
import { extractYoutubeId } from '../../lib/youtube';

const MIN_H = 138;
const MAX_H = 452;
const SCROLL_SPAN = 190;

export interface VideoChoice {
    name: string;
    videoUrl: string | null;
}

interface GrowingVideoPlayerProps {
    /** Vídeo do exercício atual (ou do filho selecionado no superset). */
    videoUrl: string | null;
    scrollY: SharedValue<number>;
    onOpenFullscreen: (url: string) => void;
    /** Superset (D1): um vídeo por filho + seletor. Ausente = exercício simples. */
    childOptions?: VideoChoice[];
    selectedChild?: number;
    onSelectChild?: (index: number) => void;
}

export function GrowingVideoPlayer({ videoUrl, scrollY, onOpenFullscreen, childOptions, selectedChild = 0, onSelectChild }: GrowingVideoPlayerProps) {
    const animatedStyle = useAnimatedStyle(() => ({
        height: interpolate(scrollY.value, [0, SCROLL_SPAN], [MIN_H, MAX_H], Extrapolation.CLAMP),
    }));

    const ytId = extractYoutubeId(videoUrl);
    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
    const hasVideo = !!videoUrl;

    const openFull = () => {
        if (videoUrl) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenFullscreen(videoUrl);
        }
    };

    return (
        <Animated.View
            style={[
                {
                    backgroundColor: '#0F0C1A',
                    borderTopLeftRadius: 26,
                    borderTopRightRadius: 26,
                    overflow: 'hidden',
                    shadowColor: '#0F0C1A',
                    shadowOffset: { width: 0, height: -8 },
                    shadowOpacity: 0.18,
                    shadowRadius: 24,
                    elevation: 12,
                },
                animatedStyle,
            ]}
        >
            {/* Thumbnail (cresce junto) */}
            {hasVideo ? (
                <Pressable onPress={openFull} accessibilityRole="button" accessibilityLabel="Reproduzir demonstração" style={{ position: 'absolute', inset: 0 }}>
                    {thumb ? (
                        <Image source={{ uri: thumb }} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: 0.85 }} />
                    ) : (
                        <View style={{ flex: 1, backgroundColor: '#1A1730' }} />
                    )}
                    <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={24} color="#fff" style={{ marginLeft: 3 }} />
                        </View>
                    </View>
                </Pressable>
            ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 }}>
                    <VideoOff size={26} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>
                        Vídeo indisponível. Este exercício não possui vídeo cadastrado.
                    </Text>
                </View>
            )}

            {/* Handle */}
            <View style={{ position: 'absolute', top: 8, left: '50%', marginLeft: -21, width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />

            {/* Controles superiores */}
            <View style={{ position: 'absolute', top: 16, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                    <Repeat size={12} color="#fff" strokeWidth={2.2} />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Demonstração</Text>
                </View>
                {hasVideo ? (
                    <Pressable onPress={openFull} accessibilityRole="button" accessibilityLabel="Tela cheia" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11 }}>
                        <Maximize2 size={13} color="#fff" strokeWidth={2.2} />
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Tela cheia</Text>
                    </Pressable>
                ) : null}
            </View>

            {/* Seletor de filho (superset — D1) */}
            {childOptions && childOptions.length > 1 ? (
                <View style={{ position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, paddingHorizontal: 12 }}>
                    {childOptions.map((c, i) => {
                        const active = i === selectedChild;
                        return (
                            <Pressable
                                key={i}
                                onPress={() => { Haptics.selectionAsync(); onSelectChild?.(i); }}
                                accessibilityRole="button"
                                accessibilityLabel={`Vídeo: ${c.name}`}
                                style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.4)' }}
                            >
                                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: active ? '#0F0C1A' : 'rgba(255,255,255,0.85)', maxWidth: 120 }}>
                                    {c.name}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            ) : null}
        </Animated.View>
    );
}
