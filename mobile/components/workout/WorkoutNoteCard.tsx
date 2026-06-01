import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

interface WorkoutNoteCardProps {
    note: string;
}

export function WorkoutNoteCard({ note }: WorkoutNoteCardProps) {
    const colors = useV2Colors();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCollapsed(!collapsed)}
            style={{
                backgroundColor: toRgba(colors.purple[600], 0.06),
                borderWidth: 1,
                borderColor: toRgba(colors.purple[600], 0.12),
                borderRadius: 16,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 12,
            }}
        >
            <StickyNote size={16} color={colors.purple[500]} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
                <Text
                    numberOfLines={collapsed ? 1 : undefined}
                    style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20 }}
                >
                    {note}
                </Text>
            </View>
            {collapsed ? (
                <ChevronDown size={14} color={colors.purple[500]} style={{ marginTop: 2 }} />
            ) : (
                <ChevronUp size={14} color={colors.purple[500]} style={{ marginTop: 2 }} />
            )}
        </TouchableOpacity>
    );
}
