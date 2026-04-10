import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';

interface TabConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  badge?: number;
}

interface SidebarNavItemProps {
  tab: TabConfig;
  active: boolean;
  expanded: boolean;
  onPress: () => void;
}

export function SidebarNavItem({ tab, active, expanded, onPress }: SidebarNavItemProps) {
  const Icon = tab.icon;
  const iconColor = active ? colors.brand.primary : colors.text.secondary;

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(expanded ? 1 : 0, { duration: 150 }),
    width: expanded ? 'auto' : 0,
    overflow: 'hidden' as const,
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: expanded ? 14 : 0,
        marginHorizontal: expanded ? 10 : 6,
        borderRadius: 12,
        backgroundColor: active ? colors.brand.primaryLight : 'transparent',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: expanded ? 12 : 0,
        minHeight: 44,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Icon size={22} color={iconColor} strokeWidth={active ? 2.5 : 1.5} />
        {!!tab.badge && tab.badge > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -8,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: '#ef4444',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#ffffff' }}>
              {tab.badge > 99 ? '99+' : tab.badge}
            </Text>
          </View>
        )}
      </View>
      {expanded && (
        <Animated.Text
          style={[
            {
              fontSize: 14,
              fontWeight: active ? '600' : '400',
              color: active ? colors.brand.primary : colors.text.primary,
            },
            labelStyle,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Animated.Text>
      )}
    </TouchableOpacity>
  );
}
