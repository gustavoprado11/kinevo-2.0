-- ============================================================================
-- Kinevo — 063 AI Curated Exercise Catalog
-- ============================================================================
-- Adds is_ai_curated flag and prescription_notes to exercises table.
-- Updates 72 hand-curated exercises with rich metadata for the AI
-- prescription engine. Non-curated exercises remain available for
-- manual program building.
-- ============================================================================

-- ============================================================================
-- 1) Schema changes
-- ============================================================================

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_ai_curated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS prescription_notes TEXT;

COMMENT ON COLUMN exercises.is_ai_curated IS
  'True for hand-curated exercises used by the AI prescription engine';
COMMENT ON COLUMN exercises.prescription_notes IS
  'Coaching context for AI: why/when to pick this exercise';

CREATE INDEX IF NOT EXISTS idx_exercises_ai_curated
  ON exercises(is_ai_curated) WHERE is_ai_curated = true;

-- ============================================================================
-- 2) Update curated exercises (72 total)
-- ============================================================================
-- Match by exact name + owner_id IS NULL (system exercises only).
-- movement_pattern uses DB abbreviations: push_h, push_v, pull_h, pull_v.

-- ── Peito (10 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'push_h',
  prescription_notes = 'Âncora primária de push horizontal — máxima carga em peito'
WHERE name = 'Supino Reto com Barra' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'push_h',
  prescription_notes = 'Alternativa ao supino barra — maior amplitude e ativação estabilizadora'
WHERE name = 'Supino Reto com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'push_h',
  prescription_notes = 'Ênfase em porção clavicular — essencial para desenvolvimento completo'
WHERE name = 'Supino Inclinado com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'push_h',
  prescription_notes = 'Variação inclinada com barra — permite maior carga que halteres'
WHERE name = 'Supino Inclinado com Barra Reta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'push_h',
  prescription_notes = 'Seguro para iniciantes — trajetória guiada, bom para aprender padrão push'
WHERE name = 'Supino Reto Articulado' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'push_h',
  prescription_notes = 'Máquina inclinada — alternativa segura quando estabilização é limitante'
WHERE name = 'Supino Inclinado Articulado' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Isolamento de peito em alongamento — complementa compostos'
WHERE name = 'Crucifixo com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Tensão constante — bom para finalizar com fadiga controlada'
WHERE name = 'Crossover Polia Alta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Pec deck — isolamento seguro para iniciantes, estabilização mínima'
WHERE name = 'Crucifixo Máquina' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'push_h',
  prescription_notes = 'Peso corporal — essencial para home gym e ativação'
WHERE name = 'Flexão de Braços' AND owner_id IS NULL;

-- ── Costas (12 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'pull_h',
  prescription_notes = 'Âncora primária de pull horizontal — máximo recrutamento de costas'
WHERE name = 'Remada Curvada com Barra Reta (Pegada Pronada)' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'pull_h',
  prescription_notes = 'Pegada neutra — menos stress em ombro, boa amplitude'
WHERE name = 'Remada Curvada com Halteres (Pegada Neutra)' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'pull_v',
  prescription_notes = 'Âncora de pull vertical — largura de costas'
WHERE name = 'Puxada Aberta Barra reta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'pull_v',
  prescription_notes = ''
WHERE name = 'Puxada Supinada Barra Reta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'pull_v',
  prescription_notes = 'Pegada neutra — mais fácil para iniciantes, bíceps mais envolvido'
WHERE name = 'Puxada Neutra Triângulo' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'pull_h',
  prescription_notes = 'Remada sentada — excelente para espessura de costas e ativação de bíceps'
WHERE name = 'Remada Baixa Supinada' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'pull_h',
  prescription_notes = 'Remada sentada — excelente para espessura de costas, segura'
WHERE name = 'Remada Baixa Triangulo' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'middle',
  movement_pattern = 'pull_h',
  prescription_notes = 'Trajetória guiada — ideal para iniciantes aprenderem pull'
WHERE name = 'Remada Máquina (Pegada Neutra)' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'pull_v',
  prescription_notes = 'Puxada mais confortável'
WHERE name = 'Puxada Neutra Barra H' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'pull_v',
  prescription_notes = 'Isolamento de latíssimo — sem compensação de bíceps'
WHERE name = 'Pulldown com Corda' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'pull_h',
  prescription_notes = 'Saúde escapular — rotação externa + retração, essencial em todo programa'
WHERE name = 'Face Pull' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'pull_h',
  prescription_notes = 'Fortalecimento unilateral'
WHERE name = 'Remada Unilateral Halteres - Pegada Neutra (Serrote)' AND owner_id IS NULL;

-- ── Quadríceps (9 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'squat',
  prescription_notes = 'Rei dos compostos — máxima carga e recrutamento de cadeia anterior'
WHERE name = 'Agachamento Livre com Barra' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'squat',
  prescription_notes = 'Agachamento guiado — seguro para iniciantes, bom para aprender padrão'
WHERE name = 'Agachamento Smith' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'squat',
  prescription_notes = 'Alta carga sem stress axial — essencial para quem não pode agachar'
WHERE name = 'Leg Press Horizontal' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'squat',
  prescription_notes = 'Alta carga sem stress axial — essencial para quem não pode agachar'
WHERE name = 'Leg Press 45' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'squat',
  prescription_notes = 'Ênfase em quadríceps pela inclinação — menos demanda lombar'
WHERE name = 'Agachamento Hack' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = true,
  session_position = 'middle',
  movement_pattern = 'lunge',
  prescription_notes = 'Unilateral por excelência — corrige assimetrias, alta ativação glútea'
WHERE name = 'Agachamento Búlgaro' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'lunge',
  prescription_notes = 'Padrão lunge básico — funcional, trabalha equilíbrio'
WHERE name = 'Afundo com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'advanced',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'squat',
  prescription_notes = 'Dominante de joelho'
WHERE name = 'Afundo no Smith' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Isolamento puro de quadríceps — bom para finalizar ou pré-ativação'
WHERE name = 'Cadeira Extensora' AND owner_id IS NULL;

-- ── Glúteo (4 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'hinge',
  prescription_notes = 'Hip thrust — exercício #1 para glúteo máximo com carga'
WHERE name = 'Elevação de Quadril com Barra' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'hinge',
  prescription_notes = 'Versão bodyweight — ativação e aprendizado do padrão'
WHERE name = 'Elevação de Quadril' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Glúteo médio — estabilização de quadril, prevenção de valgo'
WHERE name = 'Abdução de Quadril Máquina' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Extensão de quadril isolada — tensão constante'
WHERE name = 'Glúteos Coice na Polia' AND owner_id IS NULL;

-- ── Posterior de Coxa (5 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'hinge',
  prescription_notes = 'Padrão hinge primário — alongamento + carga em posterior e glúteo'
WHERE name = 'Stiff Barra Livre' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'hinge',
  prescription_notes = 'Hinge com halteres — mais acessível, menor demanda técnica'
WHERE name = 'Stiff com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'isolation',
  prescription_notes = 'Isolamento em encurtamento — complemento essencial do stiff'
WHERE name = 'Mesa Flexora' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'isolation',
  prescription_notes = 'Variação sentada — ênfase diferente no comprimento muscular'
WHERE name = 'Cadeira Flexora' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'advanced',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'hinge',
  prescription_notes = 'Composto máximo de cadeia posterior — alto recrutamento global'
WHERE name = 'Levantamento Terra' AND owner_id IS NULL;

-- ── Ombros (8 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'push_v',
  prescription_notes = 'Âncora de push vertical — amplitude completa, ativação de estabilizadores'
WHERE name = 'Desenvolvimento com Halteres Sentado' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = true,
  session_position = 'first',
  movement_pattern = 'push_v',
  prescription_notes = 'Press militar — permite mais carga que halteres'
WHERE name = 'Desenvolvimento Barra Reta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'push_v',
  prescription_notes = 'Máquina de desenvolvimento — seguro para iniciantes'
WHERE name = 'Desenvolvimento Articulado' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Isolamento de deltóide lateral — essencial para largura de ombros'
WHERE name = 'Elevação Lateral com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Tensão constante na polia — superior ao haltere na porção inferior'
WHERE name = 'Elevação Lateral Unilateral na Polia Baixa neutra' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Máquina lateral — isolamento puro sem compensação'
WHERE name = 'Elevação Lateral Máquina em Pé' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Deltóide anterior — geralmente coberto por supino, usar se déficit'
WHERE name = 'Elevação Frontal com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'first',
  movement_pattern = 'push_v',
  prescription_notes = 'Rotação durante press — ativa todas as porções do deltóide'
WHERE name = 'Desenvolvimento Arnold Sentado' AND owner_id IS NULL;

-- ── Bíceps (6 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Rosca padrão — máxima carga em bíceps'
WHERE name = 'Rosca Direta Barra Reta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Supinação completa — pico de contração superior à barra'
WHERE name = 'Rosca Direta com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Cabeça curta enfatizada — elimina momentum'
WHERE name = 'Rosca Scott com Barra W' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Braquial + braquiorradial — complementa a rosca direta'
WHERE name = 'Rosca Martelo com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Tensão constante — boa para finalizar com controle'
WHERE name = 'Rosca Direta na Polia (Barra Reta)' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Bíceps em alongamento — cabeça longa enfatizada'
WHERE name = 'Rosca direta Banco Inclinado' AND owner_id IS NULL;

-- ── Tríceps (5 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Extensão com corda — maior amplitude, cabeça lateral'
WHERE name = 'Tríceps na Polia com Corda' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Mais carga que corda — cabeça medial e lateral'
WHERE name = 'Tríceps na Polia com Barra Reta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Cabeça longa enfatizada — alongamento overhead'
WHERE name = 'Tríceps Testa Barra Reta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'middle',
  movement_pattern = 'isolation',
  prescription_notes = 'Overhead unilateral — corrige assimetrias'
WHERE name = 'Tríceps Francês com Halteres' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Isolamento guiado — seguro para iniciantes'
WHERE name = 'Extensão Tríceps Máquina' AND owner_id IS NULL;

-- ── Abdominais (7 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'core',
  prescription_notes = 'Flexão de tronco com carga — progressão mensurável'
WHERE name = 'Abdominal Supra com Corda na Polia' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'core',
  prescription_notes = 'Flexão de quadril em suspensão — reto inferior enfatizado'
WHERE name = 'Abdominal Canivete' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'core',
  prescription_notes = 'Estabilização anti-extensão — fundamento de core'
WHERE name = 'Abdominal Prancha Isométrica' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'core',
  prescription_notes = 'Anti-extensão dinâmico — excelente para ativação e reabilitação'
WHERE name = 'Prancha Isometrica Lateral Baixa' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'core',
  prescription_notes = 'Anti-rotação — estabilização funcional essencial'
WHERE name = 'Pallof Press' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'core',
  prescription_notes = 'Oblíquos com carga — flexão lateral resistida'
WHERE name = 'Abdominal Oblíquo Unilateral na Polia Alta' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'advanced',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'core',
  prescription_notes = ''
WHERE name = 'Abdominal com Rodinha Solo com Apoio' AND owner_id IS NULL;

-- ── Panturrilha (4 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Gastrocnêmios — joelho estendido, máxima ativação'
WHERE name = 'Panturrilha em pé Máquina' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Sóleo — joelho flexionado, complementa panturrilha em pé'
WHERE name = 'Banco Sóleo' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Alternativa com carga — quando não tem máquina específica ou aproveitar para fazer junto com Leg Press'
WHERE name = 'Panturrilha no Leg Press 45' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Bodyweight com amplitude — alternativa home gym'
WHERE name = 'Panturrilha no Step' AND owner_id IS NULL;

-- ── Adutores (2 exercícios) ──

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'beginner',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Adutores isolados — complemento quando volume é necessário'
WHERE name = 'Adução de Quadril Máquina' AND owner_id IS NULL;

UPDATE exercises SET
  is_ai_curated = true,
  difficulty_level = 'intermediate',
  is_primary_movement = false,
  session_position = 'last',
  movement_pattern = 'isolation',
  prescription_notes = 'Unilateral na polia — mais funcional que máquina'
WHERE name = 'Adução de Quadril na Polia Unilateral' AND owner_id IS NULL;

-- ============================================================================
-- 3) Verification: report unmatched exercises
-- ============================================================================

DO $$
DECLARE
  expected_names TEXT[] := ARRAY[
    'Supino Reto com Barra',
    'Supino Reto com Halteres',
    'Supino Inclinado com Halteres',
    'Supino Inclinado com Barra Reta',
    'Supino Reto Articulado',
    'Supino Inclinado Articulado',
    'Crucifixo com Halteres',
    'Crossover Polia Alta',
    'Crucifixo Máquina',
    'Flexão de Braços',
    'Remada Curvada com Barra Reta (Pegada Pronada)',
    'Remada Curvada com Halteres (Pegada Neutra)',
    'Puxada Aberta Barra reta',
    'Puxada Supinada Barra Reta',
    'Puxada Neutra Triângulo',
    'Remada Baixa Supinada',
    'Remada Baixa Triangulo',
    'Remada Máquina (Pegada Neutra)',
    'Puxada Neutra Barra H',
    'Pulldown com Corda',
    'Face Pull',
    'Remada Unilateral Halteres - Pegada Neutra (Serrote)',
    'Agachamento Livre com Barra',
    'Agachamento Smith',
    'Leg Press Horizontal',
    'Leg Press 45',
    'Agachamento Hack',
    'Agachamento Búlgaro',
    'Afundo com Halteres',
    'Afundo no Smith',
    'Cadeira Extensora',
    'Elevação de Quadril com Barra',
    'Elevação de Quadril',
    'Abdução de Quadril Máquina',
    'Glúteos Coice na Polia',
    'Stiff Barra Livre',
    'Stiff com Halteres',
    'Mesa Flexora',
    'Cadeira Flexora',
    'Levantamento Terra',
    'Desenvolvimento com Halteres Sentado',
    'Desenvolvimento Barra Reta',
    'Desenvolvimento Articulado',
    'Elevação Lateral com Halteres',
    'Elevação Lateral Unilateral na Polia Baixa neutra',
    'Elevação Lateral Máquina em Pé',
    'Elevação Frontal com Halteres',
    'Desenvolvimento Arnold Sentado',
    'Rosca Direta Barra Reta',
    'Rosca Direta com Halteres',
    'Rosca Scott com Barra W',
    'Rosca Martelo com Halteres',
    'Rosca Direta na Polia (Barra Reta)',
    'Rosca direta Banco Inclinado',
    'Tríceps na Polia com Corda',
    'Tríceps na Polia com Barra Reta',
    'Tríceps Testa Barra Reta',
    'Tríceps Francês com Halteres',
    'Extensão Tríceps Máquina',
    'Abdominal Supra com Corda na Polia',
    'Abdominal Canivete',
    'Abdominal Prancha Isométrica',
    'Prancha Isometrica Lateral Baixa',
    'Pallof Press',
    'Abdominal Oblíquo Unilateral na Polia Alta',
    'Abdominal com Rodinha Solo com Apoio',
    'Panturrilha em pé Máquina',
    'Banco Sóleo',
    'Panturrilha no Leg Press 45',
    'Panturrilha no Step',
    'Adução de Quadril Máquina',
    'Adução de Quadril na Polia Unilateral'
  ];
  exercise_name TEXT;
  found_count INTEGER := 0;
BEGIN
  FOREACH exercise_name IN ARRAY expected_names LOOP
    IF NOT EXISTS (
      SELECT 1 FROM exercises WHERE name = exercise_name AND owner_id IS NULL
    ) THEN
      RAISE NOTICE 'CURATED EXERCISE NOT FOUND: %', exercise_name;
    ELSE
      found_count := found_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Curated exercises matched: %/72', found_count;
END $$;
