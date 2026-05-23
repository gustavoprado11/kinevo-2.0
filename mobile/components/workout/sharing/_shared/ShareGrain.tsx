// Grain de papel (textura sutil sobre o card).
//
// O mock (share-cards.jsx) usa SVG `feTurbulence` com mix-blend-mode: multiply —
// que o React Native não suporta. Aqui usamos um tile de ruído PNG (128×128
// grayscale, ~16KB) repetido em baixa opacidade (0.04–0.06). Efeito
// sub-perceptível, só pra quebrar a "chapa" digital do fundo claro.
import React from 'react';
import { Image, StyleSheet } from 'react-native';

const GRAIN = require('../../../../assets/share-grain.png');

export function ShareGrain({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <Image
      source={GRAIN}
      resizeMode="repeat"
      style={[StyleSheet.absoluteFillObject, { opacity }]}
    />
  );
}
