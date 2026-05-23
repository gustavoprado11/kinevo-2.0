import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, useWindowDimensions, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Award, Flame, Dumbbell, Star } from 'lucide-react-native';
import { AchievementCard } from '../../components/achievements/AchievementCard';
import { useAchievements } from '../../hooks/useAchievements';
import { useStudentProfile } from '../../hooks/useStudentProfile';
import { useV2Colors } from '../../hooks/useV2Colors';

export default function AchievementsScreen() {
    const colors = useV2Colors();
    const insets = useSafeAreaInsets();
    const { profile } = useStudentProfile();
    const a = useAchievements(profile?.id);
    const { width } = useWindowDimensions();
    const cardW = (width - 16 * 2 - 12) / 2;
    const milestoneTarget = Math.max(25, Math.ceil((a.totalWorkouts + 1) / 25) * 25);

    return (
        <View style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
            <Stack.Screen options={{ title: 'Conquistas' }} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
                <Text style={[styles.intro, { color: colors.text.tertiary }]}>
                    Marcos da sua jornada. Novas conquistas desbloqueiam conforme você treina.
                </Text>

                {a.loading ? (
                    <View style={{ paddingTop: 60, alignItems: 'center' }}>
                        <ActivityIndicator color="#7c3aed" />
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
                        <AchievementCard
                            icon={Award}
                            gold
                            width={cardW}
                            title={a.perfectWeeks > 0 ? (a.perfectWeeks === 1 ? '1 semana' : `${a.perfectWeeks} semanas`) : 'Semana perfeita'}
                            subtitle={
                                a.perfectWeeksConsecutive > 1
                                    ? `perfeitas · ${a.perfectWeeksConsecutive}ª seguida`
                                    : a.perfectWeeks > 0 ? 'perfeitas' : 'feche a semana'
                            }
                            locked={a.perfectWeeks === 0}
                        />
                        <AchievementCard
                            icon={Flame}
                            width={cardW}
                            title={a.weekStreak >= 2 ? `${a.weekStreak} semanas` : 'Comece um streak'}
                            subtitle={a.weekStreak >= 2 ? 'seguidas com treino' : 'treine 2 semanas'}
                            locked={a.weekStreak < 2}
                        />
                        <AchievementCard
                            icon={Dumbbell}
                            width={cardW}
                            title={`${a.totalWorkouts} treinos`}
                            subtitle="concluídos no total"
                            locked={a.totalWorkouts === 0}
                        />
                        <AchievementCard
                            icon={Star}
                            width={cardW}
                            title={`${a.totalWorkouts}/${milestoneTarget}`}
                            subtitle="rumo ao próximo marco"
                            locked={a.totalWorkouts < milestoneTarget}
                        />
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    intro: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 19 },
});
