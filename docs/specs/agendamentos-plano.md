# Agendamentos — Plano da Feature

**Status:** Rascunho em co-autoria
**Autor:** Gustavo + Claude
**Última atualização:** 23/04/2026

---

## 1. Visão geral

Hoje o trainer do Kinevo não tem onde registrar os horários de atendimento dentro da própria plataforma — usa WhatsApp, a cabeça, ou um calendário externo em paralelo. Isso faz o trainer perder contexto no dia-a-dia (quem vem hoje? que treino?), atrasar, esquecer atendimentos, e recriar manualmente os mesmos horários toda semana porque a maioria dos alunos tem rotina fixa.

**Agendamentos** permite ao trainer criar, visualizar e gerenciar atendimentos 1:1 com seus alunos dentro do Kinevo — com suporte a rotinas recorrentes (semanal, quinzenal, mensal), ajuste prático por drag-and-drop ou remarcação rápida, lembrete automático por push 1h antes e sincronização opcional com o Google Calendar do trainer.

No MVP o escopo é focado no dia-a-dia real do personal: treino presencial 1:1, criado pelo trainer (aluno só recebe notificação), rotinas recorrentes com duração indefinida (valem até o trainer cancelar), edição flexível ("só essa ocorrência" vs. "daqui pra frente"), lembrete push 1h antes e sync one-way Kinevo → Google Calendar. Não é Calendly — o aluno não auto-agenda, não há lista de espera, não há aula em grupo, não há pagamento de no-show. Essas ficam pra V2.

A feature se integra ao que o Kinevo já tem: usa a lista de alunos, conecta com os programas de treino ativos (pra sugerir qual workout fazer no dia), aproveita o sistema de push existente para os lembretes, e liga com a Sala de Treino pra execução.

---

## 2. Decisões já tomadas

Registro consolidado das escolhas desta conversa. Usar como fonte da verdade durante a implementação.

| # | Decisão | Escolha | Por quê |
|---|---------|---------|---------|
| 1 | Quem cria o agendamento | Trainer cria pelo aluno; aluno só recebe notificação | Controle do trainer. Aluno auto-agendar fica pra V2 |
| 2 | Tipos de sessão no MVP | Apenas treino presencial 1:1 | Caso principal do personal; outros tipos adicionam complexidade |
| 3 | Recorrência | Suportada no MVP: semanal, quinzenal, mensal | Rotina fixa é a regra no personal; sem recorrência, trainer tem retrabalho semanal |
| 4 | Duração da recorrência | Indefinida (vale até o trainer cancelar) | Simplifica modelo; trainer encerra quando aluno sair |
| 5 | Edição de ocorrência recorrente | Suporta "só essa ocorrência" e "daqui pra frente" | UX padrão de calendário; cobre 95% dos ajustes reais |
| 6 | Métodos de ajuste | Drag-and-drop no calendário + modal de remarcar rápido | Prioridade do usuário: "fácil e prático de ajustar" |
| 7 | Lembrete | 1 push para o aluno, 1h antes | Mínimo viável; expande pra 24h/pós-sessão em V2 se necessário |
| 8 | Google Calendar | Parte do MVP; sync one-way Kinevo → Google do trainer | Trainer já vive no Google; two-way adiciona conflitos que queremos evitar no MVP |
| 9 | Localização na UI | Aba "Agenda" na sidebar + botão "Agendar" no perfil do aluno | Calendário central como fonte da verdade; atalho contextual onde faz sentido |
| 10 | Comportamento no horário | Nada automático — trainer decide quando abrir Sala de Treino | Evita sobrepor workflow existente; pode automatizar depois se pedirem |
| 11 | No-show | Status "faltou" simples; impacta ranking de aderência | Honesto com dados sem complicar cobrança |
| 12 | Conflitos de horário | Sistema avisa mas permite criar | Trainer sabe dos próprios casos (ex: 2 alunos em espaços diferentes) |
| 13 | Timezone | Nova coluna `timezone` em `trainers` e `students` | Pré-requisito técnico; sem isso, recorrência quebra em horário de verão |

---

## 3. Modelo de dados

### 3.1 Estratégia: seguir o padrão Kinevo

O Kinevo já tem um padrão consistente para schedules recorrentes: **guarda a regra e computa as ocorrências on-the-fly**. Isso é visível em `assigned_workouts.scheduled_days` (array de dias da semana) + `shared/utils/schedule-projection.ts` (calcula ocorrências ao consultar). Sem materialização física, sem jobs de extensão.

Agendamentos vão seguir o mesmo modelo:
- **Uma tabela de regras** (`recurring_appointments`) — define dia da semana, horário e frequência
- **Uma tabela de exceções** (`appointment_exceptions`) — só guarda desvios pontuais (remarcações individuais, cancelamentos de uma ocorrência, no-shows)
- **Um helper `appointments-projection.ts`** — expande a regra + aplica exceções para retornar ocorrências em qualquer janela de datas

Vantagens desse modelo no contexto do Kinevo:
- Mesmo mental model que o trainer já usa pra programas de treino
- Editar a rotina inteira = atualizar 1 linha (a regra)
- Não precisa job de cron pra manter janela de materialização
- Tabelas pequenas (uma linha por rotina + exceções raras)

### 3.2 Timezone

Seguir o padrão atual do codebase: **hardcoded `America/Sao_Paulo`** no código cliente/servidor, nenhuma coluna nova. Todo timestamp guardado em `TIMESTAMPTZ` (UTC no banco) e renderizado com `Intl.DateTimeFormat` no timezone fixo. Quando o Kinevo atender trainers fora do Brasil, aí se adiciona a coluna.

### 3.3 Nova tabela `recurring_appointments`

Guarda a **regra** da rotina. Uma linha = uma rotina fixa de um aluno.

```sql
CREATE TABLE recurring_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- Regra de recorrência
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
    start_time TIME NOT NULL,              -- ex: '07:00'
    duration_minutes SMALLINT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    frequency TEXT NOT NULL DEFAULT 'weekly'
        CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),

    -- Ciclo de vida
    starts_on DATE NOT NULL,               -- primeira ocorrência válida
    ends_on DATE,                          -- NULL = indefinido (padrão do MVP)
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'canceled')),

    -- Metadados
    notes TEXT,                            -- observação livre do trainer
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_appointments_trainer ON recurring_appointments(trainer_id);
CREATE INDEX idx_recurring_appointments_student ON recurring_appointments(student_id);
CREATE INDEX idx_recurring_appointments_active ON recurring_appointments(trainer_id, status) WHERE status = 'active';
```

### 3.4 Nova tabela `appointment_exceptions`

Guarda **desvios pontuais** de uma regra. Uma linha = uma ocorrência específica modificada. Se não houver linha de exceção, a ocorrência segue a regra.

```sql
CREATE TABLE appointment_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_appointment_id UUID NOT NULL REFERENCES recurring_appointments(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    -- Data original da ocorrência (antes de qualquer mudança)
    occurrence_date DATE NOT NULL,

    -- O que mudou nesta ocorrência específica
    kind TEXT NOT NULL CHECK (kind IN ('rescheduled', 'canceled', 'completed', 'no_show')),

    -- Se remarcada: novos horário/data. NULL nos outros kinds.
    new_date DATE,
    new_start_time TIME,

    -- Notas opcionais (ex: motivo da remarcação ou falta)
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Uma ocorrência só pode ter uma exceção
    UNIQUE (recurring_appointment_id, occurrence_date)
);

CREATE INDEX idx_appointment_exceptions_recurring ON appointment_exceptions(recurring_appointment_id);
CREATE INDEX idx_appointment_exceptions_trainer_date ON appointment_exceptions(trainer_id, occurrence_date);
```

**Como funciona na prática:**
- Trainer cria rotina "João, toda terça 7h" → 1 linha em `recurring_appointments`
- Numa terça específica o João vem às 8h → 1 linha em `appointment_exceptions` com `kind='rescheduled'` e `new_start_time='08:00'`
- Numa terça que o João falta → 1 linha em `appointment_exceptions` com `kind='no_show'`
- Trainer cancela a rotina em dezembro → `status='canceled'` na regra, `ends_on` preenchido com a data de corte

### 3.5 Agendamentos únicos (não-recorrentes)

O modelo acima só cobre rotinas recorrentes. Para agendamentos únicos ("esse aluno só vem uma vez pra avaliação"), o trainer pode criar uma rotina com `frequency='weekly'` e `starts_on = ends_on` (só uma ocorrência válida). Sem nova tabela.

Alternativa futura: aceitar `frequency='once'` e ignorar `day_of_week`. Mas no MVP, o primeiro approach evita código condicional.

### 3.6 Relações com o que já existe

- **`trainers`** — FK `trainer_id`, ON DELETE CASCADE (trainer apagado → agendamentos somem)
- **`students`** — FK `student_id`, ON DELETE CASCADE
- **`assigned_workouts`** — **sem FK direta**. Ao renderizar uma ocorrência, o frontend consulta `getScheduledWorkoutsForDate()` do aluno para aquele dia e sugere qual workout fazer (se houver). Isso evita manter referência que pode ficar stale quando o programa muda.
- **`workout_sessions`** — **sem FK direta no MVP**. Quando o trainer abre a Sala de Treino a partir de um agendamento, a sessão criada é independente. Podemos adicionar a ligação depois se quisermos relatórios tipo "% de agendamentos que viraram sessão efetiva".
- **`workout_sessions.scheduled_date`** — campo pré-existente, fica como está. Não estamos populando a partir de agendamentos no MVP.

### 3.7 Row Level Security (RLS)

Seguir o padrão do `assistant_insights`:

```sql
-- recurring_appointments
ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainer can read own recurring appointments" ON recurring_appointments
    FOR SELECT USING (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can insert own recurring appointments" ON recurring_appointments
    FOR INSERT WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can update own recurring appointments" ON recurring_appointments
    FOR UPDATE USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can delete own recurring appointments" ON recurring_appointments
    FOR DELETE USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access recurring" ON recurring_appointments
    FOR ALL USING (auth.role() = 'service_role');

-- appointment_exceptions: mesma estrutura, trocar nome da tabela
```

### 3.8 Extensão para Google Calendar

Duas adições quando chegar a Fase 4 (Google Calendar):

**Tabela `google_calendar_connections`** — guarda credenciais OAuth do trainer:

```sql
CREATE TABLE google_calendar_connections (
    trainer_id UUID PRIMARY KEY REFERENCES trainers(id) ON DELETE CASCADE,
    google_account_email TEXT NOT NULL,
    calendar_id TEXT NOT NULL,              -- ID do calendário destino (normalmente 'primary')
    access_token TEXT NOT NULL,             -- criptografado em repouso (Supabase Vault)
    refresh_token TEXT NOT NULL,            -- criptografado
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,                    -- escopos concedidos
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_sync_at TIMESTAMPTZ,
    last_sync_error TEXT
);
```

**Coluna de sync na `recurring_appointments`:**
```sql
ALTER TABLE recurring_appointments
    ADD COLUMN google_event_id TEXT,              -- ID do evento recorrente no Google
    ADD COLUMN google_sync_status TEXT DEFAULT 'pending'
        CHECK (google_sync_status IN ('pending', 'synced', 'error', 'disabled'));
```

Uma rotina recorrente do Kinevo vira **um evento recorrente no Google** (aproveitando `RRULE`), não N eventos individuais. Exceções do Kinevo viram "single instance overrides" no Google.

Detalhes completos do fluxo de OAuth, erros e reconciliação ficam na **Seção 5 (Google Calendar)**.

---

## 4. Fluxos do usuário

Todos os fluxos são do trainer. O aluno só recebe notificação (MVP).

### 4.1 Criar agendamento

Dois caminhos de entrada levam ao mesmo modal — só muda o que vem pré-preenchido.

**Caminho A — pelo perfil do aluno:**
1. Trainer abre a página do aluno
2. Clica em "Agendar" (botão perto dos outros atalhos do aluno)
3. Modal abre com o aluno já selecionado e bloqueado

**Caminho B — pelo calendário (aba Agenda):**
1. Trainer clica num slot vazio do calendário (ou botão "Novo agendamento")
2. Modal abre com o dia/horário clicado pré-preenchidos
3. Trainer escolhe o aluno via busca com autocomplete

**Campos do modal** (na ordem):
- Aluno (busca com autocomplete — obrigatório)
- Dia da semana + horário de início + duração (obrigatórios; duração com opções rápidas 45/60/90 min, default 60)
- Frequência: semanal / quinzenal / mensal (default semanal)
- Data de início: default "próxima ocorrência desse dia da semana" a partir de hoje
- Notas / observações (opcional, texto livre)

**Ao salvar:**
- Sistema valida conflitos (se houver outra rotina do trainer no mesmo dia+horário)
- Se houver conflito, mostra alerta "Você já tem agendamento com [aluno X] nesse horário. Deseja continuar?" — não bloqueia
- Cria a regra em `recurring_appointments` com `status='active'`
- Mostra toast "Agendamento criado"
- Se conectado ao Google Calendar, cria evento recorrente (assíncrono, sem bloquear UI)

### 4.2 Visualizar agendamentos

**Na aba Agenda (vista principal):**
- Calendário semanal por default (scroll horizontal pra semanas futuras/passadas)
- Cada agendamento é um card colorido no dia+horário
- Ocorrências derivadas da regra + exceções aplicadas (rescheduled, canceled)
- Cards mostram nome do aluno + horário; hover mostra mais detalhes
- Botão de alternar pra vista mensal (fica pra Fase 5)

**No dashboard (widget "Próximos agendamentos"):**
- Lista dos próximos 3-5 agendamentos (a partir de agora)
- Formato: horário + aluno + data (ex: "Terça 7h — Cristina")
- Clicar abre o detalhe do agendamento

**No perfil do aluno:**
- Seção mostrando a rotina atual daquele aluno (se existir)
- "João treina toda terça e quinta às 7h"

### 4.3 Editar / remarcar uma ocorrência específica

**Via drag-and-drop no calendário:**
- Trainer arrasta o card pra outro dia/horário dentro da grade semanal
- Libera o card → cria uma linha em `appointment_exceptions` com `kind='rescheduled'` e `new_date`/`new_start_time`
- Drag sempre afeta só aquela ocorrência (nunca a rotina toda)
- Toast "Remarcado para [novo dia/horário]"

**Via modal "Remarcar":**
- Trainer clica num card → abre popover com ações: "Remarcar", "Cancelar essa", "Editar rotina"
- "Remarcar" abre modal perguntando:
  - Novo dia + horário
  - Escopo: [ ] Apenas essa ocorrência  [ ] Essa e as próximas (daqui pra frente)
- Se "apenas essa" → cria exceção
- Se "daqui pra frente" → atualiza a regra principal (muda `day_of_week`, `start_time`) + define um `ends_on` na rotina antiga + cria nova rotina com a mudança válida a partir do novo `starts_on`

### 4.4 Editar a rotina inteira

- Do card no calendário ou do perfil do aluno, "Editar rotina"
- Modal igual ao de criação, pré-preenchido com os dados da regra
- Trainer pode ajustar dia/horário/frequência/notas
- Ao salvar: atualiza a linha em `recurring_appointments`; exceções existentes permanecem (não são reavaliadas)
- Se mudou dia da semana ou frequência e houver exceções no futuro, mostrar aviso "Essa rotina tem [N] ajustes individuais no futuro. Eles serão mantidos"

### 4.5 Cancelar

**Cancelar apenas uma ocorrência:**
- Card → "Cancelar essa"
- Cria exceção com `kind='canceled'`
- Card desaparece do calendário; histórico preservado

**Cancelar a rotina inteira (a partir de uma data):**
- Do detalhe/edição da rotina: botão "Encerrar rotina"
- Pergunta "A partir de quando?" (default: próxima ocorrência futura)
- Muda `status='canceled'` e define `ends_on` na regra
- Ocorrências após `ends_on` param de aparecer

### 4.6 Conduzir a sessão

No horário do agendamento, **nada automático acontece** (decisão da Seção 2, item 10).

- O agendamento continua aparecendo no dashboard como "acontecendo agora" (destaque sutil)
- Trainer decide quando abrir a Sala de Treino manualmente
- **Atalho opcional**: o card do agendamento tem um botão "Abrir na Sala de Treino" que leva direto, pré-carregando o aluno
- Sala de Treino permanece funcionando igual hoje (ad-hoc). Agendamento é só contexto visual.

### 4.7 Marcar como concluído ou faltou

Após o horário passar, o card do agendamento ganha ações:
- **Concluído** (padrão se o trainer abrir Sala de Treino e finalizar uma sessão): cria exceção `kind='completed'`
- **Faltou**: trainer clica "Marcar falta" no card → cria exceção `kind='no_show'`. Impacta no ranking de aderência.
- **Nada**: se o trainer não marcar, o card vira "passado sem registro". Não impacta métricas mas fica visível no histórico.

**Automação leve (incluída no MVP):**
- Se o trainer conclui uma sessão na Sala de Treino no dia/horário de um agendamento, o sistema pergunta "Essa sessão era do agendamento das 7h com João?" → se sim, cria exceção `kind='completed'` automaticamente.
- Se o horário de um agendamento passa e nada foi marcado até o fim do dia, o sistema não assume automaticamente que faltou — fica como "passado sem registro" e o trainer pode marcar depois.

### 4.8 Notificação ao aluno

- **Ao criar** a rotina: push "Seu treinador agendou treinos toda [dia] às [hora]"
- **1h antes** de cada ocorrência: push "Seu treino com [trainer] é em 1 hora"
- **Ao remarcar** uma ocorrência: push "Seu treino foi remarcado para [novo dia/hora]"
- **Ao cancelar** uma ocorrência: push "Seu treino de [dia/hora] foi cancelado"

Todos usam o sistema `push_tickets` + `student_notification_preferences` já existente.

---

## 5. Google Calendar

### 5.1 Escopo da integração

Apesar de a Seção 2 ter marcado "sync one-way Kinevo → Google", o refinamento da Seção 4 eleva o escopo para **sync quase-bidirecional**: o Kinevo é a fonte da verdade, mas detecta mudanças feitas diretamente no Google Calendar e reconcilia.

**O que o Kinevo escreve no Google:**
- Cada rotina recorrente vira **um evento recorrente** no Google (com `RRULE`). Mais eficiente que N eventos individuais.
- Cada exceção (remarcação, cancelamento) vira uma "instance override" no mesmo evento recorrente.
- Título do evento: `[Kinevo] Treino — <nome do aluno>`.
- Descrição: link pro Kinevo + notas da rotina + info do aluno.

**O que o Kinevo escuta do Google:**
- Trainer editou horário/título/descrição do evento → Kinevo mostra alerta "Evento editado fora do Kinevo, deseja sincronizar?"
- Trainer deletou evento no Google → Kinevo cancela a ocorrência correspondente (exceção `kind='canceled'`)
- Trainer deletou o evento recorrente inteiro no Google → Kinevo encerra a rotina (`status='canceled'`)

### 5.2 Fluxo OAuth 2.0 e escolha de calendário

**Conexão inicial (uma vez por trainer):**
1. Trainer vai em Configurações → Integrações → "Conectar Google Calendar"
2. Clique abre popup OAuth do Google com escopo `https://www.googleapis.com/auth/calendar`
3. Trainer aprova o acesso
4. Popup retorna com `access_token` + `refresh_token`
5. Kinevo chama `GET /calendar/v3/users/me/calendarList` e **mostra seleção** ("Em qual calendário seus agendamentos Kinevo devem aparecer?")
6. Opções pré-destacadas: calendário primário do trainer + opção "Criar calendário novo chamado 'Kinevo'"
7. Trainer escolhe; Kinevo salva em `google_calendar_connections` com `calendar_id` selecionado
8. Kinevo cria **watch channel** (webhook) pra esse calendário — permite detectar mudanças externas

**Renovação de token:**
- `access_token` expira em 1h; Kinevo usa `refresh_token` automaticamente antes de cada operação
- Se `refresh_token` for revogado pelo usuário, Kinevo marca `google_sync_status='error'` em todos os agendamentos do trainer e mostra banner "Reconectar Google Calendar" nas Configurações

**Desconexão:**
- Trainer vai em Configurações → "Desconectar Google Calendar"
- Kinevo para o watch channel, deleta a linha de `google_calendar_connections`
- **Não remove** eventos já criados no Google (trainer pode remover manualmente se quiser)
- Agendamentos no Kinevo continuam funcionando normalmente

### 5.3 Criação e sync de eventos

**Estratégia de sync: híbrida (síncrono com fallback assíncrono)**

Quando o trainer cria/edita/cancela um agendamento no Kinevo:
1. UI chama o server action com a mudança
2. Server tenta chamar Google Calendar API com **timeout de 3 segundos**
3. **Se o Google responde rápido:** retorna sucesso pra UI com o `google_event_id` salvo; toast "Sincronizado com Google Calendar"
4. **Se o Google demora mais de 3s ou falha:** retorna sucesso pra UI (a mudança no Kinevo já foi persistida); marca `google_sync_status='pending'`; um worker assíncrono retenta em background (exponential backoff: 30s, 2min, 10min, 1h)
5. Se todas as tentativas falharem, `google_sync_status='error'` e badge "Não sincronizado" aparece no card do agendamento

**Mapeamento Kinevo → Google:**
| Ação no Kinevo | Chamada na Google API |
|----------------|----------------------|
| Criar rotina recorrente | `POST /events` com `recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TU']` |
| Remarcar 1 ocorrência | `PATCH /events/{eventId}/instances/{instanceId}` |
| Cancelar 1 ocorrência | `DELETE /events/{eventId}/instances/{instanceId}` |
| Editar rotina inteira | `PATCH /events/{eventId}` |
| Cancelar rotina inteira | `DELETE /events/{eventId}` |

### 5.4 Detectando mudanças feitas no Google

**Via webhooks (Google Calendar Push Notifications):**
- Ao conectar, Kinevo registra um watch channel apontando pra `https://app.kinevo.com.br/api/webhooks/google-calendar`
- Quando qualquer evento do calendário muda no Google, Google faz POST nesse webhook
- Kinevo busca o evento alterado via API, compara com a última versão salva, identifica o tipo de mudança

**Tratamento por tipo de mudança:**

1. **Trainer moveu horário/data de uma ocorrência no Google:**
   - Kinevo detecta a diferença
   - Mostra banner no dashboard: "Evento do Kinevo foi editado direto no Google Calendar. Deseja refletir essa mudança aqui?"
   - Se confirmar: cria exceção `kind='rescheduled'` com os novos valores
   - Se negar: próxima edição no Kinevo sobrescreve o Google

2. **Trainer deletou uma ocorrência no Google:**
   - Kinevo cria exceção `kind='canceled'` automaticamente (sem perguntar — delete é intenção clara)
   - Notifica o aluno do cancelamento (mesmo push do fluxo 4.8)

3. **Trainer deletou o evento recorrente inteiro no Google:**
   - Kinevo encerra a rotina (`status='canceled'`, `ends_on=today`)
   - Banner: "Sua rotina com [aluno] no Google foi removida e encerramos também no Kinevo"

4. **Trainer editou título/descrição no Google:**
   - Kinevo ignora (não queremos que o trainer corrompa nosso formato padrão)
   - Próxima sync do Kinevo sobrescreve com o formato correto

**Renovação do watch channel:**
- Watch channels do Google expiram em 7 dias. Kinevo tem um cron (Supabase Edge Function agendada diariamente) que renova channels próximos do vencimento.

### 5.5 Edge cases e falhas

| Situação | Comportamento |
|----------|---------------|
| Trainer revoga acesso do Kinevo no Google | Próxima chamada falha com 401 → marca conexão como `status='revoked'`, banner pra reconectar, agendamentos do Kinevo continuam funcionando |
| Google API fora do ar por horas | Worker assíncrono retenta com backoff; agendamentos marcados como `google_sync_status='pending'`; badge visual no card |
| Conflito: trainer edita o evento no Google E no Kinevo ao mesmo tempo | Último write wins. Kinevo é a fonte da verdade — próxima sync do Kinevo sobrescreve |
| Trainer conecta Google Calendar depois de já ter criado agendamentos no Kinevo | Ao conectar, Kinevo faz sync inicial em background (cria todos os eventos recorrentes no Google); banner de progresso "Sincronizando 12 rotinas..." |
| Trainer troca de calendário destino (ex: mudou de "Pessoal" pra "Kinevo") | Desconecta + reconecta. Eventos antigos no calendário anterior não são migrados automaticamente (trainer pode deletá-los manualmente) |

### 5.6 Privacidade e dados do aluno

- Evento no Google Calendar inclui: nome do aluno, horário, duração, notas da rotina
- **Não inclui**: telefone, email, histórico médico, peso, programa de treino
- Descrição do evento tem link pra `kinevo.com.br/students/<id>` — trainer precisa estar logado no Kinevo pra ver detalhes
- Trainer pode desconectar Google Calendar a qualquer momento sem perder nada no Kinevo

---

## 6. Lembretes

### 6.1 Visão geral

Os pushes pro aluno são de dois tipos (conforme Seção 4.8):
- **Eventos imediatos** — criação/remarcação/cancelamento de agendamento. Disparam na hora em que o trainer faz a ação.
- **Lembrete programado** — push "seu treino é em 1 hora" precisa ser disparado 1h antes do horário do agendamento, sem que o trainer faça nada naquele momento.

Eventos imediatos reusam a infra existente (`student_inbox_items` + `send-push-notification`). Lembretes programados precisam de um pequeno componente novo: uma tabela de pushes agendados + Edge Function que varre ela periodicamente.

### 6.2 Reuso da infra existente

O Kinevo já tem um pipeline bem azeitado pra pushes:
- Tabela `student_inbox_items` recebe INSERTs de notificações pro aluno
- Database Webhook do Supabase dispara a Edge Function `send-push-notification`
- Edge consulta `push_tokens` do aluno, envia pro Expo, registra em `push_tickets`

Para os eventos imediatos (criação/remarcação/cancelamento), o fluxo é direto: o server action que cria o agendamento faz um INSERT em `student_inbox_items` com título+body apropriados. Sem novo código de infra.

### 6.3 Lembrete programado: tabela `scheduled_notifications`

Nova tabela pequena que guarda pushes futuros pendentes:

```sql
CREATE TABLE scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Alvo do push
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    -- Quando disparar
    scheduled_for TIMESTAMPTZ NOT NULL,

    -- O que mandar
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,

    -- Contexto (permite cancelar/atualizar quando agendamento muda)
    source TEXT NOT NULL CHECK (source IN ('appointment_reminder')),
    recurring_appointment_id UUID REFERENCES recurring_appointments(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,

    -- Estado
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'canceled', 'failed')),
    sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Uma ocorrência específica só pode ter um lembrete
    UNIQUE (recurring_appointment_id, occurrence_date, source)
);

CREATE INDEX idx_scheduled_notifications_dispatch
    ON scheduled_notifications(scheduled_for)
    WHERE status = 'pending';
```

### 6.4 Quando as linhas são criadas

- **Ao criar uma rotina**: backend insere N linhas em `scheduled_notifications` — uma por ocorrência nos próximos 30 dias (equivalente à janela do dashboard/calendário)
- **Diariamente**: uma rotina estende a janela (cria lembretes do dia 31 em diante, mantendo sempre 30 dias à frente)
- **Ao remarcar uma ocorrência**: atualiza `scheduled_for` da linha correspondente (se ainda `pending`) ou cria nova
- **Ao cancelar uma ocorrência**: muda `status='canceled'` na linha correspondente
- **Ao cancelar a rotina inteira**: `UPDATE ... SET status='canceled' WHERE recurring_appointment_id = X AND status='pending'`

### 6.5 Disparador

**Edge Function `dispatch-scheduled-notifications` agendada via `pg_cron` a cada 5 minutos:**

1. Busca até 100 linhas com `scheduled_for <= now()` e `status = 'pending'`
2. Pra cada linha, insere em `student_inbox_items` (dispara o pipeline existente)
3. Marca linha como `status='sent', sent_at=now()`
4. Se inserção falhar, marca `status='failed'` e loga o erro

Atraso máximo: 5 minutos. Como o lembrete é 1h antes, isso é perfeitamente aceitável (aluno recebe entre 55 e 65 min antes).

**Por que 5 min e não 1 min:** nenhum ganho prático (ninguém nota diferença de 5 min num push de 1h) e reduz 80% do custo de execução da função.

### 6.6 Textos dos pushes (propostos)

| Evento | Título | Body |
|--------|--------|------|
| Rotina criada | "Novo agendamento" | "Seu treinador agendou treinos toda [dia da semana] às [hora]" |
| Lembrete 1h antes | "Treino em 1 hora" | "Seu treino com [trainer] é às [hora]" |
| Ocorrência remarcada | "Treino remarcado" | "Seu treino foi remarcado para [data] às [nova hora]" |
| Ocorrência cancelada | "Treino cancelado" | "Seu treino de [data/hora] foi cancelado" |
| Rotina cancelada | "Agendamento encerrado" | "Os treinos que aconteciam toda [dia] foram encerrados" |

Textos ficam em um arquivo de constantes centralizadas pra facilitar ajustes depois (ex: `shared/constants/notification-messages.ts`).

### 6.7 Preferências do aluno

Respeitar `student_notification_preferences` já existente. O push só é enviado se o aluno tiver `push_enabled = true` E a categoria `reminders` (ou equivalente) habilitada.

Se o aluno desligar lembretes, os registros em `scheduled_notifications` continuam sendo criados mas a Edge Function ignora no momento de enviar. Isso permite o aluno religar depois sem perder lembretes futuros.

---

## 7. Roadmap em fases

Sete fases, cada uma entregável e testável de forma independente. Fase 1–7 compõem o MVP. O MVP está completo quando a Fase 7 é concluída.

Cada fase vai gerar uma **spec de desenvolvimento** separada (arquivo `.md` dedicado sob `docs/specs/agendamentos/`), pronta para o Claude Code executar.

**Convenção de testes** (seguindo padrão do Kinevo):
- **Shared (`shared/utils/appointments-projection.ts` etc.)**: Vitest com ambiente Node, testes colocados em `__tests__/` adjacente ao arquivo
- **Server actions e API handlers**: Vitest + mocks de Supabase via `vi.mock()`, testes em `__tests__/` adjacente
- **Componentes React**: Vitest + React Testing Library + setup global de `src/test/setup.tsx`
- **Stores Zustand**: Vitest, acesso via `getState()`, reset em `beforeEach`
- Toda fase inclui testes — não é passo opcional

### Fase 1 — Modelo de dados e projeção

**Objetivo:** base de dados e lógica de expansão de ocorrências funcionando. Nenhuma UI ainda.

**Entregáveis:**
- Migration criando `recurring_appointments` e `appointment_exceptions` (Seção 3.3 e 3.4)
- RLS policies seguindo padrão do Kinevo (Seção 3.7)
- Helper `shared/utils/appointments-projection.ts` análogo ao `schedule-projection.ts`:
  - `getAppointmentsInRange(trainerId, start, end)` → expande regras, aplica exceções, retorna ocorrências
  - `getAppointmentsForDay(trainerId, date)` → atalho pra 1 dia
  - `getNextOccurrences(trainerId, limit)` → próximas N ocorrências a partir de agora
- Testes unitários cobrindo: recorrência semanal/quinzenal/mensal, remarcação, cancelamento de ocorrência, rotina encerrada
- Types TypeScript em `shared/types/appointments.ts`

**Como validar:** testes automatizados passam. Queries manuais no banco funcionam. Nenhuma UI quebra.

---

### Fase 2 — CRUD de rotina (backend)

**Objetivo:** server actions e lógica de negócio pra criar/editar/cancelar rotinas e exceções. Ainda sem UI final, mas testável via chamadas diretas.

**Entregáveis:**
- Server actions em `web/src/actions/appointments/`:
  - `createRecurringAppointment(input)` — cria rotina, valida conflito (avisa mas permite)
  - `updateRecurringAppointment(id, input)` — edita rotina inteira
  - `cancelRecurringAppointment(id, endsOn)` — encerra rotina
  - `rescheduleOccurrence(recurringId, originalDate, newDate, newTime, scope)` — remarca (scope: `only_this` ou `this_and_future`)
  - `cancelOccurrence(recurringId, date)` — cancela 1 ocorrência
  - `markOccurrenceStatus(recurringId, date, status)` — `completed` ou `no_show`
- Validação: server-side usando Zod (seguindo padrão do projeto)
- Empty state inicial: se trainer tentar usar sem programa ativo, mostrar warning

**Como validar:** chamadas diretas via teste ou via console funcionam. Dados ficam corretos no banco.

---

### Fase 3 — UI essencial: modal de criação + botão no perfil do aluno

**Objetivo:** trainer consegue criar rotinas e ver uma lista simples. Primeira experiência visível.

**Entregáveis:**
- Componente `CreateAppointmentModal` com os campos da Seção 4.1
- Botão "Agendar" no header do perfil do aluno (`/students/[id]`), com o aluno pré-preenchido
- Seção "Rotina atual" no perfil do aluno listando a rotina ativa
- Ações básicas na rotina: editar, encerrar
- Detecção de conflito com alerta "Você já tem agendamento com [aluno X] nesse horário"

**Como validar:** trainer consegue criar rotina pelo perfil do aluno, ver, editar e encerrar. Tudo persiste.

---

### Fase 4 — Widget de dashboard "Próximos agendamentos"

**Objetivo:** agendamentos aparecem no dashboard, substituindo o placeholder atual "Em breve".

**Entregáveis:**
- `UpcomingAppointmentsWidget` em `web/src/components/dashboard/`:
  - Lista as próximas 3-5 ocorrências a partir de agora
  - Cada linha: horário + aluno + data + ações rápidas (remarcar, cancelar)
  - Empty state: "Nenhum agendamento marcado. Comece criando uma rotina no perfil de um aluno."
- Substitui o componente placeholder no widget-grid
- Popover de ações rápidas ao clicar num item: remarcar, cancelar, abrir perfil do aluno
- Backend: estende `get-dashboard-data.ts` para incluir `upcomingAppointments`

**Como validar:** widget aparece no lugar certo, mostra dados reais, ações rápidas funcionam.

---

### Fase 5 — Lembretes push

**Objetivo:** aluno recebe notificações nos eventos-chave da Seção 4.8.

**Entregáveis:**
- Migration criando `scheduled_notifications` (Seção 6.3)
- Edge Function `dispatch-scheduled-notifications` (Seção 6.5)
- Agendamento via pg_cron rodando a cada 5 minutos
- Integração nas server actions da Fase 2:
  - Criar rotina → insere linhas em `scheduled_notifications` pra próximas 30 dias + dispara push "criada" imediato
  - Remarcar → atualiza linha correspondente + dispara push "remarcado" imediato
  - Cancelar → marca linha como `canceled` + dispara push "cancelado" imediato
- Rotina diária que estende a janela de 30 dias (Edge Function `extend-scheduled-notifications`)
- Textos centralizados em `shared/constants/notification-messages.ts`
- Respeitar `student_notification_preferences`

**Como validar:** criar um agendamento pra daqui a ~1h10min e receber push; remarcar e receber push; cancelar e receber push.

---

### Fase 6 — Google Calendar sync

**Objetivo:** trainer conecta Google Calendar e seus agendamentos aparecem lá; mudanças diretas no Google refletem no Kinevo.

**Entregáveis:**
- Migration criando `google_calendar_connections` (Seção 3.8) + colunas sync em `recurring_appointments`
- Fluxo OAuth 2.0 em `/settings/integrations/google-calendar` (Seção 5.2)
- Seleção de calendário destino na conexão
- Server actions integrando com Google Calendar API:
  - Criar evento recorrente ao criar rotina
  - Patch ao remarcar/editar
  - Delete ao cancelar
- Sync híbrida: síncrona com timeout 3s, fallback assíncrono (Seção 5.3)
- Watch channels + webhook `/api/webhooks/google-calendar` pra detectar mudanças externas (Seção 5.4)
- Edge Function diária pra renovar watch channels próximos do vencimento
- Badge "Sincronizado com Google Calendar" nos cards de agendamento; badge de erro se sync falhar

**Como validar:** trainer conecta, cria agendamento no Kinevo → aparece no Google; edita no Google → Kinevo detecta e pergunta; desconecta → agendamentos no Kinevo continuam funcionando.

---

### Fase 7 — Aba Agenda com calendário visual

**Objetivo:** vista rica de calendário semanal com drag-and-drop. Encerra o MVP.

**Entregáveis:**
- Nova rota `/schedule` e item "Agenda" na sidebar
- Vista semanal como default (scroll horizontal pra semanas futuras/passadas)
- Cards de agendamento coloridos com horário + nome do aluno
- Click no slot vazio abre modal de criação com horário pré-preenchido
- Click no card abre popover com ações: remarcar, cancelar essa, editar rotina
- Drag-and-drop pra remarcar uma ocorrência (sempre afeta só aquela, Seção 4.3)
- Navegação entre semanas (botões + atalhos teclado)
- Indicador visual "Hoje" e "Agora" (linha horizontal)
- Performance: usar virtualization se calendário ficar pesado em semanas com muitos agendamentos

**Como validar:** aba Agenda abre, mostra semana atual, criação por click funciona, drag-and-drop funciona, navegação entre semanas funciona.

---

### Resumo visual

| Fase | Entrega | Dependências |
|------|---------|--------------|
| 1 | Schema + projeção | — |
| 2 | Server actions CRUD | 1 |
| 3 | Modal criação + perfil do aluno | 2 |
| 4 | Widget dashboard | 2 |
| 5 | Lembretes push | 2, infra push existente |
| 6 | Google Calendar sync | 2 |
| 7 | Aba Agenda com calendário | 3, 4 (pra reuso do modal) |

Fases 3, 4, 5 e 6 podem ser executadas **em paralelo** se houver múltiplos devs — todas dependem apenas da Fase 2. Na prática, Claude Code deve fazer uma de cada vez pra evitar conflitos de merge.

---

## 8. Fora de escopo (V2+)

Esta seção existe para gerenciar expectativas e registrar o backlog de V2. Itens aqui **não** entram no MVP — se virarem necessidade, viram projetos separados.

### 8.1 Capacidades de produto

- **Aluno auto-agendar**: modelo Calendly (trainer publica disponibilidade, aluno escolhe slot). Requer toda uma infra de disponibilidade, cadeia de confirmação e UI mobile.
- **Aulas em grupo**: múltiplos alunos no mesmo slot, capacidade máxima, lista de espera. Dobra a complexidade do schema e da UI.
- **Tipos de sessão distintos**: avaliação física, consultoria online, reavaliação. Cada tipo teria campos próprios (link de vídeo-chamada, duração específica, form obrigatório).
- **Pagamento atrelado a no-show**: cobrar o aluno quando falta sem avisar, integração com billing, regras de tolerância.
- **Bloco de horários indisponíveis**: trainer marca "não atendo entre 12h–14h" ou férias. Hoje seria necessário criar uma rotina "bloqueada" manualmente.
- **Lembretes configuráveis**: 24h antes, 2h antes, personalizáveis por aluno. MVP fixa em 1h.
- **Histórico longo e relatórios**: agregados tipo "quantas sessões o João fez este mês", "% de no-shows por aluno ao longo de 6 meses". Pode ser derivado das tabelas de agendamentos quando o volume de dados justificar.
- **Lista de espera**: fila de alunos que querem um horário quando houver cancelamento.
- **Recorrência complexa**: "a cada 3 semanas", "primeira segunda do mês", "exceto dezembro". MVP só cobre semanal/quinzenal/mensal fixas.

### 8.2 Integrações

- **Two-way sync completo Google Calendar**: trainer edita no Google e Kinevo reflete automaticamente sem perguntar. MVP pergunta antes de aplicar (Seção 5.4).
- **Outros calendários**: Apple Calendar, Outlook, Proton Calendar. MVP só Google.
- **Exportar .ics**: gerar link de subscribe pra outros clientes de calendário. Útil mas não crítico.
- **Videochamada integrada**: Google Meet, Zoom — criação automática de link ao agendar sessão online. Depende de "consultoria online" existir como tipo.
- **WhatsApp**: confirmação/lembrete via WhatsApp além de push. Integração com API oficial do WhatsApp Business é não-trivial.

### 8.3 Automações

- **Confirmação pelo aluno**: aluno recebe push e precisa confirmar presença. Sem confirmação, trainer é avisado.
- **No-show automático**: se trainer não abrir Sala de Treino até X minutos após o horário, sistema marca como no-show automaticamente. MVP é manual.
- **Reagendar automaticamente**: se aluno marca falta no app, sistema sugere horário alternativo na semana. Depende de o aluno ter app ativo.
- **Regras por aluno**: "João sempre faz treino A nas segundas e treino B nas quartas". Liga agendamento direto ao workout do programa, não só ao aluno.

### 8.4 Variáveis por trainer

- **Timezones múltiplos**: MVP é Brasil/São Paulo hardcoded. Quando o Kinevo for internacional, adicionar coluna `timezone` em trainers e students.
- **Moeda e idioma**: sem relevância no MVP, mas seria necessário pra pagamento de no-show e textos de push.

---

## Apêndice

### A. Investigação técnica

Durante o planejamento, foram conduzidas três investigações no codebase para garantir que as decisões seguissem padrões existentes:

**1. Modelo de dados atual (para encaixar agendamentos):**
- `assigned_workouts.scheduled_days` usa array `integer[]` de dias da semana, computado on-the-fly via `shared/utils/schedule-projection.ts`. Não há materialização de ocorrências no banco.
- `workout_sessions.scheduled_date` existe mas é minimamente usado (só em `finish-training-room-workout.ts`).
- Nenhuma tabela ou coluna de agendamento/appointment pré-existente.
- Timezone é hardcoded `America/Sao_Paulo` em `web/src/lib/dashboard/get-dashboard-data.ts`.

**2. Convenções de schema e RLS:**
- Todos os timestamps são `TIMESTAMPTZ`.
- Enums feitos com TEXT + CHECK constraint (não ENUM types do Postgres).
- FKs pra alunos usam `ON DELETE CASCADE`; pra trainers também, exceto referências opcionais (`SET NULL`).
- Padrão de RLS em `assistant_insights` (migração 088): `trainer_id = current_trainer_id()` + service_role bypass.
- `current_trainer_id()` definida na migração 001.

**3. Infra de notificações push:**
- Pipeline existente: `student_inbox_items` / `trainer_notifications` + Database Webhook → Edge Function `send-push-notification` → Expo Push API.
- `push_tickets` guarda status de entrega.
- `student_notification_preferences` permite desligar por categoria.
- Nenhum pg_cron agendado no projeto hoje; Edge Functions sob `supabase/functions/`.

**4. Convenções de teste:**
- Vitest em duas configs (web=jsdom, shared=node).
- Colocação: `__tests__/` adjacente ao arquivo testado.
- Supabase mockado via `vi.mock()`, Zustand acessado via `getState()`.
- Setup global em `src/test/setup.tsx` mocka `next/navigation`, `next/image`, framer-motion.

### B. Changelog deste documento

| Data | Mudança |
|------|---------|
| 23/04/2026 | Criação inicial com as 8 seções + apêndice |
| 23/04/2026 | Seção 1: escopo ampliado para incluir recorrência no MVP |
| 23/04/2026 | Seção 3: adotada estratégia "regra + compute-on-the-fly" seguindo padrão do Kinevo |
| 23/04/2026 | Seção 5: sync elevado para bidirecional (Kinevo sobrescreve, mas detecta mudanças no Google) |
| 23/04/2026 | Seção 5: sync operacional híbrido (síncrono com timeout 3s + fallback async) |
| 23/04/2026 | Seção 7: adicionado requisito de testes em cada fase |
| 23/04/2026 | Fase 1 concluída. Aprendizados: trigger `updated_at` usa função existente `update_updated_at()` (não `moddatetime`); merge de notas regra+exceção com `\n`; `monthly` ancorado em `starts_on` e ignorando `day_of_week` (requer validação no server action da Fase 2 garantindo que `day_of_week` bata com o dia da `starts_on`) |
| 23/04/2026 | Fase 2 concluída. Aprendizados: auth usa `supabase.auth.getUser()` + lookup em `trainers` (padrão real, não `getCurrentTrainerId()`); detecção de conflito é por sobreposição real de intervalo `[start, start+duration)`, não só por horário igual; `update` revalida monthly pelo valor efetivo pós-merge pra evitar estado inconsistente; `list-appointments` filtra exceções por `occurrence_date` OU `new_date` (ocorrências remarcadas pra dentro do range devem aparecer); teste seguiu `supabase-mock.ts` compartilhado pra reduzir duplicação |
| 23/04/2026 | Fase 3 concluída. Aprendizados: `createRecurringAppointment` passou a aceitar `options.confirmConflicts` (default false — retorna `pendingConflicts` sem inserir; true — insere mesmo com conflito); `StudentScheduleSection` é client component via browser Supabase + refreshKey (evita round-trip extra server-side e permite atualização reativa); sync automática de `startsOn → dayOfWeek` também aplicada em weekly/biweekly (melhora UX mesmo sem ser exigência do server); botão "Agendar" escondido em perfis de trainer (`student.is_trainer_profile === true`); sem toast library no projeto — feedback via AlertCircle inline + fechar modal em sucesso; banner "N ajustes individuais" em EditAppointmentModal adiado pra Fase 4 |
| 23/04/2026 | **Fase 3.5 adicionada** — rotinas multi-slot. Uso real de personal: aluno treina Seg 7h, Qua 7h, Sex 18h (dias e horários distintos). Decisão: adicionar coluna `group_id UUID NULL` em `recurring_appointments` pra agrupar N linhas do mesmo "pacote" (abordagem aditiva, zero quebra de Fase 1/2). Notas são compartilhadas no grupo. Edição por slot individual (mudar só a sexta); encerrar pode ser por slot ou pacote inteiro. Modal de criação aceita múltiplos slots com horários distintos. Agrupar rotinas pré-existentes fica fora do MVP. |
| 23/04/2026 | Fase 3.5 concluída. Aprendizados: degradação graceful quando grupo fica com 1 slot ativo (renderiza como card individual, não como "pacote de 1" — `group_id` preservado no banco); `crypto.randomUUID()` server-side pra gerar `group_id` compartilhado; validação de duplicatas desabilita submit no client (feedback imediato) + server; conflitos de pacote exibidos slot-a-slot (componente dedicado, não reusa `AppointmentConflictAlert`); propagação de `notes` silenciosa em falha (log-only, débito técnico pra telemetria futura); limite de 7 slots por pacote; `onSuccess` do modal passou a receber `{ recurringId?, groupId? }` |
| 23/04/2026 | Refinamento de terminologia: UI substituída de "SLOT 1/2/N" para "Dia 1/2/N" e "Treino de [dia da semana]" nas mensagens de conflito. Código interno (schemas, variáveis, tipos) mantém "slot" como jargão técnico |
| 23/04/2026 | Fase 4 concluída. Aprendizados: `Map` não serializa de Server Component pra Client em Next.js — usar `Record<string, ...>` no payload (crítico); fallback pra alunos inativos referenciados por rotinas ativas (query extra condicional); `OccurrencePopover` usa `<button>` envolvendo `children` pra a11y (trade-off: nested buttons); migration silenciosa do store via zustand `persist({ version: 1, migrate })` renomeia IDs antigos sem quebrar layouts salvos; `router.refresh()` re-fetcha server component sem reload completo; débito técnico da Fase 3 (banner "N ajustes individuais") quitado junto |
| 23/04/2026 | Fase 5 concluída. Aprendizados: migrations seguiram o próximo número livre (108) ignorando spec; adicionado `type='appointment'` em `student_inbox_items` + categoria `appointment` nas preferences (resolve tipagem e controle granular juntos); URL Supabase hardcoded em pg_cron seguindo padrão da 098 (evita settings externos); `verify_jwt=false` + service role interna pras Edge Functions chamadas via pg_cron; cron agendado em UTC com cálculo de offset explícito (previne bugs de DST); helpers de reminder ficam em `web/src/lib/appointments/` (não em `shared/utils/`) porque output é específico do schema da tabela; `update-recurring` NÃO dispara push imediato (evita bombardear aluno com edições iterativas do trainer); preferência OFF marca lembrete como `canceled` (não `skipped`) — implementação "holdable" fica pra V2 |
| 23/04/2026 | Fase 6 concluída. Aprendizados: fire-and-forget em vez de `Promise.race` dentro da action (UI não espera sync, retry cobre falhas); dynamic import de `sync-service` evita cold start penalty pra trainers sem Google conectado (bônus: testes hermetic); `this_and_future` via duas syncs sequenciais (PATCH UNTIL antiga + CREATE nova) em vez de manipular `RRULE:UNTIL` manual; reuso de `type='appointment'` + tipos custom em `trainer_notifications` (não tem CHECK, adição sem migration); badge `disabled` (intencional) distinto de `error` (precisa ação); watch channel criado em `select-calendar` (não no callback) evita channel órfão se trainer fechar aba; hierarquia de badge agregado `error > pending > disabled > synced` pra pacotes. Débitos técnicos aceitos: tokens em texto puro (RLS forte, migrar pra pgsodium em V2), retry via `setTimeout` `.unref()` (~10 rotinas/min), banner de edição externa via `trainer_notifications` genérico (UI dedicada fica pra V2) |
| 23/04/2026 | **Fase 7 concluída — MVP FECHADO.** Aprendizados: horário 06h–22h / 56px/hora / snap 30min via constantes ajustáveis; cores determinísticas por hash do `studentId` (colisão aceitável em escala pequena); outline vermelho em conflitos sem bloquear operação; `PointerSensor.activationConstraint.distance=6px` separa click de drag; `keyDown` global ignora inputs/textareas (atalhos não conflitam com digitação em modal); `/schedule` não entra em auto-collapse da sidebar (calendário precisa de largura); reuso completo de `OccurrencePopover` / `RescheduleOccurrenceModal` / `CreateAppointmentModal` da Fase 4 e 3. Débito identificado: `CreateAppointmentModal` precisa de autocomplete de alunos pra funcionar standalone no `/schedule` (hoje exige vir do perfil) — **fast follow #1 pós-MVP**. Sync badge não visível no calendário (`AppointmentOccurrence` não carrega `google_sync_status` — débito #2). |
| 24/04/2026 | **Bug de produção #1 encontrado em validação end-to-end (RLS + cliente errado).** `scheduled_notifications` não populava em tempo real. Causa raiz tripla: (a) faltava policy RLS de INSERT pro trainer; (b) server actions usavam cliente RLS normal em vez de `supabaseAdmin`; (c) log de erro Supabase com objeto vazio `{}` mascarou a causa. **Fix**: 7 actions de appointments atualizadas pra usar `supabaseAdmin` em writes de `scheduled_notifications` após validação explícita de ownership (espelha padrão `archive-student.ts` e `mark-as-paid.ts`). Backfill feito via `extend-scheduled-notifications`. **Padrão consolidado**: "server actions que escrevem em tabelas com RLS restrito devem usar `supabaseAdmin` quando o cliente RLS normal não tem policy de WRITE — após validar ownership explicitamente". |
| 24/04/2026 | **Bug de produção #2 encontrado (timezone shift de date-only).** Push "Treino cancelado de 27/04" exibiu 27/04 quando ocorrência era 28/04. Causa: `new Date('YYYY-MM-DD')` no JavaScript interpreta a string como UTC 00:00; quando formatado em `America/Sao_Paulo` (UTC−3), projeta pro dia anterior. **Fix em `formatBrDateShort`**: bypass do parser nativo — split manual de `YYYY-MM-DD` (regex `/^\d{4}-\d{2}-\d{2}$/`) retorna `DD/MM` direto, sem criar `Date`. Fallback pro parser nativo em strings com hora (ISO completa). **Teste de regressão** adicionado cobrindo o caso `'2026-04-28' → '28/04'`. |
| 24/04/2026 | **Lição reaproveitável dos dois bugs.** Ambos escaparam de testes unitários: (1) o bug de "cliente errado" (RLS/admin) não é pegável via `vi.mock()` — os mocks tornam os dois clientes indistinguíveis; precisa teste end-to-end real contra banco com RLS ativo, ou **contract test** que asserte qual cliente cada action usa pra cada tabela. (2) O bug de TZ date-only escapou porque testes usavam ISO completa (`'2026-12-25T12:00:00Z'`); testes devem cobrir explicitamente o formato que o código recebe em produção (date-only, no caso). **Consequência no backlog**: adicionar suite de smoke tests end-to-end pós-MVP que exercita server actions contra banco real (RLS ligado) — cobre uma classe inteira de bugs que mocks não pegam. |
| 24/04/2026 | **Redesign visual da Agenda + terminologia "treino".** Auditoria prévia identificou que `/schedule` não seguia o design language Apple-inspired do resto do app (faltava `rounded-xl + border + shadow-apple-card`, pillbox em vez de cards, bordas quase invisíveis, tinta violeta no dia atual em vez de neutro `#F5F5F7`, popover genérico). Redesign aplicado: (a) calendário envolto em card único padrão; (b) cards de agendamento com fundo branco + border hairline + faixa colorida 3px à esquerda (6 cores Apple, não Tailwind-100); (c) popover com header de avatar + nome + data formatada; (d) bordas `#E8E8ED`/`#D2D2D7` consistentes; (e) tipografia alinhada (`font-medium` + `tabular-nums`). Terminologia "ocorrência" → "treino" em UI visível; código interno preservado. Débito técnico fast-follow: consolidar helper de data com weekday+time em `shared/utils/format-br-date.ts` (hoje inline em `occurrence-popover.tsx`, mesmo split manual defensivo). Bug lateral descoberto e corrigido: `UpcomingAppointmentsWidget` não propagava `studentAvatarUrl` pro popover. |
| 24/04/2026 | **Bugs pós-redesign.** (#1) Fundo preto em `/schedule` em light mode — causa: `theme-provider.tsx` forçava `dark` em rotas não listadas em `LOGGED_AREA_PREFIXES`. Fix: adicionar `/schedule` à lista. Moral: fixes "hipotéticos sem investigar" falham. (#2) Card mostrava "Aluno" literal — causa: query em `schedule/page.tsx` tinha `.eq('coach_id', trainer.id)` "defesa em profundidade" redundante que filtrava silenciosamente alunos órfãos. Fix: remover filtro; IDs já vêm filtrados por RLS. (#3) `CreateAppointmentModal` não tinha autocomplete de aluno quando usado em `/schedule` (sem `preselectedStudentId`) — débito #1 do backlog V2 resolvido: adicionada prop `students?`, dropdown filtrado, 3 estados visuais (vazio/filtrando/selecionado). |
| 24/04/2026 | **Fase 8 concluída — Agendamento único.** Primeira feature V2. Adicionado `'once'` ao enum `frequency`. Trainer cria aulas avulsas (experimental, reposição) pelo 4° botão do segmented control, sem pensar em "rotina". Comportamento: `day_of_week` readonly (derivado de `starts_on`), `ends_on` não permitido, 1 ocorrência só, push/reschedule/cancel funcionam igual recorrente. Sync Google: single event (não recorring). Aprendizado crítico no fix de reschedule: `syncUpdateAppointment` LÊ da tabela pra construir o payload PATCH, então remarcar `'once'` exige atualizar a rotina ANTES de disparar sync, não só criar a exceção. Sem isso, o PATCH sai com valores antigos. Abstração `isSingleSlotMode = isMonthly \|\| isOnce` merge natural das duas frequências single-day. Labels `FREQUENCY_LABELS.once = 'Única'` em todos os call sites. Débito técnico menor registrado: exceção `rescheduled` fica redundante quando `'once'` (starts_on já reflete nova data), não causa dano; cleanup opcional pra V2. |
| 24/04/2026 | **Três refinamentos de UX na Agenda.** (1) Cards lado-a-lado no mesmo horário: algoritmo guloso `computeOverlapLayout` agrupa transitivamente ocorrências sobrepostas e distribui `widthPercent`/`leftPercent`. Outline vermelho de conflito removido (visualmente redundante com divisão de largura). (2) Aula em dupla como intenção: removida toda a lógica de `pendingConflicts` + `confirmConflicts` do server, modal e testes. Trainer cria agendamento no mesmo horário sem alerta — sistema entende como intencional. `AppointmentConflictAlert` deletado. Toast informativo pulado (ruído > valor; cards lado-a-lado já comunicam). (3) Drag optimistic: `useRef<Map>` guarda snapshots, mutação síncrona do state em `onOptimisticMove`, server fire-and-forget, revert em erro. Latência percebida caiu de 1-3s pra ≤16ms (1 frame). Teste explícito valida ordem "optimistic move ANTES do server call". |
| 24/04/2026 | **Bug adicional encontrado na auditoria + consolidação.** `scheduled_start_date` em `student-detail-client.tsx` tinha a mesma classe de bug que `formatBrDateShort` (interpretação UTC de date-only shiftando 1 dia). Em vez de duplicar o fix, consolidado em helper único `shared/utils/format-br-date.ts` com 2 funções (`formatBrDateShort`, `formatBrDate`). Ambos chamadores migrados. Débito técnico registrado: adicionar ESLint rule proibindo `new Date(x).toLocaleDateString` direto em componentes — força uso do helper. Auditoria sistemática de timezone foi valiosa (1 bug visível pro trainer) e fica como modelo replicável pra outras classes de bug. |
