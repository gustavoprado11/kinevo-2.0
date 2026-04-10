import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StudentsListSkeleton } from "../../components/shared/skeletons/StudentsListSkeleton";
import { Search, Users, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInUp, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTrainerStudentsList, type TrainerStudent } from "../../hooks/useTrainerStudentsList";
import { StudentCard } from "../../components/trainer/StudentCard";
import { StudentFilterChips } from "../../components/trainer/StudentFilterChips";
import { EmptyState } from "../../components/shared/EmptyState";
import { AddStudentModal } from "../../components/trainer/students/AddStudentModal";
import { MasterDetailLayout } from "../../components/shared/MasterDetailLayout";
import { useResponsive } from "../../hooks/useResponsive";
import { colors } from "@/theme";

// Lazy-import the student detail screen content
const StudentProfileScreen = React.lazy(() => import("../student/[id]"));

function StudentDetailPlaceholder() {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Users size={48} color={colors.text.quaternary} />
            <Text style={{ fontSize: 16, color: colors.text.tertiary, marginTop: 12 }}>
                Selecione um aluno
            </Text>
        </View>
    );
}

export default function StudentsScreen() {
    const {
        students,
        counts,
        isLoading,
        isRefreshing,
        search,
        setSearch,
        filter,
        setFilter,
        refresh,
    } = useTrainerStudentsList();

    const router = useRouter();
    const { isTablet } = useResponsive();
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [showAddStudent, setShowAddStudent] = useState(false);

    // Auto-select first student on tablet when list loads
    useEffect(() => {
        if (isTablet && students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(students[0].id);
        }
    }, [isTablet, students, selectedStudentId]);

    const handleStudentPress = useCallback((student: TrainerStudent) => {
        if (isTablet) {
            setSelectedStudentId(student.id);
        } else {
            router.push({ pathname: "/student/[id]", params: { id: student.id } } as any);
        }
    }, [isTablet, router]);

    const renderItem = ({ item, index }: { item: TrainerStudent; index: number }) => (
        <Animated.View entering={FadeInUp.delay(index * 30).duration(250).easing(Easing.out(Easing.cubic))}>
            <StudentCard
                student={item}
                onPress={() => handleStudentPress(item)}
                selected={isTablet && selectedStudentId === item.id}
            />
        </Animated.View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={["top"]}>
                <StudentsListSkeleton />
            </SafeAreaView>
        );
    }

    const masterContent = (
        <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text.primary }}>
                        Alunos
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                            style={{
                                backgroundColor: colors.brand.primaryLight,
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                borderRadius: 100,
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.brand.primary }}>
                                {counts.all}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowAddStudent(true);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Adicionar aluno"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                backgroundColor: colors.brand.primaryLight,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Plus size={18} color={colors.brand.primary} strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Search Bar */}
                <Animated.View
                    entering={FadeInUp.delay(40).duration(300)}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.background.card,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        marginTop: 16,
                        borderWidth: 1,
                        borderColor: colors.border.primary,
                    }}
                >
                    <Search size={18} color={colors.text.tertiary} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar por nome ou email"
                        placeholderTextColor={colors.text.tertiary}
                        accessibilityLabel="Buscar alunos por nome ou email"
                        accessibilityRole="search"
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            fontSize: 14,
                            color: colors.text.primary,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </Animated.View>

                {/* Filter Chips */}
                <StudentFilterChips filter={filter} setFilter={setFilter} counts={counts} />
            </View>

            {/* Student List */}
            <FlatList
                data={students}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                accessibilityRole="list"
                accessibilityLabel="Lista de alunos"
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isTablet ? 40 : 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.brand.primary} />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon={<Users size={40} color={colors.text.quaternary} />}
                        title={search ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
                        description={search ? "Tente ajustar o termo de busca" : "Toque no + para adicionar seu primeiro aluno"}
                    />
                }
            />
        </View>
    );

    const detailContent = selectedStudentId ? (
        <React.Suspense fallback={<View style={{ flex: 1, backgroundColor: colors.background.primary }} />}>
            <StudentProfileScreen embedded studentIdOverride={selectedStudentId} />
        </React.Suspense>
    ) : null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={["top"]}>
            <MasterDetailLayout
                masterContent={masterContent}
                detailContent={detailContent}
                placeholder={<StudentDetailPlaceholder />}
                masterWidthPercent={35}
            />
            <AddStudentModal
                visible={showAddStudent}
                onClose={() => setShowAddStudent(false)}
                onStudentCreated={refresh}
            />
        </SafeAreaView>
    );
}
