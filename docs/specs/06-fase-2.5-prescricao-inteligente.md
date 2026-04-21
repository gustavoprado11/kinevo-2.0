# Fase 2.5 — Prescrição realmente inteligente (infra + contexto + regras de domínio)

**Status:** pronta para execução.

**Pré-leitura obrigatória:** `00-visao-geral.md`.

**Contexto prévio:** esta spec nasceu após os walk-throughs da Fase 1.5, quando o Gustavo (profissional de educação física, fundador do Kinevo) observou que a IA prescrevia o mesmo programa para alunos diferentes e com volumes inadequados. As regras de prescrição aqui não são chutes do engenheiro — foram coletadas diretamente com o Gustavo em 18/abr/2026 (task #19) e são o coração desta fase.

---

## 1. Motivação e diagnóstico

Dois sintomas críticos reportados:

1. **Baixa variabilidade entre alunos.** Perfis distintos recebem programas quase idênticos. A IA hoje mal decide — o pipeline é ~80% determinístico (slots + heurísticas), com o LLM em papel cosmético.
2. **Volumes excessivos em exercícios individuais.** Alguns exercícios saíram com 5 séries, inadequado para a realidade de prescrição.

Três causas raiz identificadas no diagnóstico técnico (task #17):

- **Cache de programa** (`program-cache.ts`) usa chave que ignora performance, aderência, questionário e observações do treinador. Dois alunos com mesmo perfil básico recebem o **mesmo programa literalmente**, TTL de 24h.
- **Slot templates rígidos** (`slot-templates.ts`) têm `min_sets`/`max_sets` fixos e não redistribuem séries quando múltiplos exercícios do mesmo grupo caem no mesmo slot.
- **Volume cap fraco** (`constraints-engine.ts`) só atua quando volume mínimo excede 130% da capacidade; não há limite por exercício individual.

Auditoria da infra OpenAI (task #18) revelou que a pipeline **já usa GPT** (`gpt-4.1-mini`, apesar do nome do arquivo ser `claude-agent.ts`), mas:

- **JSON Mode legado**, não strict — parser fuzzy compensa saídas malformadas.
- **Zero prompt caching** configurado.
- **Zero telemetria de custo** no DB (só em `console.log`).
- **Zero retry** com backoff.
- Custo atual estimado: ~$0.005–0.01 por geração.

## 2. Escopo

Esta fase entrega **infra + contexto + guardrails de domínio** pra IA decidir com variação e qualidade. **Não reescreve o slot builder** — isso fica para a Fase 2.6, com dados desta fase para guiar.

**No escopo:**

- Telemetria de custo/tokens no DB
- Migração de JSON Mode → Structured Outputs (strict schema)
- Prompt em 3 camadas para habilitar prompt caching da OpenAI
- Enriquecer contexto injetado (performance, aderência, estagnação, anamnese completa)
- Retry exponencial + fallback de modelo
- Corrigir chave de cache (incluir hash de contexto dinâmico)
- Ajuste de temperatura + few-shot para variação
- **Regras de domínio codificadas como guardrails pós-geração** (ver §5)

**Fora do escopo:**

- Reescrever `slot-templates.ts` ou `program-builder.ts`
- Tocar na UX do painel
- Adicionar novos campos ao questionário de anamnese
- Dashboard de custo/qualidade (fica como follow-up, consome a telemetria desta fase)
- Migrar para `gpt-4.1` full (decisão adiada para depois de baseline de qualidade do `gpt-4.1-mini` com contexto enriquecido)
- Renomear `claude-agent.ts` para `llm-agent.ts` (follow-up cosmético)

## 3. Arquitetura alvo em uma frase

Pipeline atual preservada estruturalmente, mas com: (a) colunas de telemetria em `prescription_generations`; (b) `llm-client.ts` virando o único caminho OpenAI com structured outputs, retry e fallback; (c) `prompt-builder.ts` reestruturado em 3 camadas estáveis + 1 dinâmica; (d) `context-enricher.ts` injetando histórico de performance real; (e) `program-cache.ts` com chave reconstruída incluindo contexto dinâmico; (f) novo `prescription-rules-validator.ts` aplicando as regras de domínio do Gustavo como guardrail pós-geração.

---

## 4. Regras de domínio (input do profissional de ed. física)

Estas regras vêm do Gustavo. **São verdade de domínio**, não sugestões. Violação delas é bug.

### 4.1 Séries por exercício individual

**Exercício COMPOSTO** (agachamento, supino, terra, remada, desenvolvimento com barra, etc.):

- Máximo absoluto: **4 séries**. Sem exceção, independente do objetivo.

**Exercício ACESSÓRIO/ISOLADO** (rosca, elevação lateral, cadeira extensora, panturrilha no smith, etc.):

- Iniciante: máximo 3 séries
- Intermediário: máximo 4 séries
- Avançado: máximo 5 séries

### 4.2 Séries por grupo muscular dentro de um treino

**Grupos que o principal pode ter 4 séries** (chamados "grupos que tolera alto volume por exercício"):

- Peito, costas, ombro, quadríceps, posterior de coxa, glúteo, **panturrilha**

**Grupos que o principal fica em no máximo 3 séries**:

- Bíceps, tríceps, antebraço, abdômen

### 4.3 Limite de exercícios com 4 séries por treino

Regra central: **no máximo um exercício com 4 séries por grupo muscular num mesmo treino.** Exemplos:

- **Push (peito + ombro + tríceps)**: até 2 exercícios com 4 séries — um de peito, um de ombro. Tríceps fica em 3.
- **Upper (peito + costas + ombro + bíceps + tríceps)**: até 3 com 4 séries (peito, costas, ombro). Braços em 3.
- **Legs (quad + posterior + glúteo + panturrilha)**: até 4 com 4 séries.
- **Pull (costas + bíceps)**: até 1 com 4 séries (costas). Bíceps em 3.

Quando dois exercícios do **mesmo grupo** aparecem no mesmo treino: **primeiro tem mais, segundo menos**. Exemplo: supino reto 4, supino inclinado 3. Nunca 4+4.

### 4.4 Volume semanal por grupo muscular

Varia com três dimensões: **nível do aluno**, **objetivo**, **tempo disponível por sessão**. Os ranges do sistema atual são razoáveis — manter os existentes em `constants.ts` desde que reflitam:

- Iniciante ~8-12 séries/grupo/semana
- Intermediário ~12-18
- Avançado ~16-22

Ajustar para baixo em hipertrofia com sessões curtas (<45min); para cima em sessões longas (>75min).

**Aderência histórica** foi avaliada mas **não entra no cálculo de volume nesta fase** — fica registrada como follow-up futuro.

### 4.5 Split por perfil

A IA **decide o split baseado no perfil**:

- 2x/semana: Full body AB
- 3x/semana iniciante: AB repetido (A-B-A)
- 3x/semana intermediário: ABC
- 3x/semana avançado: Push/Pull/Legs
- 4x/semana: Upper/Lower A/B ou PPL+1
- 5x/semana: PPL+UL ou bro-split
- 6x/semana avançado: PPLPPL

Estes são defaults. Fica fora de escopo desta fase permitir o trainer sobrescrever (fica como follow-up).

### 4.6 Variabilidade entre alunos

Dois alunos com **perfil básico parecido** (ex: ambos intermediários, hipertrofia, 3x/semana, sem lesão) mas com **históricos diferentes** (um estagnou em supino, o outro progride em tudo) devem receber **mudanças significativas**: splits podem variar, exercícios podem ser bem diferentes, progressão distinta.

Aluno **novo sem histórico** (sem sessões feitas, sem observações, sem estagnação): programa conservador padrão. Sem histórico, a IA joga no seguro — volume no limite inferior da faixa, exercícios básicos e comuns, foco em aprendizado do movimento.

### 4.7 Ordem dos exercícios dentro do treino

- Compostos antes de acessórios
- Grandes grupos antes de pequenos
- Exercícios de maior carga/complexidade antes
- Finalizar com isolado/acessório do grupo prioritário do dia

### 4.8 Reps e descanso por objetivo

- **Hipertrofia**: 8-12 reps, descanso 60-90s (acessórios 60s, compostos pesados 90s)
- **Força**: 3-6 reps, descanso 2-3 min
- **Resistência**: 12-20 reps, descanso 30-45s
- **Saúde geral**: 8-15 reps, descanso 60s

### 4.9 Fatores de contexto por prioridade

**Crítico** (prescrição sem isto é inaceitável):

- Anamnese / questionário respondido

**Importantes** (usar sempre que disponíveis, mas não bloqueia geração):

- Exercícios estagnados há 3+ semanas
- Aderência (% treinos feitos nas últimas 4 semanas)
- Observações anotadas pelo trainer

**Nice to have**:

- Preferência declarada de tipo de equipamento

---

## 5. Especificação técnica

### 5.1 Modelo de dados

Uma migration nova. **Sem `DROP`**, apenas `ADD COLUMN`. Sem backfill — campos passam a ser populados a partir da migration.

```sql
-- web/supabase/migrations/104_prescription_generations_telemetry.sql
ALTER TABLE public.prescription_generations
  ADD COLUMN IF NOT EXISTS tokens_input_new integer,
  ADD COLUMN IF NOT EXISTS tokens_input_cached integer,
  ADD COLUMN IF NOT EXISTS tokens_output integer,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10, 6),
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS retry_count smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS rules_violations_count smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rules_violations_json jsonb;

COMMENT ON COLUMN public.prescription_generations.rules_violations_json IS 'Array de violações de regras de domínio detectadas pós-geração (§4 da spec 06). Populado pelo rules-validator.';
```

**Observação:** `rules_violations_*` existe para **observabilidade**, não para bloquear. Se a IA produz programa com violação, o validador corrige (quando possível) e registra; se o trainer aceita, o registro fica pra análise posterior.

### 5.2 `llm-client.ts` como única saída OpenAI

Hoje há três pontos de chamada direta à OpenAI: `claude-agent.ts` (analyze + generate), `ai-optimizer.ts`, e `generate-program.ts`. Consolidar todos via `llm-client.ts` v2.

Mudanças no `llm-client.ts`:

- Structured Outputs por padrão quando `options.structured_output` é passado (já implementado; passa a ser default).
- **Retry com backoff exponencial**: 3 tentativas, delays 1s / 2s / 4s. Só retry em erros de rede, 5xx ou timeout — não em 4xx.
- **Fallback de modelo**: se `gpt-4.1-mini` falhar as 3 tentativas, tenta `gpt-4o-mini` uma vez. Se também falhar, propaga erro para o caller (que decide fallback heurístico).
- **Emissão de telemetria** via callback `onUsage(usage)` passado pelo caller — mantém o client puro, deixa `generate-program.ts` decidir como persistir.
- Preços hardcoded em uma tabela central (substitui as duplicações atuais em `claude-agent.ts` e `ai-optimizer.ts`).

Refatorar `claude-agent.ts` e `ai-optimizer.ts` para consumirem `llm-client.ts`. Remover os `fetch` diretos.

### 5.3 Schema strict

`schemas.ts` já tem a forma do schema v2 (`GENERATION_JSON_SCHEMA`). Formalizar:

- Adicionar `additionalProperties: false` em todo nível (já parcial, confirmar exaustivamente).
- Versionar via constante `PROMPT_VERSION = 'v2.5.0'` exportada do próprio arquivo. Enviar junto ao telemetry como `prompt_version`.
- Passar o schema no request via `response_format: { type: 'json_schema', json_schema: { name: 'prescription_program', schema: ..., strict: true } }`.

### 5.4 Prompt em 3 camadas para caching

Reestruturar `prompt-builder.ts`. O prompt final enviado à OpenAI passa a ter a ordem **estrita** abaixo. OpenAI cacheia automaticamente prompts de ≥1024 tokens com início estável — desconto de 50% nos tokens cacheados.

**Camada 1 — System estável (cacheável globalmente):**

- Role, metodologia Kinevo, regras de segurança, formato de saída.
- **Regras de domínio §4 desta spec** codificadas como system prompt. A IA precisa conhecer antes de prescrever.
- Exemplos few-shot (2-3 pares de perfil + programa bem-feito — ver §5.7).
- Absolutamente **nada dinâmico** nesta camada.

**Camada 2 — Pool de exercícios do trainer (cacheável por `trainer_id`):**

- Lista de exercícios disponíveis do trainer (nome, IDs, grupo, equipamento, padrão de movimento).
- Pode incluir `pool_version` como hash — invalida quando trainer adiciona/remove exercícios.

**Camada 3 — Contexto do aluno (dinâmico, não-cacheável):**

- Perfil básico, anamnese, histórico de performance, observações, questionário.
- Tudo vindo do `context-enricher.ts` enriquecido (§5.5).

**Camada 4 — Instrução final (curta):**

- "Gere o programa para este aluno seguindo o schema."

A posição das camadas é crítica: OpenAI só cacheia a partir do **início estável**. Camada 1 + 2 precisam ser absolutamente determinísticas dado `trainer_id`. Qualquer caractere muda → cache invalida.

### 5.5 Contexto enriquecido

Expandir `context-enricher.ts` para produzir um `EnrichedStudentContext` com os campos:

- `profile` (como hoje)
- `anamnese_summary` — resumo estruturado das respostas do questionário, **incluindo respostas qualitativas** (sono, stress, preferências, histórico de lesões passadas cicatrizadas)
- `performance_summary`:
  - `stagnated_exercises`: lista de exercícios com ≥3 semanas sem progressão em carga/volume (nome, grupo, tempo estagnado)
  - `progressing_well`: exercícios com progresso consistente
  - `last_session_dates`: últimas 4 semanas (granularidade semanal)
- `adherence`:
  - `rate_last_4_weeks`: % de sessões agendadas realizadas
  - `bucket`: `'excelente' | 'boa' | 'regular' | 'baixa'` (thresholds: ≥90%, ≥70%, ≥50%, <50%)
- `trainer_observations`: array das últimas 5 observações livres anotadas pelo trainer
- `active_injuries`: lesões ativas com data de início e observação clínica (se houver)
- `equipment_preference`: declarada pelo aluno (se houver)
- `is_new_student`: boolean (sem sessões feitas E sem programa ativo anterior)

Se `is_new_student === true`, a Camada 3 explicitamente sinaliza "aluno novo sem histórico — prescrição conservadora".

### 5.6 Cache fix

Reescrever `computeCacheKey()` em `program-cache.ts`. Nova chave inclui:

- Todos os campos atuais (training_level, goal, available_days, session_duration, equipment, medical_restrictions, favorite/disliked_exercise_ids).
- **Hash SHA-1 (primeiros 10 chars)** de cada um dos seguintes:
  - `anamnese_summary` — pra que respostas de questionário diferentes invalidem cache.
  - `performance_summary` — pra que estagnação mude o programa.
  - `adherence.bucket` — pra que mudança de bucket (não percentual) invalide.
  - `trainer_observations` concatenadas.
  - `active_injuries` serializadas.

**TTL reduzido de 24h para 6h.** Motivo: mesmo com chave enriquecida, queremos regenerar frequentemente para absorver novas sessões/observações que aconteçam no dia.

### 5.7 Variação LLM

- **Temperature**: 0.3 → **0.5**. Justificativa: com schema strict + contexto rico + guardrails pós-geração, temperatura mais alta produz variação útil sem fuga de regras.
- **Few-shot examples** na Camada 1:
  - Exemplo 1: perfil iniciante + programa conservador Full-body AB.
  - Exemplo 2: perfil intermediário estagnado em supino + programa ABC com variação no padrão de empurrar.
  - Exemplo 3: perfil avançado com sessões longas + PPL 5x com volume no limite superior.
- Exemplos são **sintéticos**, não de alunos reais. Ficam hardcoded no arquivo `prompt-examples.ts` e são importados pela Camada 1.

### 5.8 Validador de regras de domínio (novo)

Novo arquivo `web/src/lib/prescription/rules-validator.ts`.

Export: `validatePrescriptionAgainstRules(program, studentContext): { violations: RuleViolation[], corrections: ProgramCorrection[] }`.

**Regras codificadas** (cada uma com ID, severity, detector, corrector):

- `MAX_SETS_COMPOUND_4` — exercício composto com mais de 4 séries. Severity: error. Corrector: clamp para 4.
- `MAX_SETS_ACCESSORY_BY_LEVEL` — acessório acima do teto do nível. Severity: error. Corrector: clamp pro teto.
- `MAX_SETS_SMALL_GROUP_3` — grupo pequeno (bíceps/tríceps/antebraço/abdômen) com principal >3. Severity: error. Corrector: clamp para 3.
- `MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP` — mais de um exercício com 4 séries no mesmo grupo/treino. Severity: error. Corrector: reduzir o segundo (e demais) para 3.
- `COMPOUND_BEFORE_ACCESSORY` — ordem errada dentro do treino. Severity: warning. Corrector: reordenar.
- `LARGE_GROUP_BEFORE_SMALL` — ex: bíceps antes de costas no mesmo treino. Severity: warning. Corrector: reordenar.
- `REPS_MATCH_GOAL` — reps fora do range esperado para o objetivo (§4.8). Severity: warning. Corrector: ajustar para o range.
- `REST_MATCH_GOAL` — descanso fora do range. Severity: warning. Corrector: ajustar.

Chamado após cada geração LLM, antes de persistir. Corrige o que dá, registra todas as violações em `rules_violations_json`.

### 5.9 Telemetria

Novo helper `logGenerationTelemetry(generationId, supabase, payload)` em `web/src/lib/prescription/telemetry.ts`.

Chamado após cada call OpenAI. Persiste em `prescription_generations`:

- `tokens_input_new`, `tokens_input_cached`, `tokens_output`
- `cost_usd` calculado via pricing table central
- `model_used`, `retry_count`, `prompt_version`
- `rules_violations_count`, `rules_violations_json`

Sem dashboard — queries SQL ad hoc bastam para validar nas primeiras semanas. Query-exemplo no log de execução.

---

## 6. Testes

### 6.1 Unit

- `computeCacheKey` com mesmo `profile` mas `performance_summary` diferente retorna keys diferentes.
- `llm-client` retry respeita delays (mock de timers) e limita a 3 tentativas.
- `llm-client` fallback cai para `gpt-4o-mini` após 3 falhas.
- Schema strict rejeita output malformado (input de fixture com campo extra).
- `rules-validator`:
  - Detecta composto com 5 séries.
  - Detecta bíceps principal com 4 séries.
  - Detecta 2 exercícios de peito com 4 séries no mesmo treino.
  - Corrige cada uma e preserva estrutura.
- `context-enricher`:
  - `is_new_student` vira `true` sem sessões e sem programa ativo.
  - `stagnated_exercises` lista exercício sem progressão há 4 semanas (fixture).

### 6.2 Integration

- **Variabilidade**: 2 alunos com perfil básico idêntico mas `performance_summary` divergente → programas com ≥40% de exercícios distintos e/ou splits distintos. (Limite 40% escolhido porque reflete "mudanças significativas".)
- **Regras de domínio**: rodar geração em 3 perfis fictícios (a serem criados com Gustavo no walk-through) e verificar zero violações de severity `error` em `rules_violations_json`.
- **Custo médio** por geração fica em $0.004–$0.012 (depois de caching começar a funcionar).
- **Backward compat**: programa gerado antes desta fase (row existente em `prescription_generations`) ainda abre e renderiza no builder.

### 6.3 Walk-through manual com o Gustavo

Rodar pelos menos 3 gerações com perfis contrastantes e **revisar visualmente**:

1. Programas são visivelmente diferentes? (checklist §4.6)
2. Ordem dos exercícios correta? (§4.7)
3. Nenhum exercício viola §4.1-4.3?
4. Reps/descanso batem com objetivo? (§4.8)
5. Coerência muscular — todos grupos principais cobertos no volume certo?

Se qualquer item falhar, abrir task de ajuste antes do rollout.

---

## 7. Rollout

Feature flag `prescription.smart_v2_enabled` (trainer-level, default `false`).

**Fase 1 — Dogfood** (semana 1): Gustavo + 1-2 trainers de confiança. Monitorar `rules_violations_json` e custo médio.

**Fase 2 — Amostra** (semana 2-3): 10% dos trainers ativos, se Fase 1 limpa. Métrica de sucesso: zero violação de severity `error`, custo no range esperado, feedback qualitativo positivo.

**Fase 3 — Geral** (semana 4): 100%, removendo flag na semana 6 se estável.

A gradualidade existe não pelo tamanho da base, mas porque **qualidade de prescrição é sensível** — se a IA gerar um programa ruim e o trainer entregar sem olhar, pode ter impacto real no aluno. Rollout gradual dá chance de pegar problemas antes de escala.

---

## 8. Critérios de aceite

A Fase 2.5 está pronta quando:

- **Todos os testes passam** (unit, integration).
- **Telemetria populada em 100% das gerações** após merge.
- **Zero regressão** em `prescription_generations` existente — rows antigas ainda abrem no builder.
- **Programas gerados em walk-through** passam na revisão do Gustavo: (a) visivelmente diferentes para perfis diferentes, (b) sem violação de §4.1-4.3, (c) ordem de exercícios correta, (d) reps/descanso coerentes com objetivo, (e) coerência muscular.
- **Custo médio por geração** em $0.004–$0.012.
- **Prompt caching ativo** — telemetria mostra `tokens_input_cached > 0` em pelo menos 40% das gerações após a primeira semana (meta conservadora).

---

## 9. Riscos

- **Migration em tabela grande.** `prescription_generations` pode ter muitas linhas; `ADD COLUMN` com default NULL é barato no Postgres moderno, mas vale confirmar no walk-through.
- **Prompt caching sensível a estrutura.** Se o pool de exercícios do trainer variar muito em tamanho, Camada 2 invalida cache frequentemente. Medir antes de otimizar mais.
- **Temperature 0.5 pode quebrar constraints.** Mitigação: schema strict + rules-validator pós-geração. Se violação de `error` passar de 5% nas primeiras semanas, cair para 0.4.
- **Cache fix pode aumentar custo.** Hoje cache hit é ~grátis e retorna o mesmo programa errado. Novo cache bate menos → custo sobe. Aceitável.
- **Fallback de modelo muda experiência.** Se um aluno cair em `gpt-4o-mini` por retry e outro em `gpt-4.1-mini`, qualidade pode divergir. Mitigação: `model_used` fica logado; fallback só dispara em erro real.
- **Rules-validator agressivo pode deformar o programa.** Se corrigir demais (ex: reduz de 4 para 3 em muitos lugares), programa fica conservador demais. Walk-through é o gate.

---

## 10. Follow-ups explícitos (pós-2.5)

- **Fase 2.6** — reescrever slot-builder/program-builder como constraints declarativos + validação pós-geração. Depende de ter a telemetria e os rules violations desta fase.
- **Dashboard de custo/qualidade** — consome colunas de telemetria.
- **A/B test** `gpt-4.1-mini` vs `gpt-4.1` (full) — medir ganho de qualidade vs. custo.
- **Trainer pode sobrescrever split** sugerido pela IA antes de gerar (§4.5).
- **Aderência entra no cálculo de volume** (§4.4).
- **Renomear `claude-agent.ts` → `llm-agent.ts`**.
- **Aluno novo — oferecer anamnese guiada antes da primeira prescrição**, garantindo qualidade do input desde o dia 1.

---

## 11. Tamanho estimado

- 1 sprint focada (7-10 dias úteis para Claude Code).
- Deliverables aproximados: 1 migration, 3 arquivos refatorados (`llm-client.ts`, `claude-agent.ts`, `ai-optimizer.ts`), 3 arquivos estendidos (`prompt-builder.ts`, `context-enricher.ts`, `program-cache.ts`), 2 arquivos novos (`rules-validator.ts`, `telemetry.ts`, `prompt-examples.ts`), schema formalizado, ~15 testes novos.
