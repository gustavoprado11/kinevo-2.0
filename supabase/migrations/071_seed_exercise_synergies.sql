-- ============================================================================
-- Kinevo — 071 Seed Exercise Synergies (Phase 1a)
-- ============================================================================
-- Populates exercise_synergies from the hard-coded SECONDARY_MUSCLE_GROUPS
-- maps in rules-engine.ts:625 and program-builder.ts:607.
-- This is the exact same data — just moved to the database.
-- ============================================================================

INSERT INTO exercise_synergies (primary_group_id, secondary_group_id, weight)
SELECT pg.id, sg.id, synergy.weight
FROM (VALUES
    ('Quadríceps',        'Glúteo',   1.0::REAL),
    ('Posterior de Coxa', 'Glúteo',   1.0::REAL),
    ('Peito',             'Ombros',   0.5::REAL),
    ('Peito',             'Tríceps',  0.5::REAL),
    ('Costas',            'Bíceps',   0.5::REAL),
    ('Ombros',            'Tríceps',  0.5::REAL)
) AS synergy(primary_name, secondary_name, weight)
JOIN muscle_groups pg ON pg.name = synergy.primary_name AND pg.owner_id IS NULL
JOIN muscle_groups sg ON sg.name = synergy.secondary_name AND sg.owner_id IS NULL
ON CONFLICT (primary_group_id, secondary_group_id) DO NOTHING;
