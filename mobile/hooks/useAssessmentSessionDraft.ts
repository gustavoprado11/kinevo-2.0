import { useCallback, useMemo } from 'react';
import { useAssessmentDraftStore, type AssessmentDraft } from '../stores/assessmentDraftStore';
import type { MeasurementInput } from '@kinevo/shared/types/assessments';

/**
 * Per-session draft view of `assessmentDraftStore`. Stable callbacks bound
 * to a specific sessionId — pass to wizard/inputs without re-deriving in
 * each render.
 *
 * Returns `draft = undefined` when no draft exists for this id (caller
 * decides whether to upsert one).
 */
export function useAssessmentSessionDraft(sessionId: string | null) {
    const draft = useAssessmentDraftStore((s) =>
        sessionId ? s.drafts[sessionId] : undefined,
    );

    const appendMeasurement = useAssessmentDraftStore((s) => s.appendMeasurement);
    const replaceMeasurementsForTest = useAssessmentDraftStore((s) => s.replaceMeasurementsForTest);
    const setAttempts = useAssessmentDraftStore((s) => s.setAttempts);
    const clearAttemptsBuffer = useAssessmentDraftStore((s) => s.clearAttemptsBuffer);
    const setCurrentTestId = useAssessmentDraftStore((s) => s.setCurrentTestId);
    const setNotes = useAssessmentDraftStore((s) => s.setNotes);
    const markSynced = useAssessmentDraftStore((s) => s.markSynced);
    const removeDraft = useAssessmentDraftStore((s) => s.removeDraft);

    const append = useCallback(
        (m: MeasurementInput) => {
            if (!sessionId) return;
            appendMeasurement(sessionId, m);
        },
        [sessionId, appendMeasurement],
    );

    const replaceForTest = useCallback(
        (testId: string, measurements: MeasurementInput[]) => {
            if (!sessionId) return;
            replaceMeasurementsForTest(sessionId, testId, measurements);
        },
        [sessionId, replaceMeasurementsForTest],
    );

    const updateAttempts = useCallback(
        (testId: string, attempts: number[]) => {
            if (!sessionId) return;
            setAttempts(sessionId, testId, attempts);
        },
        [sessionId, setAttempts],
    );

    const clearAttempts = useCallback(
        (testId: string) => {
            if (!sessionId) return;
            clearAttemptsBuffer(sessionId, testId);
        },
        [sessionId, clearAttemptsBuffer],
    );

    const setCurrentTest = useCallback(
        (testId: string | null) => {
            if (!sessionId) return;
            setCurrentTestId(sessionId, testId);
        },
        [sessionId, setCurrentTestId],
    );

    const updateNotes = useCallback(
        (notes: string) => {
            if (!sessionId) return;
            setNotes(sessionId, notes);
        },
        [sessionId, setNotes],
    );

    const flushSynced = useCallback(
        (syncedAtISO?: string) => {
            if (!sessionId) return;
            markSynced(sessionId, syncedAtISO);
        },
        [sessionId, markSynced],
    );

    const discard = useCallback(() => {
        if (!sessionId) return;
        removeDraft(sessionId);
    }, [sessionId, removeDraft]);

    const measurementCount = draft?.measurements.length ?? 0;
    const isDirty = draft?.is_dirty ?? false;

    return useMemo(
        () => ({
            draft,
            measurementCount,
            isDirty,
            append,
            replaceForTest,
            updateAttempts,
            clearAttempts,
            setCurrentTest,
            updateNotes,
            flushSynced,
            discard,
        }),
        [
            draft,
            measurementCount,
            isDirty,
            append,
            replaceForTest,
            updateAttempts,
            clearAttempts,
            setCurrentTest,
            updateNotes,
            flushSynced,
            discard,
        ],
    );
}

export type { AssessmentDraft };
