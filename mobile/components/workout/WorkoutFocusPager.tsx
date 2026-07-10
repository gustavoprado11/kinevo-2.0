/**
 * WorkoutFocusPager — pager horizontal (uma página por item de trabalho) do modo
 * Foco. ScrollView horizontal com pagingEnabled (JS puro). Cada página é um
 * ScrollView vertical (a área de séries rola dentro). Índice CONTROLADO: o botão
 * "Próximo" muda `index` (o pager rola até lá, animado); o swipe reporta via
 * onIndexChange. Ao trocar de página, a nova começa no topo. Fase 3.
 *
 * Transição (design "Um por vez"): o conteúdo de cada página tem opacidade+escala
 * interpoladas pela posição do scroll horizontal — efeito de carrossel (o exercício
 * que sai esmaece/encolhe, o que entra foca/cresce). Como o botão usa scrollTo
 * ANIMADO, o mesmo `scrollX` dirige a transição tanto no swipe quanto no botão.
 *
 * A barra "Voltar/Próximo" fixa vem separada (WorkoutFocusNav), fora do pager.
 */
import React, { useEffect, useRef } from 'react';
import { View, ScrollView, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated';

interface WorkoutFocusPagerProps {
    /** Conteúdo de cada página (já renderizado pelo caller, que tem os callbacks). */
    pages: React.ReactNode[];
    index: number;
    onIndexChange: (index: number) => void;
    /** Padding de baixo (folga acima da barra fixa). */
    pageBottomPadding?: number;
}

function FocusPage({
    pageIndex, scrollX, width, pageBottomPadding, registerRef, children,
}: {
    pageIndex: number;
    scrollX: SharedValue<number>;
    width: number;
    pageBottomPadding: number;
    registerRef: (ref: ScrollView | null) => void;
    children: React.ReactNode;
}) {
    const style = useAnimatedStyle(() => {
        const inputRange = [(pageIndex - 1) * width, pageIndex * width, (pageIndex + 1) * width];
        return {
            opacity: interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP),
            transform: [{ scale: interpolate(scrollX.value, inputRange, [0.93, 1, 0.93], Extrapolation.CLAMP) }],
        };
    });
    return (
        <Animated.View style={[{ width }, style]}>
            <ScrollView
                ref={registerRef}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: pageBottomPadding }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {children}
            </ScrollView>
        </Animated.View>
    );
}

export function WorkoutFocusPager({ pages, index, onIndexChange, pageBottomPadding = 24 }: WorkoutFocusPagerProps) {
    const { width } = useWindowDimensions();
    const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
    const lastReported = useRef(index);
    const innerRefs = useRef<Record<number, ScrollView | null>>({});
    const scrollX = useSharedValue(index * width);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => { scrollX.value = e.contentOffset.x; },
    });

    // A página de destino começa no topo.
    const enterPage = (i: number) => {
        innerRefs.current[i]?.scrollTo({ y: 0, animated: false });
    };

    // Índice controlado → rola o pager (animado) quando muda por fora (botão).
    useEffect(() => {
        if (index !== lastReported.current) {
            lastReported.current = index;
            scrollRef.current?.scrollTo({ x: index * width, animated: true });
            enterPage(index);
        }
    }, [index, width]);

    const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const i = Math.round(e.nativeEvent.contentOffset.x / width);
        if (i !== lastReported.current) {
            lastReported.current = i;
            enterPage(i);
            onIndexChange(i);
        }
    };

    return (
        <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumEnd}
            keyboardShouldPersistTaps="handled"
            // Começa já na página do exercício atual (evita flash da página 0 no iOS).
            contentOffset={{ x: index * width, y: 0 }}
            style={{ flex: 1 }}
        >
            {pages.map((page, i) => (
                <FocusPage
                    key={i}
                    pageIndex={i}
                    scrollX={scrollX}
                    width={width}
                    pageBottomPadding={pageBottomPadding}
                    registerRef={(r) => { innerRefs.current[i] = r; }}
                >
                    {page}
                </FocusPage>
            ))}
        </Animated.ScrollView>
    );
}
