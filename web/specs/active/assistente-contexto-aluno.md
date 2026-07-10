# Assistente Web — Coluna de Contexto do Aluno (interativa)

## Status
- [x] Investigação concluída (10/jul/2026) — design importado + código mapeado
- [ ] Em implementação
- [ ] Concluída

> **Para o executor:** leia `web/CLAUDE.md` INTEIRO antes de qualquer coisa. Esta spec é
> autocontida: traz o design, o mapa do código atual (verificado em 10/jul/2026, main `434c3a3`),
> os contratos de dados, o plano faseado e os critérios de aceite. Linhas citadas podem derivar —
> confie nos nomes de arquivo/função e re-localize se necessário.

---

## 1. Objetivo

Quando o treinador **seleciona um aluno** no modo assistente (`/assistente`), abre-se uma
**coluna de contexto à direita** com um card rico do aluno: programa atual + semana, aderência
da semana, alerta/insight ativo, histórico recente de treinos, notas do treinador e botões de
ação rápida (**Perfil / Mensagem / Programa**). Tudo é **interativo**: cada elemento ou executa
uma ação direta (navegação/edição) ou **pré-arma o assistente** (preenche o composer com um
prompt otimizado; o envio cai no fluxo normal de tools + HITL já existente).

A coluna é colapsável (340px aberta ⇄ ~60px como "rail" vertical fechada) e persiste tanto na
home quanto dentro de uma conversa escopada por aluno.

---

## 2. Fonte do design

Projeto claude.ai/design (Gustavo): `https://claude.ai/design/p/1edaec1d-8443-473b-8967-286162aa3eb0?file=Seleção+de+Aluno+com+Contexto.dc.html`

Para reabrir: ferramenta **DesignSync** → `list_files` com `projectId: 1edaec1d-8443-473b-8967-286162aa3eb0`,
depois `get_file` com `path: "Seleção de Aluno com Contexto.dc.html"` (e `colors_and_type.css`
para os tokens). O `.dc.html` é markup com `sc-for`/`sc-if` + um script `class Component extends DCLogic`
com o modelo de estado — dá para ler layout, medidas e comportamento direto do código.

### 2.1 O que o design mostra (resumo fiel)

Tela de 3 colunas, 100vh, fundo `#F5F5F7`:

1. **Sidebar (264px)** — logo, toggle Clássico⇄Assistente, "Nova conversa", "Ir para...",
   segmento **Alunos/Conversas** com busca, lista de alunos com avatar de iniciais + status dot
   + preview; clicar num aluno **seleciona/desseleciona** (toggle). Rodapé com perfil.
   *(Tudo isso JÁ EXISTE no código com pequenas diferenças visuais — ver §3. A sidebar NÃO é
   escopo desta spec; é referência visual apenas.)*
2. **Main (flex:1, conteúdo max-w 800px)** — hero ("O que vamos resolver hoje?"), composer com
   botão **Agir** e mic; abaixo do composer: **chips dos alunos selecionados** (removíveis com ×)
   ou pill "Geral · todos os alunos" quando nada selecionado; medidor de créditos à direita;
   seção **"Precisa de atenção"** com badge de contagem e cards com tag de tipo.
3. **Coluna de contexto (340px aberta / 60px fechada, `transition: width 220ms ease-out`)**:
   - Header: título "Contexto do aluno" + badge violeta com a contagem de selecionados + botão
     de colapsar (chevron, 28×28, borda).
   - **Estado vazio** (nenhum aluno): ícone de pessoa em quadrado neutro + "Nenhum aluno
     selecionado" + "Escolha um aluno na lista ao lado para ver objetivo, aderência e histórico recente."
   - **Um card por aluno selecionado** (borda subtle, radius 20px, padding 16px):
     - Avatar (36px, radius 11) + **nome** + **programa** ("Hipertrofia 3x — semana 5 de 8") + × para remover.
     - **Badge de alerta** (pill): "Pronto p/ evoluir" (verde `#16A34A` sobre `#F0FDF4`) ou
       "Estagnado em 4 exercícios" (âmbar `#B45309` sobre `#FFFBEB`).
     - Seção **ADERÊNCIA** (eyebrow uppercase): rótulo "3/4 esta semana" + barra de progresso
       (6px, track `#F5F5F7`, fill violeta, radius pill).
     - Seção **HISTÓRICO RECENTE**: lista com bullet (dot 6px cinza) — "Treino A — Peito e
       tríceps concluído" + data relativa ("Hoje", "há 2 dias").
     - Seção **NOTAS DO TREINADOR** (caixa `surface-subtle`, radius 12): texto em itálico.
     - **3 botões de ação** lado a lado (flex:1 cada, borda, radius 12, ícone 16px + rótulo
       10.5px): **Perfil**, **Mensagem**, **Programa**.
   - **Estado colapsado**: rail vertical de 60px — chevron, badge de contagem (se seleção) e o
     rótulo "CONTEXTO" em `writing-mode: vertical-rl`. Clicar em qualquer lugar reabre.

### 2.2 Modelo de estado do design

```js
state = { selected: ['al'], contextOpen: true }   // seleção é ARRAY (multi) no design
toggleStudent(id)  // sidebar: adiciona/remove
removeStudent(id)  // × do chip ou do card
toggleContext()    // colapsar/expandir
contextWidth = contextOpen ? 340 : 60
```

⚠️ **O design é multi-seleção; o app hoje é single** (`focusedStudentId: string | null`).
Ver decisão em §8/§10 — o MVP implementa single (1 card), com a arquitetura pronta para N cards.

### 2.3 Tokens do design → código real (Shield Strategy)

O design usa tokens `--kv-*` de um design-system unificado (violet). O app web usa a "Shield
Strategy" do `web/CLAUDE.md`: **light em hex hardcoded + par `dark:` com tokens semânticos**.
NÃO importar o CSS do design; mapear assim:

| Token do design | Valor light | No código web |
|---|---|---|
| `--kv-surface-canvas` | `#F5F5F7` | `bg-[#F5F5F7] dark:bg-background` |
| `--kv-surface-card` | `#FFFFFF` | `bg-white dark:bg-surface-card` |
| `--kv-surface-subtle` | `#FAFAFA` | `bg-[#FAFAFA] dark:bg-surface-inset` |
| `--kv-border-subtle` | `#E8E8ED` | `border-[#EDEDF0] dark:border-k-border-subtle` (padrão já usado no workspace) |
| `--kv-border-default` | `#D2D2D7` | `border-[#D2D2D7] dark:border-k-border-primary` |
| `--kv-brand` / `-700` | `#7C3AED` / `#6D28D9` | hex direto + `dark:` com `violet-400`/`#8b5cf6` (padrão dos componentes do assistente) |
| `--kv-brand-soft` | `#EDE9FE` | `bg-[#EDE9FE] dark:bg-violet-500/15` |
| `--kv-success` / soft | `#16A34A` / `#F0FDF4` | hex + par dark (ex.: `dark:text-green-400 dark:bg-green-500/10`) |
| `--kv-warning` fg/soft | `#B45309` / `#FFFBEB` | hex + par dark (ex.: `dark:text-amber-400 dark:bg-amber-500/10`) |
| texto primário/secundário/terciário | `#1D1D1F` / `#6E6E73` / `#86868B` | hex + `dark:text-foreground` / `dark:text-muted-foreground` / `.../60` |
| `--kv-ease-out` | `cubic-bezier(0.16,1,0.3,1)` | usar na transição de largura da coluna |

Radii do design: card 20px, botões de ação 12px, caixa de notas 12px, pills 9999px.
Atenção: as classes `kv-*` que já existem em `globals.css` (`kv-mode-in`, `kv-msg-in`) são
**animações**, não tokens de cor. A fonte do app não muda (o design usa Plus Jakarta Sans —
fora de escopo).

---

## 3. Mapa do código atual (verificado 10/jul/2026)

### 3.1 Casca do /assistente

- `web/src/app/assistente/page.tsx` — Server Component, casca PRÓPRIA de coluna única (sem
  AppLayout). Faz 4 fetches paralelos: `getAiUsageSummary`, `listConversations`, lista de
  `students` (id/name/status/avatar_url por `coach_id`) e `getAttentionInsights`. Renderiza
  `<AssistantWorkspace>`.
- `web/src/components/assistant/workspace/assistant-workspace.tsx` — root
  `flex h-[100dvh] overflow-hidden bg-[#F5F5F7] dark:bg-background`, **2 colunas**:
  1. `<AssistantSidebar>` (w-64 expandida / 68px colapsada, via `useSidebarStore`) — contém o
     `<AssistantRail>` (tabs Alunos/Conversas, busca, status dots).
  2. Área principal: `<ConversationView>` (se conversa ativa) OU `<AssistantHome>` — conteúdo
     centrado `max-w-[720px]`/`max-w-[760px]`.
  A **nova coluna de contexto entra como 3ª filha desse flex root**, depois da área principal.
- Query params tratados no workspace: `?c=` (conversa), `?s=` (aluno), `?new`.
- O dock global (`unified-panel.tsx`, 420px, outras abas) NÃO existe dentro de `/assistente` —
  não há conflito de espaço.

### 3.2 Seleção de aluno (hoje: single)

- Estado: `focusedStudentId: string | null` em
  `web/src/components/assistant/workspace/use-assistant-thread.ts` (hook do motor).
- `selectStudent(id)` seta o foco e limpa a conversa ativa; clique no rail chama isso.
- Home tem seletor dropdown "Geral · todos os alunos" ⇄ aluno único (`assistant-home.tsx`).
- No 1º envio, `send()` cria a conversa com `POST /api/assistant/conversations`
  body `{ studentId: focusedStudentId }` → grava `ai_conversations.student_id`. Nos turnos
  seguintes o escopo vem da linha da conversa (`conversations/[id]/route.ts` →
  `runAssistantTurn({ studentId })`). **Escopo é por-conversa, não por-turno.**

### 3.3 API pública do hook `useAssistantThread` (o que o painel vai consumir)

`send(override?, opts?)`, `sendVoice`, `stop`, `starter(prompt)` (envia na hora),
**`fillInput(prompt)`** (só preenche o composer — é o padrão dos cards de atenção),
`selectStudent`, `setFocusedStudentId`, `selectConversation`, `goHome`, `recordConfirmation`,
`liveText`, `liveSteps`, `messages`, `active` (conversa ativa, tem `student_id`), `summary`
(créditos), `banner`.

### 3.4 Dados disponíveis (nenhuma migration necessária — tudo já existe)

| Dado do card | Fonte | Onde já é feito hoje |
|---|---|---|
| Programa ativo + semana | `assigned_programs` (`status='active'`, `current_week`, `duration_weeks`, `started_at`, `assigned_workouts(id,name,scheduled_days)`) | Query em `web/src/app/students/[id]/page.tsx` (~linha 47); render "Semana X de Y" em `web/src/components/students/active-program-card.tsx` |
| Aderência semanal | `workout_sessions` completadas na semana ÷ soma de `scheduled_days` | Lógica em `students/[id]/page.tsx` (~linhas 281–331, `historySummary.completedThisWeek`/`expectedPerWeek`); fórmula canônica do dashboard: `min(100, round(done/expected*100))` em `web/src/lib/dashboard/get-dashboard-data.ts` |
| Alerta/insight | Tabela `assistant_insights` (migration 088; campos `category`, `priority`, `title`, `body`, `student_id`, `status`, `insight_key`; realtime HABILITADO) | `getAttentionInsights` em `web/src/lib/assistant/home-data.ts`; mapeamento visual `attentionKind`/`KIND_TAG`/`attentionPrompt` está **inline em `assistant-home.tsx`** (~linhas 59–85) — extrair p/ módulo compartilhado |
| Histórico recente | `workout_sessions` completadas com `assigned_workouts(name)`, `rpe`, `completed_at` | `getRecentSessions(programId, limit)` em `web/src/app/students/[id]/actions/get-recent-sessions.ts`; alternativa por aluno: `get-past-workouts.ts` |
| Notas do treinador | Coluna **`students.trainer_notes`** | Escrita: server action `updateTrainerNotes` em `students/[id]/actions/update-trainer-notes.ts` (checa posse + lock read-only) |
| Status/avatar | `students` (id, name, status, avatar_url) | Já vem no fetch da page + `GET /api/assistant/rail-data` |

⚠️ `kinevo_get_student_progress` (MCP) devolve `adherence_rate_pct: null` — NÃO usar como fonte
de aderência. ⚠️ A **semana começa na SEGUNDA** em todo o produto (convenção web+mobile+shared)
— usar o mesmo helper de início de semana que a página do aluno usa, não `getDay()` cru.

### 3.5 Ações/tools (para os botões interativos)

- Catálogo: 62 tools MCP em `web/src/lib/assistant/tool-policy.ts` (READ auto-executa;
  `CONFIRM_TOOLS` pausa com card HITL — inclui `kinevo_send_message` com campo editável e botão
  "Enviar" especializado).
- HITL: card confirmado → `POST /api/assistant/execute-tool` → `executeConfirmedTool` (valida
  `CONFIRM_TOOLS`, idempotência, cota) → cliente persiste desfecho via `recordConfirmation`.
- Pré-armar prompt (SEM enviar) = `fillInput(texto)` — mesmo padrão dos cards "Precisa de atenção".
- Rotas de navegação confirmadas: perfil `/students/{id}`; programa
  `/students/{id}/program/{programId}` (e `/edit`); **`/messages` REDIRECIONA para /dashboard**
  (mensagens web vivem no dock de outras abas) → o botão Mensagem NÃO deve navegar; deve
  pré-armar o assistente (HITL `send_message` já resolve o envio de ponta a ponta).

---

## 4. Gap design ⇄ código

| # | Design | Código hoje | Ação |
|---|---|---|---|
| G1 | Coluna de contexto à direita (340/60px) | Não existe | **Construir** (núcleo da spec) |
| G2 | Seleção multi (`selected: []`, chips, N cards) | Single `focusedStudentId` | MVP single; multi é F3 com decisão de produto (§10) |
| G3 | Chips de aluno removíveis sob o composer | Dropdown de escopo (pill "Geral") | Opcional F2 — visual apenas; dropdown atual já cumpre a função |
| G4 | Card de atenção seleciona o aluno | `attentionPrompt` só preenche o composer, NÃO seta `focusedStudentId` | Corrigir: clicar num insight com `studentId` também foca o aluno (abre o painel junto) |
| G5 | Dados do card (programa/aderência/histórico/notas) no cliente | Existem só server-side (página do aluno) ou no system prompt | **Nova rota** `GET /api/assistant/student-context/[studentId]` (§6) |
| G6 | Botões Perfil/Mensagem/Programa | Não existem no assistente | Implementar (§7) |
| G7 | Sidebar 264px estilo novo | Sidebar própria já existente (w-64) | FORA DE ESCOPO — não refazer |

---

## 5. Arquitetura proposta

### Arquivos novos

1. **`web/src/lib/assistant/student-panel-data.ts`** — monta o payload do painel server-side.
   Reutiliza/extrai as queries citadas em §3.4 (NÃO duplicar a lógica de aderência: extrair a
   parte reutilizável de `students/[id]/page.tsx` para função compartilhada, ex.
   `computeWeeklyAdherence`, e fazer a página do aluno consumir a mesma função — cuidado para
   não mudar o comportamento da página).
2. **`web/src/app/api/assistant/student-context/[studentId]/route.ts`** — `GET`, autenticado com
   o client Supabase da sessão (RLS + verificação de posse `students.coach_id = trainer.id`,
   seguindo o padrão de `rail-data/route.ts`). **Sem LLM, sem custo de crédito, sem gate de tier.**
   Resposta cacheável no cliente (revalidar ao focar aluno e após turno com tool de escrita).
3. **`web/src/components/assistant/workspace/student-context-panel.tsx`** — a coluna (client
   component). Recebe do workspace: `studentId | null`, callbacks (`onRemove`, `onPrefill` =
   `fillInput`, `onAsk` = `starter`) e renderiza os 3 estados (vazio / card / colapsado).
4. **`web/src/lib/assistant/attention.ts`** (ou ampliar `workspace/ui-util.ts`) — extrair de
   `assistant-home.tsx` os `AttentionKind`, `attentionKind()`, `KIND_TAG`, `attentionPrompt()`
   para reuso entre home, rail e painel. Home passa a importar daqui (refactor sem mudança de
   comportamento).

### Integração no workspace

- `assistant-workspace.tsx`: renderizar `<StudentContextPanel>` como 3ª coluna do flex root.
  O aluno exibido é `active?.student_id ?? focusedStudentId` (na conversa vale o escopo da
  conversa; na home vale o foco).
- Colapso: estado local persistido (`localStorage['kinevo:assistant-context-open']`, default
  aberto quando há aluno; seguir o padrão do `useSidebarStore` se preferir store).
- **Sem aluno o painel fica OCULTO (width 0)** — decisão do Gustavo em 10/jul substituindo o
  estado vazio do design (§2.1). Selecionar um aluno **anima a entrada** (width 0→340, 220ms,
  ease do §2.3); o `<aside>` deve ser único e sempre montado para a transição de width disparar.
- Auto-comportamento: focar um aluno **abre** o painel se estiver colapsado; remover o aluno
  (×) chama `setFocusedStudentId(null)` e o painel se recolhe (width 0, animado).
- Responsivo: `hidden lg:flex` no mínimo (abaixo disso o painel não renderiza no v1; overlay
  mobile é F2). A largura 340px + rail 60px usa `transition-[width] duration-200` com o ease do §2.3.
- Fetch: hook `useStudentContext(studentId)` no próprio painel (fetch + cache em `Map` por id +
  estado loading/skeleton). Na F1, o fetch acontece só na troca de aluno em foco. A invalidação
  pós-turno (quando o assistente executa tool de escrita para o aluno em foco — o `done` do
  turno devolve parts `executed`) é **F2**, não implementar na F1.

### Payload (contrato)

```ts
// GET /api/assistant/student-context/[studentId] → 200
interface StudentContextPayload {
  student: { id: string; name: string; avatarUrl: string | null; status: string }
  program: {
    id: string; name: string
    currentWeek: number | null; durationWeeks: number | null   // "semana 5 de 8"
    startedAt: string | null
  } | null
  adherence: { done: number; expected: number; pct: number } | null  // semana atual (seg–dom)
  alert: {                                                     // insight de maior prioridade
    insightId: string
    kind: 'estagnado' | 'pronto_para_evoluir' | 'nota'
    label: string                                              // ex. "Estagnado em 4 exercícios"
    prompt: string                                             // attentionPrompt() pronto p/ o composer
  } | null
  history: Array<{ id: string; text: string; dateLabel: string; completedAt: string }>  // últimas 3
  notes: string | null                                         // students.trainer_notes
  readOnly: boolean                                            // lock de gestão (free) — esconde edição de notas
}
// 404 se o aluno não pertence ao treinador; 401 sem sessão.
```

Datas relativas (`dateLabel`: "Hoje", "Ontem", "há N dias") — gerar no cliente ou no server,
mas consistente com o que a home já faz (`ui-util.ts` tem helpers de agrupamento por tempo).

---

## 6. Interatividade — comportamento de CADA elemento

Padrão geral: **ação direta** quando existe GUI canônica (deep-link), **pré-armar o assistente**
(`fillInput` + focus no composer) quando a ação é conversacional. Nunca disparar tool de escrita
sem passar pelo fluxo HITL existente.

| Elemento | Clique → |
|---|---|
| × no card / chip | `setFocusedStudentId(null)` (na conversa escopada: só volta pra home? NÃO — na conversa o escopo é fixo; esconder o × quando o aluno vem de `active.student_id`) |
| Badge de alerta | `fillInput(alert.prompt)` + focus composer (mesmo padrão dos cards de atenção da home) |
| Barra/linha de aderência | `fillInput("Como está a aderência e a frequência de {nome} nas últimas semanas? O que devo ajustar?")` |
| Item do histórico | v1: sem ação; F2: `fillInput` sobre a sessão ("Analise o treino {nome} de {data} do {aluno}") |
| Notas do treinador | v1: leitura; F2: editar inline (textarea + salvar via `updateTrainerNotes`; esconder se `readOnly`) |
| **Perfil** | `<Link href={`/students/${id}`}>` (nova aba não; navegação normal) |
| **Mensagem** | `fillInput("Envie uma mensagem para {nome}: ")` + focus composer — o Agir cai no card HITL `kinevo_send_message` (campo editável + botão Enviar já existem) |
| **Programa** | com programa ativo: `<Link href={`/students/${id}/program/${programId}`}>`; sem programa: `fillInput("Monte um programa de treino para {nome} considerando o histórico e o objetivo dele")` |
| Header colapsar / rail fechado | `toggleContext()` |
| Card "Precisa de atenção" (home) | além do `fillInput` atual, se `item.studentId` existir: `setFocusedStudentId(item.studentId)` (G4) |
| Aluno no rail | comportamento atual (`selectStudent`) — o painel reage sozinho ao foco |

Estados visuais: skeleton no fetch; erro → linha discreta com "Tentar de novo"; aluno sem
programa → card sem seção de aderência + CTA no botão Programa; sem histórico → "Nenhum treino
concluído ainda"; sem notas → esconder a caixa (não mostrar vazio).

---

## 7. Plano faseado

### F0 — Fundações (sem UI)
1. Extrair `attentionKind`/`KIND_TAG`/`attentionPrompt` de `assistant-home.tsx` para módulo
   compartilhado; home re-importa (zero mudança de comportamento).
2. Extrair cálculo de aderência semanal da página do aluno para função compartilhada; página
   re-consome (zero mudança de comportamento — os testes existentes da página devem passar).
3. `student-panel-data.ts` + rota `GET /api/assistant/student-context/[studentId]` + testes
   (posse, payload completo, aluno sem programa, sem histórico, readOnly).

### F1 — Painel (MVP single-select)
4. `student-context-panel.tsx` com os 3 estados + skeleton + Shield styling (light hex + dark
   tokens, §2.3) + transição de largura.
5. Integração no `assistant-workspace.tsx` (3ª coluna, home E conversa; aluno =
   `active?.student_id ?? focusedStudentId`), persistência do colapso, auto-abrir ao focar.
6. Botões Perfil/Mensagem/Programa + badge de alerta + G4 (insight foca o aluno).
7. QA E2E via CDP (ver gotchas §9) + tsc/eslint/testes limpos.

### F2 — Interatividade estendida
8. Notas editáveis inline (`updateTrainerNotes`, respeitar `readOnly`).
9. Histórico clicável; refresh do painel pós-turno com tool de escrita; realtime opcional de
   `assistant_insights` (a tabela já publica realtime) para o badge.
10. Chips de aluno sob o composer no estilo do design (substituindo o visual do dropdown atual,
    mantendo a mecânica single).

### F3 — Multi-seleção (NÃO iniciar sem decisão do Gustavo — §10)
11. `selected: string[]` no workspace, N cards no painel, chips múltiplos; definição de como o
    escopo multi entra no turno (hoje `ai_conversations.student_id` é single).

---

## 8. Critérios de aceite (F0+F1)

1. Clicar num aluno no rail abre o painel com card completo (programa "Semana X de Y",
   aderência com barra, alerta quando houver, 3 sessões recentes, notas) em <1s percebido
   (skeleton imediato).
2. Sem aluno: painel OCULTO (width 0); selecionar um aluno anima a entrada (220ms).
   Colapsado (com aluno): rail de ~60px com contagem e rótulo vertical; clicar reabre.
3. Badge de alerta e botão Mensagem preenchem o composer (NÃO enviam); Agir → fluxo normal
   (Mensagem termina em card HITL com botão Enviar).
4. Perfil e Programa navegam para as rotas canônicas; Programa sem programa ativo pré-arma o prompt.
5. Card de atenção da home com `studentId` passa a focar o aluno (painel acompanha).
6. Dentro de uma conversa escopada, o painel mostra o aluno da conversa e o × não aparece.
7. Painel não consome créditos nem chama LLM; rota nova respeita posse (404 p/ aluno de outro
   treinador) e RLS.
8. Dark mode completo (nenhum hex light sem par `dark:`); nada quebra em <lg (painel some).
9. `tsc` 0; **zero problemas de lint NOVOS nos arquivos tocados** (o repo tem centenas de
   problemas pré-existentes — comparar contra baseline capturado antes de editar); suíte de
   testes web sem falhas novas; e a página `/students/[id]` continua idêntica (a extração da
   aderência é refactor puro).

---

## 9. Gotchas e regras invioláveis

- **Ler `web/CLAUDE.md` primeiro.** Vale sobre qualquer coisa aqui.
- **Shield Strategy** de estilo: light hex hardcoded + `dark:` com tokens semânticos
  (`surface-*`, `k-border-*`, `glass-bg`); brand violeta `#7C3AED`→`#8b5cf6`. Olhar
  `assistant-home.tsx`/`conversation-view.tsx` como referência de pares.
- **Semana começa na segunda** (convenção do produto inteiro) — reusar o helper existente.
- **Não duplicar a fórmula de aderência** — extrair e re-consumir (dashboard usa
  `min(100, round(...))`; manter alinhado).
- **Não tocar no motor do turno** (`use-assistant-thread.ts` core, `command-engine.ts`,
  rotas de turno) além de consumir a API pública do hook. O painel é leitura + prefill.
- **Nenhuma migration é necessária.** Se o executor achar que precisa de uma, parou — está
  desviando da spec. (Gotcha do repo: `gen:types` pode truncar `database.ts` se falhar.)
- **Sem tool nova de MCP** — os botões usam navegação ou prompts pré-armados.
- Z-index: usar os utilitários semânticos (`z-sidebar`, `z-modal`...) se precisar sobrepor.
- React Compiler ativo: não atribuir `ref.current` durante o render (gotcha recorrente do repo).
- **QA via CDP** (gotchas conhecidos): dashboard nunca fica `networkidle` (realtime) — não
  esperar por isso; modal "Bem-vindo ao Kinevo" intercepta cliques (dispensar com "Pular para
  sempre" via `addLocatorHandler`); escopar seletores dentro do `aside` do painel (existem
  botões homônimos atrás).
- A rota `/api/assistant/rail-data` já agrega alunos+atenção para hidratação do rail — se o
  payload do painel puder reusar partes dela, reusar; não criar terceira fonte de verdade.

## 10. Decisões em aberto (confirmar com o Gustavo antes de F3; F0–F2 não dependem delas)

1. **Multi-seleção (G2/F3):** o design permite selecionar vários alunos (chips + N cards).
   O backend hoje amarra a conversa a UM `student_id`. Opções: (a) manter single e o design
   multi fica só como affordance visual de troca rápida; (b) multi de VERIFICAÇÃO (N cards no
   painel) mas conversa ainda single/geral; (c) multi de verdade no turno (exige mudança no
   modelo de conversa/contexto). Recomendação: lançar F1 single, medir uso, decidir depois.
2. **Painel dentro do dock** (outras abas, `assistant-panel-content.tsx`): replicar um resumo
   compacto do contexto no dock é desejável mas não está nesta spec (o dock tem 420px).
3. **Chips sob o composer (F2 item 10):** adotar o visual de chip do design ou manter o
   dropdown atual? (Cosmético; decidir na F2.)
