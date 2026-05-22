import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SHARE_TOKENS } from './tokens';

// Stripe gradiente 3px no topo (T1, T4, T5).
export function ShareAccentStripe() {
  return (
    <LinearGradient
      colors={[...SHARE_TOKENS.brandStripe]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 2 }}
    />
  );
}
