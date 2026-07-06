# Análise do Builder de Treinos — Web + Mobile (06/jul/2026)

Auditoria de corretude dos construtores de programa (criação e edição) no web e no mobile,
mais a camada de dados (RPC `save_assigned_program_tree`, migrations, FKs, RLS).
Método: 3 varreduras paralelas de código + verificação manual dos achados críticos + suíte de testes.

**Estado geral**: typecheck limpo (web e mobile); mobile 347/347 testes; web 1374 passando
(5 falhas pré-existentes em `student-cap.test.ts`, sem relação com o builder — mock desatualizado
da feature Estúdios, quebrado desde `ed98c7b`).

---

## CRÍTICOS — perda irreversível de dados do aluno

### C1. Deletar exercício/treino num programa ativo apaga o histórico de execução do aluno
- `supabase/migrations/001:242` — `set_logs.assigned_workout_item_id` é `NOT NULL ... ON DELETE CASCADE`
- `supabase/migrations/001:212` — `workout_sessions.assigned_workout_id` é `NOT NULL ... ON DELETE CASCADE`
- O RPC `save_assigned_program_tree` (215:79-81, 131-133) deleta workouts/itens que saíram do payload.

Cenário: treinador troca "Supino" por outro exercício num programa ativo → todas as séries já
logadas de Supino somem (histórico, tonelagem, insights encolhem em silêncio). Remove o "Treino C"
→ as sessões executadas inteiras do Treino C são apagadas. O mesmo vale para os deletes client-side
do mobile (`useProgramBuilder.ts`).

Correção exige decisão de produto: trocar as duas FKs de execução para `ON DELETE SET NULL`
(com snapshot para exibição) ou soft-delete de itens.

### C2. Mobile: remover o card do superset apaga os exercícios filhos silenciosamente
Mesma classe do bug que o web corrigiu na migration 215.
- `mobile/stores/program-builder-store.ts:1347` — `removeItem` não remove nem reparenta filhos.
- `mobile/hooks/useProgramBuilder.ts:466-478` — o delete do pai dispara o CASCADE de `parent_item_id`
  e arrasta os filhos no banco, mesmo eles estando vivos no draft; `:576-577` pula o re-insert deles.

Cenário: trainer edita no mobile um programa com superset, swipa "Remover" no bloco, salva →
toast de sucesso, filhos ainda visíveis no builder, mas sumiram do programa do aluno.
Agravante: o loader mobile embaralha supersets (C6 abaixo), induzindo exatamente essa ação.

### C3. Mobile: cardio e warmup usam schema de `item_config` incompatível — destroem a config do web
- `EditCardioSheet.tsx:91-97` grava `{mode:'continuous', modality, objective, target, notes}`;
  o schema canônico (`shared/types/workout-items.ts:83-94`) e todos os leitores (CardioCard do aluno,
  web builder, sala de treino) usam `equipment/duration_minutes/distance_km/intensity/intervals`.
- `index.tsx:839-850` faz **replace** do `item_config` inteiro (o web faz merge).
- `index.tsx:803-809` — warmup: grava `{warmup_type:"free", description}` fixo por cima do que existia.

Cenários: (a) cardio prescrito no mobile chega ao aluno sem alvo/equipamento; (b) editar no mobile
um cardio intervalado criado no web destrói `intervals/equipment/duration/intensity`; o card mobile
ainda mostra "Cardio livre" para cardio web, convidando a "reconfigurar" e cimentar a perda.

---

## ALTOS — prescrição errada chega ao aluno

### A1. Web: set_scheme órfão ao agrupar exercício em superset → aluno executa "prescrição fantasma"
- RPC 215: o `DELETE FROM assigned_workout_item_sets` só roda no loop de itens raiz; o branch de
  filhos (215:190-229) nunca limpa as linhas antigas. Payload de filho não envia `set_rows`
  (`edit-assigned-program-client.tsx:491-505`).
- O app do aluno hidrata com precedência absoluta das linhas (`shared/lib/hydrate-workout-sets.ts:42`).

Cenário: exercício raiz com pirâmide salva → agrupado em superset → salvo. As linhas antigas ficam
penduradas; o aluno executa as cargas ANTIGAS e nenhuma edição futura de sets/reps/descanso do filho
chega ao app. O builder re-hidrata o scheme fantasma no reload, perpetuando o ciclo.

### A2. Web: edições na tabela de séries de filho de superset são descartadas em silêncio
`ExerciseAdvancedSection.tsx:19-30` renderiza a tabela editável para filhos, mas nenhum dos dois
saves persiste set_scheme de filho (edição: sem `set_rows`; criação: `program-builder-client.tsx:873-894`).
O treinador vê 5 fases na tela; o aluno recebe 3×10.

### A3. Mobile: fluxos de modelo (template) não conseguem editar séries/reps/descanso nem trocar exercício
`mobile/app/program-builder/index.tsx:861` — `QuickEditSheet`, `SetSchemeEditor` e o picker de troca
só renderizam dentro de `{params.studentId && (...)}`. Rotas de template não passam studentId →
os menus setam estado mas nenhum sheet abre. Todo exercício de template fica travado em 3×10/60s.

### A4. Mobile: superset importado por texto prescreve descanso 0s — e é inconsertável no app
- `program-builder-store.ts:657,782` — filhos de parsed-text nascem com `rest_seconds: 0`
  (convenção antiga; desde b504cd7/3f7e44c a execução usa o rest POR FILHO e ignora o pai).
- Filhos de superset não têm nenhuma edição no mobile (tap bloqueado, "Editar" disabled, sem swipe).
- O QuickEdit no card do pai edita `parent.rest_seconds`, que não tem efeito na execução.

Cenário: importar "superset, descanso 90s" por texto → aluno executa sem NENHUM timer de descanso.

### A5. Web: "Salvar Modelo" no editor de programa atribuído perde a prescrição avançada
`edit-assigned-program-client.tsx:604-645` — omite `method_key`, `rounds`, `exercise_function` e não
grava `workout_item_set_templates`; usa `item.sets` cru. Drop-set/pirâmide viram agregados simples.
(O fluxo equivalente no builder de criação está correto.)

### A6. Mobile: save de edição não-transacional + loader embaralha supersets
- `useProgramBuilder.ts:355-624` — deletes commitam antes dos upserts; queda de rede no meio deixa
  o programa ativo mutilado, e retry duplica treinos novos (não entram em `originalWorkoutIds`).
  O web resolveu isso com o RPC transacional; o mobile mantém a lógica antiga (comentário na linha 344).
- `program-builder-store.ts:443-445, 497-499` — sort plano por `order_index`, mas filhos usam
  order_index por-pai (0..n) → empatam com raízes e renderizam no topo, descolados do pai.

---

## MÉDIOS

### M1. `expires_at` nunca recalculado ao editar programa ativo
RPC atualiza `duration_weeks`/`started_at` mas não `expires_at`; o cron `expire-programs` expira
pelo valor velho. Estender 4→8 semanas não adia a expiração. Corolário: editar programa `expired`
força `status='active'` com `expires_at` velho → o cron re-expira em seguida.

### M2. Desmarcar os dois check-ins (form triggers) nunca persiste
`edit-assigned-program-client.tsx:518` / `program-builder-client.tsx:899` — a action só é chamada
quando pré OU pós está ligado; remover ambos não chama o delete. Sub-achado: no editor de atribuído,
triggers só salvam se `sourceTemplateId` existir — em programas sem template de origem a UI aparece
mas o save ignora.

### M3. Save da edição web apaga snapshot de exercício arquivado
`edit-assigned-program-client.tsx:487-489` escreve `item.exercise?.name ?? null`; a biblioteca exclui
arquivados → save grava NULL por cima do snapshot usado por histórico/insights. Adicional:
`muscleGroupOf` grava só o 1º grupo muscular (degrada o `string_agg` da migration 184).

### M4. Gate de assinatura assimétrico (migration 177)
Policies restritivas barram inserts diretos do builder de criação, mas não o RPC de edição
(SECURITY DEFINER bypassa RLS e só checa `current_trainer_id()`). Treinador sem subscription
edita programa atribuído mas não cria template; e UPDATE/DELETE barrado por RLS falha silenciosamente.

### M5. Builder de criação web: N+1 sem transação + edição de template destrutiva
- `program-builder-client.tsx:813-895` — inserts em cascata sem transação; falha no meio deixa
  template parcial na biblioteca.
- `:800-804` — editar template = delete-all + re-insert com o **erro do delete descartado**
  (se falhar, duplica treinos). Cada save troca todos os IDs → `source_template_id` dos programas
  já atribuídos vira NULL (SET NULL).
- A atribuição em si é atômica (RPC `assign_program_from_template`, migration 184) — OK.

### M6. Resíduos de risco na camada de dados
- FK `parent_item_id ON DELETE CASCADE` segue no schema — a 215 contornou só dentro do RPC;
  qualquer outro caminho que delete um pai de superset diretamente (tool MCP
  `kinevo_delete_workout_item`, deletes do mobile) arrasta filhos.
- Contrato "omitiu = apaga" no RPC: `description/started_at/scheduled_start_date/duration_weeks`
  são setados incondicionalmente — caller futuro que omita a chave anula a coluna.
- Mover item entre treinos (se a UI um dia permitir) aborta o save com erro críptico.
- `exercise_id` não é validado por tenant no RPC (aponta para exercício custom de outro treinador).
- Item novo criado no editor fica com `exercise_function=NULL` (RPC não escreve a coluna).

---

## MENORES / UX

- Web: dia "ocupado" no DaySelector parece desabilitado mas é clicável (`workout-panel.tsx:71-90`) —
  dois treinos no mesmo dia.
- Web: contador de séries/volume usa `item.sets` cru — stale em modo avançado até salvar+recarregar.
- Web: `router.push()`+`router.refresh()` no builder de criação (`:945-952`) — mesmo padrão de race
  RSC removido do editor de atribuído (SUSPEITO de "unexpected response" ao salvar).
- Web: editar programa `completed` via URL direta ressuscita/estoura índice único (SUSPEITO, UI não linka).
- Web: `started_at` reescrito para meia-noite UTC a cada save (borda de semana em GMT-3).
- Mobile: gesto de voltar (swipe iOS / back Android) ignora o guard de alterações não salvas (SUSPEITO).
- Mobile: "Trocar exercício" morto em tablet (`!isTablet` também no picker de swap, `index.tsx:928`).
- Mobile: importar texto com todos os treinos vazios em modo edição "desliga" o modo edição
  (`store.ts:843-888`) e o save cria programa novo em vez de editar (SUSPEITO, caminho estreito).
- Mobile: escolher data ao editar rascunho ativa o programa (web preserva draft) — pode abortar
  no índice único se já houver ativo.
- Código morto web: prop `omitRest` sem callers, comentário afirma comportamento antigo.

---

## O que foi verificado e ESTÁ correto

- RPC `save_assigned_program_tree`: transacional de verdade, ownership OK (trainer + cadeia por nível),
  upsert-by-id preservando ids, fix da 215 (unparent antes do delete) correto para desagrupar/dissolver/
  mesclar supersets. Assinatura única — sem ambiguidade de overload no PostgREST.
- Round-trip completo de raízes: set_scheme/method_key/rounds (expansão por rounds e colapso),
  cardio/warmup/nota via item_config (no web), substitutos, snapshots.
- `scheduled_days`: convenção 0=domingo…6=sábado consistente em web, mobile e MCP, nos dois sentidos.
- Descanso por exercício no superset (web): filhos editam o próprio rest, 0 preservado, pai deriva do último filho.
- Dirty tracking web: autosave debounced + flush em unmount/beforeunload + confirm ao sair + clearDraft só no sucesso.
- Duplicação de treino/item: IDs novos, sem referências compartilhadas.
- Double-submit protegido nos dois builders.
- RLS: policies órfãs do Estúdios dropadas (225) inclusive `program_templates_org_write`;
  RPC com REVOKE anon (224). `shared/types/database.ts` íntegro e em sincronia (falta só o overload
  1-arg de `create_program_template_tree`; `as any` no builder são staleness, não desync).
- Idempotência A8 no criar+atribuir mobile; M11 preserva `started_at`.

## Cobertura de teste

Os testes existentes do builder mobile cobrem só set-scheme editor, volume e occupied days —
**nada de load/save do store**. No web, `builder-model.test.ts` (36 testes) cobre o modelo puro.
Nenhum dos achados acima está protegido por teste de regressão.

## Ordem sugerida de ataque

1. **C1** (decisão de produto + migration nas 2 FKs de execução) — perda de histórico em fluxo normal.
2. **C2 + A6-loader** (mobile superset) — um fix no `removeItem`/save + sort hierárquico no loader.
3. **C3** (cardio/warmup mobile) — alinhar sheets ao schema canônico + merge em vez de replace.
4. **A1/A2** (set_scheme de filho) — decidir: ou o RPC limpa rows de filho (e a UI esconde a tabela),
   ou passa a persistir `set_rows` de filho de ponta a ponta.
5. **A3/A4** (template mobile ineditável + rest 0s) — destravar sheets fora do studentId; default 60s.
6. **A5, M1, M2** — fixes locais e pequenos.
