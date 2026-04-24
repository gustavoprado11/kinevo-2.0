# Fase 6 — Google Calendar sync

**Objetivo:** trainer conecta Google Calendar via OAuth; agendamentos do Kinevo aparecem no calendário escolhido; mudanças diretas no Google refletem no Kinevo com confirmação do trainer (exceto deletes, que aplicam direto).

**Pré-requisito:** Fases 1-3 concluídas (rotinas e UI básica existem).

---

## Entregáveis

1. Migration com `google_calendar_connections` + colunas de sync em `recurring_appointments`
2. Página de configuração `/settings/integrations/google-calendar`
3. Fluxo OAuth 2.0 completo
4. Seleção de calendário destino
5. Server-side helper para chamar Google Calendar API
6. Sync híbrido: síncrono com timeout 3s + fallback assíncrono
7. Webhook `/api/webhooks/google-calendar` para detectar mudanças externas
8. Edge Function diária para renovar watch channels
9. Badges de status de sync nos cards de agendamento
10. Testes

---

## Arquivos a criar

```
supabase/migrations/108_google_calendar_integration.sql

web/src/lib/google-calendar/
├── client.ts                  # wrapper da Google Calendar API
├── oauth.ts                    # OAuth flow helpers
├── token-refresh.ts            # refresh token logic
├── event-mapper.ts             # Kinevo ↔ Google Event conversion
├── sync-service.ts             # sync orchestration (híbrida)
└── __tests__/
    ├── event-mapper.test.ts
    └── sync-service.test.ts

web/src/app/settings/integrations/google-calendar/
├── page.tsx
└── callback/route.ts           # OAuth callback endpoint

web/src/app/api/webhooks/google-calendar/
└── route.ts                    # recebe push notifications do Google

web/src/components/appointments/
└── sync-status-badge.tsx

supabase/functions/renew-google-watch-channels/
└── index.ts
```

## Arquivos a modificar

- Server actions da Fase 2: chamar sync após criar/editar/cancelar
- Modal da Fase 3: mostrar `SyncStatusBadge` nos cards de rotina existentes

---

## Detalhamento

### Migration `108_google_calendar_integration.sql`

```sql
CREATE TABLE google_calendar_connections (
    trainer_id UUID PRIMARY KEY REFERENCES trainers(id) ON DELETE CASCADE,
    google_account_email TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_sync_at TIMESTAMPTZ,
    last_sync_error TEXT,

    -- Watch channel info (pra renovação e unsubscribe)
    watch_channel_id TEXT,
    watch_resource_id TEXT,
    watch_expires_at TIMESTAMPTZ
);

-- Tokens são strings sensíveis. Idealmente usar Supabase Vault (pgsodium)
-- mas tokens em texto puro são aceitáveis se o DB estiver adequadamente protegido.
-- Consultar time de infra antes de decidir.

ALTER TABLE recurring_appointments
    ADD COLUMN google_event_id TEXT,
    ADD COLUMN google_sync_status TEXT DEFAULT 'not_synced'
        CHECK (google_sync_status IN ('not_synced', 'pending', 'synced', 'error', 'disabled'));

CREATE INDEX idx_google_connections_watch_expires
    ON google_calendar_connections(watch_expires_at)
    WHERE watch_channel_id IS NOT NULL;

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainer can read own google connection"
    ON google_calendar_connections FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access google connections"
    ON google_calendar_connections FOR ALL
    USING (auth.role() = 'service_role');
```

### Fluxo OAuth

**Variáveis de ambiente (adicionar em `.env.example`):**
```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://app.kinevo.com.br/settings/integrations/google-calendar/callback
```

**Fluxo:**

1. Página `/settings/integrations/google-calendar` mostra estado atual (conectado/desconectado)
2. Botão "Conectar" redireciona pra Google com escopo `https://www.googleapis.com/auth/calendar`
3. Google redireciona de volta pra `/callback?code=...`
4. Callback troca `code` por `access_token` + `refresh_token`
5. Busca lista de calendários via `GET /calendar/v3/users/me/calendarList`
6. Mostra seleção ao trainer: "Em qual calendário você quer que os agendamentos apareçam?"
7. Ao escolher, salva em `google_calendar_connections`, cria watch channel, marca conexão como ativa
8. Redireciona de volta pra página de configuração

### Sync híbrido

`sync-service.ts` expõe funções:

```typescript
export async function syncAppointmentToGoogle(
    recurringId: string,
    operation: 'create' | 'update' | 'delete',
): Promise<void>
```

Lógica:
1. Marca `google_sync_status='pending'` no agendamento
2. `Promise.race` entre: chamada real à API Google + timeout 3s
3. Se API respondeu em <3s: marca `synced`, salva `google_event_id`, retorna
4. Se timeout: enfileira retry em worker (pode ser um `setTimeout` no server action ou um cron — Kinevo ainda não tem fila, então usar estratégia "insere em `sync_retry_queue` e edge function roda a cada 30s")

**Alternativa pragmática pro MVP:** se não quiser adicionar fila, fazer retry in-process com backoff (30s, 2min, 10min) via `setTimeout` na edge function do Next.js. Tem limitações mas funciona pro volume atual.

### Webhook `/api/webhooks/google-calendar`

Recebe POST do Google quando evento muda. Headers importantes:
- `X-Goog-Channel-Id` → identifica o channel
- `X-Goog-Resource-State` → `sync` (primeiro) ou `exists` (mudança)

Fluxo:
1. Identifica qual trainer é dono do channel
2. Busca eventos modificados desde `last_sync_at` via `events.list?updatedMin=...`
3. Pra cada evento com mudança relevante:
   - **Deleted**: cria exceção `kind='canceled'` no Kinevo; dispara push ao aluno
   - **Modified (horário/data)**: cria pending notification "Evento X foi editado no Google. Refletir no Kinevo?" (tabela nova ou em `trainer_notifications`)
   - **Evento recorrente deleted**: encerra rotina no Kinevo
4. Atualiza `last_sync_at`

### Edge Function: renew-google-watch-channels

Roda diariamente. Pra cada conexão com `watch_expires_at < now() + interval '2 days'`:
1. Para o channel antigo (`POST /channels/stop`)
2. Cria channel novo (`POST /{calendarId}/watch`)
3. Atualiza `watch_channel_id`, `watch_resource_id`, `watch_expires_at`

---

## Testes

### `event-mapper.test.ts`

- Converte `RecurringAppointment` semanal em evento Google com `RRULE:FREQ=WEEKLY`
- Converte quinzenal com `INTERVAL=2`
- Converte mensal com `FREQ=MONTHLY`
- `endsOn` gera `UNTIL`
- `durationMinutes` calcula `end` corretamente

### `sync-service.test.ts`

- Sync síncrono em <3s marca status `synced`
- Timeout joga pra fila e mantém `pending`
- Token expirado dispara refresh automático
- 401 (token revogado) marca conexão como `revoked`

### Teste manual do webhook

Pode usar `ngrok` em dev pra receber webhooks reais do Google.

---

## Critérios de aceite

- [ ] Trainer consegue conectar Google Calendar via OAuth
- [ ] Pode escolher qual calendário usar
- [ ] Ao criar rotina no Kinevo, evento recorrente aparece no Google em <5s
- [ ] Ao remarcar ocorrência, instance override é criada no Google
- [ ] Ao cancelar ocorrência, instance é deletada no Google
- [ ] Se trainer edita evento no Google, Kinevo recebe webhook e cria notificação pedindo confirmação
- [ ] Se trainer deleta evento no Google, Kinevo cancela automaticamente
- [ ] Se trainer revoga acesso, Kinevo mostra banner pra reconectar
- [ ] Watch channels são renovados automaticamente
- [ ] Testes passam

---

## Referências

- Google Calendar API: https://developers.google.com/calendar/api/v3/reference
- Push Notifications: https://developers.google.com/calendar/api/guides/push
- Edge Function de referência: `supabase/functions/send-push-notification/index.ts`
