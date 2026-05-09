# PROMPT — Milestone 10: Cross-platform Parity

> Cole este prompt no Claude Code. M9 em prod (commit a5ca6cf).
> Último milestone da Fase 2.

---

Você vai implementar o **M10 — Cross-platform Parity**:

- **M10A — Builder mobile**: trainer cria templates de avaliação no app mobile (UX list-based)
- **M10B — "Preencher agora" web**: trainer captura medições no navegador (estúdios com tablet/desktop)

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/FASE-2-DECISIONS.md`
   - `docs/specs/avaliacoes-presenciais/10-milestone-10-parity.md` (a spec)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-9-STATUS.md`

2. Examine arquivos existentes:
   - **Web builder (referência pro mobile)**:
     - `web/src/components/assessments/builder/assessment-builder-canvas.tsx`
     - `web/src/components/assessments/builder/test-catalog.ts`
     - `web/src/components/assessments/builder/test-library-column.tsx`
     - `web/src/components/assessments/builder/test-properties-panel.tsx`
   - **Mobile capture (referência pro web)**:
     - `mobile/components/trainer/assessments/MeasurementWizard.*`
     - `mobile/components/trainer/assessments/AnatomyDiagram.*`
     - `mobile/lib/assessmentComputed.ts`
     - `mobile/stores/assessmentDraftStore.ts`
   - **Shared (não tocar, só ler)**:
     - `shared/types/assessments.ts`
     - `shared/lib/assessment-protocols/*`
   - **Actions reusáveis**:
     - `web/src/actions/assessments/update-template.ts` (createAssessmentTemplate, updateAssessmentTemplate)
     - `web/src/actions/assessments/save-measurements.ts`
     - `web/src/actions/assessments/finalize-session.ts`

3. Confirme entendimento:
   - M10A: nova tela mobile com builder list-based
   - M10B: nova rota web `/students/[id]/avaliacoes/[sessionId]/capture` com MeasurementWizardWeb
   - Reusa actions existentes server-side
   - Reusa engine M2 e schema do shared
   - Auto-save (MMKV mobile / localStorage web)
   - Sem mudança de DB schema

4. Se algo for ambíguo, **PARE e pergunte**.

## Workflow

- **Branch dedicada `m10-parity`**
- **Sem `git commit` em main durante desenvolvimento** — commits no branch
- **5 sub-blocos** (B1 → B2 → B3 → B4 → B5) com paradas obrigatórias
- **PR final pro merge em main**

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO + PLANEJAMENTO (~1 dia)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (limpo)
2. Cria branch `m10-parity` + push
3. Inspeção mobile:
   - Estrutura atual da aba Avaliações no mobile
   - Onde fica `mobile/app/assessments/templates/` (existe? estrutura?)
   - Pattern do MMKV draftStore
   - Como mobile renderiza sheets (modal sheets, bottom sheets)
   - Tem react-native-bottom-sheet ou similar?
4. Inspeção web:
   - Onde renderiza o detalhe da sessão? (`/students/[id]/avaliacoes/[sessionId]/page.tsx`)
   - State machine do session (scheduled/in_progress/completed/cancelled)
   - Tem rota `/capture` ou similar prevista?
5. testCatalog: mover pra `shared/` ou duplicar?
6. AnatomyDiagram mobile usa SVG nativo ou lib? Portabilidade pro web?
7. Bundle size atual do web — measurement de baseline

PARE e me reporte com:
- Plano concreto pra M10A (componentes a criar) + M10B (rota a criar)
- Decisão sobre testCatalog
- Surpresas

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — Mobile builder shell + sections (~5d)
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

### Mudanças mobile

1. **`mobile/app/assessments/templates/new.tsx`** — server route
2. **`mobile/components/trainer/assessments/AssessmentBuilderScreen.tsx`** — tela principal
   - Header (back button + título input + Save button)
   - Lista de seções
   - FAB "+" pra adicionar seção
3. **`mobile/components/trainer/assessments/SectionCard.tsx`** — card expandível
   - Header com título editável + delete
   - Lista de testes (placeholder em B1)
   - "+" pra adicionar teste (placeholder em B1)
4. **`mobile/stores/assessmentTemplateDraftStore.ts`** — Zustand + MMKV pra drafts
5. **Save action**: usa `updateAssessmentTemplate` ou `createAssessmentTemplate` (já no shared/web)

### Critério de saída B1
- Trainer cria template com 3 seções vazias
- Salva → template aparece em `/avaliacoes/templates` no web
- Drafts persistem em MMKV

PARE e reporte. Eu valido em emulador/dispositivo (você roda).

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — Mobile testes + library + properties (~5d)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

### Mudanças

1. **`TestLibrarySheet.tsx`** — bottom sheet com catalog
   - Tabs por categoria (Antropometria / Pregas / Circunferências / Protocolos / Computed)
   - Lista filtrável
   - Tap → adiciona teste à seção atual
2. **`TestRow.tsx`** — row dentro de SectionCard
   - Nome + tipo + delete
   - Tap → abre TestPropertiesSheet
3. **`TestPropertiesSheet.tsx`** — bottom sheet
   - Edição de label, unit, range, type-specific fields
   - Validation antes de salvar
4. **Validation final**: zod schema check antes de submit

### Critério de saída B2
- Trainer cria template Petroski 4 completo no mobile
- Editar properties de um teste via bottom sheet
- Validation impede save de schema inválido

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — Web MeasurementWizardWeb + inputs (~5d)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

### Mudanças

1. **`web/src/components/assessments/capture/MeasurementWizardWeb.tsx`** — port do mobile
2. **Inputs numéricos**: peso, altura, dobras, circunferências (componentes web)
3. **`AnatomyDiagramWeb.tsx`** — SVG, porta do mobile
4. **`ComputedDisplayWeb.tsx`** — chama engine M2 client-side
5. **Draft localStorage** — key pattern `capture-draft:{sessionId}`

### Critério de saída B3
- Componente renderiza isolado em /dev/capture-harness (storybook leve)
- Inputs aceitam valores válidos
- Engine M2 calcula em real-time

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B4 — Web finalize + integration (~3d)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B3.

### Mudanças

1. **Rota nova**: `web/src/app/students/[id]/avaliacoes/[sessionId]/capture/page.tsx`
2. **Botão "Preencher agora"** no `session-detail-client.tsx` (aparece quando status scheduled/in_progress)
3. **Submit handler**: chama `saveMeasurements` + `finalizeSession`
4. **Redirect pós-finalize**: `/result`
5. **Edge cases**: session já completed → redireciona pra result; cancelled → desabilita botão

### Critério de saída B4
- Flow completo: criar sessão (web) → preencher agora → finalizar → ver resultado → PDF disponível
- Não regride flow mobile (capture mobile + finalize ainda funciona)

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B5 — Polish + Status doc + PR
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B4.

### Mudanças

1. Empty states + edge cases
2. **`MILESTONE-10-STATUS.md`** com cobertura completa
3. **Commit + PR**:
   ```
   feat(parity): M10 cross-platform parity

   - M10A: mobile builder list-based pra templates de avaliação
   - M10B: web "Preencher agora" pra estúdios com tablet/desktop
   - Reusa actions, engine M2 e schema (sem novas migrations ou Edge Functions)
   - Auto-save em MMKV (mobile) / localStorage (web)

   M10 COMPLETO. Fase 2 do módulo de Avaliações Presenciais finalizada.

   Co-authored-by: Claude <claude@anthropic.com>
   ```
4. **PR pra main** com smoke test detalhado.

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- testCatalog precisa mover pra shared mas há conflitos de tipos
- Mobile não tem lib de bottom sheet ergonômica — instalar `@gorhom/bottom-sheet`?
- AnatomyDiagram mobile depende de lib não-portável pro web
- Bundle size aumenta >50KB com MeasurementWizardWeb
- localStorage draft conflita com flow mobile (mesma session, drafts em 2 lugares)
- Engine M2 tem dependência client-side desconhecida

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. B1 → reportar
3. B2 → reportar
4. B3 → reportar
5. B4 → reportar
6. B5 → PR + merge

NÃO commit, NÃO push até autorização explícita.

COMECE PELO BLOCO A.
