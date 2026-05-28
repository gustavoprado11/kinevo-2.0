import React, { useCallback, useEffect, useState } from "react";
import {
    Linking,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import {
    ChevronRight,
    GraduationCap,
    LucideIcon,
    Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AuthTheme, FONT, useAuthTheme } from "./authTheme";
import { NeutralButton } from "./NeutralButton";

interface RoleChoiceSheetProps {
    visible: boolean;
    onClose: () => void;
}

type Role = "aluno" | "treinador";

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);

function RoleChoiceRow({
    icon: Icon,
    title,
    subtitle,
    selected,
    onPress,
    theme,
}: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    selected: boolean;
    onPress: () => void;
    theme: AuthTheme;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${title}. ${subtitle}`}
            style={({ pressed }) => [
                styles.row,
                {
                    borderColor: selected ? theme.brandBorder : theme.fieldBorder,
                    backgroundColor: selected ? theme.brandSoft : "transparent",
                },
                pressed && { opacity: 0.7 },
            ]}
        >
            <View style={styles.rowContent}>
                <View style={[styles.iconTile, { backgroundColor: theme.brandSoft }]}>
                    <Icon size={20} color={theme.brand} strokeWidth={2.2} />
                </View>
                <View style={styles.rowInfo}>
                    <Text style={[styles.rowTitle, { color: theme.fgPrimary }]}>
                        {title}
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.fgSecondary }]}>
                        {subtitle}
                    </Text>
                </View>
                <ChevronRight size={18} color={theme.fgTertiary} />
            </View>
        </Pressable>
    );
}

export function RoleChoiceSheet({ visible, onClose }: RoleChoiceSheetProps) {
    const theme = useAuthTheme();
    const [mounted, setMounted] = useState(visible);
    const [selected, setSelected] = useState<Role | null>(null);

    const backdrop = useSharedValue(0);
    const translateY = useSharedValue(32);
    const sheetOpacity = useSharedValue(0);

    const unmount = useCallback(() => setMounted(false), []);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            setSelected(null);
            backdrop.value = withTiming(1, { duration: 240, easing: EXPO });
            translateY.value = withTiming(0, { duration: 380, easing: EXPO });
            sheetOpacity.value = withTiming(1, { duration: 380, easing: EXPO });
        } else if (mounted) {
            backdrop.value = withTiming(0, { duration: 280, easing: EXPO });
            sheetOpacity.value = withTiming(0, { duration: 280, easing: EXPO });
            translateY.value = withTiming(
                32,
                { duration: 280, easing: EXPO },
                (finished) => {
                    if (finished) runOnJS(unmount)();
                },
            );
        }
    }, [visible]);

    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
    const sheetStyle = useAnimatedStyle(() => ({
        opacity: sheetOpacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    const handleAluno = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        onClose();
    }, [onClose]);

    const handleTreinador = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        const webUrl =
            process.env.EXPO_PUBLIC_WEB_URL ?? "https://www.kinevoapp.com";
        Linking.openURL(`${webUrl}/signup?ref=mobile`).catch(() => {});
        onClose();
    }, [onClose]);

    const handleContinue = useCallback(() => {
        if (selected === "aluno") handleAluno();
        else if (selected === "treinador") handleTreinador();
    }, [selected, handleAluno, handleTreinador]);

    if (!mounted) return null;

    return (
        <Modal
            visible
            transparent
            animationType="none"
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={onClose}
                        accessibilityLabel="Fechar"
                    />
                </Animated.View>

                <Animated.View
                    style={[
                        styles.sheet,
                        { backgroundColor: theme.sheetSurface },
                        sheetStyle,
                    ]}
                >
                    <View style={[styles.handle, { backgroundColor: theme.handle }]} />

                    <Text style={[styles.eyebrow, { color: theme.brand }]}>
                        BEM-VINDO AO KINEVO
                    </Text>
                    <Text style={[styles.title, { color: theme.fgPrimary }]}>
                        Como você usa?
                    </Text>
                    <Text style={[styles.lede, { color: theme.fgSecondary }]}>
                        O Kinevo conecta alunos e treinadores numa plataforma só.
                        Escolha como você usa.
                    </Text>

                    <View style={styles.rows}>
                        <RoleChoiceRow
                            icon={GraduationCap}
                            title="Sou aluno"
                            subtitle="Peça um convite ao seu personal para começar."
                            selected={selected === "aluno"}
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                setSelected("aluno");
                            }}
                            theme={theme}
                        />
                        <RoleChoiceRow
                            icon={Users}
                            title="Sou treinador"
                            subtitle="Crie sua conta em kinevo.app e gerencie alunos."
                            selected={selected === "treinador"}
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                setSelected("treinador");
                            }}
                            theme={theme}
                        />
                    </View>

                    <NeutralButton
                        label="Continuar"
                        onPress={handleContinue}
                        theme={theme}
                        disabled={selected === null}
                    />

                    <Pressable
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Fechar"
                        style={styles.dismissWrap}
                    >
                        <Text style={[styles.dismiss, { color: theme.fgTertiary }]}>
                            Fechar
                        </Text>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.40)",
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 24,
        paddingBottom: 40,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -20 },
        shadowOpacity: 0.18,
        shadowRadius: 40,
        elevation: 24,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 4,
        alignSelf: "center",
        marginBottom: 22,
    },
    eyebrow: {
        fontFamily: FONT.bold,
        fontWeight: "700",
        fontSize: 11,
        letterSpacing: 2,
        marginBottom: 10,
    },
    title: {
        fontFamily: FONT.extrabold,
        fontWeight: "800",
        fontSize: 28,
        letterSpacing: -0.7,
        lineHeight: 31,
        marginBottom: 8,
    },
    lede: {
        fontFamily: FONT.medium,
        fontWeight: "500",
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 24,
    },
    rows: {
        gap: 10,
        marginBottom: 24,
    },
    row: {
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
    },
    rowContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    iconTile: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    rowInfo: {
        flex: 1,
    },
    rowTitle: {
        fontFamily: FONT.bold,
        fontWeight: "700",
        fontSize: 16,
        letterSpacing: -0.16,
        marginBottom: 3,
    },
    rowSub: {
        fontFamily: FONT.medium,
        fontWeight: "500",
        fontSize: 13,
        lineHeight: 18,
    },
    dismissWrap: {
        marginTop: 16,
        alignSelf: "center",
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    dismiss: {
        fontFamily: FONT.medium,
        fontWeight: "500",
        fontSize: 14,
    },
});
