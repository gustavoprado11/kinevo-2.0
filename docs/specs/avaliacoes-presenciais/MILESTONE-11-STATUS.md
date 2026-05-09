# Milestone 11 — Mobile IA Cleanup — STATUS

**Data:** 2026-05-09
**Branch:** `m11-mobile-ia` (PR pendente para `main`)
**Spec:** [`11-milestone-11-mobile-ia.md`](./11-milestone-11-mobile-ia.md)

**Status:** ✅ COMPLETO — cleanup mobile pós-Fase 2.

---

## Sumário

Mobile alinhado com a IA do produto entregue pelo M8 web. Antes do M11, a tab "Formulários" no mobile tinha 3 sub-tabs flat (`Respostas` / `Templates` / `Presenciais`) que misturavam conceitos distintos: forms (anamnese/checkin/survey) e assessments presenciais. M11 reestrutura em **segmented control top-level** `[Formulários] [Avaliações]` com 2 sub-tabs próprias por segmento, espelhando a separação cascade D1 do web.

Entregue em 3 sub-blocos commitados isoladamente em `m11-mobile-ia`:

| Sub-bloco | Commit | Escopo |
|---|---|---|
| B1 | `b88ec6c` | Segmented + sub-tabs + banner in-app + state persist |
| B2 | `9f387d0` | Listing dedicado de assessment templates + hook novo |
| B3 | (este commit) | Status doc + PR |

Sem mudança de DB. Sem novas server actions. Sem novas Edge Functions. Mobile-only — web não foi tocado.

---

## Estado anterior vs. novo

### Antes (mobile, pré-M11)
```
Tab Formulários (bottom nav)
└─ 3 sub-tabs flat:
   ├─ Respostas       (submissions de form)
   ├─ Templates       (forms only — anamnese/checkin/survey)
   └─ Presenciais     (sessions de avaliação)
```
- Sub-tab "Templates" lista **só** forms — assessments invisíveis.
- Mesma palavra "Template" em sub-tabs distintas (Templates de form vs templates "implícitos" em Presenciais).
- Sem listing dedicado de assessment templates.

### Depois (mobile, pós-M11)
```
Tab Formulários (bottom nav, nome mantido)
├─ Banner in-app de migração (1ª visita pós-deploy)
└─ Segmented control top-level [Formulários] [Avaliações]
   ├─ Segmento Formulários (default):
   │  ├─ Sub-tab Respostas
   │  └─ Sub-tab Templates  (forms only)
   └─ Segmento Avaliações (accent violet):
      ├─ Sub-tab Sessões    (com filter chips Todas/Em atraso/Próximas/Concluídas)
      └─ Sub-tab Templates  (5 Kinevo + customs do trainer) ← NOVO
```

---

## Componentes criados (mobile)

### Store

`mobile/stores/formsTabStateStore.ts` — Zustand + MMKV namespace `kinevo-forms-tab-state`. 2 fields persistidos:
- `activeSegment: 'formularios' | 'avaliacoes'` — segmento ativo, restaurado entre sessões.
- `migrationBannerSeen: boolean` — flag do banner; uma vez `true`, banner não reaparece.

### Banner

`mobile/components/trainer/forms/MigrationBannerMobile.tsx` — banner inline com ícone Sparkles, texto "Reorganizamos Formulários e Avaliações em segmentos. Use as abas no topo." + botão Entendi violet + X. Persiste via store. Hidden quando `seen=true`.

### Hook novo

`mobile/hooks/useTrainerAssessmentTemplates.ts` — query direta a `form_templates` (não usa RPC `get_trainer_form_templates` legado). Filtros:
- `category='assessment'`
- `is_active=true`
- `or('trainer_id.eq.${trainerId},trainer_id.is.null')` — cobre **system templates Kinevo** (que o hook antigo não mostrava) **+ customs do trainer**.

Retorna `{ templates, isLoading, isRefreshing, error, refresh }` com `isRefreshing` pra paridade com pull-to-refresh dos outros hooks da tela. Tipo `TrainerAssessmentTemplate` deriva `section_count` de `schema_json.sections.length` e expõe `trainer_id: string | null` pra distinguir Kinevo vs Meu.

### Card

`mobile/components/trainer/assessments/AssessmentTemplateCard.tsx` — card horizontal:
- Ícone `Activity` violet num pill arredondado.
- Título (1 linha, ellipsize).
- Badge "Kinevo" (violet) ou "Meu" (cinza neutro).
- Subtítulo "N seções" (singular/plural).
- ChevronRight indicador de drill-down.
- Tap → haptic `selectionAsync` + `onPress(template)`.

---

## Arquivos alterados (mobile)

### `mobile/hooks/useAssessmentTemplates.ts`
Adicionado JSDoc `@deprecated` apontando pro novo hook. Lógica intocada (`CreateSessionModal` continua funcionando — RPC legado retorna customs do trainer; pra criar sessão, isso é suficiente porque trainer escolhe entre seus customs ou usa um Kinevo direto pelo onboarding/wizard).

### `mobile/app/(trainer-tabs)/forms.tsx`
Refactor cirúrgico (~700 linhas, mantém estrutura geral):
- **Types novos**: `FormsSubTab = 'responses' | 'templates'`, `AvaliacoesSubTab = 'sessions' | 'a_templates'`. Antigo `Tab` removido.
- **State**:
  - `activeSegment` lido/escrito via store MMKV (persistente).
  - `formsSubTab` local (default `'responses'`).
  - `avaliacoesSubTab` local (default `'sessions'`).
- **Derivados** (`isResponses`, `isFormTemplates`, `isSessions`, `isAssessmentTemplates`) — usados em filter chips, FAB e content render.
- **Deep-link `?tab=...`** mapeia conforme combinado:
  - `?tab=assessments` → `segment=avaliacoes, subTab=sessions` (preserva compat com result screen back nav)
  - `?tab=templates` → `segment=formularios, subTab=templates`
  - `?tab=responses` → `segment=formularios, subTab=responses`
- **Layout**:
  1. Header "Formulários" (nome mantido conforme decisão 3.2 da spec).
  2. `<MigrationBannerMobile>` inline (auto-hides após Entendi).
  3. Segmented control top-level `[Formulários] [Avaliações]` com badge no Avaliações pra `draftCount`.
  4. Sub-tabs por segmento via novo `<SubTabButton>` (pill outlined, accent violet quando segment Avaliações).
  5. Filter chips condicionais a `isResponses` ou `isSessions`.
  6. Content branching: Respostas → submissions FlatList | Form Templates → templates FlatList | Sessions → AssessmentsList | Assessment Templates → **listing real** (B2).
- **FAB matrix** por (segment, subTab):
  - `formularios + responses` → hidden (sem ação default).
  - `formularios + templates` → "Novo template de formulário" (`handleCreateNew`, violet).
  - `avaliacoes + sessions && !isAssessmentsEmpty` → "Nova avaliação" (`handleCreateAssessmentSession`, presencial).
  - `avaliacoes + a_templates` → "Novo template de avaliação" (`router.push('/assessments/templates/new')`, violet).
- **Removido**: link inline "Novo template de avaliação →" (substituído pelo FAB do sub-tab).
- **Adicionado**: componente local `<SubTabButton>` (pill outlined, accent configurable, badge support).

---

## Acceptance criteria — checklist final

- ✅ Mobile tab "Formulários" abre com segmented control no topo
- ✅ Segmento default: Formulários (ou último estado persistido em MMKV)
- ✅ Segmento Formulários mostra Respostas + Templates (forms-only)
- ✅ Segmento Avaliações mostra Sessões + Templates (assessments-only)
- ✅ Sub-tab Templates (Avaliações) lista os 5 Kinevo + customs
- ✅ Tap em template Avaliações → abre edit deep-link
- ✅ FABs corretos por segmento
- ✅ Banner de migração in-app explicando reorganização
- ✅ TypeScript zero novos erros (mobile)
- ✅ Deep-link `?tab=…` compat preservada (result screen back nav)
- ✅ MILESTONE-11-STATUS.md final

---

## Cenários de validação (seção 7 da spec)

| # | Cenário | Estado |
|---|---|---|
| 1 | Estado inicial: trainer abre app → tab Formulários → segmented + Formulários ativo | ✅ B1 |
| 2 | Sub-tabs Formulários: Respostas (com pendentes) + Templates (forms only) | ✅ B1 |
| 3 | Switch para Avaliações: tap segment → header continua "Formulários" + sub-tabs trocam pra Sessões/Templates accent violet | ✅ B1 |
| 4 | Sub-tabs Avaliações: Sessões com filter chips + Templates com listing | ✅ B1+B2 |
| 5 | Tap em template assessment: drill-down pra edit com schema pré-preenchido | ✅ B2 |
| 6 | Plus button: header da sub-tab Templates → vai pra `/assessments/templates/new` (criar novo) | ✅ B1 |
| 7 | Persist: kill app, reabrir → último segment ativo é restaurado | ✅ B1 |
| 8 | Banner: 1ª vez vê banner "Reorganizamos..." com botão "Entendi" | ✅ B1 |
| 9 | Listing assessment templates: 5 Kinevo (badge Kinevo) + customs (badge Meu) com N seções | ✅ B2 |
| 10 | Pull-to-refresh em todos os 4 sub-tabs ativos | ✅ B1+B2 |

---

## Decisões registradas

- **Sem renaming do tab no bottom nav** — mantém "Formulários" pra preservar muscle memory (decisão 3.2 da spec).
- **Sub-tabs em vez de mais segmented control** — cada segmento tem 2 sub-tabs em pill chips horizontais, mantém o pattern atual (decisão 3.1).
- **Estado do segmented persistido em MMKV** — restaura último contexto do trainer (decisão 3.3).
- **Hook novo em vez de refatorar legado** — `useTrainerAssessmentTemplates` cobre Kinevo + customs via query direta. `useAssessmentTemplates` legado intacto (consumido por `CreateSessionModal`), com JSDoc `@deprecated` apontando pro novo.
- **Deep-link `?tab=` preservado pra compat** — useEffect mapeia `tab=assessments` pra `(avaliacoes, sessions)` automaticamente. Result screen back nav continua funcionando.
- **Banner inline em vez de toast** — paralelo do M8 web `MigrationBanner`. Persiste via store MMKV `migrationBannerSeen`.
- **`<SubTabButton>` distinto do `<TabButton>`** — visualmente mais leve (pill outlined em vez de fundo branco), accent violet pra Avaliações conforme cor cascade D1.
- **Card sem swipeable** — assessment system templates não podem ser deletados (RLS); customs só editam via tap (drill-down). Delete fica fora de escopo.
- **Listing apenas por listing** — sub-tab Templates do segmento Avaliações usa `<AssessmentTemplateCard>` em FlatList. Cards mais compactos que `<FormTemplateCard>` porque assessment templates têm menos metadata visível.

---

## Não-regressão

- **CreateSessionModal mobile** — continua usando `useAssessmentTemplates` legado. Customs do trainer aparecem no dropdown como antes. Zero regressão no flow de criar sessão.
- **Result screen back nav** — `?tab=assessments` deep-link mapeia pra `(avaliacoes, sessions)` corretamente. Trainer finaliza avaliação → result screen → tap back → cai em sessões corretamente.
- **M10A AssessmentBuilderScreen** — drill-down via `?id=<uuid>` na rota `/assessments/templates/new` continua funcionando. Tap em card no listing M11 → mesma rota M10A com hydrate via Supabase.
- **Filter chips de Sessões** — Todas/Em atraso/Próximas/Concluídas funcionam idênticos.
- **Pull-to-refresh** — `RefreshControl` ativo em 3 dos 4 sub-tabs (Sessões usa `<AssessmentsList>` próprio com pull-to-refresh interno).
- **Tablet responsive** — `numColumns={isTablet ? 2 : 1}` mantido pra grid em viewport >768px.
- **Web** — não foi tocado. IA do M8 (sidebar 2 items + rotas separadas) intacta.

---

## TypeScript (mobile)
`npx tsc --noEmit`: **0 novos erros**. 12 erros pré-existentes (expo-file-system, useLiveActivity, useTrainerChat, useWorkoutSession) — mesmos do M10/B1, fora do escopo de M11.

---

## Follow-ups (não bloqueiam ship — vão para backlog)

1. **Deletar templates de assessment customs** — não suportado em M11. Trainer pode editar via tap, mas não tem swipeable de delete. Adicionar swipeable no `AssessmentTemplateCard` exige decisão de UX (swipe right → editar, swipe left → deletar) e nova action mobile + RLS guarda. Backlog low-priority.
2. **Migrar `CreateSessionModal` pra `useTrainerAssessmentTemplates`** — modal atualmente usa hook legado. Migração trivial, mas baixa prioridade enquanto comportamento atual atende.
3. **Realtime subscription no listing** — hoje refetch só on mount + pull-to-refresh. Realtime opcional pra refletir templates criados em outros devices (web ou mobile diferente). Backlog.
4. **Renaming do tab no bottom nav** — "Formulários" virar algo mais inclusivo ("Coleta", "Avaliações", outro). Decisão de produto, backlog.
5. **Tab dedicado "Avaliações" no bottom nav** — vai contra a decisão atual de manter 1 tab consolidada com segments. Reavaliar se feedback de trainers indicar valor.
6. **Tour novo `tour_mobile_segments_first_time`** — análogo do tour M8 (web). M11 só tem banner; tour explicando segmented poderia complementar. Backlog.

---

## Próximos passos

**M11 COMPLETO. Cleanup mobile pós-Fase 2 finalizado.**

Mobile e web agora têm IA do produto alinhada:

| Plataforma | IA cleanup status |
|---|---|
| **Web** | ✅ M8 (cascade D1+D2+D3) — sidebar 2 items + rotas separadas + redirects + banner |
| **Mobile** | ✅ M11 — segmented top-level + sub-tabs por segmento + banner + listing assessment templates |

A próxima frente natural fica fora do escopo da Fase 2. Possíveis próximos milestones (não comprometidos):
- Renaming bottom nav (M12 hipotético)
- Realtime sync de templates cross-device
- Outros itens dos follow-ups acima conforme demanda.
