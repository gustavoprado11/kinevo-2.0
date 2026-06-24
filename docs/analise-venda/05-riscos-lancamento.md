# 05 — Riscos transversais de lançamento

> Cobertura rápida do que pode estourar quando entrar **gente de fora pagando**. Read-only. `arquivo:linha` em cada item; **[CONFIRMADO]** (lido na fonte) vs **[HIPÓTESE]** (runtime/legal). Cruza com `00`–`04`.

---

## R1 — Custo / abuso (margem e rate-limit)

- **[CONFIRMADO] Rate-limit durável por treinador** (`web/src/lib/assistant/rate-limits.ts`): TURNO 15/min·300/dia; SENSÍVEL (execute-tool) 8/min·120/dia; reusa `consumeRateLimit` (RPC, migration 195) — compartilhado entre instâncias serverless. **Fail-open** em erro de DB (`rate-limits.ts:10-11`). MCP externo: 30/min·1000/dia (`lib/mcp/auth.ts`).
- **[CONFIRMADO] Teto por turno** `MAX_TURN_CREDITS=12` (`tool-policy.ts:222`) + **clamp atômico** no DB (`consume_ai_usage`, migr 216) → o medidor não estoura.
- **⚠️ Vazamento de COGS residual (não de medidor):** o gate `checkQuota` é cego ao custo (`quota.ts:101`); um treinador no limite ainda dispara turnos cujo COGS é gasto mas clampado fora do ledger. Bounded por 15 turnos/min × 12 créditos. Abuso individual de custo desproporcional fica **limitado**, mas existe. Quantificação e fixes em `01-travas-tokens.md`.
- **Margem por tier:** o build agora roda em **Gemini 3.5 Flash** (`command-engine.ts:71`), classificado "premium ~2,6–3,3× o gpt-4.1-mini, ~$0,055/tarefa" em `docs/analise-mcp-assistente-custos.md`. Com peso 6 créditos/build, **revalidar margem** (a doc de custos modelava Sonnet/mini, não Gemini-default). O cenário "pesado" continua estourando o ARPU de R$39,90 (≈92%) e só fecha a R$79,90 **com subsetting + gate** — venda do F9/tiers altos pressupõe o reposicionamento de preço. Detalhe em `01`.

## R2 — Segurança de ações + injeção de prompt

- **[CONFIRMADO] O *sink* de ações externas foi FECHADO** (era S1/S2/S3, gap do baseline): `kinevo_send_message`, `kinevo_send_form`, `kinevo_schedule_form`, `kinevo_generate_checkout_link` agora estão em `CONFIRM_TOOLS` (`tool-policy.ts:133-136`) → HITL/rascunho-primeiro. `send_message` tem campo editável no card (`command-engine.ts:234-236`) e guardrail de destinatário (`:603-612`, validado E2E no relatório noturno). As 5 W-GATE + destrutivas seguem confirmadas.
- **[CONFIRMADO] Anti-injeção em profundidade (v2.3.0):** o system-prompt manda tratar **resultado de tool** como dado não-confiável (`system-prompt.ts:21,64`); texto livre do aluno é cercado em `<<DADOS_DO_ALUNO>>` (`context-builder.ts:226,230,261`). É a defesa do commit `45e9081`. **Resíduo:** a "lethal trifecta" não está totalmente quebrada (o planejador ainda vê prosa crua de algumas tool-results) — defesa arquitetural (leitor em quarentena) segue como Onda 4, mas com o sink fechado o risco cai abaixo de crítico. **[HIPÓTESE]** revalidar com a suíte de evals antes do go-live.
- **⚠️ Dock legado sem HITL** (`/api/assistant/chat`): hoje só 3 tools, 1 write (rascunho) — seguro, mas **bypassa o framework de CONFIRM_TOOLS**. Qualquer write novo aqui herda **zero** HITL. Ver `04`/`01` (convergir ou congelar o dock).

## R3 — LGPD / privacidade

- **[CONFIRMADO] Portão LGPD ainda aberto no código:** varredura por `zero-retention|store:false|anthropic-beta|baseURL|defaultHeaders|OpenAI-Organization|dpa` em `web/src` = **0**. Os clients LLM são instanciados só com a key. Dado de saúde (restrições médicas, check-ins, avaliação física — 14 tools `[S]`) flui a OpenAI/Gemini/Anthropic **sem evidência em código** de DPA/ZDR/no-training. Sob LGPD Art. 11 (dado sensível) isso é o **portão-0** de venda pública (mantém o veredito da doc de custos).
- **Mitigação parcial nova:** existe política de privacidade que **nomeia** Anthropic e OpenAI e avisa que dados de saúde podem ser enviados (`web/src/app/privacy/page.tsx:71,81,92`; `docs/conector/page.tsx:105`). **Porém** o texto enquadra a IA como o **conector/MCP** (treinador conecta Claude/ChatGPT), **não** o Assistente in-app que chama OpenAI/Gemini server-side. Falta: (1) DPA + ZDR assinados/habilitados nos provedores do **Assistente in-app** (OpenAI gpt-4.1-mini, Google Gemini); (2) disclosure cobrindo esse caminho server-side; (3) minimização do payload sensível. **[HIPÓTESE/LEGAL]** — fora do repo, confirmar no console.
- **[CONFIRMADO] Redação de segredo:** `execute-tool` grava resultado **redigido** (`redactSensitive`, `execute-tool/route.ts:204`) → senha de `convert_lead` não persiste em texto puro (corrige S6). TTL de traces > 90 dias (migration 218).

## R4 — Pendências conhecidas ainda abertas

| Item | Status | Impacto na venda |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` em prod | **[HIPÓTESE]** load-bearing do build (Gemini); ausente → cai p/ gpt-4.1-mini sem quebrar (`command-engine.ts:76`) | Médio (qualidade do build) |
| `ANTHROPIC_API_KEY` válida | **Superada** p/ o build (não é mais Sonnet por padrão) | Baixa |
| Streaming de texto no flagship | Aberto — `generateText` (`command-engine.ts:532`); só o dock streama | UX, não bloqueante |
| Voz / mobile do Assistente | ~25% / 0% (baseline) | Promessa de produto, não trava a venda da web |

## R5 — Multi-tenant nos caminhos de billing/cota

- **[CONFIRMADO] Sem furo cross-tenant na cota:** `recordAiUsage`/`consume_ai_usage` operam por `p_trainer_id` (`metering.ts:166`, `216:34-50`); `checkQuota`/`getAiUsageSummary` filtram por `trainer_id` (`quota.ts:90`, `usage-summary.ts:92`); o trainer é sempre resolvido da **sessão/JWT**, nunca do corpo (`execute-tool/route.ts:82-87`, `ai-status/route.ts:46-54`, `ai-canvas/route.ts:28-33`). A cota de um treinador não contamina outro.
- **[CONFIRMADO] Webhook escopado por `trainer_id`** vindo de `session.metadata` / `stripe_subscription_id` (`webhooks/stripe/route.ts:124,170`). Idempotência por `event_id` evita duplo-efeito. Cross-tenant não é o risco aqui; o risco é **out-of-order** (tier não setado) — ver `02`.

---

### Veredito rápido dos riscos
- **Bloqueante de verdade:** LGPD (R3) e a possibilidade de **não dar para comprar Pro/Premium** (envs/price — `02`). 
- **Alto:** `essencial` paga sem Assistente (promessa falsa — `03`/`04`); margem do build Gemini a revalidar (R1).
- **Controlado/maduro:** HITL das ações externas (R2), rate-limit + clamp (R1), isolamento multi-tenant (R5), idempotência de webhook e de ação (R2/02).
