# Fase 2.5.3 — Log de Execução

Data: 2026-04-20. Executor: Claude Code (Opus 4.7).

Objetivo: fechar a dívida técnica de middleware mobile revelada pela [auditoria da 2.5.1](auditoria-middleware-mobile.md). Mobile passa a ter fluxo E2E real — gerar programa (2.5.1), aprovar (parcialmente: whitelist fixada, mas contrato de body divergente; ver §4.2), trocar mensagens com notificação bidirecional (2.5.3), gerenciar assinatura (2.5.3).

## §1. Escopo entregue

5 etapas + 1 complementar + 1 descoberta em cascata que vira Fase 2.5.4:

1. **Alinhamento §6** ([middleware.ts:28](../../../web/src/middleware.ts#L28) × [lib/supabase/middleware.ts:49-56](../../../web/src/lib/supabase/middleware.ts#L49-L56)): `api/financial` e `api/notifications` agora presentes em ambas as listas. Zero mudança semântica hoje; previne regressão se matcher for simplificado.
2. **`/api/programs/assign`** — adicionado à whitelist (matcher + updateSession). Whitelist funciona; contrato do body **não** (ver §4.2).
3. **`/api/messages/notify-student`** — handler criado ([web/src/app/api/messages/notify-student/route.ts](../../../web/src/app/api/messages/notify-student/route.ts)), 11 testes unitários ([route.test.ts](../../../web/src/app/api/messages/notify-student/route.test.ts)), adicionado à whitelist.
4. **`/api/messages/notify-trainer`** — adicionado à whitelist (handler já estava em produção via aluno web). Deploy par com #3 para fechar loop de comunicação simetricamente.
5. **`/api/stripe/portal`** — adicionado à whitelist. Branch cookies (web) preservado; branch Bearer (mobile) agora acessível.
6. **Complementar** — 3 `.catch(() => {})` silenciosos no mobile passam a logar em `__DEV__` ([useTrainerChat.ts:180](../../../mobile/hooks/useTrainerChat.ts#L180), [:242](../../../mobile/hooks/useTrainerChat.ts#L242), [useTrainerChatRoom.ts:106](../../../mobile/hooks/useTrainerChatRoom.ts#L106)). Mesmo padrão já usado em [useTrainerChatRoom.ts:130](../../../mobile/hooks/useTrainerChatRoom.ts#L130). Comentário `TODO: Create /api/messages/notify-student endpoint` removido (endpoint agora existe).

`npm test` (web): **329/329** (318 pré-existentes + 11 novos para `notify-student`). `npx tsc --noEmit` (web): erros pré-existentes em `program-calendar.test.tsx`/`student-insights-card.test.tsx` documentados desde a 2.5.1 — não tocados por esta fase. `npx tsc --noEmit` (mobile): 16 erros pré-existentes (tipos supabase desatualizados), contagem **igual** antes e depois do diff desta fase.

## §2. Investigações por etapa

### §2.1 — Alinhamento §6 (Etapa 1)

Re-leitura confirmou o delta exato reportado pela auditoria: matcher excluía `api/financial` + `api/notifications` do middleware; updateSession não os listava na cadeia `!pathname.startsWith(...)`. Zero divergências adicionais escondidas. Fix: 2 linhas em updateSession.

### §2.2 — Shape real do caller mobile de `notify-student` (Etapa 3)

Pausei antes de implementar para confirmar o que o mobile envia hoje, conforme política de não-criar-bug-simétrico-ao-que-estamos-consertando.

Grep em `mobile/` revelou:

- Caller real em [mobile/hooks/useTrainerChatRoom.ts:121-128](../../../mobile/hooks/useTrainerChatRoom.ts#L121-L128) envia `{ studentId, messageContent }` — **não** `{ studentId, messageId, preview? }` que eu infiriria do prompt original. Fui pelo shape real.
- Deep-link resolver em [usePushNotifications.ts:150-162](../../../mobile/hooks/usePushNotifications.ts#L150-L162) lê `data.type === 'text_message'` e usa `data.student_id` (snake_case) para navegar. Não lê `trainer_id`/`trainerId` hoje — escolhi snake_case (`trainer_id`) para alinhar com a convenção já usada no resto do inbox (`form_template_id`, `report_id`, `student_id`).
- Página de inbox em [mobile/app/inbox/[id].tsx:19](../../../mobile/app/inbox/[id].tsx#L19) lista `'text_message'` no union de types mas ainda não renderiza thread de chat — campo no payload é forward-compat.

### §2.3 — Assimetria real entre `insertTrainerNotification` e `insertStudentNotification` (Etapa 3)

Pausa obrigatória (conforme Nota 1 do prompt): investigação revelou que o par não é rename 1:1. Descobertas:

| Dimensão | Trainer | Student |
|---|---|---|
| Tabela | `trainer_notifications` | `student_inbox_items` |
| Campos | `type, title, body, data, category` | `type, title, subtitle, payload, status` |
| Enum `type` | string livre | **enum restrito** em 6 valores, o único aplicável é `'text_message'` |
| Status | `is_read` (boolean) | `status` (`'unread'` default, string) |
| `sendTrainerPush` params | `type` top-level, usa `prefs[type]` | `sendStudentPush`: sem `type` top-level, lê `params.data?.type`; dois níveis de prefs (`push_enabled` global + `categories[type]`) |
| Nome do FK na push call | `notificationId` | `inboxItemId` |

Mapeamento aplicado (confirmado pelo Gustavo antes de implementar): `type: 'text_message'`, `title: "Nova mensagem de <trainer.name>"` com fallback `"seu treinador"` se null, `subtitle` com truncamento de 100 chars + ellipsis, `payload: { trainer_id, trainer_name }` snake_case, `data: { type: 'text_message', trainer_id, trainer_name }` no push. Response `{ success: true }` simétrico ao `notify-trainer`.

### §2.4 — Auth já hardened em `programs/assign` (Etapa 2)

Barra 2.5.1 ("whitelist = confiança no handler; só whitelistar rotas com auth bem-formada") verificada:

- Bearer extraction ([route.ts:19-23](../../../web/src/app/api/programs/assign/route.ts#L19-L23)) ✅
- `supabase.auth.getUser()` com reject 401 ([:71-74](../../../web/src/app/api/programs/assign/route.ts#L71-L74)) ✅
- Ownership do aluno ([:94-102](../../../web/src/app/api/programs/assign/route.ts#L94-L102)) ✅
- Ownership do template ([:106-115](../../../web/src/app/api/programs/assign/route.ts#L106-L115)) ✅
- Rate-limit 10/min 50/day ([:87-91](../../../web/src/app/api/programs/assign/route.ts#L87-L91)) ✅
- UUID validation ([:47-53](../../../web/src/app/api/programs/assign/route.ts#L47-L53)) ✅

O que a barra 2.5.1 **não** cobria: compatibilidade de contrato entre caller e handler. Ver §4.2.

### §2.5 — `stripe/portal` preserva ambos os branches (Etapa 5)

Re-leitura: branch Bearer ([:10-17](../../../web/src/app/api/stripe/portal/route.ts#L10-L17)) e branch cookies ([:18-22](../../../web/src/app/api/stripe/portal/route.ts#L18-L22)) coexistem na mesma função. Whitelistar **não** desabilita cookies — apenas impede o redirect 307 prévio ao handler, permitindo que a lógica condicional execute. Confirmado seguro.

## §3. Diffs resumidos

| Arquivo | Status | Delta |
|---|---|---|
| `web/src/middleware.ts` | editado | matcher recebe `api/programs/assign`, `api/messages/notify-trainer`, `api/messages/notify-student`, `api/stripe/portal` (4 novos paths). Comentário doc atualizado. |
| `web/src/lib/supabase/middleware.ts` | editado | updateSession recebe 6 novos `!pathname.startsWith(...)`: `api/financial`, `api/notifications` (alinhamento §6), `api/programs/assign`, `api/messages/notify-trainer`, `api/messages/notify-student`, `api/stripe/portal`. |
| `web/src/app/api/messages/notify-student/route.ts` | **novo** | 100 linhas. Clone de `notify-trainer` com as adaptações de §2.3. |
| `web/src/app/api/messages/notify-student/route.test.ts` | **novo** | 11 casos: 401 sem header, 401 com token inválido, 400 sem studentId, 400 studentId não-UUID, 403 não-trainer, 403 não-coach, 429 rate-limit, 200 happy path com shape simétrico, fallback "seu treinador" quando name null, truncamento 100 chars + ellipsis, "Enviou uma imagem" sem messageContent. |
| `mobile/hooks/useTrainerChat.ts` | editado | 2 `.catch(() => {})` viram `.catch((err) => { if (__DEV__) console.error(...) })`. |
| `mobile/hooks/useTrainerChatRoom.ts` | editado | 1 `.catch(() => {})` idem. Comentário `TODO` sobre endpoint inexistente removido. |

Zero dependências novas.

## §4. Evidência E2E

### §4.1 Whitelist — confirmação 401 ≠ 307 em 4 rotas

Com dev server em `localhost:3000`, bombardeados os 4 endpoints sem Bearer:

```bash
for ep in /api/programs/assign /api/messages/notify-trainer /api/messages/notify-student /api/stripe/portal; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000${ep}" -X POST -H "Content-Type: application/json" -d '{}')
  echo "${ep} -> ${code}"
done
```

Resultado:

```
/api/programs/assign -> 401
/api/messages/notify-trainer -> 401
/api/messages/notify-student -> 401
/api/stripe/portal -> 401
```

Antes desta fase, cada um retornava **307** (redirect para `/login`, HTML, mobile explodia silenciosamente no `.json()`). Agora as requests chegam no handler e cada um rejeita com 401 (auth ausente) — contrato do middleware fechado.

### §4.2 Handler Bearer real — `notify-student`

JWT extraído pelo Gustavo do cookie `sb-lylksbtgrihzepbteest-auth-token` do trainer `7aec3555-…` (Gustavo Prado) e gravado em `/tmp/kvn-trainer-jwt.txt` (807 chars, 3 partes). Curl:

```bash
JWT=$(cat /tmp/kvn-trainer-jwt.txt)
curl -sS -X POST "http://localhost:3000/api/messages/notify-student" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"bbe3c04a-72cd-437e-8faa-46615b2ff9e2","messageContent":"Validação E2E Fase 2.5.3"}'
```

Response: **HTTP 200** + `{"success": true}`.

Row persistida em `student_inbox_items` (query direto no banco):

```json
{
    "id": "e78e00fa-b931-4200-9bf3-104cd05d6e6f",
    "student_id": "bbe3c04a-72cd-437e-8faa-46615b2ff9e2",
    "trainer_id": "7aec3555-600c-4e7c-966e-028116921683",
    "type": "text_message",
    "title": "Nova mensagem de Gustavo Prado",
    "subtitle": "Gustavo Prado: Validação E2E Fase 2.5.3",
    "payload": { "trainer_id": "7aec3555-600c-4e7c-966e-028116921683", "trainer_name": "Gustavo Prado" },
    "status": "unread",
    "created_at": "2026-04-20 18:25:47.627775+00"
}
```

Shape bate 1:1 com o teste unitário happy-path de [route.test.ts](../../../web/src/app/api/messages/notify-student/route.test.ts): `type='text_message'`, `title` com nome do trainer hidratado via DB lookup, `subtitle` com prefix `"<name>: "` + messageContent, `payload` com `trainer_id`/`trainer_name` snake_case, `status='unread'` default. Handler validado end-to-end.

Push ao device real não verificado (fora de escopo per D3 do prompt). Aluno alvo (`bbe3c04a`) pode ou não ter `expo_push_token` ativo em `push_tokens` — irrelevante para a validação do handler, que já chamou `sendStudentPush` sem lançar (a função é non-throwing por contrato, retorna cedo se não há token).

### §4.3 Handler Bearer real — `programs/assign` (bug de contrato descoberto)

**Fato:** a whitelist expôs o handler, mas o contrato do body diverge entre caller mobile e receiver web.

**Shape que o mobile envia** ([mobile/app/student/[id]/prescribe.tsx:161-166](../../../mobile/app/student/[id]/prescribe.tsx#L161-L166)):
```json
{
    "studentId": "<uuid>",
    "generationId": "<uuid>",
    "outputSnapshot": { ... },
    "startDate": "<iso>"
}
```

**Shape que o handler aceita** ([web/src/app/api/programs/assign/route.ts:32-53](../../../web/src/app/api/programs/assign/route.ts#L32-L53)):
```json
{
    "studentId": "<uuid>",
    "templateId": "<uuid>",
    "prescriptionGenerationId": "<uuid>?",
    "startDate": "<iso>?",
    "isScheduled": "<bool>?",
    "workoutSchedule": { ... }
}
```

**Diagnóstico:** o handler foi escrito pra fluxo web ("trainer tem um `program_templates` row → atribui ao aluno"). O mobile tenta reusar o mesmo endpoint pra fluxo novo ("IA gera programa → aprova → materializa direto"), pulando a criação de template intermediário. Três incompatibilidades concretas:

1. Mobile envia `generationId`; handler lê `prescriptionGenerationId`.
2. Mobile não envia `templateId`; handler o exige como obrigatório (400 no gate de `:43-45`).
3. Mobile envia `outputSnapshot` com o programa AI-gerado; handler ignora — só copia de `workout_templates`/`workout_item_templates` associados ao `templateId`.

**Impacto histórico:** desde que esta route nasceu, trainers que tentavam aprovar pelo mobile recebiam **307 → /login** (mesmo bug da 2.5.1, manifestação em outro route). O `.catch` do mobile transformava isso em `Alert.alert("Erro", "Falha ao atribuir programa.")`. Agora o 307 virou **400 honesto** (`"studentId and templateId are required"`), que também aparece como mesmo Alert — UX idêntico do ponto de vista do trainer, mas o handler agora é diagnosticável.

**Encaminhamento:** Fase 2.5.4 (link em §5). Opção 2a provisoriamente escolhida: aceitar `generationId` no handler (alias de `prescriptionGenerationId`) e, quando presente sem `templateId`, materializar programa direto do `prescription_generations.output_snapshot`. Estimativa: ~50 linhas no handler, 3-5 testes.

**Whitelist mantida aplicada** para impedir regressão do 307 quando a 2.5.4 fechar o contrato. Sem a whitelist, o fix da 2.5.4 não seria observável — voltaria o 307 original.

### §4.4 `notify-trainer` e `stripe/portal` — 401 ≠ 307 é suficiente

Conforme D3 sub-decisão (b) do prompt: handlers já validados em produção pelo branch web (cookies). A mudança desta fase é apenas expor o branch Bearer para o mobile, que o middleware bloqueava. A validação "401 em vez de 307" prova o fix do middleware; validação de handler vive em smoke manual post-deploy.

## §5. Follow-ups

### §5.1 Fase 2.5.4 — reconciliar contrato `programs/assign` ↔ mobile (task #26)

Bug descoberto em cascata durante validação E2E da whitelist. Opção 2a: handler aceita `generationId` como alias de `prescriptionGenerationId` e, quando presente sem `templateId`, materializa `assigned_programs` + `assigned_workouts` + `assigned_workout_items` direto do `prescription_generations.output_snapshot`. Preserva fluxo web atual (passa `templateId`, ignora `generationId`). Adiciona testes que simulam o body real do mobile.

### §5.2 Auditoria leve de contrato mobile↔handler nas 11 rotas categoria A restantes

Dado que a whitelist expôs um bug de contrato que o 307 mascarava por tempo indeterminado, as 11 rotas categoria A já corretamente whitelisted desde sempre podem ter bugs análogos não detectados porque o trainer/aluno **vê** 200 OK mas o handler faz algo silenciosamente errado — ou, pior, as 2 rotas acabadas de whitelistar (`notify-trainer`, `stripe/portal`) podem ter contratos análogos ao de `programs/assign`.

Proposta de varredura leve (não fix): grep do shape do caller mobile (`JSON.stringify({...})` em `mobile/**` próximo a `fetch('/api/...')`) vs shape aceito pelo handler (`const { a, b } = await request.json()` + checks de obrigatórios). Se divergência → logar. Trabalho estimado: 1h em modo auditoria. Produto: lista priorizada de "rotas com contrato divergente" (categoria de bug silencioso análoga à que a 2.5.3 revelou).

### §5.3 Consolidação trainer↔student: auth, notification insert, push params

Descoberta em §2.3 expandiu o escopo do follow-up original (D2 do prompt: consolidar padrão de auth Bearer). Agora cobre **3 camadas de assimetria** no par trainer↔student:

1. **Auth**: `createServerClientFromToken` em `prescription/generate` vs `createClient` direto em `notify-trainer`/`notify-student`. 2 convenções.
2. **Notification insert**: `insertTrainerNotification` (tabela `trainer_notifications`, campos `type, title, body, data, category`, type string livre) vs `insertStudentNotification` (tabela `student_inbox_items`, campos `type, title, subtitle, payload, status`, type enum restrito de 6 valores). 2 shapes divergentes para 2 domínios espelhados.
3. **Push params**: `SendTrainerPushParams.type` top-level (usa `prefs[type]`) vs `SendStudentPushParams` sem `type` top-level (lê `params.data?.type`, com dois níveis de prefs `push_enabled` + `categories[type]`). 2 convenções.

Pacote único (não 3 follow-ups separados — o trabalho é uma varredura unificada). Decisão entre "migrar tudo pra convenção única" vs "documentar as diferenças como permanentes" fica em aberto.

### §5.4 Trainer notification preferences — 1 nível vs 2 níveis do aluno (follow-up de **produto**, não técnico)

Aluno tem `notification_preferences: { push_enabled: bool, categories: Record<type, bool> }`. Trainer tem `notification_preferences: Record<type, bool>` — só categorias, sem mute global. Inconsistência de **produto**: trainer não consegue "silenciar tudo temporariamente" (ex: viajando). Não é bug, é feature ausente. Pode virar pedido de algum trainer.

### §5.5 Follow-ups pré-existentes da 2.5.2 ainda abertos

Relistados aqui para continuidade:

- Opções X/Y/Z de refatoração estrutural da whitelist (auditoria §8). Mantidas em aberto — a 2.5.3 fechou 3 bugs sem refatorar; recorrência futura pode justificar.
- Vitest harness para route handlers Bearer (levantado na 2.5.1 §5.3). A 2.5.3 introduziu o primeiro teste de route handler (`notify-student/route.test.ts`) testando o `POST` como função, sem infra nova. Se o padrão for replicado para as 14 rotas A, o harness proposto deixa de ser necessário — é só replicar o template.
- Convenção `api/messages/*` vs `api/notifications/*` (nomenclatura aparentemente inconsistente). A 2.5.3 não moveu arquivos (fora de escopo); decisão de unificar ou justificar divergência fica em aberto.

## §6. Sequência de trabalho executada

1. ✅ Etapa 1 — `updateSession` recebe `api/financial` e `api/notifications`. `npm test` 318/318, tsc limpo em arquivos tocados.
2. ✅ Etapa 2 — Matcher + updateSession recebem `api/programs/assign`. Re-leitura do handler confirmou auth hardened.
3. 🟡 Pausa #1 (Nota 1 do Gustavo) — assimetria `insertTrainerNotification` × `insertStudentNotification` reportada. Gustavo confirmou: seguir com mapeamento, registrar como follow-up unificado §5.3.
4. ✅ Etapa 3 — [notify-student/route.ts](../../../web/src/app/api/messages/notify-student/route.ts) criada + [route.test.ts](../../../web/src/app/api/messages/notify-student/route.test.ts) com 11 casos passando. Matcher + updateSession recebem `api/messages/notify-student`.
5. ✅ Etapa 4 — Matcher + updateSession recebem `api/messages/notify-trainer`.
6. ✅ Etapa 5 — Matcher + updateSession recebem `api/stripe/portal`.
7. ✅ Etapa 6 — 3 `.catch(() => {})` trocados por `.catch((err) => { if (__DEV__) console.error(...) })`. Comentário `TODO` sobre endpoint inexistente removido.
8. ✅ Validação middleware — `curl` sem Bearer em 4 endpoints retorna 401 em vez de 307. Whitelist fechada.
9. 🔴 Pausa #2 (descoberta em cascata) — handler `programs/assign` tem contrato divergente do caller mobile. Reportado ao Gustavo.
10. ✅ Destravamento — Gustavo: Opção 1 (encerrar 2.5.3 limpa, abrir 2.5.4 pra reconciliação). Whitelist mantida aplicada.
11. 🟡 Pausa #3 — `/tmp/kvn-trainer-jwt.txt` ainda não gravado. Validação Bearer real de `notify-student` pendente.
12. ✅ Destravamento — Gustavo gravou JWT do trainer. Curl retornou 200; row em `student_inbox_items` com shape correto (§4.2). Fase encerrada.
