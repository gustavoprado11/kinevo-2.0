# PROMPT — Milestone 4: Web builder + view (Avaliações Presenciais)

> Cole este prompt no Claude Code. M1, M2 e M3 já estão em main. Trio em prod.

---

Você vai implementar o **Milestone 4 — Web builder + view** do módulo de
Avaliações Presenciais do Kinevo. Esta é a contraparte web do M3 (mobile),
focada em três valores: (1) builder de pacote drag-and-drop, (2)
visualização confortável em telona, (3) integração com `/students/[id]`
estendendo `AssessmentSidebarCard` que já existe.

⚠️ **Atenção:** este código vai pra Vercel/produção e é visualmente exposto
(designers e donos vão olhar criticamente). Padrão Apple HIG do projeto deve
ser respeitado rigorosamente. Não introduzir hex hardcoded — usar CSS
variables semânticas de `globals.css`.

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/00-visao-geral.md`
   - `docs/specs/avaliacoes-presenciais/04-milestone-4-web-builder.md` (a spec completa deste milestone)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-1-STATUS.md`
   - `docs/specs/avaliacoes-presenciais/MILESTONE-2-STATUS.md`
   - `docs/specs/avaliacoes-presenciais/MILESTONE-3-STATUS.md`

2. Examine os arquivos web existentes que serão estendidos:
   - `web/src/app/forms/forms-dashboard-client.tsx`
   - `web/src/components/students/assessment-sidebar-card.tsx`
   - `web/src/components/previews/evaluation-preview/` (não modificar, apenas conhecer)
   - `web/src/actions/assessments/` (placeholders M1, evoluir)
   - `web/src/app/forms/templates/new/page.tsx` (existe? como está?)

3. Confirme entendimento:
   - Que sub-blocos são B1/B2/B3/B4 e o que cada um cobre
   - Que está FORA do escopo (modo preencher web, painel estúdio,
     comparativo multi-template, PDF — todos pra fases futuras)
   - Decisões herdadas do M3 (toast em vez de Alert, tokens HIG,
     vírgula pt-BR, sex/age via measurements especiais)

4. Se algo for ambíguo, **PARE e pergunte**. Não invente.

## Workflow (mesmo padrão dos M1, M2, M3)

- **Sem branch.** Direto em main.
- **Sem `git commit` nem `git push` durante desenvolvimento.** Eu autorizo
  ao final de tudo após smoke test do user.
- **DIVIDIDO em 4 sub-blocos** (B1 → B2 → B3 → B4) com paradas obrigatórias
  no meio:

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (read-only, sem mudanças)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (deve estar limpo, exceto cosméticos pré-existentes)
2. `git log --oneline -5` (último: `a800959 feat(assessments): M3 mobile capture flow`)
3. `cat web/package.json | grep -E '"@dnd-kit|recharts|lucide-react|react-hot-toast|sonner"'`
   - Quais libs de drag-drop, charts, toast e icons já estão no projeto?
   - Se @dnd-kit/core NÃO estiver, PARAR e me chamar antes de adicionar
4. Inspecionar arquivos chave existentes:
   - `head -100 web/src/app/forms/forms-dashboard-client.tsx`
   - `head -120 web/src/components/students/assessment-sidebar-card.tsx`
   - `cat web/src/actions/assessments/*.ts`
   - `ls web/src/app/forms/templates/`
   - `ls web/src/components/forms/`
5. Procurar por código pré-existente que conflite:
   `grep -rln "assessment\|AssessmentSession" web/src/ --include="*.ts" --include="*.tsx" | head -20`
   — espera-se ver M1 placeholders. Se houver mais, reportar.
6. `cd web && npx tsc --noEmit 2>&1 | tail -20` (baseline de erros pré-existentes)
7. Verificar tokens disponíveis em globals.css:
   `grep -E "presencial|violet|--surface|--text" web/src/app/globals.css | head -20`

PARE e me mande o relatório completo. Foco especial em:
- Lib de drag-drop disponível (@dnd-kit/core ou alternativa)
- Lib de charts (recharts já no projeto?)
- Lib de toast (qual a convenção do projeto?)
- Tokens semânticos de `presencial` e `violet` em globals.css
- Erros pré-existentes (vamos ignorar mas precisam ser conhecidos)

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — ACTIONS, HOOKS, TIPOS (sem UI)
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

Implementar:
- `web/src/actions/assessments/get-session.ts` (NEW) — fetch sessão única com measurements
- `web/src/actions/assessments/get-session-list.ts` (NEW) — lista filtrada por trainer
- `web/src/actions/assessments/update-template.ts` (NEW) — para builder save
- `web/src/actions/assessments/cancel-session.ts` (NEW) — soft cancel
- Estender `web/src/actions/assessments/create-session.ts`:
  - Validação de input (sex obrigatório, age_years entre 5 e 120)
  - Encadeamento de save_assessment_measurements para subject_sex / subject_age_years
- Tipos web-side em `web/src/types/assessments.ts` (se necessário, ou reaproveitar de @kinevo/shared)
- Hooks compartilhados se aplicável (verificar padrão do projeto — talvez não use hooks no web, prefere actions diretas)

Convenções:
- Server actions com `'use server'`
- Auth check via `getTrainerWithSubscription()` no início
- Erros como return type `{ success: false, error: string }`, não throw
- Usar tipos do shared/types/assessments.ts onde possível

Verificações:
- `cd web && npx tsc --noEmit` continua limpo
- Sem nenhuma UI tocada ainda

PARE e reporte. Aguardo aprovação antes de B2.

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — COMPONENTES DO BUILDER (testáveis em isolamento)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

Implementar:
- `web/src/components/assessments/builder/TestLibraryColumn.tsx` — coluna esquerda
- `web/src/components/assessments/builder/AssessmentBuilderCanvas.tsx` — canvas central drag-drop
- `web/src/components/assessments/builder/TestPropertiesPanel.tsx` — coluna direita
- `web/src/components/assessments/builder/DraggableTestItem.tsx` — item draggable
- `web/src/components/assessments/builder/SectionEditor.tsx` — editor de section

Diretrizes UX:
- Layout three-column responsivo (em viewport <1100px, propriedades vão pra modal/sheet)
- Drag-and-drop fluido: cursor grab, drop zones visuais, animação smooth
- Selecionar teste destaca-o no canvas e abre TestPropertiesPanel
- Validação inline: testes obrigatórios marcados, erros (ex: metric_key duplicado) com mensagem
- Save inteligente: dirty state, autosave em rascunho local, "Salvar" botão explícito pra commit
- Empty state amigável quando canvas vazio

⚠️ Importante:
- Se @dnd-kit/core não estiver no projeto, PARAR no Bloco A. Não usar HTML5 drag-and-drop (UX inferior em RN web e desktop browsers)
- Reusar tokens visuais de globals.css (sem hex hardcoded)
- Match com padrão visual do FormBuilderModal mobile (mesmo conceito visual, adaptado pra web)

Pra testar isolado: criar `web/src/app/_dev/builder-harness/page.tsx`
(temporário, deletar em B4 final).

Verificações:
- TypeScript clean
- Builder usável em viewport 1280px e 1024px (laptop comum)
- Performance: 20+ testes sem lag perceptível

PARE e reporte com screenshots dos componentes na tela de dev.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — COMPONENTES DE VIEW + TELAS + INTEGRAÇÃO
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

Implementar:

**Componentes de view:**
- `web/src/components/assessments/view/SessionChecklistCard.tsx` — read-only checklist
- `web/src/components/assessments/view/ResultStatsCardWeb.tsx` — stats grid 3-col
- `web/src/components/assessments/view/ResultComparisonTable.tsx` — comparativo
- `web/src/components/assessments/view/HistoryMiniChartWeb.tsx` — sparkline com Recharts
- `web/src/components/assessments/SessionListItem.tsx` — card na lista
- `web/src/components/assessments/CreateSessionModal.tsx` — modal de criação
- `web/src/components/assessments/AssessmentStatusBadge.tsx`

**Telas:**
- Estender `web/src/app/forms/forms-dashboard-client.tsx`:
  - Tab type: `"responses" | "templates" | "assessments"`
  - FilterChips: Todas / Em atraso / Próximas / Concluídas
  - Lista de sessões via SessionListItem
  - Botão "+ Nova avaliação"
- `web/src/app/students/[id]/avaliacoes/[sessionId]/page.tsx` (NEW) — detalhe de sessão
- `web/src/app/students/[id]/avaliacoes/[sessionId]/result/page.tsx` (NEW) — resultado

**Estender builder:**
- `web/src/app/forms/templates/new/page.tsx`:
  - Suporte a query param `?category=assessment` que renderiza o builder novo
  - Default ainda é o builder de form template existente

⚠️ Não regredir Respostas e Templates tabs. Smoke test manual:
- Abrir `/forms`, todas as 3 tabs devem funcionar
- Criar form template não-assessment continua funcionando
- AssignFormModal e SubmissionDetailSheet continuam funcionais

Verificações:
- Toda a navegação funciona
- Engine M2 não é chamada aqui — finalize continua mobile-only
- Cancelar sessão atualiza estado imediatamente

PARE e reporte com screen-recording de happy path web (criar template
assessment → criar sessão pelo web → visualizar sessão → ver resultado).

═══════════════════════════════════════════════════════════════════════
BLOCO B4 — POLISH + ASSESSMENTSIDEBARCARD + STATUS DOC
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B3.

Implementar:
- Estender `web/src/components/students/assessment-sidebar-card.tsx`:
  - Nova seção "Avaliação Presencial" no TOPO do card
  - Mostrar última sessão (IMC + %BG + classificação) se houver
  - Empty state se não houver sessões presenciais
  - Tap navega pra `/students/[id]/avaliacoes/[sessionId]/result`
  - Não regredir as seções existentes (Body Metrics, Forms, Pending)
- Loading states em todas as ações de rede (skeleton ou spinner)
- Error states user-friendly (toast no padrão do projeto)
- Empty states em listas vazias
- Acessibilidade: ARIA roles, keyboard navigation, focus visible
- Dark mode: testar todas as telas novas, sem hex hardcoded
- DELETE `web/src/app/_dev/builder-harness/page.tsx` (criado em B2)
- Verificar via grep que não sobrou referência: `grep -rn "builder-harness" web/`
- `MILESTONE-4-STATUS.md` final em `docs/specs/avaliacoes-presenciais/`

Verificações finais:
- TypeScript zero novos erros
- Smoke test manual completo (cenários da seção 9 da spec)
- Screenshots em dark mode + light mode pra cada tela nova
- AssessmentSidebarCard testado tanto com sessão presencial quanto sem

PARE e reporte:
- Lista completa de arquivos criados/alterados
- Screenshots dos cenários
- MILESTONE-4-STATUS.md gerado

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL + COMMIT + PUSH
═══════════════════════════════════════════════════════════════════════

Eu vou:
1. Revisar o código aqui no Cowork
2. Pedir pro user fazer smoke test no browser
3. Aprovar ou pedir ajustes

Quando aprovado, você executa commit + push no padrão dos milestones
anteriores (paths explícitos, mensagem comprehensiva, push pra
origin/main).

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- @dnd-kit/core não estar no projeto (não usar HTML5 dnd como fallback)
- Ambiguidade em algum tokens de design system
- Conflito entre AssessmentSidebarCard existente e a extensão proposta
- Necessidade de modificar `evaluation-preview` (NÃO deveria precisar)
- Performance de builder ruim com 20+ testes
- Recharts não estar disponível (improvável — provavelmente já está)
- Lib de toast diferente do esperado
- Tela de detalhe de sessão precisa permitir captura web (escopo: NÃO permite)

Se aparecer build/test failure não-relacionado ao M4, REPORTE mas não
arrume — fora do escopo.

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. BLOCO B1 → reportar → aguardar aprovação
3. BLOCO B2 → reportar (com screenshots) → aguardar aprovação
4. BLOCO B3 → reportar (com screen-recording) → aguardar aprovação
5. BLOCO B4 → reportar → aguardar aprovação
6. BLOCO C (validação manual + commit + push)

Cada PARADA é real. Não encadeie blocos sem confirmação minha.

COMECE PELO BLOCO A.
