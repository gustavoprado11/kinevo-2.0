import React, { useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react-native";
import {
    generateCalendarDays,
    getMonthGridRange,
    getMonthRange,
    shiftMonth,
    toDateKey,
    type CalendarDay,
    type ScheduledWorkoutRef,
    type SessionRef,
} from "@kinevo/shared/utils/schedule-projection";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAY_NAMES = ["D", "S", "T", "Q", "Q", "S", "S"];

const STATUS_DOT_COLORS: Record<CalendarDay["status"], string | null> = {
    done: "#7c3aed",
    missed: "#ef4444",
    scheduled: "#94a3b8",
    rest: null,
    out_of_program: null,
};

interface MonthCalendarProps {
    workouts: ScheduledWorkoutRef[];
    sessionsMap: Map<string, SessionRef[]>;
    programStartedAt: string | null;
    programDurationWeeks: number | null;
    selectedDate: Date;
    onDayPress: (date: Date) => void;
    onCollapse?: (date: Date) => void;
    fetchRange?: (start: Date, end: Date) => void;
}

export function MonthCalendar({
    workouts,
    sessionsMap,
    programStartedAt,
    programDurationWeeks,
    selectedDate,
    onDayPress,
    onCollapse,
    fetchRange,
}: MonthCalendarProps) {
    const [anchorDate, setAnchorDate] = useState(() => new Date(selectedDate));
    const selectedKey = toDateKey(selectedDate);

    // Generate calendar grid for this month
    const gridDays = useMemo(() => {
        const gridRange = getMonthGridRange(anchorDate);
        const sessionsArr: SessionRef[] = [];
        sessionsMap.forEach((arr) => {
            for (const s of arr) sessionsArr.push(s);
        });
        return generateCalendarDays(
            gridRange.start,
            gridRange.end,
            workouts,
            sessionsArr,
            programStartedAt || new Date().toISOString(),
            programDurationWeeks,
        );
    }, [anchorDate, workouts, sessionsMap, programStartedAt, programDurationWeeks]);

    const anchorMonth = anchorDate.getMonth();

    // Navigate months
    const navigate = useCallback(
        (direction: -1 | 1) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const next = shiftMonth(anchorDate, direction);
            setAnchorDate(next);
            // Fetch sessions for the new month range
            const monthRange = getMonthRange(next);
            fetchRange?.(monthRange.start, monthRange.end);
        },
        [anchorDate, fetchRange],
    );

    // Fetch initial month on mount
    useEffect(() => {
        const monthRange = getMonthRange(anchorDate);
        fetchRange?.(monthRange.start, monthRange.end);
    }, []);

    const monthLabel = anchorDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });

    return (
        <View style={{ marginBottom: 24 }}>
            {/* Month header with navigation */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <TouchableOpacity onPress={() => navigate(-1)} style={{ padding: 6 }}>
                    <ChevronLeft size={18} color="#94a3b8" />
                </TouchableOpacity>

                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#0f172a",
                        textTransform: "capitalize",
                        letterSpacing: 1,
                    }}
                >
                    {monthLabel}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <TouchableOpacity onPress={() => navigate(1)} style={{ padding: 6 }}>
                        <ChevronRight size={18} color="#94a3b8" />
                    </TouchableOpacity>
                    {onCollapse && (
                        <TouchableOpacity
                            onPress={() => onCollapse(selectedDate)}
                            style={{ padding: 6, marginLeft: 4 }}
                        >
                            <ChevronUp size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Day-of-week header */}
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
                {DAY_NAMES.map((name, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: "600",
                                letterSpacing: 2,
                                textTransform: "uppercase",
                                color: "#94a3b8",
                            }}
                        >
                            {name}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Day grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {gridDays.map((day) => {
                    const isCurrentMonth = day.date.getMonth() === anchorMonth;
                    const isSelected = day.dateKey === selectedKey;
                    const isToday = day.isToday;
                    const isOutOfProgram = day.status === "out_of_program";
                    const dotColor = STATUS_DOT_COLORS[day.status];
                    const isClickable = isCurrentMonth && !isOutOfProgram;

                    return (
                        <TouchableOpacity
                            key={day.dateKey}
                            onPress={() => {
                                if (isClickable) {
                                    onDayPress(day.date);
                                    // Collapse back to week view when a day is tapped
                                    onCollapse?.(day.date);
                                }
                            }}
                            disabled={!isClickable}
                            style={{
                                width: "14.285%", // 100/7
                                aspectRatio: 1,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isCurrentMonth ? (isOutOfProgram ? 0.3 : 1) : 0.2,
                            }}
                            activeOpacity={0.6}
                        >
                            <View
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: isSelected ? "#7c3aed" : "transparent",
                                    borderWidth: isToday && !isSelected ? 1 : 0,
                                    borderColor: "#7c3aed",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: isSelected || isToday ? "700" : "400",
                                        color: isSelected
                                            ? "#ffffff"
                                            : isToday
                                                ? "#7c3aed"
                                                : "#334155",
                                    }}
                                >
                                    {day.date.getDate()}
                                </Text>
                            </View>

                            {/* Status dot */}
                            {dotColor && isCurrentMonth && (
                                <View
                                    style={{
                                        position: "absolute",
                                        bottom: 2,
                                        width: 4,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor: dotColor,
                                    }}
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
