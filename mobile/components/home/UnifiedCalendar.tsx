import React, { useRef, useCallback, useMemo, useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
    generateCalendarDays,
    getWeekRange,
    getMonthGridRange,
    getMonthRange,
    shiftWeek,
    shiftMonth,
    toDateKey,
    type CalendarDay,
    type ScheduledWorkoutRef,
    type SessionRef,
} from "@kinevo/shared/utils/schedule-projection";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CALENDAR_PADDING = 40;
const CALENDAR_WIDTH = SCREEN_WIDTH - CALENDAR_PADDING;

// Week row height: day-name (10+10mb) + circle (36) + dot (6+5) + bottom padding ≈ 82
const WEEK_ROW_HEIGHT = 82;
// Month grid: day-name header (18+8mb) + up to 6 rows × ~48 each
const MONTH_ROW_HEIGHT = 48;
const MONTH_HEADER_HEIGHT = 44; // nav row
const MONTH_DAY_HEADER_HEIGHT = 26; // D S T Q Q S S row

const STATUS_COLORS: Record<CalendarDay["status"], string> = {
    done: "#22c55e",
    missed: "#ef4444",
    scheduled: "#94a3b8",
    rest: "transparent",
    out_of_program: "transparent",
};

const STATUS_DOT_COLORS: Record<CalendarDay["status"], string | null> = {
    done: "#7c3aed",
    missed: "#ef4444",
    scheduled: "#94a3b8",
    rest: null,
    out_of_program: null,
};

const DAY_NAMES = ["D", "S", "T", "Q", "Q", "S", "S"];

const SPRING_CONFIG = { damping: 20, stiffness: 150 };

interface UnifiedCalendarProps {
    workouts: ScheduledWorkoutRef[];
    sessionsMap: Map<string, SessionRef[]>;
    programStartedAt: string | null;
    programDurationWeeks: number | null;
    selectedDate: Date;
    onDayPress: (date: Date) => void;
    onWeekChange?: (weekStart: Date) => void;
    fetchRange?: (start: Date, end: Date) => void;
}

// ── Week Row (reused from WeekCalendar) ──
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
        <View style={{ width: CALENDAR_WIDTH, flexDirection: "row", justifyContent: "space-between", paddingBottom: 12 }}>
            {days.map((day, index) => {
                const isSelected = day.dateKey === selectedKey;
                const isToday = day.isToday;
                const isOutOfProgram = day.status === "out_of_program";

                return (
                    <TouchableOpacity
                        key={day.dateKey}
                        onPress={() => {
                            if (!isOutOfProgram) {
                                Haptics.selectionAsync();
                                onDayPress(day.date);
                            }
                        }}
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
                                color: isSelected ? "#7c3aed" : "#94a3b8",
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
                                        color: isSelected ? "#ffffff" : isToday ? "#0f172a" : "#64748b",
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

export function UnifiedCalendar({
    workouts,
    sessionsMap,
    programStartedAt,
    programDurationWeeks,
    selectedDate,
    onDayPress,
    onWeekChange,
    fetchRange,
}: UnifiedCalendarProps) {
    const [expanded, setExpanded] = useState(false);
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const flatListRef = useRef<FlatList>(null);
    const isScrollingRef = useRef(false);

    // ── Animated values ──
    const expandProgress = useSharedValue(0); // 0 = week, 1 = month

    // ── Week data (3-page swipe) ──
    const weeks = useMemo(() => {
        const prev = shiftWeek(anchorDate, -1);
        const next = shiftWeek(anchorDate, 1);
        return [prev, anchorDate, next].map((weekAnchor) => {
            const range = getWeekRange(weekAnchor);
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

    // ── Month data ──
    const monthGridDays = useMemo(() => {
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

    const monthRowCount = Math.ceil(monthGridDays.length / 7);
    const monthContentHeight = MONTH_HEADER_HEIGHT + MONTH_DAY_HEADER_HEIGHT + (monthRowCount * MONTH_ROW_HEIGHT);
    const anchorMonth = anchorDate.getMonth();

    // ── FlatList scroll handling ──
    const handleScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const page = Math.round(offsetX / CALENDAR_WIDTH);

            if (page === 0) {
                const newAnchor = shiftWeek(anchorDate, -1);
                setAnchorDate(newAnchor);
                onWeekChange?.(getWeekRange(newAnchor).start);
                const prevRange = getWeekRange(shiftWeek(newAnchor, -1));
                fetchRange?.(prevRange.start, prevRange.end);
            } else if (page === 2) {
                const newAnchor = shiftWeek(anchorDate, 1);
                setAnchorDate(newAnchor);
                onWeekChange?.(getWeekRange(newAnchor).start);
                const nextRange = getWeekRange(shiftWeek(newAnchor, 1));
                fetchRange?.(nextRange.start, nextRange.end);
            }

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
            flatListRef.current?.scrollToOffset({ offset: CALENDAR_WIDTH, animated: false });
        }, 100);
    }, []);

    useEffect(() => {
        flatListRef.current?.scrollToOffset({ offset: CALENDAR_WIDTH, animated: false });
    }, [anchorDate]);

    // ── Month navigation ──
    const navigateMonth = useCallback(
        (direction: -1 | 1) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const next = shiftMonth(anchorDate, direction);
            setAnchorDate(next);
            const monthRange = getMonthRange(next);
            fetchRange?.(monthRange.start, monthRange.end);
        },
        [anchorDate, fetchRange],
    );

    // ── Toggle expand/collapse ──
    const toggleExpand = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const next = !expanded;
        setExpanded(next);
        expandProgress.value = withSpring(next ? 1 : 0, SPRING_CONFIG);

        if (next) {
            const monthRange = getMonthRange(anchorDate);
            fetchRange?.(monthRange.start, monthRange.end);
        }
    }, [expanded, anchorDate, fetchRange]);

    // ── Collapse and select date ──
    const collapseToDate = useCallback((date: Date) => {
        Haptics.selectionAsync();
        onDayPress(date);
        setExpanded(false);
        expandProgress.value = withSpring(0, SPRING_CONFIG);
    }, [onDayPress]);

    // ── Labels ──
    const weekRange = getWeekRange(anchorDate);
    const fmt = (d: Date) =>
        `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const weekLabel = `${fmt(weekRange.start)} — ${fmt(weekRange.end)}`;
    const monthLabel = anchorDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const todayKey = toDateKey(new Date());
    const isCurrentWeek = weeks[1]?.days.some((d) => d.dateKey === todayKey);
    const selectedKey = toDateKey(selectedDate);

    // ── Animated styles ──
    const chevronStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${interpolate(expandProgress.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` },
        ],
    }));

    const weekContainerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
        height: interpolate(expandProgress.value, [0, 1], [WEEK_ROW_HEIGHT, 0], Extrapolation.CLAMP),
        overflow: 'hidden' as const,
    }));

    const monthContainerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandProgress.value, [0.3, 0.7], [0, 1], Extrapolation.CLAMP),
        height: interpolate(
            expandProgress.value,
            [0, 1],
            [0, monthContentHeight],
            Extrapolation.CLAMP,
        ),
        overflow: 'hidden' as const,
    }));

    return (
        <View style={{ marginBottom: 24 }}>
            {/* ── Header: week label / month label + chevron ── */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                {!expanded ? (
                    // Week label
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
                                    Haptics.selectionAsync();
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
                ) : (
                    // Month navigation
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <TouchableOpacity onPress={() => navigateMonth(-1)} style={{ padding: 4 }}>
                            <ChevronLeft size={16} color="#94a3b8" />
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
                        <TouchableOpacity onPress={() => navigateMonth(1)} style={{ padding: 4 }}>
                            <ChevronRight size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Chevron toggle */}
                <TouchableOpacity onPress={toggleExpand} style={{ padding: 6 }}>
                    <Animated.View style={chevronStyle}>
                        <ChevronDown size={16} color="#94a3b8" />
                    </Animated.View>
                </TouchableOpacity>
            </View>

            {/* ── Week view (collapses to 0 height) ── */}
            <Animated.View style={weekContainerStyle}>
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
            </Animated.View>

            {/* ── Month view (expands from 0 height) ── */}
            <Animated.View style={monthContainerStyle}>
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
                    {monthGridDays.map((day) => {
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
                                    if (isClickable) collapseToDate(day.date);
                                }}
                                disabled={!isClickable}
                                style={{
                                    width: "14.285%",
                                    height: MONTH_ROW_HEIGHT,
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
            </Animated.View>
        </View>
    );
}
