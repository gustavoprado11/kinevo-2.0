# PROMPT — Milestone 11: Mobile IA Cleanup

> Cole este prompt no Claude Code. Fase 2 completa em main + tag v0.10.0-fase2-complete.
> M11 é cleanup mobile pós-M8 — alinha mobile com IA do web.

---

Você vai implementar o **M11 — Mobile IA Cleanup**: dentro do tab "Formulários" do mobile, adicionar segmented control no topo `[Formulários] [Avaliações]` que separa os 2 mundos. Adicionar listagem dedicada de assessment templates.

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/11-milestone-11-mobile-ia.md` (a spec)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-10-STATUS.md`
   - `docs/specs/avaliacoes-presenciais/FASE-2-DECISIONS.md` (cascade D1)

2. Examine arquivos existentes:
   - `mobile/app/(trainer-tabs)/forms.tsx` (700 linhas, vai ser refatorado)
   - `mobile/hooks/useTrainerFormTemplates.ts` (forms only)
   - `mobile/hooks/useAssessmentSessions.ts` (sessions, não templates)
   - `mobile/components/trainer/assessments/builder/AssessmentBuilderScreen.tsx` (M10A — drill-down de edit)

3. Confirme entendimento:
   - Segmented control [Formulários] [Avaliações] no topo
   - Cada segment tem 2 sub-tabs internos
   - Listagem dedicada de assessment templates é nova (M10A foi só criar/edit, sem listing)
   - Persistir segment ativo em MMKV
   - Banner in-app de migração

4. Se algo for ambíguo, **PARE e pergunte**.

## Workflow

- **Branch dedicada `m11-mobile-ia`**
- **3 sub-blocos** (B1+B2+B3) com paradas obrigatórias
- **PR final pro merge**

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO + PLANEJAMENTO (~0.5 dia)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (limpo)
2. `git log --oneline -5` (último: M10 squash em main)
3. Cria branch + push
4. Inspeção do `forms.tsx`:
   - Estrutura atual das 3 sub-tabs
   - Como state machine de tabs funciona
   - Onde plugar segmented control
5. Hook de listing de assessment templates:
   - `useTrainerAssessmentTemplates` existe? Senão, qual hook usar de referência?
   - Query Supabase: `form_templates WHERE category='assessment' AND (trainer_id IS NULL OR trainer_id = current)`
6. Pattern de banner in-app:
   - Como mobile mostrou banner do M8? Tem?
   - Persist via MMKV em qual store?
7. MMKV pra segment state:
   - Reusar `assessmentDraftStore` ou criar store novo?
   - Recomendo store próprio: `mobile/stores/formsTabStateStore.ts`

PARE e me reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — Segmented + restructure + banner (~5d)
═══════════════════════════════════════════════════════════════════════

### Mudanças

1. **`mobile/stores/formsTabStateStore.ts`** — Zustand + MMKV pra `activeSegment: 'formularios' | 'avaliacoes'`
2. **`forms.tsx`** restructure:
   - Adicionar segmented control no topo (depois do header)
   - Mudança da state machine: `activeSegment` (top) + `activeSubTab` por segment
   - Renderização condicional:
     - Segmento Formulários: sub-tabs `Respostas` + `Templates` (forms)
     - Segmento Avaliações: sub-tabs `Sessões` + `Templates` (assessments)
   - FAB dinâmico por segmento + sub-tab ativo:
     - Formulários + Respostas → "Atribuir" (existente)
     - Formulários + Templates → "Novo template" (existente)
     - Avaliações + Sessões → "Nova avaliação" (existente)
     - Avaliações + Templates → "Novo template de avaliação" (M10A trigger)
3. **Banner in-app** componente `<MigrationBannerMobile>`:
   - Texto: "Reorganizamos Formulários e Avaliações em segmentos. Use as abas no topo."
   - Botão "Entendi" → grava em MMKV (store próprio ou tip dismissed)

### Critério
Trainer abre tab Formulários, vê banner + segmented + sub-tabs reorganizadas. Conteúdo visualmente igual ao antigo (sub-tab Templates ainda lista forms; sub-tab Sessões ainda lista sessions).

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — Listagem de assessment templates (~3d)
═══════════════════════════════════════════════════════════════════════

### Mudanças

1. **Hook novo**: `mobile/hooks/useTrainerAssessmentTemplates.ts`
   - Query: `form_templates` filter `category='assessment' AND (trainer_id IS NULL OR trainer_id = current_trainer_id())`
   - Type extends `AssessmentTemplate` do shared
   - Realtime subscription opcional
2. **Sub-tab Templates dentro de segment Avaliações**:
   - FlatList de cards
   - Cada card: título + badge Kinevo/Meu + N seções
   - Tap → `router.push('/assessments/templates/new?id=<id>')` (drill-down edit)
   - Plus button no header da sub-tab → `router.push('/assessments/templates/new')` (novo)
   - Empty state: "Nenhum template ainda"

### Critério
Sub-tab Templates do segment Avaliações lista os 5 Kinevo + customs do trainer.

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — Polish + Status doc + PR
═══════════════════════════════════════════════════════════════════════

### Mudanças

1. Empty states de cada combinação segment+sub-tab
2. Persist `activeSegment` corretamente entre sessões
3. **MILESTONE-11-STATUS.md**
4. **Commit + PR**:
   ```
   feat(mobile): M11 IA cleanup — segmented Formulários/Avaliações

   - Segmented control [Formulários][Avaliações] no topo do tab Formulários
   - Cada segmento tem 2 sub-tabs próprias
   - Listing dedicada de assessment templates dentro de segment Avaliações
   - Hook novo useTrainerAssessmentTemplates
   - Banner in-app de migração persistido em MMKV
   - State persist do segmento ativo

   Cleanup mobile pós-M8 (alinha com web IA cascade).

   Co-authored-by: Claude <claude@anthropic.com>
   ```
5. **PR pra main**

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR
═══════════════════════════════════════════════════════════════════════

- forms.tsx muito entrelaçado (>700 linhas) — split em files separados
- Conflict de banner in-app — mobile pode não ter banner pattern como web tem
- Hook useTrainerAssessmentTemplates conflita com types literais existentes

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar
2. B1 → reportar (eu valido em emulador ou trust)
3. B2 → reportar
4. B3 → PR + merge

NÃO commit, NÃO push até autorização explícita.

COMECE PELO BLOCO A.
