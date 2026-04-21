import { supabase } from "../supabase";
import type {
    PrescriptionAgentQuestion,
    PrescriptionAgentState,
    PrescriptionContextAnalysis,
    PrescriptionOutputSnapshot,
} from "@kinevo/shared/types/prescription";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

// ============================================================================
// Response shapes (mirroring the web routes Fase 2a/2b)
// ============================================================================

export interface AnalyzeContextResponse {
    success: boolean;
    error?: string;
    analysis?: PrescriptionContextAnalysis;
    questions?: PrescriptionAgentQuestion[];
    agentState?: PrescriptionAgentState;
    studentName?: string;
}

export interface GenerateProgramResponse {
    success: boolean;
    error?: string;
    generationId?: string;
    aiMode?: string;
    source?: string;
    llmStatus?: string;
    outputSnapshot?: PrescriptionOutputSnapshot;
    violations?: unknown[];
}

export interface AssignProgramBody {
    studentId: string;
    generationId?: string;
    templateId?: string;
    startDate?: string | null;
    isScheduled?: boolean;
    workoutSchedule?: Record<number, number[]>;
    /** Fase 2b — when true, the route accepts an outputSnapshot from the body. */
    isEdited?: boolean;
    outputSnapshot?: PrescriptionOutputSnapshot;
}

export interface AssignProgramResponse {
    success: boolean;
    error?: string;
    programId?: string;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown by the fetch client. `message` is already in pt-BR and ready to
 * be shown to the user. `status` carries the HTTP status (or 0 for network
 * failures / missing session) so the UI can branch on rate-limit vs. auth.
 */
export class AIPrescriptionFetchError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "AIPrescriptionFetchError";
        this.status = status;
    }
}

// ============================================================================
// Internals
// ============================================================================

async function getAccessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
        throw new AIPrescriptionFetchError("Sessão expirada. Faça login novamente.", 0);
    }
    return token;
}

/**
 * Translates HTTP status + body into a pt-BR user-facing message.
 * The body's `error` string takes precedence over the canned default for
 * 400 (so server validation messages like "Exercício fora do catálogo: <id>"
 * surface untouched).
 */
function describeError(status: number, bodyError: string | null): string {
    if (status === 401) return "Sessão expirada. Faça login novamente.";
    if (status === 403) return "Sem permissão para essa ação.";
    if (status === 429) return "Limite de gerações atingido. Tente novamente mais tarde.";
    if (status === 400) return bodyError || "Requisição inválida.";
    if (status === 404 && bodyError) return bodyError;
    if (status === 409 && bodyError) return bodyError;
    if (status === 422 && bodyError) return bodyError;
    return "Erro inesperado. Tente novamente.";
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
    const token = await getAccessToken();

    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    } catch (err) {
        throw new AIPrescriptionFetchError(
            err instanceof Error ? `Falha de rede: ${err.message}` : "Falha de rede.",
            0,
        );
    }

    let parsed: unknown = null;
    try {
        parsed = await response.json();
    } catch {
        // Some 4xx may return non-JSON; we'll fall back to the canned message.
    }

    if (!response.ok) {
        const bodyError =
            parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as { error: unknown }).error === "string"
                ? ((parsed as { error: string }).error)
                : null;
        throw new AIPrescriptionFetchError(describeError(response.status, bodyError), response.status);
    }

    return parsed as T;
}

// ============================================================================
// Public API
// ============================================================================

export async function analyzeContext(
    studentId: string,
    selectedFormIds: string[],
): Promise<AnalyzeContextResponse> {
    return postJson<AnalyzeContextResponse>("/api/prescription/analyze", {
        studentId,
        selectedFormIds,
    });
}

export async function generateProgram(
    studentId: string,
    agentState: PrescriptionAgentState | null,
    selectedFormIds: string[],
): Promise<GenerateProgramResponse> {
    return postJson<GenerateProgramResponse>("/api/prescription/generate", {
        studentId,
        agentState,
        selectedFormIds,
    });
}

export async function assignProgram(body: AssignProgramBody): Promise<AssignProgramResponse> {
    return postJson<AssignProgramResponse>("/api/programs/assign", body);
}
