import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react-native';

interface WorkoutNoteCardProps {
    note: string;
}

export function WorkoutNoteCard({ note }: WorkoutNoteCardProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCollapsed(!collapsed)}
            style={{
                backgroundColor: 'rgba(124, 58, 237, 0.06)',
                borderWidth: 1,
                borderColor: 'rgba(124, 58, 237, 0.12)',
                borderRadius: 16,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 12,
            }}
        >
            <StickyNote size={16} color="#8b5cf6" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
                <Text
                    numberOfLines={collapsed ? 1 : undefined}
                    className="text-sm text-slate-600"
                    style={{ lineHeight: 20 }}
                >
                    {note}
                </Text>
            </View>
            {collapsed ? (
                <ChevronDown size={14} color="#8b5cf6" style={{ marginTop: 2 }} />
            ) : (
                <ChevronUp size={14} color="#8b5cf6" style={{ marginTop: 2 }} />
            )}
        </TouchableOpacity>
    );
}
