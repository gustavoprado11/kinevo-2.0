# Prompt para Claude Code — Auditoria de rotas mobile-first fora da whitelist de middleware

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `web/src/middleware.ts` — matcher e whitelist atual.
2. `web/src/lib/supabase/middleware.ts` — função `updateSession` e as condições de exclusão do redirect.
3. `docs/specs/logs/fase-2.5.1-execucao.md` — §4 (descoberta do bug pré-existente de middleware que invalidou `/api/prescription/generate` por meses).

## Contexto

A Fase 2.5.1 revelou que `api/prescription/generate` não estava na whitelist do middleware: qualquer `fetch` Bearer do mobile era interceptado, redirecionado pra `/login` (307), e o `response.json()` do cliente explodia silenciosamente ao receber HTML. A route nunca funcionou em produção desde que foi criada.

**Hipótese a testar:** outras rotas da API que deveriam aceitar Bearer JWT do mobile podem ter o mesmo bug. O walk-through da 2.5 já comprovou que essa dívida é real e recorrente. Esta auditoria **mapeia** todas as rotas potencialmente afetadas, classifica por risco, e produz um plano de fix consolidado — mas **não aplica fix** nesta sessão. Aplicação de fixes fica em fase(s) separada(s) priorizada(s) pelo Gustavo.

## Escopo

Esta sessão é **só leitura + análise + relatório**. Nada de edição de código.

Entregáveis:

1. Mapa completo de todas as rotas sob `web/src/app/api/**/route.ts`.
2. Classificação de cada rota em 1 de 4 categorias:
   - **A — Mobile-first (Bearer)**: consumida pelo mobile, autentica via Bearer.
   - **B — Web-first (cookies)**: consumida pelo web, autentica via cookies.
   - **C — Pública/webhook**: sem auth de usuário (webhooks, cron, health).
   - **D — Ambígua/consome ambos**: aceita ambos OU não fica claro pelo código.
3. Cruzamento com a whitelist atual do middleware. Para cada rota:
   - Está na whitelist? (sim/não)
   - Deveria estar? (sim/não, baseado na categoria)
   - **Dano potencial** se tiver bug: qual feature do mobile quebra.
4. Relatório markdown em `docs/specs/logs/auditoria-middleware-mobile.md` com recomendação de ordem de fix.

## Antes de começar

Produza um **plano curto** cobrindo:

### A. Enumeração

Comando base pra listar todas as routes:

```bash
find web/src/app/api -name 'route.ts' -type f | sort
```

Para cada arquivo, classificar lendo:

- Imports de `createClient` vs `createServerClientFromToken` vs `supabaseAdmin`.
- Uso de `request.headers.get('authorization')` → Bearer.
- Uso de `cookies()` do `next/headers` ou `createClient()` de `lib/supabase/server` → cookies.
- Verificadores de `process.env.CRON_SECRET`, `stripe-signature`, etc. → webhook.

### B. Cruzamento com whitelist

A whitelist atual (após 2.5.1) exclui do `updateSession`:

- `api/webhooks`
- `api/stripe/webhook`
- `api/stripe/cancel-subscription`
- `api/cron`
- `api/financial`
- `api/notifications`
- `api/prescription/generate`

Extrair esses paths direto do matcher em `middleware.ts` linha ~27 e de `lib/supabase/middleware.ts` l.41-54 (os dois precisam estar alinhados — se uma rota está num mas não no outro, reportar como inconsistência).

### C. Consumidores no mobile

Grep no app mobile por todas as chamadas HTTP que batem na API web:

```bash
grep -rn "fetch.*['\"]/api/" mobile/ --include='*.ts' --include='*.tsx'
grep -rn "NEXT_PUBLIC_API_URL\|API_URL\|BASE_URL" mobile/ --include='*.ts' --include='*.tsx' | head -20
```

Cruza as URLs chamadas pelo mobile com o mapa de routes do item A. Qualquer route que aparece no mobile e **não** está na whitelist + é categoria A é **candidata forte a bug**.

### D. Sinais adicionais de suspeita

Para cada route classificada como A (Bearer) mas fora da whitelist, procurar no código evidência de que o bug já se manifestou:

- Commits com mensagem `fix.*401|fix.*403|mobile.*auth|bearer.*redirect` — sinal de fix paliativo passado.
- Issues/tickets menionados em comments (`TODO`, `FIXME`, `XXX`).
- Tratamento de erro no cliente mobile que silenciosamente cai em fallback (pattern: `catch { return null }` após `.json()`).

### E. Rotas candidatas a erro oposto (na whitelist mas não deveriam)

Inverso também importa: routes **na whitelist** que na verdade usam cookies/web → estão expostas sem `updateSession` refresh de token, podendo ter sessões expiradas não detectadas. Verificar.

### F. Relatório

`docs/specs/logs/auditoria-middleware-mobile.md` com seções:

- §1 Resumo executivo (1 parágrafo): quantas routes, quantas A, quantas com bug confirmado/suspeito.
- §2 Tabela completa: path | categoria | na whitelist? | deveria estar? | status.
- §3 Routes com bug confirmado (categoria A fora da whitelist + consumida pelo mobile). Para cada: path, consumidor mobile, feature afetada, dano estimado.
- §4 Routes com bug suspeito (categoria A ou D fora da whitelist, sem consumidor mobile direto identificado). Podem ser chamadas futuras ou por tooling externo.
- §5 Routes com possível bug inverso (na whitelist mas categoria B).
- §6 Inconsistências entre `middleware.ts` matcher e `lib/supabase/middleware.ts` updateSession.
- §7 Recomendação priorizada: qual route corrigir primeiro, baseado em dano × probabilidade do bug.
- §8 Follow-ups para evoluções estruturais (ex: "convention: toda route.ts mobile deve chamar helper único que registra path na whitelist automaticamente" — não implementar, só sugerir).

## Regras desta sessão

- **Zero edição de código.** Só leitura, análise e escrita do log.
- Não use git.
- Plano primeiro, espera aprovação antes de começar a enumeração.
- Strings user-facing em pt-BR; código/comentários em inglês.
- Se a auditoria revelar >3 routes com bug confirmado, pausa antes de escrever §7 — pode valer a pena mudar a recomendação de "fix manual por route" para "refatoração estrutural da whitelist" (ex: inverter polaridade — cookies é opt-in, Bearer é default).

## Definição de "pronto"

- `docs/specs/logs/auditoria-middleware-mobile.md` com as 8 seções.
- Contagem final clara: quantas rotas mobile-first, quantas com bug, quantas ok.
- Recomendação priorizada de fix com justificativa.
- Nenhum arquivo de código alterado.

Comece produzindo o plano. Aguarde aprovação.
