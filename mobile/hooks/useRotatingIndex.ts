import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

interface RotatingIndexOptions {
    count: number;
    dwellMs: number;
    /** Pausa o timer (ex: teclado aberto). */
    paused?: boolean;
    /** Reduce Motion → congela na frase 0. */
    reduceMotion?: boolean;
}

/**
 * Índice rotativo controlado por JS (spec §3.1).
 * Pausa quando o app vai para background e reseta para 0 ao retornar.
 */
export function useRotatingIndex({
    count,
    dwellMs,
    paused = false,
    reduceMotion = false,
}: RotatingIndexOptions): number {
    const [index, setIndex] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (reduceMotion) {
            setIndex(0);
            return;
        }
        if (paused || count <= 1) {
            return;
        }
        intervalRef.current = setInterval(() => {
            setIndex((i) => (i + 1) % count);
        }, dwellMs);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [count, dwellMs, paused, reduceMotion]);

    useEffect(() => {
        const sub = AppState.addEventListener("change", (state) => {
            if (state !== "active") {
                setIndex(0);
            }
        });
        return () => sub.remove();
    }, []);

    return index;
}
