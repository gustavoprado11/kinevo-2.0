# docs/ — mapa

**Comece por [`STATUS.md`](STATUS.md)** — quadro vivo das frentes: o que foi analisado/corrigido, o que está no working tree sem commit, pendências e próximos passos por frente.

## Convenções

- **Análises/auditorias datadas** ficam na raiz de `docs/` com o padrão `analise-<tema>-<AAAA-MM-DD>.md` / `auditoria-<tema>-<data>.md`. Relatórios de QA: `qa-*.md`.
- Ao fechar uma frente ou abrir pendência nova, **atualize o STATUS.md** (é o índice que as próximas sessões leem primeiro).
- Prompts para agentes executores: raiz do repo enquanto ativos (`PROMPT-*.md`), depois → `archive/prompts/`.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `reports/` | Relatórios históricos (auditorias antigas, planos de UX/design) |
| `analise-noturna/`, `analise-venda/`, `analise-watch/` | Lotes temáticos de análise (jun/2026) |
| `prototypes/` | Mockups HTML navegáveis (ai-trainer, financeiro, sidebar…) |
| `archive/` | Material encerrado (inclui `prompts/`) |
| `asaas-integration/` | Documentação da integração Asaas |
| `security/` | Auditorias e hardening de segurança |
| `estudios/` | Roadmap do tier B2B Estúdios |
| `rede-consultoria-ia/` | Spec da feature Consultoria IA (WIP) |
| `prescription/`, `prd/`, `architecture/`, `specs/`, `integrations/`, `landing-specs/`, `harness/`, `dev-loops/`, `qa-loop/` | Documentação por domínio/ferramenta |
