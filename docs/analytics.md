# Analytics de produto (first-party) — migração 266

Instrumentação P0 da auditoria de 13/jul. Eventos ficam em `product_events`
(Supabase, projeto `lylksbtgrihzepbteest`) — sem vendor externo, LGPD-friendly,
consultável por SQL/assistente/MCP.

## Como escrever eventos

- **Web (client)**: `track(event, props)` de `@/lib/analytics` — RPC
  `log_product_event` (SECURITY DEFINER, resolve trainer/aluno do JWT,
  fire-and-forget, nunca lança).
- **Server**: `trackServer(event, { trainerId, studentId, props })` de
  `@/lib/analytics-server` (insert admin).
- **Mobile (futuro)**: mesma RPC `log_product_event` via supabase-js.
- **Banco**: trigger em `workout_sessions` → `student_workout_completed`
  (cobre web, mobile e Watch sem código de client).

## Eventos instrumentados (18/jul)

| Evento | Origem | Quando |
|---|---|---|
| `signup_completed` | server | trainer criado (props.source = attribution) |
| `welcome_tour_completed` | web | primeira conclusão do tour de boas-vindas |
| `tour_completed` | web | tours por tela (props.tour) |
| `milestone_<key>` | web | 1ª vez de cada milestone: `first_student_created`, `first_program_created`, `first_program_assigned`, `first_exercise_added`, `first_form_sent`, `financial_setup`, `app_link_shared`, `mobile_logged_in`, `first_training_room_session`, `landing_published` |
| `student_workout_completed` | trigger | toda conclusão de treino (props.session_id) |
| `upgrade_plans_viewed` | web | seção de planos de IA renderizada |
| `checkout_started` | server | sessão de checkout Stripe criada (props.tier) |
| `subscription_started` | server | webhook ativou assinatura solo |
| `studio_subscription_started` | server | webhook ativou assinatura de estúdio |
| `smart_banner_view/_action`, `prescription_preferences_*` | web | já existiam no shim; agora persistem |

## Attribution de origem

Middleware grava cookie `kv_attr` (30d, first-touch) quando a visita chega com
`utm_*`/`ref` ou referrer externo; o signup persiste em
`trainers.signup_source` (jsonb: utm_*, referrer, landing, at).

## Leitura — queries canônicas

Funil por treinador (view `v_trainer_funnel`, service_role):

```sql
select name, email, signup_at::date, signup_source->>'utm_source' as origem,
       tour_done_at, first_student_at, first_program_at,
       first_student_workout_at, subscribed_at
from v_trainer_funnel
order by signup_at desc;
```

Conversão do funil (últimos 90 dias):

```sql
select count(*) as signups,
       count(tour_done_at)             as tour,
       count(first_student_at)         as aluno,
       count(first_program_at)         as programa,
       count(first_student_workout_at) as aluno_treinou,
       count(subscribed_at)            as assinou
from v_trainer_funnel
where signup_at > now() - interval '90 days';
```

Time-to-first-program (o indicador da auditoria — quem não cria em D0–D3 não volta):

```sql
select name, signup_at::date,
       extract(day from first_program_at - signup_at) as dias_ate_programa
from v_trainer_funnel
where first_program_at is not null
order by signup_at desc;
```

Origem dos signups:

```sql
select coalesce(signup_source->>'utm_source', signup_source->>'referrer', 'direto') as origem,
       count(*)
from trainers
where created_at > now() - interval '90 days'
group by 1 order by 2 desc;
```

Eventos crus (debug):

```sql
select occurred_at, event, source, props
from product_events
order by occurred_at desc
limit 50;
```

## O que NÃO está coberto (próximos passos)

- E-mails de lifecycle D0/D2/D7 (item c do P0 — precisa de conta Resend).
- Eventos de UI do mobile (a RPC já aceita; instrumentar junto de uma frente mobile).
- Page views genéricos — decisão consciente: eventos de negócio > page views.
