import React, { useState, useCallback, useRef, useMemo } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { Search, X, Plus, Edit2, Trash2, Lock, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme";
import { useMuscleGroupCrud, type MuscleGroupFull } from "@/hooks/useMuscleGroupCrud";
import { useAuth } from "@/contexts/AuthContext";

interface MuscleGroupManagerModalProps {
    visible: boolean;
    onClose: () => void;
}

export function MuscleGroupManagerModal({ visible, onClose }: MuscleGroupManagerModalProps) {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["70%", "90%"], []);
    const { user } = useAuth();

    const {
        muscleGroups,
        isLoading,
        isSaving,
        createMuscleGroup,
        updateMuscleGroup,
        deleteMuscleGroup,
        checkUsageCount,
    } = useMuscleGroupCrud();

    // Search
    const [searchQuery, setSearchQuery] = useState("");

    // Create
    const [newName, setNewName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    // Filtered list
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return muscleGroups;
        const q = searchQuery.toLowerCase();
        return muscleGroups.filter((g) => g.name.toLowerCase().includes(q));
    }, [muscleGroups, searchQuery]);

    const handleCreate = useCallback(async () => {
        if (!newName.trim() || isCreating) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsCreating(true);
        const result = await createMuscleGroup(newName.trim());
        if (result) {
            setNewName("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setIsCreating(false);
    }, [newName, isCreating, createMuscleGroup]);

    const startEdit = useCallback((group: MuscleGroupFull) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingId(group.id);
        setEditName(group.name);
    }, []);

    const handleUpdate = useCallback(async () => {
        if (!editingId || !editName.trim()) return;
        const success = await updateMuscleGroup(editingId, editName.trim());
        if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEditingId(null);
            setEditName("");
        } else {
            Alert.alert("Erro", "Não foi possível atualizar. Verifique se o nome já existe.");
        }
    }, [editingId, editName, updateMuscleGroup]);

    const handleDelete = useCallback(async (group: MuscleGroupFull) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const count = await checkUsageCount(group.id);

        const message = count > 0
            ? `"${group.name}" está sendo usado em ${count} exercício(s). Deseja excluir mesmo assim?`
            : `Deseja excluir "${group.name}"? Esta ação não pode ser desfeita.`;

        Alert.alert("Excluir grupo", message, [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Excluir",
                style: "destructive",
                onPress: async () => {
                    const success = await deleteMuscleGroup(group.id);
                    if (success) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } else {
                        Alert.alert("Erro", "Não foi possível excluir o grupo.");
                    }
                },
            },
        ]);
    }, [checkUsageCount, deleteMuscleGroup]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    const renderItem = useCallback(({ item }: { item: MuscleGroupFull }) => {
        const isSystem = item.owner_id === null;
        const isEditable = item.owner_id === user?.id;
        const isEditing = editingId === item.id;

        return (
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    marginBottom: 6,
                    borderRadius: 12,
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: isEditing ? colors.brand.primary : "rgba(0,0,0,0.05)",
                }}
            >
                {isEditing ? (
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TextInput
                            autoFocus
                            value={editName}
                            onChangeText={setEditName}
                            onSubmitEditing={handleUpdate}
                            returnKeyType="done"
                            style={{
                                flex: 1,
                                fontSize: 14,
                                color: "#0f172a",
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                backgroundColor: "#f8fafc",
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: colors.brand.primary,
                            }}
                        />
                        <TouchableOpacity
                            onPress={handleUpdate}
                            hitSlop={8}
                            style={{
                                width: 32, height: 32, borderRadius: 8,
                                backgroundColor: "#f0fdf4",
                                alignItems: "center", justifyContent: "center",
                            }}
                        >
                            <Check size={16} color="#16a34a" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setEditingId(null)}
                            hitSlop={8}
                            style={{
                                width: 32, height: 32, borderRadius: 8,
                                backgroundColor: "#f1f5f9",
                                alignItems: "center", justifyContent: "center",
                            }}
                        >
                            <X size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a" }}>
                                {item.name}
                            </Text>
                            {isSystem && (
                                <View style={{
                                    backgroundColor: "#f1f5f9",
                                    paddingHorizontal: 6, paddingVertical: 2,
                                    borderRadius: 6,
                                }}>
                                    <Text style={{ fontSize: 9, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.5 }}>
                                        SISTEMA
                                    </Text>
                                </View>
                            )}
                            {isEditable && (
                                <View style={{
                                    backgroundColor: "#f5f3ff",
                                    paddingHorizontal: 6, paddingVertical: 2,
                                    borderRadius: 6,
                                }}>
                                    <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed", letterSpacing: 0.5 }}>
                                        CUSTOM
                                    </Text>
                                </View>
                            )}
                        </View>

                        {isEditable ? (
                            <View style={{ flexDirection: "row", gap: 4 }}>
                                <TouchableOpacity
                                    onPress={() => startEdit(item)}
                                    hitSlop={8}
                                    accessibilityLabel={`Editar ${item.name}`}
                                    style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        backgroundColor: "#f8fafc",
                                        alignItems: "center", justifyContent: "center",
                                    }}
                                >
                                    <Edit2 size={14} color="#64748b" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDelete(item)}
                                    hitSlop={8}
                                    accessibilityLabel={`Excluir ${item.name}`}
                                    style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        backgroundColor: "#fef2f2",
                                        alignItems: "center", justifyContent: "center",
                                    }}
                                >
                                    <Trash2 size={14} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{
                                width: 32, height: 32,
                                alignItems: "center", justifyContent: "center",
                            }}>
                                <Lock size={14} color="#d1d5db" />
                            </View>
                        )}
                    </>
                )}
            </View>
        );
    }, [editingId, editName, user?.id, handleUpdate, startEdit, handleDelete]);

    if (!visible) return null;

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            onClose={onClose}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: colors.text.quaternary }}
            backgroundStyle={{ backgroundColor: "#F2F2F7" }}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
        >
            <BottomSheetView style={{ flex: 1 }}>
                {/* Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                }}>
                    <View>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>
                            Grupos musculares
                        </Text>
                        <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                            Adicione ou gerencie seus grupos
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Fechar"
                        style={{ padding: 4 }}
                    >
                        <X size={22} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                {/* Create input */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    gap: 8,
                }}>
                    <View style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#ffffff",
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.05)",
                    }}>
                        <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="Novo grupo (ex: Potência)"
                            placeholderTextColor="#94a3b8"
                            onSubmitEditing={handleCreate}
                            returnKeyType="done"
                            style={{
                                flex: 1,
                                paddingVertical: 12,
                                fontSize: 14,
                                color: "#0f172a",
                            }}
                        />
                    </View>
                    <TouchableOpacity
                        onPress={handleCreate}
                        disabled={!newName.trim() || isCreating}
                        activeOpacity={0.7}
                        style={{
                            height: 44,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            backgroundColor: newName.trim() ? "#7c3aed" : "#e2e8f0",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                        }}
                    >
                        {isCreating ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <>
                                <Plus size={16} color="#ffffff" strokeWidth={2.5} />
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>
                                    Criar
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#ffffff",
                    borderRadius: 12,
                    marginHorizontal: 20,
                    paddingHorizontal: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.05)",
                }}>
                    <Search size={16} color="#94a3b8" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Buscar grupo..."
                        placeholderTextColor="#94a3b8"
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            fontSize: 14,
                            color: "#0f172a",
                        }}
                    />
                </View>

                {/* List */}
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#7c3aed" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredGroups}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={renderItem}
                        ListEmptyComponent={
                            <View style={{ alignItems: "center", paddingVertical: 40 }}>
                                <Text style={{ fontSize: 14, color: "#94a3b8" }}>
                                    Nenhum grupo encontrado
                                </Text>
                            </View>
                        }
                    />
                )}
            </BottomSheetView>
        </BottomSheet>
    );
}
