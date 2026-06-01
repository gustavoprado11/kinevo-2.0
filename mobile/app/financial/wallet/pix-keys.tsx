import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Plus, Star, Trash2, Check, X, KeyRound } from "lucide-react-native";
import type { PixKeyType } from "@kinevo/shared/types/asaas";
import { usePixKeys, type PixKeyRow } from "../../../hooks/usePixKeys";
import { useV2Colors } from "../../../hooks/useV2Colors";

const KEY_TYPES: { value: PixKeyType; label: string }[] = [
    { value: "CPF", label: "CPF" },
    { value: "CNPJ", label: "CNPJ" },
    { value: "EMAIL", label: "E-mail" },
    { value: "PHONE", label: "Telefone" },
    { value: "EVP", label: "Aleatória" },
];

const KEY_TYPE_LABEL: Record<PixKeyType, string> = {
    CPF: "CPF",
    CNPJ: "CNPJ",
    EMAIL: "E-mail",
    PHONE: "Telefone",
    EVP: "Chave aleatória",
};

// Validação leve de formato pra feedback ao vivo. O backend faz a validação
// completa (incluindo dígito verificador de CPF/CNPJ) ao salvar.
function isFormatValid(key: string, type: PixKeyType): boolean {
    const v = key.trim();
    if (!v) return false;
    switch (type) {
        case "CPF":
            return v.replace(/\D/g, "").length === 11;
        case "CNPJ":
            return v.replace(/\D/g, "").length === 14;
        case "EMAIL":
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        case "PHONE":
            return /^(55)?\d{10,11}$/.test(v.replace(/\D/g, ""));
        case "EVP":
            return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        default:
            return false;
    }
}

export default function PixKeysScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { keys, isLoading, isRefreshing, error, refresh, addKey, setDefault, removeKey } = usePixKeys();

    const [adding, setAdding] = useState(false);
    const [keyType, setKeyType] = useState<PixKeyType>("CPF");
    const [alias, setAlias] = useState("");
    const [pixKey, setPixKey] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const formatOk = isFormatValid(pixKey, keyType);
    const canSubmit = alias.trim().length > 0 && formatOk && !submitting;

    const resetForm = () => {
        setAlias("");
        setPixKey("");
        setKeyType("CPF");
        setAdding(false);
    };

    const handleAdd = async () => {
        if (!canSubmit) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);
        try {
            await addKey({ alias: alias.trim(), pixKey: pixKey.trim(), keyType, isDefault: keys.length === 0 });
            resetForm();
        } catch (err) {
            Alert.alert("Não foi possível adicionar", err instanceof Error ? err.message : "Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSetDefault = async (id: string) => {
        Haptics.selectionAsync();
        try {
            await setDefault(id);
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possível definir como padrão.");
        }
    };

    const handleRemove = (key: PixKeyRow) => {
        Alert.alert("Remover chave", `Remover a chave "${key.alias}"?`, [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Remover",
                style: "destructive",
                onPress: async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    try {
                        await removeKey(key.id);
                    } catch (err) {
                        Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possível remover.");
                    }
                },
            },
        ]);
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>Chaves PIX</Text>
                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAdding((v) => !v); }}
                        accessibilityRole="button"
                        accessibilityLabel="Adicionar chave"
                        hitSlop={12}
                    >
                        {adding ? <X size={22} color={colors.text.primary} /> : <Plus size={22} color={colors.purple[600]} />}
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={colors.purple[600]} size="large" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.purple[600]} />}
                    >
                        {adding ? (
                            <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border.default, marginBottom: 16 }}>
                                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text.primary, marginBottom: 10 }}>Nova chave</Text>

                                {/* Tipo */}
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                    {KEY_TYPES.map((t) => {
                                        const active = t.value === keyType;
                                        return (
                                            <TouchableOpacity
                                                key={t.value}
                                                onPress={() => { Haptics.selectionAsync(); setKeyType(t.value); }}
                                                activeOpacity={0.7}
                                                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: active ? colors.purple[600] : colors.surface.card2, borderWidth: 1, borderColor: active ? colors.purple[600] : colors.border.default }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#ffffff" : colors.text.secondary }}>{t.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <TextInput
                                    value={alias}
                                    onChangeText={setAlias}
                                    placeholder="Apelido (ex: Minha conta Nubank)"
                                    placeholderTextColor={colors.text.quaternary}
                                    style={{ backgroundColor: colors.surface.card2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text.primary, marginBottom: 10, borderWidth: 1, borderColor: colors.border.default }}
                                />

                                <View style={{ position: "relative", justifyContent: "center" }}>
                                    <TextInput
                                        value={pixKey}
                                        onChangeText={setPixKey}
                                        placeholder={keyType === "EMAIL" ? "email@exemplo.com" : keyType === "PHONE" ? "11999998888" : "Digite a chave"}
                                        placeholderTextColor={colors.text.quaternary}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType={keyType === "CPF" || keyType === "CNPJ" || keyType === "PHONE" ? "number-pad" : keyType === "EMAIL" ? "email-address" : "default"}
                                        style={{ backgroundColor: colors.surface.card2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, paddingRight: 40, fontSize: 15, color: colors.text.primary, borderWidth: 1, borderColor: pixKey.length > 0 ? (formatOk ? colors.semantic.success.default : colors.semantic.danger.default) : colors.border.default }}
                                    />
                                    {pixKey.length > 0 ? (
                                        <View style={{ position: "absolute", right: 12 }}>
                                            {formatOk ? <Check size={18} color={colors.semantic.success.default} /> : <X size={18} color={colors.semantic.danger.default} />}
                                        </View>
                                    ) : null}
                                </View>

                                <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 8 }}>
                                    A chave precisa estar no mesmo CPF/CNPJ da sua conta Asaas.
                                </Text>

                                <TouchableOpacity
                                    onPress={handleAdd}
                                    disabled={!canSubmit}
                                    activeOpacity={0.85}
                                    style={{ marginTop: 14, backgroundColor: canSubmit ? colors.purple[600] : colors.surface.card2, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={{ fontSize: 15, fontWeight: "700", color: canSubmit ? "#ffffff" : colors.text.quaternary }}>Adicionar chave</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {error && keys.length === 0 ? (
                            <View style={{ backgroundColor: colors.semantic.danger.bg, borderRadius: 16, padding: 16 }}>
                                <Text style={{ color: colors.semantic.danger.fg, fontSize: 14, fontWeight: "600" }}>{error}</Text>
                            </View>
                        ) : null}

                        {keys.length === 0 && !adding && !error ? (
                            <View style={{ alignItems: "center", paddingVertical: 48 }}>
                                <KeyRound size={36} color={colors.text.quaternary} style={{ marginBottom: 12 }} />
                                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.secondary }}>Nenhuma chave cadastrada</Text>
                                <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4, textAlign: "center" }}>Adicione uma chave PIX pra receber seus saques.</Text>
                            </View>
                        ) : null}

                        {keys.map((k) => (
                            <View key={k.id} style={{ backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border.default, marginBottom: 12 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <View style={{ flex: 1, paddingRight: 12 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }}>{k.alias}</Text>
                                            {k.is_default ? (
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.purple[100], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                                                    <Star size={11} color={colors.purple[700]} fill={colors.purple[700]} />
                                                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.purple[700] }}>Padrão</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2 }}>{KEY_TYPE_LABEL[k.key_type]} · {k.pix_key}</Text>
                                        {k.owner_name ? (
                                            <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>{k.owner_name}{k.bank_name ? ` · ${k.bank_name}` : ""}</Text>
                                        ) : null}
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemove(k)} hitSlop={10} accessibilityLabel="Remover chave">
                                        <Trash2 size={18} color={colors.semantic.danger.default} />
                                    </TouchableOpacity>
                                </View>
                                {!k.is_default ? (
                                    <TouchableOpacity onPress={() => handleSetDefault(k.id)} activeOpacity={0.7} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        <Star size={14} color={colors.purple[600]} />
                                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.purple[600] }}>Definir como padrão</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </SafeAreaView>
        </>
    );
}
