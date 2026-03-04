import React from "react";
import { View, Text, FlatList, RefreshControl, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInUp, Easing } from "react-native-reanimated";
import { useTrainerStudentsList, type TrainerStudent } from "../../hooks/useTrainerStudentsList";
import { StudentCard } from "../../components/trainer/StudentCard";
import { StudentFilterChips } from "../../components/trainer/StudentFilterChips";

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

    const handleStudentPress = (student: TrainerStudent) => {
        router.push({ pathname: "/student/[id]", params: { id: student.id } } as any);
    };

    const renderItem = ({ item, index }: { item: TrainerStudent; index: number }) => (
        <Animated.View entering={FadeInUp.delay(index * 30).duration(250).easing(Easing.out(Easing.cubic))}>
            <StudentCard student={item} onPress={() => handleStudentPress(item)} />
        </Animated.View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" }} edges={["top"]}>
                <ActivityIndicator size="large" color="#7c3aed" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: "#0f172a" }}>
                        Alunos
                    </Text>
                    <View
                        style={{
                            backgroundColor: "#f5f3ff",
                            paddingHorizontal: 12,
                            paddingVertical: 4,
                            borderRadius: 100,
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#7c3aed" }}>
                            {counts.all}
                        </Text>
                    </View>
                </Animated.View>

                {/* Search Bar */}
                <Animated.View
                    entering={FadeInUp.delay(40).duration(300)}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#ffffff",
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        marginTop: 16,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.04)",
                    }}
                >
                    <Search size={18} color="#94a3b8" />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar por nome ou email"
                        placeholderTextColor="#94a3b8"
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            fontSize: 14,
                            color: "#0f172a",
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
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#7c3aed" />
                }
                ListEmptyComponent={
                    <View style={{ alignItems: "center", paddingVertical: 40 }}>
                        <Text style={{ fontSize: 13, color: "#94a3b8", fontWeight: "500" }}>
                            {search ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}
