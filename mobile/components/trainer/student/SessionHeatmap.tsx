import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useStudentHeatmap, type HeatmapDay } from "../../../hooks/useStudentHeatmap";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";

// ─── Constants ───────────────────────────────────────────────────────
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CARD_HORIZONTAL_PADDING = 16;
const CELL_GAP = 6;
const COLUMNS = 7;

// ─── Helpers ─────────────────────────────────────────────────────────
function formatMonthYear(date: Date): string {
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    return `${m}min`;
}

function getDayNumber(dateStr: string): number {
    // Extract day from "YYYY-MM-DD"
    return parseInt(dateStr.split("-")[2], 10);
}

// ─── Intensity → visual mapping ──────────────────────────────────────
function getCellColors(count: number, isCurrentMonth: boolean) {
    if (!isCurrentMonth) {
        return {
            bg: "transparent",
            text: colors.text.quaternary,
            dot: "transparent",
        };
    }
    if (count === 0) {
        return {
            bg: "transparent",
            text: colors.text.tertiary,
            dot: "transparent",
        };
    }
    if (count === 1) {
        return {
            bg: colors.brand.primaryLight,
            text: colors.brand.primary,
            dot: colors.brand.primary,
        };
    }
    // count >= 2
    return {
        bg: colors.brand.primary,
        text: "#ffffff",
        dot: "#ffffff",
    };
}

// ─── Grid Day type ───────────────────────────────────────────────────
interface GridDay {
    date: string;
    count: number;
    isCurrentMonth: boolean;
}

// ─── Memoized Calendar Cell ──────────────────────────────────────────
const CalendarCell = React.memo(function CalendarCell({
    day,
    cellSize,
    isToday,
    isSelected,
    onPress,
}: {
    day: GridDay;
    cellSize: number;
    isToday: boolean;
    isSelected: boolean;
    onPress: (date: string) => void;
}) {
    const dayNum = getDayNumber(day.date);
    const { bg, text, dot } = getCellColors(day.count, day.isCurrentMonth);

    const hasBorder = isToday || isSelected;
    const borderColor = isToday
        ? colors.brand.primary
        : isSelected
            ? colors.brand.primaryDark
            : "transparent";

    return (
        <TouchableOpacity
            onPress={() => day.count > 0 && day.isCurrentMonth && onPress(day.date)}
            activeOpacity={day.count > 0 && day.isCurrentMonth ? 0.6 : 1}
            accessibilityLabel={`${dayNum}, ${day.count} treino${day.count !== 1 ? "s" : ""}`}
            style={{
                width: cellSize,
                height: cellSize,
                borderRadius: cellSize * 0.28,
                backgroundColor: isSelected && day.count > 0 ? colors.brand.primaryDark : bg,
                borderWidth: hasBorder ? 2 : 0,
                borderColor,
                alignItems: "center",
                justifyContent: "center",
                opacity: day.isCurrentMonth ? 1 : 0.3,
            }}
        >
            <Text
                style={{
                    fontSize: cellSize * 0.36,
                    fontWeight: day.count > 0 ? "700" : "400",
                    color: isSelected && day.count > 0 ? "#ffffff" : text,
                    includeFontPadding: false,
                }}
            >
                {dayNum}
            </Text>

            {/* Dot indicator for 1 workout (subtle reinforcement) */}
            {day.count === 1 && !isSelected && day.isCurrentMonth && (
                <View
                    style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: dot,
                        marginTop: 1,
                    }}
                />
            )}

            {/* Double dot for 2+ workouts */}
            {day.count >= 2 && day.isCurrentMonth && (
                <View style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: isSelected ? "#ffffff" : "#ffffff" }} />
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: isSelected ? "#ffffff" : "#ffffff" }} />
                </View>
            )}
        </TouchableOpacity>
    );
});

// ─── Main Component ──────────────────────────────────────────────────
export function SessionHeatmap({ studentId }: { studentId: string }) {
    const { width: screenWidth } = useWindowDimensions();

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

    // Calculate cell size based on available width
    const cellSize = useMemo(() => {
        const cardContentWidth = screenWidth - (spacing.xl * 2) - (CARD_HORIZONTAL_PADDING * 2);
        const totalGaps = (COLUMNS - 1) * CELL_GAP;
        return Math.floor((cardContentWidth - totalGaps) / COLUMNS);
    }, [screenWidth]);

    // Compute grid: ONLY current month (with padding days for alignment)
    const grid = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Pad to start on Sunday
        const startPad = firstDay.getDay();
        const paddedStart = new Date(firstDay);
        paddedStart.setDate(paddedStart.getDate() - startPad);

        // Pad to end on Saturday
        const endPad = 6 - lastDay.getDay();
        const paddedEnd = new Date(lastDay);
        paddedEnd.setDate(paddedEnd.getDate() + endPad);

        const days: GridDay[] = [];
        const cursor = new Date(paddedStart);

        while (cursor <= paddedEnd) {
            const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
            const dayData = dayMap.get(dateStr);
            days.push({
                date: dateStr,
                count: dayData?.count ?? 0,
                isCurrentMonth: cursor.getMonth() === month,
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        return days;
    }, [currentMonth, dayMap]);

    // Split into weeks
    const weeks = useMemo(() => {
        const result: GridDay[][] = [];
        for (let i = 0; i < grid.length; i += 7) {
            result.push(grid.slice(i, i + 7));
        }
        return result;
    }, [grid]);

    // Count summary for the month
    const monthSummary = useMemo(() => {
        let totalSessions = 0;
        let daysWithWorkout = 0;
        for (const day of grid) {
            if (day.isCurrentMonth && day.count > 0) {
                daysWithWorkout++;
                totalSessions += day.count;
            }
        }
        return { totalSessions, daysWithWorkout };
    }, [grid]);

    const handleCellPress = (date: string) => {
        setSelectedDate(selectedDate === date ? null : date);
    };

    // ─── Loading ──────────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={{ backgroundColor: colors.background.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.xl }}>
                <Text style={{ fontSize: 13, color: colors.text.tertiary, textAlign: "center" }}>
                    Carregando histórico...
                </Text>
            </View>
        );
    }

    // ─── Render ───────────────────────────────────────────────────
    return (
        <View style={{ marginBottom: spacing.xl }}>
            {/* Section title */}
            <Text
                style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.text.secondary,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: spacing.sm,
                }}
            >
                Histórico de Treinos
            </Text>

            {/* Calendar card */}
            <View
                style={{
                    backgroundColor: colors.background.card,
                    borderRadius: 16,
                    padding: CARD_HORIZONTAL_PADDING,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 4,
                    elevation: 1,
                }}
            >
                {/* Month navigation */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: spacing.lg,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => navigateMonth(-1)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityLabel="Mês anterior"
                        accessibilityRole="button"
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: colors.background.primary,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ChevronLeft size={18} color={colors.text.secondary} />
                    </TouchableOpacity>

                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: colors.text.primary,
                            textTransform: "capitalize",
                        }}
                    >
                        {formatMonthYear(currentMonth)}
                    </Text>

                    <TouchableOpacity
                        onPress={() => navigateMonth(1)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityLabel="Próximo mês"
                        accessibilityRole="button"
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: colors.background.primary,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ChevronRight size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Weekday headers */}
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-around",
                        marginBottom: spacing.sm,
                    }}
                >
                    {WEEKDAY_LABELS.map((label, i) => (
                        <Text
                            key={i}
                            style={{
                                width: cellSize,
                                textAlign: "center",
                                fontSize: 11,
                                fontWeight: "600",
                                color: i === 0 || i === 6
                                    ? colors.text.quaternary  // weekend dimmer
                                    : colors.text.tertiary,
                                textTransform: "uppercase",
                            }}
                        >
                            {label}
                        </Text>
                    ))}
                </View>

                {/* Calendar grid */}
                <View style={{ gap: CELL_GAP }}>
                    {weeks.map((week, wi) => (
                        <View
                            key={wi}
                            style={{
                                flexDirection: "row",
                                justifyContent: "space-around",
                            }}
                        >
                            {week.map((day) => (
                                <CalendarCell
                                    key={day.date}
                                    day={day}
                                    cellSize={cellSize}
                                    isToday={day.date === todayStr}
                                    isSelected={day.date === selectedDate}
                                    onPress={handleCellPress}
                                />
                            ))}
                        </View>
                    ))}
                </View>

                {/* Month summary + Legend */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: spacing.md,
                        paddingTop: spacing.md,
                        borderTopWidth: 1,
                        borderTopColor: colors.border.primary,
                    }}
                >
                    {/* Summary */}
                    <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                        <Text style={{ fontWeight: "700", color: colors.brand.primary }}>
                            {monthSummary.totalSessions}
                        </Text>
                        {" "}treino{monthSummary.totalSessions !== 1 ? "s" : ""} em{" "}
                        <Text style={{ fontWeight: "700", color: colors.brand.primary }}>
                            {monthSummary.daysWithWorkout}
                        </Text>
                        {" "}dia{monthSummary.daysWithWorkout !== 1 ? "s" : ""}
                    </Text>

                    {/* Legend */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <View
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 3,
                                    backgroundColor: colors.brand.primaryLight,
                                    borderWidth: 1,
                                    borderColor: "rgba(124, 58, 237, 0.15)",
                                }}
                            />
                            <Text style={{ fontSize: 10, color: colors.text.tertiary, fontWeight: "500" }}>1</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <View
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 3,
                                    backgroundColor: colors.brand.primary,
                                }}
                            />
                            <Text style={{ fontSize: 10, color: colors.text.tertiary, fontWeight: "500" }}>2+</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Drill-down detail card */}
            {selectedDay && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    style={{
                        backgroundColor: colors.background.card,
                        borderRadius: 14,
                        padding: spacing.lg,
                        marginTop: spacing.sm,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.03,
                        shadowRadius: 4,
                        elevation: 1,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: colors.text.primary,
                            marginBottom: spacing.sm,
                        }}
                    >
                        {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("pt-BR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                        })}
                        {"  ·  "}
                        <Text style={{ color: colors.brand.primary }}>
                            {selectedDay.count} treino{selectedDay.count !== 1 ? "s" : ""}
                        </Text>
                    </Text>

                    {selectedDay.sessions.map((s, idx) => (
                        <View
                            key={s.id}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: spacing.sm,
                                borderTopWidth: idx === 0 ? 0 : 1,
                                borderTopColor: colors.border.primary,
                            }}
                        >
                            <View
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: colors.brand.primary,
                                    marginRight: spacing.sm,
                                }}
                            />
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "500",
                                    color: colors.text.primary,
                                    flex: 1,
                                }}
                            >
                                {s.workout_name}
                            </Text>
                            {s.duration_seconds != null && s.duration_seconds > 0 && (
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: colors.text.secondary,
                                        fontWeight: "500",
                                    }}
                                >
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
