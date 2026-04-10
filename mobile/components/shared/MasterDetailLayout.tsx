import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme';

interface MasterDetailLayoutProps {
  masterContent: React.ReactNode;
  detailContent: React.ReactNode | null;
  masterWidthPercent?: number;
  placeholder?: React.ReactNode;
  showDivider?: boolean;
  style?: ViewStyle;
}

export function MasterDetailLayout({
  masterContent,
  detailContent,
  masterWidthPercent = 35,
  placeholder,
  showDivider = true,
  style,
}: MasterDetailLayoutProps) {
  const { isPhone } = useResponsive();

  if (isPhone) {
    return <>{masterContent}</>;
  }

  return (
    <View style={[{ flexDirection: 'row', flex: 1 }, style]}>
      <View style={{ width: `${masterWidthPercent}%` as any }}>
        {masterContent}
      </View>
      {showDivider && (
        <View style={{ width: 1, backgroundColor: colors.border.primary }} />
      )}
      <View style={{ flex: 1 }}>
        {detailContent ?? placeholder ?? null}
      </View>
    </View>
  );
}
