/**
 * WorkoutFocusPager — pager horizontal (uma página por item de trabalho) do modo
 * Foco. ScrollView horizontal com pagingEnabled (JS puro — sem dep nativa nova;
 * roda no dev build atual). Cada página é um ScrollView vertical (a área de
 * séries rola dentro). Índice CONTROLADO: o botão "Próximo" muda `index` (o pager
 * rola até lá); o swipe reporta via onIndexChange. Fase 3.
 *
 * A barra "Voltar/Próximo" fixa vem separada (WorkoutFocusNav), fora do pager,
 * para nunca sumir atrás do scroll.
 *
 * Fase 5 (polish do colapso): ao TROCAR de página, a nova página começa colapsada
 * e no topo. Dois cuidados garantem isso:
 *  1. `enterPage` zera o `scrollY` (player) E leva a lista de destino ao topo.
 *  2. Só a página ATIVA escreve em `scrollY` (guarda `activeIndex`). Sem isso, a
 *     página que acabou de sair — ainda desacelerando do scroll — continuava
 *     gravando seu offset antigo e "ressuscitava" o player crescido logo após o
 *     reset (o bug clássico: colapsava só quando a nova página era rolada).
 */
import React, { useEffect, useRef } from 'react';
import { View, ScrollView, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';

/** Só precisamos do scrollTo imperativo do ScrollView interno de cada página. */
type VerticalScrollable = { scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void };

interface WorkoutFocusPagerProps {
    /** Conteúdo de cada página (já renderizado pelo caller, que tem os callbacks). */
    pages: React.ReactNode[];
    index: number;
    onIndexChange: (index: number) => void;
    /** Padding de baixo (deixa espaço acima da barra fixa / player). */
    pageBottomPadding?: number;
    /** Scroll vertical da página ATIVA → alimenta o player crescente (Fase 4). */
    scrollY?: SharedValue<number>;
}

/** Uma página do pager: ScrollView vertical cujo scroll só alimenta `scrollY`
 *  quando esta página é a ativa (`activeIndex === pageIndex`). */
function FocusPage({
    pageIndex, activeIndex, scrollY, width, pageBottomPadding, registerRef, children,
}: {
    pageIndex: number;
    activeIndex: SharedValue<number>;
    scrollY?: SharedValue<number>;
    width: number;
    pageBottomPadding: number;
    registerRef: (ref: VerticalScrollable | null) => void;
    children: React.ReactNode;
}) {
    const handler = useAnimatedScrollHandler({
        onScroll: (e) => {
            if (scrollY && activeIndex.value === pageIndex) scrollY.value = e.contentOffset.y;
        },
    });
    return (
        <View style={{ width }}>
            <Animated.ScrollView
                ref={(r) => registerRef((r as unknown as VerticalScrollable) ?? null)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: pageBottomPadding }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={handler}
                scrollEventThrottle={16}
            >
                {children}
            </Animated.ScrollView>
        </View>
    );
}

export function WorkoutFocusPager({ pages, index, onIndexChange, pageBottomPadding = 24, scrollY }: WorkoutFocusPagerProps) {
    const { width } = useWindowDimensions();
    const scrollRef = useRef<ScrollView>(null);
    const lastReported = useRef(index);
    const innerRefs = useRef<Record<number, VerticalScrollable | null>>({});
    const activeIndex = useSharedValue(index);

    // A página de destino começa colapsada e no topo: marca a nova ativa (só ela
    // passa a escrever no scrollY), zera o player e leva a lista ao topo.
    const enterPage = (i: number) => {
        activeIndex.value = i;
        if (scrollY) scrollY.value = 0;
        const ref = innerRefs.current[i];
        if (ref && typeof ref.scrollTo === 'function') ref.scrollTo({ y: 0, animated: false });
    };

    // Índice controlado → rola o pager quando muda por fora (botão Próximo/Voltar).
    useEffect(() => {
        if (index !== lastReported.current) {
            lastReported.current = index;
            scrollRef.current?.scrollTo({ x: index * width, animated: true });
            enterPage(index);
        }
    }, [index, width, scrollY]);

    const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const i = Math.round(e.nativeEvent.contentOffset.x / width);
        if (i !== lastReported.current) {
            lastReported.current = i;
            enterPage(i);
            onIndexChange(i);
        }
    };

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
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
                    activeIndex={activeIndex}
                    scrollY={scrollY}
                    width={width}
                    pageBottomPadding={pageBottomPadding}
                    registerRef={(ref) => { innerRefs.current[i] = ref; }}
                >
                    {page}
                </FocusPage>
            ))}
        </ScrollView>
    );
}
