# PROMPT — Go-live da Fase 0 (Stripe + Vercel + push + testes em prod)

> Cole numa **aba/sessão nova** do Claude Code na raiz do repo `kinevo`.
> A F0 já está implementada no working tree e validada; a migration 208 já está em prod.
> Esta etapa **configura billing + ambiente + sobe pra produção + testa lá**.
> Você tem acesso via MCP a **Stripe, Vercel e Supabase**.

---

Você vai colocar a **Fase 0 da "IA do Treinador" em produção**: criar os planos no Stripe, setar as env
vars no Vercel, commitar+pushar o working tree e validar em produção.

## 0. Leia antes
1. `web/specs/active/ai-trainer-platform/SPEC.md` (master) e a seção "Notas de Implementação" (estado do F0).
2. `web/src/lib/auth/get-ai-tier.ts` — **fonte da verdade dos nomes de env e do mapeamento price→tier**
   (`STRIPE_PRICE_ESSENCIAL` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PREMIUM`; o `STRIPE_PRICE_ID` legado já
   mapeia para `essencial`).
3. `web/src/app/api/webhooks/stripe/route.ts` e `api/stripe/checkout/route.ts` — o que o F0 mudou.

## 1. Guardrails (inegociáveis)
- **Dinheiro real:** os preços do Stripe serão criados em **modo LIVE** (a conta tem o R$39,90 real). Confira
  **valores e moeda (BRL) e intervalo (mensal)** antes de criar e **ecoe exatamente** o que criou. **Não**
  complete nenhum checkout real (não gere cobrança).
- **Deploy de produção:** push em `main` = deploy Vercel imediato. Você está **autorizado** a commitar e pushar
  esta feature (o Gustavo pediu). Commits atômicos; termine cada mensagem com
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Nada de UI exposta:** a F0 não tem UI; criar Price IDs + env vars **não expõe** Pro/Premium a ninguém.
  A feature segue atrás do override `trainers.ai_tier` (dogfooding). Não habilite venda pública.
- **Testes em prod com conta descartável** (use "Trainer Carteira Teste" ou crie um treinador throwaway).
  **Nunca** toque em dados/assinaturas de treinadores reais. **Limpe** todo dado de teste no fim
  (tokens MCP transitórios, alunos, treinadores throwaway) e **verifique 0 linhas restantes**.
- **MCP:** carregue os tools do Stripe/Vercel via `ToolSearch` e **autentique** se pedir
  (`mcp__*__authenticate` / `complete_authentication`). Confirme que está na conta/projeto certos do Kinevo.
- Não commitar `web/specs/mcp-server/chatgpt-app-submission.json` (alheio).

## 2. Passo a passo

### Passo 1 — Stripe: criar os planos (modo LIVE, BRL, mensal)
1. Autentique o Stripe MCP. Confirme que é a conta do Kinevo (a que tem o price R$39,90 atual).
2. **Descubra o `STRIPE_PRICE_ID` atual** (R$39,90) — via env do Vercel (já existe) ou listando prices no Stripe.
   `STRIPE_PRICE_ESSENCIAL` deve ser **igual a esse price existente** — **não crie um price novo de Essencial**.
3. **Liste produtos/prices existentes** para não duplicar (Pro/Premium não devem existir ainda).
4. Crie no Stripe (LIVE):
   - Product **"Kinevo Pro IA"** → Price **R$ 79,90/mês** (`unit_amount: 7990`, `currency: brl`,
     `recurring.interval: month`) → guarda como `STRIPE_PRICE_PRO`.
   - Product **"Kinevo Premium IA"** → Price **R$ 129,90/mês** (`unit_amount: 12990`, `currency: brl`,
     `recurring.interval: month`) → `STRIPE_PRICE_PREMIUM`.
5. **Ecoe** os 3 valores finais: `STRIPE_PRICE_ESSENCIAL` (= price existente), `STRIPE_PRICE_PRO`,
   `STRIPE_PRICE_PREMIUM`, com os amounts, para conferência.

### Passo 2 — Vercel: env vars (antes do push, para o deploy já pegar)
1. Autentique o Vercel MCP. Ache o **projeto do Kinevo web** (`list_projects`). Confirme que o
   `STRIPE_PRICE_ID` atual está lá e **não o altere**.
2. Crie/atualize em **Production** (e Preview, se o projeto usar): `STRIPE_PRICE_ESSENCIAL`,
   `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM` com os valores do Passo 1.
3. Confirme que ficaram setadas (liste e cheque).

### Passo 3 — Commit + push (deploy)
1. Organize os commits atômicos (sugestão do F0):
   - `feat(db): migration 208 ai_platform + types`
   - `feat(billing): tier resolution + stripe price→tier (webhook/checkout)`
   - `feat(limits): student cap por tier + downgrade guard`
   - `feat(assistant): mcp bridge + tool-policy (55 tools, subsetting, HITL)`
   - `feat(ai-usage): metering + quota + execute-tool HITL`
   - `test: unit + live E2E da plataforma`
   - `docs(spec): ai-trainer-platform + notas F0`
2. `git push origin main`. Acompanhe o deploy pelo Vercel MCP (`list_deployments`/`get_deployment`) até **Ready**.
   O deploy pega o **código novo + as env vars novas** de uma vez.

### Passo 4 — Testes em PRODUÇÃO (conta descartável + limpeza)
Objetivo: provar que o billing e os gates funcionam no ambiente real. Use Supabase MCP (projeto
`lylksbtgrihzepbteest`) e o endpoint MCP de prod com token transitório (padrão já usado na sessão:
inserir hash sha256 em `mcp_oauth_tokens`, chamar via curl, revogar no fim).

1. **Deploy saudável:** `tools/list` em `https://www.kinevoapp.com/api/mcp` retorna as **55 tools**.
2. **Env→tier (mapa):** num registro de teste, setar `subscriptions.stripe_price_id = <STRIPE_PRICE_PRO>`
   e confirmar que `get-ai-tier` resolve `pro_ia`; com `STRIPE_PRICE_PREMIUM` → `premium_ia`; com price NULL +
   sub ativa → `essencial`. (Pode validar via um treinador throwaway + leitura do estado; o importante é
   provar que as **env vars novas estão no ar** e o mapa resolve.)
3. **Student cap em prod:** crie um **treinador throwaway** sem assinatura (resolve `free`) e, via a tool MCP
   `kinevo_create_student` (token transitório), confirme: **1º aluno OK, 2º BLOQUEADO**. Depois setar
   `trainers.ai_tier='premium_ia'` (override) e confirmar que **libera**. 
4. **Webhook price→tier (se viável com segurança):** se der pra disparar um evento de teste do Stripe
   (`customer.subscription.updated`) para o webhook de prod sem efeito colateral, verifique que
   `subscriptions.stripe_price_id` é **gravado**. Se não for seguro/trivial, **pule** e valide o code-path por
   inspeção (anote que será confirmado no próximo evento natural). **Não force cobrança.**
5. **Limpeza:** delete o treinador throwaway (+ auth user), alunos de teste, tokens transitórios e qualquer
   linha de `ai_usage_*` de teste. **Verifique 0 linhas restantes** e que o "Trainer Carteira Teste" e dados
   reais ficaram intactos.

## 3. Ao terminar — reporte
- **Stripe:** os 3 Price IDs (essencial=existente, pro, premium) + amounts + modo (live).
- **Vercel:** env vars setadas (nomes + em quais environments) + confirmação de que o `STRIPE_PRICE_ID` ficou intacto.
- **Git/deploy:** SHAs dos commits + URL do deploy + status Ready.
- **Testes em prod:** resultado de cada item do Passo 4 + confirmação de limpeza (0 linhas).
- **Pendências:** o que fica para F1 (UI de planos, `/subscription/blocked`→Free, wiring do downgrade-guard,
  metering no `onFinish`, gate mobile) e o que ainda precisa do Gustavo (criar a UI de venda quando for go-live público).

**Comece autenticando os MCPs (Stripe/Vercel), lendo `get-ai-tier.ts` para os nomes de env, e me
apresentando um plano curto (incluindo os amounts e o modo do Stripe) antes de criar qualquer coisa.**
