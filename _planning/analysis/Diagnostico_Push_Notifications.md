# Diagnóstico — Push Notifications no Kinevo

**Data:** 12/05/2026
**Escopo:** Por que as notificações **não estão chegando** no celular (aluno e treinador) e como reproduzir o comportamento estilo WebDiet ("Hora do seu treino — Ver treino" / alertas para o treinador).

---

## TL;DR — A causa raiz #1

O app mobile **nunca consegue gerar um Expo Push Token válido em produção** porque o código procura uma variável de ambiente que não existe. Resultado prático: a tabela `push_tokens` no Supabase está praticamente vazia, e por isso nada que o backend tente disparar chega no celular — mesmo com toda a infraestrutura de scheduling, triggers e Edge Functions funcionando.

`mobile/hooks/usePushNotifications.ts:39`
```ts
const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,  // ← undefined
});
```

`mobile/.env` contém apenas `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e `EXPO_PUBLIC_WEB_URL`. O `projectId` real (`3bfbd791-f08d-4df0-96db-eed6cde4275a`) só existe em `app.json` (`extra.eas.projectId`) e não está exposto como `EXPO_PUBLIC_*`.

Em standalone builds o Expo lança `Error: No "projectId" found` e a Promise rejeita. O `.then(token => …)` do hook nunca recebe um valor, `registerTokenOnBackend` nunca é chamado e o usuário fica para sempre sem token registrado.

---

## A pipeline ponta a ponta (como deveria funcionar)

```
[Boot do app / login]
   usePushNotifications(role)
        │
        ▼
   Notifications.getExpoPushTokenAsync({ projectId })   ← QUEBRA AQUI HOJE
        │
        ▼
   POST /api/notifications/register-token (web)
        │
        ▼
   upsert em public.push_tokens

[Aluno · Hora do treino]                     [Treinador · Alertas]
   extend-scheduled-notifications              workout_sessions / forms / payments
   (cron diário 5h UTC)                              │
        │                                            ▼
        ▼                                  INSERT em trainer_notifications
   linhas em scheduled_notifications                 │
   (status=pending, scheduled_for)                   │
        │                                            │
        ▼                                            │
   dispatch-scheduled-notifications (cron 5min)      │
        │                                            │
        ▼                                            │
   INSERT em student_inbox_items                     │
        │                                            │
        ▼                                            ▼
   trigger on_student_inbox_item_push    trigger on_trainer_notification_push
        │                                            │
        └────────────────►  send-push-notification  ◄┘
                                  │
                                  ▼
                           Expo Push API → device
```

A infraestrutura está **toda montada**. O furo é no primeiro retângulo (o token).

---

## Problemas encontrados, por severidade

### 🔴 P0 — Bloqueador absoluto

**1. `EXPO_PUBLIC_EAS_PROJECT_ID` não definido**
Arquivo: `mobile/hooks/usePushNotifications.ts:39`, `mobile/.env`
O hook lê do `process.env`, que está vazio. Token nunca é gerado em build standalone.
**Conserto trivial** (1 linha): trocar para `Constants.expoConfig?.extra?.eas?.projectId` (já existe em `app.json`) ou exportar a env no `.env` e nas profiles do `eas.json`.

**2. `send-push-notification` referencia coluna `push_sent_at` que foi DROPPADA**
Arquivos: `supabase/functions/send-push-notification/index.ts:59-65, 150-153` × `supabase/migrations/094_create_trainer_notifications.sql:13`
A migração 094 fez `DROP COLUMN IF EXISTS push_sent_at` em `trainer_notifications`. A Edge Function ainda faz SELECT e UPDATE nessa coluna. O `select().single()` da Supabase JS não lança exceção (retorna `data:null, error:...`), então o envio em si **não fica bloqueado** — mas:
   - A guarda anti-duplicação (`if (existingNotif?.push_sent_at) return;`) nunca dispara → risco de **push duplicado** para o mesmo evento.
   - O log do banco fica poluído de erros `column "push_sent_at" does not exist`.
**Conserto**: ou recriar a coluna (`ALTER TABLE trainer_notifications ADD COLUMN push_sent_at TIMESTAMPTZ`), ou remover as referências da Edge Function. Recomendo **recriar a coluna** — a lógica de dedupe é útil.

### 🟡 P1 — Importante (apenas o P0 corrige a maior parte, mas vão te morder em produção)

**3. Sem `addPushTokenListener`**
`mobile/hooks/usePushNotifications.ts` registra o token uma única vez no mount. Quando o APNs/FCM rotaciona o token (acontece após reinstalação, restore de backup, atualização de SO), o backend continua com o token antigo e os pushes silenciosamente param de chegar para aquele usuário.

**4. Race condition no registro de token**
`registerTokenOnBackend` (linhas 47-48): se a sessão Supabase ainda não estiver pronta quando o token for obtido, a função retorna em silêncio e nunca tenta de novo. Em cold start isso pode acontecer.

**5. Aluno: não existe gatilho de "hora do treino" baseado no programa**
A `extend-scheduled-notifications` gera ocorrências a partir de `recurring_appointments` (consultas/agendamentos com o personal) — ótimo para "lembrete da sessão presencial", mas **não** para "hoje é seu dia de treino A; abre o app". Para entregar a UX WebDiet aplicada ao Kinevo, falta uma das duas opções:
   a) Estender `extend-scheduled-notifications` para também ler dias da semana programados em `programs` / `program_schedule` e gerar `scheduled_notifications` com `source='workout_reminder'`.
   b) Reaproveitar `recurring_appointments` como representação canônica dos dias de treino e cadastrar isso para os alunos no onboarding (mais simples).

### 🟢 P2 — Resíduos / dívida técnica

**6. Sem `EXPO_ACCESS_TOKEN`** nas Edge Functions. A Expo permite push sem token, mas a partir de 2025 isso vem com rate-limit mais agressivo e sem alguns campos de receipt. Recomendado para escalar.

**7. Sem `UIBackgroundModes: ["remote-notification"]` explícito em `app.json`** (`ios.infoPlist`). O plugin `expo-notifications` deveria adicionar no prebuild, mas declarar explicitamente é mais seguro — já tivemos relatos de Expo SDK 54 não injetar isso em casos de cache de plugin.

**8. Inconsistência: trainer salva preferências via `/api/notifications/preferences` (web), aluno salva direto via Supabase em `students.notification_preferences`.** Funciona, mas confunde. Padronizar tudo via Supabase RPC é mais limpo.

**9. `google-services.json` e (se viesse a existir) `GoogleService-Info.plist` versionados no repo** sem estar no `.gitignore`. Não bloqueia push, mas é um risco de segurança secundário.

---

## Plano de correção, em ordem de execução

| # | Item | Esforço | Risco | Impacto |
|---|------|---------|-------|---------|
| 1 | Corrigir `projectId` no hook + adicionar fallback `Constants.expoConfig.extra.eas.projectId` | 30 min | baixo | 🔴 Destrava 100% do fluxo |
| 2 | Recriar coluna `push_sent_at` em `trainer_notifications` (nova migração) | 15 min | baixo | 🔴 Dedupe + log limpo |
| 3 | Build de teste em physical device, verificar linha em `push_tokens` para sua conta, disparar um INSERT manual em `trainer_notifications` e confirmar entrega | 1h | — | Validação |
| 4 | Adicionar `Notifications.addPushTokenListener` no hook | 30 min | baixo | 🟡 Robustez |
| 5 | Adicionar retry com backoff em `registerTokenOnBackend` quando session vier null + re-tentar quando AuthContext sinalizar login | 1h | baixo | 🟡 Cold start |
| 6 | (Decisão UX) Definir como representar "dia de treino" para o aluno: estender `recurring_appointments` ou criar `workout_reminders`. Implementar geração de `scheduled_notifications` correspondente | 4-6h | médio | 🟢 Feature nova ("Hora do treino") |
| 7 | Adicionar `UIBackgroundModes` explícito em `app.json`, rebuild | 30 min | baixo | 🟢 Hardening iOS |
| 8 | Criar `EXPO_ACCESS_TOKEN` no painel Expo, adicionar em secrets do Supabase, ajustar `send-push-notification` para enviar `Authorization: Bearer` | 1h | baixo | 🟢 Escalabilidade |
| 9 | Padronizar preferências do aluno via API (espelhar trainer) | 2h | baixo | 🟢 Consistência |

**Tempo total estimado para sair de "nada chega" para "tudo chega no estilo WebDiet": 1–1.5 dia de dev.**

Itens 1–3 isoladamente já devem fazer tudo que **hoje** o backend tenta disparar (mensagens, programa atribuído, treino completo, formulário enviado, lembrete de appointment) começar a chegar no celular.

---

## Copy sugerido — estilo WebDiet aplicado ao Kinevo

### Aluno

**Lembrete de treino do dia** (gatilho: 30 min antes do horário cadastrado, ou 8h da manhã se não houver horário)
- Título: `Hora do treino!`
- Corpo: `{nome do treino, ex: "Treino A — Membros Inferiores"} · ver treino`
- Deep link: `/(tabs)/home` → expande o card do treino do dia

**Reforço/checkpoint** (gatilho: horário planejado + 2h, sem `completed_at`)
- Título: `Você ainda consegue!`
- Corpo: `Faltam só {n} exercícios pra fechar o treino de hoje.`

**Pós-treino — registro de feedback** (gatilho: workout completed + 10 min)
- Título: `Como foi seu treino?`
- Corpo: `Registre o RPE pra seu treinador acompanhar.`
- Deep link: `/logs`

**Programa atribuído**
- Título: `Novo treino disponível`
- Corpo: `{nome do treinador} montou um treino novo pra você. Bora ver?`

### Treinador

**Aluno completou treino** (já existe via `workout_sessions` trigger)
- Título: `{nome do aluno} treinou!`
- Corpo: `{nome do treino} · RPE {rpe} · {duração}`
- Deep link: `/student/[id]`

**Aluno faltou treino do dia** (novo gatilho: 22h, dias programados sem `completed_at`)
- Título: `{nome do aluno} não treinou hoje`
- Corpo: `É o {n}º dia consecutivo. Que tal mandar uma mensagem?`
- Deep link: `/messages/[studentId]`

**Resposta de avaliação/formulário** (já existe via `form_submissions` trigger)
- Título: `Resposta de avaliação`
- Corpo: `{nome do aluno} respondeu {nome do form}.`

**Novo aluno solicitando aprovação**
- Título: `Novo aluno`
- Corpo: `{nome} pediu pra começar a treinar com você.`

---

## Próximo passo recomendado

Quer que eu já faça os itens 1, 2 e 7 do plano (as 3 correções de "P0+hardening rápido") numa próxima rodada? São pequenos, isolados e destravam o restante. Depois decidimos junto a estratégia para o item 6 (workout reminders).
