import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { AuthTheme } from "./authTheme";

interface ProgressBarsProps {
    count: number;
    activeIndex: number;
    dwellMs: number;
    theme: AuthTheme;
    /** Reduce Motion ou pausa → barras estáticas. */
    animate: boolean;
}

type Fill = "full" | "animating" | "empty";

function Bar({
    fill,
    dwellMs,
    animate,
    theme,
}: {
    fill: Fill;
    dwellMs: number;
    animate: boolean;
    theme: AuthTheme;
}) {
    const sx = useSharedValue(fill === "full" ? 1 : 0);

    useEffect(() => {
        if (fill === "full") {
            sx.value = animate ? withTiming(1, { duration: 200 }) : 1;
        } else if (fill === "animating") {
            sx.value = 0;
            if (animate) {
                sx.value = withTiming(1, {
                    duration: dwellMs,
                    easing: Easing.linear,
                });
            } else {
                sx.value = 1;
            }
        } else {
            sx.value = 0;
        }
    }, [fill, dwellMs, animate]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scaleX: sx.value }],
    }));

    return (
        <View style={[styles.track, { backgroundColor: theme.progressInactive }]}>
            <Animated.View
                style={[
                    styles.fill,
                    { backgroundColor: theme.progressActive },
                    animatedStyle,
                ]}
            />
        </View>
    );
}

export function ProgressBars({
    count,
    activeIndex,
    dwellMs,
    theme,
    animate,
}: ProgressBarsProps) {
    return (
        <View style={styles.row}>
            {Array.from({ length: count }).map((_, i) => {
                let fill: Fill = "empty";
                if (i < activeIndex) fill = "full";
                else if (i === activeIndex) fill = "animating";
                return (
                    <Bar
                        key={i}
                        fill={fill}
                        dwellMs={dwellMs}
                        animate={animate}
                        theme={theme}
                    />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        gap: 6,
        width: "100%",
    },
    track: {
        flex: 1,
        height: 2,
        borderRadius: 2,
        overflow: "hidden",
    },
    fill: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 2,
        transformOrigin: "left center",
    },
});
