import React from "react";
import { ScrollView, Text } from "react-native";
import { PressableScale } from "../shared/PressableScale";
import type { StudentFilter } from "../../hooks/useTrainerStudentsList";

interface FilterChipProps {
    label: string;
    count: number;
    active: boolean;
    onPress: () => void;
}

function FilterChip({ label, count, active, onPress }: FilterChipProps) {
    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.95}
            style={{
                backgroundColor: active ? "#7c3aed" : "#ffffff",
                borderRadius: 100,
                paddingHorizontal: 14,
                paddingVertical: 8,
                marginRight: 8,
                borderWidth: 1,
                borderColor: active ? "#7c3aed" : "rgba(0,0,0,0.06)",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
            }}
        >
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: active ? "#ffffff" : "#475569",
                }}
            >
                {label}
            </Text>
            {count > 0 && (
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: active ? "rgba(255,255,255,0.8)" : "#94a3b8",
                    }}
                >
                    {count}
                </Text>
            )}
        </PressableScale>
    );
}

interface StudentFilterChipsProps {
    filter: StudentFilter;
    setFilter: (filter: StudentFilter) => void;
    counts: Record<StudentFilter, number>;
}

export function StudentFilterChips({ filter, setFilter, counts }: StudentFilterChipsProps) {
    const chips: { key: StudentFilter; label: string }[] = [
        { key: "all", label: "Todos" },
        { key: "attention", label: "Atenção" },
        { key: "online", label: "Online" },
        { key: "presencial", label: "Presencial" },
        { key: "no_program", label: "Sem programa" },
    ];

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
        >
            {chips.map((chip) => (
                <FilterChip
                    key={chip.key}
                    label={chip.label}
                    count={counts[chip.key]}
                    active={filter === chip.key}
                    onPress={() => setFilter(chip.key)}
                />
            ))}
        </ScrollView>
    );
}
