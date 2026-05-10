// Reexporta tokens de shadow do shared, embrulhando em Platform.select para preservar
// a API original (objeto pronto pra spread em estilo RN).
// Source of truth: shared/tokens/legacy/shadows.ts.

import { Platform } from "react-native";
import { shadows as sharedShadows } from "@kinevo/shared/tokens";

const pickPlatform = <K extends 'sm' | 'md' | 'lg'>(key: K) =>
  Platform.OS === 'ios' ? sharedShadows[key].ios : sharedShadows[key].android;

export const shadows = {
  sm: pickPlatform('sm'),
  md: pickPlatform('md'),
  lg: pickPlatform('lg'),
} as const;
