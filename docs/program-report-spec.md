# Spec Técnica: Relatório de Programa de Treino

## Visão Geral

Relatório gerado automaticamente ao final de um programa de treino, com revisão/aprovação do treinador antes de ser liberado para o aluno. Disponível como tela interativa no app + exportação PDF para envio via WhatsApp.

**Modelo:** Sistema gera rascunho automaticamente → Treinador revisa e adiciona observações → Treinador publica → Aluno visualiza no app e/ou recebe PDF.

---

## Fase 1 — Modelo de Dados (Supabase Migration)

### Nova tabela: `program_reports`

```sql
CREATE TABLE program_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_program_id UUID NOT NULL REFERENCES assigned_programs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    -- Status do relatório
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),

    -- Período do programa (snapshot)
    program_name TEXT NOT NULL,
    program_duration_weeks INTEGER,
    program_started_at TIMESTAMPTZ,
    program_completed_at TIMESTAMPTZ,

    -- Métricas computadas (snapshot — congeladas no momento da geração)
    metrics_json JSONB NOT NULL DEFAULT '{}',
    -- Estrutura do metrics_json:
    -- {
    --   "frequency": {
    --     "completed_sessions": 21,
    --     "planned_sessions": 24,
    --     "percentage": 87.5,
    --     "weekly_breakdown": [3, 3, 2, 3, 3, 3, 2, 2],
    --     "best_streak_weeks": 5
    --   },
    --   "volume": {
    --     "total_tonnage_kg": 142000,
    --     "weekly_tonnage": [16500, 17200, 15800, 18100, 18500, 19000, 17900, 19000],
    --     "previous_program_tonnage_kg": 120000  -- null se não houver programa anterior
    --   },
    --   "rpe": {
    --     "weekly_avg": [6.5, 7.0, 7.0, 7.5, 7.0, 7.5, 7.5, 7.0],
    --     "overall_avg": 7.2
    --   },
    --   "progression": {
    --     "top_exercises": [
    --       {
    --         "exercise_id": "uuid",
    --         "exercise_name": "Agachamento",
    --         "weekly_max_weight": [80, 85, 85, 90, 90, 90, 92, 95],
    --         "start_weight": 80,
    --         "end_weight": 95,
    --         "change_kg": 15,
    --         "change_pct": 18.75
    --       }
    --     ]
    --   },
    --   "checkins": {
    --     "averages": [
    --       { "question_label": "Qualidade do sono", "avg_value": 7.8, "scale_max": 10 },
    --       { "question_label": "Nível de energia", "avg_value": 7.2, "scale_max": 10 }
    --     ]
    --   }
    -- }

    -- Observações do treinador
    trainer_notes TEXT,

    -- Timestamps
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_program_reports_student ON program_reports(student_id);
CREATE INDEX idx_program_reports_trainer ON program_reports(trainer_id);
CREATE INDEX idx_program_reports_program ON program_reports(assigned_program_id);

-- Constraint: máximo 1 relatório por programa
CREATE UNIQUE INDEX idx_program_reports_unique_program
    ON program_reports(assigned_program_id);

-- RLS
ALTER TABLE program_reports ENABLE ROW LEVEL SECURITY;

-- Treinador vê e edita seus relatórios
CREATE POLICY "Trainers manage own reports"
    ON program_reports FOR ALL
    USING (trainer_id IN (SELECT id FROM trainers WHERE auth_user_id = auth.uid()))
    WITH CHECK (trainer_id IN (SELECT id FROM trainers WHERE auth_user_id = auth.uid()));

-- Aluno vê apenas relatórios publicados
CREATE POLICY "Students view published reports"
    ON program_reports FOR SELECT
    USING (
        status = 'published'
        AND student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid())
    );
```

### Decisão: JSONB snapshot vs tabelas normalizadas

**Por que JSONB (`metrics_json`)?**

1. Os dados são **imutáveis após geração** — é um snapshot, não dados vivos
2. Evita 4-5 tabelas auxiliares (report_frequency, report_progression, etc.)
3. Simplifica a query de leitura: um único SELECT retorna tudo
4. O PDF e a tela leem o mesmo JSON — zero divergência
5. Se o aluno deleta set_logs ou a session, o relatório permanece intacto
6. Permite evolução incremental (adicionar novas métricas sem migrations)

**Trade-off:** Não é possível fazer queries SQL direto nas métricas (ex: "todos os alunos com frequência > 80%"). Se isso for necessário no futuro, basta indexar campos JSONB específicos com `CREATE INDEX ... ON program_reports ((metrics_json->>'frequency'->>'percentage'))`.

---

## Fase 2 — RPC de Geração de Métricas (Supabase Edge Function ou RPC)

### Função: `generate_program_report(program_id UUID)`

A geração é feita por uma RPC no Supabase que computa todas as métricas e cria o registro em `program_reports` com status `draft`.

```sql
CREATE OR REPLACE FUNCTION generate_program_report(p_program_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_program assigned_programs%ROWTYPE;
    v_report_id UUID;
    v_metrics JSONB;
    v_frequency JSONB;
    v_volume JSONB;
    v_rpe JSONB;
    v_progression JSONB;
    v_checkins JSONB;
    v_planned_sessions INT;
    v_completed_sessions INT;
    v_total_tonnage DECIMAL;
    v_prev_tonnage DECIMAL;
    v_best_streak INT;
    v_num_workouts INT;
    v_duration INT;
BEGIN
    -- 1. Buscar programa
    SELECT * INTO v_program FROM assigned_programs WHERE id = p_program_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Programa não encontrado: %', p_program_id;
    END IF;

    -- 2. Verificar se já existe relatório
    IF EXISTS (SELECT 1 FROM program_reports WHERE assigned_program_id = p_program_id) THEN
        RAISE EXCEPTION 'Relatório já existe para este programa';
    END IF;

    -- 3. Calcular FREQUÊNCIA
    -- Sessões planejadas = num_workouts × duration_weeks
    SELECT COUNT(*) INTO v_num_workouts
    FROM assigned_workouts WHERE assigned_program_id = p_program_id;

    v_duration := COALESCE(v_program.duration_weeks, 8);
    v_planned_sessions := v_num_workouts * v_duration;

    -- Sessões completadas
    SELECT COUNT(*) INTO v_completed_sessions
    FROM workout_sessions
    WHERE assigned_program_id = p_program_id AND status = 'completed';

    -- Breakdown semanal (sessões por semana)
    -- weekly_breakdown como array de counts por program_week
    WITH weekly_counts AS (
        SELECT COALESCE(program_week, 1) AS week, COUNT(*) AS cnt
        FROM workout_sessions
        WHERE assigned_program_id = p_program_id AND status = 'completed'
        GROUP BY COALESCE(program_week, 1)
        ORDER BY week
    )
    SELECT jsonb_agg(cnt ORDER BY week) INTO v_frequency
    FROM (
        SELECT w.week, COALESCE(wc.cnt, 0) AS cnt
        FROM generate_series(1, v_duration) AS w(week)
        LEFT JOIN weekly_counts wc ON wc.week = w.week
    ) sub;

    -- Melhor streak de semanas consecutivas
    WITH weekly_active AS (
        SELECT DISTINCT COALESCE(program_week, 1) AS week
        FROM workout_sessions
        WHERE assigned_program_id = p_program_id AND status = 'completed'
    ),
    gaps AS (
        SELECT week, week - ROW_NUMBER() OVER (ORDER BY week) AS grp
        FROM weekly_active
    )
    SELECT COALESCE(MAX(streak), 0) INTO v_best_streak
    FROM (SELECT COUNT(*) AS streak FROM gaps GROUP BY grp) sub;

    -- 4. Calcular VOLUME (tonelagem)
    SELECT COALESCE(SUM(sl.weight * sl.reps_completed), 0) INTO v_total_tonnage
    FROM workout_sessions ws
    JOIN set_logs sl ON sl.workout_session_id = ws.id
    WHERE ws.assigned_program_id = p_program_id
      AND ws.status = 'completed'
      AND sl.is_completed = true
      AND sl.weight IS NOT NULL
      AND sl.reps_completed IS NOT NULL;

    -- Tonelagem do programa anterior (para comparação)
    SELECT COALESCE(SUM(sl.weight * sl.reps_completed), 0) INTO v_prev_tonnage
    FROM assigned_programs ap_prev
    JOIN workout_sessions ws ON ws.assigned_program_id = ap_prev.id
    JOIN set_logs sl ON sl.workout_session_id = ws.id
    WHERE ap_prev.student_id = v_program.student_id
      AND ap_prev.id != p_program_id
      AND ap_prev.status = 'completed'
      AND ws.status = 'completed'
      AND sl.is_completed = true
      AND sl.weight IS NOT NULL
      AND ap_prev.completed_at < v_program.started_at
    ORDER BY ap_prev.completed_at DESC
    LIMIT 1;
    -- Nota: o LIMIT 1 aqui não funciona bem com SUM.
    -- Abordagem correta abaixo na implementação real.

    -- 5. Calcular RPE
    -- (RPE de sessão, agrupado por semana)

    -- 6. Calcular PROGRESSÃO
    -- Top 3 exercícios por frequência, com max_weight por semana

    -- 7. Calcular CHECK-INS
    -- Médias dos campos numéricos em form_submissions vinculados ao programa

    -- 8. Montar JSON e criar registro
    v_metrics := jsonb_build_object(
        'frequency', jsonb_build_object(
            'completed_sessions', v_completed_sessions,
            'planned_sessions', v_planned_sessions,
            'percentage', CASE WHEN v_planned_sessions > 0
                THEN ROUND((v_completed_sessions::DECIMAL / v_planned_sessions) * 100, 1)
                ELSE 0 END,
            'weekly_breakdown', COALESCE(v_frequency, '[]'::jsonb),
            'best_streak_weeks', v_best_streak
        ),
        'volume', jsonb_build_object(
            'total_tonnage_kg', ROUND(v_total_tonnage, 0),
            'previous_program_tonnage_kg', CASE WHEN v_prev_tonnage > 0 THEN ROUND(v_prev_tonnage, 0) ELSE NULL END
        ),
        'rpe', '{}'::jsonb,
        'progression', '{}'::jsonb,
        'checkins', '{}'::jsonb
    );

    INSERT INTO program_reports (
        assigned_program_id, student_id, trainer_id,
        program_name, program_duration_weeks,
        program_started_at, program_completed_at,
        metrics_json
    ) VALUES (
        p_program_id, v_program.student_id, v_program.trainer_id,
        v_program.name, v_duration,
        v_program.started_at, v_program.completed_at,
        v_metrics
    )
    RETURNING id INTO v_report_id;

    RETURN v_report_id;
END;
$$;
```

> **Nota:** A RPC acima é um esqueleto. A implementação real será feita em TypeScript (Edge Function ou chamada client-side) para facilitar o parsing de JSONB dos form_submissions e a lógica de seleção dos top exercícios. A RPC SQL é mais adequada para as queries numéricas puras (frequência, volume, RPE). A recomendação é uma **Edge Function** que chama múltiplas queries e monta o JSON final.

---

## Fase 3 — API / Service Layer (TypeScript)

### Arquivo: `lib/services/programReportService.ts`

```typescript
// Responsabilidades:
// 1. generateReport(programId) — computa métricas e cria registro draft
// 2. getReport(reportId) — busca relatório completo
// 3. updateTrainerNotes(reportId, notes) — atualiza observações
// 4. publishReport(reportId) — muda status para published
// 5. getReportByProgram(programId) — busca por programa

interface ProgramReportMetrics {
  frequency: {
    completed_sessions: number;
    planned_sessions: number;
    percentage: number;
    weekly_breakdown: number[];
    best_streak_weeks: number;
  };
  volume: {
    total_tonnage_kg: number;
    weekly_tonnage: number[];
    previous_program_tonnage_kg: number | null;
  };
  rpe: {
    weekly_avg: number[];
    overall_avg: number;
  };
  progression: {
    top_exercises: Array<{
      exercise_id: string;
      exercise_name: string;
      weekly_max_weight: number[];
      start_weight: number;
      end_weight: number;
      change_kg: number;
      change_pct: number;
    }>;
  };
  checkins: {
    averages: Array<{
      question_label: string;
      avg_value: number;
      scale_max: number;
    }>;
  };
}
```

### Queries individuais (chamadas pelo service):

**Top 3 exercícios (por frequência de aparição em sessões):**
```sql
SELECT
    COALESCE(sl.executed_exercise_id, sl.exercise_id) AS exercise_id,
    e.name AS exercise_name,
    COUNT(DISTINCT ws.id) AS session_count
FROM workout_sessions ws
JOIN set_logs sl ON sl.workout_session_id = ws.id
JOIN exercises e ON e.id = COALESCE(sl.executed_exercise_id, sl.exercise_id)
WHERE ws.assigned_program_id = :program_id
  AND ws.status = 'completed'
  AND sl.is_completed = true
  AND sl.weight IS NOT NULL
GROUP BY COALESCE(sl.executed_exercise_id, sl.exercise_id), e.name
ORDER BY session_count DESC, SUM(sl.weight * sl.reps_completed) DESC
LIMIT 3;
```

**Progressão semanal de um exercício:**
```sql
SELECT
    ws.program_week,
    MAX(sl.weight) AS max_weight
FROM workout_sessions ws
JOIN set_logs sl ON sl.workout_session_id = ws.id
WHERE ws.assigned_program_id = :program_id
  AND ws.status = 'completed'
  AND sl.is_completed = true
  AND COALESCE(sl.executed_exercise_id, sl.exercise_id) = :exercise_id
GROUP BY ws.program_week
ORDER BY ws.program_week;
```

**RPE semanal:**
```sql
SELECT
    program_week,
    ROUND(AVG(rpe)::numeric, 1) AS avg_rpe
FROM workout_sessions
WHERE assigned_program_id = :program_id
  AND status = 'completed'
  AND rpe IS NOT NULL
GROUP BY program_week
ORDER BY program_week;
```

**Tonelagem semanal:**
```sql
SELECT
    ws.program_week,
    ROUND(SUM(sl.weight * sl.reps_completed)::numeric, 0) AS tonnage
FROM workout_sessions ws
JOIN set_logs sl ON sl.workout_session_id = ws.id
WHERE ws.assigned_program_id = :program_id
  AND ws.status = 'completed'
  AND sl.is_completed = true
  AND sl.weight IS NOT NULL
GROUP BY ws.program_week
ORDER BY ws.program_week;
```

**Tonelagem do programa anterior (corrigida):**
```sql
WITH prev_program AS (
    SELECT id
    FROM assigned_programs
    WHERE student_id = :student_id
      AND id != :current_program_id
      AND status = 'completed'
      AND completed_at < :current_started_at
    ORDER BY completed_at DESC
    LIMIT 1
)
SELECT ROUND(SUM(sl.weight * sl.reps_completed)::numeric, 0) AS tonnage
FROM prev_program pp
JOIN workout_sessions ws ON ws.assigned_program_id = pp.id
JOIN set_logs sl ON sl.workout_session_id = ws.id
WHERE ws.status = 'completed'
  AND sl.is_completed = true
  AND sl.weight IS NOT NULL;
```

**Check-ins (form submissions do programa):**
```sql
SELECT
    fs.answers_json,
    fs.schema_snapshot_json,
    fs.trigger_context
FROM workout_sessions ws
JOIN form_submissions fs ON (
    fs.id = ws.pre_workout_submission_id
    OR fs.id = ws.post_workout_submission_id
)
WHERE ws.assigned_program_id = :program_id
  AND ws.status = 'completed'
  AND fs.status = 'submitted';
```
> Parsing do `answers_json` e `schema_snapshot_json` em TypeScript para extrair campos numéricos (slider, rating) e calcular médias.

---

## Fase 4 — Telas do App (React Native)

### 4.1 Tela do Treinador: Lista de Relatórios

**Rota:** `/(trainer)/reports` ou como aba dentro do perfil do aluno

**Funcionalidades:**
- Lista relatórios do treinador (todos os alunos)
- Filtro por status: Rascunho / Publicado
- Card de cada relatório mostra: nome do aluno, nome do programa, período, status
- Tap → abre o relatório completo

### 4.2 Tela do Treinador: Visualização/Edição do Relatório

**Rota:** `/(trainer)/reports/[id]`

**Layout:** Idêntico ao mockup aprovado (cards de métricas, gráficos, check-ins, observações)

**Funcionalidades exclusivas do treinador:**
- Campo de texto editável "Observações do treinador"
- Botão "Publicar relatório" (muda status para published)
- Botão "Regenerar métricas" (recomputa tudo, mantém as observações)
- Botão "Exportar PDF"
- Badge de status (Rascunho / Publicado)

### 4.3 Tela do Aluno: Visualização do Relatório

**Rota:** `/(tabs)/reports/[id]` ou acessível pelo card do programa

**Layout:** Mesmo do treinador, mas:
- Sem botões de edição/publicação
- Observações do treinador aparecem como texto estático
- Botão "Compartilhar" (share sheet nativo → PDF ou link)
- Só aparece se status = 'published'

### 4.4 Trigger de Geração Automática

Quando o treinador muda o status de um `assigned_program` para `completed`:
1. Verificar se já existe relatório
2. Se não existe, chamar `generateReport(programId)`
3. Mostrar toast: "Relatório gerado! Revise e publique."
4. Opcionalmente: notificação push para o treinador

---

## Fase 5 — Exportação PDF

### Abordagem: React Native + `react-native-html-to-pdf` ou `expo-print`

O PDF é gerado client-side a partir de um template HTML que consome o mesmo `metrics_json`.

**Template HTML do PDF:**
- Header com logo Kinevo + nome do aluno + período
- Mesmas seções do mockup (frequência, volume, progressão, RPE, check-ins, observações)
- Gráficos como Chart.js renderizados em canvas → convertidos para imagem base64
- Rodapé com data de geração e nome do treinador

**Alternativa server-side:** Edge Function que renderiza o HTML e retorna PDF via Puppeteer/Playwright (mais consistente, mas mais complexo). Recomendo começar client-side e migrar se necessário.

---

## Fases de Implementação

| Fase | Escopo | Dependências |
|------|--------|-------------|
| **F1** | Migration: criar tabela `program_reports` com RLS | Nenhuma |
| **F2** | Service: `programReportService.ts` com todas as queries | F1 |
| **F3** | Tela treinador: visualização do relatório (read-only com dados mock) | F1 |
| **F4** | Integração: conectar tela com service real, geração automática | F2, F3 |
| **F5** | Edição: campo de observações + publicar | F4 |
| **F6** | Tela aluno: visualização de relatórios publicados | F4 |
| **F7** | Exportação PDF | F4 |
| **F8** | Trigger automático na conclusão do programa | F4 |

---

## Considerações Técnicas

### program_week
Muitas queries dependem de `workout_sessions.program_week`. Se esse campo não estiver populado consistentemente, usar fallback:
```sql
COALESCE(
    ws.program_week,
    GREATEST(1, EXTRACT(WEEK FROM ws.started_at) - EXTRACT(WEEK FROM ap.started_at) + 1)
)
```

### Exercícios com swap
Usar `COALESCE(sl.executed_exercise_id, sl.exercise_id)` em todas as queries de progressão. Se o aluno trocou supino reto por supino inclinado via swap, a progressão acompanha o exercício executado.

### Form Triggers — parsing
Os `answers_json` e `schema_snapshot_json` são JSONB dinâmicos. O service precisa:
1. Ler o `schema_snapshot_json` para encontrar campos do tipo `slider`, `rating`, ou `number`
2. Extrair os valores correspondentes do `answers_json`
3. Calcular médias por campo
4. Campos de texto livre (textarea) são ignorados no relatório
5. Só incluir no relatório se houver >= 3 submissions para ter média relevante

### Retrocompatibilidade
- Programas sem RPE → seção RPE omitida
- Programas sem Form Triggers → seção Check-ins omitida
- Programas sem set_logs com weight → seções de volume e progressão omitidas
- O relatório adapta suas seções ao que há de dados disponíveis
