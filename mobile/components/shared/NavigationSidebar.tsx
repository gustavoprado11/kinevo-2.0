import React from 'react';
import { View, Text, Image } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SidebarNavItem } from './SidebarNavItem';
import { colors } from '@/theme';

export interface TabConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  badge?: number;
}

interface NavigationSidebarProps {
  expanded: boolean;
  tabs: TabConfig[];
  activeTab: string;
  onTabPress: (tabKey: string) => void;
  trainerName?: string;
  trainerAvatar?: string | null;
}

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 68;

export function NavigationSidebar({
  expanded,
  tabs,
  activeTab,
  onTabPress,
  trainerName,
  trainerAvatar,
}: NavigationSidebarProps) {
  const insets = useSafeAreaInsets();

  const containerStyle = useAnimatedStyle(() => ({
    width: withTiming(expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH, { duration: 200 }),
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.background.card,
          borderRightWidth: 1,
          borderRightColor: colors.border.primary,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          justifyContent: 'flex-start',
        },
        containerStyle,
      ]}
    >
      {/* Avatar / Profile section */}
      <View style={{ alignItems: 'center', marginBottom: 24, paddingHorizontal: 10 }}>
        {trainerAvatar ? (
          <Image
            source={{ uri: trainerAvatar }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.brand.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.brand.primary }}>
              {trainerName?.[0]?.toUpperCase() ?? 'K'}
            </Text>
          </View>
        )}
        {expanded && trainerName && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.text.primary,
              marginTop: 8,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {trainerName}
          </Text>
        )}
      </View>

      {/* Nav items */}
      <View style={{ gap: 4 }}>
        {tabs.map((tab) => (
          <SidebarNavItem
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            expanded={expanded}
            onPress={() => onTabPress(tab.key)}
          />
        ))}
      </View>
    </Animated.View>
  );
}
