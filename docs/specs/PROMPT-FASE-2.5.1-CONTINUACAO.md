# Prompt para Claude Code — Fase 2.5.1 (continuação: middleware whitelist + validação real)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `docs/specs/logs/fase-2.5-execucao.md` — §8, §9 e §6 (follow-ups #17).
2. `docs/specs/PROMPT-FASE-2.5.1.md` — o prompt original da 2.5.1 (já executado: helper criado, `generateProgram` aceita supabase injetado, route reescrita, 295/295 testes passando).
3. `web/src/middleware.ts` — matcher e whitelist atuais.
4. `web/src/lib/supabase/middleware.ts` — função `updateSession` e a condição de redirect para `/login`.

## Contexto

A refatoração da Fase 2.5.1 está pronta e testada em isolamento, mas a validação end-to-end (curl com Bearer contra `localhost:3000`) retornou **307 → /login**. A causa é um bug pré-existente:

- O matcher do middleware aplica `updateSession` (baseado em cookies) a **todas** as rotas, com uma whitelist de exceções.
- A whitelist inclui `api/financial` e `api/notifications` (rotas mobile que recebem Bearer JWT).
- **`api/prescription/generate` NÃO está na whitelist**, então `updateSession` intercepta a chamada Bearer, não acha session via cookie e redireciona para `/login`.
- Consequência: o mobile nunca alcançava a route handler. A Fase 2.5.1 herdou essa dívida.

O comentário no próprio `middleware.ts` (l.16-25) documenta o contrato: rotas mobile-first que usam Bearer **devem** ser excluídas da whitelist e devem chamar `supabase.auth.getUser(token)` dentro da route handler. A route reescrita na 2.5.1 já cumpre a segunda parte desse contrato — falta só adicioná-la à whitelist.

## Escopo

1. Adicionar `api/prescription/generate` à whitelist do middleware em **dois** lugares.
2. Rodar `npm test` e `npx tsc --noEmit` para garantir zero regressão.
3. Validar end-to-end via curl Bearer contra `localhost:3000` (Gustavo vai fornecer o JWT se necessário, ou você pega via Chrome MCP).
4. Query DB confirmando que a row nova tem os campos smart-v2 corretos.
5. Fechar o log `docs/specs/logs/fase-2.5.1-execucao.md` e marcar follow-up #17 como concluído.

## Antes de editar

Produza um **plano curto** (≤20 linhas) confirmando:

- Em `web/src/middleware.ts`, exatamente qual linha do negative lookahead você vai estender e qual será o novo valor.
- Em `web/src/lib/supabase/middleware.ts`, exatamente qual `if`/condição você vai acrescentar `!request.nextUrl.pathname.startsWith('/api/prescription/generate')`.
- Confirmação explícita: a route handler da 2.5.1 **já** chama `supabase.auth.getUser()` sobre o Bearer e responde 401 quando inválido — ou seja, adicionar à whitelist não cria buraco de segurança.
- Se algum teste existente bate no middleware (improvável — geralmente são testes de rotas mockadas), liste qual e por quê sobrevive.

Aguarde minha aprovação antes de editar.

## Depois da aprovação, execute nesta ordem

1. Aplicar o fix nos 2 arquivos de middleware.
2. `npm test` — todos os 295+ testes precisam passar.
3. `npx tsc --noEmit` em `web/` — zero erros.
4. Iniciar o dev server (`npm run dev` em `web/` rodando em background, ou instrua o Gustavo a iniciar) apontando para o Supabase de produção com `.env.local` já configurado.
5. Reexecutar o curl da Opção A:
   - Obter JWT válido do trainer `gustavoprado11@hotmail.com` (via Chrome MCP lendo `sb-lylksbtgrihzepbteest-auth-token` no localStorage, ou pedindo ao Gustavo).
   - Obter um `studentId` válido desse trainer (query direta ou via Chrome MCP).
   - `curl -X POST http://localhost:3000/api/prescription/generate -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" -d '{"studentId":"<id>"}'`.
6. Resposta esperada: 200 com `{ success: true, generationId, aiMode: 'llm', source: 'llm' | 'cache', llmStatus: 'ok', outputSnapshot: {...}, violations?: [...] }`.
7. Query DB confirmando a row recém-criada:
   ```sql
   SELECT id, ai_source, prompt_version, model_used, cost_usd, retry_count, rules_violations_count, created_at
   FROM prescription_generations
   WHERE trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   Valores esperados: `ai_source='llm'`, `prompt_version='v2.5.0'`, `model_used IN ('gpt-4.1-mini','gpt-4o-mini')`, `cost_usd IS NOT NULL`.
8. Comparar com a row canônica `25aaaa74-6638-4361-a159-6a508141a681` (primeira geração válida da 2.5): shape precisa bater (podem diferir em `cache_hit`, `retry_count`, `rules_violations_count`, valores numéricos — o que importa é o shape e os campos smart-v2 populados).

## Se o curl ainda falhar

Não tente outro fix cego. Reporte:

- Status code exato.
- Body completo da resposta.
- Qualquer log relevante do `npm run dev` (o middleware loga redirects; a route handler loga gate smart-v2 e telemetria).
- Estado do JWT (projeto, email, `exp`).

## Definição de "pronto"

- 2 linhas de fix aplicadas em `middleware.ts` e `lib/supabase/middleware.ts`.
- `npm test` verde (295+ testes).
- `npx tsc --noEmit` verde.
- Curl de validação retorna 200 com shape correto.
- Row nova no DB com campos smart-v2 populados.
- `docs/specs/logs/fase-2.5.1-execucao.md` criado com:
  - §1 Escopo entregue (helper + injeção + route + middleware fix).
  - §2 Diff resumido dos 5 arquivos tocados (3 da 2.5.1 original + 2 do middleware).
  - §3 Evidência de validação: curl + row DB + diff contra row canônica.
  - §4 Descoberta do bug pré-existente de middleware (para a posteridade).
  - §5 Follow-ups: remover `scripts/debug-smart-v2.ts` se ainda existir; consolidar outros endpoints inlined se detectados.
- `docs/specs/logs/fase-2.5-execucao.md` §6 follow-up #17 marcado como **concluído** com link para o log da 2.5.1.

## Regras desta sessão

- Plano primeiro; espera aprovação explícita antes de editar.
- Strings user-facing em pt-BR; código/comentários em inglês.
- Não ligue a flag `smart_v2_enabled` para outros trainers.
- Não use git.
- Se o curl real expuser **outro** bug (não o middleware), pare e reporte — pode ser outra cadeia de dívida técnica.

Comece produzindo o plano. Aguarde aprovação.
