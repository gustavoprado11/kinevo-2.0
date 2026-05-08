# Milestone 4 — Web builder + view

**Pré-requisitos:** ler `00-visao-geral.md`, `MILESTONE-1-STATUS.md`, `MILESTONE-2-STATUS.md`, `MILESTONE-3-STATUS.md`. M1, M2 e M3 estão em main.

**Goal:** entregar a contraparte web do módulo de avaliações presenciais, com foco em três valores específicos do web sobre mobile: (1) **builder de pacote** com UX drag-and-drop, (2) **visualização confortável** de sessões e resultados em telona, (3) **integração com `/students/[id]`** estendendo o `AssessmentSidebarCard` que já existe.

**Plataforma:** Next.js web (`/web`).

**Dura:** 8-12 dias úteis.

**Branch:** sem branch — direto em main, sem commit/push até validação aprovada (mesmo padrão M1/M2/M3).

---

## 1. Por que M4 é qualitativamente diferente de M3

M3 entregou UI mobile pra trainer **com aluno na frente**. Riscos eram offline, recovery, fast-input.

M4 entrega UI web pra trainer **no escritório**, sem aluno presente. Riscos são diferentes:

1. **Expectativa visual mais alta.** Telona = designers e donos olham UI web mais critically. Padrão Apple HIG do projeto deve ser respeitado.
2. **Integração com componentes existentes** — `evaluation-preview`, `AssessmentSidebarCard`, `FormsDashboardClient` já existem. Estender sem regredir é mais arriscado que criar do zero.
3. **Builder drag-and-drop** é UX-pesado. Decisões erradas aqui geram fricção alta no trainer (mexe com template todo dia, errar incomoda muito).
4. **Plano "Estúdio"** é primeiro feature explicitamente paywall — `getTrainerWithSubscription()` precisa gatear corretamente.

Por isso M4 vale extra disciplina nos sub-blocos com gates explícitos.

---

## 2. O que entra no escopo

### 2.1 Aba "Avaliações Presenciais" em `/forms`

`web/src/app/forms/forms-dashboard-client.tsx` já tem tabs Respostas / Templates. **Adicionar terceira aba "Presenciais"** seguindo mesmo pattern:

- FilterChips: Todas / Em atraso / Próximas / Concluídas
- Lista de sessões (cards horizontais com nome do aluno, template, data, status badge)
- Botão "+ Nova avaliação" no header (paralelo ao "+ Novo template" existente)
- Tap em sessão → navega pra tela de detalhe

### 2.2 Template builder (`/forms/templates/new` e `/forms/templates/[id]/edit`)

A estrutura de rota `/forms/templates/new` já existe (verificar). M4 adiciona suporte ao parâmetro `?category=assessment` que carrega o builder específico:

**Layout three-column (Apple-style):**
- Esquerda (~280px): biblioteca de testes disponíveis (NumericUnit, Bilateral, MultiAttempt, Computed, Protocol)
- Centro (flex): pacote sendo construído — drag-and-drop, agrupado em sections
- Direita (~320px): propriedades do teste selecionado

**Componentes principais:**
- `<TestLibraryColumn>` — lista clicável + draggable de tipos de teste
- `<AssessmentBuilderCanvas>` — central, mostra sections + tests, suporta drag-reorder
- `<TestPropertiesPanel>` — editor de props do teste em foco

**Drag-and-drop:** usar `@dnd-kit/core` se já estiver no projeto. Se não, **PARAR e perguntar** antes de adicionar dep.

### 2.3 Tela de detalhe de sessão (`/students/[id]/avaliacoes/[sessionId]`)

Read-only para sessões `completed`/`cancelled`, summary editável para `scheduled`/`in_progress` (mas a captura real continua sendo no mobile — web só permite ver o estado e cancelar/reagendar):

**Conteúdo:**
- Header com aluno + protocolo + data + status badge
- Checklist de testes com valores inline (similar ao `TestChecklistItem` do mobile, adaptado pra web)
- Botão "Ver resultado" se status='completed'
- Botão "Cancelar sessão" se status='scheduled' (com confirmação)

### 2.4 Tela de resultado (`/students/[id]/avaliacoes/[sessionId]/result`)

Espelha o `result.tsx` do mobile, mas em layout web:

- `<ResultStatsCard>` — versão web com mesma estrutura visual do mobile mas otimizada pra largura (3 colunas em vez de 2)
- `<ResultComparisonRow>` — comparativo com sessão anterior do mesmo template
- `<HistoryMiniChart>` — sparkline ou Recharts (já no projeto) com série temporal
- Botão "Compartilhar laudo (PDF)" — placeholder M5

### 2.5 `AssessmentSidebarCard` estendido em `/students/[id]`

Esse componente **já existe** em `web/src/components/students/assessment-sidebar-card.tsx` mostrando:
- Última submission (anamnese/checkin)
- Pending forms
- Body metrics estáticos
- BodyMetricsTrend (se ≥2 pontos)

M4 adiciona uma **nova seção "Avaliação Presencial"** no topo:
- Última sessão (se houver) com IMC + %BG + classificação
- Ícone roxo `presencial` distinguindo das outras
- Tap navega pra `/students/[id]/avaliacoes/[sessionId]/result`
- Empty state se não houver sessões

### 2.6 Action de criar sessão via web

`/web/src/actions/assessments/create-session.ts` já existe (placeholder M1). Estender com:
- Validação de input (sex, age_years obrigatórios — copia do mobile CreateSessionModal)
- Encadeamento de `save_assessment_measurements` para subject_sex / subject_age_years (mesmo padrão do M3)
- Return type que diferencia sucesso/erro pro caller usar

### 2.7 Modo "preencher agora" no web — **FORA DO ESCOPO M4**

Discussão: estúdios com tablet/desktop podem querer capturar no web em vez do mobile. Mas isso é fricção adicional (manter dois renderers de input em sync) e o mobile já cobre o caso 90%.

**Decisão M4:** apenas criar/visualizar/editar templates e ver sessões. Captura continua sendo só no mobile. Se demandado depois (Fase 2 ou refinamento), o `evaluation-preview` já fornece base.

---

## 3. Padrão visual

Tokens Apple HIG do projeto (em `web/src/app/globals.css`):
- `--surface-canvas: #F5F5F7`
- `--surface-card: #FFFFFF`
- `--text-primary: #1D1D1F`
- `--primary: #007AFF` (CTAs principais)
- `--violet: #7c3aed` ou `#8b5cf6` para chrome de avaliação presencial (seguir o token `presencial` do mobile)

**Badges no padrão shadcn já estabelecido:**
```
bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20
```

Iconografia: lucide-react. Sugestões:
- `Activity` ou `Ruler` na lista
- `Calendar`, `Clock`, `CheckCircle2`, `AlertCircle` no status
- `Plus`, `Save`, `Send` no builder
- `TrendingUp`, `Share2` no resultado

---

## 4. Estrutura de arquivos sugerida

```
web/src/
├── app/
│   ├── forms/
│   │   ├── forms-dashboard-client.tsx        (estendido — aba Presenciais)
│   │   └── templates/
│   │       ├── new/page.tsx                   (estendido — suporte category=assessment)
│   │       └── [id]/edit/page.tsx             (NEW se não existir)
│   └── students/
│       └── [id]/
│           └── avaliacoes/
│               └── [sessionId]/
│                   ├── page.tsx                (NEW — detalhe da sessão)
│                   └── result/page.tsx         (NEW — resultado)
├── components/
│   ├── assessments/                            (NEW pasta)
│   │   ├── builder/
│   │   │   ├── TestLibraryColumn.tsx
│   │   │   ├── AssessmentBuilderCanvas.tsx
│   │   │   ├── TestPropertiesPanel.tsx
│   │   │   ├── DraggableTestItem.tsx
│   │   │   └── SectionEditor.tsx
│   │   ├── view/
│   │   │   ├── SessionChecklistCard.tsx       (read-only equivalent do mobile TestChecklistItem)
│   │   │   ├── ResultStatsCardWeb.tsx
│   │   │   ├── ResultComparisonTable.tsx
│   │   │   └── HistoryMiniChartWeb.tsx
│   │   ├── SessionListItem.tsx
│   │   ├── CreateSessionModal.tsx              (web equivalent do mobile)
│   │   └── AssessmentStatusBadge.tsx
│   └── students/
│       └── assessment-sidebar-card.tsx         (estendido — seção Avaliação Presencial)
├── actions/
│   └── assessments/                            (já existe — placeholders M1, evoluir)
│       ├── create-session.ts                   (estendido com sex/age)
│       ├── get-session.ts                      (NEW)
│       ├── get-session-list.ts                 (NEW)
│       ├── update-template.ts                  (NEW — para builder save)
│       └── cancel-session.ts                   (NEW)
└── hooks/  (se necessário)
    └── useAssessmentBuilder.ts                 (NEW se builder ficar complexo)
```

---

## 5. Sub-blocos sugeridos (B1 a B4 + C)

### B1 — Actions, hooks, tipos (~2-3 dias, sem UI)

- Server actions completos em `web/src/actions/assessments/`
- Hooks compartilhados se necessário
- Tipos web-side para builder state
- Sem nenhuma tela tocada ainda
- Validação: `tsc --noEmit` em web/ limpo

### B2 — Componentes do builder (~3-4 dias)

- TestLibraryColumn, AssessmentBuilderCanvas, TestPropertiesPanel, DraggableTestItem, SectionEditor
- Drag-and-drop com `@dnd-kit/core` (PARAR se precisar adicionar dep)
- Testáveis em isolamento via Storybook ou tela de dev
- Sem integração com /forms ainda

### B3 — Componentes de view e telas (~3-4 dias)

- SessionListItem, SessionChecklistCard, ResultStatsCardWeb, ResultComparisonTable, HistoryMiniChartWeb
- AssessmentStatusBadge
- Telas: `/forms` (estendido), `/students/[id]/avaliacoes/[sessionId]`, `/students/[id]/avaliacoes/[sessionId]/result`
- Smoke test web não regrediu Respostas/Templates

### B4 — Polish + AssessmentSidebarCard + status doc (~2-3 dias)

- Estender AssessmentSidebarCard com seção Avaliação Presencial
- Loading states em todas as ações
- Error states user-friendly via toast (`react-hot-toast` ou similar do projeto)
- Empty states refinados
- Acessibilidade (ARIA, keyboard navigation)
- MILESTONE-4-STATUS.md final
- Smoke test completo

### C — Validação manual + commit + push

- User valida happy paths em browser dev
- Eu re-revisar diff
- Commit + push

---

## 6. Acceptance criteria

### Funcionalidade

- ✅ Aba "Presenciais" aparece em `/forms` ao lado de Respostas/Templates sem regressão
- ✅ Builder de template assessment funcional: criar, editar, salvar, deletar
- ✅ Trainer consegue criar sessão pelo web via "+ Nova avaliação" → modal com aluno + template + sex/age
- ✅ Tela de detalhe de sessão mostra checklist read-only com valores inline
- ✅ Tela de resultado mostra todas as métricas calculadas (BMI, RCQ, %BG, lean/fat mass, classificação P&W)
- ✅ Comparativo histórico funciona com sessão anterior do mesmo template
- ✅ AssessmentSidebarCard mostra última sessão presencial em /students/[id]
- ✅ Cancelar sessão funciona (status='cancelled', desaparece de listas ativas)

### Qualidade

- ✅ TypeScript compila sem erros novos em web/
- ✅ Sem regressão em `/forms` (Respostas, Templates)
- ✅ Sem regressão em `/students/[id]` (resto da página intacta)
- ✅ Padrão shadcn respeitado (badges, cards, buttons)
- ✅ Tokens Apple HIG (não hex hardcoded)
- ✅ Loading states em todas as ações de rede
- ✅ Empty states alinhados com padrão do projeto
- ✅ Dark mode funciona em todas as telas novas (CSS variables semânticas)
- ✅ Acessibilidade: ARIA roles, keyboard navigation, focus visible
- ✅ Performance: builder com 20+ testes não trava

### Validação manual

- ✅ Happy path: criar template assessment → atribuir sessão a aluno → finalizar via mobile → ver resultado web
- ✅ Editar template: abrir existente, modificar, salvar, ver mudança refletida
- ✅ Criar sessão direto pelo web sem passar pelo mobile (até finalize, que continua mobile-only)
- ✅ AssessmentSidebarCard: ver última avaliação presencial de um aluno via /students/[id]
- ✅ Smoke test não regressão: anamnese (form_template antiga) ainda funciona via Respostas tab
- ✅ Cancel session: cancelar uma sessão agendada, ver desaparecer das listas ativas

---

## 7. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| `@dnd-kit/core` não estar no projeto | Verificar antes de B2; se ausente, parar e perguntar antes de adicionar |
| Builder drag-and-drop ficar pesado com 20+ testes | Virtualization se necessário; teste de performance no B2 |
| AssessmentSidebarCard regressão | Inspecionar diff cuidadosamente; smoke test manual antes de commit |
| Conflito visual com formulários antigos no /forms | Aba isolada; não compartilhar estado entre tabs |
| Comparativo histórico difere de mobile | Reusar a mesma engine M2 + mesmas métricas — não duplicar lógica |
| `evaluation-preview` ficar quebrado | É só preview de schema — M4 não toca nele |
| getTrainerWithSubscription gating não está claro pra Estúdio | Plano "Estúdio" é F2; M4 não precisa disso |
| User cria sessão web mas não pode capturar | Modal explica claramente: "Sessão criada. Capture pelo app mobile ou tablet." |
| Locale pt-BR (vírgula decimal) | Já estabelecido em M3, replicar |
| Dark mode quebra contrast | Smoke test em ambos os modos antes de commit |

---

## 8. Fora de escopo

- ❌ Modo "preencher agora" no web (mobile cobre)
- ❌ Comparativo avançado entre múltiplas sessões (F2 ou refinamento)
- ❌ Painel de estúdio multi-trainer (F2)
- ❌ Exportação Excel/CSV (F2)
- ❌ PDF generation (M5)
- ❌ Player de vídeo CMJ com scrubber (F2)
- ❌ Edição de metadados da sessão após criação (refinamento)

---

## 9. Validação manual antes de pushar

Cenários obrigatórios em **browser dev** (Chrome ou Safari):

1. **Builder**: criar template "Antropometria + Petroski" do zero. Adicionar 4 numeric_unit + protocol Petroski + 2 computed. Salvar. Re-abrir, verificar que persistiu corretamente.
2. **Criar sessão web**: novo botão "+ Nova avaliação", selecionar aluno + template + sex M + age 32. Submit. Sessão aparece em "Em andamento" na lista.
3. **Visualizar sessão (criada via mobile, finalizada)**: tap em sessão "Concluída" → checklist read-only com valores inline → "Ver resultado" → tela com IMC, %BG, etc.
4. **AssessmentSidebarCard**: navegar /students/[id] de um aluno com sessão presencial concluída → seção "Avaliação Presencial" no topo do card mostra última.
5. **Cancelar sessão**: cancelar sessão agendada, verificar que sai da lista de "Próximas" e aparece em "Canceladas" (se houver filtro) ou simplesmente some.
6. **Não regressão**: Respostas tab e Templates tab continuam funcionando idênticos.
7. **Dark mode**: todas as telas novas legíveis em dark mode.
8. **Responsivo**: builder em viewport ~1024px (laptop pequeno) ainda usável.

Cada cenário gera um screenshot salvo em `docs/specs/avaliacoes-presenciais/m4-validation-evidence/`.
