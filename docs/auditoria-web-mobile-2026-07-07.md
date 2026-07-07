# Auditoria Web + Mobile — 07/jul/2026

**Escopo:** funcionamento dos dois sistemas (web Next.js + mobile Expo/RN), working tree incluído (feature consultoria IA), banco de produção (advisors, policies, crons, webhooks), runtime do Vercel.
**Método:** checks objetivos (tsc/lint/build/testes) + 5 frentes de investigação paralela (working tree, server actions/tenancy, webhooks+assistente+builder, mobile, infra/consistência) + verificação ao vivo em prod (Supabase MCP + Vercel).
**Base:** HEAD `38a7b66` + working tree (consultoria IA).

---

## 1. Estado geral

| Check | Resultado |
|---|---|
| Typecheck web (`tsc --noEmit`) | ✅ limpo |
| Typecheck mobile | ✅ limpo |
| Build de produção web (`next build`) | ✅ passa |
| Testes web (vitest) | ✅ 1384 passam (eram 5 falhando — corrigido, ver F2) |
| Testes mobile | ✅ 374 passam |
| Testes shared | ✅ 304 passam |
| Lint web | ⚠️ 548 erros `no-explicit-any` (débito antigo, não regressão) |
| pg_cron (7 dias) | ✅ 100% sucesso (7 jobs) |
| Webhooks Stripe | ✅ fluindo (último evento 05/jul) |
| Vercel runtime errors (7 dias) | ⚠️ só o cron orphan-signups (corrigido, F1) + ruído benigno de refresh token |
| Advisors Supabase | ✅ zero ERROR (107 WARN seg. / 349 WARN perf. — ver §4) |

Verificações ao vivo que **fecharam pendências da memória**:
- Resíduo RLS do Estúdios (`program_templates_org_write`): **já dropado** (migration 20260702215712). Policies `%org%` restantes estão corretamente escopadas.
- Migration 224 (revoke anon): as RPCs sensíveis estão fechadas (`delete_student_account`, `block_overdue_students`, `cleanup_stale_sessions` → anon = false). Os 24 helpers/triggers que o advisor aponta como anon-executáveis são **design documentado** no header da 224 (revogar quebraria login/página pública) — sem ação.
- Prova por evento do webhook Asaas (R$588): **ainda pendente** — zero transações Asaas nos últimos 12 dias. Nenhum erro; apenas nenhum pagamento orgânico chegou.

---

## 2. FIXES APLICADOS (working tree — nada commitado, conforme workflow)

### Web

**F1 — CRÍTICO · Cron `cleanup-orphan-signups` quebrado há 2 meses + lógica destrutiva latente**
`web/src/app/api/cron/cleanup-orphan-signups/route.ts`
- O cron falhava 100% desde 05/mai (PGRST106: PostgREST não expõe o schema `auth`, nem com service role). Reescrito para a Admin API do GoTrue (`auth.admin.listUsers` paginado, newest-first).
- **Mais grave:** o critério de órfão só checava `trainers` + `subscriptions` — alunos autenticam sem linha em `trainers`, então o cron alvejaria **51 contas, ~41 de alunos reais** (medido em prod) se algum dia tivesse funcionado. Adicionado check de `students`.
- Terceiro bug latente: erro nos lookups de vínculo era ignorado (`data || []`) → um erro na query de trainers faria TODAS as contas parecerem órfãs → deleção em massa. Agora fail-closed (aborta a run com 500).
- Impacto acumulado do cron parado: só 10 órfãos reais em prod (as defesas de front seguraram os bots).

**F2 — HIGH · `hasOrgCoreAccess` podia derrubar o caminho de auth**
`web/src/lib/studio/org-access.ts`
- Exceção de infra na consulta de org propagava para `get-trainer.ts` (caminho crítico de auth), `assertCanCreateStudent` e `assertCanDowngradeToFree`. Agora never-throw (fail-safe para fluxo solo). Destravou os 5 testes que falhavam em `student-cap.test.ts`.

**F3 — HIGH · Arquivar aluno não cancelava recorrência Asaas**
`web/src/actions/financial/archive-student-core.ts`
- O loop de cancelamento de contratos só falava com o provedor no caso Stripe; contrato `asaas_auto_recurring` era marcado `canceled` no banco mas a assinatura na Asaas continuava **cobrando o ex-aluno todo ciclo**. Adicionado `cancelAsaasRecurring` (best-effort, mesmo padrão do Stripe no mesmo loop). Cobre a action web E a tool MCP `kinevo_archive_student`.

**F4 — MEDIUM · Read-guard do assistente envenenava o fallback de modelo**
`web/src/lib/assistant/command-engine.ts`
- O `Set` de dedup de leituras era compartilhado entre a tentativa do modelo de build e o re-run de fallback. Se o modelo de build falhasse após executar leituras, o fallback (contexto zerado) recebia o corretivo "você já leu isso" em vez dos dados → montava programa sem dados de exercícios. Agora `withReadGuard` expõe `reset()`, chamado antes do re-run.

**F5 — LOW · RPC morta em toda carga de conversas**
`web/src/app/messages/actions.ts`
- `get_trainer_conversations` nunca existiu no banco (nenhuma migration define; a SPEC do MCP até documenta "NÃO existe") — toda carga pagava um round-trip garantidamente falho antes de cair no "fallback" (que era o caminho real). Chamada removida; query direta promovida a caminho único.

**F6 — LOW · Taxa da plataforma zerava em silêncio**
`web/src/app/api/wallet/charges/route.ts` + `web/src/app/api/wallet/subscriptions/route.ts`
- `KINEVO_TAKE_RATE_PCT` ausente/inválida → cobrança criada sem split Kinevo, sem log. Adicionado `console.error` alto em produção (comportamento preservado — decisão de bloquear é de produto, ver R8).

### Consultoria IA (feature WIP no working tree)

A feature está **bem construída**: auth/tenancy corretos em todas as 6 actions (padrão `resolveTrainer` + `.eq('trainer_id')`), RLS da migration 226 verificada ao vivo em prod (policy `FOR ALL` com `current_trainer_id()`), zero injection, admin client com defense-in-depth. Fixes aplicados:

**F7 — MEDIUM · Carimbo CREF aplicado APÓS a publicação**
`web/src/actions/consultoria/validate-consultoria.ts`
- Se o carimbo falhasse depois do `approveProgram`, ficava um programa ativo e visível ao aluno **sem o snapshot legal** que é o propósito da feature (e o treinador via "sucesso"). Reordenado: carimba o draft ANTES de publicar; falha no carimbo → nada publica. Também: transição guardada no fechamento (`.eq('status','pending_validation')`) contra corrida approve/reject, e exigência de nome não-vazio (sem nome o selo some no app do aluno — o mobile exige nome + CREF).

**F8 — MEDIUM · Dead-end permanente se o link geração→programa falhasse**
`web/src/actions/consultoria/generate-consultoria.ts`
- O update de `prescription_generations.assigned_program_id` ignorava erro → pedido avançava para `pending_validation` mas TODO approve falharia para sempre ("Nenhum programa vinculado"). Agora roteia por `fail()`.

### Mobile

**F9 — MEDIUM · Corrida celular-adiado × Watch pré-cria = sessão de dupla-cabeça (perda de sets)**
`mobile/hooks/useWorkoutSession.ts` (`createSessionInternal`)
- Com `deferSessionCreation` (readiness sheet/pre-checkin), o lookup do mount ficava minutos velho; se o Watch pré-criasse a sessão nesse intervalo, o celular inseria uma SEGUNDA sessão. Watch finalizava a dele; a do celular ficava órfã e os sets sumiam no cleanup de 24h. Agora re-checa `in_progress` existente antes de inserir (com o guard FIX C de sessões descartadas e o ref A14 de `started_at`).

**F10 — MEDIUM · Lookup do pré-create do Watch quebrava com duplicatas**
`mobile/app/_layout.tsx`
- `.maybeSingle()` sem `order+limit(1)`: com ≥2 sessões `in_progress`, PostgREST devolve PGRST116 e `data:null` — o código ignorava o erro, concluía "não existe" e criava uma TERCEIRA sessão. Espelhado o padrão defensivo do `useWorkoutSession` + erro checado (sem resposta confiável, não cria).

**F11 — MEDIUM · Duplicar template no mobile usava a RPC legada**
`mobile/hooks/useProgramTemplateActions.ts`
- Chamava a overload 1-arg (migration 152), que não copia `method_key`/séries por item/check-ins e propaga lixo pré-228 de filhos de superset. Agora resolve o trainer id e chama a 2-arg da migration 231 (transacional, cópia completa).

**F12 — LOW · Realtime da aba Histórico silenciosamente morto**
`mobile/hooks/useActiveProgram.ts`
- Topic estático `active-program-and-sessions` compartilhado entre home e logs (ambas montadas pelo tab navigator): `supabase.channel()` com topic repetido devolve o canal existente — listeners da 2ª instância nunca registravam e o primeiro cleanup matava o realtime da irmã. Topic agora é único por mount.

**Validação pós-fix:** web `tsc` 0 + build de produção OK + 1384 testes verdes · mobile `tsc` 0 + 374 verdes · shared 304 verdes.

---

## 3. ACHADOS NÃO CORRIGIDOS (recomendações, por prioridade)

**R1 — HIGH · Strava edge functions endurecidas mas NÃO deployadas (drift)**
Código no HEAD exige JWT verificado (401 senão); o artefato deployado é anterior. Qualquer um com a anon key pública usa o `STRAVA_CLIENT_SECRET` da Kinevo como open proxy. **Ação: autorizar deploy** de `strava-token-exchange` + `strava-token-refresh` e provar com chamada não autenticada → 401. (Já era achado vivo da auditoria de jul; segue aberto.)

**R2 — HIGH · `ANTHROPIC_API_KEY` inválida no Vercel prod (achado vivo, confirmado o caminho)**
`command-engine.ts` valida só a PRESENÇA da key; inválida passa → 401 em runtime → fallback silencioso para `gpt-4.1-mini` em turnos de build, com a única evidência em `assistant_turn_traces` que a TTL da 218 apaga. Mesmo padrão em `run-canvas-turn.ts`. **Ação: rotacionar a key no Vercel**; opcionalmente ping de validação no startup + alerta persistente no fallback.

**R3 — MEDIUM · Webhook Asaas: OVERDUE/REFUNDED/CHARGEBACK sem re-fetch/escopo no caminho global**
Só `PAYMENT_RECEIVED` e `ACCOUNT_STATUS` fazem o re-fetch anti-forja; os 3 handlers irmãos confiam no payload e, com a frota no token global (`scopedTrainerId=null`), o filtro de tenant vira no-op → forja com o token global pode corromper status financeiro cross-tenant. **Deliberadamente NÃO tocado agora:** o arquivo está sob go-live faseado com prova por evento pendente (R$588) — misturar mudanças contaminaria a verificação. **Ação: após a prova, espelhar o padrão `resolveOwnerContract` + `fetchVerifiedPayment` do RECEIVED nos 3 handlers** (aí sim rotacionar as subcontas, como já planejado).

**R4 — MEDIUM · `createOrganization` sem gate de billing (bypass latente do free tier)**
Cria org `trialing` + owner ativo sem checar plano → `hasOrgCoreAccess` vira true → cap de alunos e read-only lock anulados para sempre. Hoje sem endpoint exposto (nenhum client importa), mas vira buraco vivo no dia em que o onboarding self-serve do Estúdios ligar. **Ação: gate de entitlement antes de expor.**

**R5 — MEDIUM · `markAsPaidCore`: retry após falha parcial nunca conserta o contrato**
Se o insert idempotente sucede e o avanço de período falha, o retry bate no 23505 e devolve sucesso SEM avançar `current_period_end`. **Ação: no caminho 23505, verificar se o período foi avançado e completar** (ou mover o avanço para RPC transacional).

**R6 — MEDIUM · Consultoria: upsert do perfil clobbera curadoria do treinador**
`generate-consultoria.ts` sobrescreve `student_prescription_profiles` (nível, objetivo, dias, restrições, 60min hardcoded) com derivados da anamnese. **Decisão de produto:** merge preservando campos existentes, ou insert-only-if-absent, ou avisar o treinador.

**R7 — MEDIUM · Migration 226 aplicada em prod mas fora do git**
`226_consultoria_ia_validation.sql` está untracked enquanto 227-235 estão commitadas — perder o working tree = prod sem registro de schema; e qualquer outra branch que crie uma "226" colide. **Ação: commitar junto com a feature.**

**R8 — MEDIUMs de config de pagamento**
- `ASAAS_ENV` default é **sandbox** — se a env sumir do Vercel, cobranças vão para o universo errado em silêncio. Inverter default ou lançar erro em produção sem a env.
- `webhook-setup.ts` cai para `NEXT_PUBLIC_APP_URL` — se um dia setada sem `www`, regenera exatamente a URL do incidente de abril (307). Hard-code do host canônico ou validação.
- Decidir se `KINEVO_TAKE_RATE_PCT` ausente deve BLOQUEAR a criação da cobrança (hoje só loga alto — F6).

**R9 — LOW · Dropar a overload 1-arg de `duplicate_program_template`** (migration nova) + `gen:types` (a entry em `database.ts` está stale, por isso o web usa `as any`). O F11 já tirou o mobile dela, mas ela continua chamável.

**R10 — LOWs web**
- Stripe (platform e Connect) não trata `charge.refunded`/`charge.dispute.created` (paridade com Asaas; uso do billing Stripe de aluno ≈ 0 hoje).
- Notificação "Pagamento recebido" pode duplicar em retry de webhook (dedupe por `event_id`).
- `saveAsTemplate` (builder web) é N+1 sem transação → template parcial órfão em falha no meio (pendência conhecida; portar para RPC estilo 198).
- Matcher do middleware: exclusão de `opengraph-image` só cobre a raiz — um OG nested futuro cairia no 307→/login (classe de bug já vivida).
- Fallback de `NEXT_PUBLIC_SUPPORT_WHATSAPP` embute telefone pessoal no bundle do cliente.

**R11 — LOWs mobile**
- Side effects (persist/Watch message/haptics) rodando DENTRO de updaters de `setExercises` — React 19 concurrent pode re-invocar; mover para fora (efeitos idempotentes hoje, risco bounded).
- `persistSetLog`/`deletePersistedSetLog` enfileiram em QUALQUER erro (não só rede, como o `finishWorkout` faz) — rejeição permanente (RLS/FK) vira 24h de drains fúteis e um set "salvo" que nunca será.
- Footer do superset mostra o descanso do container mas a execução usa o do último filho (divergem em programas web/legados); `|| 60` mascara 0 explícito.
- Logout não limpa/escopa as filas offline (`kinevo-pending-setlogs`, `kinevo_pending_finish_workouts`) — troca de conta no mesmo device envenena o drain (a fila do Watch não tem TTL). Fix certo: escopar entradas por user id, não apagar.

**R12 — LOWs consultoria**
- CREF é texto livre (≤40 chars) exibido como selo de confiança — validar formato `NNNNNN-G/UF`.
- `startConsultoriaReview` dispara ao abrir QUALQUER detalhe (inclusive `awaiting_anamnese`) — telemetria M4 conta revisão antes de existir rascunho; gatear em `pending_validation`.
- Treinador sem `ai_prescriptions_enabled` consegue iniciar consultoria (anamnese vai ao aluno) mas a geração sempre falhará — avisar no ponto de entrada.

**R13 — Banco (advisors, nenhum ERROR)**
- Ligar **leaked password protection** no Auth (1 clique no dashboard).
- Escopar as 13 policies "Service role full access" para `TO service_role` (elimina a maioria dos 349 warnings de perf; service_role bypassa RLS de qualquer forma).
- 9 índices de FK faltando nas tabelas de IA/consultoria (`ai_*`, `assistant_*`, `consultoria_requests`) — baratos agora, crescem com o uso.
- Merge das policies SELECT duplicadas nas tabelas quentes (`set_logs`, `workout_sessions`, `assigned_*`) — medir antes.
- 49 índices sem uso — podar em 2 ondas (GIN + features mortas primeiro; NUNCA os de sync/webhook sem confirmar inalcançabilidade).
- Policy de listagem no bucket `exercise-library-videos`: risco baixo confirmado (vídeos custom de treinador ficam em `trainer-videos` separado) — remover por higiene.

---

## 4. Áreas verificadas LIMPAS

- **Builder save path** (web): payload ↔ RPC 235 consistentes (regras de filho de superset, `exercise_function` round-trip, recálculo de `expires_at`), rollback de UI correto.
- **HITL do assistente**: `CONFIRM_TOOLS` sem `execute` (nunca auto-rodam), re-checagem + rate-limit + validação semântica no confirmed-path, idempotência race-safe, quota clampada no banco. Os sinks de injeção da auditoria de 22/jun (send_message/send_form/checkout) estão fechados.
- **Webhooks**: idempotência e semântica de retry (500 transiente / 200 permanente) corretas; caminho RECEIVED do Asaas bem endurecido (dual-accept + re-fetch + cross-check).
- **Mobile offline/Watch**: fila de set logs (dedupe last-op-wins, drain guardado, TTL 24h), finish otimista offline, snapshot local S4, fila FINISH do Watch pós-R15 — tudo consistente. Auth/keychain e role routing sem gaps.
- **Server actions org/estúdio**: sem escalação — acesso herdado nunca amplia leitura/escrita de rows; `x-user-id` é derivado da sessão verificada no middleware.
- **Mobile home + carimbo consultoria** (working tree): aditivo, sem mudança de shape de query — seguro mesmo sem a migration.
- **Consultoria**: migration 226 com RLS correta (verificada ao vivo), triagem/mapeamento de respostas batem com o template 065, injection limpa, 23/23 testes.

---

## 5. Próximos passos sugeridos (ordem)

1. **Testar a consultoria localmente** e commitar a feature JUNTO com a migration 226 e os fixes desta auditoria (R7).
2. **Autorizar deploy das Strava functions** (R1) e **rotacionar a ANTHROPIC_API_KEY** no Vercel (R2).
3. Quando a prova por evento do Asaas chegar: hardening dos 3 handlers restantes (R3) → aí rotação das subcontas.
4. Migration nova: drop da overload 1-arg do duplicate (R9) + índices de FK das tabelas de IA (R13) + `gen:types`.
5. Decidir os MEDIUMs de produto: gate do `createOrganization` (R4), merge do perfil na consultoria (R6), `ASAAS_ENV`/take-rate fail-hard (R8).
