# STATUS DAS FRENTES — quadro vivo

> Atualize este arquivo ao fechar/abrir uma frente. Última atualização: **07/jul/2026**.
> Convenção: ✅ concluído · 🔧 corrigido no working tree (NÃO commitado) · ⏳ pendente de decisão/ação · 🚧 em andamento.

## ⚠️ Estado do working tree (07/jul, fim do dia)

Os 3 lotes de 07/jul (auditoria geral, Financeiro Asaas F1-F4, Consultoria IA + migration 226) foram **COMMITADOS e PUSHADOS** (`8fdd40c`/`707619e`/`0de7d6d`/`df76dfd`…`3df15ec`) após o QA aprovado (`qa-report-2026-07-07.md`). O batch do **Assistente** (dark mode W1, créditos do free W2, kill-switch, fixes A1/A2 + docs) foi commitado/pushado com autorização em 07/jul — ver linha do Assistente abaixo. Restos untracked intencionais: `qa-scripts/` (harness descartável do QA comportamental; não commitar).

## Frentes

| Frente | Estado | Relatório-fonte | Pendências / próximos passos |
|---|---|---|---|
| **Financeiro Asaas** | 🔧 F1-F4 no working tree | `analise-financeiro-2026-07-07.md` | Decisões: P6 reembolso→acesso, P9 rail PIX mensal, P11 unificar carência (migration), P12 alinhar taxa. Features: P19 MCP Asaas (extrair `createAsaasChargeCore`), P20 export/histórico, paridade mobile (block_on_fail, flags de plano, migrar, KYC upload). Prova por EVENTO do webhook ainda pendente → só depois rotacionar subcontas (que também entrega os eventos de chargeback nas 2 contas existentes) |
| **Auditoria geral (jul/07)** | ✅ fixes commitados | `auditoria-web-mobile-2026-07-07.md` | ~~R1 deploy Strava fns~~ **FEITO (verificado 07/jul: v3 deployada == repo, diff idêntico)**, R2 rotacionar ANTHROPIC_API_KEY no Vercel, R3 hardening OVERDUE/REFUNDED/CHARGEBACK pós-prova, R4 gate no createOrganization, R5 markAsPaid retry parcial, advisors (leaked-password 1 clique, policies service_role, índices FK de IA) |
| **Consultoria IA** | 🚧 WIP + fixes da auditoria | `rede-consultoria-ia/PLANO.md` | Testar localmente → commitar COM a migration 226; decidir merge do perfil de prescrição (clobber); validar CREF formato; M4 telemetria gate |
| **Builder (web+mobile)** | ✅ rodadas 1+2 pushadas (38a7b66) | `analise-builder-rodada2-2026-07-06.md` | Deferidos R19/R20/R24 (design); validar em device R15 Watch/R11 iPad/R9 IA; builder de criação ainda N+1 (portar p/ RPC 198) |
| **Assistente IA (Modo Assistente)** | ✅ Ondas 1-6 deployadas · **JÁ ABERTO a todos os tiers desde 26/jun** (`80085ed`, free=taste) · 🔧 W1+W2 no working tree · ✅ **QA comportamental 07/jul: GO** (`analise-assistente-comportamental-2026-07-07.md`) · 🔧 kill-switch `ASSISTANT_DISABLED` no working tree | `analise-assistente-lancamento-2026-07-07.md` | 🔧 07/jul working tree: W1 dark mode (7 superfícies + fim do force-light em /assistente) e W2 copy/clamp do free — QA visual dark+light OK, 1386 testes verdes. **QA comportamental (07/jul): nada bloqueia** — F2 jornadas 14/14 no banco, F4 zero injeção/cross-tenant, F5 concorrência (clamp atômico, 429, idempotência), F3 prescrições Gemini profissionais/seguras, F6 kill-switch entregue + verificado. Achados: **A1 e A2 CORRIGIDOS no working tree 07/jul e verificados E2E 7/7** (broadcast→batch via prompt v2.4.0 + eval 36; posse estrita W-EXTERNO → 422 tipado; adendo §9 do relatório comportamental); A3 harness de evals dá falso-negativo (0 violações HITL, mas asserção de tool falha sem contexto de rota — corrigir p/ virar CI). Restam p/ anunciar: build EAS mobile (binário lojas é pré-Onda 3, sem OTA; bump 1.5.7; risco Apple IAP), gate mobile fail-closed (M2), CTA upgrade mobile (M3). Voz desligada (TTS neural). Casca única NÃO está em main (working tree perdido — redecidir). Economia fecha (Premium pior caso 15% → subir peso build 6→7-8) |
| **Segurança/RLS** | ✅ auditorias mai+jul aplicadas | `security/`, memória | Vivo: R1/R2/R3 acima; advisors zero ERROR; resíduo Estúdios RESOLVIDO (migr 225) |
| **Apple Watch** | ✅ fixes jun pushados | `analise-watch/` | Validar em device físico (sync, FINISH queue); integridade duplo-lado documentada |
| **Mobile core (player/offline)** | ✅ + 2 fixes de sessão no working tree | `AUDITORIA-MOBILE-2026-06.md` + auditoria jul | LOWs: side effects em updaters, enqueue por isNetworkError, logout escopar filas por user, footer rest superset |
| **Saúde do aluno (aba)** | ✅ Oura+Strava+watchdog+realtime em prod · 🔧 F1+F2 mobile commitados (aguardam EAS 1.5.7) | `analise-saude-aluno-2026-07-07.md` (§6-§9) | ✅ Oura consertado (webhook v5, HMAC timestamp+body; backfill 46d). ✅ **F3**: `wearable-reconcile` watchdog (cron diário), `strava-webhook` (subscription 360547 CRIADA 08/jul após Gustavo reativar o app Strava), token server-side, migr 236. ✅ **F2**: C10/C9/item7/C13 realtime (migr 237). Última milha Strava: aluno abrir o app 1× (refresh persiste token server-side via edge v4 — não precisa do build novo). Resta só: **cortar o build EAS 1.5.7** (leva F1+F2 mobile + composer/ditado assistente) |
| **Estúdios (B2B)** | ⏳ fundação (migr 222/223) | `estudios/` | v1 gestão; RPCs KPI órfãs (sem caller); gate no createOrganization antes de expor self-serve |
| **MCP / Connectors** | ✅ 62 tools deployadas | memória | Directory: falta conta teste/doc/branding; P19 tools Asaas |
| **Perf web** | 🚧 batch 1 deployado | `perf-web-2026-06-23.md` | Próximos cortes (INP/PPR/bundle) aguardam RUM real |
| **Watch/EAS builds** | ⏳ | memória | iOS: setup interativo de credencial; Android: google-service-account p/ submit |

## Mapa de relatórios (onde está cada análise)

- Raiz de `docs/`: análises datadas (`analise-*.md`, `auditoria-*.md`, `qa-*.md`) — as mais recentes primeiro.
- `docs/reports/` — relatórios históricos (auditorias antigas, planos de design).
- `docs/analise-noturna/`, `analise-venda/`, `analise-watch/` — lotes temáticos de jun/2026.
- `docs/prototypes/` — mockups HTML (movidos da raiz em 07/jul; inclui ai-trainer-*, financeiro-*, sidebar-mockups/).
- `docs/archive/prompts/` — prompts de análise já executados.
- `docs/asaas-integration/`, `security/`, `estudios/`, `prescription/`, `specs/`, `prd/`, `architecture/` — documentação por domínio.
- `_planning/` (raiz) — material de planejamento solto (docx/xlsx/analysis/mocks/specs).
