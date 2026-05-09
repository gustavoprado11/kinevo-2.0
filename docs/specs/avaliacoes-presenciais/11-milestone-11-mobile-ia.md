# Milestone 11 — Mobile IA Cleanup

**Pré-requisitos:** Fase 2 completa (M5→M10) em main + tag `v0.10.0-fase2-complete`.

**Goal:** alinhar a IA do mobile com o que M8 fez no web. Hoje o mobile tem 1 tab "Formulários" com 3 sub-tabs (Respostas / Templates / Presenciais) que misturam conceitos. Web já separou em 2 itens distintos (Formulários + Avaliações). Mobile precisa equivalente.

**Plataforma:** mobile only.

**Dura:** 1-2 semanas (B1+B2+B3).

**Branch:** `m11-mobile-ia`.

---

## 1. Estado atual vs. desejado

### Hoje (mobile)
- Tab "Formulários" no bottom nav
- 3 sub-tabs no topo: Respostas / Templates / Presenciais
- "Templates" sub-tab lista só forms (anamnese/checkin/survey) — **assessments invisíveis**
- "Presenciais" sub-tab lista sessões + tem link "Novo template de avaliação →" para criação (M10A) mas sem listagem
- Mesma palavra "Template" usada pra duas coisas diferentes em sub-tabs distintas

### Pós M11
- Tab "Formulários" no bottom nav (nome mantido pra preservar muscle memory; renaming pode vir depois)
- **Segmented control no topo da tela**: `[Formulários] [Avaliações]`
- Dentro de **Formulários** segment: 2 sub-tabs `Respostas` + `Templates` (forms only)
- Dentro de **Avaliações** segment: 2 sub-tabs `Sessões` + `Templates` (assessments only)
- Listagem dedicada de assessment templates dentro do segment Avaliações

---

## 2. Layout proposto

### Header da tela
- Título "Formulários" continua (nome do tab, evita confusão de migração)
- Subtitle pode ser dinâmico conforme segment ativo (opcional, pode ficar vazio)

### Segmented control
- Estilo iOS pill-segmented (já há padrão? — verifica Bloco A; senão usar a abordagem do `forms.tsx` atual mas com 2 segments)
- Segmento 1: "Formulários"
- Segmento 2: "Avaliações"
- Cor ativa: violet (alinhado com web pra Avaliações)
- Quando Avaliações ativo, header pode ganhar accent violet

### Conteúdo por segment

**Formulários (forms-only):**
- Sub-tab `Respostas` → lista de submissions de form (existente: `responses` view)
- Sub-tab `Templates` → lista de form templates (anamnese/checkin/survey, existente)
- FAB "+ Novo formulário" (renomeia do atual "+ Novo template")

**Avaliações (assessments-only):**
- Sub-tab `Sessões` → lista de assessment sessions (existente: `assessments` view com filter chips Todas/Em atraso/Próximas/Concluídas)
- Sub-tab `Templates` → **NOVO** lista de assessment templates (5 Kinevo + customs do trainer)
- FAB "+ Nova avaliação" (existente)
- Trigger "+ Novo template de avaliação" agora vive na sub-tab Templates como CTA do header

---

## 3. Decisões registradas

### 3.1 Sub-tabs em vez de mais segmented control
Cada segmento tem 2 sub-tabs (Respostas+Templates ou Sessões+Templates). Mantém o pattern atual de pill chips horizontais.

### 3.2 Sem renaming do tab no bottom nav
Mantém "Formulários" no bottom nav. Renaming pra "Avaliações" / "Coleta" / outro fica pra M12 ou backlog. Foco aqui é só a IA interna.

### 3.3 Estado do segmented persistido
Segmento ativo persiste em MMKV. Se trainer estava em Avaliações na última sessão, abre ali ao voltar.

### 3.4 Sub-tab Templates de assessments — listing
Lista filtrada `category='assessment'`, mesma query que `mobile/hooks/useAssessmentTemplates` (já existe ou criar). Cards mostram:
- Título
- Badge "Kinevo" (se system) ou "Meu" (se trainer custom)
- N seções
- Tap → drill-down para edit (`/assessments/templates/new?id=<id>`)
- Plus button no header → cria novo (`/assessments/templates/new`)

### 3.5 Não toca em flow web
M11 é mobile-only. Web continua com IA do M8 (2 itens no sidebar separados).

---

## 4. Acceptance criteria

- ✅ Mobile tab "Formulários" abre com segmented control no topo
- ✅ Segmento default: Formulários (ou último estado persistido)
- ✅ Segmento Formulários mostra Respostas + Templates (forms-only)
- ✅ Segmento Avaliações mostra Sessões + Templates (assessments-only)
- ✅ Sub-tab Templates (Avaliações) lista os 5 Kinevo + customs
- ✅ Tap em template Avaliações → abre edit deep-link
- ✅ FABs corretos por segmento
- ✅ Banner de migração in-app explicando reorganização (igual ao M8 web)
- ✅ TypeScript zero novos erros
- ✅ MILESTONE-11-STATUS.md final

---

## 5. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Trainer perde muscle memory das 3 sub-tabs antigas | Banner in-app + a UX é objetivamente mais clara (cada conceito tem seu lugar) |
| Segmented control quebra em telas pequenas (iPhone SE) | Test em simulador com 375px width antes de commit |
| Hook `useTrainerFormTemplates` exclui assessment via type literal | Criar `useTrainerAssessmentTemplates` separado (já flagado no M10 Bloco A) |
| Sub-tabs de forms e assessments têm visuais ligeiramente diferentes | Padronizar via componente `<SubTabs>` se diff for grande |

---

## 6. Sub-blocos

### B1 — Segmented control + restructure (~5 dias)
- Adicionar segmented control no topo de `mobile/app/(trainer-tabs)/forms.tsx`
- Restruture 3 sub-tabs em 2 grupos (Formulários: Respostas+Templates; Avaliações: Sessões+Templates)
- Persistir segment ativo em MMKV
- Banner in-app de reorganização (1ª vez, mesmo padrão do M8 web)

**Critério:** trainer vê 2 segments + sub-tabs corretas em cada.

### B2 — Listing de assessment templates (~3 dias)
- Criar `useTrainerAssessmentTemplates` hook
- Sub-tab Templates dentro de Avaliações segment renderiza listing
- Cards com badge Kinevo/Meu, N seções, tap edit
- Plus button no header pra criar novo

**Critério:** sub-tab Templates lista todos os 5 Kinevo + customs do trainer.

### B3 — Polish + status doc + PR (~2 dias)
- Empty states
- MILESTONE-11-STATUS.md
- Commit + PR + merge

---

## 7. Validação manual

1. **Estado inicial**: trainer abre app → tab Formulários → segmented [Formulários] | [Avaliações] visível, segment Formulários ativo
2. **Sub-tabs Formulários**: Respostas (3) + Templates (3 forms — Check-in + 2 anamneses)
3. **Switch para Avaliações**: tap segment Avaliações → header pode ganhar accent violet
4. **Sub-tabs Avaliações**: Sessões (atual com filter chips) + Templates (5 Kinevo)
5. **Tap em template assessment**: drill-down pra edit com schema pré-preenchido
6. **Plus button**: header da sub-tab Templates → vai pra /assessments/templates/new (criar novo)
7. **Persist**: kill app, reabrir → último segment ativo é restaurado
8. **Banner**: 1ª vez vê banner "Reorganizamos..." com botão "Entendi"

---

## 8. Fora de escopo

- ❌ Renaming do tab no bottom nav (backlog)
- ❌ Tab dedicado "Avaliações" no bottom nav (vai contra a decisão)
- ❌ Refactor server-side (não muda DB nem actions)
- ❌ Web (já está OK pós-M8)
