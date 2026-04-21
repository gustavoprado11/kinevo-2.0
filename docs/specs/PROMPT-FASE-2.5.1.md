# Prompt para Claude Code — Fase 2.5.1 (route mobile delega ao smart-v2)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `docs/specs/00-visao-geral.md` — decisões, invariantes e glossário.
2. `docs/specs/06-fase-2.5-prescricao-inteligente.md` — a spec-mãe. Você não vai mexer em §4 (regras) nem em §5.3-5.8 (já implementados); foco é §5.7 (feature flag) + escopo da Fase 2.5.
3. `docs/specs/logs/fase-2.5-execucao.md` — log completo da 2.5, com §8 (destravamento) e §9 (post-walkthrough fix). Follow-up #17 descreve esta fase.

## Escopo

A Fase 2.5 implementou smart-v2 atrás da flag `trainers.smart_v2_enabled`, mas **apenas o caminho web** (server action `generateProgram`) passa por `trySmartV2Generation`. A route `web/src/app/api/prescription/generate/route.ts`, consumida pelo **mobile app**, tem a lógica de geração **inlined** (cerca de 180 linhas duplicadas, comment explícito "Call the generation logic directly (inlined from generate-program.ts)") e:

- **Não** lê `smart_v2_enabled`.
- **Não** chama `trySmartV2Generation`.
- **Não** usa `llm-client` consolidado (faz `fetch` direto com `response_format: { type: 'json_object' }`).
- **Não** passa pelo `rules-validator`.
- **Não** registra telemetria 2.5 (cost, cached tokens, prompt_version, violations).

Consequência: trainers com a flag ligada gerando pelo mobile ficam invisíveis à telemetria e regras da Fase 2.5.

**Objetivo desta fase:** a route mobile passa a **delegar** ao server action `generateProgram` (em vez de duplicar a lógica), para que mobile herde automaticamente smart-v2, retry/fallback, caching, telemetria e rules-validator. Mobile e web devem convergir para um único pipeline.

## Reconnaissance já feita (não refaça)

- **Único consumidor da route:** `mobile/app/student/[id]/prescribe.tsx:94` — `fetch('/api/prescription/generate', { method: 'POST', headers: { Authorization: 'Bearer ${token}' }, body: { studentId } })`.
- **Request body:** `{ studentId: string }`.
- **Response shape atual:** `{ success, generationId, aiMode, source, llmStatus, outputSnapshot, violations? }` — bate 1:1 com `GenerateProgramResult` do server action.
- **Auth atual na route:** `request.headers.get('authorization')` → `createClient` com `global.headers: { Authorization: 'Bearer ${token}' }` (linhas 25-42 do arquivo).
- **Server action `generateProgram`:** usa `createClient()` de `@/lib/supabase/server` (cookies do Next). Precisa aceitar um supabase client injetado para a route reutilizá-lo.
- **Helper Bearer-to-client não existe** em `web/src/lib/supabase/`. Padrão mais próximo: `web/src/app/api/programs/assign/route.ts:18-30` (copia o mesmo shape da route atual).

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. Pontos que o plano precisa cobrir:

### A. Criar helper `createServerClientFromToken`

Arquivo novo: `web/src/lib/supabase/server-from-token.ts`.

Export `createServerClientFromToken(token: string)` que retorna um supabase client autenticado via Bearer JWT. Implementação deve espelhar exatamente o padrão usado hoje em `api/prescription/generate/route.ts:25-42` e `api/programs/assign/route.ts:18-30`.

Inclua verificação explícita da presença das env vars `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `throw` com mensagem clara se faltar.

Teste novo: `web/src/lib/supabase/server-from-token.test.ts` — valida que (a) retorna um client válido, (b) o token é anexado ao header de auth no shape correto, (c) lança erro se env var faltar.

### B. Refatorar `generateProgram` para aceitar supabase injetado

Arquivo: `web/src/actions/prescription/generate-program.ts`.

Hoje `generateProgram(studentId, answers, selectedFormIds)` chama `createClient()` internamente. Proposta:

```ts
// Nova assinatura pública (opcional, backward-compatible):
export async function generateProgram(
  studentId: string,
  answers: AgentAnswer[],
  selectedFormIds: string[],
  options?: { supabase?: SupabaseClient }
): Promise<GenerateProgramResult>
```

Se `options.supabase` vier, usa ele direto; senão, faz `createClient()` como hoje. Comportamento existente preservado para todos os callers atuais (web server action, testes).

**Cuidados:**
- O server action usa `getUser()` em múltiplos pontos (confirmar no código onde). Ao receber supabase injetado, **ainda assim** valida via `supabase.auth.getUser()` — o client injetado traz o JWT no header, então `getUser()` retorna o usuário correto.
- Se o código do action usa `cookies()` diretamente em algum ponto fora do `createClient`, isso precisa virar opcional também. Mapeie esses pontos antes de editar.
- RLS precisa continuar funcionando. Client por Bearer respeita RLS da mesma forma que client por cookies — mas teste isso explicitamente no plano.

### C. Substituir a lógica inlined na route por delegação

Arquivo: `web/src/app/api/prescription/generate/route.ts`.

Hoje: 180+ linhas de lógica duplicada (linhas ~109-323).

Depois: (1) valida Bearer JWT + obtém studentId do body; (2) cria supabase client via `createServerClientFromToken(token)`; (3) chama `generateProgram(studentId, answers=[], selectedFormIds=[], { supabase })`; (4) retorna o resultado diretamente — o shape já bate.

**Gotchas a mapear no plano:**
- O mobile hoje passa só `{ studentId }` no body. O server action espera `answers` e `selectedFormIds`. Qual o default correto? Provavelmente `answers=[]` e `selectedFormIds=[]` (geração sem respostas a perguntas, sem seleção de formulários). **Confirme lendo o que a route inlined passa hoje.** Se a route inlined não carrega `answers`/`selectedFormIds`, então o default é `[]` e o comportamento é preservado.
- O mobile pode estar enviando algum campo extra no body que a route inlined usa? Verifique no mobile (`mobile/app/student/[id]/prescribe.tsx:94-100`) o body exato.
- Error handling: a route hoje retorna 401/403/500 em situações específicas. Mapeie e preserve.

### D. Testes de integração

A route mobile não tinha testes dedicados (confirme antes). Proposta:

- `web/src/app/api/prescription/generate/route.test.ts` — mocka `createServerClientFromToken` + `generateProgram` e valida:
  - 401 sem header Authorization.
  - 401 com token inválido.
  - 400 com body malformado.
  - 200 + shape correto da response quando delega com sucesso.
  - Erro do server action é propagado como 500 com mensagem.

Se a infra de teste de route handlers não existir no projeto hoje, reporte e **não crie ad-hoc** — vire follow-up. Teste unitário do helper + teste do server action com supabase injetado já dão cobertura razoável.

### E. Verificação real

Após os testes passarem, você não tem como testar o mobile real do Claude Code. Proponha no plano:

1. O Gustavo instala o mobile app de dev apontando para o backend local e roda uma geração.
2. Você deixa pronto: a query SQL que ele deve rodar para confirmar que a row nova tem `ai_source='llm'`, `prompt_version='v2.5.0'`, `cost_usd IS NOT NULL`.
3. Se o Gustavo não quiser instalar o mobile, preparar um script `web/scripts/debug-mobile-route.ts` que simula a chamada via `curl`/`fetch` com Bearer JWT contra o servidor local (requer `OPENAI_API_KEY` e JWT do trainer em `.env.local`). Script temporário, vai como follow-up pra remoção.

### F. O que **não** fazer

- Não mude o mobile (`mobile/app/student/[id]/prescribe.tsx`). O contrato HTTP fica idêntico.
- Não reescreva `generateProgram`. Só adicione o parâmetro opcional `options.supabase`.
- Não toque em `rules-validator.ts`, `prompt-builder-v2.ts`, `context-enricher-v2.ts`, `schemas.ts`, `llm-client.ts`. Fora de escopo.
- Não adicione dependências novas.
- Não aplique migration. A flag `smart_v2_enabled` já está no DB.
- Não ligue a flag para outros trainers.
- Não use git.

## Regras desta sessão

- Plano primeiro; espera aprovação explícita antes de editar.
- Se o plano revelar que `generateProgram` tem amarrações com cookies além do `createClient()` inicial, reporte antes de propor fix — pode ser mais invasivo do que parece.
- `npm test` verde. `npx tsc --noEmit` verde em `web/`.
- Strings user-facing em pt-BR; código/comentários em inglês.

## Definição de "pronto"

- Helper `createServerClientFromToken` criado com testes.
- `generateProgram` aceita `options.supabase` opcional; callers existentes seguem funcionando (nenhum teste pré-existente quebra).
- `api/prescription/generate/route.ts` com ≤40 linhas (só auth + delegação).
- Testes de integração do route handler passando (ou follow-up justificado se infra não existir).
- `npm test` verde; `npx tsc --noEmit` verde.
- `docs/specs/logs/fase-2.5.1-execucao.md` criado com:
  - Diff resumido dos 3 arquivos (helper, action, route).
  - Plano de verificação do Gustavo (mobile real OU script de debug).
  - Follow-ups: remover script de debug se foi criado; consolidar outros endpoints inlined (se existirem).
- Atualizar `docs/specs/logs/fase-2.5-execucao.md` §6 follow-up #17 marcando como **concluído** com link para o log da 2.5.1.

Comece produzindo o plano. Aguarde aprovação.
