import { useCallback, useState } from "react";
import * as Haptics from "expo-haptics";
import type {
    PrescriptionAgentQuestion,
    PrescriptionAgentState,
    PrescriptionContextAnalysis,
    PrescriptionOutputSnapshot,
} from "@kinevo/shared/types/prescription";
import { analyzeContext, generateProgram, AIPrescriptionFetchError } from "../lib/ai-prescription/fetch-client";

export type AgentPageState =
    | "anamnese"
    | "analyzing"
    | "questions"
    | "generating"
    | "done"
    | "error";

export interface AgentResult {
    generationId: string;
    outputSnapshot: PrescriptionOutputSnapshot;
}

export interface UseAIPrescriptionAgentOptions {
    onSuccess: (result: AgentResult) => void;
}

export interface UseAIPrescriptionAgentReturn {
    pageState: AgentPageState;
    agentState: PrescriptionAgentState | null;
    analysis: PrescriptionContextAnalysis | null;
    questions: PrescriptionAgentQuestion[];
    answers: Record<string, string>;
    error: string | null;
    result: AgentResult | null;

    setAnswer: (questionId: string, answer: string) => void;
    startAnalysis: () => Promise<void>;
    submitAnswersAndGenerate: () => Promise<void>;
    skipQuestionsAndGenerate: () => Promise<void>;
    reset: () => void;
}

/**
 * Mobile mirror of the web's `usePrescriptionAgent`. Drives the 5-step flow:
 *
 *   anamnese → analyzing → (questions →) generating → done
 *
 * - `startAnalysis` triggers `/api/prescription/analyze`. Zero-question
 *   responses skip straight to `generating` (parity with the web hook).
 * - `submitAnswersAndGenerate` and `skipQuestionsAndGenerate` both call
 *   `/api/prescription/generate` with the produced `agentState`.
 * - On success, the hook calls `options.onSuccess({ generationId, outputSnapshot })`
 *   so the consumer (the AIPrescriptionSheet) can hydrate the program builder
 *   and dismiss the sheet.
 *
 * V1 sends `selectedFormIds: []` always — form selection in the anamnese is a
 * future increment.
 */
export function useAIPrescriptionAgent(
    studentId: string,
    options: UseAIPrescriptionAgentOptions,
): UseAIPrescriptionAgentReturn {
    const { onSuccess } = options;

    const [pageState, setPageState] = useState<AgentPageState>("anamnese");
    const [agentState, setAgentState] = useState<PrescriptionAgentState | null>(null);
    const [analysis, setAnalysis] = useState<PrescriptionContextAnalysis | null>(null);
    const [questions, setQuestions] = useState<PrescriptionAgentQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AgentResult | null>(null);

    const setAnswer = useCallback((questionId: string, answer: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    }, []);

    const reset = useCallback(() => {
        setPageState("anamnese");
        setAgentState(null);
        setAnalysis(null);
        setQuestions([]);
        setAnswers({});
        setError(null);
        setResult(null);
    }, []);

    const executeGeneration = useCallback(
        async (state: PrescriptionAgentState | null) => {
            try {
                const response = await generateProgram(studentId, state, []);
                if (!response.success || !response.generationId || !response.outputSnapshot) {
                    setError(response.error || "Erro ao gerar programa.");
                    setPageState("error");
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                    return;
                }
                const r: AgentResult = {
                    generationId: response.generationId,
                    outputSnapshot: response.outputSnapshot,
                };
                setResult(r);
                setPageState("done");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                onSuccess(r);
            } catch (err) {
                const message =
                    err instanceof AIPrescriptionFetchError
                        ? err.message
                        : err instanceof Error
                            ? err.message
                            : "Erro inesperado.";
                setError(message);
                setPageState("error");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            }
        },
        [studentId, onSuccess],
    );

    const startAnalysis = useCallback(async () => {
        setError(null);
        setPageState("analyzing");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        try {
            const response = await analyzeContext(studentId, []);
            if (!response.success) {
                setError(response.error || "Erro na análise.");
                setPageState("error");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                return;
            }

            setAnalysis(response.analysis ?? null);
            setAgentState(response.agentState ?? null);

            const qs = response.questions ?? [];
            if (qs.length === 0) {
                // No conversational questions to ask — go straight to generation.
                setPageState("generating");
                await executeGeneration(response.agentState ?? null);
                return;
            }
            setQuestions(qs);
            setPageState("questions");
        } catch (err) {
            const message =
                err instanceof AIPrescriptionFetchError
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : "Erro inesperado.";
            setError(message);
            setPageState("error");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
    }, [studentId, executeGeneration]);

    const submitAnswersAndGenerate = useCallback(async () => {
        if (!agentState) return;

        const answersArray = questions.map((q) => ({
            question_id: q.id,
            answer: answers[q.id] || "",
        }));

        const updatedState: PrescriptionAgentState = {
            ...agentState,
            answers: answersArray,
            phase: "generating",
        };

        setAgentState(updatedState);
        setPageState("generating");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await executeGeneration(updatedState);
    }, [agentState, questions, answers, executeGeneration]);

    const skipQuestionsAndGenerate = useCallback(async () => {
        const stateForGeneration: PrescriptionAgentState | null = agentState
            ? { ...agentState, answers: [], phase: "generating" }
            : null;

        setAgentState(stateForGeneration);
        setPageState("generating");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await executeGeneration(stateForGeneration);
    }, [agentState, executeGeneration]);

    return {
        pageState,
        agentState,
        analysis,
        questions,
        answers,
        error,
        result,

        setAnswer,
        startAnalysis,
        submitAnswersAndGenerate,
        skipQuestionsAndGenerate,
        reset,
    };
}
