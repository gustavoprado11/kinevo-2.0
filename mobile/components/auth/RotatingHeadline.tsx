import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { AuthTheme, FONT } from "./authTheme";

export interface Phrase {
    lead: string;
    accent: string;
}

interface RotatingHeadlineProps {
    phrases: Phrase[];
    activeIndex: number;
    theme: AuthTheme;
    reduceMotion: boolean;
    /** Tamanho do display (login: 56, signup estático: 48). */
    fontSize?: number;
}

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);

function usePrevious(value: number): number {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

type PhraseState = "active" | "prev" | "hidden";

function PhraseLayer({
    phrase,
    state,
    theme,
    reduceMotion,
    fontSize,
}: {
    phrase: Phrase;
    state: PhraseState;
    theme: AuthTheme;
    reduceMotion: boolean;
    fontSize: number;
}) {
    const opacity = useSharedValue(state === "active" ? 1 : 0);
    const ty = useSharedValue(state === "active" ? 0 : 14);

    useEffect(() => {
        if (reduceMotion) {
            opacity.value = state === "active" ? 1 : 0;
            ty.value = 0;
            return;
        }
        if (state === "active") {
            ty.value = 14; // entra de baixo (+14)
            opacity.value = withTiming(1, { duration: 600, easing: EXPO });
            ty.value = withTiming(0, { duration: 700, easing: EXPO });
        } else if (state === "prev") {
            opacity.value = withTiming(0, { duration: 600, easing: EXPO });
            ty.value = withTiming(-14, { duration: 700, easing: EXPO }); // sai por cima (-14)
        } else {
            opacity.value = withTiming(0, { duration: 300, easing: EXPO });
            ty.value = 14;
        }
    }, [state, reduceMotion]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: ty.value }],
    }));

    const lineHeight = Math.round(fontSize * 1.08);
    const letterSpacing = -fontSize * 0.035;

    return (
        <Animated.View style={[styles.layer, animatedStyle]} pointerEvents="none">
            <Text
                style={[
                    styles.line,
                    { color: theme.fgPrimary, fontSize, lineHeight, letterSpacing },
                ]}
            >
                {phrase.lead}
            </Text>
            <Text
                style={[
                    styles.line,
                    { color: theme.brand, fontSize, lineHeight, letterSpacing },
                ]}
            >
                {phrase.accent}
            </Text>
        </Animated.View>
    );
}

export function RotatingHeadline({
    phrases,
    activeIndex,
    theme,
    reduceMotion,
    fontSize = 56,
}: RotatingHeadlineProps) {
    const prevIndex = usePrevious(activeIndex);
    const lineHeight = Math.round(fontSize * 1.08);
    const current = phrases[activeIndex];

    // Altura fixa para 3 linhas: o lead ocupa 1 e o acento pode quebrar em 2
    // (ex: "ao seu personal."). Garante que as barras nunca cruzem o texto.
    return (
        <View
            style={[styles.container, { height: lineHeight * 3 }]}
            accessible
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${current.lead} ${current.accent}`}
        >
            {phrases.map((phrase, i) => {
                let state: PhraseState = "hidden";
                if (i === activeIndex) state = "active";
                else if (i === prevIndex) state = "prev";
                return (
                    <PhraseLayer
                        key={i}
                        phrase={phrase}
                        state={state}
                        theme={theme}
                        reduceMotion={reduceMotion}
                        fontSize={fontSize}
                    />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "relative",
        width: "100%",
    },
    layer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
    },
    line: {
        fontFamily: FONT.extrabold,
        fontWeight: "800",
    },
});
