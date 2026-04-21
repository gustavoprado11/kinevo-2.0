# Prompt para o Claude Code — Fase 2.5

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia e siga as seguintes specs, nesta ordem:

1. `docs/specs/00-visao-geral.md` — decisões, invariantes e glossário. **Ler inteiro antes de qualquer coisa.**
2. `docs/specs/06-fase-2.5-prescricao-inteligente.md` — a fase que você vai executar nesta sessão. **É a spec principal.** Contém regras de domínio (§4) vindas do Gustavo (profissional de educação física). Trate essas regras como **verdade**, não sugestão.
3. `docs/specs/logs/fase-1-execucao.md` e `docs/specs/logs/fase-1.5-execucao.md` — logs das fases anteriores (se existirem). Ajudam a entender o estado atual do código.

Você **não** vai executar as Fases 2, 3 ou 4. Apenas Fase 2.5.

## Contexto adicional crítico

**Esta fase é diferente das anteriores.** As Fases 1 e 1.5 eram sobre UX do painel e não podiam tocar `lib/prescription/*`. **A Fase 2.5 existe justamente para mudar o núcleo do pipeline de geração** — especificamente `llm-client.ts`, `claude-agent.ts` (que na verdade usa GPT, apesar do nome), `ai-optimizer.ts`, `context-enricher.ts`, `prompt-builder.ts`, `program-cache.ts`, `schemas.ts`, e introduzir novos arquivos `rules-validator.ts`, `telemetry.ts`, `prompt-examples.ts`. A invariante #3 do `00-visao-geral.md` ("preservar comportamento funcional do /prescribe atual") continua valendo — mas agora a interpretação correta é **"o fluxo continua gerando programas ponta a ponta, com a mesma API do builder"**, não "o código interno fica intocado".

A tabela `prescription_generations` já existe (migration 035). RLS ativo com policy `trainer_id = current_trainer_id()`. A publication Realtime já tem esta tabela (migration 103, da Fase 1.5).

O modelo GPT em produção hoje é `gpt-4.1-mini` (hardcoded em vários lugares — ver §5.2 da spec). Preços unitários estão duplicados entre arquivos; consolidar numa tabela central como parte desta fase.

**Sobre as regras de domínio (§4 da spec):** elas foram coletadas diretamente do Gustavo (fundador do Kinevo, profissional de ed. física) em 18/abr/2026. Se você encontrar código existente que contradiz alguma regra do §4, a regra **vence**. Isso pode implicar descontinuar lógica em `slot-templates.ts` ou `constraints-engine.ts`. Mas atenção: a spec explicitamente diz que **não vamos reescrever o slot-builder nesta fase** — a estratégia é adicionar um `rules-validator.ts` pós-geração que **corrige violações** em vez de deixá-las passar. Se o slot-builder produzir uma violação, o validador corrige e registra em `rules_violations_json`. É isso que fecha o gap sem refactor pesado.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. O plano deve ter:

- Lista ordenada dos passos que você fará, cada um com os arquivos que vai tocar e critério de pronto.
- Pontos onde você prevê risco ou ambiguidade. Minha lista inicial (pode expandir):
  - **Ordem de migração.** A migration de telemetria (§5.1) adiciona colunas `NULLABLE` — deve ser seguro, mas vale confirmar se `prescription_generations` tem constraints ou índices que compliquem.
  - **Consolidação OpenAI em `llm-client.ts`.** Há três pontos de chamada direta hoje (`claude-agent.ts`, `ai-optimizer.ts`, `generate-program.ts`). Consolidar sem quebrar o comportamento observável exige cuidado — especialmente com response format, parsing e timeouts. Considere migrar um ponto por vez com testes antes de prosseguir.
  - **Structured Outputs.** Mudar de `response_format: json_object` para `json_schema: { strict: true }` pode expor bugs latentes do schema. O schema v2 em `schemas.ts` (`GENERATION_JSON_SCHEMA`) precisa ser auditado para `additionalProperties: false` em **todo nível**. Saídas da API agora falham se vierem com campo extra — isso é o comportamento desejado, mas o parser fuzzy atual mascarava esses casos.
  - **Prompt em 3 camadas.** A ordem das camadas é crítica (§5.4) — OpenAI só cacheia a partir de um início estável. Qualquer caractere dinâmico antes da camada 2 invalida tudo. Assegure que a camada 1 é 100% estável e que camada 2 é determinística dado `trainer_id`.
  - **Context enricher.** §5.5 pede histórico de performance real (exercícios estagnados, aderência, observações). As tabelas-fonte (`workout_sessions`, `workout_item_executions`, observações do trainer, etc.) precisam ser investigadas — confirme quais queries são necessárias antes de escrever o código. Se alguma tabela não tiver os dados esperados, pare e reporte.
  - **`rules-validator.ts`.** Precisa aplicar §4.1-4.8 fielmente. A regra mais sutil é §4.3 ("no máximo 1 exercício com 4 séries por grupo muscular por treino") — implemente com teste cobrindo os exemplos dados (Push, Upper, Legs, Pull). A regra §4.2 trata panturrilha separado dos outros grupos pequenos — não esquecer.
  - **Cache fix.** Mudança de TTL e de chave pode reduzir hit rate drasticamente. Isso é esperado (era o cache errado). Mas garanta que a nova chave não vaze PII em logs.
  - **Feature flag `prescription.smart_v2_enabled`.** Decidir se vai no `trainer_profile` ou numa tabela separada de feature flags. Se já existir infraestrutura de flags no projeto, use — se não, proponha o mecanismo mais simples (ex: coluna booleana no `trainer_profile`).
- Estratégia de testes para cada etapa. A spec já lista ~15 testes (§6) — materialize-os em arquivos concretos no plano.
- Ordem que mantém o repo compilando entre passos (ex: migration primeiro; tipos gerados; `llm-client.ts` com Structured Outputs e retry; `telemetry.ts`; `rules-validator.ts` com testes isolados; integração em `generate-program.ts` por último, atrás da feature flag).

Só comece a editar código **depois que eu aprovar o plano**. Se durante a execução descobrir algo que contraria o plano aprovado, pare e reporte antes de desviar.

## Regras para esta sessão

- **Não use git.** Não faça `git add`, `commit`, `push`, nem crie branch. Eu mesmo gerencio commits e PR.
- **Não faça refactor oportunista.** Código feio vizinho ao que você está mudando: deixe como está e registre em "follow-ups sugeridos".
- **Não renomeie `claude-agent.ts` nem arquivos correlatos.** O arquivo usa GPT; sei disso; a renomeação está listada como follow-up explícito (§10 da spec). Manter o nome reduz blast radius desta fase.
- **Não mexa em UX do painel** (`components/programs/ai-prescription-panel/*` e `components/prescription/*`). A UX é intocável nesta fase.
- **Não adicione dependências novas** sem consultar. Se precisar de uma lib (ex: hash SHA-1), use o que já existe no projeto ou Node nativo (`crypto`).
- **Feature flag default off.** Nada desta fase deve mudar comportamento para trainers que não tenham `prescription.smart_v2_enabled = true`. A única exceção é a migration de telemetria, que adiciona colunas NULLABLE.
- **Regras de domínio §4 são verdade.** Se código existente contradiz, registre em "follow-ups sugeridos"; não tente reescrever o código existente como parte desta fase — apenas garanta que o `rules-validator.ts` corrige a saída final.
- **Respeite as invariantes da seção 4 do `00-visao-geral.md`**, com a nota de que invariante #2 (`nada de refactor while we're at it`) se aplica a áreas fora do escopo explícito da Fase 2.5.

## Premissas do ambiente

- Monorepo Kinevo em `~/kinevo`. App web em `web/`. Use `npm` (não pnpm).
- Supabase remoto: projeto `lylksbtgrihzepbteest`. Tabela `prescription_generations` já existe (migration 035) com RLS ativo.
- Migrations atuais vão até 103. Esta fase adiciona a 104 (`104_prescription_generations_telemetry.sql`).
- Testes com vitest. Para fake timers, `vi.useFakeTimers()` / `vi.advanceTimersByTime()`.
- Para mocks do Supabase client, siga o estilo existente (busque `vi.mock('@/lib/supabase/client')`).
- Strings user-facing em pt-BR; código, comentários e logs em inglês.
- Preços OpenAI de referência (USD por 1M tokens) — consolidar numa tabela central em `llm-client.ts`:
  - `gpt-4.1-mini`: input $0.40 / output $1.60 / cached input $0.20 (50% off)
  - `gpt-4o-mini`: input $0.15 / output $0.60 / cached input $0.075
- Modelo primário: `gpt-4.1-mini`. Fallback após 3 tentativas falhas: `gpt-4o-mini` (1 tentativa). Se falhar também: propagar erro, caller decide heurístico.

## Definição de "pronto"

- Todo o §8 (Critérios de aceite) da spec está atendido.
- `npx tsc --noEmit` verde em `web/`.
- Suite de testes `npm test` verde. Tests novos da Fase 2.5 todos passando; tests pré-existentes não regridem.
- Walk-through manual da §6.3 da spec documentado em `docs/specs/logs/fase-2.5-execucao.md`, com:
  - Passo a passo textual do que você rodou para validar.
  - Output de pelo menos 3 gerações de teste (pode ser com perfis fictícios criados por você), com verificação item-a-item do checklist §6.3.
  - Exemplos de queries SQL ad hoc para auditar custo e violações de regras na tabela `prescription_generations` (§5.9 da spec menciona que o dashboard fica fora de escopo, mas queries bem documentadas suprem a necessidade de validação).
  - Lista de "follow-ups sugeridos" com coisas que você notou mas não quis/pôde endereçar na fase.

Comece produzindo o plano. Aguarde aprovação.
