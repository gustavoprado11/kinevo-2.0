import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ExerciseCard } from '../../components/workout/ExerciseCard';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { ChevronLeft } from 'lucide-react-native';
import { WorkoutFeedbackModal } from '../../components/workout/WorkoutFeedbackModal';
import { WorkoutSuccessModal } from '../../components/workout/WorkoutSuccessModal';
import { ExerciseVideoModal } from '../../components/workout/ExerciseVideoModal';

export default function WorkoutPlayerScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const {
        isLoading,
        workoutName,
        exercises,
        duration,
        handleSetChange,
        handleToggleSetComplete,
        finishWorkout,
        isSubmitting
    } = useWorkoutSession(id as string);

    const navigation = useNavigation();
    const isFinishingRef = useRef(false);
    const [isFeedbackVisible, setIsFeedbackVisible] = React.useState(false);
    const [showSuccessModal, setShowSuccessModal] = React.useState(false);
    const [videoModalUrl, setVideoModalUrl] = React.useState<string | null>(null);

    // Protect against accidental exit
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (isSubmitting || isFinishingRef.current) {
                // Allow navigation if submitting or finishing successfully
                return;
            }

            // Prevent default behavior of leaving the screen
            e.preventDefault();

            // Prompt the user before leaving the screen
            Alert.alert(
                'Descartar Treino?',
                'Se você sair agora, todo o progresso atual será perdido.',
                [
                    { text: 'Continuar Treinando', style: 'cancel', onPress: () => { } },
                    {
                        text: 'Descartar e Sair',
                        style: 'destructive',
                        onPress: () => navigation.dispatch(e.data.action),
                    },
                ]
            );
        });

        return unsubscribe;
    }, [navigation, isSubmitting]);

    const handleFinish = () => {
        // Open feedback modal instead of alert
        setIsFeedbackVisible(true);
    };

    const handleConfirmFinish = async (rpe: number, feedback: string) => {
        try {
            setIsFeedbackVisible(false);
            const success = await finishWorkout(rpe, feedback);
            if (success) {
                // Show celebration modal
                setShowSuccessModal(true);
                // Mark as finishing so we can navigate away later
                isFinishingRef.current = true;
            }
        } catch (error: any) {
            Alert.alert("Erro", error.message || "Falha ao finalizar.");
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        // Navigate to home, replacing current screen so user can't go back to workout
        router.replace('/(tabs)/home');
    };

    if (isLoading) {
        return (
            <ScreenWrapper>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text className="text-slate-500 mt-4">Carregando treino...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <Stack.Screen
                options={{
                    headerShown: false
                }}
            />

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-900 bg-slate-950">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ChevronLeft size={24} color="#fff" />
                </TouchableOpacity>

                <View className="items-center">
                    <Text className="text-white font-bold text-lg">{workoutName}</Text>
                    <Text className="text-slate-400 font-mono text-sm">{duration}</Text>
                </View>

                <TouchableOpacity
                    onPress={handleFinish}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color="#8b5cf6" />
                    ) : (
                        <Text className="text-violet-500 font-bold text-base">Finalizar</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
            >
                <ScrollView
                    className="flex-1 px-4 pt-4"
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    {exercises.map((exercise, index) => (
                        <ExerciseCard
                            key={exercise.id}
                            exerciseName={exercise.name}
                            sets={exercise.sets}
                            reps={exercise.reps}
                            restSeconds={exercise.rest_seconds}
                            videoUrl={exercise.video_url}
                            previousLoad={exercise.previousLoad}
                            setsData={exercise.setsData}
                            onSetChange={(setIndex, field, value) => handleSetChange(index, setIndex, field, value)}
                            onToggleSetComplete={(setIndex) => handleToggleSetComplete(index, setIndex)}
                            onVideoPress={(url) => setVideoModalUrl(url)}
                        />
                    ))}

                    {exercises.length === 0 && (
                        <View className="items-center justify-center py-20">
                            <Text className="text-slate-500">Nenhum exercício encontrado neste treino.</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        className="bg-violet-600 p-4 rounded-xl items-center mt-6 mb-10"
                        onPress={handleFinish}
                        disabled={isSubmitting}
                    >
                        <Text className="text-white font-bold text-lg">
                            Finalizar Treino
                        </Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
            {/* Feedback Modal */}
            <WorkoutFeedbackModal
                visible={isFeedbackVisible}
                onClose={() => setIsFeedbackVisible(false)}
                onConfirm={handleConfirmFinish}
            />
            {/* Success Modal */}
            <WorkoutSuccessModal
                visible={showSuccessModal}
                onClose={handleSuccessClose}
            />
            {/* Video Modal */}
            <ExerciseVideoModal
                visible={videoModalUrl !== null}
                onClose={() => setVideoModalUrl(null)}
                videoUrl={videoModalUrl}
            />
        </ScreenWrapper>
    );
}
