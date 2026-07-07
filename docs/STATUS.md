# STATUS DAS FRENTES — quadro vivo

> Atualize este arquivo ao fechar/abrir uma frente. Última atualização: **07/jul/2026**.
> Convenção: ✅ concluído · 🔧 corrigido no working tree (NÃO commitado) · ⏳ pendente de decisão/ação · 🚧 em andamento.

## ⚠️ Estado do working tree (07/jul)

O working tree acumula 3 lotes NÃO COMMITADOS (workflow: commit/push só com autorização):
1. **Auditoria geral web+mobile** — 12 fixes (`auditoria-web-mobile-2026-07-07.md`).
2. **Financeiro Asaas Fases 1-4** — ~20 fixes (`analise-financeiro-2026-07-07.md` §6-§8).
3. **Consultoria IA (feature WIP)** — `web/src/{app,actions,lib}/consultoria/` + migration 226 (**APLICADA em prod mas untracked — commitar junto!**).

**QA COMPLETO (07/jul): APROVADO PARA COMMIT** — `qa-report-2026-07-07.md`. Zero bugs de correção; 30 itens conferem. Pré-commit: remover imports mortos (achado B1: `student-financial-modal.tsx` + `student-header.tsx`) e a prop morta `hasStripeConnect` do modal (B2). Itens bloqueados (carteira Asaas viva, device físico p/ push, MCP em prod) → validar no primeiro uso real pós-deploy.

## Frentes

| Frente | Estado | Relatório-fonte | Pendências / próximos passos |
|---|---|---|---|
| **Financeiro Asaas** | 🔧 F1-F4 no working tree | `analise-financeiro-2026-07-07.md` | Decisões: P6 reembolso→acesso, P9 rail PIX mensal, P11 unificar carência (migration), P12 alinhar taxa. Features: P19 MCP Asaas (extrair `createAsaasChargeCore`), P20 export/histórico, paridade mobile (block_on_fail, flags de plano, migrar, KYC upload). Prova por EVENTO do webhook ainda pendente → só depois rotacionar subcontas (que também entrega os eventos de chargeback nas 2 contas existentes) |
| **Auditoria geral (jul/07)** | 🔧 12 fixes no working tree | `auditoria-web-mobile-2026-07-07.md` | R1 deploy Strava fns (autorizar!), R2 rotacionar ANTHROPIC_API_KEY no Vercel, R3 hardening OVERDUE/REFUNDED/CHARGEBACK pós-prova, R4 gate no createOrganization, R5 markAsPaid retry parcial, advisors (leaked-password 1 clique, policies service_role, índices FK de IA) |
| **Consultoria IA** | 🚧 WIP + fixes da auditoria | `rede-consultoria-ia/PLANO.md` | Testar localmente → commitar COM a migration 226; decidir merge do perfil de prescrição (clobber); validar CREF formato; M4 telemetria gate |
| **Builder (web+mobile)** | ✅ rodadas 1+2 pushadas (38a7b66) | `analise-builder-rodada2-2026-07-06.md` | Deferidos R19/R20/R24 (design); validar em device R15 Watch/R11 iPad/R9 IA; builder de criação ainda N+1 (portar p/ RPC 198) |
| **Assistente IA (Modo Assistente)** | ✅ Ondas 1-6 deployadas | `analise-modo-assistente-2026-06-22.md` | Voz desligada (reabrir só com TTS neural); mobile streaming; casca única (working tree antigo?); custos em `analise-mcp-assistente-custos.md` |
| **Segurança/RLS** | ✅ auditorias mai+jul aplicadas | `security/`, memória | Vivo: R1/R2/R3 acima; advisors zero ERROR; resíduo Estúdios RESOLVIDO (migr 225) |
| **Apple Watch** | ✅ fixes jun pushados | `analise-watch/` | Validar em device físico (sync, FINISH queue); integridade duplo-lado documentada |
| **Mobile core (player/offline)** | ✅ + 2 fixes de sessão no working tree | `AUDITORIA-MOBILE-2026-06.md` + auditoria jul | LOWs: side effects em updaters, enqueue por isNetworkError, logout escopar filas por user, footer rest superset |
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
