import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Trophy, ChevronDown, ChevronUp, Flame, Check, Clock, Dumbbell, Repeat } from 'lucide-react-native';
import { useWorkoutHistory, HistorySession, HistoryStats } from '../../hooks/useWorkoutHistory';

export default function LogsScreen() {
    const [activeTab, setActiveTab] = useState<'history' | 'performance'>('history');
    const { history, stats, isLoading } = useWorkoutHistory();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0D0D17' }} edges={['top']}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9' }}>
                    Histórico de Treinos
                </Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    Acompanhe sua evolução
                </Text>
            </View>

            {/* Segmented Control */}
            <View
                style={{
                    marginHorizontal: 20,
                    marginVertical: 16,
                    backgroundColor: '#1A1A2E',
                    borderRadius: 14,
                    padding: 4,
                    flexDirection: 'row',
                }}
            >
                <Pressable
                    onPress={() => setActiveTab('history')}
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 10,
                        borderRadius: 11,
                        gap: 8,
                        backgroundColor: activeTab === 'history' ? '#7c3aed' : 'transparent',
                    }}
                >
                    <Calendar size={16} color={activeTab === 'history' ? '#fff' : '#64748b'} />
                    <Text
                        style={{
                            fontSize: 13,
                            fontWeight: '600',
                            letterSpacing: 0.5,
                            color: activeTab === 'history' ? '#fff' : '#64748b',
                        }}
                    >
                        Histórico
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => setActiveTab('performance')}
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 10,
                        borderRadius: 11,
                        gap: 8,
                        backgroundColor: activeTab === 'performance' ? '#7c3aed' : 'transparent',
                    }}
                >
                    <Trophy size={16} color={activeTab === 'performance' ? '#fff' : '#64748b'} />
                    <Text
                        style={{
                            fontSize: 13,
                            fontWeight: '600',
                            letterSpacing: 0.5,
                            color: activeTab === 'performance' ? '#fff' : '#64748b',
                        }}
                    >
                        Desempenho
                    </Text>
                </Pressable>
            </View>

            {/* Content */}
            <ScrollView
                style={{ flex: 1, paddingHorizontal: 20 }}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {isLoading ? (
                    <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 40 }}>
                        Carregando histórico...
                    </Text>
                ) : activeTab === 'history' ? (
                    <HistoryList history={history} />
                ) : (
                    <PerformanceView stats={stats} />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

/* ─── History Tab ─── */

function HistoryList({ history }: { history: HistorySession[] }) {
    if (!history.length) {
        return (
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80 }}>
                <View
                    style={{
                        width: 64,
                        height: 64,
                        backgroundColor: '#1A1A2E',
                        borderRadius: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                    }}
                >
                    <Calendar size={28} color="#64748b" />
                </View>
                <Text style={{ color: '#64748b', textAlign: 'center', fontSize: 14 }}>
                    Nenhum treino registrado ainda.
                </Text>
            </View>
        );
    }

    return (
        <View>
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.45)',
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    marginBottom: 16,
                }}
            >
                Últimas Atividades
            </Text>
            {history.map(session => (
                <HistoryCard key={session.id} session={session} />
            ))}
        </View>
    );
}

function HistoryCard({ session }: { session: HistorySession }) {
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
        setExpanded(!expanded);
    };

    const dateStr = new Date(session.completed_at).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).toUpperCase();

    const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

    return (
        <View
            style={{
                backgroundColor: '#1A1A2E',
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 14,
            }}
        >
            {/* Header (Always Visible) */}
            <Pressable onPress={toggleExpand}>
                <View style={{ padding: 20 }}>
                    {/* Title row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#e2e8f0' }}>
                                    {session.workout_name}
                                </Text>
                                {session.is_intense && (
                                    <View
                                        style={{
                                            backgroundColor: 'rgba(249,115,22,0.1)',
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                            borderRadius: 8,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <Flame size={10} color="#f97316" fill="#f97316" />
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#f97316', letterSpacing: 1 }}>
                                            INTENSO
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '500', marginTop: 4, letterSpacing: 0.5 }}>
                                {dateStr}
                            </Text>
                        </View>
                        {expanded
                            ? <ChevronUp size={18} color="#64748b" />
                            : <ChevronDown size={18} color="#64748b" />
                        }
                    </View>

                    {/* Metrics Row */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 14,
                            paddingTop: 14,
                            borderTopWidth: 1,
                            borderTopColor: 'rgba(255,255,255,0.05)',
                            gap: 20,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Clock size={13} color="#64748b" />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#cbd5e1' }}>
                                {Math.floor(session.duration_seconds / 60)}
                            </Text>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>min</Text>
                        </View>

                        <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.08)' }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Dumbbell size={13} color="#64748b" />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#cbd5e1' }}>
                                {(session.volume_load / 1000).toFixed(1)}
                            </Text>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>ton</Text>
                        </View>

                        <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.08)' }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Repeat size={13} color="#64748b" />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#cbd5e1' }}>
                                {totalSets}
                            </Text>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>séries</Text>
                        </View>
                    </View>
                </View>
            </Pressable>

            {/* Expanded Content (Exercises) */}
            {expanded && (
                <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                    {session.exercises.map((exercise, idx) => (
                        <View
                            key={exercise.id}
                            style={{
                                marginTop: idx === 0 ? 0 : 16,
                                paddingTop: idx === 0 ? 0 : 16,
                                borderTopWidth: idx === 0 ? 0 : 1,
                                borderTopColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            {/* Exercise name */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <View
                                    style={{
                                        width: 3,
                                        height: 16,
                                        backgroundColor: '#7c3aed',
                                        borderRadius: 2,
                                        marginRight: 10,
                                    }}
                                />
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#e2e8f0', flex: 1 }}>
                                    {exercise.name}
                                </Text>
                            </View>

                            {/* Sets */}
                            <View style={{ gap: 6, paddingLeft: 13 }}>
                                {exercise.sets.map((set, setIdx) => (
                                    <View
                                        key={set.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            paddingVertical: 10,
                                            paddingHorizontal: 12,
                                            borderRadius: 10,
                                        }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#7c3aed', width: 28 }}>
                                            #{setIdx + 1}
                                        </Text>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#e2e8f0', width: 72, textAlign: 'center' }}>
                                            {set.weight}kg
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', width: 56, textAlign: 'right' }}>
                                            {set.reps} reps
                                        </Text>
                                        <View style={{ width: 20, alignItems: 'flex-end' }}>
                                            {set.completed && <Check size={14} color="#34d399" strokeWidth={2.5} />}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

/* ─── Performance Tab ─── */

function PerformanceView({ stats }: { stats: HistoryStats }) {
    return (
        <View>
            {/* Jornada Card */}
            <View
                style={{
                    backgroundColor: 'rgba(124,58,237,0.08)',
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 28,
                }}
            >
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#a78bfa',
                        textTransform: 'uppercase',
                        letterSpacing: 2,
                        marginBottom: 20,
                    }}
                >
                    Sua Jornada
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 }}>
                            {stats.totalWorkouts}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '500' }}>
                            Treinos
                        </Text>
                    </View>
                    <View
                        style={{
                            alignItems: 'center',
                            flex: 1,
                            borderLeftWidth: 1,
                            borderRightWidth: 1,
                            borderColor: 'rgba(124,58,237,0.1)',
                        }}
                    >
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 }}>
                            {stats.totalVolume.toFixed(0)}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '500' }}>
                            Toneladas
                        </Text>
                    </View>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 }}>
                            {stats.totalHours}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '500' }}>
                            Horas
                        </Text>
                    </View>
                </View>
            </View>

            {/* Recordes Pessoais */}
            <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: 'rgba(255,255,255,0.45)',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                        }}
                    >
                        Recordes Pessoais
                    </Text>
                    <Trophy size={14} color="#f59e0b" fill="#f59e0b" />
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {stats.personalRecords.map((pr, idx) => (
                        <View
                            key={idx}
                            style={{
                                backgroundColor: '#1A1A2E',
                                width: '48%',
                                padding: 16,
                                borderRadius: 14,
                                marginBottom: 12,
                            }}
                        >
                            <Text
                                style={{ fontSize: 11, color: '#64748b', fontWeight: '500', marginBottom: 6 }}
                                numberOfLines={1}
                            >
                                {pr.exerciseName}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9' }}>
                                    {pr.weight}
                                </Text>
                                <Text style={{ fontSize: 12, fontWeight: '400', color: '#64748b', marginLeft: 3 }}>
                                    kg
                                </Text>
                            </View>
                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>
                                {new Date(pr.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </Text>
                        </View>
                    ))}
                    {stats.personalRecords.length === 0 && (
                        <Text style={{ color: '#64748b', fontStyle: 'italic', width: '100%', textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                            Complete treinos para registrar seus recordes!
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );
}
