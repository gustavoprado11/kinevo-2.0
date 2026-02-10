import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface WeekCalendarProps {
    days: {
        date: Date;
        dayName: string; // "Dom", "Seg", etc.
        dayNumber: number; // 1, 2, ...
        isToday: boolean;
        status: 'done' | 'missed' | 'scheduled' | 'rest';
    }[];
    onDayPress: (date: Date) => void;
}

const STATUS_COLORS: Record<string, string> = {
    done: '#34d399',     // emerald-400
    missed: '#f87171',   // red-400
    scheduled: '#475569', // slate-600
    rest: 'transparent',
};

export function WeekCalendar({ days, onDayPress, selectedDate }: { days: any[], onDayPress: (date: Date) => void, selectedDate: Date }) {
    return (
        <View className="flex-row justify-between mb-6">
            {days.map((day, index) => {
                const isSelected = day.date.getDate() === selectedDate.getDate() &&
                    day.date.getMonth() === selectedDate.getMonth() &&
                    day.date.getFullYear() === selectedDate.getFullYear();

                const isToday = day.isToday;

                return (
                    <TouchableOpacity
                        key={index}
                        onPress={() => onDayPress(day.date)}
                        className="items-center"
                        style={{ width: 40 }}
                        activeOpacity={0.7}
                    >
                        {/* Week day letter */}
                        <Text
                            style={{
                                fontSize: 10,
                                letterSpacing: 3,
                                textTransform: 'uppercase',
                                marginBottom: 10,
                                fontWeight: isSelected ? '600' : isToday ? '500' : '400',
                                color: isSelected
                                    ? '#a78bfa'   // violet-400
                                    : isToday
                                        ? '#7c3aed' // violet-600
                                        : '#475569', // slate-600
                            }}
                        >
                            {day.dayName}
                        </Text>

                        {/* Day number with circle indicator */}
                        <View style={{ alignItems: 'center' }}>
                            <View
                                style={{
                                    height: 36,
                                    width: 36,
                                    borderRadius: 18,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isSelected ? '#7c3aed' : 'transparent',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        fontWeight: isSelected ? '700' : isToday ? '600' : '400',
                                        color: isSelected
                                            ? '#ffffff'
                                            : isToday
                                                ? '#cbd5e1' // slate-300
                                                : '#64748b', // slate-500
                                    }}
                                >
                                    {day.dayNumber}
                                </Text>
                            </View>

                            {/* Status Dot - centered below circle */}
                            <View
                                style={{
                                    marginTop: 6,
                                    height: 5,
                                    width: 5,
                                    borderRadius: 3,
                                    backgroundColor: STATUS_COLORS[day.status] || 'transparent',
                                }}
                            />
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
