import React from 'react';
import { ScrollView, Text } from 'react-native';
import { PressableScale } from '../../shared/PressableScale';
import { colors } from '@/theme';
import type { NotificationFilter } from '../../../hooks/useTrainerNotifications';

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

interface FilterChipProps {
    label: string;
    active: boolean;
    onPress: () => void;
}

function FilterChip({ label, active, onPress }: FilterChipProps) {
    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.95}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filtro ${label}`}
            style={{
                backgroundColor: active ? colors.brand.primary : colors.background.card,
                borderRadius: 100,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginRight: 8,
                borderWidth: 1,
                borderColor: active ? colors.brand.primary : 'rgba(0,0,0,0.06)',
                minHeight: 36,
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: '600',
                    lineHeight: 16,
                    color: active ? colors.text.inverse : '#475569',
                }}
            >
                {label}
            </Text>
        </PressableScale>
    );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

interface NotificationFiltersProps {
    filter: NotificationFilter;
    setFilter: (filter: NotificationFilter) => void;
}

const chips: { key: NotificationFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'students', label: 'Alunos' },
    { key: 'forms', label: 'Formulários' },
    { key: 'payments', label: 'Pagamentos' },
    { key: 'programs', label: 'Programas' },
];

export function NotificationFilters({ filter, setFilter }: NotificationFiltersProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}
        >
            {chips.map((chip) => (
                <FilterChip
                    key={chip.key}
                    label={chip.label}
                    active={filter === chip.key}
                    onPress={() => setFilter(chip.key)}
                />
            ))}
        </ScrollView>
    );
}
