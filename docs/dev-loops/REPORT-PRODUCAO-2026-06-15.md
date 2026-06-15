# Loop de Produção/Runtime — 2026-06-15

## Resumo

| Verdict | Qtd |
|---|---|
| real | 2 |
| stale | 2 |
| by_design | 3 |
| false_positive | 0 |
| low_value | 6 |
| uncertain | 0 |
| **Total** | **13** |

**Viraram fix (fixWorthy=true): 2** — ambos os `real`.

Produção não está limpa, mas as duas falhas reais são de **severidade média e benignas em runtime**: nenhuma quebra resposta de usuário nem vaza dados. A pior (MCP/OAuth) está perdendo 100% da telemetria de uso OAuth desde hoje; a outra (search_path) é higiene de linter sem escalonamento de privilégio. Os outros 11 sinais foram filtrados como ruído de advisor, padrões intencionais ou incidentes já corrigidos.

---

## 🔴 Falhas reais (verdict=real)

| Sev | Título | Fonte | Evidência (file:line + timestamp) |
|---|---|---|---|
| med | Log de uso do MCP grava `oauth:<uuid>` em coluna uuid `api_key_id` → INSERT falha em todo tool/call via OAuth | DB prod `lylksbtgrihzepbteest` + código | `web/src/lib/mcp/auth.ts:76` monta `keyId: oauth:${data.id}`; propagado em `web/src/app/api/mcp/route.ts:159-166`; inserido em `web/src/lib/mcp/logger.ts:14-22` (`api_key_id` é uuid). Erro `invalid input syntax for type uuid: "oauth:<id>"`. Recência: último sinal **2026-06-15T13:19:04Z**, ~34 ocorrências 13:03-13:19; `mcp_tool_usage_logs` com 0 linhas nas últimas 2h. Fire-and-forget (`.then()` sem await) → não quebra a resposta do tool, só perde telemetria. |
| med | 8 funções `public` com search_path mutável (advisor lint 0011) | Advisor de segurança ao vivo + `pg_proc` | Funções: `calculate_session_duration`, `get_last_exercise_metrics`, `get_previous_exercise_sets`, `get_smart_substitutes`, `guard_wearable_source_priority`, `trg_trainer_financial_settings_updated_at`, `update_updated_at`, `wearable_source_priority`. Todas com `proconfig=null` (confirmado via execute_sql em **2026-06-15**). Defs em `supabase/migrations/048_get_previous_exercise_sets.sql`, `025_financial_module.sql`, etc. Mitigante: `prosecdef=false` (SECURITY INVOKER) → sem escalonamento de privilégio; impacto = resolução de search_path por chamada + WARN do linter. |

---

## 🛠️ Prompts de fix prontos

### Fix 1 — MCP/OAuth: separar uuid puro para o log (med)

```
No MCP do Kinevo web, o log de uso de ferramentas falha em toda chamada autenticada por OAuth porque grava um identificador prefixado numa coluna uuid.

Causa: web/src/lib/mcp/auth.ts:76 monta `keyId: `oauth:${data.id}`` (prefixo usado p/ a chave de rate-limit em auth.ts:118). Esse mesmo keyId é repassado em web/src/app/api/mcp/route.ts:159-166 para logToolUsage, que em web/src/lib/mcp/logger.ts:17 insere em mcp_tool_usage_logs.api_key_id — coluna uuid. Resultado: Postgres rejeita com `invalid input syntax for type uuid: "oauth:<id>"` (~34x hoje, 2026-06-15 13:03-13:19), e nenhuma linha de telemetria OAuth é gravada.

Correção (cirúrgica, manter retrocompat):
1. Em web/src/lib/mcp/types.ts, adicionar a McpContext um campo separado para o uuid puro do log, ex.: `apiKeyId: string | null` (ou reaproveitar o id sem prefixo). Não remover keyId (ainda usado no rate-limit).
2. Em web/src/lib/mcp/auth.ts: validateApiKey retorna apiKeyId = key.id; validateOAuthToken retorna apiKeyId = null (é token OAuth, não API key; a coluna api_key_id é nullable) e mantém keyId = `oauth:${data.id}` só para o rate-limit. Propagar apiKeyId no retorno de authenticateRequest.
3. Em web/src/app/api/mcp/route.ts:159-166, passar context.apiKeyId (uuid puro ou null) para logToolUsage em vez de context.keyId.
4. Confirmar que logger.ts continua inserindo api_key_id como uuid|null (a coluna aceita null).

Verificar: tsc --noEmit limpo; após uma chamada tools/call via OAuth, conferir que uma linha aparece em mcp_tool_usage_logs com api_key_id NULL e sem erro de uuid no log do Postgres; chamadas via API key continuam gravando o uuid da chave.

Outcome: tool/calls via OAuth deixam de emitir `invalid input syntax for type uuid: "oauth:<id>"` no Postgres e voltam a registrar telemetria de uso (api_key_id NULL p/ OAuth, uuid da chave p/ API key), sem alterar o comportamento de rate-limit nem a resposta das ferramentas.
```

### Fix 2 — search_path imutável nas 8 funções (med)

```
Criar uma migration nova em /Users/gustavoprado/kinevo/supabase/migrations (próximo número sequencial) que fixa o search_path das 8 funções flagadas pelo advisor de segurança (lint 0011_function_search_path_mutable), todas confirmadas com proconfig=null na DB de prod (lylksbtgrihzepbteest). Para cada função, rodar ALTER FUNCTION public.<nome>(<assinatura exata dos args>) SET search_path = '' (string vazia, padrão recomendado pela Supabase; usar pg_catalog/public explícito apenas se a função referencia objetos não-qualificados — verificar o corpo via pg_get_functiondef antes). Funções: wearable_source_priority, get_smart_substitutes, get_previous_exercise_sets, guard_wearable_source_priority, get_last_exercise_metrics, update_updated_at, calculate_session_duration, trg_trainer_financial_settings_updated_at. Atenção: ALTER FUNCTION exige a assinatura de argumentos correta — obter via select oid::regprocedure from pg_proc para cada nome em public (algumas podem ter overloads). Como o corpo das funções pode usar nomes não-qualificados (ex.: tabelas em public, funções de extensão), ao definir search_path='' será preciso qualificar todas as referências internas com schema; alternativa mais segura para SECURITY INVOKER é SET search_path = pg_catalog, public. Após aplicar, rodar novamente get_advisors(security) e confirmar que as 8 entradas function_search_path_mutable sumiram, e testar a sala de treino (get_previous_exercise_sets e get_last_exercise_metrics são caminho quente) para garantir que nenhuma resolução de objeto quebrou.

Outcome: as 8 funções passam a ter search_path imutável, o advisor de segurança deixa de reportar lint 0011, e a sala de treino continua retornando séries/métricas anteriores corretamente.
```

---

## 🟡 Incertos (verdict=uncertain)

Nenhum. Todos os 13 achados foram conclusivamente classificados; nada pendente de investigação.

---

## 🗑️ Descartados

| Título | Verdict | Motivo (ruído filtrado) |
|---|---|---|
| anon EXECUTE em RPCs SECURITY DEFINER (16 funções) | low_value | Migration 173 revogou anon em massa, mantendo só whitelist de helpers de RLS (by-design). Mutadoras anon-executáveis (create_program_template_tree, save_assigned_program_tree, etc.) TODAS gateiam: `current_trainer_id()` NULL p/ anon → RAISE EXCEPTION; updates filtram por `auth.uid()` (0 linhas). Zero exposição. Lint 0028 dispara pela presença do GRANT, não por exploitabilidade. |
| 73 SECURITY DEFINER RPCs executáveis por `authenticated` | by_design | Padrão deliberado do Kinevo: RPCs rodam como DEFINER mas reforçam tenant no corpo. Os 6 alvos nomeados filtram por `current_trainer_id()`/ownership/service_role. Lint 0029 é informativo, lista toda função alcançável; não detecta filtro ausente. |
| RLS WITH CHECK true em android_tester_queue / curso_waitlist | by_design | Padrão canônico de formulário público insert-only. Sem policy de SELECT/UPDATE/DELETE p/ anon (default-deny). Prova empírica: SET ROLE anon → "permission denied" / 0 linhas. Só lead capture (email/nome). Lint 0024 genérico. |
| Buckets públicos listáveis (exercise-library-videos / public-assets) | low_value | Conteúdo confirmado não-sensível: 514 vídeos-demo de exercício (catálogo compartilhado por URL) + 1 .mov de demo. Buckets privados reais (form-uploads, messages, avatars, trainer-videos, feedback) escopados por foldername=auth.uid(). Lint 0025. |
| RLS sem policy em wearable_oauth_tokens/provider_config/rate_limit_events | by_design | Service-role-only INTENCIONAL e documentado nas migrations (155, 195, 153). RLS ligado sem policy = deny p/ anon/auth; só edge functions/service_role acessam. Zero refs client-side em web/src. Advisor INFO reconhece "provável intencional". |
| Múltiplas permissive policies em 38 tabelas (507 warnings) | low_value | Otimização de planner RLS. O problema caro (auth_rls_initplan) já corrigido — auth wrapeado em `(select auth.uid())`. Resta só sobreposição de policies; nenhum caminho de runtime "emite" isso. |
| Extensões pg_trgm e unaccent no schema public (lint 0014) | low_value | Só essas 2 fora do schema `extensions`; as demais (pgcrypto, pg_net, etc.) já corretas. unaccent sustenta a busca acento-insensível server-side. Mover extensão é cosmético/arriscado vs. benefício nulo. |
| Proteção HaveIBeenPwned desabilitada no Auth | low_value | Config de painel (Auth > Password security), não-código. Sem file:line; remediação é toggle no painel, não PR. Severity low pela própria fonte. |
| 406 em GET /rest/v1/payment_settings (.single()) | low_value | `web/src/app/financial/page.tsx:25-29` — .single() sem linha p/ trainer sem config de pagamento (PGRST116). Erro ignorado, null tratado, dashboard renderiza normal. 1x em 2026-06-15T13:03:54Z. maybeSingle() só limparia log, não muda comportamento. |
| Webhooks Stripe gravados com metadata `{}` | stale | Consequência alegada (retry pulado) NÃO procede: route.ts:96-109 faz DELETE do webhook_event + 500 → Stripe re-entrega limpo. Fix `df58816` commitado 2026-06-11 18:27, ~1h30 antes do evento mais recente do sinal. Handlers re-buscam estado vivo no Stripe; metadata={} é só marcador de idempotência. 53 linhas são acúmulo histórico. |
| Pagamentos Asaas via manual_backfill | stale | Resíduo do incidente de 10/06/2026 (backfill 14:08-14:14 UTC). Causa raiz (índice parcial → 42P10 engolido) corrigida por migration 183 (índice único total). Webhooks orgânicos posteriores processados OK (PAYMENT_DELETED 06-10 19:39, PAYMENT_CREATED 06-11 23:05). Sem recorrência após o fix. |
---

## 📌 Addendum (pós-análise, 2026-06-15) — correção + status

- **Correção ao Fix 1:** o prompt acima assumiu que `mcp_tool_usage_logs.api_key_id` era nullable. **Não era** — confirmado no banco: `NOT NULL` + FK `-> trainer_api_keys(id)`. Como token OAuth não é API key, não havia valor válido a referenciar (nem o uuid puro passaria). Logo o fix exigiu também tornar a coluna nullable.
- **Fix 1 APLICADO** (working tree, sem push): `types.ts`/`auth.ts`/`logger.ts`/`route.ts` separam `apiKeyId` (uuid puro / `null` p/ OAuth) do `keyId` (prefixado, só rate-limit). Migration **199_mcp_usage_log_nullable_api_key.sql** (`DROP NOT NULL`) **aplicada em prod** (backward-compat, reversível). `tsc` limpo + suíte 1105 verde. Tipos regerados.
- **Fix 2 (search_path):** ainda NÃO aplicado.
