import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Linking,
    Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Key, Check, Copy, X } from "lucide-react-native";
import { colors } from "@/theme";
import { toast } from "@/lib/toast";
import { useResetStudentPassword } from "@/hooks/useResetStudentPassword";
import {
    buildWhatsAppMessage,
    sanitizePhoneForWhatsApp,
    buildWhatsAppUrl,
} from "@/lib/resetPasswordMessage";

interface ResetPasswordModalProps {
    visible: boolean;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentPhone: string | null;
    onClose: () => void;
}

export function ResetPasswordModal({
    visible,
    studentId,
    studentName,
    studentEmail,
    studentPhone,
    onClose,
}: ResetPasswordModalProps) {
    const { resetPassword, isResetting } = useResetStudentPassword();
    const [newPassword, setNewPassword] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!visible) {
            setNewPassword(null);
            setError(null);
            setIsCopied(false);
            if (copiedTimeoutRef.current) {
                clearTimeout(copiedTimeoutRef.current);
                copiedTimeoutRef.current = null;
            }
        }
    }, [visible]);

    useEffect(() => {
        return () => {
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        };
    }, []);

    const handleConfirm = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setError(null);
        const result = await resetPassword(studentId);
        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setNewPassword(result.newPassword);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setError(result.error);
        }
    }, [resetPassword, studentId]);

    const handleCopyOrShare = useCallback(async () => {
        if (!newPassword) return;
        const message = buildWhatsAppMessage({
            studentName,
            email: studentEmail,
            password: newPassword,
        });

        await Clipboard.setStringAsync(message);

        const sanitized = sanitizePhoneForWhatsApp(studentPhone);
        const url = buildWhatsAppUrl(sanitized, message);

        let openedWhatsApp = false;
        if (url) {
            try {
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                    await Linking.openURL(url);
                    openedWhatsApp = true;
                }
            } catch {
                openedWhatsApp = false;
            }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsCopied(true);
        if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);

        if (openedWhatsApp) {
            toast.success("Mensagem copiada", "Abrindo WhatsApp…");
        } else if (url) {
            toast.info("Mensagem copiada", "WhatsApp não disponível. Cole no app para enviar.");
        } else {
            toast.info("Mensagem copiada", "Cole no WhatsApp para enviar.");
        }
    }, [newPassword, studentName, studentEmail, studentPhone]);

    const handleRequestClose = useCallback(() => {
        if (isResetting) return;
        onClose();
    }, [isResetting, onClose]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleRequestClose}
            statusBarTranslucent
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.55)",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 20,
                }}
            >
                <View
                    style={{
                        width: "100%",
                        maxWidth: 420,
                        backgroundColor: colors.background.card,
                        borderRadius: 20,
                        padding: 28,
                        ...(Platform.OS === "ios"
                            ? {
                                  shadowColor: "#000",
                                  shadowOffset: { width: 0, height: 10 },
                                  shadowOpacity: 0.2,
                                  shadowRadius: 20,
                              }
                            : { elevation: 12 }),
                    }}
                >
                    {/* Close (only when not resetting) */}
                    {!isResetting && (
                        <TouchableOpacity
                            onPress={handleRequestClose}
                            accessibilityRole="button"
                            accessibilityLabel="Fechar"
                            style={{
                                position: "absolute",
                                top: 12,
                                right: 12,
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <X size={18} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}

                    {!newPassword ? (
                        <>
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    backgroundColor: colors.brand.primaryLight,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    alignSelf: "center",
                                    marginBottom: 18,
                                }}
                            >
                                <Key size={24} color={colors.brand.primary} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontWeight: "700",
                                    color: colors.text.primary,
                                    textAlign: "center",
                                    marginBottom: 10,
                                }}
                            >
                                Gerar nova senha?
                            </Text>
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: colors.text.secondary,
                                    textAlign: "center",
                                    marginBottom: 22,
                                    lineHeight: 20,
                                }}
                            >
                                Tem certeza que deseja redefinir a senha de{" "}
                                <Text style={{ color: colors.text.primary, fontWeight: "600" }}>
                                    {studentName}
                                </Text>
                                ? A senha atual deixará de funcionar imediatamente.
                            </Text>

                            {error && (
                                <View
                                    style={{
                                        backgroundColor: colors.error.light,
                                        borderRadius: 10,
                                        padding: 12,
                                        marginBottom: 16,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: colors.error.default,
                                            fontSize: 13,
                                            textAlign: "center",
                                        }}
                                    >
                                        {error}
                                    </Text>
                                </View>
                            )}

                            <View style={{ flexDirection: "row", gap: 12 }}>
                                <TouchableOpacity
                                    onPress={handleRequestClose}
                                    disabled={isResetting}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancelar"
                                    style={{
                                        flex: 1,
                                        paddingVertical: 14,
                                        borderRadius: 12,
                                        backgroundColor: colors.status.inactiveBg,
                                        alignItems: "center",
                                        opacity: isResetting ? 0.5 : 1,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: colors.text.primary,
                                        }}
                                    >
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleConfirm}
                                    disabled={isResetting}
                                    accessibilityRole="button"
                                    accessibilityLabel="Sim, gerar"
                                    style={{
                                        flex: 1,
                                        paddingVertical: 14,
                                        borderRadius: 12,
                                        backgroundColor: colors.brand.primary,
                                        alignItems: "center",
                                        flexDirection: "row",
                                        justifyContent: "center",
                                        gap: 8,
                                        opacity: isResetting ? 0.7 : 1,
                                    }}
                                >
                                    {isResetting ? (
                                        <>
                                            <ActivityIndicator size="small" color={colors.text.inverse} />
                                            <Text
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: "600",
                                                    color: colors.text.inverse,
                                                }}
                                            >
                                                Gerando
                                            </Text>
                                        </>
                                    ) : (
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                fontWeight: "600",
                                                color: colors.text.inverse,
                                            }}
                                        >
                                            Sim, gerar
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    backgroundColor: colors.success.light,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    alignSelf: "center",
                                    marginBottom: 18,
                                }}
                            >
                                <Check size={24} color={colors.success.default} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontWeight: "700",
                                    color: colors.text.primary,
                                    textAlign: "center",
                                    marginBottom: 10,
                                }}
                            >
                                Senha gerada!
                            </Text>
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: colors.text.secondary,
                                    textAlign: "center",
                                    marginBottom: 18,
                                }}
                            >
                                A nova senha de acesso para este aluno é:
                            </Text>

                            <View
                                style={{
                                    backgroundColor: colors.status.inactiveBg,
                                    borderRadius: 12,
                                    paddingVertical: 18,
                                    paddingHorizontal: 16,
                                    alignItems: "center",
                                    marginBottom: 22,
                                }}
                            >
                                <Text
                                    selectable
                                    style={{
                                        fontFamily: Platform.select({
                                            ios: "Menlo",
                                            android: "monospace",
                                            default: "monospace",
                                        }),
                                        fontSize: 22,
                                        fontWeight: "700",
                                        color: colors.text.primary,
                                        letterSpacing: 1,
                                    }}
                                >
                                    {newPassword}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleCopyOrShare}
                                accessibilityRole="button"
                                accessibilityLabel="Copiar para WhatsApp"
                                style={{
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    backgroundColor: isCopied
                                        ? colors.success.default
                                        : colors.success.default,
                                    alignItems: "center",
                                    flexDirection: "row",
                                    justifyContent: "center",
                                    gap: 8,
                                    marginBottom: 10,
                                }}
                            >
                                {isCopied ? (
                                    <>
                                        <Check size={16} color={colors.text.inverse} />
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                fontWeight: "700",
                                                color: colors.text.inverse,
                                            }}
                                        >
                                            Copiado!
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} color={colors.text.inverse} />
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                fontWeight: "700",
                                                color: colors.text.inverse,
                                            }}
                                        >
                                            Copiar para WhatsApp
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={onClose}
                                accessibilityRole="button"
                                accessibilityLabel="Fechar"
                                style={{
                                    paddingVertical: 12,
                                    alignItems: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        fontWeight: "600",
                                        color: colors.text.secondary,
                                    }}
                                >
                                    Fechar
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}
