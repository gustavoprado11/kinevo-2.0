import React, { useMemo, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";

interface ProgramDatePickerModalProps {
    visible: boolean;
    /** Selected date as YYYY-MM-DD (or null when unset). */
    value: string | null;
    /** Inclusive lower bound (YYYY-MM-DD); earlier days are disabled. */
    minDate?: string | null;
    title: string;
    onClose: () => void;
    onSelect: (date: string) => void;
}

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
// Semana começa na segunda (padrão do app).
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** YYYY-MM-DD → {y,m,d} (no Date object, avoids timezone drift). */
function parseISO(iso: string): { y: number; m: number; d: number } | null {
    const parts = iso.split("-");
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return { y, m: m - 1, d };
}

function toISO(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Monday-based weekday index (0=Mon … 6=Sun) for a given y/m/d. */
function mondayIndex(y: number, m: number, d: number): number {
    const jsDay = new Date(y, m, d).getDay(); // 0=Sun … 6=Sat
    return (jsDay + 6) % 7;
}

export function ProgramDatePickerModal({
    visible,
    value,
    minDate,
    title,
    onClose,
    onSelect,
}: ProgramDatePickerModalProps) {
    const colors = useV2Colors();

    const today = new Date();
    const initial = (value && parseISO(value)) || { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
    const [view, setView] = useState<{ y: number; m: number }>({ y: initial.y, m: initial.m });

    // Reset the visible month to the selected value each time the sheet opens.
    const valueKey = value ?? "";
    const [lastValueKey, setLastValueKey] = useState(valueKey);
    const [lastVisible, setLastVisible] = useState(visible);
    if (visible !== lastVisible) {
        setLastVisible(visible);
        if (visible) {
            const v = (value && parseISO(value)) || { y: today.getFullYear(), m: today.getMonth() };
            setView({ y: v.y, m: v.m });
            setLastValueKey(valueKey);
        }
    } else if (valueKey !== lastValueKey) {
        setLastValueKey(valueKey);
    }

    const minParsed = minDate ? parseISO(minDate) : null;
    const minComparable = minParsed ? minParsed.y * 10000 + minParsed.m * 100 + minParsed.d : null;
    const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

    const cells = useMemo(() => {
        const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
        const leading = mondayIndex(view.y, view.m, 1);
        const grid: (number | null)[] = [];
        for (let i = 0; i < leading; i++) grid.push(null);
        for (let d = 1; d <= daysInMonth; d++) grid.push(d);
        while (grid.length % 7 !== 0) grid.push(null);
        return grid;
    }, [view]);

    const goMonth = (delta: number) => {
        Haptics.selectionAsync();
        setView((prev) => {
            const next = prev.m + delta;
            const y = prev.y + Math.floor(next / 12);
            const m = ((next % 12) + 12) % 12;
            return { y, m };
        });
    };

    const selectedISO = value;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
            >
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: colors.surface.card,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingHorizontal: 20,
                        paddingTop: 16,
                        paddingBottom: 36,
                        borderTopWidth: 1,
                        borderColor: colors.border.subtle,
                    }}
                >
                    <View style={{ alignItems: "center", marginBottom: 8 }}>
                        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border.default }} />
                    </View>

                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary, textAlign: "center", marginBottom: 12 }}>
                        {title}
                    </Text>

                    {/* Month navigation */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => goMonth(-1)}
                            accessibilityLabel="Mês anterior"
                            style={{ padding: 8, borderRadius: 10, backgroundColor: colors.surface.card2 }}
                        >
                            <ChevronLeft size={18} color={colors.text.secondary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }}>
                            {MONTHS[view.m]} {view.y}
                        </Text>
                        <TouchableOpacity
                            onPress={() => goMonth(1)}
                            accessibilityLabel="Próximo mês"
                            style={{ padding: 8, borderRadius: 10, backgroundColor: colors.surface.card2 }}
                        >
                            <ChevronRight size={18} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Weekday header */}
                    <View style={{ flexDirection: "row", marginBottom: 6 }}>
                        {WEEKDAYS.map((w) => (
                            <Text
                                key={w}
                                style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.text.tertiary }}
                            >
                                {w}
                            </Text>
                        ))}
                    </View>

                    {/* Day grid */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {cells.map((day, idx) => {
                            if (day == null) {
                                return <View key={`empty-${idx}`} style={{ width: `${100 / 7}%`, height: 40 }} />;
                            }
                            const iso = toISO(view.y, view.m, day);
                            const comparable = view.y * 10000 + view.m * 100 + day;
                            const disabled = minComparable != null && comparable < minComparable;
                            const isSelected = iso === selectedISO;
                            const isToday = iso === todayISO;
                            return (
                                <TouchableOpacity
                                    key={iso}
                                    disabled={disabled}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        onSelect(iso);
                                        onClose();
                                    }}
                                    style={{ width: `${100 / 7}%`, height: 40, alignItems: "center", justifyContent: "center" }}
                                >
                                    <View
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 17,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: isSelected ? colors.purple[600] : "transparent",
                                            borderWidth: isToday && !isSelected ? 1 : 0,
                                            borderColor: colors.purple[600],
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                fontWeight: isSelected ? "700" : "500",
                                                color: disabled
                                                    ? colors.text.quaternary
                                                    : isSelected
                                                        ? "#ffffff"
                                                        : colors.text.primary,
                                            }}
                                        >
                                            {day}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
