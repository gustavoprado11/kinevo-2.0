# PROMPT — Milestone 7: Polish & Bug Fixes (Fase 2 — Tier 1)

> Cole este prompt no Claude Code. Fase 1 completa em main. PR #6 (Onda 2/3 do
> dashboard-aluno-redesign) também em main desde commit 236471e.
> Este é o primeiro milestone da Fase 2.

---

Você vai implementar o **Milestone 7 — Polish & Bug Fixes** do módulo de
Avaliações Presenciais do Kinevo. É o Tier 1 do roadmap de Fase 2: 4 quick
wins independentes que corrigem 1 bug confirmado em prod e reduzem atrito em
3 fluxos críticos.

**Sem feature nova. Sem refatoração estrutural. Apenas polish cirúrgico.**

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/FASE-2-AUDIT.md` (auditoria que motivou)
   - `docs/specs/avaliacoes-presenciais/07-milestone-7-polish.md` (spec deste milestone)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-1-STATUS.md` (RLS, RPCs)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-6-STATUS.md` (templates de sistema, tour)

2. Examine arquivos que serão alterados:
   - `web/src/app/forms/forms-dashboard-client.tsx` (já leu durante o audit)
   - `web/src/app/forms/templates/templates-client.tsx` (provavelmente)
   - `web/src/app/forms/templates/page.tsx` (server-side load)
   - `web/src/components/students/health-metrics-card.tsx` (vivo em main após PR #6)
   - `web/src/components/assessments/create-session-modal.tsx`
   - `web/src/app/students/[id]/student-detail-client.tsx` (consome HealthMetricsCard)

3. Confirme entendimento:
   - 4 quick wins independentes (QW1, QW2, QW3, QW4)
   - QW1 é bug em prod (templates assessments aparecem como "Pesquisa")
   - QW2 é pré-preencher aluno no modal de criar sessão
   - QW3 é contador correto no header de `/forms`
   - QW4 é limpar empty state com 3 CTAs duplicados
   - Sem migration, sem nova dep, sem mexer em engine M2 ou Edge Function

4. Se algo for ambíguo, **PARE e pergunte**. Não invente.

## Workflow

- **Sem branch.** Direto em main.
- **Sem `git commit` nem `git push` durante desenvolvimento.** Eu autorizo.
- **DIVIDIDO em 3 sub-blocos** (B1 → B2 → B3) com paradas obrigatórias.

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (read-only)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (limpo)
2. `git log --oneline -5` (último: `236471e Redesign do dashboard do aluno (3 ondas + fix UX) (#6)` ou similar)
3. `git branch --show-current` (deve ser `main`)
4. Estado atual da `forms-dashboard-client.tsx`:
   - Linhas do `CATEGORY_CONFIG` (procure por `anamnese`/`checkin`/`survey`)
   - Linhas do `<h1>Avaliações</h1>` e o badge de contador associado
   - Linhas do empty state da tab Presenciais (`filteredAssessments.length === 0`)
5. Estado atual da `templates-client.tsx`:
   - Como são renderizados os cards de template
   - Como vêm os dados (props server-side ou query client?)
6. Estado atual da `templates/page.tsx`:
   - Que dados carrega (questionCount, responseCount, sections, sessions?)
7. Estado atual da `health-metrics-card.tsx` (após PR #6):
   - Tem botão "+" ou similar para criar avaliação presencial?
   - Em qual handler está? Como navega?
8. Estado atual da `create-session-modal.tsx`:
   - Aceita prop opcional para aluno pré-selecionado?
   - Se não, onde fica o `<select student>`?
9. Estado atual da `student-detail-client.tsx`:
   - Como passa props para `HealthMetricsCard`?
   - Tem alguma lógica de "criar avaliação"?
10. Mobile equivalente — bug de categoria existe lá também?
    - `mobile/app/(trainer-tabs)/forms.tsx` — tem listagem similar de templates?
    - Se sim: registrar como follow-up no STATUS doc, não corrigir aqui

PARE e me reporte. Foco especial em:
- Se HealthMetricsCard tem o "+" da spec ou se moveu para outro lugar (afeta QW2)
- Se templates/page.tsx já carrega `sections.length` ou se vamos precisar adicionar
- Se mobile tem o mesmo bug

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — QW1 (categoria correta) + QW3 (contador contextual)
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

### QW1 — Categoria correta para assessments

Implementar:

1. Em `forms-dashboard-client.tsx`, estender `CATEGORY_CONFIG`:
   ```ts
   const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
     anamnese: { label: 'Anamnese', icon: ClipboardList, color: 'text-blue-600 dark:text-blue-400' },
     checkin: { label: 'Check-in', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
     survey: { label: 'Pesquisa', icon: MessageSquare, color: 'text-amber-600 dark:text-amber-400' },
     assessment: { label: 'Avaliação Presencial', icon: Activity, color: 'text-violet-600 dark:text-violet-400' },
   }
   ```
   (Use `Ruler` ou `Activity` — escolha o que mais combina visualmente. `Activity` é o que o HealthMetricsCard já usa.)

2. Em `templates-client.tsx`, encontrar o ponto que renderiza categoria/metadata e:
   - Aplicar o mesmo `CATEGORY_CONFIG` ou propagar
   - Para assessments: substituir "N perguntas" → "N seções", "M respostas" → "M sessões"

3. Se `templates/page.tsx` (server-side) não carrega `schema_json.sections.length` para assessments:
   - Estender a query para incluir esse campo
   - Se carregar `respostas count`: trocar por `sessions count` (JOIN com `assessment_sessions WHERE template_id`)
   - Cache de queries: garantir que count de sessions não estoura performance se trainer tem muitos

### QW3 — Contador contextual no header

Em `forms-dashboard-client.tsx:365` (h1 "Avaliações"), trocar:

```jsx
{submissions.length > 0 && (
  <span ...>{submissions.length}</span>
)}
```

por:

```jsx
{(() => {
  const count = activeTab === 'responses'
    ? submissions.length
    : assessmentSessions.filter(s => s.status !== 'cancelled').length
  return count > 0 ? (
    <span ...>{count}</span>
  ) : null
})()}
```

(Estilo idiomático ao código existente — pode usar `useMemo` se preferir.)

Verificações:
- `/forms/templates` mostra 5 templates de sistema com badge "Avaliação Presencial" violet, ícone `Activity` (ou Ruler), metadata "N seções · 0 sessões"
- `/forms/templates` mostra forms anamnese/checkin/survey inalterados
- `/forms` na tab Respostas mostra contador de submissions; na tab Presenciais mostra contador de sessions ativas
- TypeScript clean
- Tour `assessments_first_time` ainda funciona (não tocamos nos `data-onboarding`)

PARE e reporte com:
- Screenshots de `/forms/templates` (antes/depois se conseguir)
- Output de `tsc --noEmit` em web/
- Lista de arquivos alterados

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — QW2 (pré-preencher aluno no modal)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

### Mudanças

1. **`create-session-modal.tsx`**: aceitar prop opcional:
   ```ts
   interface CreateSessionModalProps {
     // ... props existentes
     lockedStudentId?: string  // se fornecido, força o aluno e desabilita o select
   }
   ```
   - Se `lockedStudentId` presente: pré-preenche, marca campo como `disabled` (visualmente cinza), com texto auxiliar tipo "Avaliação para [Nome]"
   - Se ausente: comportamento atual

2. **`forms-dashboard-client.tsx`**: ler query params na montagem:
   ```ts
   useEffect(() => {
     const createParam = searchParams.get('createAssessment')
     const studentParam = searchParams.get('studentId')
     if (createParam === '1') {
       setCreateSessionOpen(true)
       // O modal lê studentParam via prop separado — repassar
     }
   }, [searchParams])
   ```
   E passar `lockedStudentId={searchParams.get('studentId') ?? undefined}` para `<CreateSessionModal />`.

3. **`health-metrics-card.tsx`** (ou onde o `+` para criar avaliação vive após PR #6):
   - Achar o handler que navega para `/forms?tab=assessments`
   - Trocar para `/forms?tab=assessments&createAssessment=1&studentId=${studentId}`

4. **Bonus opcional** (se baratinho): mesmo padrão para `assignFormToStudents` se tiver um botão "Enviar formulário" no card. Mas se exigir refactor maior, **deixar para depois** e registrar como follow-up.

### Cenários a validar

- A. Trainer em `/students/[Marina]` → clica `+` da seção avaliação presencial → modal abre com Marina preenchida e disabled, foco em "Template"
- B. Trainer em `/forms?tab=assessments` → clica "Nova avaliação" do header → modal abre vazio (aluno selecionável normalmente, sem `lockedStudentId`)
- C. Limpa URL após fechar modal: `router.replace('/forms?tab=assessments')` para tirar os query params (não persistir entre navegações)
- D. Erro graceful se `studentId` no query param for inválido (não é aluno do trainer): fallback para modal vazio + console warn (não bloquear o trainer)

PARE e reporte com:
- Screenshots dos 2 cenários (A e B)
- Lista de arquivos alterados
- Confirmação que tour M6 ainda passa

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — QW4 (empty state) + status doc + commit
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

### QW4 — Empty state limpo

Em `forms-dashboard-client.tsx:742-775`, ramificar a renderização do empty state:

```tsx
{filteredAssessments.length === 0 ? (
  assessmentTemplates.length === 0 ? (
    /* Estado: 0 templates do trainer */
    <EmptyState
      icon={Plus}
      title="Comece criando um template"
      description="Use um template de sistema do Kinevo ou crie o seu para agendar avaliações."
      cta={{
        label: '+ Criar template de avaliação',
        onClick: () => router.push('/forms/templates/new?category=assessment'),
      }}
    />
  ) : (
    /* Estado: tem templates mas 0 sessões */
    <EmptyState
      icon={Activity}
      title="Nenhuma avaliação ainda"
      description="Use o botão 'Nova avaliação' acima para agendar a primeira sessão."
      // Sem CTA aqui — header já tem "Nova avaliação" primary
    />
  )
) : (
  /* Lista normal — mantém */
)}
```

(Pode inline em vez de criar componente `EmptyState` separado se for mais simples — mas mantenha as duas variantes claramente diferentes.)

**Cuidado:** quando o trainer tem 0 templates, o header também não deveria mostrar "Nova avaliação" porque não dá pra criar sem template. Esconder ou desabilitar esse botão quando `assessmentTemplates.length === 0`.

### Status doc

Crie `docs/specs/avaliacoes-presenciais/MILESTONE-7-STATUS.md`:

- Sumário B1+B2+B3
- Os 4 QWs entregues (com diff resumido)
- Bug fixed: categoria assessments
- Cenários de teste validados (8 da seção 7 da spec)
- Mobile: bug de categoria registrado como follow-up (se confirmado)
- Tour M6: confirmação de não-regressão
- Próximos passos sugeridos: M8 (Visual Coherence) após workshop
- "Tier 1 da Fase 2 COMPLETO"

### Commit + push

Direto em main, sem PR. Mensagem:

```
feat(assessments): M7 polish — categoria, modal pre-fill, contador, empty state

- QW1: fix bug — assessment templates appearing as "Pesquisa"
  CATEGORY_CONFIG now handles 'assessment' with violet badge + Activity icon
  Metadata: "N seções · M sessões" (was "N perguntas · M respostas")
- QW2: pre-fill student in CreateSessionModal when launched from /students/[id]
  Added lockedStudentId prop, query param threading via /forms?createAssessment=1&studentId=...
- QW3: header counter on /forms is now contextual to active tab
- QW4: empty state of Avaliações Presenciais tab no longer duplicates CTAs
  Differentiates "0 templates" vs "0 sessions" cases

Tier 1 da Fase 2 COMPLETO. Próximo: M8 (Visual Coherence) após workshop estratégico.

Co-authored-by: Claude <claude@anthropic.com>
```

PARE e reporte:
- Lista exaustiva de arquivos alterados
- TypeScript clean (`tsc --noEmit` em web/)
- Status doc gerado
- Hash do commit + output do push

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL + DEPLOY VERCEL
═══════════════════════════════════════════════════════════════════════

Eu vou:
1. Revisar código aqui antes do commit
2. Smoke test em prod após deploy automático Vercel (~2 min após push)
3. Se algo quebrar, fix-forward (ou revert se grave)

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- `templates/page.tsx` exige refactor não-trivial pra trazer `sections.length` ou `sessions count`
- `health-metrics-card.tsx` (PR #6) NÃO tem botão de criar avaliação (Onda 2/3 pode ter movido pra outro lugar — recalibrar QW2)
- Tour `assessments_first_time` quebra com a refatoração do empty state
- Mobile tem o mesmo bug E você acha que devemos corrigir junto (decisão minha)
- Performance: contar sessions por template em `templates/page.tsx` exige query custosa
- `useEffect` para abrir modal via query param duplica execução em StrictMode (React 18+)
- Conflito não previsto com algum trabalho do PR #6

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. BLOCO B1 (QW1 + QW3) → reportar → aguardar aprovação
3. BLOCO B2 (QW2) → reportar → aguardar aprovação
4. BLOCO B3 (QW4 + status + commit) → reportar
5. BLOCO C (eu valido em prod, autorizo qualquer follow-up se necessário)

NÃO commit, NÃO push até autorização explícita.

COMECE PELO BLOCO A.
