import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Share,
} from "react-native";
import { X, User, Mail, Phone, Globe, MapPin, Copy, Share2, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useCreateStudent } from "../../../hooks/useCreateStudent";
import { useV2Colors } from "../../../hooks/useV2Colors";

let Clipboard: any = null;
try {
    Clipboard = require("expo-clipboard");
} catch {}

interface AddStudentModalProps {
    visible: boolean;
    onClose: () => void;
    onStudentCreated?: () => void;
}

type Step = "form" | "credentials";

interface Credentials {
    name: string;
    email: string;
    password: string;
    whatsapp: string | null;
}

export function AddStudentModal({ visible, onClose, onStudentCreated }: AddStudentModalProps) {
    const insets = useSafeAreaInsets();
    const colors = useV2Colors();
    const { createStudent, isCreating } = useCreateStudent();

    // Inline styles que dependem de colors (substituem os const externos
    // labelStyle / inputRow / inputStyle que usavam cores hardcoded).
    const labelStyle = {
        fontSize: 12,
        fontWeight: "600" as const,
        color: colors.text.tertiary,
        textTransform: "uppercase" as const,
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 16,
    };
    const inputRow = {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: colors.surface.card,
        borderRadius: 12,
        paddingHorizontal: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    };
    const inputStyle = {
        flex: 1,
        paddingVertical: 14,
        fontSize: 14,
        color: colors.text.primary,
    };

    // Form state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [modality, setModality] = useState<"online" | "presential">("online");
    const [error, setError] = useState<string | null>(null);

    // Flow state
    const [step, setStep] = useState<Step>("form");
    const [credentials, setCredentials] = useState<Credentials | null>(null);
    const [copied, setCopied] = useState(false);

    // Reset when modal opens
    useEffect(() => {
        if (visible) {
            setName("");
            setEmail("");
            setPhone("");
            setModality("online");
            setError(null);
            setStep("form");
            setCredentials(null);
            setCopied(false);
        }
    }, [visible]);

    const canSubmit = name.trim().length > 0 && email.trim().length > 0 && email.includes("@");

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || isCreating) return;
        setError(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const result = await createStudent({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            modality,
        });

        if (!result.success) {
            setError(result.error || "Erro ao criar aluno");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCredentials({
            name: result.name!,
            email: result.email!,
            password: result.password!,
            whatsapp: result.whatsapp || null,
        });
        setStep("credentials");
        onStudentCreated?.();
    }, [canSubmit, isCreating, name, email, phone, modality, createStudent, onStudentCreated]);

    const buildCredentialsMessage = useCallback(() => {
        if (!credentials) return "";
        return `Olá ${credentials.name}! 👋\n\nSuas credenciais de acesso ao Kinevo:\n\n📧 Email: ${credentials.email}\n🔑 Senha: ${credentials.password}\n\nBaixe o app e faça login para começar! 💪`;
    }, [credentials]);

    const handleCopyCredentials = useCallback(async () => {
        const message = buildCredentialsMessage();
        if (Clipboard?.setStringAsync) {
            await Clipboard.setStringAsync(message);
        }
        setCopied(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setCopied(false), 2000);
    }, [buildCredentialsMessage]);

    const handleShareWhatsApp = useCallback(() => {
        if (!credentials?.whatsapp) return;
        const message = encodeURIComponent(buildCredentialsMessage());
        const phoneClean = credentials.whatsapp.replace(/\D/g, "");
        const url = `whatsapp://send?phone=55${phoneClean}&text=${message}`;
        Linking.openURL(url).catch(() => {
            // Fallback to generic share if WhatsApp is not installed
            Share.share({ message: buildCredentialsMessage() }).catch(() => {});
        });
    }, [credentials, buildCredentialsMessage]);

    const handleShare = useCallback(async () => {
        const message = buildCredentialsMessage();
        try {
            await Share.share({ message });
        } catch {}
    }, [buildCredentialsMessage]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1, backgroundColor: colors.surface.canvas }}
            >
                {/* Header */}
                <View style={{
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border.default,
                    backgroundColor: colors.surface.card,
                }}>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Fechar"
                        accessibilityRole="button"
                    >
                        <X size={24} color={colors.text.tertiary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text.primary }}>
                        {step === "form" ? "Novo Aluno" : "Credenciais"}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                {step === "form" ? (
                    /* ===== FORM STEP ===== */
                    <>
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {error && (
                                <View style={{
                                    backgroundColor: "rgba(239,68,68,0.12)",
                                    borderRadius: 12,
                                    padding: 14,
                                    marginBottom: 16,
                                    borderWidth: 1,
                                    borderColor: "rgba(239,68,68,0.3)",
                                }}>
                                    <Text style={{ fontSize: 13, color: "#ef4444" }}>{error}</Text>
                                </View>
                            )}

                            {/* Name */}
                            <Text style={labelStyle}>Nome completo *</Text>
                            <View style={inputRow}>
                                <User size={16} color={colors.text.quaternary} />
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Ex: João Silva"
                                    placeholderTextColor={colors.text.quaternary}
                                    style={inputStyle}
                                    autoCapitalize="words"
                                    accessibilityLabel="Nome do aluno"
                                />
                            </View>

                            {/* Email */}
                            <Text style={labelStyle}>Email *</Text>
                            <View style={inputRow}>
                                <Mail size={16} color={colors.text.quaternary} />
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="aluno@email.com"
                                    placeholderTextColor={colors.text.quaternary}
                                    style={inputStyle}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    accessibilityLabel="Email do aluno"
                                />
                            </View>

                            {/* Phone */}
                            <Text style={labelStyle}>Telefone (WhatsApp)</Text>
                            <View style={inputRow}>
                                <Phone size={16} color={colors.text.quaternary} />
                                <TextInput
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="(11) 99999-9999"
                                    placeholderTextColor={colors.text.quaternary}
                                    style={inputStyle}
                                    keyboardType="phone-pad"
                                    accessibilityLabel="Telefone do aluno"
                                />
                            </View>

                            {/* Modality */}
                            <Text style={labelStyle}>Modalidade</Text>
                            <View style={{
                                flexDirection: "row",
                                backgroundColor: colors.surface.card,
                                borderRadius: 12,
                                padding: 4,
                                borderWidth: 1,
                                borderColor: colors.border.subtle,
                            }}>
                                {(["online", "presential"] as const).map((opt) => {
                                    const isActive = modality === opt;
                                    const Icon = opt === "online" ? Globe : MapPin;
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => {
                                                Haptics.selectionAsync();
                                                setModality(opt);
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel={opt === "online" ? "Online" : "Presencial"}
                                            accessibilityState={{ selected: isActive }}
                                            style={{
                                                flex: 1,
                                                flexDirection: "row",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 6,
                                                paddingVertical: 12,
                                                borderRadius: 10,
                                                backgroundColor: isActive ? "#7c3aed" : "transparent",
                                            }}
                                        >
                                            <Icon size={16} color={isActive ? "#ffffff" : colors.text.quaternary} />
                                            <Text style={{
                                                fontSize: 13,
                                                fontWeight: "600",
                                                color: isActive ? "#ffffff" : colors.text.tertiary,
                                            }}>
                                                {opt === "online" ? "Online" : "Presencial"}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        {/* Submit button */}
                        <View style={{
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            paddingBottom: insets.bottom + 12,
                            backgroundColor: colors.surface.card,
                            borderTopWidth: 0.5,
                            borderTopColor: colors.border.default,
                        }}>
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={!canSubmit || isCreating}
                                activeOpacity={0.7}
                                accessibilityLabel="Criar aluno"
                                accessibilityRole="button"
                                style={{
                                    backgroundColor: canSubmit ? "#7c3aed" : colors.surface.card2,
                                    borderRadius: 14,
                                    paddingVertical: 16,
                                    alignItems: "center",
                                }}
                            >
                                {isCreating ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                        Criar Aluno
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    /* ===== CREDENTIALS STEP ===== */
                    <View style={{ flex: 1, padding: 20 }}>
                        <View style={{ alignItems: "center", marginTop: 20, marginBottom: 24 }}>
                            <View style={{
                                width: 60, height: 60, borderRadius: 30,
                                backgroundColor: "rgba(22,163,74,0.12)",
                                alignItems: "center", justifyContent: "center",
                                marginBottom: 12,
                            }}>
                                <Check size={28} color="#16a34a" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>
                                Aluno criado!
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4, textAlign: "center" }}>
                                Compartilhe as credenciais com {credentials?.name}
                            </Text>
                        </View>

                        {/* Credentials card */}
                        <View style={{
                            backgroundColor: colors.surface.card,
                            borderRadius: 16,
                            padding: 20,
                            borderWidth: 1,
                            borderColor: colors.border.subtle,
                            gap: 12,
                        }}>
                            <View>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary, textTransform: "uppercase", letterSpacing: 1 }}>
                                    Email
                                </Text>
                                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary, marginTop: 4 }} selectable>
                                    {credentials?.email}
                                </Text>
                            </View>
                            <View style={{ height: 1, backgroundColor: colors.border.default }} />
                            <View>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary, textTransform: "uppercase", letterSpacing: 1 }}>
                                    Senha temporária
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: "700",
                                        color: "#7c3aed",
                                        marginTop: 4,
                                        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                                    }}
                                    selectable
                                >
                                    {credentials?.password}
                                </Text>
                            </View>
                        </View>

                        {/* Action buttons */}
                        <View style={{ marginTop: 20, gap: 10 }}>
                            {credentials?.whatsapp ? (
                                <TouchableOpacity
                                    onPress={handleShareWhatsApp}
                                    activeOpacity={0.7}
                                    accessibilityLabel="Enviar via WhatsApp"
                                    accessibilityRole="button"
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        backgroundColor: "#25D366",
                                        borderRadius: 14,
                                        paddingVertical: 16,
                                    }}
                                >
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>
                                        Enviar via WhatsApp
                                    </Text>
                                </TouchableOpacity>
                            ) : null}

                            <TouchableOpacity
                                onPress={handleCopyCredentials}
                                activeOpacity={0.7}
                                accessibilityLabel="Copiar credenciais"
                                accessibilityRole="button"
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    backgroundColor: "rgba(124,58,237,0.10)",
                                    borderRadius: 14,
                                    paddingVertical: 16,
                                    borderWidth: 1,
                                    borderColor: "rgba(124,58,237,0.20)",
                                }}
                            >
                                {copied ? (
                                    <Check size={18} color="#16a34a" />
                                ) : (
                                    <Copy size={18} color="#7c3aed" />
                                )}
                                <Text style={{ fontSize: 15, fontWeight: "600", color: copied ? "#16a34a" : "#7c3aed" }}>
                                    {copied ? "Copiado!" : "Copiar credenciais"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleShare}
                                activeOpacity={0.7}
                                accessibilityLabel="Compartilhar"
                                accessibilityRole="button"
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    backgroundColor: colors.surface.card,
                                    borderRadius: 14,
                                    paddingVertical: 16,
                                    borderWidth: 1,
                                    borderColor: colors.border.subtle,
                                }}
                            >
                                <Share2 size={18} color={colors.text.tertiary} />
                                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.tertiary }}>
                                    Compartilhar
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Done button */}
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity
                            onPress={onClose}
                            activeOpacity={0.7}
                            accessibilityLabel="Concluir"
                            accessibilityRole="button"
                            style={{
                                backgroundColor: "#7c3aed",
                                borderRadius: 14,
                                paddingVertical: 16,
                                alignItems: "center",
                                marginBottom: insets.bottom + 12,
                            }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                Concluir
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

