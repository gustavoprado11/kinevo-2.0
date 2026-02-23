import React, { useRef, useCallback, useMemo, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { ChevronDown } from "lucide-react-native";
import {
    generateCalendarDays,
    getWeekRange,
    shiftWeek,
    toDateKey,
    type CalendarDay,
    type ScheduledWorkoutRef,
    type SessionRef,
} from "@kinevo/shared/utils/schedule-projection";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CALENDAR_PADDING = 40; // px-5 on each side
const CALENDAR_WIDTH = SCREEN_WIDTH - CALENDAR_PADDING;

const STATUS_COLORS: Record<CalendarDay["status"], string> = {
    done: "#22c55e",
    missed: "#ef4444",
    scheduled: "#94a3b8",
    rest: "transparent",
    out_of_program: "transparent",
};

const DAY_NAMES = ["D", "S", "T", "Q", "Q", "S", "S"];

interface WeekCalendarProps {
    workouts: ScheduledWorkoutRef[];
    sessionsMap: Map<string, SessionRef[]>;
    programStartedAt: string | null;
    programDurationWeeks: number | null;
    selectedDate: Date;
    onDayPress: (date: Date) => void;
    onWeekChange?: (weekStart: Date) => void;
    onExpand?: () => void;
    fetchRange?: (start: Date, end: Date) => void;
}

// Single week row
function WeekRow({
    days,
    selectedDate,
    onDayPress,
}: {
    days: CalendarDay[];
    selectedDate: Date;
    onDayPress: (date: Date) => void;
}) {
    const selectedKey = toDateKey(selectedDate);

    return (
        <View style={{ width: CALENDAR_WIDTH, flexDirection: "row", justifyContent: "space-between" }}>
            {days.map((day, index) => {
                const isSelected = day.dateKey === selectedKey;
                const isToday = day.isToday;
                const isOutOfProgram = day.status === "out_of_program";

                return (
                    <TouchableOpacity
                        key={day.dateKey}
                        onPress={() => !isOutOfProgram && onDayPress(day.date)}
                        style={{ width: 40, alignItems: "center", opacity: isOutOfProgram ? 0.3 : 1 }}
                        activeOpacity={0.7}
                        disabled={isOutOfProgram}
                    >
                        <Text
                            style={{
                                fontSize: 10,
                                letterSpacing: 3,
                                textTransform: "uppercase",
                                marginBottom: 10,
                                fontWeight: isSelected ? "600" : isToday ? "500" : "400",
                                color: isSelected
                                    ? "#7c3aed"
                                    : "#94a3b8",
                            }}
                        >
                            {DAY_NAMES[index]}
                        </Text>

                        <View style={{ alignItems: "center" }}>
                            <View
                                style={{
                                    height: 36,
                                    width: 36,
                                    borderRadius: 18,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: isSelected ? "#7c3aed" : "transparent",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        fontWeight: isSelected ? "700" : isToday ? "600" : "400",
                                        color: isSelected
                                            ? "#ffffff"
                                            : isToday
                                                ? "#0f172a"
                                                : "#64748b",
                                    }}
                                >
                                    {day.date.getDate()}
                                </Text>
                            </View>

                            <View
                                style={{
                                    marginTop: 6,
                                    height: 5,
                                    width: 5,
                                    borderRadius: 3,
                                    backgroundColor: STATUS_COLORS[day.status] || "transparent",
                                }}
                            />
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export function WeekCalendar({
    workouts,
    sessionsMap,
    programStartedAt,
    programDurationWeeks,
    selectedDate,
    onDayPress,
    onWeekChange,
    onExpand,
    fetchRange,
}: WeekCalendarProps) {
    const flatListRef = useRef<FlatList>(null);
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const isScrollingRef = useRef(false);

    // Build 3 weeks: prev, current, next
    const weeks = useMemo(() => {
        const prev = shiftWeek(anchorDate, -1);
        const next = shiftWeek(anchorDate, 1);
        return [prev, anchorDate, next].map((weekAnchor) => {
            const range = getWeekRange(weekAnchor);
            // Flatten sessionsMap to array for generateCalendarDays
            const sessionsArr: SessionRef[] = [];
            sessionsMap.forEach((arr) => {
                for (const s of arr) sessionsArr.push(s);
            });
            const days = generateCalendarDays(
                range.start,
                range.end,
                workouts,
                sessionsArr,
                programStartedAt || new Date().toISOString(),
                programDurationWeeks,
            );
            return { key: toDateKey(range.start), days, range };
        });
    }, [anchorDate, workouts, sessionsMap, programStartedAt, programDurationWeeks]);

    // Navigate after scroll settles
    const handleScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const page = Math.round(offsetX / CALENDAR_WIDTH);

            if (page === 0) {
                // Swiped to previous week
                const newAnchor = shiftWeek(anchorDate, -1);
                setAnchorDate(newAnchor);
                onWeekChange?.(getWeekRange(newAnchor).start);
                // Prefetch
                const prevRange = getWeekRange(shiftWeek(newAnchor, -1));
                fetchRange?.(prevRange.start, prevRange.end);
            } else if (page === 2) {
                // Swiped to next week
                const newAnchor = shiftWeek(anchorDate, 1);
                setAnchorDate(newAnchor);
                onWeekChange?.(getWeekRange(newAnchor).start);
                // Prefetch
                const nextRange = getWeekRange(shiftWeek(newAnchor, 1));
                fetchRange?.(nextRange.start, nextRange.end);
            }
            // page === 1 means stayed on current — no-op

            // Re-center to middle page
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({
                    offset: CALENDAR_WIDTH,
                    animated: false,
                });
            }, 50);

            isScrollingRef.current = false;
        },
        [anchorDate, onWeekChange, fetchRange],
    );

    // Center on mount
    useEffect(() => {
        setTimeout(() => {
            flatListRef.current?.scrollToOffset({
                offset: CALENDAR_WIDTH,
                animated: false,
            });
        }, 100);
    }, []);

    // When anchor changes, re-center
    useEffect(() => {
        flatListRef.current?.scrollToOffset({
            offset: CALENDAR_WIDTH,
            animated: false,
        });
    }, [anchorDate]);

    // Week label
    const weekRange = getWeekRange(anchorDate);
    const fmt = (d: Date) =>
        `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const weekLabel = `${fmt(weekRange.start)} — ${fmt(weekRange.end)}`;

    // Check if current view is this week
    const todayKey = toDateKey(new Date());
    const isCurrentWeek = weeks[1]?.days.some((d) => d.dateKey === todayKey);

    return (
        <View style={{ marginBottom: 24 }}>
            {/* Week label + navigation hint */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "600",
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            color: "#94a3b8",
                        }}
                    >
                        {weekLabel}
                    </Text>
                    {!isCurrentWeek && (
                        <TouchableOpacity
                            onPress={() => {
                                setAnchorDate(new Date());
                                onWeekChange?.(getWeekRange(new Date()).start);
                            }}
                            style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 6,
                                backgroundColor: '#f5f3ff',
                            }}
                        >
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed", letterSpacing: 1.5, textTransform: "uppercase" }}>
                                Hoje
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                {onExpand && (
                    <TouchableOpacity onPress={onExpand} style={{ padding: 4 }}>
                        <ChevronDown size={16} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Swipeable week strip */}
            <FlatList
                ref={flatListRef}
                data={weeks}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.key}
                snapToInterval={CALENDAR_WIDTH}
                decelerationRate="fast"
                onMomentumScrollEnd={handleScrollEnd}
                onScrollBeginDrag={() => { isScrollingRef.current = true; }}
                getItemLayout={(_, index) => ({
                    length: CALENDAR_WIDTH,
                    offset: CALENDAR_WIDTH * index,
                    index,
                })}
                renderItem={({ item }) => (
                    <WeekRow
                        days={item.days}
                        selectedDate={selectedDate}
                        onDayPress={onDayPress}
                    />
                )}
                initialScrollIndex={1}
                scrollEventThrottle={16}
            />
        </View>
    );
}
