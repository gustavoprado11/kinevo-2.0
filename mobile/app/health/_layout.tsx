// Fase 14d — Stack pra rotas de detalhe de saúde (`/health/[metric]`).
import { Stack } from 'expo-router';
import React from 'react';

export default function HealthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        animation: 'slide_from_right',
      }}
    />
  );
}
