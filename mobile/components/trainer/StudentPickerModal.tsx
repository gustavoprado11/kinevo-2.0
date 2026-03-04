import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { X, Search, ChevronRight, Dumbbell, ChevronLeft } from 'lucide-react-native';
import { getScheduledWorkoutsForDate } from '../../../shared/utils/schedule-projection';
import { useTrainingRoomStudents, useFetchStudentWorkout } from '../../hooks/useTrainerWorkoutSession';
import { useTrainingRoomStore, MAX_SIMULTANEOUS_STUDENTS } from '../../stores/training-room-store';
import type { SessionSetupData } from '../../stores/training-room-store';
import { useRoleMode } from '../../contexts/RoleModeContext';

interface StudentPickerModalProps {
    visible: boolean;
    onClose: () => void;
}

interface WorkoutOption {
    id: string;
    name: string;
    isToday: boolean;
}

interface StudentWithWorkouts {
    id: string;
    name: string;
    avatar_url: string | null;
    program: {
        id: string;
        name: string;
        started_at: string;
        duration_weeks: number | null;
    } | null;
    workoutOptions: WorkoutOption[];
    todayWorkouts: WorkoutOption[];
}

export function StudentPickerModal({ visible, onClose }: StudentPickerModalProps) {
    const { students, isLoading, refresh } = useTrainingRoomStudents();
    const { fetchWorkout, isLoading: isAdding } = useFetchStudentWorkout();
    const { trainerId } = useRoleMode();
    const sessions = useTrainingRoomStore((s) => s.sessions);
    const addStudent = useTrainingRoomStore((s) => s.addStudent);
    const sessionCount = Object.keys(sessions).length;

    const [search, setSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<StudentWithWorkouts | null>(null);
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            refresh();
            setSelectedStudent(null);
            setSelectedWorkoutId(null);
            setSearch('');
            setError(null);
        }
    }, [visible, refresh]);

    // Enrich students with today's workout info
    const enrichedStudents = useMemo<StudentWithWorkouts[]>(() => {
        const today = new Date();
        const alreadyInRoom = new Set(Object.keys(sessions));

        return students
            .filter((s) => !alreadyInRoom.has(s.id))
            .map((student) => {
                const programWorkouts = student.workouts || [];

                const todayScheduled = student.program?.started_at
                    ? getScheduledWorkoutsForDate(
                        today,
                        programWorkouts.map((w: any) => ({
                            id: w.id,
                            name: w.name,
                            scheduled_days: w.scheduled_days || [],
                        })),
                        student.program.started_at,
                        student.program.duration_weeks,
                    )
                    : [];

                const todayIds = new Set(todayScheduled.map((w) => w.id));

                const workoutOptions: WorkoutOption[] = programWorkouts.map((w: any) => ({
                    id: w.id,
                    name: w.name,
                    isToday: todayIds.has(w.id),
                }));

                return {
                    ...student,
                    workoutOptions,
                    todayWorkouts: workoutOptions.filter((w) => w.isToday),
                };
            });
    }, [students, sessions]);

    const filtered = useMemo(() => {
        if (!search) return enrichedStudents;
        const q = search.toLowerCase();
        return enrichedStudents.filter((s) => s.name.toLowerCase().includes(q));
    }, [enrichedStudents, search]);

    const handleSelectStudent = (student: StudentWithWorkouts) => {
        setSelectedStudent(student);
        setError(null);
        if (student.todayWorkouts.length === 1) {
            setSelectedWorkoutId(student.todayWorkouts[0].id);
        } else {
            setSelectedWorkoutId(null);
        }
    };

    const handleConfirm = async () => {
        if (!selectedStudent || !selectedWorkoutId || !trainerId) return;

        if (sessionCount >= MAX_SIMULTANEOUS_STUDENTS) {
            Alert.alert(
                'Limite atingido',
                `Máximo de ${MAX_SIMULTANEOUS_STUDENTS} alunos simultâneos. Use a versão web para turmas maiores.`,
            );
            return;
        }

        setError(null);
        const result = await fetchWorkout(selectedStudent.id, selectedWorkoutId);

        if (result.error || !result.data) {
            setError(result.error || 'Erro ao carregar treino');
            return;
        }

        const setupData: SessionSetupData = {
            studentName: selectedStudent.name,
            studentAvatarUrl: selectedStudent.avatar_url,
            assignedWorkoutId: selectedWorkoutId,
            assignedProgramId: result.data.assignedProgramId,
            trainerId,
            workoutName: result.data.workoutName,
            exercises: result.data.exercises,
            workoutNotes: result.data.workoutNotes,
        };

        addStudent(selectedStudent.id, setupData);
        onClose();
    };

    const renderStudentItem = ({ item }: { item: StudentWithWorkouts }) => (
        <TouchableOpacity
            onPress={() => handleSelectStudent(item)}
            activeOpacity={0.6}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                gap: 12,
            }}
        >
            {item.avatar_url ? (
                <Image
                    source={{ uri: item.avatar_url }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                />
            ) : (
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#f5f3ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#7c3aed' }}>
                        {item.name.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                    {item.name}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                    {item.program
                        ? item.todayWorkouts.length > 0
                            ? `Hoje: ${item.todayWorkouts.map((w) => w.name).join(', ')}`
                            : item.program.name
                        : 'Sem programa ativo'}
                </Text>
            </View>
            {item.program && (
                <View
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: item.todayWorkouts.length > 0 ? '#10b981' : '#e2e8f0',
                    }}
                />
            )}
            <ChevronRight size={16} color="#94a3b8" />
        </TouchableOpacity>
    );

    const selectedWorkoutOption = selectedStudent?.workoutOptions.find(
        (w) => w.id === selectedWorkoutId,
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 20,
                        paddingTop: 16,
                        paddingBottom: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#f1f5f9',
                    }}
                >
                    {selectedStudent ? (
                        <TouchableOpacity
                            onPress={() => setSelectedStudent(null)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <ChevronLeft size={18} color="#7c3aed" />
                            <Text style={{ fontSize: 14, color: '#7c3aed', fontWeight: '500' }}>
                                Voltar
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a' }}>
                            Adicionar Aluno
                        </Text>
                    )}
                    <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                        <X size={22} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {!selectedStudent ? (
                    /* Step 1: Select student */
                    <>
                        {/* Search */}
                        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#fff',
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    borderWidth: 1,
                                    borderColor: '#e2e8f0',
                                }}
                            >
                                <Search size={16} color="#94a3b8" />
                                <TextInput
                                    placeholder="Buscar aluno..."
                                    placeholderTextColor="#94a3b8"
                                    value={search}
                                    onChangeText={setSearch}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        paddingHorizontal: 8,
                                        fontSize: 14,
                                        color: '#0f172a',
                                    }}
                                    autoFocus
                                />
                            </View>
                        </View>

                        {/* Student list */}
                        {isLoading ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="small" color="#7c3aed" />
                            </View>
                        ) : filtered.length === 0 ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 14, color: '#94a3b8' }}>
                                    {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno disponível'}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filtered}
                                keyExtractor={(item) => item.id}
                                renderItem={renderStudentItem}
                                contentContainerStyle={{ paddingBottom: 40 }}
                            />
                        )}
                    </>
                ) : (
                    /* Step 2: Select workout */
                    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
                        {/* Selected student header */}
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                padding: 14,
                                backgroundColor: '#fff',
                                borderRadius: 14,
                                marginBottom: 20,
                                borderWidth: 1,
                                borderColor: '#f1f5f9',
                            }}
                        >
                            {selectedStudent.avatar_url ? (
                                <Image
                                    source={{ uri: selectedStudent.avatar_url }}
                                    style={{ width: 40, height: 40, borderRadius: 20 }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: '#f5f3ff',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#7c3aed' }}>
                                        {selectedStudent.name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a' }}>
                                    {selectedStudent.name}
                                </Text>
                                <Text style={{ fontSize: 12, color: '#64748b' }}>
                                    {selectedStudent.program?.name || 'Sem programa'}
                                </Text>
                            </View>
                        </View>

                        {!selectedStudent.program ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
                                    Este aluno não possui um programa ativo.
                                </Text>
                            </View>
                        ) : selectedStudent.workoutOptions.length === 0 ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
                                    Nenhum treino encontrado neste programa.
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Today's workouts */}
                                {selectedStudent.todayWorkouts.length > 0 && (
                                    <View style={{ marginBottom: 16 }}>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                fontWeight: '700',
                                                color: '#10b981',
                                                textTransform: 'uppercase',
                                                letterSpacing: 1.5,
                                                marginBottom: 8,
                                            }}
                                        >
                                            Treino do dia
                                        </Text>
                                        {selectedStudent.todayWorkouts.map((wo) => (
                                            <WorkoutOptionButton
                                                key={wo.id}
                                                workout={wo}
                                                isSelected={selectedWorkoutId === wo.id}
                                                onSelect={() => setSelectedWorkoutId(wo.id)}
                                            />
                                        ))}
                                    </View>
                                )}

                                {/* Other workouts */}
                                {selectedStudent.workoutOptions.filter((w) => !w.isToday).length > 0 && (
                                    <View>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                fontWeight: '700',
                                                color: '#94a3b8',
                                                textTransform: 'uppercase',
                                                letterSpacing: 1.5,
                                                marginBottom: 8,
                                            }}
                                        >
                                            {selectedStudent.todayWorkouts.length > 0 ? 'Outros treinos' : 'Escolher treino'}
                                        </Text>
                                        {selectedStudent.workoutOptions
                                            .filter((w) => !w.isToday)
                                            .map((wo) => (
                                                <WorkoutOptionButton
                                                    key={wo.id}
                                                    workout={wo}
                                                    isSelected={selectedWorkoutId === wo.id}
                                                    onSelect={() => setSelectedWorkoutId(wo.id)}
                                                />
                                            ))}
                                    </View>
                                )}

                                {error && (
                                    <Text style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>
                                        {error}
                                    </Text>
                                )}
                            </>
                        )}

                        {/* Confirm button */}
                        {selectedStudent.program && selectedStudent.workoutOptions.length > 0 && (
                            <View style={{ paddingVertical: 20 }}>
                                <TouchableOpacity
                                    onPress={handleConfirm}
                                    disabled={!selectedWorkoutId || isAdding}
                                    activeOpacity={0.7}
                                    style={{
                                        backgroundColor: selectedWorkoutId ? '#7c3aed' : '#e2e8f0',
                                        borderRadius: 14,
                                        paddingVertical: 14,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'row',
                                        gap: 8,
                                    }}
                                >
                                    {isAdding ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text
                                            style={{
                                                fontSize: 15,
                                                fontWeight: '700',
                                                color: selectedWorkoutId ? '#fff' : '#94a3b8',
                                            }}
                                        >
                                            {selectedWorkoutOption
                                                ? `Adicionar — ${selectedWorkoutOption.name}`
                                                : 'Selecione um treino'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WorkoutOptionButton({
    workout,
    isSelected,
    onSelect,
}: {
    workout: WorkoutOption;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onSelect}
            activeOpacity={0.6}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 12,
                marginBottom: 6,
                backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.08)' : '#fff',
                borderWidth: 1,
                borderColor: isSelected ? 'rgba(124, 58, 237, 0.3)' : '#f1f5f9',
            }}
        >
            <View
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.12)' : '#f8fafc',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Dumbbell size={16} color={isSelected ? '#7c3aed' : '#94a3b8'} />
            </View>
            <Text
                style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: '500',
                    color: isSelected ? '#7c3aed' : '#0f172a',
                }}
            >
                {workout.name}
            </Text>
            {isSelected && (
                <View
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#7c3aed',
                    }}
                />
            )}
        </TouchableOpacity>
    );
}
