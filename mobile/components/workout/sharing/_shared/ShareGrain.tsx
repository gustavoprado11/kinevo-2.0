// Grain de papel (textura sutil sobre o card).
//
// O mock (share-cards.jsx) usa SVG `feTurbulence` com opacity ~0.05 e
// mix-blend-mode: multiply. No React Native:
//   - mix-blend-mode NÃO existe;
//   - <FeTurbulence> do react-native-svg tem suporte instável/aliasing ruim.
// O efeito é sub-perceptível (opacity 0.04–0.06). Render no-op por enquanto
// para não introduzir artefatos. Para ligar: dropar um PNG de ruído em
// `assets/share-grain.png` (240×240 grayscale) e trocar por:
//
//   <Image source={require('../../../../assets/share-grain.png')}
//     style={{ position:'absolute', inset:0, opacity }} resizeMode="repeat" />
//
import React from 'react';

export function ShareGrain(_props: { opacity?: number }) {
  return null;
}
