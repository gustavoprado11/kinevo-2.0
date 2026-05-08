# Milestone 6 — Templates de sistema seedados + onboarding

> **Nota de numeração:** o roadmap original chamou esse milestone de "M6" mas o arquivo é `05-...md` porque há apenas 4 milestones-de-implementação completos antes (M1–M4). M5 (PDF) vem depois deste — decisão pragmática do user em validar primeiro o que reduz fricção (templates seed) antes de adicionar feature técnica nova (PDF via Edge Function).

**Pré-requisitos:** ler `00-visao-geral.md`, `MILESTONE-1-STATUS.md`, `MILESTONE-2-STATUS.md`, `MILESTONE-3-STATUS.md`, `MILESTONE-4-STATUS.md`. Trio M1+M2+M3 + M4 estão em main.

**Goal:** entregar **templates de sistema prontos pra uso** (cobrindo 80% dos casos comuns de avaliação presencial) + **tour de onboarding** explicando o flow na primeira vez que o trainer entra na aba "Avaliações Presenciais". Resolve o atrito que o user identificou em M4: "preciso criar template antes de usar protocolo".

**Plataforma:** Supabase (migration SQL) + web (tour) + mobile (tour).

**Dura:** 3-5 dias úteis.

**Branch:** sem branch — direto em main, sem commit/push até validação.

---

## 1. Por que M6 é estratégico

M1+M2+M3+M4 entregaram a infraestrutura completa: dados, fórmulas, captura mobile, builder web. Mas trainer abrindo o app pela primeira vez encontra:

- Aba "Avaliações Presenciais" vazia
- Pra criar sessão, precisa antes ir em Templates → criar do zero → adicionar testes → salvar → voltar
- Curva de aprendizado alta = adoção baixa

**M6 resolve isso com 2 alavancas:**

1. **Templates seedados de sistema** (`trainer_id IS NULL`, padrão estabelecido em migration 066): trainer abre Templates → vê 5 opções prontas → clica "Usar este" → sessão criada. Zero criação manual. Para customização, clone-on-edit já está implementado em M4 (`update-template.ts`).

2. **Tour de onboarding** (3-4 steps) que aparece na primeira vez explicando: "esses templates são do Kinevo, você pode usar direto ou clonar pra editar".

---

## 2. O que entra no escopo

### 2.1 Migration SQL: 5 templates de sistema seedados

Padrão já estabelecido em `supabase/migrations/066_system_form_templates.sql` (que tem weekly_checkin, etc). Reutilizar a estrutura: `trainer_id = NULL`, `system_key` único por template, `created_source = 'system'`.

**Templates a seedar (5):**

| `system_key` | Título | Conteúdo | Tempo estimado |
|---|---|---|---|
| `assessment_anthropometry_basic` | Antropometria mínima | Peso, altura, cintura, quadril, IMC, RCQ | ~5 min |
| `assessment_jackson_pollock_3` | Composição corporal — Jackson & Pollock 3 dobras | Peso, altura, J&P 3, computed BMI/RCQ | ~10 min |
| `assessment_jackson_pollock_7` | Composição corporal — Jackson & Pollock 7 dobras | Peso, altura, J&P 7, computed BMI/RCQ | ~15 min |
| `assessment_petroski_4` | Composição corporal — Petroski 4 dobras (BR) | Peso, altura, Petroski 4, computed BMI/RCQ | ~10 min |
| `assessment_initial_complete` | Avaliação Inicial Presencial | Anamnese rápida (3-5 perguntas) + antropometria + Petroski 4 + classificações | ~20 min |

Cada template tem `schema_json` completo, `description`, `is_default_for_new_students = false` (não auto-atribui), `is_active = true`.

### 2.2 Tour de onboarding web (`TourRunner`)

`web/src/components/onboarding/tours/` já tem infra. Adicionar:

- **`TOUR_STEPS.assessmentsFirstTime`** com 3-4 steps:
  1. **Welcome** — "Bem-vindo às Avaliações Presenciais. Aqui você cria sessões de avaliação, captura medições com o aluno presente e gera laudos."
  2. **Templates de sistema** — highlight "+ Novo template de avaliação" + texto "Já temos 5 templates prontos pra usar. Veja em Templates."
  3. **Criar sessão** — highlight "+ Nova avaliação" + "Tap aqui pra agendar uma sessão. Você vai escolher o aluno, o template, e definir sex/idade — usados nos protocolos de composição corporal."
  4. **Mobile capture** — texto explicando "A captura das medições acontece no aplicativo mobile do treinador, com o aluno presente. Aqui no web você acompanha, vê resultados e gera laudos."

- **Trigger:** primeira vez que `activeTab === 'assessments'` for selecionado E `trainer.onboarding_state.assessments_tour_seen` for falsy
- **Persistência:** atualizar `trainer.onboarding_state.assessments_tour_seen = true` ao completar/dispensar tour

### 2.3 Tour de onboarding mobile

**Investigar primeiro** se mobile tem infra de tour (Joyride, Onboarding component próprio, etc) — se não houver, criar onboarding cards inline na primeira visita à aba "Presenciais" do `forms.tsx`.

Se mobile não tiver infra, fazer um pattern simples:
- 1 card persistente no topo da aba "Presenciais" no estado vazio
- Texto curto explicando: "Use templates do Kinevo ou crie o seu. Toque no + pra começar."
- Botão "Entendi" dispensa permanentemente (persist em MMKV)

### 2.4 E2E tests (opcional)

Investigar se o projeto tem Playwright ou cypress. Se sim, escrever 1 smoke test:
1. Login como trainer
2. Abre /forms
3. Tap "Avaliações Presenciais"
4. Tap "Nova avaliação"
5. Seleciona aluno + template "Antropometria mínima" (sistema) + sex M + age 30
6. Cria sessão
7. Verifica que aparece em "Em andamento"

Se mobile tiver Detox ou similar, smoke test similar.

Se nenhum dos dois tiver infra de e2e, **dispensa**. Não vamos introduzir Playwright só pra M6 — fora do escopo. Anotar como débito futuro.

---

## 3. Conteúdo dos schemas dos templates

### 3.1 `assessment_anthropometry_basic` — Antropometria mínima

```json
{
  "schema_version": "1.0",
  "layout": { "estimated_minutes": 5 },
  "sections": [
    {
      "id": "antropometria",
      "title": "Antropometria",
      "tests": [
        { "id": "weight", "type": "numeric_unit", "label": "Peso", "metric_key": "weight", "unit": "kg", "required": true, "min": 30, "max": 250 },
        { "id": "height", "type": "numeric_unit", "label": "Estatura", "metric_key": "height_m", "unit": "m", "required": true, "min": 1.0, "max": 2.5, "hint": "Em metros — ex: 1,78 ou 1.78" }
      ]
    },
    {
      "id": "circunferencias",
      "title": "Circunferências",
      "tests": [
        { "id": "waist", "type": "numeric_unit", "label": "Cintura", "metric_key": "waist_circumference", "unit": "cm", "required": true, "min": 50, "max": 200 },
        { "id": "hip", "type": "numeric_unit", "label": "Quadril", "metric_key": "hip_circumference", "unit": "cm", "required": true, "min": 60, "max": 220 }
      ]
    },
    {
      "id": "calculados",
      "title": "Calculados",
      "tests": [
        { "id": "bmi", "type": "computed", "label": "IMC", "metric_key": "bmi", "formula_id": "bmi", "inputs": ["weight", "height_m"] },
        { "id": "rcq", "type": "computed", "label": "RCQ", "metric_key": "rcq", "formula_id": "rcq", "inputs": ["waist_circumference", "hip_circumference"] }
      ]
    }
  ]
}
```

### 3.2 `assessment_jackson_pollock_3` — J&P 3 dobras

Similar ao acima + section "Dobras Cutâneas" com 1 test type protocol (`protocol: jackson_pollock_3`). Tempo: ~10 min.

### 3.3 `assessment_jackson_pollock_7` — J&P 7 dobras

Idem com `protocol: jackson_pollock_7`. Tempo: ~15 min.

### 3.4 `assessment_petroski_4` — Petroski 4 dobras

Idem com `protocol: petroski_4` (versão pura, sem peso/estatura — conforme decisão M2). Tempo: ~10 min.

### 3.5 `assessment_initial_complete` — Avaliação Inicial Presencial

Mais robusta:
- Section "Anamnese rápida" (3-5 single_choice/short_text — objetivo, lesões recentes, exercício prévio)
- Section "Antropometria" (peso, altura, cintura, quadril)
- Section "Dobras Cutâneas" (Petroski 4 — protocolo brasileiro como default)
- Section "Calculados" (IMC, RCQ)

Tempo: ~20 min.

---

## 4. Sub-blocos sugeridos (B1 a B3)

### B1 — Migration SQL com templates seedados (1-2 dias)

- Criar migration `124_assessment_seed_templates.sql` (próximo número após 123 do M5 ou se M5 ainda não chegou, pode ser 123)
- 5 INSERTs com schema_json completo
- Idempotência via `ON CONFLICT (system_key) DO NOTHING` ou DELETE+INSERT pattern
- Validar localmente OU via apply_migration MCP em prod
- Não precisa de RLS nova (já coberta por `form_templates` policies existentes)

### B2 — Tour onboarding web (1-2 dias)

- Estender `web/src/components/onboarding/tours/tour-definitions.ts` com `assessmentsFirstTime`
- Trigger no `forms-dashboard-client.tsx` quando user clica primeiro `tab='assessments'`
- Persist em `trainer.onboarding_state.assessments_tour_seen`
- 3-4 steps com elementos destacados via CSS selectors

### B3 — Tour onboarding mobile + status doc (1-2 dias)

- Investigar infra mobile de tour (provavelmente não tem — fazer inline card)
- Card persistente no estado vazio da aba "Presenciais" com texto explicativo + botão "Entendi"
- Persist em MMKV (`assessment-tour-seen`)
- `MILESTONE-6-STATUS.md` final

---

## 5. Acceptance criteria

- ✅ 5 templates de sistema visíveis em `/forms/templates` para qualquer trainer
- ✅ Trainer pode usar template direto via "+ Nova avaliação" sem precisar criar
- ✅ Trainer pode clonar (clone-on-edit já implementado em M4)
- ✅ Tour web aparece na primeira vez na aba Avaliações Presenciais
- ✅ Tour web não reaparece após dispensar
- ✅ Tour mobile (ou inline card) aparece na primeira vez
- ✅ Tour mobile (ou inline card) não reaparece após dispensar
- ✅ Migration aplicada em prod sem regressão
- ✅ TypeScript zero novos erros
- ✅ Sem nova dep
- ✅ MILESTONE-6-STATUS.md final

---

## 6. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Migration falhar por conflito de `system_key` | `ON CONFLICT DO NOTHING` ou pattern idempotente |
| Templates aparecerem duplicados (sistema + clone do trainer) | Filtrar lista por `trainer_id = current_trainer_id() OR trainer_id IS NULL` (já é o pattern) |
| Tour web ficar travado em estado errado | Botão "Pular" sempre disponível |
| Mobile sem infra de tour | Fallback simples: card inline com botão dispensar |
| Trainer não conseguir editar template de sistema diretamente | Clone-on-edit já cuida disso (M4) |
| Performance ao listar 5+ templates | Templates são poucos, sem problema |
| Schema dos templates errado/incompatível com engine M2 | Migration tem teste manual: criar sessão a partir de cada template, finalizar com dados mock, ver computed_metrics correto |

---

## 7. Fora de escopo

- ❌ PDF generation (M5)
- ❌ Painel multi-trainer / estúdio (Fase 2)
- ❌ Edição visual de templates de sistema (clone-on-edit cobre)
- ❌ Templates personalizados por estúdio (Fase 2)
- ❌ Tour avançado com vídeos (texto+highlight é suficiente)
- ❌ Reset de tour seen (raramente útil — se precisar, via SQL direto)

---

## 8. Validação manual antes de pushar

1. **Migration aplicada em prod** via apply_migration MCP. Validar que os 5 templates aparecem em `form_templates` com `trainer_id IS NULL`.
2. **Web tour** — limpar `trainer.onboarding_state.assessments_tour_seen` no banco (UPDATE), abrir `/forms?tab=assessments`, ver tour aparecer, completar, verificar que não reaparece em refresh.
3. **Web template usage** — `/forms/templates`, ver os 5 templates de sistema, clicar em "Usar este" (ou abrir e ver schema), verificar que aparecem corretamente.
4. **Web criar sessão usando template de sistema** — `+ Nova avaliação`, escolher aluno + template "Antropometria mínima", sex/age, criar. Verificar que aparece em "Em andamento".
5. **Mobile inline card** — limpar MMKV, abrir aba Presenciais, ver card, dispensar, verificar não reaparece em refresh.
6. **End-to-end com Petroski 4 sistema** — criar sessão via web, capturar via mobile (peso/altura/dobras), finalizar, ver resultado com %BG calculado pela engine M2. Garantir que template de sistema funciona ponta-a-ponta como template do trainer.
