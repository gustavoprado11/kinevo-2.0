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
    ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
    NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));

vi.mock("../../lib/supabase", () => ({
    supabase: {
        auth: { getSession: getSessionMock },
        functions: { invoke: invokeMock },
    },
}));

import { useCreateStudent } from "../useCreateStudent";

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

const BASE_INPUT = {
    name: "Foo",
    email: "foo@bar.com",
    phone: "11999",
    modality: "online" as const,
};

describe("useCreateStudent — FunctionsHttpError extraction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ data: { session: { access_token: "tok" } } } as never);
    });

    it("extrai body JSON quando FunctionsHttpError (não retorna 'non-2xx')", async () => {
        const response = {
            json: vi.fn().mockResolvedValueOnce({ success: false, error: "Email já cadastrado." }),
        } as unknown as Response;
        const err = Object.create(FunctionsHttpError.prototype) as FunctionsHttpError;
        Object.assign(err, {
            message: "Edge Function returned a non-2xx status code",
            context: response,
            name: "FunctionsHttpError",
        });
        invokeMock.mockResolvedValueOnce({ data: null, error: err });

        const { result } = renderHook(() => useCreateStudent());
        let out: Awaited<ReturnType<typeof result.current.createStudent>> | null = null;
        await act(async () => {
            out = await result.current.createStudent(BASE_INPUT);
        });
        expect(out!.success).toBe(false);
        expect(out!.error).toBe("Email já cadastrado.");
        expect(out!.error).not.toMatch(/non-2xx/);
    });

    it("devolve aluno criado em caso de sucesso", async () => {
        invokeMock.mockResolvedValueOnce({
            data: {
                success: true,
                studentId: "s1",
                email: "foo@bar.com",
                password: "pw",
                name: "Foo",
                whatsapp: null,
            },
            error: null,
        });

        const { result } = renderHook(() => useCreateStudent());
        let out: Awaited<ReturnType<typeof result.current.createStudent>> | null = null;
        await act(async () => {
            out = await result.current.createStudent(BASE_INPUT);
        });
        expect(out!.success).toBe(true);
        expect(out!.studentId).toBe("s1");
    });
});
