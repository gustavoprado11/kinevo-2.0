# PROMPT — Milestone 8: Reestruturação Avaliações + Formulários

> Cole este prompt no Claude Code. M7 (polish) em prod (commit 013e5aa).
> Decisões estratégicas ratificadas em `FASE-2-DECISIONS.md`.
> Este é o maior milestone da Fase 2 — 3-4 semanas, dividido em 4 sub-blocos.

---

Você vai implementar o **Milestone 8 — Reestruturação Avaliações + Formulários**.
Cascade completa das decisões D1+D2+D3 do workshop estratégico:

- D1: 2 itens distintos no sidebar (Formulários + Avaliações), rotas separadas
- D2: `<BuilderShell>` compartilhado, canvas distintos
- D3: `<StudentPicker>` + `<TemplatePicker>` + `<ModalShell>` compartilhados, modais distintos

⚠️ **Risco:** mexe em IA do produto que trainers já usam. Cada sub-bloco
tem critério de saída claro. **Não acumule risco entre sub-blocos.**

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/FASE-2-AUDIT.md`
   - `docs/specs/avaliacoes-presenciais/FASE-2-DECISIONS.md` (workshop)
   - `docs/specs/avaliacoes-presenciais/08-milestone-8-restructure.md` (spec)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-7-STATUS.md` (estado herdado)

2. Examine arquivos existentes que serão alterados ou criados:
   - `web/src/app/forms/forms-dashboard-client.tsx` (vai partir em 2)
   - `web/src/app/forms/templates/templates-client.tsx` (filtra por tipo)
   - `web/src/app/forms/templates/new/builder-client.tsx` (form builder)
   - `web/src/app/forms/templates/new/assessment-builder-page-client.tsx` (assessment builder)
   - `web/src/components/forms/assign-form-modal.tsx`
   - `web/src/components/assessments/create-session-modal.tsx`
   - `web/src/components/students/health-metrics-card.tsx`
   - `web/src/components/onboarding/tours/tour-definitions.ts`
   - `web/src/components/layout/app-layout.tsx` (sidebar)
   - `next.config.ts` (redirects)

3. Confirme entendimento:
   - 2 rotas: `/forms` (forms-only) + `/avaliacoes` (assessments-only)
   - HTTP 301 de `/forms?tab=assessments` → `/avaliacoes`
   - `<BuilderShell>` shared component + 2 canvas distintos
   - `<StudentPicker>` + `<TemplatePicker>` + `<ModalShell>` em `web/src/components/shared/`
   - Banner in-app de migração persistido em `trainer.onboarding_state.fase2_migration_seen`
   - Tours separados, sem competição
   - Sem mudança de schema DB

4. Se algo for ambíguo, **PARE e pergunte**. Não invente.

## Workflow

- **Sem branch.** Direto em main.
- **Sem `git commit` nem `git push` durante desenvolvimento.** Eu autorizo.
- **DIVIDIDO em 4 sub-blocos** (B1 → B2 → B3 → B4) com paradas obrigatórias.
- **Cada sub-bloco vira commit separado** após meu OK — não acumular dias de mudança em 1 commit gigante.

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO + PLANEJAMENTO (read-only, ~1 dia)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (limpo)
2. `git log --oneline -5` (último: M7 commit `013e5aa`)
3. Estado atual da sidebar:
   - `web/src/components/layout/app-layout.tsx` ou similar — onde estão definidos os items?
   - Mostra estrutura atual com pseudo-código
4. Estado do `forms-dashboard-client.tsx`:
   - Já leu durante M7. Aqui estima quanto código é "puramente forms" vs "puramente assessments" vs "compartilhado"
5. Estado dos builders:
   - `forms/templates/new` (form) — quais arquivos?
   - `forms/templates/new?category=assessment` (assessment) — quais?
   - Quanto cada um repete em header/save/exit?
6. Estado dos modais:
   - `AssignFormModal` — props, hooks, layout
   - `CreateSessionModal` — props, hooks, layout
   - O que se repete?
7. Tours atuais:
   - `tour-definitions.ts` — entradas existentes (`forms`, `assessments_first_time`, etc)
   - Selectors `data-onboarding` no DOM atual
8. `next.config.ts`:
   - Há `redirects()` definidos? Como adicionar nossos?
9. `trainer.onboarding_state` no DB:
   - Estrutura atual (jsonb columns)
   - Se já tem campos pra tour completion (provável)
10. Inventory de links cross-cutting que precisam atualizar:
    - `grep -rln '/forms?tab=assessments' web/` → todos os links que precisam virar `/avaliacoes/...`
    - `grep -rln '/forms/templates/new?category=assessment'` → todos viram `/avaliacoes/templates/new`

PARE e me reporte com:
- Mapa "o que é forms-only / assessments-only / shared" no código atual
- Plano concreto de extração: quais novos arquivos e quais existentes mudam
- Inventory de links cross-cutting (item 10)
- Confirmação que tours atuais foram completados pela maioria dos trainers (decide se migration é necessária ou se reset é aceitável)
- Qualquer surpresa que recalibra escopo de algum sub-bloco

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — Nova IA + rotas separadas + redirects + banner in-app (~1 sem)
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

### Mudanças

1. **Sidebar**: adicionar item "Formulários" separado do "Avaliações". Manter ordem:
   - Dashboard, Alunos, Agenda, **Formulários**, **Avaliações**, Financeiro, Bibliotecas, Configurações
   - Ícones: `FileText` pra Formulários, `Activity` pra Avaliações
   - Cores: forms = azul, avaliações = violet

2. **Rota `/forms` redesenhada** (forms-only):
   - Renomear `forms-dashboard-client.tsx` se ficar mais claro, ou criar `forms-only-client.tsx`
   - Header: "Formulários" + contador + CTAs (Enviar para aluno + Novo template)
   - Sem tabs internas
   - Conteúdo da antiga tab "Respostas" sobe pra raiz

3. **Rota nova `/avaliacoes`**:
   - Criar `web/src/app/avaliacoes/page.tsx` (server component) + `avaliacoes-client.tsx`
   - Reusa server-side data loading do `/forms` mas só pega assessments
   - Header: "Avaliações" + contador + CTAs (Nova avaliação + Novo template de avaliação)
   - Sem tabs internas
   - Conteúdo da antiga tab "Avaliações Presenciais" sobe pra raiz

4. **Redirects** em `next.config.ts`:
   ```ts
   async redirects() {
     return [
       { source: '/forms', has: [{ type: 'query', key: 'tab', value: 'assessments' }], destination: '/avaliacoes', permanent: true },
       { source: '/forms/templates/new', has: [{ type: 'query', key: 'category', value: 'assessment' }], destination: '/avaliacoes/templates/new', permanent: true },
     ]
   }
   ```

5. **HealthMetricsCard**: atualizar links de `/forms?tab=assessments&...` → `/avaliacoes/...`

6. **Banner in-app de migração**:
   - Componente `<MigrationBanner>` que aparece em qualquer rota se `trainer.onboarding_state.fase2_migration_seen !== true`
   - Texto: "Renomeamos para **Formulários** e **Avaliações**. Os 2 estão no menu lateral."
   - Botão "Entendi" → action `mark-fase2-migration-seen.ts` → grava em `onboarding_state` → debounce 800ms (pattern existente)
   - Aparece no top da viewport, não no sidebar

### Critério de saída B1

- Trainer abre `/forms` → vê só forms, sem tab "Avaliações Presenciais"
- Trainer abre `/avaliacoes` → vê só assessments
- Bookmark antigo `/forms?tab=assessments` redirecciona corretamente (HTTP 301)
- Sidebar mostra 2 items
- Banner aparece na primeira visita pós-deploy + "Entendi" persiste

PARE e reporte com:
- Lista de arquivos criados + alterados
- Screenshots de `/forms` e `/avaliacoes` (Caminho rápido: você sobe dev local; eu valido via Chrome MCP em localhost OU em prod após você commitar pra branch dedicada — discutir)
- Output `tsc --noEmit` em web/
- Output `next build` em web/ (verifica build OK)

⚠️ **Não commitar B1 em main ainda — espera B2/B3/B4 acumularem como série de commits relacionados.** Ou commitamos B1 separado? Decidir comigo no reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — BuilderShell + refactor builders + listings split (~1 sem)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

### Mudanças

1. **`<BuilderShell>` shared component** em `web/src/components/shared/builder-shell.tsx`:
   - Props: `title`, `onSave`, `onExit`, `isDirty`, `isSaving`, `children`
   - Renderiza: header (← Voltar / título / status / Salvar) + content slot + modal "Sair sem salvar?"
   - Auto-save em `localStorage` via key fornecida via prop `draftKey`

2. **Refator `/forms/templates/new`**: embrulhar em `<BuilderShell>` com canvas wizard atual

3. **Criar `/avaliacoes/templates/new`**: embrulhar em `<BuilderShell>` com canvas drag-drop atual

4. **`/forms/templates`**: lista filtrada pra forms only

5. **`/avaliacoes/templates`**: lista filtrada pra assessments only

6. **`<TemplatesList>` shared component** (opcional): se a estrutura de cards for idêntica, extrai. Senão, deixa cada um com sua

### Critério de saída B2

- Ambos os builders têm header idêntico
- Save/exit funciona com modal de confirmação consistente
- Drafts antigos do localStorage migrados (não perdidos)
- `/forms/templates` mostra só forms
- `/avaliacoes/templates` mostra só assessments

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — StudentPicker + TemplatePicker + ModalShell (~1 sem)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

### Mudanças

1. **`<ModalShell>`** em `web/src/components/shared/modal-shell.tsx`:
   - Props: `open`, `onClose`, `title`, `description?`, `children`, `footer`
   - Header com close button, footer com slot
   - Esc + click outside = close
   - Loading state via prop

2. **`<StudentPicker>`** em `web/src/components/shared/student-picker.tsx`:
   - Props: `mode: 'single' | 'multi'`, `value`, `onChange`, `lockedStudentId?`
   - Search integrado, lista filtrável
   - Renderiza apropriadamente conforme mode

3. **`<TemplatePicker>`** em `web/src/components/shared/template-picker.tsx`:
   - Props: `category: 'form' | 'assessment'`, `value`, `onChange`
   - Filtra por categoria, mostra badges corretos

4. **Refator `AssignFormModal`**: usa `<ModalShell>` + `<StudentPicker mode='multi'>` + `<TemplatePicker category='form'>`

5. **Refator `CreateSessionModal`**: usa `<ModalShell>` + `<StudentPicker mode='single' lockedStudentId={presetStudentId}>` + `<TemplatePicker category='assessment'>` + campos sex/age/scheduled_at específicos

### Critério de saída B3

- Modais visualmente coerentes
- Cenários M7 não regrediram (preset student funciona, categoria correta, contador, empty state)
- Components testáveis isoladamente

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B4 — Tours reescritos + status doc + commit (~1 sem)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B3.

### Mudanças

1. **`tour-definitions.ts`**: split em 2 entries
   - `tour_forms_first_time` — só dispara em `/forms`
   - `tour_assessments_first_time` — só dispara em `/avaliacoes`
   - Selectors `data-onboarding` atualizados pra apontar pros novos elementos

2. **Tour migration**: detectar trainers que completaram tour `forms` antigo → marcar `tour_forms_first_time` E `tour_assessments_first_time` como completed pra eles. Não mostrar tours novos pra usuários existentes que já completaram o tour antigo.

3. **MILESTONE-8-STATUS.md**: cobertura completa
   - Sumário B1-B4
   - Cascade D1+D2+D3 entregue
   - Migration in-app cobrindo trainers existentes
   - Performance: bundle size verificação
   - Cenários de teste validados (10 da seção 7 da spec)
   - Tour migration cobrindo trainers existentes
   - "M8 COMPLETO. Próximo: M9 (Onboarding Flow Guiado)"

4. **Commit + push**:
   ```
   feat(assessments): M8 reestruturação Avaliações + Formulários

   - D1 cascade: 2 sidebar items (Formulários + Avaliações), rotas separadas
   - D2 cascade: <BuilderShell> compartilhado, canvases distintos
   - D3 cascade: <StudentPicker>/<TemplatePicker>/<ModalShell> shared, modais distintos
   - HTTP 301 redirects /forms?tab=assessments → /avaliacoes
   - Banner in-app de migração + tour rewrite (sem competição)
   - HealthMetricsCard atualiza links pra novas rotas

   M8 COMPLETO. Próximo: M9 (Onboarding Flow Guiado).

   Co-authored-by: Claude <claude@anthropic.com>
   ```

PARE e reporte com lista de arquivos finais.

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL + DEPLOY VERCEL
═══════════════════════════════════════════════════════════════════════

Eu vou:
1. Revisar código aqui antes do commit final
2. Smoke test em prod via Chrome MCP (10 cenários da seção 7 da spec)
3. Se algo quebrar, fix-forward (ou revert se grave)
4. Marcar M8 como completed e iniciar planning M9

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- Estrutura atual de `forms-dashboard-client.tsx` é mais entrelaçada que o esperado (separação por categoria não é trivial)
- Sidebar está num componente que tem state global ou context que não permite adicionar item facilmente
- `next.config.ts` redirects não cobrem o caso de query params (testar antes)
- Tour migration: muitos trainers ainda não completaram tour antigo — decidir se reset ou se preserva comportamento
- BuilderShell genérico demais e quebra UX em algum builder
- Performance regressão crítica (bundle size +30% ou mais)
- LocalStorage drafts antigos não conseguem ler do novo formato

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. BLOCO B1 → reportar → aguardar aprovação (commit ou continuar?)
3. BLOCO B2 → reportar → aguardar aprovação
4. BLOCO B3 → reportar → aguardar aprovação
5. BLOCO B4 → reportar → aguardar aprovação
6. BLOCO C (eu valido em prod, autorizo cleanup)

NÃO commit, NÃO push até autorização explícita.

COMECE PELO BLOCO A.
