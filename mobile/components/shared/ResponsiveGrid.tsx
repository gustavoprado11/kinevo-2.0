import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: { phone: number; tablet: number; tabletLandscape?: number };
  gap?: number;
  style?: ViewStyle;
}

export function ResponsiveGrid({
  children,
  columns = { phone: 1, tablet: 2 },
  gap = 10,
  style,
}: ResponsiveGridProps) {
  const { isTablet, isLandscape, width: screenWidth } = useResponsive();

  const colCount = isTablet
    ? (isLandscape && columns.tabletLandscape ? columns.tabletLandscape : columns.tablet)
    : columns.phone;

  const childArray = React.Children.toArray(children);

  if (colCount === 1) {
    return (
      <View style={[{ gap }, style]}>
        {childArray}
      </View>
    );
  }

  // For multi-column, use flexDirection row with flex children
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < childArray.length; i += colCount) {
    rows.push(childArray.slice(i, i + colCount));
  }

  return (
    <View style={[{ gap }, style]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap }}>
          {row.map((child, colIndex) => (
            <View key={colIndex} style={{ flex: 1 }}>
              {child}
            </View>
          ))}
          {/* Fill empty slots in last row to maintain alignment */}
          {row.length < colCount &&
            Array.from({ length: colCount - row.length }).map((_, i) => (
              <View key={`empty-${i}`} style={{ flex: 1 }} />
            ))}
        </View>
      ))}
    </View>
  );
}
