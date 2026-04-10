import { describe, it, expect } from "vitest";

// ── Test data ──

const groups = [
    { id: "mg1", name: "Peitoral", owner_id: null, created_at: "2024-01-01" },
    { id: "mg2", name: "Custom Grupo", owner_id: "user1", created_at: "2024-06-01" },
    { id: "mg3", name: "Quadríceps", owner_id: null, created_at: "2024-01-01" },
    { id: "mg4", name: "Posterior de coxa", owner_id: "user1", created_at: "2024-07-01" },
];

// ── Tests ──

describe("Muscle Group CRUD - Pure Logic", () => {
    it("should identify system vs custom muscle groups", () => {
        const systemGroups = groups.filter((g) => g.owner_id === null);
        const customGroups = groups.filter((g) => g.owner_id !== null);

        expect(systemGroups).toHaveLength(2);
        expect(systemGroups[0].name).toBe("Peitoral");
        expect(customGroups).toHaveLength(2);
        expect(customGroups[0].name).toBe("Custom Grupo");
    });

    it("should detect duplicate names case-insensitively", () => {
        const checkDuplicate = (name: string) =>
            groups.some((g) => g.name.toLowerCase() === name.toLowerCase());

        expect(checkDuplicate("peitoral")).toBe(true);
        expect(checkDuplicate("PEITORAL")).toBe(true);
        expect(checkDuplicate("Peitoral")).toBe(true);
        expect(checkDuplicate("Bíceps")).toBe(false);
        expect(checkDuplicate("custom grupo")).toBe(true);
    });

    it("should only allow deletion of owned groups", () => {
        const userId = "user1";

        const canDelete = (groupId: string) => {
            const group = groups.find((g) => g.id === groupId);
            return group?.owner_id === userId;
        };

        expect(canDelete("mg1")).toBe(false); // System group
        expect(canDelete("mg2")).toBe(true);  // Own group
        expect(canDelete("mg3")).toBe(false); // System group
        expect(canDelete("mg4")).toBe(true);  // Own group
    });

    it("should sort groups alphabetically after mutation", () => {
        const unsorted = [
            { id: "mg3", name: "Ombro" },
            { id: "mg1", name: "Bíceps" },
            { id: "mg2", name: "Costas" },
        ];

        const sorted = [...unsorted].sort((a, b) => a.name.localeCompare(b.name));

        expect(sorted[0].name).toBe("Bíceps");
        expect(sorted[1].name).toBe("Costas");
        expect(sorted[2].name).toBe("Ombro");
    });

    it("should correctly filter groups by search query", () => {
        const searchFilter = (query: string) =>
            groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));

        expect(searchFilter("peit")).toHaveLength(1);
        expect(searchFilter("post")).toHaveLength(1);
        expect(searchFilter("coxa")).toHaveLength(1);
        expect(searchFilter("p")).toHaveLength(4); // Peitoral, Custom Grupo, Quadríceps, Posterior de coxa
        expect(searchFilter("xyz")).toHaveLength(0);
    });

    it("should update group name and re-sort correctly", () => {
        const mutableGroups = [
            { id: "mg1", name: "Bíceps" },
            { id: "mg2", name: "Costas" },
            { id: "mg3", name: "Ombro" },
        ];

        // Rename "Ombro" to "Antebraço"
        const updated = mutableGroups
            .map((g) => (g.id === "mg3" ? { ...g, name: "Antebraço" } : g))
            .sort((a, b) => a.name.localeCompare(b.name));

        expect(updated[0].name).toBe("Antebraço");
        expect(updated[1].name).toBe("Bíceps");
        expect(updated[2].name).toBe("Costas");
    });

    it("should detect duplicate when updating to existing name", () => {
        const checkDuplicateForUpdate = (id: string, newName: string) =>
            groups.some(
                (g) => g.id !== id && g.name.toLowerCase() === newName.toLowerCase()
            );

        // Trying to rename mg2 to "Peitoral" (already exists as mg1)
        expect(checkDuplicateForUpdate("mg2", "Peitoral")).toBe(true);
        // Renaming mg2 to something new
        expect(checkDuplicateForUpdate("mg2", "Trapézio")).toBe(false);
        // Same name as self should not count as duplicate
        expect(checkDuplicateForUpdate("mg1", "Peitoral")).toBe(false);
    });

    it("should remove group from list after deletion", () => {
        const afterDelete = groups.filter((g) => g.id !== "mg2");
        expect(afterDelete).toHaveLength(3);
        expect(afterDelete.find((g) => g.id === "mg2")).toBeUndefined();
    });
});
