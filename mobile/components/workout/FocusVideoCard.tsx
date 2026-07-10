/**
 * FocusVideoCard — card de demonstração compacto do modo Foco (design "Um por vez").
 * Mostra o thumbnail do YouTube (fallback gradiente) com badge "Demonstração",
 * play central e "Toque para assistir". Toque → abre o ExerciseVideoModal.
 * Substitui o player crescente da Fase 4. Só é renderizado quando há vídeo.
 */
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Video, Play } from 'lucide-react-native';
import { extractYoutubeId } from '../../lib/youtube';

interface FocusVideoCardProps {
    videoUrl: string;
    onPress: (url: string) => void;
}

export function FocusVideoCard({ videoUrl, onPress }: FocusVideoCardProps) {
    const ytId = extractYoutubeId(videoUrl);
    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;

    return (
        <Pressable
            onPress={() => { Haptics.selectionAsync(); onPress(videoUrl); }}
            accessibilityRole="button"
            accessibilityLabel="Ver demonstração do exercício"
            style={{
                height: 108, borderRadius: 20, overflow: 'hidden', marginTop: 14,
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 4,
            }}
        >
            {thumb ? (
                <Image source={{ uri: thumb }} resizeMode="cover" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            ) : (
                <LinearGradient colors={['#2B2B31', '#17171B']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
            )}
            {/* Escurece o thumbnail p/ contraste dos controles + brilho roxo sutil */}
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,12,26,0.32)' }} />

            {/* Badge Demonstração */}
            <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <Video size={10} color="#fff" strokeWidth={2.2} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.2 }}>Demonstração</Text>
            </View>

            {/* Play central */}
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={16} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
                </View>
            </View>

            <Text style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>
                Toque para assistir
            </Text>
        </Pressable>
    );
}
