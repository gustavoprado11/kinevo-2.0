import React from 'react';
import { View } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface FormRowProps {
    children: React.ReactNode;
    columns?: number;
    gap?: number;
}

export function FormRow({ children, columns, gap = 12 }: FormRowProps) {
    const { isTablet } = useResponsive();
    const effectiveCols = columns ?? (isTablet ? 2 : 1);

    if (effectiveCols === 1) {
        return <View style={{ gap }}>{children}</View>;
    }

    const childArray = React.Children.toArray(children);

    return (
        <View style={{ flexDirection: 'row', gap }}>
            {childArray.map((child, index) => (
                <View key={index} style={{ flex: 1 }}>
                    {child}
                </View>
            ))}
        </View>
    );
}
