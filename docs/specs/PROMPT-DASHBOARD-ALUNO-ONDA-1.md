# Prompt para o Claude Code — Dashboard do Aluno · Onda 1 (Quick Wins)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia e siga as seguintes specs, nesta ordem:

1. `docs/specs/dashboard-aluno-00-visao-geral.md` — decisões, invariantes e glossário. **Ler inteiro antes de qualquer coisa.**
2. `docs/specs/dashboard-aluno-01-onda-1-quick-wins.md` — a onda que você vai executar nesta sessão.

Você **não** vai executar as Ondas 2 ou 3. Apenas a Onda 1.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. O plano deve ter:

- Lista ordenada dos passos (5 da spec) com os arquivos que você vai tocar e critério de pronto.
- Pontos onde você prevê risco ou ambiguidade (ex: como `StudentScheduleSection` expõe sua contagem hoje, exato significado de "Substituído" no histórico, lugar correto para acionar o tour opt-in).
- Estratégia de testes para cada passo.
- Ordem em que você executará para manter o repo compilando entre passos.

Só comece a editar código **depois que eu aprovar o plano**. Se durante a execução descobrir algo que contraria o plano aprovado, pare e reporte antes de desviar.

## Regras para esta sessão

- **Não use git.** Não faça `git add`, `commit`, `push`, nem crie branch. Eu mesmo gerencio commits e PR. Edite os arquivos, rode testes, pronto.
- **Não faça refactor oportunista.** Código feio vizinho ao que você está mudando: deixe como está e registre numa lista de "follow-ups sugeridos" no log.
- **Respeite as invariantes da seção 3 do `dashboard-aluno-00-visao-geral.md`.** Em especial: nada de migração de schema, nada de bibliotecas novas, sem mudanças em `page.tsx` (queries) nesta onda.
- **Se uma invariante estiver prestes a ser violada, pare e me avise.** Não tente contornar.

## Premissas do ambiente

- Repo monorepo Kinevo em `~/kinevo`. App web em `web/`.
- Use o gerenciador de pacotes que o projeto já usa (verificar `package.json` / lockfile).
- Supabase local pode estar rodando ou não — para testes que precisem do banco, use mocks/stubs já existentes ou crie em `__fixtures__/` ao lado.
- O Gustavo fala português; sua comunicação comigo pode ser em português, mas código e nomes técnicos seguindo o padrão do projeto. Strings user-facing em pt-BR.

## Definição de "pronto"

- Todo o checklist da seção 5 do `dashboard-aluno-01-onda-1-quick-wins.md` marcado.
- `pnpm tsc --noEmit` (ou equivalente do projeto) verde.
- Suite de testes verde.
- Walk-through manual descrito no checklist documentado num arquivo `docs/specs/logs/dashboard-aluno-onda-1.md` com screenshots ou passo a passo textual.
- Lista de "follow-ups sugeridos" (se houver) no mesmo log.

Comece produzindo o plano. Aguarde aprovação.
