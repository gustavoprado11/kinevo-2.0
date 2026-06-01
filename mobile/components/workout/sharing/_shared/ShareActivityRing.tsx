import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { useShareTokens } from './tokens';

// Anel concêntrico decorativo estilo Apple Activity (T3).
// Valores de dasharray fixos (decorativo) — ref share-cards.jsx.
export function ShareActivityRing({ size = 58 }: { size?: number }) {
  const bt = useShareTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 58 58">
      {/* tracks */}
      <Circle cx="29" cy="29" r="25" fill="none" stroke="#FFE5E2" strokeWidth="4" />
      <Circle cx="29" cy="29" r="19" fill="none" stroke="#E8DFFE" strokeWidth="4" />
      <Circle cx="29" cy="29" r="13" fill="none" stroke="#D6F0DC" strokeWidth="4" />
      {/* arcs */}
      <Circle cx="29" cy="29" r="25" fill="none" stroke="#FF3B30" strokeWidth="4" strokeDasharray="148 9" strokeLinecap="round" transform="rotate(-90 29 29)" />
      <Circle cx="29" cy="29" r="19" fill="none" stroke={bt.ringViolet} strokeWidth="4" strokeDasharray="115 5" strokeLinecap="round" transform="rotate(-90 29 29)" />
      <Circle cx="29" cy="29" r="13" fill="none" stroke="#16A34A" strokeWidth="4" strokeDasharray="78 4" strokeLinecap="round" transform="rotate(-90 29 29)" />
    </Svg>
  );
}
