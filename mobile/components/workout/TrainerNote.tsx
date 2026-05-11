import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import { useV2Colors } from '../../hooks/useV2Colors';

interface TrainerNoteProps {
    note: string;
}

export function TrainerNote({ note }: TrainerNoteProps) {
    const colors = useV2Colors();
    const [expanded, setExpanded] = useState(false);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setExpanded(!expanded)}
            style={{
                backgroundColor: 'rgba(124, 58, 237, 0.08)',
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: 8,
            }}
        >
            <MessageSquare size={14} color="#8b5cf6" style={{ marginTop: 1 }} />
            <Text
                numberOfLines={expanded ? undefined : 2}
                style={{ fontSize: 14, color: colors.text.secondary, flex: 1, lineHeight: 20 }}
            >
                {note}
            </Text>
        </TouchableOpacity>
    );
}
