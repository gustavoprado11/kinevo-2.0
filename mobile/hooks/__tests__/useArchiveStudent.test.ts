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

import { useArchiveStudent } from "../useArchiveStudent";
import { getCached, setCache, invalidateCache } from "../../lib/cache";

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

function makeHttpError(bodyJson: unknown): FunctionsHttpError {
    const response = { json: vi.fn().mockResolvedValueOnce(bodyJson) } as unknown as Response;
    const err = Object.create(FunctionsHttpError.prototype) as FunctionsHttpError;
    Object.assign(err, {
        message: "Edge Function returned a non-2xx status code",
        context: response,
        name: "FunctionsHttpError",
    });
    return err;
}

describe("useArchiveStudent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCached as ReturnType<typeof vi.fn>).mockReturnValue(null);
        getSessionMock.mockResolvedValue({ data: { session: { access_token: "tok" } } } as never);
    });

    it("retorna studentId em caso de sucesso", async () => {
        invokeMock.mockResolvedValueOnce({ data: { success: true, studentId: "s1" }, error: null });

        const { result } = renderHook(() => useArchiveStudent());
        let out: Awaited<ReturnType<typeof result.current.archiveStudent>> | null = null;
        await act(async () => {
            out = await result.current.archiveStudent("s1");
        });
        const ok = out!;
        expect(ok.success).toBe(true);
        if (ok.success) expect(ok.studentId).toBe("s1");
    });

    it("remove aluno da STUDENTS_LIST e invalida STUDENT_DETAIL", async () => {
        const cachedList = [{ id: "s1", name: "Foo" }, { id: "s2", name: "Bar" }];
        (getCached as ReturnType<typeof vi.fn>).mockReturnValue({ data: cachedList, timestamp: Date.now() });
        invokeMock.mockResolvedValueOnce({ data: { success: true, studentId: "s1" }, error: null });

        const { result } = renderHook(() => useArchiveStudent());
        await act(async () => {
            await result.current.archiveStudent("s1");
        });

        const setCalls = (setCache as ReturnType<typeof vi.fn>).mock.calls;
        expect(setCalls.length).toBe(1);
        const next = setCalls[0][1] as typeof cachedList;
        expect(next).toHaveLength(1);
        expect(next[0].id).toBe("s2");
        expect(invalidateCache).toHaveBeenCalled();
    });

    it("extrai mensagem do body JSON quando FunctionsHttpError 403", async () => {
        invokeMock.mockResolvedValueOnce({
            data: null,
            error: makeHttpError({ success: false, error: "Aluno não encontrado ou sem permissão." }),
        });

        const { result } = renderHook(() => useArchiveStudent());
        let out: Awaited<ReturnType<typeof result.current.archiveStudent>> | null = null;
        await act(async () => {
            out = await result.current.archiveStudent("s1");
        });
        const r = out!;
        expect(r.success).toBe(false);
        if (!r.success) expect(r.error).toBe("Aluno não encontrado ou sem permissão.");
    });
});
