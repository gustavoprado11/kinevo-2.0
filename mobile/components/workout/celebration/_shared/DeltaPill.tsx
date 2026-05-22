import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUp } from 'lucide-react-native';
import { CELEB_TOKENS as T, CFONT } from './tokens';

type Kind = 'pill' | 'text' | 'chip';

export function DeltaPill({ pct, kind = 'pill' }: { pct: number; kind?: Kind }) {
  if (kind === 'text') {
    return (
      <View style={s.textRow}>
        <ArrowUp size={12} color={T.successText} strokeWidth={2.5} />
        <Text style={s.textValue}>Volume +{pct}% vs último treino</Text>
      </View>
    );
  }
  if (kind === 'chip') {
    return (
      <View style={[s.chip, { backgroundColor: T.successBg, borderColor: T.successBorder }]}>
        <ArrowUp size={10} color={T.successText} strokeWidth={2.5} />
        <Text style={[s.chipText, { color: T.successText }]}>+{pct}% volume</Text>
      </View>
    );
  }
  return (
    <View style={[s.pill, { backgroundColor: T.successBg, borderColor: T.successBorder }]}>
      <ArrowUp size={11} color={T.successText} strokeWidth={2.5} />
      <Text style={[s.pillText, { color: T.successText }]}>Volume +{pct}% vs último treino</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'center' },
  pillText: { fontFamily: CFONT.bold, fontSize: 12 },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  textValue: { fontFamily: CFONT.bold, fontSize: 13, color: T.successText },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 4, paddingHorizontal: 8 },
  chipText: { fontFamily: CFONT.bold, fontSize: 10.5 },
});
