import { describe, it, expect } from "vitest";
import {
    buildWhatsAppMessage,
    sanitizePhoneForWhatsApp,
    buildWhatsAppUrl,
} from "./resetPasswordMessage";

describe("buildWhatsAppMessage", () => {
    it("uses only the first name of the student", () => {
        const msg = buildWhatsAppMessage({
            studentName: "João da Silva Santos",
            email: "joao@example.com",
            password: "abc123",
        });
        expect(msg).toBe(
            "Olá João!\n\nSua senha de acesso ao aplicativo Kinevo foi redefinida.\n\nSua nova senha é: *abc123*\n\nBaixe o app e faça o login com seu e-mail (joao@example.com)."
        );
    });

    it("works with single-token name (no last name)", () => {
        const msg = buildWhatsAppMessage({
            studentName: "Maria",
            email: "maria@example.com",
            password: "xyz789",
        });
        expect(msg).toContain("Olá Maria!");
        expect(msg).toContain("*xyz789*");
    });

    it("does not modify the password (asterisks wrap it as-is)", () => {
        const password = "P@ss-w/o_rd!";
        const msg = buildWhatsAppMessage({
            studentName: "Ana Lima",
            email: "ana@example.com",
            password,
        });
        expect(msg).toContain(`*${password}*`);
    });
});

describe("sanitizePhoneForWhatsApp", () => {
    it("strips formatting from a BR number without country code", () => {
        expect(sanitizePhoneForWhatsApp("(11) 98765-4321")).toBe("5511987654321");
    });

    it("does not duplicate 55 when already present", () => {
        expect(sanitizePhoneForWhatsApp("5511987654321")).toBe("5511987654321");
    });

    it("handles +55 prefix and spaces", () => {
        expect(sanitizePhoneForWhatsApp("+55 11 98765-4321")).toBe("5511987654321");
    });

    it("returns null for empty / nullish / invalid inputs", () => {
        expect(sanitizePhoneForWhatsApp(null)).toBeNull();
        expect(sanitizePhoneForWhatsApp(undefined)).toBeNull();
        expect(sanitizePhoneForWhatsApp("")).toBeNull();
        expect(sanitizePhoneForWhatsApp("abc")).toBeNull();
        expect(sanitizePhoneForWhatsApp("12345")).toBeNull();
    });
});

describe("buildWhatsAppUrl", () => {
    it("returns a whatsapp:// url with encoded text when phone is valid", () => {
        const url = buildWhatsAppUrl("5511987654321", "olá mundo");
        expect(url).toBe(
            `whatsapp://send?phone=5511987654321&text=${encodeURIComponent("olá mundo")}`
        );
    });

    it("returns null when phone is null", () => {
        expect(buildWhatsAppUrl(null, "qualquer texto")).toBeNull();
    });
});
