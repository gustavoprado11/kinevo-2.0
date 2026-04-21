# Prompt para o Claude Code — Fase 1.5

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia e siga as seguintes specs, nesta ordem:

1. `docs/specs/00-visao-geral.md` — decisões, invariantes e glossário. **Ler inteiro antes de qualquer coisa.**
2. `docs/specs/01-fase-1-embutir-painel-ia.md` — fase anterior, já executada. Ler para entender o que existe hoje.
3. `docs/specs/02-fase-1.5-streaming-parcial.md` — a fase que você vai executar nesta sessão.
4. `docs/specs/logs/fase-1-execucao.md` — log da fase anterior (se existir). Ajuda a entender o que o código parece hoje.

Você **não** vai executar as Fases 2, 3 ou 4. Apenas Fase 1.5.

## Contexto adicional crítico

A spec da Fase 1.5 foi **reescrita em 18/abr/2026** depois de uma reavaliação. Se você encontrar referências antigas a "commits parciais por workout" ou "N chamadas de LLM, uma por aula", ignore — a abordagem atual é **pipeline intacto + reveal progressivo no client via Realtime**. A spec atual é a fonte da verdade; quaisquer outros docs são histórico.

O fix da Fase 1 para hidratação (bug do canvas vazio) foi aplicado em `web/src/app/students/[id]/program/new/page.tsx`: adicionado `key={generationId ?? 'blank'}` no `<ProgramBuilderClient>`. Isso força remount quando a URL ganha `generationId`. Esse fix funciona hoje. Na 1.5, você talvez precise remover ou manter esse `key` — decidir com base no comportamento do hook novo.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. O plano deve ter:

- Lista ordenada dos passos que você fará, cada um com os arquivos que vai tocar e critério de pronto.
- Pontos onde você prevê risco ou ambiguidade. Minha lista inicial (pode expandir):
  - Supabase Realtime + RLS baseada em função custom (`current_trainer_id()`) — a subscription realmente recebe UPDATE quando a row pertence ao trainer?
  - Interação entre o `key={generationId}` atual e o hook novo — se mantermos ambos, tem risco de remontar e perder o reveal começado.
  - Quando criar o timer: no momento do fetch inicial bem-sucedido? No momento do UPDATE via Realtime? Cobrir ambos.
  - Snapshot chega com `output_snapshot=null` antes de preenchido (se algum dia inserirmos row em `status='generating'` antes do pipeline terminar) — hoje a row só é inserida depois, mas o hook deve ser robusto a isso.
- Estratégia de testes para cada etapa. Use mocks do Supabase client no estilo dos testes já existentes em `web/src/` (busque por `vi.mock('@/lib/supabase/client')` para referência).
- Ordem que mantém o repo compilando entre passos (ex: migração primeiro, hook depois, integração no builder por último).

Só comece a editar código **depois que eu aprovar o plano**. Se durante a execução descobrir algo que contraria o plano aprovado, pare e reporte antes de desviar.

## Regras para esta sessão

- **Não use git.** Não faça `git add`, `commit`, `push`, nem crie branch. Eu mesmo gerencio commits e PR.
- **Não faça refactor oportunista.** Código feio vizinho ao que você está mudando: deixe como está e registre em "follow-ups sugeridos".
- **Não mexa em nada de `web/src/lib/prescription/*` nem em `web/src/actions/prescription/generate-program.ts`.** O pipeline da LLM é intocável nesta fase. Se alguma coisa te forçar a mudar isso, pare e me avise.
- **Uma migração só.** Só a do Realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE prescription_generations`). Se precisar de outra, pare e me avise.
- **Respeite as invariantes da seção 4 do `00-visao-geral.md`.**

## Premissas do ambiente

- Monorepo Kinevo em `~/kinevo`. App web em `web/`. Use `npm` (não pnpm).
- Supabase remoto: projeto `lylksbtgrihzepbteest`. Tabela `prescription_generations` já existe (migration 035), RLS ativo com policy `trainer_id = current_trainer_id()`.
- Realtime publication é `supabase_realtime`. Hoje `prescription_generations` **não** está nela — você precisa adicionar via migração.
- Testes com vitest. Para fake timers, vitest expõe `vi.useFakeTimers()` / `vi.advanceTimersByTime()`.
- Strings user-facing em pt-BR; código e comentários em inglês.

## Definição de "pronto"

- Todo o checklist da seção 6 do `02-fase-1.5-streaming-parcial.md` marcado.
- `npx tsc --noEmit` verde em `web/`.
- Suite de testes `npm test` verde (218 tests passando hoje — não regredir).
- Walk-through manual descrito na seção 5.3 da spec documentado em `docs/specs/logs/fase-1.5-execucao.md` com passo a passo textual.
- Lista de "follow-ups sugeridos" no mesmo arquivo de log.

Comece produzindo o plano. Aguarde aprovação.
