import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { AuthTheme, FONT } from "./authTheme";
import { Phrase, RotatingHeadline } from "./RotatingHeadline";
import { ProgressBars } from "./ProgressBars";

interface EditorialHeaderProps {
    mode: "login" | "signup" | "static";
    eyebrow: string;
    theme: AuthTheme;
    reduceMotion: boolean;
    /** login: frases rotativas. */
    phrases?: Phrase[];
    activeIndex?: number;
    dwellMs?: number;
    /** signup/static: headline fixo. */
    staticHeadline?: Phrase;
    rightSlot?: React.ReactNode;
    /** Teclado aberto → eyebrow/progress somem, headline esmaece (spec §3.4). */
    keyboardOpen?: boolean;
}

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);

export function EditorialHeader({
    mode,
    eyebrow,
    theme,
    reduceMotion,
    phrases,
    activeIndex = 0,
    dwellMs = 3500,
    staticHeadline,
    rightSlot,
    keyboardOpen = false,
}: EditorialHeaderProps) {
    const chromeOpacity = useSharedValue(1);
    const headlineOpacity = useSharedValue(1);

    useEffect(() => {
        chromeOpacity.value = withTiming(keyboardOpen ? 0 : 1, {
            duration: 280,
            easing: EXPO,
        });
        headlineOpacity.value = withTiming(keyboardOpen ? 0.4 : 1, {
            duration: 280,
            easing: EXPO,
        });
    }, [keyboardOpen]);

    const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));
    const headlineStyle = useAnimatedStyle(() => ({
        opacity: headlineOpacity.value,
    }));

    const isLogin = mode === "login" && phrases && phrases.length > 0;
    const headlineSize = 44;

    return (
        <View style={styles.container}>
            {/* Wordmark row */}
            <View style={styles.wordmarkRow}>
                <View style={styles.wordmarkLeft}>
                    <View style={styles.logoTile}>
                        <Image
                            source={require("../../assets/images/logo-icon.jpg")}
                            style={styles.logoImage}
                            resizeMode="cover"
                        />
                    </View>
                    <Text style={[styles.wordmark, { color: theme.fgPrimary }]}>
                        KINEVO
                    </Text>
                </View>
                {rightSlot}
            </View>

            {/* Eyebrow */}
            <Animated.Text
                style={[styles.eyebrow, { color: theme.fgTertiary }, chromeStyle]}
            >
                {eyebrow}
            </Animated.Text>

            {/* Headline */}
            <Animated.View style={[styles.headlineWrap, headlineStyle]}>
                {isLogin ? (
                    <RotatingHeadline
                        phrases={phrases!}
                        activeIndex={activeIndex}
                        theme={theme}
                        reduceMotion={reduceMotion}
                        fontSize={headlineSize}
                    />
                ) : staticHeadline ? (
                    <View>
                        <Text
                            style={[
                                styles.staticLine,
                                {
                                    color: theme.fgPrimary,
                                    fontSize: headlineSize,
                                    lineHeight: Math.round(headlineSize * 1.08),
                                    letterSpacing: -headlineSize * 0.035,
                                },
                            ]}
                        >
                            {staticHeadline.lead}
                        </Text>
                        <Text
                            style={[
                                styles.staticLine,
                                {
                                    color: theme.brand,
                                    fontSize: headlineSize,
                                    lineHeight: Math.round(headlineSize * 1.08),
                                    letterSpacing: -headlineSize * 0.035,
                                },
                            ]}
                        >
                            {staticHeadline.accent}
                        </Text>
                    </View>
                ) : null}
            </Animated.View>

            {/* Progress bars (login only) */}
            {isLogin && (
                <Animated.View style={[styles.progressWrap, chromeStyle]}>
                    <ProgressBars
                        count={phrases!.length}
                        activeIndex={activeIndex}
                        dwellMs={dwellMs}
                        theme={theme}
                        animate={!reduceMotion && !keyboardOpen}
                    />
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
    },
    wordmarkRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 32,
    },
    wordmarkLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    logoTile: {
        width: 28,
        height: 28,
        borderRadius: 8,
        overflow: "hidden",
    },
    logoImage: {
        width: "100%",
        height: "100%",
    },
    wordmark: {
        fontFamily: FONT.extrabold,
        fontWeight: "800",
        fontSize: 14,
        letterSpacing: 3, // ~0.22em
    },
    eyebrow: {
        fontFamily: FONT.bold,
        fontWeight: "700",
        fontSize: 11,
        letterSpacing: 2, // ~0.18em
        marginBottom: 18,
    },
    headlineWrap: {
        width: "100%",
    },
    staticLine: {
        fontFamily: FONT.extrabold,
        fontWeight: "800",
    },
    progressWrap: {
        marginTop: 20,
    },
});
