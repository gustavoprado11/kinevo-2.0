# Onda 3 — Mudanças Estruturais do Dashboard do Aluno

Pré-requisito: Ondas 1 e 2 commitadas na branch `dashboard-aluno-redesign` e walk-through manual de cada uma feito. **Ainda não houve merge para `main`** — esta é a última onda; PR única abre quando todas as 3 estiverem prontas. Ler `dashboard-aluno-00-visao-geral.md` antes.

## 1. Objetivo & escopo

As três mudanças mais profundas: criar o `SmartBanner`, fazer a engine de insights deduplicar por `insight_key`, e reduzir a `StudentStatusBar` ao mínimo (vira "quase invisível" quando o aluno está saudável, já que o banner cobre as urgências).

**No escopo:**

1. **`SmartBanner` novo**: componente que, dado o contexto do aluno, escolhe **um** banner dominante e propõe a ação correspondente.
2. **Engine de insights com `upsertInsightByKey`**: antes de criar um novo insight, procura insight ativo da mesma chave nos últimos 7 dias e atualiza no lugar de inserir.
3. **`StudentStatusBar` enxuta**: passa a mostrar apenas o stat de "meta atingida 🎉" (quando aplicável) e o stat positivo de "Esta semana N/M". Todos os chips de alerta (inatividade, adesão em queda, programa expirando, financeiro, avaliações pendentes) migram para o `SmartBanner`.
4. **Atalhos de teclado expandidos**: `M` envia mensagem, `L` ajusta carga (quando o banner sugere), `P` planeja próximo ciclo. Reusar `KeyboardShortcuts` existente.
5. **Telemetria**: eventos `smart_banner_view` e `smart_banner_action` no padrão atual do projeto.

**Fora do escopo:**

- Migração de schema. A coluna `insight_key` em `assistant_insights` **já existe**. Não criar nova coluna.
- Mudanças visuais nos cards já refatorados nas Ondas 1 e 2.
- Refatoração do `StudentInsightsCard` além do necessário para deduplicação (visual já está bom).

## 2. Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `web/src/components/students/smart-banner.tsx` (novo) | Novo componente. Recebe contexto do aluno; escolhe e renderiza UM banner. |
| `web/src/components/students/smart-banner-rules.ts` (novo) | Lógica pura de prioridade (`pickBanner(ctx)`). Testável sem React. |
| `web/src/app/students/[id]/student-detail-client.tsx` | Renderiza `<SmartBanner>` logo abaixo do header (substituindo o uso antigo da `StudentStatusBar` para alertas; status bar passa a ser "modo enxuto"). |
| `web/src/components/students/student-status-bar.tsx` | Reduzir: manter só os stats `0/N esta semana` e `há X dias último treino` em modo neutro. Toda a lógica de chips de alerta sai daqui — vira responsabilidade do `SmartBanner`. |
| `web/src/components/students/student-status-bar.tsx` (props) | Adicionar prop `mode?: 'compact' \| 'full'`. Default `compact` na nova chamada. Manter compatibilidade caso outros lugares usem. |
| `web/src/actions/insights.ts` | Adicionar `upsertInsightByKey(payload)`. Ajustar funções de geração para usar a nova helper em vez de `insert` direto. |
| `web/src/lib/insights/generate.ts` (verificar caminho real) ou onde a engine roda hoje | Trocar `supabase.from('assistant_insights').insert(...)` por chamada via `upsertInsightByKey`. |
| `web/src/components/students/keyboard-shortcuts.tsx` | Adicionar atalhos `M`, `L`, `P` quando o banner está visível. |
| `web/src/lib/analytics/track.ts` (se existir) ou padrão equivalente | Eventos `smart_banner_view`, `smart_banner_action`. Se não houver infra, deixar TODO bem visível e seguir padrão existente. |
| `web/src/components/students/__tests__/smart-banner.test.tsx` (novo) | Testes do componente. |
| `web/src/components/students/__tests__/smart-banner-rules.test.ts` (novo) | Testes unitários da lógica de priorização. |
| `web/src/actions/__tests__/insights-upsert.test.ts` (novo) | Teste da nova helper de upsert (com mocks de Supabase já existentes). |

## 3. Passos de execução

### Passo 1 — Lógica pura de priorização

1. Crie `web/src/components/students/smart-banner-rules.ts` com:
   ```ts
   export type BannerLevel = 'critical' | 'high' | 'info'
   export type BannerKey =
     | 'churn_risk' | 'program_expired' | 'financial_overdue'
     | 'progression_ready' | 'reassessment_due'
     | 'cycle_ending' | 'first_session_pending' | 'streak_celebration'

   export interface BannerCandidate {
     key: BannerKey
     level: BannerLevel
     weight: number
     title: string
     detail: string
     primary: { label: string; actionId: string }
     secondary?: { label: string; actionId: string }
   }

   export interface BannerContext {
     studentName: string
     studentPhone: string | null
     activeProgram: { status: string; started_at: string | null; duration_weeks: number | null } | null
     historySummary: { totalSessions: number; lastSessionDate: string | null; completedThisWeek: number; expectedPerWeek: number; streak: number }
     recentSessions: Array<{ rpe: number | null }>
     tonnageMap: Record<string, { percentChange: number | null }>
     weeklyAdherence: { week: number | string; rate: number }[]
     financialStatus: string
     hasPendingForms: boolean
     daysUntilReassessment: number | null
   }

   export function pickBanner(ctx: BannerContext): BannerCandidate | null {
     // implementação abaixo
   }
   ```
2. Implemente `pickBanner` seguindo a ordem do docx (seção 5.1):
   - **CRITICAL** weight 100: `churn_risk` — `daysSinceLastSession >= 7 && avgAdherenceLast2Weeks < 50` e tem programa ativo.
   - **CRITICAL** weight 90: `program_expired` — `activeProgram?.status === 'expired'`.
   - **CRITICAL** weight 80: `financial_overdue` — `['expired','past_due','overdue'].includes(financialStatus)`.
   - **HIGH** weight 70: `progression_ready` — `recentSessions.length >= 3` e `avgRpe ∈ [7, 8.5]` e `avgTonnageChange > 0`.
   - **HIGH** weight 60: `reassessment_due` — `daysUntilReassessment != null && daysUntilReassessment <= 7`.
   - **HIGH** weight 55: `first_session_pending` — `activeProgram && totalSessions === 0 && lastSessionDate === null`.
   - **INFO** weight 50: `cycle_ending` — `daysToProgramEnd <= 7 && daysToProgramEnd > 0`.
   - **INFO** weight 30: `streak_celebration` — `streak >= 3`.
3. Funções helper (`daysSinceLastSession`, `avgRate`, `avgRpe`, `daysToProgramEnd`) ficam no mesmo arquivo, exportadas para teste.
4. Retorno: o candidato com menor `level` ordinal e maior `weight`. Se a lista estiver vazia, retornar `null`.

**Critério de aceitação:** dado um `BannerContext` com `lastSessionDate = -20d` e adesão 30 % nas últimas 2 semanas, `pickBanner` retorna `churn_risk` como crítico. Cenários de teste cobrem cada uma das 8 chaves + caso `null`.

### Passo 2 — Componente `SmartBanner`

1. Crie `smart-banner.tsx`. Recebe os mesmos dados que `StudentStatusBar` recebe hoje + `daysUntilReassessment` (calcular em `student-detail-client.tsx`) + um mapa de callbacks `onAction(actionId)`.
2. Internamente, chama `pickBanner(ctx)`. Se `null`, retorna `null` (banner some quando aluno está saudável).
3. Estilo do banner segue a Figura 3 do docx — três variantes:
   - `critical`: bg `bg-amber-50` (amarelo de alerta), borda `border-amber-200`, ícone laranja num quadrado `bg-amber-500`.
   - `high`: bg `bg-emerald-50`, borda `border-emerald-200`, ícone estrela num quadrado `bg-emerald-500`.
   - `info`: bg `bg-blue-50`, borda `border-blue-200`, ícone "i" num quadrado `bg-blue-500`.
4. Botões: primário em sólido com a cor do banner; secundário em outline.
5. Ao montar, dispara `track('smart_banner_view', { student_id, banner_key, banner_level })`. Ao clicar primário, dispara `track('smart_banner_action', { ..., action: 'primary' })` e chama o handler.
6. **Critério de aceitação:** com `pickBanner` retornando `churn_risk`, o banner aparece em estilo crítico com botão "Enviar mensagem" como primário e "WhatsApp" como secundário (se `studentPhone` truthy).

### Passo 3 — Plugar no `student-detail-client.tsx`

1. Calcule `daysUntilReassessment` a partir de `formSchedules[0]?.next_due_at` (ou da regra de "reavaliação periódica" que já está no `AssessmentSidebarCard`/`HealthMetricsCard`).
2. Renderize `<SmartBanner>` logo abaixo do header (e abaixo do `<StudentStatusBar mode="compact">`).
3. Implemente o handler `onAction(actionId)`:
   - `send_message` → `handleOpenMessages()`.
   - `open_whatsapp` → `window.open(\`https://wa.me/...\`)`.
   - `extend_program` → `handleExtendProgram()`.
   - `complete_program` → `handleCompleteProgram()`.
   - `assign_program` → `handleAssignProgram()`.
   - `adjust_load` → focar/scroll para a seção de programa (ID `student-actions`).
   - `send_reassessment` → focar `HealthMetricsCard` + abrir o dropdown de envio de form (ID `assessments`).
   - `view_finance` → `router.push('/financial?student=...')`.
4. **Critério de aceitação:** clicar no botão primário do banner executa a ação corretamente, sem efeito colateral em outros componentes.

### Passo 4 — Reduzir `StudentStatusBar`

1. Adicione prop `mode?: 'compact' | 'full'` (default `full` para retrocompatibilidade).
2. Em modo `compact`:
   - Renderiza apenas os 2 stats operacionais (`X/N esta semana`, `há X dias último treino`).
   - **Não** renderiza chips de alerta nem CTA de inatividade.
3. Em `student-detail-client.tsx`, troque para `<StudentStatusBar mode="compact" ... />`.
4. **Critério de aceitação:** quando o aluno tem alerta de inatividade, ele aparece **apenas** no `SmartBanner` (não no header). Stats operacionais continuam no header.

**Armadilha:** outros lugares no projeto podem usar `StudentStatusBar` em modo `full`. Verificar com `rg "StudentStatusBar" web/`. Se houver, manter o uso antigo (modo `full` é o default).

### Passo 5 — `upsertInsightByKey` na engine

1. Em `web/src/actions/insights.ts`, adicione:
   ```ts
   export async function upsertInsightByKey(payload: {
     trainerId: string
     studentId: string
     category: 'alert' | 'progression' | 'suggestion' | 'summary'
     priority: 'critical' | 'high' | 'medium' | 'low'
     insightKey: string
     title: string
     body: string
     actionType?: string | null
     actionMetadata?: Record<string, any>
     source: 'rules' | 'llm' | 'trainer'
   }) {
     const supabase = await createClient()
     const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

     const { data: existing, error: findErr } = await supabase
       .from('assistant_insights')
       .select('id, status')
       .eq('trainer_id', payload.trainerId)
       .eq('student_id', payload.studentId)
       .eq('insight_key', payload.insightKey)
       .gte('created_at', sevenDaysAgo)
       .neq('status', 'dismissed')
       .order('created_at', { ascending: false })
       .limit(1)
       .maybeSingle()

     if (findErr) return { success: false, error: findErr.message }

     if (existing) {
       const { error } = await supabase
         .from('assistant_insights')
         .update({
           title: payload.title,
           body: payload.body,
           priority: payload.priority,
           action_type: payload.actionType ?? null,
           action_metadata: payload.actionMetadata ?? {},
           // mantém status: 'new' permanece 'new', 'read' permanece 'read'
         })
         .eq('id', existing.id)
       return { success: !error, error: error?.message }
     }

     const { error } = await supabase
       .from('assistant_insights')
       .insert({ ...payload })  // converter camelCase para snake_case conforme schema
     return { success: !error, error: error?.message }
   }
   ```
2. Localize todos os pontos onde a engine de geração de insights faz `INSERT` em `assistant_insights`. Substitua por chamada à nova helper.
3. **Critério de aceitação:** rodando a engine duas vezes para o mesmo aluno + mesma `insight_key` dentro de 7 dias, o segundo run **atualiza** o registro em vez de criar um novo. Após 8+ dias, cria novo.

**Armadilha:** schema usa snake_case (`student_id`, `insight_key`, `action_type`). Garanta a conversão.

### Passo 6 — Atalhos de teclado

1. Em `keyboard-shortcuts.tsx`, adicione 3 atalhos novos quando há um `SmartBanner` visível:
   - `M` → ação `send_message`.
   - `L` → ação `adjust_load`.
   - `P` → ação `assign_program` (planejar próximo).
2. O componente recebe via prop `bannerActions?: { send_message?: () => void; adjust_load?: () => void; assign_program?: () => void }`.
3. **Critério de aceitação:** focado fora de inputs, pressionar `M` abre a thread de mensagens; `L` foca o card do programa ativo; `P` abre o modal de atribuir programa.

### Passo 7 — Telemetria

1. Verifique se há infra de tracking. `rg "track\(" web/src/lib`.
2. Se sim, use o helper existente. Se não, crie `web/src/lib/analytics/track.ts` com um stub:
   ```ts
   export function track(event: string, props: Record<string, any>) {
     if (typeof window === 'undefined') return
     // TODO: ligar com PostHog/GA/etc — Onda 3 fica com stub.
     console.debug('[track]', event, props)
   }
   ```
3. Eventos esperados: `smart_banner_view`, `smart_banner_action`, `smart_banner_dismiss` (caso adicionemos um `Ignorar` no futuro).

## 4. Testes obrigatórios

- `smart-banner-rules.test.ts` (novo, unitário puro)
  - cada uma das 8 chaves dispara no contexto correto.
  - prioridade respeitada (critical > high > info; weight desempata dentro do level).
  - retorna `null` para aluno saudável.

- `smart-banner.test.tsx` (novo)
  - renderiza variante crítica para `churn_risk`.
  - renderiza variante info para `cycle_ending`.
  - dispara `onAction('send_message')` ao clicar no botão primário.
  - chama `track('smart_banner_view', ...)` no mount.
  - retorna `null` quando `pickBanner` retorna `null`.

- `insights-upsert.test.ts` (novo)
  - mock de Supabase: cria insight novo quando não há existente.
  - atualiza insight quando há um da mesma `insight_key` <7d e `status != dismissed`.
  - cria novo quando existente é `dismissed`.

- `student-status-bar.test.tsx` (existente, ajustar)
  - em modo `compact`, **não** renderiza chips de alerta.
  - em modo `full` (default), comportamento idêntico ao atual.

## 5. Checklist final

- [ ] `pnpm tsc --noEmit` verde.
- [ ] `pnpm test` verde.
- [ ] `pnpm lint` verde.
- [ ] Walk-through manual:
  - aluno com 20+ dias sem treinar → `SmartBanner` crítico aparece com "Enviar mensagem".
  - aluno saudável → banner não aparece; status bar mostra apenas stats.
  - rodando engine de insights duas vezes seguidas, número de registros não cresce 2× para a mesma chave.
  - atalhos M/L/P funcionam quando banner está visível.
- [ ] Log em `docs/specs/logs/dashboard-aluno-onda-3.md`.

## 6. Armadilhas conhecidas

- **`pickBanner` é pura** — não fazer fetch dentro dela. Todos os dados precisam vir como argumento.
- **`avgRpe`** considera só sessões com `rpe != null && rpe > 0`. Cuidado com NaN se o array estiver vazio.
- **`daysUntilReassessment`** é nullable; tratar `null` como "sem reavaliação configurada" (não vira banner).
- **`StudentStatusBar` em `mode='compact'`** ainda precisa decidir se renderiza algo quando não há programa ativo. Decisão: nesse caso não renderiza nada (retorna `null`).
- **`upsertInsightByKey`** assume que `insight_key` é um identificador estável (mesma string para o mesmo tipo de evento). Se a engine atual gera `insight_key` aleatórias ou com timestamps, **isso precisa ser ajustado primeiro** — caso encontre, pare e reporte antes de prosseguir.
- **`tonnageMap`** vem indexada por `session.id`. O cálculo de `avgTonnageChange` para `progression_ready` deve usar apenas as últimas 3 sessões (`recentSessions.slice(0, 3).map(s => tonnageMap[s.id]?.percentChange).filter(...)`). Cuidado com vazios.
- **Integração com Onda 2**: `HealthMetricsCard` exibe banner amarelo de "Reavaliação pendente" e o `SmartBanner` também pode disparar `reassessment_due`. **Não duplicar visualmente.** Quando o `SmartBanner` exibe `reassessment_due`, o `HealthMetricsCard` esconde seu próprio banner amarelo (usar prop `hideReassessmentBanner` ou ler estado compartilhado).

## 7. Definição de pronto

- Checklist da seção 5 marcado.
- PR aberta apontando para `dashboard-aluno-03-onda-3-estruturais.md`.
- Log de execução commitado.
- Nenhuma invariante da seção 3 do `00-visao-geral` violada.
- Componente `AssessmentSidebarCard` (deprecated na Onda 2) pode ser deletado se não houver mais imports — verificar com `rg "AssessmentSidebarCard"` e remover no fim desta onda.
