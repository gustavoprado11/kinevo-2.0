import React, { useCallback } from "react";
import { View, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors } from "@/hooks/useV2Colors";
import { DAYS } from "./day-helpers";

export { computeOccupiedDays } from "./day-helpers";

interface DaySelectorProps {
    frequency: string[];
    occupiedDays: string[];
    onUpdateFrequency: (days: string[]) => void;
}

export function DaySelector({ frequency, occupiedDays, onUpdateFrequency }: DaySelectorProps) {
    const colors = useV2Colors();
    const handleToggle = useCallback((dayKey: string) => {
        const isOccupied = occupiedDays.includes(dayKey) && !frequency.includes(dayKey);
        if (isOccupied) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newDays = frequency.includes(dayKey)
            ? frequency.filter(d => d !== dayKey)
            : [...frequency, dayKey];
        onUpdateFrequency(newDays);
    }, [frequency, occupiedDays, onUpdateFrequency]);

    const hasSelection = frequency.length > 0;

    return (
        <View style={{
            flexDirection: 'row',
            gap: 2,
            backgroundColor: hasSelection ? colors.purple[100] : colors.surface.card2,
            borderRadius: 10,
            padding: 3,
            borderWidth: 1,
            borderColor: hasSelection ? colors.purple[200] : colors.border.default,
        }}>
            {DAYS.map((day) => {
                const isSelected = frequency.includes(day.key);
                const isOccupied = occupiedDays.includes(day.key) && !isSelected;

                return (
                    <PressableScale
                        key={day.key}
                        onPress={() => handleToggle(day.key)}
                        pressScale={0.85}
                        disabled={isOccupied}
                        accessibilityRole="button"
                        accessibilityLabel={day.key}
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSelected
                                ? colors.purple[600]
                                : isOccupied
                                    ? colors.border.default
                                    : 'transparent',
                            // Subtle shadow on selected buttons
                            ...(isSelected ? {
                                shadowColor: colors.purple[600],
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.3,
                                shadowRadius: 3,
                                elevation: 2,
                            } : {}),
                        }}
                    >
                        <Text style={{
                            fontSize: 11,
                            fontWeight: isSelected ? '800' : '600',
                            color: isSelected
                                ? '#FFFFFF'
                                : isOccupied
                                    ? colors.text.quaternary
                                    : colors.text.tertiary,
                        }}>
                            {day.label}
                        </Text>
                    </PressableScale>
                );
            })}
        </View>
    );
}
