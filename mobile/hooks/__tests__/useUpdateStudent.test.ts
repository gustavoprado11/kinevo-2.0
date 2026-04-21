import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
// @ts-expect-error react-dom typings are not installed in the mobile workspace
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";

const { invokeMock, getSessionMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    getSessionMock: vi.fn(() => Promise.resolve({ data: { session: { access_token: "tok" } } })),
}));

vi.mock("expo-haptics", () => ({
    impactAsync: vi.fn(() => Promise.resolve()),
    notificationAsync: vi.fn(() => Promise.resolve()),
    selectionAsync: vi.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
    NotificationFeedbackType: { Success: "Success", Error: "Error", Warning: "Warning" },
}));

vi.mock("../../lib/cache", () => ({
    getCached: vi.fn(() => null),
    setCache: vi.fn(),
    invalidateCache: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
    supabase: {
        auth: { getSession: getSessionMock },
        functions: { invoke: invokeMock },
    },
}));

import { useUpdateStudent } from "../useUpdateStudent";
import { getCached, setCache } from "../../lib/cache";

function renderHook<T>(cb: () => T): { result: { current: T }; unmount: () => void } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const result: { current: T } = { current: undefined as unknown as T };
    function Wrapper() {
        result.current = cb();
        return null;
    }
    act(() => { root.render(React.createElement(Wrapper)); });
    return {
        result,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

function makeHttpError(bodyJson: unknown | Error): FunctionsHttpError {
    const response = {
        json: bodyJson instanceof Error
            ? vi.fn().mockRejectedValueOnce(bodyJson)
            : vi.fn().mockResolvedValueOnce(bodyJson),
    } as unknown as Response;
    const err = Object.create(FunctionsHttpError.prototype) as FunctionsHttpError;
    Object.assign(err, {
        message: "Edge Function returned a non-2xx status code",
        context: response,
        name: "FunctionsHttpError",
    });
    return err;
}

describe("useUpdateStudent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCached as ReturnType<typeof vi.fn>).mockReturnValue(null);
        getSessionMock.mockResolvedValue({ data: { session: { access_token: "tok" } } } as never);
    });

    it("retorna student atualizado em caso de sucesso", async () => {
        const student = { id: "s1", name: "Novo", email: "a@b.com", phone: "1", modality: "online", status: "active" };
        invokeMock.mockResolvedValueOnce({ data: { success: true, student }, error: null });

        const { result } = renderHook(() => useUpdateStudent());
        let out: Awaited<ReturnType<typeof result.current.updateStudent>> | null = null;
        await act(async () => {
            out = await result.current.updateStudent({ studentId: "s1", name: "Novo" });
        });
        const ok = out!;
        expect(ok.success).toBe(true);
        if (ok.success) expect(ok.student).toEqual(student);
    });

    it("extrai mensagem útil do body JSON quando FunctionsHttpError", async () => {
        invokeMock.mockResolvedValueOnce({ data: null, error: makeHttpError({ success: false, error: "Email já está em uso." }) });

        const { result } = renderHook(() => useUpdateStudent());
        let out: Awaited<ReturnType<typeof result.current.updateStudent>> | null = null;
        await act(async () => {
            out = await result.current.updateStudent({ studentId: "s1", email: "duplicado@ex.com" });
        });
        const r1 = out!;
        expect(r1.success).toBe(false);
        if (!r1.success) expect(r1.error).toBe("Email já está em uso.");
    });

    it("cai em mensagem default quando FunctionsHttpError e body não é JSON", async () => {
        invokeMock.mockResolvedValueOnce({ data: null, error: makeHttpError(new Error("not json")) });

        const { result } = renderHook(() => useUpdateStudent());
        let out: Awaited<ReturnType<typeof result.current.updateStudent>> | null = null;
        await act(async () => {
            out = await result.current.updateStudent({ studentId: "s1" });
        });
        const r2 = out!;
        expect(r2.success).toBe(false);
        if (!r2.success) expect(r2.error).toBe("Erro ao atualizar aluno. Tente novamente.");
    });

    it("retorna sessão expirada quando não há access_token", async () => {
        getSessionMock.mockResolvedValueOnce({ data: { session: null } } as never);

        const { result } = renderHook(() => useUpdateStudent());
        let out: Awaited<ReturnType<typeof result.current.updateStudent>> | null = null;
        await act(async () => {
            out = await result.current.updateStudent({ studentId: "s1" });
        });
        const r3 = out!;
        expect(r3.success).toBe(false);
        if (!r3.success) expect(r3.error).toContain("Sessão expirada");
    });

    it("faz merge no cache STUDENTS_LIST preservando campos agregados", async () => {
        const existingList = [
            { id: "s1", name: "Antigo", email: "a@b.com", phone: "111", modality: "online", sessions_this_week: 3 },
            { id: "s2", name: "Outro", email: "c@d.com", phone: "222", modality: "presential", sessions_this_week: 1 },
        ];
        (getCached as ReturnType<typeof vi.fn>).mockReturnValue({ data: existingList, timestamp: Date.now() });
        const updated = { id: "s1", name: "Novo", email: "novo@b.com", phone: "999", modality: "presential", status: "active" };
        invokeMock.mockResolvedValueOnce({ data: { success: true, student: updated }, error: null });

        const { result } = renderHook(() => useUpdateStudent());
        await act(async () => {
            await result.current.updateStudent({ studentId: "s1", name: "Novo" });
        });

        expect(setCache).toHaveBeenCalledTimes(1);
        const nextList = (setCache as ReturnType<typeof vi.fn>).mock.calls[0][1] as typeof existingList;
        expect(nextList[0].name).toBe("Novo");
        expect(nextList[0].email).toBe("novo@b.com");
        expect((nextList[0] as { sessions_this_week: number }).sessions_this_week).toBe(3);
        expect(nextList[1].name).toBe("Outro");
    });
});
