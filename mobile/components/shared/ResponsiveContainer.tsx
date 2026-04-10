import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface Props {
  children: React.ReactNode;
  maxWidth?: number;
  padding?: boolean;
  style?: ViewStyle;
}

export function ResponsiveContainer({ children, maxWidth, padding = true, style }: Props) {
  const { contentMaxWidth, isTablet } = useResponsive();
  const effectiveMaxWidth = maxWidth ?? contentMaxWidth;
  const screenPadding = isTablet ? 32 : 20;

  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: effectiveMaxWidth,
          alignSelf: 'center',
        },
        padding && { paddingHorizontal: screenPadding },
        style,
      ]}
    >
      {children}
    </View>
  );
}
