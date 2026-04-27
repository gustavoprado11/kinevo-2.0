# Prompt para o Claude Code — Prescrição Manual com Repetições e Descanso por Série

> Cole este prompt inteiro numa nova conversa do Claude Code dentro do repositório `kinevo-monorepo`. Ele inicia a Fase 1 (DB + Shared) e instrui o agente a abrir as próximas fases sob demanda.

---

Você é o desenvolvedor responsável por implementar a feature **"Prescrição Manual com Repetições e Descanso por Série"** no Kinevo, que permite ao treinador prescrever pirâmide, drop-set, cluster, top+backoff e séries customizadas livres no builder manual (web + mobile) e no Texto para Treino (Edge Function).

## 0. Antes de qualquer linha de código

**LEIA** os seguintes arquivos na ordem, sem pular:

1. `mobile/specs/active/prescricao-per-set-manual.md` — a spec completa desta feature. Esta é sua fonte da verdade. Releia toda vez que tiver dúvida de escopo ou comportamento.
2. `mobile/CLAUDE.md` — convenções do mobile (NativeWind, Lucide, sem emoji, sentence case, pt-BR).
3. `web/CLAUDE.md` — convenções do web (Tailwind v4, Server Actions, RLS).
4. `supabase/migrations/001_initial_schema.sql` (linhas 109-200) — entender o modelo atual de `workout_item_templates`, `assigned_workout_items`, `set_logs`.
5. `supabase/migrations/110_frequency_once.sql` — confirmar que a próxima migration livre é `111_`. Se outra migration foi adicionada nesse meio tempo, ajustar o número.
6. `mobile/specs/active/unificacao-prescricao-ia-mobile.md` (cabeçalho + seções "Estratégia de execução" e "Notas de Implementação") — modelo de spec multi-fase já entregue. Use como referência de como entregar uma fase por PR.

Quando terminar de ler, diga em **uma frase curta**: "Spec lida — vou começar pela Fase 1 (DB + Shared)." e siga.

## 1. Postura e princípios

- **Mudanças cirúrgicas.** Não reescreva código que já funciona. Adicione campos opcionais, faça INSERT em batch, expanda system prompt — não refatore grandes blocos.
- **Retrocompatibilidade absoluta.** Programas existentes no banco e drafts antigos no MMKV têm que continuar funcionando sem ajuste. Se você ler "se houver linhas em `assigned_workout_item_sets`, hidrate; senão, comportamento atual" — aplique essa regra em todo lugar de leitura.
- **Não toque no motor de IA agentivo** (`web/src/lib/prescription/`). A spec é explícita: motor de IA continua gerando agregados. Apenas o builder manual e o parse-text recebem `set_scheme`. Se você sentir tentação de "também adicionar ao prompt-builder", PARE — não está no escopo.
- **Tipos vêm do shared.** `WorkoutSet`, `SetType`, `MethodKey`, `TrainingMethodPreset` são definidos em `shared/types/prescription.ts`. Web e mobile importam de `@kinevo/shared`. Não duplicar.
- **Sem `any`.** Sempre tipo concreto. Se precisar de `unknown`, justifique.
- **Set types e enums alinhados em três lugares**: TypeScript union, SQL CHECK constraint, e system prompt da Edge Function (Fase 5). Mudar em um e esquecer outro é o erro mais comum nesta feature. Adicione um teste de paridade no shared comparando o array exportado do TS com o que o seed da migration usa (via fixture).
- **Modo avançado é livre desde a primeira série.** Presets são chips opcionais. Editar pós-preset → `method_key='custom'`. Não construa fluxo guiado obrigatório.

## 2. Plano de entrega — 5 fases independentes

| Fase | Foco | Quando ir |
|------|------|----------|
| **Fase 1 — DB + Shared** | Migration `111`, tipos compartilhados, helpers puros, presets de sistema seed. | **Começar agora.** |
| **Fase 2 — Web Builder** | `WorkoutItemCard` ganha "Avançado", `SetSchemeTable` novo, `saveProgram` persiste filhas. | Depois da Fase 1 mergeada. |
| **Fase 3 — Mobile Builder** | `program-builder-store` estendido, `SetSchemeEditor` bottom sheet, save persiste filhas. | Depois da Fase 1, paralelo com Fase 2. |
| **Fase 4 — Sala de Treino + Watch** | `useWorkoutSession` hidrata per-set, `SetRow` com badges, Watch app idem. | Depois da Fase 1, paralelo com 2 e 3. |
| **Fase 5 — Texto para Treino** | Edge Function aprende padrões pirâmide/drop/cluster, bridges propagam `set_scheme`. | Depois das Fases 2 e 3 (precisa de UI pra renderizar). |

Cada fase é um PR independente. Use git branches `feat/per-set-fase-1-shared`, `feat/per-set-fase-2-web`, etc.

## 3. Comece pela Fase 1 — DB + Shared

### Entregáveis desta fase

**Migration:**
- `supabase/migrations/111_per_set_prescription.sql` (ou número subsequente se outra migration foi adicionada).
- Crie nessa ordem dentro da migration:
  1. `CREATE TABLE workout_item_set_templates` — colunas conforme spec, FK pra `workout_item_templates(id) ON DELETE CASCADE`, UNIQUE `(workout_item_template_id, set_number)`, CHECK em `set_type`.
  2. `CREATE TABLE assigned_workout_item_sets` — paralela, FK pra `assigned_workout_items(id) ON DELETE CASCADE`, UNIQUE `(assigned_workout_item_id, set_number)`.
  3. `ALTER TABLE workout_item_templates ADD COLUMN method_key TEXT` (nullable).
  4. `ALTER TABLE assigned_workout_items ADD COLUMN method_key TEXT` (nullable).
  5. `CREATE TABLE training_method_presets` com `trainer_id UUID NULL REFERENCES trainers(id)`, `name TEXT NOT NULL`, `description TEXT`, `key TEXT NOT NULL`, `sets_config JSONB NOT NULL`, `created_at`. UNIQUE `(trainer_id, key)`.
  6. Indices apropriados pelas FKs e por `(workout_item_template_id, set_number)` + `(assigned_workout_item_id, set_number)`.
  7. Triggers `set_updated_at` se houver coluna `updated_at` (siga o padrão da migration 001).
  8. RLS:
     - `workout_item_set_templates`: trainer-only via `workout_item_template_id IN (SELECT ...)` igual ao padrão de `workout_item_templates`. Aluno **não** vê (não é necessário — aluno vê só o assigned).
     - `assigned_workout_item_sets`: paralela a `assigned_workout_items_*` (trainer + student SELECT, trainer ALL).
     - `training_method_presets`: SELECT público pra `trainer_id IS NULL`, CRUD próprio pra `trainer_id = current_trainer_id()`.
  9. Seed dos 6 presets de sistema: `pyramid_down`, `pyramid_up`, `drop_set`, `top_backoff`, `5x5`, `cluster`. JSON `sets_config` espelha exatamente o que `applyPreset(key)` produz no shared. Crie esses JSONs como constantes no SQL com `INSERT INTO training_method_presets (trainer_id, name, key, description, sets_config) VALUES ...`.
- Após migration aplicada localmente: `npm run gen:types` na raiz do monorepo pra atualizar `shared/types/database.ts`. **Commit** o arquivo regenerado.

**Shared:**
- `shared/types/prescription.ts`: adicionar `SetType` (union), `WorkoutSet` (interface), `MethodKey` (union — inclui `'standard'` e `'custom'`), `TrainingMethodPreset` (matching DB row). Exportar `SET_TYPE_OPTIONS` e `METHOD_KEY_OPTIONS` como `readonly` arrays para validação runtime.
- `shared/lib/prescription/set-scheme.ts` (novo, puro):
  - `summarizeSetScheme(scheme: WorkoutSet[]): { sets: number; reps: string; rest_seconds: number }`
  - `expandToSetScheme(sets: number | null, reps: string | null, rest_seconds: number | null, opts?: { setType?: SetType }): WorkoutSet[]`
  - `validateSetScheme(scheme: WorkoutSet[]): { valid: boolean; errors: string[] }`
  - `applyPreset(key: MethodKey, opts?: { sets?: number; baseReps?: number; dropPct?: number }): WorkoutSet[]`
  - `inferMethodKeyFromScheme(scheme: WorkoutSet[]): MethodKey`
- `shared/lib/prescription/set-scheme-presets.ts` (novo, dados puros): exporta `SYSTEM_PRESETS` como objeto `Record<MethodKey, { name: string; description: string; defaultSetsConfig: WorkoutSet[] }>`. **Mesmas configurações que o seed SQL.**
- `shared/lib/prescription/__tests__/set-scheme.test.ts` — Vitest cobrindo todos os cenários listados em "Testes Requeridos → Lógica Pura → Shared" da spec.
- `shared/lib/prescription/__tests__/set-scheme-presets.test.ts` — Vitest verifica que `SYSTEM_PRESETS[key]` bate com `applyPreset(key)` (paridade dado/função).
- `shared/index.ts` — exportar tudo (tipos + funções).

### Critérios pra fechar a Fase 1

- [ ] Migration roda limpa em DB vazio (`supabase db reset`).
- [ ] Migration roda limpa em DB com dados sintéticos (criar 1 program template antigo, aplicar migration, verificar que `workout_item_templates.method_key` ficou null e nada quebrou).
- [ ] `npx supabase gen types typescript --local > shared/types/database.ts` produz tipos com as novas tabelas.
- [ ] `cd shared && npx tsc --noEmit && npx vitest run` verde.
- [ ] Pelo menos 15 testes Vitest passando entre `set-scheme.test.ts` e `set-scheme-presets.test.ts`.
- [ ] Roundtrip: para cada preset em `SYSTEM_PRESETS`, `applyPreset(k) === defaultSetsConfig` e `inferMethodKeyFromScheme(applyPreset(k)) === k`.

### Entregando a Fase 1

Quando os critérios estiverem todos verdes:
1. Faça commit em pequenos passos lógicos (migration, tipos, helpers, testes — separados se possível).
2. Abra PR com título `feat(per-set): Fase 1 — DB e shared` e a descrição apontando pra spec.
3. Atualize `mobile/specs/active/prescricao-per-set-manual.md` na seção "Notas de Implementação" listando os arquivos tocados nesta fase.
4. Aguarde merge antes de começar a próxima fase.

## 4. Quando você terminar a Fase 1, abra a próxima

Depois do merge da Fase 1, escolha a próxima fase **com base na disponibilidade de revisor**:

- Se o revisor é alguém de web → comece **Fase 2 (Web Builder)**.
- Se é alguém de mobile → comece **Fase 3 (Mobile Builder)** ou **Fase 4 (Sala de Treino)**.
- **Fase 5 (Texto para Treino)** só depois das Fases 2 e 3 estarem em produção, porque o builder precisa renderizar o `set_scheme` que vem do parser.

Pra cada fase nova:
1. Releia a seção correspondente da spec.
2. Crie branch `feat/per-set-fase-N-<area>`.
3. Faça os entregáveis.
4. Atualize "Notas de Implementação" da spec.
5. PR + merge.

## 5. Quando algo não estiver claro

A spec é a fonte da verdade. Se ela não cobrir um caso, **NÃO INVENTE** — escolha a opção mais conservadora (que mantém retrocompat) e adicione uma nota em "Notas de Implementação" explicando a decisão. Isso vira input pra revisão posterior.

Em particular, se você se ver questionando "será que devo também atualizar X?", releia "Excluído" da spec. Provavelmente está fora.

## 6. Ao final de cada PR

Atualize o checklist da fase em "Critérios de Aceite" da spec marcando os itens como `[x]`.

Ao final da última fase (Fase 5), mude o status no topo da spec de `[x] Rascunho` para `[x] Concluída` e mova o arquivo para `mobile/specs/completed/`.

---

**Comece agora.** Confirme em uma frase curta que leu a spec e parta para a Fase 1.
