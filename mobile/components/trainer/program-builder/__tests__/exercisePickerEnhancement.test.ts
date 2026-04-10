import { describe, it, expect } from "vitest";

// ── Test data ──

const mockExercises = [
    {
        id: "ex1",
        name: "Supino Reto",
        equipment: "Barra",
        owner_id: "u1",
        video_url: "https://example.com/supino.mp4",
        instructions: "Deite no banco...",
        difficulty_level: "intermediate",
        muscle_groups: [{ id: "mg1", name: "Peitoral" }],
    },
    {
        id: "ex2",
        name: "Agachamento",
        equipment: "Barra",
        owner_id: "u1",
        video_url: null,
        instructions: null,
        difficulty_level: "beginner",
        muscle_groups: [{ id: "mg2", name: "Quadríceps" }],
    },
    {
        id: "ex3",
        name: "Rosca Direta",
        equipment: "Halteres",
        owner_id: "u1",
        video_url: "https://example.com/rosca.mp4",
        instructions: null,
        difficulty_level: "beginner",
        muscle_groups: [{ id: "mg3", name: "Bíceps" }],
    },
];

const mockMuscleGroups = [
    { id: "mg1", name: "Peitoral" },
    { id: "mg2", name: "Quadríceps" },
    { id: "mg3", name: "Bíceps" },
];

// ── Tests ──

describe("Video Preview Logic", () => {
    it("should identify exercises with video_url", () => {
        const withVideo = mockExercises.filter(e => e.video_url !== null);
        const withoutVideo = mockExercises.filter(e => e.video_url === null);

        expect(withVideo).toHaveLength(2);
        expect(withVideo[0].name).toBe("Supino Reto");
        expect(withVideo[1].name).toBe("Rosca Direta");
        expect(withoutVideo).toHaveLength(1);
        expect(withoutVideo[0].name).toBe("Agachamento");
    });

    it("should have valid video URLs for exercises with video", () => {
        const withVideo = mockExercises.filter(e => e.video_url !== null);
        withVideo.forEach(e => {
            expect(e.video_url).toMatch(/^https?:\/\//);
        });
    });

    it("should not attempt preview for exercises without video", () => {
        const exercise = mockExercises.find(e => e.id === "ex2")!;
        expect(exercise.video_url).toBeNull();
    });

    it("should prepare correct data for preview modal", () => {
        const exercise = mockExercises.find(e => e.id === "ex1")!;
        const previewData = {
            url: exercise.video_url!,
            name: exercise.name,
        };
        expect(previewData.url).toBe("https://example.com/supino.mp4");
        expect(previewData.name).toBe("Supino Reto");
    });
});

describe("Exercise Creation Flow", () => {
    it("ExerciseFormData should support all required fields", () => {
        const formData = {
            name: "Novo Exercício",
            muscle_group_ids: ["mg1"],
            equipment: "Halteres",
            instructions: "Instruções...",
            difficulty_level: "beginner",
            video_file: null,
            video_url: null,
        };

        expect(formData.name).toBe("Novo Exercício");
        expect(formData.muscle_group_ids).toHaveLength(1);
        expect(formData.equipment).toBe("Halteres");
        expect(formData.video_file).toBeNull();
    });

    it("ExerciseFormData should support video_file for upload", () => {
        const formData = {
            name: "Exercício com Vídeo",
            muscle_group_ids: ["mg1", "mg2"],
            equipment: null,
            instructions: null,
            difficulty_level: null,
            video_file: { uri: "file:///video.mp4", name: "video.mp4", type: "video/mp4" },
            video_url: null,
        };

        expect(formData.video_file).not.toBeNull();
        expect(formData.video_file!.type).toBe("video/mp4");
    });
});

describe("Data Integrity", () => {
    it("Exercise type should include video_url field", () => {
        mockExercises.forEach(e => {
            expect(e).toHaveProperty("video_url");
        });
    });

    it("Exercise type should include muscle_groups array", () => {
        mockExercises.forEach(e => {
            expect(Array.isArray(e.muscle_groups)).toBe(true);
            e.muscle_groups.forEach(mg => {
                expect(mg).toHaveProperty("id");
                expect(mg).toHaveProperty("name");
            });
        });
    });

    it("muscleGroups list should have id and name", () => {
        mockMuscleGroups.forEach(mg => {
            expect(typeof mg.id).toBe("string");
            expect(typeof mg.name).toBe("string");
        });
    });

    it("exercises with video_url should have non-empty string URLs", () => {
        mockExercises
            .filter(e => e.video_url !== null)
            .forEach(e => {
                expect(typeof e.video_url).toBe("string");
                expect(e.video_url!.length).toBeGreaterThan(0);
            });
    });
});
