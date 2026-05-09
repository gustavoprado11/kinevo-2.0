# Milestone 10 — Cross-platform Parity (Fase 2 — final)

**Pré-requisitos:** Fase 1 + M7 + M8 + M9 em prod. Engine M2, Edge Function de PDF, schema de templates assessments — tudo estável.

**Goal:** fechar os 2 maiores gaps de paridade web↔mobile identificados no audit:
- **M10A — Builder mobile**: trainer 100% mobile passa a criar/editar templates de avaliação no app, com UX list-based simplificada.
- **M10B — Modo "preencher agora" web**: estúdios com tablet/desktop fixo passam a capturar medições direto no navegador (hoje só mobile).

Último milestone da Fase 2. Após M10, módulo de Avaliações Presenciais está completo na visão estratégica original.

**Plataforma:** mobile (M10A) + web (M10B).

**Dura:** 3-4 semanas (B1+B2 mobile + B3+B4 web + B5 polish/PR).

**Branch:** `m10-parity`. Mesmo padrão M8/M9.

---

## 1. Estado atual vs. desejado

### Hoje
- **Mobile**: aba Avaliações lista templates seedados Kinevo + customs do trainer. Trainer pode criar **sessão** mas não **template**. Zero builder.
- **Web**: builder de template existe (`/avaliacoes/templates/new`). Captura de medições só mobile (`/assessments/[sessionId]`).

### Pós M10
- **Mobile**: builder de template list-based em `mobile/app/assessments/templates/new` (ou similar). Trainer 100% mobile cria templates direto no app.
- **Web**: nova rota `/avaliacoes/[sessionId]/capture` (ou similar) com MeasurementWizard portado pra web. Estúdios com tablet/desktop capturam direto.

---

## 2. M10A — Builder mobile (list-based)

### Layout
- **Tela inicial**: header "Novo template" / "Editando [nome]" + back button. Input título no topo. Lista vertical de seções abaixo. FAB "+" pra adicionar nova seção.
- **Seção**: card expandível. Título editável inline. Lista de testes dentro. "+" pra adicionar teste (abre bottom sheet de TestLibrary).
- **Teste**: row com nome + tipo + delete. Tap → edita propriedades em bottom sheet.
- **Salvar**: botão fixo no rodapé "Salvar template" → chama `updateAssessmentTemplate` ou `createAssessmentTemplate` (actions já existem no shared).

### Componentes a criar (`mobile/components/trainer/assessments/`)
- `AssessmentBuilderScreen` — tela principal, gerencia state da template
- `SectionCard` — card de seção expandível
- `TestRow` — row de teste dentro de seção
- `TestLibrarySheet` — bottom sheet com catalog (Antropometria / Pregas / Circunferências / Protocolos / Computed)
- `TestPropertiesSheet` — bottom sheet pra editar props de cada teste

### State management
- Reusar pattern do `assessmentDraftStore` (Zustand + MMKV) ou criar store próprio pra drafts de template
- Auto-save em MMKV pra não perder trabalho se app fechar
- Reusar `AssessmentTemplateSchema` shared (zero mudança no schema)

### Out of scope M10A
- Drag-drop (decisão: list-based simplificado)
- Criação com IA (backlog)
- Compartilhar template entre trainers (backlog)

---

## 3. M10B — Modo "preencher agora" web

### Layout
- **Trigger**: botão "Preencher agora" no detalhe da sessão em `/students/[id]/avaliacoes/[sessionId]`. Aparece quando `status='scheduled' || 'in_progress'`.
- **Captura**: nova rota `/students/[id]/avaliacoes/[sessionId]/capture` com `MeasurementWizard` portado.
- **Submit**: ao finalizar, chama `finalizeSession` (existente) → redireciona pra `/result`.

### Componentes a portar
- `MeasurementWizard` (mobile) → `MeasurementWizardWeb` (web)
- Inputs numéricos (peso/altura/dobras/circunferências) — versão web
- `AnatomyDiagram` — versão web (SVG-based, já existe no mobile)
- `ComputedDisplay` — versão web (engine M2 client-side compute)

### Reaproveitamento
- Engine M2 (`shared/lib/assessment-protocols`) é puro TS — funciona web sem alteração
- Actions `saveMeasurements` + `finalizeSession` já são server actions usáveis no web
- Pattern de state (rascunho local) — pode usar localStorage no web (vs MMKV no mobile)

### Out of scope M10B
- Captura concorrente (mais de 1 trainer no mesmo aluno simultaneamente)
- Reabrir sessão completed
- Modo "câmera" pra fotos de comparação (backlog)

---

## 4. Decisões registradas

### 4.1 Sem novas Edge Functions
M10 reusa actions e Edge Functions existentes. PDF (M5) já funciona pós-finalize. Nada novo no servidor.

### 4.2 Sem mudança de schema DB
Templates seguem mesma `form_templates` table. Sessions seguem `assessment_sessions`. Measurements seguem `assessment_measurements`.

### 4.3 Mobile builder reusa testCatalog do web
`web/src/components/assessments/builder/test-catalog.ts` move pra `shared/` ou duplica conscientemente. Decisão final no Bloco A.

### 4.4 MeasurementWizardWeb não força responsividade mobile
Otimizado pra desktop/tablet (tela larga). Mobile responsive é "best effort" — trainer com mobile usa o mobile nativo.

### 4.5 Indicador visual de origem no PDF
Se sessão foi capturada via web ("preencher agora"), o PDF mostra footer "Capturado em desktop" (já fica óbvio em logs internos via `created_via='web_capture'` se quisermos persist). M10 não persist agora.

---

## 5. Acceptance criteria

### M10A
- ✅ Trainer no app mobile abre `/assessments/templates/new` (ou rota equivalente)
- ✅ Adiciona seções e testes via UI list-based
- ✅ Edita título de seção inline
- ✅ Salva template → aparece em `/avaliacoes/templates` no web
- ✅ Edita template existente
- ✅ Drafts persistidos em MMKV (não perde se app fechar)

### M10B
- ✅ Trainer no web abre detalhe de sessão scheduled/in_progress → vê botão "Preencher agora"
- ✅ Clica → entra no MeasurementWizardWeb
- ✅ Preenche medições → engine M2 calcula em real-time
- ✅ Finaliza → redireciona pra resultado + PDF disponível

### Geral
- ✅ TypeScript zero novos erros (web + mobile)
- ✅ Sem regressão em flows existentes (mobile capture nativa, web detail/result)
- ✅ MILESTONE-10-STATUS.md final

---

## 6. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Mobile builder tem UX ruim em tela pequena | Test em iPhone SE (375px) durante dev |
| MeasurementWizardWeb tem bug de cálculo client-side | Engine M2 já é compartilhada e testada — riscos só no wiring de inputs |
| Trainer cria template no mobile com schema inválido | Validação client-side mesma do web (zod schemas em shared) |
| Conflict entre rota nova `/students/[id]/avaliacoes/[sessionId]/capture` e existing routes | Verificar Bloco A |
| Bundle size do web aumenta com MeasurementWizardWeb | Code-split por rota se passar 50KB |

---

## 7. Sub-blocos sugeridos

### B1 — Mobile builder shell + sections (M10A primeiro pedaço, ~5d)
- AssessmentBuilderScreen + SectionCard + state management
- Add/edit/delete section
- Auto-save em MMKV
- Sem testes ainda (placeholder de teste por seção)

**Critério:** trainer cria template com 3 seções vazias e salva.

### B2 — Mobile builder testes + library + properties (M10A finaliza, ~5d)
- TestLibrarySheet com catalog completo
- Add test via bottom sheet
- Edit test properties via bottom sheet
- Validation de schema antes de salvar

**Critério:** trainer cria template Petroski 4 do zero no mobile e salva.

### B3 — Web MeasurementWizardWeb + inputs (M10B primeiro pedaço, ~5d)
- Port do MeasurementWizard pra web
- Inputs numéricos (peso/altura/dobras/circunferências)
- Real-time engine M2 compute
- LocalStorage draft

**Critério:** trainer no web preenche medições parciais, recarrega, draft persiste.

### B4 — Web finalize + integration (M10B finaliza, ~3d)
- Botão "Preencher agora" no detalhe da sessão
- Submit → finalizeSession → redirect pra `/result`
- Validação que session não pode estar completed/cancelled

**Critério:** trainer no web cria sessão, captura completa, finaliza, vê resultado + PDF.

### B5 — Polish + status doc + PR (~3d)
- Empty states, edge cases
- MILESTONE-10-STATUS.md
- Tour novo (opcional)
- Commit + PR + merge

---

## 8. Validação manual

### Mobile builder (M10A)
1. Trainer abre app mobile → Avaliações → "Novo template"
2. Adiciona 3 seções (Antropometria, Dobras, Calculados)
3. Adiciona testes em cada uma via TestLibrarySheet
4. Edita propriedades de um teste (label, unit, range)
5. Salva → volta pra listagem → template aparece
6. Abre web em `/avaliacoes/templates` → mesmo template aparece com badge violet
7. Edita do mobile → muda persiste no web

### Web preencher agora (M10B)
1. Web cria sessão presencial pra Marina (Petroski 4)
2. Status fica `scheduled`
3. Detalhe da sessão → botão "Preencher agora"
4. MeasurementWizardWeb abre → preenche peso, altura, dobras
5. Engine M2 calcula em real-time (vê IMC, %BG)
6. Recarrega → draft persiste em localStorage
7. Finaliza → redireciona pra `/result` → PDF disponível

---

## 9. Fora de escopo

- ❌ Captura simultânea (Marina + Pedro ao mesmo tempo)
- ❌ "Criar com IA" no mobile (Backlog)
- ❌ Modo offline robusto (continua "best effort")
- ❌ Compartilhar template entre trainers
- ❌ Templates Marketplace
- ❌ Reabrir sessão completed
- ❌ Modo câmera (foto de progresso)
