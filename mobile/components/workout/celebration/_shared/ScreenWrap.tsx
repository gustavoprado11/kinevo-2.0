import React from 'react';
import { View, Image, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CELEB_TOKENS } from './tokens';

const GRAIN = require('../../../../assets/share-grain.png');

// Fundo light + radial wash quente no topo + grain de papel sub-perceptível
// (mesmo tile dos cards de compartilhamento, opacidade bem baixa).
export function ScreenWrap({ tintTop, children }: { tintTop: string; children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: CELEB_TOKENS.canvas }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="celebWash" cx="50%" cy="0%" rx="80%" ry="42%">
            <Stop offset="0" stopColor={tintTop} stopOpacity={1} />
            <Stop offset="0.6" stopColor={tintTop} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#celebWash)" />
      </Svg>
      <Image
        source={GRAIN}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { opacity: 0.035 }]}
      />
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {children}
      </View>
    </View>
  );
}
