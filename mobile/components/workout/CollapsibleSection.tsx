/**
 * CollapsibleSection — corpo colapsável animado (Reanimated, thread de UI).
 * Padrão do acordeão do modo Lista: `expanded` troca → altura + opacidade abrem/
 * fecham com SPRING. Usado pelo ExecutionExerciseCard e pelo superset.
 *
 * O conteúdo fica SEMPRE montado (medido por onLayout num filho `position:absolute`,
 * que mede a altura natural mesmo com o pai clipado a 0) e é clipado por
 * `overflow:hidden` — sombra/anel de foco devem ficar FORA, no card pai. Como a
 * altura animada é layout real, a lista abaixo reflui sozinha, quadro a quadro.
 * O primeiro layout fixa o estado SEM animar (evita flash ao entrar na tela).
 *
 * LayoutAnimation NÃO serve aqui: é no-op na New Architecture (Fabric).
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const SPRING = { damping: 16, stiffness: 165, mass: 0.6 };

interface CollapsibleSectionProps {
    expanded: boolean;
    children: React.ReactNode;
}

export function CollapsibleSection({ expanded, children }: CollapsibleSectionProps) {
    const progress = useSharedValue(expanded ? 1 : 0);
    const contentHeight = useSharedValue(0);
    const measured = useRef(false);

    useEffect(() => {
        if (!measured.current) return;
        progress.value = withSpring(expanded ? 1 : 0, SPRING);
    }, [expanded, progress]);

    const style = useAnimatedStyle(() => ({
        height: contentHeight.value * progress.value,
        opacity: progress.value,
    }));

    const onBodyLayout = (h: number) => {
        if (h > 0) contentHeight.value = h;
        if (!measured.current) {
            measured.current = true;
            progress.value = expanded ? 1 : 0;
        }
    };

    return (
        <Animated.View style={[{ overflow: 'hidden' }, style]} pointerEvents={expanded ? 'auto' : 'none'}>
            <View
                style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
                onLayout={(e) => onBodyLayout(e.nativeEvent.layout.height)}
            >
                {children}
            </View>
        </Animated.View>
    );
}
