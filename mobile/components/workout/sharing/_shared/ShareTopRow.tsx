import React from 'react';
import { View, Text } from 'react-native';
import { KMark } from './KMark';
import { SHARE_TOKENS, FONT } from './tokens';

// Linha superior: K-mark + label à esquerda, data à direita.
export function ShareTopRow({ label, date }: { label: string; date: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <KMark size={20} />
        <Text
          numberOfLines={1}
          style={{ fontFamily: FONT.semibold, fontSize: 11, color: SHARE_TOKENS.textSecondary, letterSpacing: 0.1 }}
        >
          {label}
        </Text>
      </View>
      <Text style={{ fontFamily: FONT.medium, fontSize: 11, color: SHARE_TOKENS.textSecondary }}>
        {date}
      </Text>
    </View>
  );
}
