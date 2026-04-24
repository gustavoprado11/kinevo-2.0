# Google Calendar — Integração

Fase 6 do roadmap de Agendamentos. Trainer conecta sua conta Google via
OAuth 2.0; agendamentos criados no Kinevo viram eventos recorrentes no
calendário escolhido; mudanças feitas direto no Google refletem no
Kinevo (deletes aplicam automaticamente, edits pedem confirmação).

---

## Setup — uma vez por ambiente

O trainer não faz nada disto. Estas etapas são feitas **pela equipe do
Kinevo** no Google Cloud Console, uma vez por ambiente (dev, staging,
prod).

### 1. Criar projeto no Google Cloud

1. Acesse https://console.cloud.google.com/
2. "Select a project" → "New Project" → "Kinevo — Appointments"
3. Espere o provisionamento.

### 2. Habilitar a Google Calendar API

1. "APIs & Services" → "Library"
2. Busque "Google Calendar API" → "Enable"

### 3. Configurar OAuth Consent Screen

1. "APIs & Services" → "OAuth consent screen"
2. User type: **External** (pra funcionar com qualquer conta Google)
3. Preencha:
   - App name: `Kinevo`
   - User support email: `suporte@kinevoapp.com`
   - Developer contact: `dev@kinevoapp.com`
   - App logo: opcional
   - App domain: `https://www.kinevoapp.com`
   - Authorized domains: `kinevoapp.com`
4. **Scopes**:
   - `https://www.googleapis.com/auth/calendar` (read/write calendário)
   - `https://www.googleapis.com/auth/userinfo.email`
5. **Test users** (enquanto app estiver em modo "Testing"):
   - Adicione emails dos trainers beta
6. Publish app: quando passar 100+ conexões, solicitar verificação do
   Google (processo separado, ~semanas).

### 4. Criar OAuth 2.0 Client ID

1. "APIs & Services" → "Credentials" → "Create Credentials" →
   "OAuth client ID"
2. Application type: **Web application**
3. Name: `Kinevo Web`
4. **Authorized JavaScript origins**:
   - `https://www.kinevoapp.com`
   - `http://localhost:3000` (dev)
5. **Authorized redirect URIs**:
   - `https://www.kinevoapp.com/settings/integrations/google-calendar/callback`
   - `http://localhost:3000/settings/integrations/google-calendar/callback` (dev)
6. Save → copie o **Client ID** e o **Client Secret**.

### 5. Variáveis de ambiente

Adicione as variáveis em `.env.local` (dev), Vercel (prod), e Supabase
Edge Functions secrets (pro `renew-google-watch-channels`):

```bash
# web/.env.local e Vercel
GOOGLE_OAUTH_CLIENT_ID=<client_id>
GOOGLE_OAUTH_CLIENT_SECRET=<client_secret>
GOOGLE_OAUTH_REDIRECT_URI=https://www.kinevoapp.com/settings/integrations/google-calendar/callback
GOOGLE_WEBHOOK_URL=https://www.kinevoapp.com/api/webhooks/google-calendar
NEXT_PUBLIC_APP_URL=https://www.kinevoapp.com
```

Na CLI do Supabase pro Edge Function:

```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<client_id>
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=<client_secret>
supabase secrets set GOOGLE_WEBHOOK_URL=https://www.kinevoapp.com/api/webhooks/google-calendar
```

O Edge Function `renew-google-watch-channels` usa `GOOGLE_OAUTH_CLIENT_ID`
e `GOOGLE_OAUTH_CLIENT_SECRET` pra refresh de tokens. `GOOGLE_WEBHOOK_URL`
é opcional — se não setar, usa `https://www.kinevoapp.com/api/webhooks/google-calendar`.

### 6. Domain verification (pra watch channels)

Google exige que o domínio do webhook (`GOOGLE_WEBHOOK_URL`) esteja
verificado antes de aceitar Push Notifications:

1. Search Console → "Add property" → `https://www.kinevoapp.com`
2. Verifique via DNS TXT record ou HTML file.
3. Google Cloud Console → Domain verification → associe o domínio
   verificado ao projeto.

Sem isto, `POST /events/watch` retorna `403` com mensagem
"Unauthorized WebHook callback channel". A conexão do trainer ainda
funciona pras mutações, só não recebe notificações em tempo real
(mudanças feitas no Google só aparecem quando o trainer recarrega).

---

## Fluxo do trainer (end-user)

1. Trainer acessa `/settings/integrations/google-calendar`
2. Clica "Conectar Google Calendar" → redirecionamento OAuth
3. Aprova no Google
4. De volta no Kinevo, vê lista dos próprios calendários e escolhe destino
5. Kinevo cria watch channel + começa sync de rotinas existentes
6. Eventos começam a aparecer no Google em < 5s após criação no Kinevo

Pra desconectar: mesma página → "Desconectar" → tokens revogados, watch
channel parado, eventos no Google permanecem intactos (trainer remove
manualmente se quiser).

---

## Arquitetura interna

- **`shared/types/google-calendar.ts`** — tipos mínimos da Google API v3.
- **`web/src/lib/google-calendar/oauth.ts`** — URL de authorize, troca de
  code, refresh, userinfo, revoke.
- **`web/src/lib/google-calendar/client.ts`** — HTTP client fino que
  retorna `GoogleApiResult<T>` ao invés de lançar exceções; diferencia
  `not_found`, `unauthorized`, `rate_limit`, `revoked`, `unknown`.
- **`web/src/lib/google-calendar/token-refresh.ts`** — `getFreshAccessToken(trainerId)`.
  Auto-renova se expira em < 2 min. Marca `revoked` se refresh falha com
  `invalid_grant`.
- **`web/src/lib/google-calendar/event-mapper.ts`** — conversão
  `RecurringAppointment` → `GoogleEvent` com `RRULE`.
- **`web/src/lib/google-calendar/sync-service.ts`** — orquestra mutações
  Kinevo → Google com timeout 3s + retry in-process (30s, 2min, 10min).
- **`web/src/app/api/webhooks/google-calendar/route.ts`** — recebe Push
  Notifications, classifica mudança externa (delete → aplica; edit →
  cria `trainer_notifications` pedindo confirmação).
- **`supabase/functions/renew-google-watch-channels`** — Edge Function
  diária (pg_cron: `0 6 * * *` UTC = 3h BRT) que renova watch channels
  perto de expirar.

---

## Tabelas

- `google_calendar_connections` — 1 linha por trainer. Tokens em texto
  puro; RLS restringe leitura ao próprio trainer (mas clientes não têm
  motivo pra ler tokens — todas as chamadas ao Google passam pelo server).
- `recurring_appointments.google_event_id` — ID do evento no Google.
- `recurring_appointments.google_sync_status` — `not_synced | pending | synced | error | disabled`.

---

## Status sync UI

Componente `SyncStatusBadge` (em `web/src/components/appointments/`):

- `not_synced` → invisível (não polui quando trainer nem tem Google)
- `synced` → pill verde com ícone ✓ "Google"
- `pending` → pill azul com spinner "Sincronizando"
- `error` → pill âmbar com warning "Erro sync"
- `disabled` → pill cinza "Off" (trainer desconectou; evento no Google continua lá)

Aparece em:
- Card de rotina simples (`StudentScheduleSection`)
- Card de pacote (`RecurringGroupCard`, status agregado: error > pending > disabled > synced)

---

## Débitos técnicos aceitos no MVP

1. **Tokens em texto puro** — acesso restrito via RLS + service_role.
   Migrar pro Supabase Vault (`pgsodium`) em V2 sem alterar a API externa
   desta tabela.
2. **Retry in-process** — `setTimeout` com backoff. Funciona pro volume
   atual. Em V2, migrar pra fila real (tabela `sync_retry_queue` + Edge
   Function a cada 30s — padrão estabelecido na Fase 5).
3. **Banner de mudança externa via `trainer_notifications`** — aproveita
   infra existente de push/banner. UI dedicada fica pra V2.
4. **Reconciliação inicial ao conectar** — feita em background sem
   progress bar explícito. Trainer vê sync acontecer card por card.

---

## Troubleshooting

**"missing_refresh_token" no callback:**
- O Google só devolve refresh_token no primeiro consent. Se o trainer
  já deu consent ao Kinevo antes e nosso app marcou `prompt=consent`
  mas falhou de alguma forma, ele precisa remover o app de
  https://myaccount.google.com/permissions e reconectar.

**Watch channel failing (403 Unauthorized WebHook callback):**
- Domain verification pendente ou `GOOGLE_WEBHOOK_URL` apontando pra
  domínio não verificado.

**Eventos não aparecem no Google:**
- Verifique `google_sync_status` da rotina no banco.
- `pending` = ainda retentando; veja logs da Vercel.
- `error` = checar `last_sync_error` em `google_calendar_connections`.

**Evento aparece duplicado:**
- Pode ter rodado o `renew-google-watch-channels` enquanto o antigo
  ainda emitia. O webhook deduplica por `recurring_appointment_id`,
  então não deve duplicar no Kinevo. Se duplicar no Google, checar se
  não houve reconexão sem desconexão (watch channel órfão).

---

## Referências

- Google Calendar API: https://developers.google.com/calendar/api/v3/reference
- Push Notifications: https://developers.google.com/calendar/api/guides/push
- OAuth 2.0 Web Server Flow: https://developers.google.com/identity/protocols/oauth2/web-server
