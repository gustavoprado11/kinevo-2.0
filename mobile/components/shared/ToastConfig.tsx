import React from "react";
import { View, Text } from "react-native";
import { CheckCircle, AlertCircle, Info } from "lucide-react-native";
import type { ToastConfig } from "react-native-toast-message";
import { useV2Colors } from "../../hooks/useV2Colors";

const BASE_STYLE = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 12,
  borderLeftWidth: 4,
  marginHorizontal: 16,
  gap: 10,
  borderWidth: 1,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

type Variant = "success" | "error" | "info";

const ACCENT: Record<
  Variant,
  { borderLeft: string; icon: string; title: string; subtitle: string }
> = {
  success: {
    borderLeft: "#16a34a",
    icon: "#16a34a",
    title: "#15803d",
    subtitle: "#166534",
  },
  error: {
    borderLeft: "#ef4444",
    icon: "#ef4444",
    title: "#dc2626",
    subtitle: "#991b1b",
  },
  info: {
    borderLeft: "#7c3aed",
    icon: "#7c3aed",
    title: "#6d28d9",
    subtitle: "#5b21b6",
  },
};

/**
 * ToastBody — renderiza o conteúdo de um toast variante.
 *
 * Bg/border base via useV2Colors() (adapta light/dark).
 * Cores de acento (border-left, ícone, título, sub) ficam fixas
 * — são identidade do toast, leem bem em ambos os modos sobre
 * surface.card.
 */
function ToastBody({
  variant,
  text1,
  text2,
}: {
  variant: Variant;
  text1?: string;
  text2?: string;
}) {
  const colors = useV2Colors();
  const accent =
    variant === "info"
      ? {
          borderLeft: colors.purple[600],
          icon: colors.purple[600],
          title: colors.purple[700],
          subtitle: colors.purple[800],
        }
      : ACCENT[variant];
  const Icon =
    variant === "success" ? CheckCircle : variant === "error" ? AlertCircle : Info;

  return (
    <View
      style={{
        ...BASE_STYLE,
        backgroundColor: colors.surface.card,
        borderColor: colors.border.default,
        borderLeftColor: accent.borderLeft,
      }}
    >
      <Icon size={20} color={accent.icon} />
      <View style={{ flex: 1 }}>
        {text1 ? (
          <Text style={{ fontSize: 14, fontWeight: "600", color: accent.title }}>
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text
            style={{ fontSize: 12, color: accent.subtitle, marginTop: 2 }}
            numberOfLines={2}
          >
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <ToastBody variant="success" text1={text1} text2={text2} />
  ),
  error: ({ text1, text2 }) => (
    <ToastBody variant="error" text1={text1} text2={text2} />
  ),
  info: ({ text1, text2 }) => (
    <ToastBody variant="info" text1={text1} text2={text2} />
  ),
};
