import React, { useState, useMemo } from "react";
import { View, Text, LayoutAnimation, UIManager, Platform } from "react-native";
import { Dumbbell, ChevronDown, ChevronUp } from "lucide-react-native";
import { PressableScale } from "../../shared/PressableScale";
import { colors } from "@/theme";
import { calculateVolume, getVolumeColor } from "./volume-helpers";
import type { Workout } from "@/stores/program-builder-store";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface VolumeSummaryProps {
    workouts: Workout[];
}

export function VolumeSummary({ workouts }: VolumeSummaryProps) {
    const [expanded, setExpanded] = useState(false);

    const volumeByGroup = useMemo(() => calculateVolume(workouts), [workouts]);

    const sortedGroups = useMemo(
        () => Object.entries(volumeByGroup)
            .sort(([, a], [, b]) => b - a)
            .filter(([, volume]) => volume > 0),
        [volumeByGroup]
    );

    const totalSets = sortedGroups.reduce((sum, [, v]) => sum + v, 0);

    if (totalSets === 0) return null;

    const maxVolume = sortedGroups.length > 0 ? sortedGroups[0][1] : 1;

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View style={{
            marginHorizontal: 20,
            marginBottom: 8,
            backgroundColor: colors.background.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.primary,
            overflow: 'hidden',
        }}>
            {/* Collapsed bar (always visible) */}
            <PressableScale
                onPress={toggleExpand}
                pressScale={0.98}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    gap: 8,
                }}
            >
                <Dumbbell size={14} color={colors.brand.primary} strokeWidth={2.5} />

                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {sortedGroups.slice(0, expanded ? undefined : 5).map(([group, volume]) => (
                        <View key={group} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                                {group}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: getVolumeColor(volume) }}>
                                {volume}
                            </Text>
                        </View>
                    ))}
                    {!expanded && sortedGroups.length > 5 && (
                        <Text style={{ fontSize: 11, color: colors.text.quaternary }}>
                            +{sortedGroups.length - 5}
                        </Text>
                    )}
                </View>

                {expanded
                    ? <ChevronUp size={14} color={colors.text.quaternary} />
                    : <ChevronDown size={14} color={colors.text.quaternary} />
                }
            </PressableScale>

            {/* Expanded detail */}
            {expanded && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                    <View style={{ height: 1, backgroundColor: colors.border.primary }} />

                    {sortedGroups.map(([group, volume]) => (
                        <View key={group} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{
                                fontSize: 12,
                                color: colors.text.secondary,
                                width: 100,
                            }} numberOfLines={1}>
                                {group}
                            </Text>

                            {/* Progress bar */}
                            <View style={{
                                flex: 1,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: '#f1f5f9',
                            }}>
                                <View style={{
                                    width: `${Math.min(100, (volume / maxVolume) * 100)}%`,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: getVolumeColor(volume),
                                }} />
                            </View>

                            <Text style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: getVolumeColor(volume),
                                width: 28,
                                textAlign: 'right',
                            }}>
                                {volume}
                            </Text>
                        </View>
                    ))}

                    {/* Legend */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 16,
                        marginTop: 4,
                    }}>
                        {[
                            { color: '#60a5fa', label: '<10 Baixo' },
                            { color: '#34d399', label: '10-20 Ok' },
                            { color: '#fbbf24', label: '>20 Alto' },
                        ].map(({ color, label }) => (
                            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                                <Text style={{ fontSize: 10, color: colors.text.tertiary }}>{label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}
