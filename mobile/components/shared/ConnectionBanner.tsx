import React from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff, Wifi } from "lucide-react-native";
import { colors } from "@/theme";

interface ConnectionBannerProps {
  isConnected: boolean;
  wasDisconnected: boolean;
}

export function ConnectionBanner({
  isConnected,
  wasDisconnected,
}: ConnectionBannerProps) {
  const insets = useSafeAreaInsets();

  if (isConnected && !wasDisconnected) return null;

  const isReconnected = isConnected && wasDisconnected;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={{
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 9999,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
        paddingHorizontal: 16,
        gap: 8,
        backgroundColor: isReconnected
          ? colors.success.light
          : colors.warning.light,
      }}
    >
      {isReconnected ? (
        <Wifi size={14} color={colors.success.default} />
      ) : (
        <WifiOff size={14} color={colors.warning.default} />
      )}
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: isReconnected ? colors.success.default : colors.warning.default,
        }}
      >
        {isReconnected
          ? "Conexão restaurada"
          : "Sem conexão \u2014 dados podem estar desatualizados"}
      </Text>
    </Animated.View>
  );
}
