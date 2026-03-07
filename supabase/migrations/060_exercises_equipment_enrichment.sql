-- ============================================================================
-- Migration 060: Enrich exercises with equipment categorization
-- ============================================================================
-- Populates the existing `equipment` column based on exercise name patterns.
-- Equipment column already exists (migration 001) but was never populated.
-- Categories: barbell, dumbbell, cable, machine, smith, kettlebell, trx,
--             bodyweight, plate, step, leg_press, hack, bench
-- ============================================================================

-- ── 1. Machine-specific first (prevents later mismatches) ──
UPDATE public.exercises SET equipment = 'machine'
WHERE equipment IS NULL
  AND (name ILIKE '%máquina%'
    OR name ILIKE '%articulad%'
    OR name ILIKE '%cadeira extensora%'
    OR name ILIKE '%cadeira flexora%'
    OR name ILIKE '%mesa flexora%'
    OR name ILIKE '%peck deck%'
    OR name ILIKE '%gráviton%'
    OR name ILIKE '%graviton%'
    OR name ILIKE '%bicicleta ergométrica%'
    OR name ILIKE '%flexora deitada%'
    OR name ILIKE '%flexora unilateral'
    OR name = 'Flexora Unilateral'
    OR name ILIKE '%elevação de quadril na maquina%'
    OR name ILIKE '%panturrilha hack%');

-- ── 2. Leg Press ──
UPDATE public.exercises SET equipment = 'leg_press'
WHERE equipment IS NULL
  AND (name ILIKE '%leg press%'
    OR name ILIKE '%leg%press%'
    OR name ILIKE '%panturrilha no leg%'
    OR name ILIKE '%panturrilha unilateral no leg%');

-- ── 3. Hack ──
UPDATE public.exercises SET equipment = 'hack'
WHERE equipment IS NULL
  AND name ILIKE '%hack%';

-- ── 4. Dumbbell (Halteres) ──
UPDATE public.exercises SET equipment = 'dumbbell'
WHERE equipment IS NULL
  AND (name ILIKE '%halter%'
    OR name ILIKE '%desenvolvimento arnold%'
    OR name ILIKE '%rosca alternada banco inclinado%'
    OR name ILIKE '%rosca direta banco inclinado%'
    OR name ILIKE '%rosca martelo%banco inclinado%'
    OR name ILIKE '%rosca concentrada'
    OR name = 'Rosca Concentrada'
    OR name ILIKE '%rosca zottman%'
    OR name ILIKE '%rosca scott alternada%'
    OR name ILIKE '%rosca scott com%'
    OR name ILIKE '%rosca scott unilateral%'
    OR name ILIKE '%rosca scott martelo%'
    OR name ILIKE '%elevação frontal alternada'
    OR name = 'Elevação Frontal Alternada');

-- ── 5. Cable (Polia / Crossover / Puxada / Pulldown / Remada Baixa) ──
UPDATE public.exercises SET equipment = 'cable'
WHERE equipment IS NULL
  AND (name ILIKE '%polia%'
    OR name ILIKE '%cross%over%'
    OR name ILIKE '%crossover%'
    OR name ILIKE '%face pull%'
    OR name ILIKE '%pulldown%'
    OR name ILIKE '%remada baixa%'
    OR name ILIKE '%puxada%'
    OR name ILIKE '%pallof%'
    OR name ILIKE '%flexão de quadril 90%');

-- ── 6. Smith Machine ──
UPDATE public.exercises SET equipment = 'smith'
WHERE equipment IS NULL
  AND name ILIKE '%smith%';

-- ── 7. Barbell (Barra livre / Barra reta / Barra W / Barra H) ──
-- Excludes "Barra Fixa" which is bodyweight
UPDATE public.exercises SET equipment = 'barbell'
WHERE equipment IS NULL
  AND (name ILIKE '%barra livre%'
    OR name ILIKE '%barra reta%'
    OR name ILIKE '%barra w%'
    OR name ILIKE '%barra h'
    OR name ILIKE '%barra h %'
    OR name ILIKE '%barra hexagonal%'
    OR name ILIKE '%com barra%'
    OR name ILIKE '%barra olímpica%'
    OR name ILIKE '%remada cavalinho%'
    OR name ILIKE '%levantamento terra%'
    OR name ILIKE '%bom dia'
    OR name = 'Bom Dia'
    OR name ILIKE '%stiff barra%'
    OR name ILIKE '%stiff sumô com barra%'
    OR name ILIKE '%stiff pés afastados%')
  AND name NOT ILIKE '%barra fixa%'
  AND name NOT ILIKE '%polia%';

-- ── 8. Kettlebell ──
UPDATE public.exercises SET equipment = 'kettlebell'
WHERE equipment IS NULL
  AND name ILIKE '%kettlebell%';

-- ── 9. TRX ──
UPDATE public.exercises SET equipment = 'trx'
WHERE equipment IS NULL
  AND name ILIKE '%trx%';

-- ── 10. Step ──
UPDATE public.exercises SET equipment = 'step'
WHERE equipment IS NULL
  AND (name ILIKE '%step%'
    OR name ILIKE '%caixote%'
    OR name ILIKE '%subida no caixote%');

-- ── 11. Plate (Anilha) ──
UPDATE public.exercises SET equipment = 'plate'
WHERE equipment IS NULL
  AND name ILIKE '%anilha%';

-- ── 12. Miniband ──
UPDATE public.exercises SET equipment = 'miniband'
WHERE equipment IS NULL
  AND name ILIKE '%miniband%';

-- ── 13. Bench-based exercises ──
UPDATE public.exercises SET equipment = 'bench'
WHERE equipment IS NULL
  AND (name ILIKE '%banco romano%'
    OR name ILIKE '%banco sóleo%'
    OR name ILIKE '%extensão de quadril banco%'
    OR name ILIKE '%retração escapular no banco%'
    OR name ILIKE '%crucifixo invertido no banco%'
    OR name ILIKE '%crucifixo invertido sentado%');

-- ── 14. Bodyweight — everything else ──
-- Includes: flexão, barra fixa, prancha, abdominal, agachamento livre,
-- caneleira, bola suíça, etc.
UPDATE public.exercises SET equipment = 'bodyweight'
WHERE equipment IS NULL;
