import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useStudentHeatmap, type HeatmapDay } from "../../../hooks/useStudentHeatmap";

const CELL_SIZE = 14;
const CELL_GAP = 3;
const DAY_HEADERS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Memoized grid cell to avoid re-rendering ~90 cells when selecting a day */
const HeatmapCell = React.memo(function HeatmapCell({
    date,
    count,
    isToday,
    isSelected,
    onPress,
}: {
    date: string;
    count: number;
    isToday: boolean;
    isSelected: boolean;
    onPress: (date: string) => void;
}) {
    let bg = "transparent";
    if (count === 1) bg = "#ede9fe";
    if (count >= 2) bg = "#7c3aed";

    return (
        <TouchableOpacity
            onPress={() => count > 0 && onPress(date)}
            activeOpacity={count > 0 ? 0.7 : 1}
            style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: 3,
                backgroundColor: bg,
                borderWidth: isToday ? 1.5 : isSelected ? 1.5 : 0,
                borderColor: isToday ? "#7c3aed" : isSelected ? "#a78bfa" : "transparent",
            }}
        />
    );
});

function formatMonthYear(date: Date): string {
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    return `${m}min`;
}

interface GridDay {
    date: string;
    count: number;
    isCurrentMonth: boolean;
}

export function SessionHeatmap({ studentId }: { studentId: string }) {
    const {
        dayMap,
        isLoading,
        selectedDate,
        setSelectedDate,
        selectedDay,
        currentMonth,
        navigateMonth,
    } = useStudentHeatmap(studentId);

    const todayStr = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }, []);

    // Compute grid: current month + 1 month before + 1 month after
    const grid = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        // Start from 1 month before, end 1 month after
        const gridStart = new Date(year, month - 1, 1);
        const gridEnd = new Date(year, month + 2, 0); // last day of month+1

        // Pad to start on Sunday
        const startDay = gridStart.getDay();
        const paddedStart = new Date(gridStart);
        paddedStart.setDate(paddedStart.getDate() - startDay);

        const days: GridDay[] = [];
        const cursor = new Date(paddedStart);

        while (cursor <= gridEnd || cursor.getDay() !== 0) {
            const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
            const dayData = dayMap.get(dateStr);
            days.push({
                date: dateStr,
                count: dayData?.count ?? 0,
                isCurrentMonth: cursor.getMonth() === month,
            });
            cursor.setDate(cursor.getDate() + 1);
            if (days.length > 120) break; // safety
        }

        return days;
    }, [currentMonth, dayMap]);

    // Split into weeks (rows of 7)
    const weeks = useMemo(() => {
        const result: GridDay[][] = [];
        for (let i = 0; i < grid.length; i += 7) {
            result.push(grid.slice(i, i + 7));
        }
        return result;
    }, [grid]);

    const handleCellPress = (date: string) => {
        setSelectedDate(selectedDate === date ? null : date);
    };

    if (isLoading) {
        return (
            <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                    Carregando histórico...
                </Text>
            </View>
        );
    }

    return (
        <View style={{ marginBottom: 20 }}>
            <Text
                style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 10,
                }}
            >
                Histórico de Treinos
            </Text>

            <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16 }}>
                {/* Month navigation */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <TouchableOpacity onPress={() => navigateMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Mês anterior" accessibilityRole="button">
                        <ChevronLeft size={18} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#0f172a", textTransform: "capitalize" }}>
                        {formatMonthYear(currentMonth)}
                    </Text>
                    <TouchableOpacity onPress={() => navigateMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Próximo mês" accessibilityRole="button">
                        <ChevronRight size={18} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Day headers */}
                <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 4 }}>
                    {DAY_HEADERS.map((d, i) => (
                        <Text key={i} style={{ width: CELL_SIZE, textAlign: "center", fontSize: 9, fontWeight: "600", color: "#cbd5e1" }}>
                            {d}
                        </Text>
                    ))}
                </View>

                {/* Grid */}
                <View style={{ gap: CELL_GAP }}>
                    {weeks.map((week, wi) => (
                        <View key={wi} style={{ flexDirection: "row", justifyContent: "space-around" }}>
                            {week.map((day) => (
                                <View key={day.date} style={{ opacity: day.isCurrentMonth ? 1 : 0.25 }}>
                                    <HeatmapCell
                                        date={day.date}
                                        count={day.count}
                                        isToday={day.date === todayStr}
                                        isSelected={day.date === selectedDate}
                                        onPress={handleCellPress}
                                    />
                                </View>
                            ))}
                        </View>
                    ))}
                </View>

                {/* Legend */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "transparent", borderWidth: 1, borderColor: "#e2e8f0" }} />
                        <Text style={{ fontSize: 9, color: "#94a3b8" }}>0</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#ede9fe" }} />
                        <Text style={{ fontSize: 9, color: "#94a3b8" }}>1</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#7c3aed" }} />
                        <Text style={{ fontSize: 9, color: "#94a3b8" }}>2+</Text>
                    </View>
                </View>
            </View>

            {/* Drill-down card */}
            {selectedDay && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: 14,
                        padding: 14,
                        marginTop: 8,
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a", marginBottom: 8 }}>
                        {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                        {" · "}
                        {selectedDay.count} treino{selectedDay.count !== 1 ? "s" : ""}
                    </Text>
                    {selectedDay.sessions.map((s) => (
                        <View
                            key={s.id}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 6,
                                borderTopWidth: 0.5,
                                borderTopColor: "rgba(0,0,0,0.06)",
                            }}
                        >
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#7c3aed", marginRight: 10 }} />
                            <Text style={{ fontSize: 13, color: "#1a1a2e", flex: 1 }}>
                                {s.workout_name}
                            </Text>
                            {s.duration_seconds && (
                                <Text style={{ fontSize: 12, color: "#64748b" }}>
                                    {formatDuration(s.duration_seconds)}
                                </Text>
                            )}
                        </View>
                    ))}
                </Animated.View>
            )}
        </View>
    );
}
