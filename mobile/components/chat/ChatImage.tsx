import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

// Signed URLs live long enough for a chat session; regenerated on every mount.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h

/**
 * Renders a chat message image. When an `image_path` is present it resolves a
 * short-lived signed URL (so the `messages` bucket can be private). Falls back
 * to the legacy public `fallbackUrl` while the bucket is public or if signing
 * fails — safe to ship before the bucket is flipped to private.
 */
export function ChatImage({
    path,
    fallbackUrl,
    hasContent,
    mutedColor,
    mutedBg,
}: {
    path?: string | null;
    fallbackUrl: string | null;
    hasContent: boolean;
    mutedColor: string;
    mutedBg: string;
}) {
    const [uri, setUri] = useState<string | null>(fallbackUrl);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!path) {
            setUri(fallbackUrl);
            return;
        }
        let active = true;
        supabase.storage
            .from('messages')
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
            .then(({ data }) => {
                if (active && data?.signedUrl) setUri(data.signedUrl);
            })
            .catch(() => {
                /* keep fallback */
            });
        return () => {
            active = false;
        };
    }, [path, fallbackUrl]);

    if (!uri) return null;

    if (failed) {
        return (
            <View
                style={{
                    width: 220,
                    height: 100,
                    borderRadius: 12,
                    backgroundColor: mutedBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: hasContent ? 6 : 0,
                }}
            >
                <ImageOff size={24} color={mutedColor} />
                <Text style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>
                    Imagem indisponível
                </Text>
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={{
                width: 220,
                height: 160,
                borderRadius: 12,
                marginBottom: hasContent ? 6 : 0,
                // M1: fundo neutro enquanto carrega. Sem isto, a área vazia da
                // imagem mostrava o fundo do balão (verde, em mensagem própria),
                // aparecendo como um "bloco verde" até a imagem pintar / em falha.
                backgroundColor: mutedBg,
            }}
            resizeMode="cover"
            onError={() => setFailed(true)}
        />
    );
}
