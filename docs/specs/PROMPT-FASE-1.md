# Prompt para o Claude Code — Fase 1

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia e siga as seguintes specs, nesta ordem:

1. `docs/specs/00-visao-geral.md` — decisões, invariantes e glossário. **Ler inteiro antes de qualquer coisa.**
2. `docs/specs/01-fase-1-embutir-painel-ia.md` — a fase que você vai executar nesta sessão.

Você **não** vai executar as Fases 1.5, 2, 3 ou 4. Apenas Fase 1.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. O plano deve ter:

- Lista ordenada dos passos que você fará, cada um com os arquivos que vai tocar e critério de pronto.
- Pontos onde você prevê risco ou ambiguidade (ex: nomes de arquivos que não confirmei, props do `PrescriptionProfileForm` em modo compact, comportamento do construtor quando há `generationId` na URL).
- Estratégia de testes para cada etapa (unitários, componente, integração).
- Ordem em que você executará para manter o repo compilando entre passos (ex: criar hook antes de refatorar o componente que o usa).

Só comece a editar código **depois que eu aprovar o plano**. Se durante a execução descobrir algo que contraria o plano aprovado, pare e reporte antes de desviar.

## Regras para esta sessão

- **Não use git.** Não faça `git add`, `commit`, `push`, nem crie branch. Eu mesmo gerencio commits e PR. Edite os arquivos, rode testes, pronto.
- **Não faça refactor oportunista.** Código feio vizinho ao que você está mudando: deixe como está e registre numa lista de "follow-ups sugeridos" que você me entrega no fim.
- **Respeite as invariantes da seção 4 do `00-visao-geral.md`.** Especialmente: não mudar schema de banco, não mexer no pipeline da LLM, preservar o comportamento funcional do `/prescribe` atual, manter `?source=prescription&generationId=...` funcionando.
- **Se uma invariante estiver prestes a ser violada, pare e me avise.** Não tente contornar.

## Premissas do ambiente

- O repo é o monorepo Kinevo em `~/kinevo`. O app web está em `web/`.
- Supabase local pode estar rodando ou não — se rodar testes que precisem do banco, use os mocks que já existem no projeto, ou crie stubs em `web/src/lib/prescription/__fixtures__/` se necessário.
- Node/pnpm instalados. Use o gerenciador que o projeto já usa (verificar `package.json` / lockfile antes de rodar comandos).
- O Gustavo fala português; sua comunicação comigo pode ser em português, mas código, commits (quando eu fizer) e strings técnicas em inglês seguindo o padrão do projeto. Strings user-facing em pt-BR.

## Definição de "pronto"

- Todo o checklist da seção 6 do `01-fase-1-embutir-painel-ia.md` marcado.
- `pnpm tsc --noEmit` (ou equivalente do projeto) verde.
- Suite de testes verde.
- Walk-through manual descrito na seção 5.4 da spec documentado num arquivo `docs/specs/logs/fase-1-execucao.md` com screenshots ou passo a passo textual do que você testou e o resultado.
- Lista de "follow-ups sugeridos" (se houver) no mesmo arquivo de log.

Comece produzindo o plano. Aguarde aprovação.
