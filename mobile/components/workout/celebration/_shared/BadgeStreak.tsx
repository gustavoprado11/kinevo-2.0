import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { CELEB_TOKENS as T, CFONT } from './tokens';

type Kind = 'card' | 'pill' | 'chip';

export function BadgeStreak({ days, kind = 'card' }: { days: number; kind?: Kind }) {
  if (kind === 'card') {
    return (
      <View style={[s.card, { backgroundColor: T.brandSoft, borderColor: T.brandSoftBorder }]}>
        <Flame size={18} color={T.brand} strokeWidth={2} />
        <Text numberOfLines={1} style={s.cardTitle}>{days} dias</Text>
        <Text numberOfLines={1} style={s.cardSub}>seguidos</Text>
      </View>
    );
  }
  if (kind === 'pill') {
    return (
      <View style={[s.pill, { backgroundColor: T.brandSoft, borderColor: T.brandSoftBorder }]}>
        <Flame size={11} color={T.brandSoftText} strokeWidth={2.4} />
        <Text style={[s.pillText, { color: T.brandSoftText }]}>{days} dias seguidos</Text>
      </View>
    );
  }
  return (
    <View style={[s.chip, { backgroundColor: T.brandSoft, borderColor: T.brandSoftBorder }]}>
      <Flame size={10} color={T.brandSoftText} strokeWidth={2.4} />
      <Text style={[s.chipText, { color: T.brandSoftText }]}>{days} dias</Text>
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
