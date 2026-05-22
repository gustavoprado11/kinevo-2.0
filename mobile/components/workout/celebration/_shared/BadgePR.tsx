import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { CELEB_TOKENS as T, CFONT } from './tokens';

type Kind = 'card' | 'pill' | 'chip';

export function BadgePR({ count, kind = 'card' }: { count: number; kind?: Kind }) {
  if (kind === 'card') {
    return (
      <View style={[s.card, { backgroundColor: T.goldBg, borderColor: T.goldBorderStrong }]}>
        <Trophy size={18} color="#9A6B11" strokeWidth={2} />
        <Text numberOfLines={1} style={s.cardTitle}>{count} {count === 1 ? 'recorde' : 'recordes'}</Text>
        <Text numberOfLines={1} style={s.cardSub}>{count === 1 ? 'pessoal' : 'pessoais'}</Text>
      </View>
    );
  }
  if (kind === 'pill') {
    return (
      <View style={[s.pill, { backgroundColor: '#FFFFFF', borderColor: T.goldBorder }]}>
        <Trophy size={11} color={T.goldText} strokeWidth={2.4} />
        <Text style={[s.pillText, { color: T.goldText }]}>{count} recordes pessoais</Text>
      </View>
    );
  }
  return (
    <View style={[s.chip, { backgroundColor: T.goldBg, borderColor: T.goldBorder }]}>
      <Trophy size={10} color={T.goldText} strokeWidth={2.4} />
      <Text style={[s.chipText, { color: T.goldText }]}>{count} recordes</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 12 },
  cardTitle: { fontFamily: CFONT.bold, fontSize: 14, color: T.textPrimary, lineHeight: 16 },
  cardSub: { fontFamily: CFONT.medium, fontSize: 10.5, color: T.textSecondary, marginTop: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, paddingHorizontal: 11 },
  pillText: { fontFamily: CFONT.bold, fontSize: 11 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 4, paddingHorizontal: 8 },
  chipText: { fontFamily: CFONT.bold, fontSize: 10.5 },
});
