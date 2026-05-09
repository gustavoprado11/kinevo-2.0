# Milestone 12 — Visual Coherence (web Avaliações ↔ Formulários)

**Pré-requisitos:** Fase 2 completa + M11 + hotfixes. Decisão D1 (cores distintas) confirmada.

**Goal:** alinhar a tela `/avaliacoes` web com a estrutura visual de `/forms` web, mantendo a identidade de cor (azul forms, violet avaliações). Resolver o desconforto identificado pelo user de "produtos diferentes" coabitando.

**Plataforma:** web only.

**Dura:** ~1 semana (B1 + B2 + B3 num único sub-bloco enxuto, ou 2 se necessário).

**Branch:** sem branch — direto em main, padrão hotfix.

---

## 1. Inconsistências mapeadas (estado atual)

### Cores e componentes

| Elemento | `/forms` (azul) | `/avaliacoes` (violet) |
|---|---|---|
| CTA primário shape | rounded-full | rounded-xl mais quadrado |
| CTA primário hover | smooth darken | varia |
| Filter chip ativo | preenchido azul + texto branco | outlined com texto violet |
| Sidebar active state | background azul cheio | background violet suave |
| Counter no header | `Formulários 9` em parênteses ou inline | `Avaliações` + badge separado violet |

### Hierarquia e layout

| Elemento | `/forms` | `/avaliacoes` |
|---|---|---|
| Seções estruturadas | "Aguardando Feedback" + "Enviados pendentes" + "Todas as Respostas" | Lista flat |
| Callout pulsante prioridade | bullet laranja animado em "Aguardando Feedback" | nenhum |
| Cards | multi-camada com avatares + status pills + chevrons | cards simples |
| Footer | nenhum | "Templates de avaliação 5 — Gerenciar →" |

---

## 2. Estado desejado pós-M12

`/avaliacoes` espelha estrutura visual de `/forms`, com:

### Cores e componentes (alinhamento literal)

- CTA primário "Nova avaliação": rounded-full violet (não rounded-xl), mesmo padding/altura/peso de fonte do "Enviar para aluno"
- Filter chips: chip ativo **preenchido violet** (não outlined). "Todas (1)" ativo = background violet + texto branco. Inativo = background neutro + texto secundário. Mesma altura/padding do `/forms`.
- Sidebar item ativo: **background violet cheio** (igual ao "Formulários" ativo azul). Hover idêntico.
- Counter no header: `Avaliações 1` inline (não badge separada)

### Hierarquia (espelha `/forms`)

- Seções estruturadas:
  - **"Em atraso" (N)** — callout vermelho com bullet pulsante quando `N > 0` (paralelo ao "Aguardando Feedback")
  - **"Próximas" (N)** — callout violet quando há sessões agendadas pra próximas 7 dias
  - **"Todas as avaliações" (N)** — lista geral com filter chips internos (Todas / Em atraso / Próximas / Concluídas)
- Cards individuais: avatar do aluno + nome + template + status pill + chevron (igual estrutura do card de submission em forms)
- Footer "Templates de avaliação" mantido (já é OK)

### Empty states

- Quando 0 sessões: callout principal "Nenhuma avaliação ainda" com CTA "Nova avaliação" (já existe)
- Quando há sessões mas todos os subgrupos vazios: cada seção mostra estado tipo "Sem avaliações em atraso" (paralelo ao "Todos os feedbacks em dia" do forms)

---

## 3. Decisões registradas

### 3.1 Identidade de cor preservada

Forms continua azul (`#007AFF`). Avaliações continua violet (`#7c3aed`). Decisão D1 do workshop intacta.

### 3.2 Estrutura visual = espelho

Tudo que não é cor é literal. Mesmas formas, mesmos paddings, mesmos tipos de hierarquia. Pega o componente equivalente em `/forms`, troca cor, aplica.

### 3.3 Seções derivadas dos filter chips existentes

Os filter chips atuais (`Todas`, `Em atraso`, `Próximas`, `Concluídas`) já implicam essas seções. M12 só promove os 2 primeiros pra callouts visuais quando `count > 0`.

### 3.4 Sem novas funcionalidades

M12 é puro visual + estrutura. Sem novas actions, sem novas queries, sem mudança de DB. Reusa tudo que já existe.

### 3.5 Mobile fica out

M12 web only. Mobile (M11 cleanup) tem identidade própria via segmented control + sub-tabs. Trabalho separado se virar dor.

---

## 4. Acceptance criteria

- ✅ CTA "Nova avaliação" tem mesma forma/padding/altura do "Enviar para aluno" (cor diferente: violet)
- ✅ Filter chip ativo preenchido (não outlined) — igual `/forms`
- ✅ Sidebar item ativo violet cheio
- ✅ Counter inline no header
- ✅ "Em atraso" callout vermelho pulsante quando há sessões em atraso
- ✅ "Próximas" callout violet quando há sessões pra próximos 7 dias
- ✅ Cards individuais espelham estrutura do card de submission em /forms
- ✅ Empty states paralelos
- ✅ TypeScript zero novos erros
- ✅ MILESTONE-12-STATUS.md final

---

## 5. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Reusar componente do /forms requer extração | Se não for reusável, espelha visualmente sem extrair (priorize entrega) |
| Animação pulsante quebra em dark mode | Test ambos modos |
| Filter chips quebram com 4 estados | Já tem 4 hoje, só muda visual |
| Mudança de active state quebra navigation hover | Smoke test cuidadoso |

---

## 6. Plano de implementação

### Bloco único (1 sub-bloco, ~1 semana)

Cobertura completa:

1. **`/avaliacoes` page client (`avaliacoes-client.tsx`)**:
   - Re-shape CTA "Nova avaliação" pra rounded-full + dimensões idênticas ao /forms primary
   - Filter chips: estado ativo preenchido violet
   - Header counter inline
   - Adicionar seções "Em atraso" + "Próximas" como callouts (quando count > 0)
   - Refactor cards de session item pra espelhar card de submission

2. **`session-list-item.tsx`** (componente do card):
   - Espelhar estrutura do submission card em /forms (avatar + nome + template + pill + chevron)

3. **Sidebar (`sidebar.tsx`)**:
   - Active state do item "Avaliações" passa a ser violet cheio (não outlined)
   - Garantir que o hover/focus seguem mesmo pattern

4. **Status doc**: `MILESTONE-12-STATUS.md` cobertura

5. **Commit direto em main**

---

## 7. Validação manual

Smoke test comparativo lado-a-lado:

1. Abre `/forms` numa janela e `/avaliacoes` em outra (ou screenshot)
2. Confere paridade nos 5 elementos: CTA primário, filter chips, sidebar active, counter, cards
3. Crie uma sessão "scheduled" pra ontem (artificialmente em atraso) → "Em atraso (1)" callout vermelho deve aparecer
4. Crie outra "scheduled" pra amanhã → "Próximas (1)" callout violet deve aparecer
5. Sem sessões em estado especial → callouts somem, lista geral renderiza normal
6. Sidebar: clica entre Formulários ↔ Avaliações, ambos têm mesma forma de active

---

## 8. Fora de escopo

- ❌ Mudança de cor primária (D1 preservado)
- ❌ Novo conteúdo (sem novas seções de dados)
- ❌ Mobile (próprio sistema via M11)
- ❌ Forms tela (já é o template OK)
- ❌ Refactor de design system canonical (M13+ se virar prioridade)
