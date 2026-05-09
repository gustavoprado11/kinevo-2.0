import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import { useFormsTabStateStore } from '../../../stores/formsTabStateStore';

// M11 — banner in-app de reorganização da tab Formulários no mobile.
// Aparece na primeira visita pós-deploy; persiste 'Entendi' em MMKV via
// useFormsTabStateStore.migrationBannerSeen. Pattern paralelo do
// MigrationBanner web (M8/B1).
export function MigrationBannerMobile() {
    const seen = useFormsTabStateStore((s) => s.migrationBannerSeen);
    const markSeen = useFormsTabStateStore((s) => s.markMigrationBannerSeen);

    if (seen) return null;

    const handleDismiss = () => {
        Haptics.selectionAsync();
        markSeen();
    };

    return (
        <View
            style={{
                marginHorizontal: 20,
                marginBottom: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.brand.primary + '33',
                backgroundColor: colors.brand.primary + '10',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
            }}
            accessibilityRole="alert"
        >
            <View
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brand.primary + '22',
                }}
            >
                <Sparkles size={16} color={colors.brand.primary} />
            </View>
            <Text style={{ flex: 1, fontSize: 12, color: colors.text.primary, lineHeight: 16 }}>
                Reorganizamos <Text style={{ fontWeight: '700' }}>Formulários</Text> e{' '}
                <Text style={{ fontWeight: '700' }}>Avaliações</Text> em segmentos. Use as abas no topo.
            </Text>
            <TouchableOpacity
                onPress={handleDismiss}
                accessibilityRole="button"
                accessibilityLabel="Entendi, fechar banner"
                style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: colors.brand.primary,
                }}
            >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Entendi</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleDismiss}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                hitSlop={8}
                style={{ padding: 4 }}
            >
                <X size={14} color={colors.text.tertiary} />
            </TouchableOpacity>
        </View>
    );
}
