import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import { TEST_CATALOG, CATALOG_GROUPS, type CatalogEntry, type CatalogGroup } from './test-catalog';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (entry: CatalogEntry) => void;
}

// M10A/B2 — bottom sheet com catalog completo de testes. Tabs por grupo
// (Antropometria / Pregas / Força / etc). Tap no item adiciona à seção
// corrente e fecha o sheet.
export function TestLibrarySheet({ visible, onClose, onSelect }: Props) {
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['65%', '92%'], []);
    const [activeGroup, setActiveGroup] = useState<CatalogGroup>('antropometria');

    useEffect(() => {
        if (visible) {
            sheetRef.current?.expand();
        } else {
            sheetRef.current?.close();
        }
    }, [visible]);

    const items = useMemo(
        () => TEST_CATALOG.filter(e => e.group === activeGroup),
        [activeGroup],
    );

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        [],
    );

    const handleSelect = useCallback(
        (entry: CatalogEntry) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelect(entry);
            onClose();
        },
        [onSelect, onClose],
    );

    if (!visible) return null;

    return (
        <BottomSheet
            ref={sheetRef}
            snapPoints={snapPoints}
            index={0}
            topInset={insets.top}
            enableDynamicSizing={false}
            enablePanDownToClose
            onClose={onClose}
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: colors.background.card }}
            handleIndicatorStyle={{ backgroundColor: colors.text.quaternary }}
        >
            <View style={{ flex: 1 }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.secondary,
                    }}
                >
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text.primary }}>
                        Adicionar teste
                    </Text>
                    <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
                        <X size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Group tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}
                >
                    {CATALOG_GROUPS.map(g => {
                        const active = g.id === activeGroup;
                        return (
                            <TouchableOpacity
                                key={g.id}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setActiveGroup(g.id);
                                }}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: active ? colors.brand.primary : colors.border.secondary,
                                    backgroundColor: active ? colors.brand.primary + '15' : 'transparent',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '600',
                                        color: active ? colors.brand.primary : colors.text.secondary,
                                    }}
                                >
                                    {g.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Items */}
                <BottomSheetFlatList
                    data={items}
                    keyExtractor={item => item.catalogId}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 32 }}
                    renderItem={({ item }) => {
                        const Icon = item.icon;
                        return (
                            <TouchableOpacity
                                onPress={() => handleSelect(item)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    paddingVertical: 12,
                                    paddingHorizontal: 8,
                                    borderRadius: 10,
                                }}
                            >
                                <View
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        backgroundColor: colors.brand.primary + '12',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Icon size={18} color={colors.brand.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: colors.text.primary,
                                        }}
                                    >
                                        {item.label}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 1 }}>
                                        {item.description}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>
        </BottomSheet>
    );
}
