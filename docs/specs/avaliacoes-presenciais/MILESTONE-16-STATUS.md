# Milestone 16 — Wizard 3-step padronizado pros 2 builders — STATUS

**Data:** 2026-05-09
**Branch:** sem branch — commit direto em `main` (hotfix-style)
**Spec:** [`16-milestone-16-builder-wizard.md`](./16-milestone-16-builder-wizard.md)

**Status:** ✅ COMPLETO — Form builder e Assessment builder usam `<BuilderWizardShell>` compartilhado com chrome idêntico.

---

## Sumário

User flagou divergência grande entre form builder (3-step Método/Configurar/Editor) e assessment builder (single-step canvas direto). M16 padroniza chrome via `<BuilderWizardShell>` novo em `web/src/components/shared/`. Cada Step 1 explica o propósito. Editor de Step 3 mantém especificidade por tipo (linear pra forms, canvas drag-drop pra assessments).

Entregue em 3 sub-blocos (B1: shell + form refactor, B2: assessment refactor, B3: status + commit).

---

## Estado anterior vs. novo

### Antes

| Builder | Wizard | Step 1 | Step 2 | Step 3 |
|---|---|---|---|---|
| Form | 3-step | Método (IA / Manual) | Setup IA (prompt) — só se IA escolhido | Editor manual |
| Assessment | 0-step | n/a | n/a | Canvas drag-drop direto |

### Depois

| Builder | Wizard | Step 1 | Step 2 | Step 3 |
|---|---|---|---|---|
| Form | 3-step | Tipo (4 cards: Anamnese, Check-in, Pesquisa, Feedback) | Configurar (nome + descrição + toggle IA) | Editor (manual ou prompt IA conforme toggle) |
| Assessment | 3-step | Tipo (2 cards: Em branco / Partir de Kinevo) | Configurar (nome + descrição) | Canvas drag-drop |

Chrome (header, progress indicator, footer) **idêntico** entre os 2.

---

## Decisões tomadas durante o bloco

### D-M16-A: categoria `feedback` via migration
Spec pedia 4º card "Feedback do programa" mas o CHECK constraint do `form_templates.category` só aceitava `('anamnese', 'checkin', 'survey', 'assessment')`. Migration `124_form_templates_add_feedback_category.sql` adiciona `'feedback'` ao constraint. Backward-compat puro (CHECK relaxation), aplicada em prod via MCP.

### D-M16-B: IA prompt no Step 3 (sub-modo)
Spec pedia toggle "Criar com IA" no Step 2 com fluxo:
- IA OFF → Step 3 abre editor manual direto
- IA ON → Step 3 começa com prompt textual; "Gerar Draft" preenche perguntas e troca pra editor

Implementado via state `aiPromptVisible` que controla qual sub-render do Step 3 aparece. Link "Pular e editar manualmente" como escape do prompt.

### D-M16-C: BuilderShell M8 D2 mantido intacto
`<BuilderShell>` original ([web/src/components/shared/builder-shell.tsx](../../web/src/components/shared/builder-shell.tsx)) **não foi tocado**. M16 cria `<BuilderWizardShell>` ao lado como peer. O original fica deadcode após M16 (sem consumers), mas cleanup formal vira milestone separado de housekeeping.

### D-M16-D: AnimatePresence removido do wizard
Implementação inicial usava `<AnimatePresence mode="wait">` com múltiplos `motion.div` irmãos condicionalmente renderizados (`{step === N && <motion.div .../>}`). Pattern conhecido pode falhar — Framer não tracking corretamente quando "child to wait for" é irmão diferente em vez do mesmo elemento com key diferente. Bug observado: progress avançava mas body ficava em Step 1.

Fix: removidos `motion.div` e `AnimatePresence` do nível wizard. Render condicional plano (`{step === N && <div>...</div>}`). Animations internas do editor (Quality Alerts, AI Checklist) **mantidas** — não governam wizard nav.

Trade-off: sem transição animada entre steps. Progress indicator do shell ainda anima (bolinhas mudam de cor). Sem regressão funcional.

### D-M16-E: cards Step 1 — auto-avanço removido
Implementação inicial: card click → `setStep(2)` automaticamente. Após bug do AnimatePresence, mantive o auto-avanço mas o user reportou que prefere requerer click no card + click no Próximo (UX mais explícita evita avanço acidental). Aceito como sub-issue não-bloqueante. Em ambos builders (form e assessment), o card seta o `category`/`schemaSeed` e o user clica Próximo manualmente.

### D-M16-F: Kinevo schema deep clone via JSON
`startFromKinevo` clona o schema com `JSON.parse(JSON.stringify(template.schema))`. Suficiente pra `AssessmentTemplateSchema` (objeto puro, sem Dates/Maps/funções). Evita mutação acidental no template original do Step 1.

### D-M16-G: title sugerido "(cópia)" só se vazio
Click em Kinevo template no Step 1 sugere `title = "${Kinevo title} (cópia)"` apenas se o trainer ainda não preencheu. Em edit mode (improvável passar pelo Step 1 do Kinevo), o title já vem preenchido e não é sobrescrito.

### D-M16-H: edit mode pula Steps 1+2
Quando `?edit=<id>` está presente, o builder inicializa `step = 3` e passa `hideStepIndicator: true` pro shell. Trainer vai direto ao editor com schema preenchido. Header muda pra "Editar template — Nome".

---

## Arquivos alterados

### Novos (3)
| Arquivo | Plataforma | Mudança |
|---|---|---|
| `supabase/migrations/124_form_templates_add_feedback_category.sql` | DB | CHECK constraint amplia pra incluir `'feedback'`. Já aplicada em prod. |
| `web/src/components/shared/builder-wizard-shell.tsx` | web | Wizard shell shared: header (Voltar + título + status indicator), 3-step progress horizontal, footer (Cancelar/Voltar/Próximo/Salvar), modal "Sair sem salvar?", `beforeunload` guard. |
| `docs/specs/avaliacoes-presenciais/MILESTONE-16-STATUS.md` | docs | Este doc. |

### Modificados (6)
| Arquivo | Mudança |
|---|---|
| `web/src/app/forms/templates/new/builder-client.tsx` | State machine `'choose'\|'ai_setup'\|'editor'` → `1\|2\|3`. `BuilderShell` → `BuilderWizardShell`. Step 1: 4 cards de tipo. Step 2: novo (nome+descrição+toggle IA). Step 3: sub-modo IA prompt (se toggle ON) ou editor (se OFF). Sticky save footer removido (footer no shell agora). `motion.div` removidos do wizard. CATEGORY_OPTIONS local virou CATEGORY_CARDS (4 entries). +292/-281 linhas. |
| `web/src/app/avaliacoes/templates/new/page.tsx` | Query Kinevo seeds (`category='assessment' AND trainer_id IS NULL`). Passa `kinevoTemplates` pro client. `initialTitle` default mudou de `'Avaliação Presencial'` → string vazia. |
| `web/src/app/avaliacoes/templates/new/assessment-builder-page-client.tsx` | Refactor wizard. Step 1: 2 cards (Em branco / Partir de Kinevo). Step 2: nome + descrição + banner info quando schema preenchido. Step 3: canvas inalterado. Modal Kinevo com 5 templates + clone via JSON. +296/-49 linhas. |
| `web/src/actions/forms/create-form-template.ts` | Tipo `category` aceita `'feedback'`. Validation runtime atualizada. |
| `web/src/actions/forms/update-form-template.ts` | Idem. |
| `web/src/actions/forms/generate-form-with-ai.ts` | `FormCategory` aceita `'feedback'`. `categoryLabel` ganha `Feedback do programa`. `baseByCategory.feedback` adicionado com 4 perguntas heurísticas (avaliação geral, objetivos atingidos, pontos fortes, pontos de melhoria). `safeCategory` validation expandida. `output_contract` LLM atualizado. |

Sem mudanças em: assessment canvas, types compartilhados, RPCs, RLS, navigation/sidebar, banner.

---

## Validação

- ✅ TypeScript: zero novos erros nos arquivos do M16 (`tsc --noEmit` em `web/` rodado).
- ✅ Smoke test localhost (validado pelo user em B1 e B2):
  - **Form builder**: Step 1 cards visíveis, click "Anamnese" → Step 2 (input nome/descrição/toggle IA) → Step 3 editor. Toggle IA → Step 3 prompt textual.
  - **Assessment builder**: Step 1 (Em branco / Partir de Kinevo) → Step 2 (nome + descrição) → Step 3 canvas drag-drop. Modal Kinevo lista 5 seeds com clone funcional.
  - Edit mode pula direto pro Step 3 em ambos.
  - Auto-save / exit confirmation / beforeunload preservados.
- ✅ Migration 124 aplicada em prod sem regressão (CHECK relaxation puro).

### Sub-issue não-bloqueante

Cards de Step 1 não auto-avançam — trainer precisa click no card + click no botão Próximo. Spec original sugeria auto-avanço, mas o user preferiu UX mais explícita (evita avanço acidental). Aceito como está.

---

## Itens preservados (sem regressão)

- `<BuilderShell>` M8 D2 intacto (deadcode após M16, cleanup separado)
- Assessment canvas drag-drop completamente inalterado
- Auto-save em localStorage continua (caller gerencia draft, shell não escreve)
- Modal "Sair sem salvar?" + `beforeunload` guard preservados via `<BuilderWizardShell>`
- Animations internas do form editor (Quality Alerts, AI Checklist) intactas
- Mobile builder (M10A) sem mudança — pattern próprio
- IA action `generate-form-with-ai` aceita `feedback` com heurística (não breaking change)

---

## Próximos passos

- **Cleanup `<BuilderShell>` antigo**: milestone separado de housekeeping. Sem consumers ativos depois do M16, é safe deletar.
- **Step 1 auto-advance opcional**: se virar dor (UX feedback negativo sobre 2 clicks), avaliar implementação com `setTimeout` ou indicação visual de "selecionado, clique Próximo".
- **IA pra assessments**: backlog. Spec M16 explicitou fora de escopo.
- **Audit Quality pra assessments**: backlog. Feature avançada do form builder não portada.
- **Step 1 Assessment quando 0 templates Kinevo**: card "Partir de Kinevo" desabilita. Edge case raríssimo (seeds sempre presentes em prod), aceitável.
