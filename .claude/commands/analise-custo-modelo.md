---
description: Roda a análise de custo do modelo do Assistente (traces de prod, cache, passos, cenários de preço e margem por plano)
---

Rode a análise de custo do modelo do Assistente do Kinevo, ponta a ponta. O objetivo é responder: **quanto custa um build hoje (medido, não estimado), a margem por crédito fecha em cada plano, e vale trocar de modelo?**

Contexto permanente: a metodologia, os números de baseline e as armadilhas conhecidas estão em `docs/analise-custo-modelo-ponta-2026-07-13-peer-review.md` — leia o §1 (arquitetura), §6 (régua de margem) e §9 (onde desconfiar) antes de concluir qualquer coisa. Desde 13/jul/2026 (migr 250) os traces medem `cached_input_tokens` e `steps` de verdade; antes disso, cache era NULL e custo registrado era teto (assumia cache=0).

## Passos

1. **Dados medidos de produção** — rode da pasta `web/`:
   ```bash
   node scripts/analyze-model-cost.mjs 30
   ```
   (ajuste a janela em dias se o pedido indicar outra; `--fx N` muda o câmbio, default 5,50). Leia as 6 seções: agregado por modelo com **cache hit real** e **passos reais**, builds individuais, regressão de buscas seriais, retries com custo, turnos perdidos, e R$/crédito efetivo.

2. **Catálogo de tools (só se a composição do input importar para a pergunta)** — o catálogo cresce com o produto; a última medição real (13/jul/2026, tokenizador cl100k) foi **16.775 tokens** para o catálogo completo (62 tools) e **9.765** para o subset de build (30 tools), ratio ~4,0 chars/token no JSON serializado. Para re-medir: instancie a ponte (`buildMcpTools`) num teste temporário nos moldes dos `.live.test.ts` (carregue `.env.local` antes — o import exige env), serialize `{name, description, parameters}` por tool e tokenize.

3. **Preços vigentes dos modelos** — NÃO use os preços de memória nem os da baseline sem conferir: busque as páginas oficiais de pricing (OpenAI, Google, Anthropic) na web. Atenção às armadilhas já documentadas: tier de long-context (só vale para janela ÚNICA, não para a soma dos passos), cache write da Anthropic (1,25× o input, uma vez por prefixo), e promoções com data de expiração (a promo do Sonnet 5 acabava em 31/ago/2026 — pós-promo o Premium IA não fechava).

4. **Régua de margem** — a métrica que decide é `custo por crédito vs receita por crédito`, nunca % de ARPU:
   - Receita/crédito: preços e cotas em `web/src/lib/billing/tiers.ts`.
   - Peso do build em créditos: `web/src/lib/assistant/tool-policy.ts` (era 6 em jul/2026).
   - Custo/crédito = ($/build × câmbio) ÷ peso do build.
   Monte a tabela por plano (Essencial / Pro IA / Premium IA) para: o modelo atual medido, e os candidatos a upgrade nos preços vigentes, usando o **cache hit real** da seção 1 (não a premissa de 80%).

5. **Conclusão e relatório** — escreva `docs/analise-custo-modelo-YYYY-MM-DD.md` com: números medidos vs baseline de 13/jul, a tabela de margem, mudanças relevantes (catálogo cresceu? cache caiu? passos subiram? regressão de buscas seriais?) e recomendação acionável. Resuma no chat em português, liderando com a resposta.

## Regras

- Só leitura no banco; nada de migration ou deploy neste comando.
- NÃO commitar nem dar push sem autorização explícita (workflow do repo).
- Se a janela tiver poucos builds (<10), diga isso com destaque — decisão de modelo com amostra pequena é a armadilha nº 4 do §9 da baseline.
- Qualidade ≠ custo: se a pergunta for "vale um modelo melhor?", o custo responde metade; a outra metade é head-to-head no harness de evals (`web/src/lib/assistant/evals/`, teste live `build-turn.live.test.ts` com `RUN_LIVE_BUILD=1`).
