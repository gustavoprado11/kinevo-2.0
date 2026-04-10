import React from "react";
import { View, Text } from "react-native";
import { CheckCircle, AlertCircle, Info } from "lucide-react-native";
import type { ToastConfig } from "react-native-toast-message";

const BASE_STYLE = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 12,
  borderLeftWidth: 4,
  marginHorizontal: 16,
  gap: 10,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <View
      style={{
        ...BASE_STYLE,
        backgroundColor: "#f0fdf4",
        borderLeftColor: "#16a34a",
      }}
    >
      <CheckCircle size={20} color="#16a34a" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#15803d" }}>
          {text1}
        </Text>
        {text2 ? (
          <Text
            style={{ fontSize: 12, color: "#166534", marginTop: 2 }}
            numberOfLines={2}
          >
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  ),

  error: ({ text1, text2 }) => (
    <View
      style={{
        ...BASE_STYLE,
        backgroundColor: "#fef2f2",
        borderLeftColor: "#ef4444",
      }}
    >
      <AlertCircle size={20} color="#ef4444" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#dc2626" }}>
          {text1}
        </Text>
        {text2 ? (
          <Text
            style={{ fontSize: 12, color: "#991b1b", marginTop: 2 }}
            numberOfLines={2}
          >
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  ),

  info: ({ text1, text2 }) => (
    <View
      style={{
        ...BASE_STYLE,
        backgroundColor: "#f5f3ff",
        borderLeftColor: "#7c3aed",
      }}
    >
      <Info size={20} color="#7c3aed" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#6d28d9" }}>
          {text1}
        </Text>
        {text2 ? (
          <Text
            style={{ fontSize: 12, color: "#5b21b6", marginTop: 2 }}
            numberOfLines={2}
          >
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  ),
};
