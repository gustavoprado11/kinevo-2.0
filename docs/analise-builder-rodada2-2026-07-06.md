# Análise do Builder de Treinos — Rodada 2 (06/jul/2026, pós-fixes)

Segunda auditoria do prescritor de treinos (web + mobile + camada de dados + tools MCP),
rodada sobre o commit `d8df4f8` (fixes da rodada 1 já pushados; migrations 227/228/229 em prod).
Método: 5 varreduras paralelas com focos distintos (regressão dos fixes de hoje; blast-radius
da migration 227 nos leitores; mobile fresh-eyes; web fresh-eyes; camada de dados + MCP),
seguidas de verificação manual dos achados críticos. Achados da rodada 1 (relatório
`analise-builder-2026-07-06.md`) foram excluídos; só entram problemas NOVOS ou nuances novas
de itens conhecidos.

**Estado geral**: tsc limpo (web e mobile); mobile 370/370; web 1376 passando (mesmas 5 falhas
pré-existentes de `student-cap.test.ts`, sem relação com o builder).

**Padrões dominantes desta rodada**:
1. **Regressões dos próprios fixes de hoje** — a 229 e o fix M2 colocaram efeitos destrutivos
   atrás de ações banais (R1, R2, R3).
2. **Tools MCP congeladas em convenções antigas** — não compartilham os núcleos que o web ganhou
   depois delas (atribuição 184, ativação, rest por filho, invariante filho-sem-scheme da 228).
3. **Leitores parcialmente adaptados à 227** — o núcleo (tonelagem, PDF, insights, RLS) foi
   adaptado, mas feeds diários e histórico mobile ficaram com INNER JOINs.

---

> **STATUS DOS FIXES (06/jul, mesma noite)**: R1 e R2 CORRIGIDOS.
> - **R1**: `normalizeDurationWeeks` no `builder-model` (usado nos payloads do editor de
>   atribuído, builder de criação ×3 e "Salvar Modelo") + **migration 230 APLICADA EM PROD**
>   (RPC normaliza 0→NULL e só calcula expires_at com duração > 0; normalização one-time
>   limpou 3 assigned_programs e 1 template com duração 0). Provado por teste SQL transacional
>   com rollback: duração '0' → dw=NULL/exp=NULL; duração '8' → exp = started + 8 semanas.
>   Checagem de dano: NENHUM programa foi expirado indevidamente na janela pós-deploy da 229
>   (0 ativos com expires_at no passado).
> - **R2**: `deriveAssignmentType(program.status)` substitui a derivação por
>   `scheduled_start_date`. Checagem: 0 programas regredidos em prod; 2 ativos seguem expostos
>   até o deploy do código web (fix é client-side).
> - **R3**: MITIGADO via dirty-flag nos DOIS builders — `saveProgramFormTriggers` só é chamada
>   se o usuário mexeu nos check-ins nesta sessão (interação no componente, ou rascunho
>   restaurado com triggers ≠ servidor). Fecha os dois vetores acidentais (falha de load SSR
>   → save comum apagava triggers do template; edições não relacionadas propagando). Bônus:
>   falha do save de triggers agora mostra toast de erro nos dois builders (parte do R26) e o
>   painel de check-in do editor de atribuído ganhou hint explicando que os triggers são do
>   modelo compartilhado. A decisão de produto (trigger por aluno vs por template) segue
>   ABERTA — desmarcar intencionalmente ainda afeta todos os alunos do template, agora de
>   forma transparente.
> - **R4–R8 (+R17) CORRIGIDOS** (bloco MCP, sem migration — a 184 já aceitava p_trainer_id e
>   whitelist de service_role):
>   · R4: `kinevo_assign_program` agora usa `assign_program_from_template` (184) — PROVADO por
>     SQL transacional com rollback em prod (template real: expires=started+5w, 2 treinos com
>     scheduled_days da frequency, 4 set rows + method copiados, vigente COMPLETED). start_date
>     futura agora AGENDA (scheduled) em vez de ativar; notificação/push ao aluno em paridade
>     com o web (fire-and-forget fora da RPC).
>   · R8: `activate_draft` roteado para o núcleo `activateAssignedProgram` (valida agenda,
>     completa vigente sem estourar índice único, seta expires_at, push); erros mapeados com
>     mensagens acionáveis; data futura agenda o rascunho.
>   · R5: `validateRoundsForMethod` (isCompoundMethod do shared) rejeita rounds>1 com método
>     não-composto em add/update/trees, com mensagem ensinando a expandir o scheme; instruções
>     do servidor MCP corrigidas (não incentivam mais rounds p/ pirâmide).
>   · R6: `kinevo_update_workout_item` ganhou guards — filho de superset não aceita
>     set_scheme/method/rounds (regra V1); item não-exercise (container/cardio/warmup/nota)
>     não aceita prescrição de séries nem swap.
>   · R7: convenção de rest por-filho em TODAS as superfícies MCP — create_superset e os dois
>     trees gravam intermediários 0 + último filho com o rest da rodada + pai espelho; zod
>     aceita rest por filho; update re-deriva o espelho (último filho→pai e pai→último filho).
>   · R17 (bônus, mesma função): swap de exercício agora com escopo de tenant (filtro owner).
> - **R1-R8+R17 PUSHADOS em prod 06/jul** (commits 0b08d74 + 00c09a5 + d076c67, deploy Vercel
>   READY em www.kinevoapp.com; guards R5/R6 PROVADOS ao vivo via tools MCP em prod — chamadas
>   rejeitadas com as mensagens novas, zero writes).
> - **R9-R11 CORRIGIDOS (mobile, working tree)**:
>   · R9: fluxo de revisão da IA bloqueia prescrição avançada em vez de descartá-la em
>     silêncio — gate na ABERTURA do editor de séries (Alert explicativo) + cinto-e-suspensório
>     no save (ADVANCED_SCHEME_BLOCKED, espelho do bloqueio de superset) com auto-fix "Remover
>     métodos" (novo clearAllAdvancedSchemes no store, re-deriva agregados) e "Salvar como
>     programa novo" (caminho legado PERSISTE schemes; descarta o vínculo da geração). Suporte
>     pleno a scheme no snapshot fica como feature (tipo shared + RPC assign_program_from_snapshot).
>   · R10: menu "…" → "Editar" em item avançado roteia para o editor de séries (mesmo
>     roteamento do tap no card) — antes o QuickEdit gravava agregados que o save descartava.
>   · R11: ExercisePickerModal + AddBlockSheet + EditNote/Warmup/Cardio sem gate !isTablet —
>     no iPad eram botões mortos (mesmo fix do swap picker da rodada 1).
> - **R12 CORRIGIDO**: nova RPC transacional `duplicate_program_template` (migration 231,
>   APLICADA EM PROD) — copia método/rounds/séries por fase/filhos (normalizados V1)/check-ins;
>   action web reescrita para 1 chamada. PROVADO 2x por SQL transacional com rollback (template
>   real 2w/14 itens/4 rows/1 método idêntico; template com 17 filhos → 0 órfãos, 0 filho com
>   método).
> - **R13 CORRIGIDO**: os 3 feeds diários não somem mais sessões de treino deletado —
>   get-daily-activity.ts e get-dashboard-data.ts trocam !inner por embed LEFT + fallback
>   `workout_name`; RPC get_trainer_daily_activity redefinida com LEFT JOIN + COALESCE
>   (migration 232, APLICADA EM PROD e provada com sessão órfã sintética em rollback).
> - **R14 CORRIGIDO**: histórico expandido do aluno (useWorkoutHistory) anexa pseudo-itens
>   com as séries órfãs (agrupadas por exercício executado) — não somem mais da lista.
> - **R15 CORRIGIDO**: fila de FINISH do Watch não envenena mais — treino deletado (PGRST116)
>   completa a sessão via sessionId canônico (ou dropa permanente se build antiga, em vez de
>   retry infinito); FK 23503 no batch de set_logs filtra as séries do item morto e regrava o
>   resto (preserva o máximo do treino).
> - **MÉDIOS CORRIGIDOS (06/jul, madrugada)**:
>   · R16: migration 233 EM PROD — trigger fill_set_log_snapshot prefere o exercício EXECUTADO
>     (swap não mostra mais o exercício errado no histórico) + re-backfill cirúrgico dos rows
>     com swap real. Provada por INSERT com swap em rollback (snapshot = nome do executado).
>   · R18: migration 234 EM PROD — create_assigned_program_tree persiste exercise_function
>     (duplicar via MCP não zera mais warmup/main). Provada em rollback.
>   · R25 (+resíduo M6 r1): migration 235 EM PROD — save_assigned_program_tree persiste
>     exercise_function com contrato de PRESENÇA DE CHAVE (ausente preserva, null limpa —
>     desarma "omitiu=apaga" p/ esta coluna); provada (grava/preserva). Client: page seleciona,
>     hidratação mapeia (raiz+filho), payload envia — edição da função persiste e "Salvar
>     Modelo" para de gravar NULL.
>   · **R2-MOBILE (achado novo durante o fix)**: o loader mobile tinha o MESMO bug do R2
>     (assignment_type derivado de scheduled_start_date) — corrigido p/ derivar do status.
>   · R21: save mobile de edição recalcula expires_at (convenção 229/230: started+semanas,
>     ≤0/sem started = NULL) e normaliza duração 0→NULL (paridade R1).
>   · R22/R23: novo helper puro normalizeSupersetsAfterChange (dissolve superset degenerado
>     com herança de rest + pai espelha o último filho) aplicado em removeItem e reorderItems
>     — remover/reordenar filho não deixa mais rodada com 0s silencioso; 4 testes novos.
>   · R26: já havia sido fechado junto com o R3 (toast de erro nos dois builders).
>   · R27: UI de check-in oculta em programa sem source_template_id (save era no-op).
>   · R28: modelo mobile nasce is_template=false e o flag só vira true com a árvore completa
>     — falha parcial não deixa mais template truncado visível na biblioteca.
>   · R29: isSaving cobre o invoke da Edge Function no create+assign legado (double-tap
>     não dispara mais assign concorrente).
>   · R30: QuickEdit no container de superset aplica só o descanso e espelha no último filho
>     (fim do reps='0' e das edições no-op); Edição avançada/Trocar exercício bloqueados no
>     container com explicação.
>   · R31: builder de criação não auto-restaura rascunho por cima de programa semeado por
>     geração de IA (deep-link/refresh) — servidor vence; aprovação de geração não pode mais
>     carregar conteúdo divergente.
>   · R32: tools MCP gravam exercise_muscle_group no add/create_superset e ATUALIZAM no swap
>     (analytics de volume por músculo não degrada mais).
> - **DEFERIDOS (design/produto)**: R19 (lost-update multi-superfície — exige versionamento/
>   etag no RPC e nas superfícies), R20 (semântica de editar programa expirado — produto),
>   R24 (fix real = portar o save mobile para o RPC transacional — projeto próprio).
> - Web R12/R13/R16-R32 + mobile R9-R11/R14-R15/R21-R23/R28-R30 no working tree (sem commit);
>   testes: builder-model 41/41, item-helpers +4 (mobile 374/374).

## CRÍTICOS

### R1. REGRESSÃO DA 229: salvar programa ativo com duração vazia/0 → cron mata o programa na madrugada ⚠️ verificado manualmente — **CORRIGIDO (migration 230 + client)**
- `edit-assigned-program-client.tsx:162` — `initialWeeks: program.duration_weeks?.toString() || '0'`
  (programa com `duration_weeks NULL` hidrata como `'0'`).
- `:453` — `duration_weeks: durationWeeks ? parseInt(durationWeeks) : null` — a string `'0'` é
  truthy → envia `0`, não `null`.
- `migrations/229:65-71` — `nullif('0','')` NÃO é NULL → `expires_at = started_at + 0 semanas
  = started_at` (passado).
- `api/cron/expire-programs/route.ts:26-27` — pega `active AND expires_at < now()`.

Cenário: **qualquer save** (até corrigir um typo no nome) de um programa ativo sem duração
definida grava `expires_at` no passado E muta `duration_weeks` NULL→0 → o cron expira o programa
do aluno na madrugada seguinte e notifica os dois. Também alcançável digitando 0 em semanas ou
fixando data-fim a ≤2 dias do início (`use-program-schedule.ts` arredonda para `'0'`).
Antes da 229, `expires_at` não era tocado — **regressão introduzida hoje**.
Corolário pré-existente da mesma família: template "0 semanas" atribuído via RPC 184 nasce
expirável no mesmo dia (`184:93-97`).

Fix sugerido: normalizar `'0'`→`null` no payload (e no hook), e na 229 tratar `0` como NULL
(`nullif(...)::int` + `CASE WHEN ... > 0`).

### R2. Programa agendado→ativado volta a `scheduled` ao salvar qualquer edição ⚠️ verificado manualmente — **CORRIGIDO (client)**
- `edit-assigned-program-client.tsx:148` — `assignmentType = program.scheduled_start_date ?
  'scheduled' : 'immediate'` (deriva SÓ da presença da data, ignora `status`).
- Nem `activate-assigned-program.ts`, nem a RPC 196, nem o cron `activate-scheduled-programs`
  limpam `scheduled_start_date` ao ativar (verificado: zero ocorrências).
- `:459-464` — payload de não-draft com `assignmentType='scheduled'` regrava
  `status='scheduled'`, `started_at=NULL` (e 229 → `expires_at=NULL`).

Cenário: atribuição agendada → cron ativa → semanas depois o treinador edita qualquer coisa →
o programa **some do app do aluno** até o cron do dia seguinte reativá-lo; a reativação regrava
`started_at=now()`, **resetando a contagem de semanas e a expiração**.
Fix: derivar `assignmentType` do `status` atual (ou limpar `scheduled_start_date` na ativação).

### R3. Check-ins gravam no TEMPLATE compartilhado — desmarcar no aluno X apaga dos alunos B e C ⚠️ verificado manualmente — **MITIGADO (dirty-flag; decisão de produto aberta)**
- `program_form_triggers` é keyed por template: `UNIQUE(program_template_id, trigger_type)`
  (`migrations/078:22,31`); resolução em runtime é via `source_template_id`.
- `edit-assigned-program-client.tsx:519-526` — o editor do programa ATRIBUÍDO apresenta
  check-ins como configuração daquele aluno mas grava/deleta no template.
- O fix M2 de hoje (remover o gate `pre || post`) tornou o caminho de DELETE efetivo: desmarcar
  ambos os check-ins no programa do aluno X **deleta os triggers do template** → todos os outros
  alunos com programas do mesmo template perdem check-ins silenciosamente.
- Agravante: em `edit/page.tsx:117-141`, se a query SSR de triggers falhar transitoriamente,
  o estado inicia `{null,null}` → um save comum apaga os triggers sem o treinador tocar em nada.

Fix exige decisão de produto: triggers por programa atribuído (nova dimensão) vs UI deixar claro
que é configuração do modelo. Curto prazo: só chamar a action se o usuário TOCOU nos check-ins
(dirty flag) — elimina o caminho SSR-falho e reduz o cross-aluno acidental.

---

## ALTOS

### R4. Atribuir template via MCP usa a RPC LEGADA (203) — perde prescrição avançada, agenda e expiração ⚠️ verificado manualmente — **CORRIGIDO (tool → RPC 184, provado por SQL)**
`programs-write.ts:502-511` chama `assign_program_to_student` (migration 203, corpo pré-184,
nunca atualizado — verificado: 203 não contém set templates/method_key/scheduled_days/expires_at):
1. NÃO copia `workout_item_set_templates` → séries por fase somem; sem `method_key`/`rounds`
   (pirâmide/drop-set viram agregados).
2. NÃO converte `frequency`→`scheduled_days` → programa sem calendário/lembretes (contradiz a
   própria descrição da tool).
3. NÃO seta `expires_at` → nunca expira.
4. Pausa (`paused`) o programa vigente em vez de completar → fica pendurado para sempre.
5. Ativa imediato mesmo com `start_date` futuro (sem `scheduled`).
Fix: apontar a tool para `assign_program_from_template` (184) como o web.

### R5. Editor web ENCOLHE prescrições rounds>1 com método não-composto criadas via MCP (9 séries → 3) ⚠️ verificado manualmente — **CORRIGIDO (validação na origem MCP)**
- MCP aceita `rounds` 1-20 com QUALQUER `method_key` e materializa N×M linhas
  (`workouts-write.ts:64-81, 279-302`); as instruções do servidor MCP incentivam
  `set_scheme + method_key + rounds` para pirâmide/5x5/top+backoff.
- Web: hidratação colapsa N×M→M linhas usando SÓ o `roundsHint` (`builder-model.ts:98-109`,
  `collapseExpandedScheme` em shared) — mas o save força rounds=1 para não-compostos
  (`effectiveRoundsForItem`, `builder-model.ts:114-119`; compostos = só drop_set/cluster).

Cenário: assistente grava "pirâmide 3 rodadas" (9 linhas) → treinador abre o editor (vê 3 séries)
e salva qualquer coisa → RPC deleta as 9 e grava 3. Prescrição do aluno reduzida a 1/3 sem aviso.
Fix: MCP validar rounds>1 só para métodos compostos (mesma regra `isCompoundMethod`).

### R6. `kinevo_update_workout_item` grava set_scheme em FILHO de superset — recria o órfão que a 228 limpa — **CORRIGIDO (guards V1 na tool)**
`workouts-write.ts:515-604` — sem guarda de `parent_item_id`/`item_type`. O aluno executa o
scheme do filho (hidratação dá precedência às rows), o editor web pós-A2 NÃO o renderiza, e o
próximo save web (228) o deleta + força `method_key=NULL` → a edição do assistente é desfeita
em silêncio. Mesmo buraco no lado template (limpeza one-time da 228 só cobriu
`assigned_workout_item_sets`). Bônus: aceita scheme em item `superset`/cardio/warmup.
Fix: guarda "filho/container não recebe scheme" na tool (regra V1).

### R7. Convenção de descanso divergente MCP × web — bug do Lucas reintroduzido por interop — **CORRIGIDO (rest por filho em todas as superfícies MCP)**
MCP grava filhos com `rest_seconds: 0` e o rest do grupo no PAI (`workouts-write.ts:674,703`;
`programs-write.ts:163-175, 359-371`). Web/mobile pós-b504cd7: rest é POR FILHO; pai é derivado
do último filho a cada edição (`builder-model.ts:530-533, 419`). Cenário: superset criado via
assistente → treinador edita reps de um filho no web → pai re-derivado do último filho (0s) →
**aluno treina sem timer de descanso entre rodadas**. Inverso: editar rest de filho via MCP não
re-deriva o pai. Fix: MCP adotar a convenção por-filho (rest no último filho + pai espelho).

### R8. `kinevo_assign_program action='activate_draft'` reimplementa a ativação sem o núcleo ⚠️ verificado manualmente — **CORRIGIDO (roteado ao núcleo)**
`programs-write.ts:535-545` — UPDATE cru: (1) sem `expires_at` → nunca expira; e interop perverso
com a 229: meses depois, qualquer edição no editor web recalcula `expires_at = started_at +
duration` — já no passado → cron expira o programa após uma edição inocente; (2) não completa o
vigente → estoura o índice único com o erro ENGANOSO "Programa rascunho não encontrado";
(3) sem validação de `scheduled_days`; (4) sem push ao aluno.
Fix: rotear para `activateAssignedProgram` (núcleo compartilhado).

### R9. Mobile, caminho IA: save descarta set_scheme/method_key/rounds silenciosamente ⚠️ verificado manualmente — **CORRIGIDO (bloqueio explícito + auto-fix)**
`useProgramBuilder.ts:226-263` — o mapeamento `draftLike` para `buildSnapshotFromDraft` omite os
3 campos (e `GeneratedWorkoutItem` em `shared/types/prescription.ts:174-199` nem os tem).
Cenário: trainer gera programa com IA, abre o SetSchemeEditor (nada bloqueia), monta drop-set
com cargas/RIR, salva → o aluno recebe "4×10" simples; zero aviso (diferente do caso superset,
que tem Alert dedicado). Mesma classe do A2 da rodada 1, em outra superfície.

### R10. Mobile: menu "…" → "Editar (séries, reps, descanso)" em item avançado — edição 100% descartada — **CORRIGIDO (roteamento)**
`index.tsx:486-487` abre QuickEdit sem checar `advancedActive` (card-tap e swipe roteiam certo;
só o menu vaza); `useProgramBuilder.ts:32-40` — `aggregatesFromItem` recomputa agregados DO
scheme no save, ignorando a edição. Trainer muda 3×10→4×12, haptic de sucesso, nada persiste.
Fix: rotear o menu igual ao card-tap quando há scheme.

### R11. iPad: 5 sheets nunca montam — adicionar bloco/nota/aquecimento/cardio mortos — **CORRIGIDO (gates removidos)**
`index.tsx:742-845` — `AddBlockSheet`, `EditNoteSheet`, `EditWarmupSheet`, `EditCardioSheet`
dentro de `{!isTablet && ...}` (mesmo padrão do swap, que foi corrigido movendo pra fora do gate
— os outros ficaram dentro). No iPad: empty-state "Adicionar bloco" não faz nada; impossível
adicionar/editar aquecimento/cardio/nota. `ExercisePanel` do tablet só adiciona exercício.

### R12. Duplicar programa na BIBLIOTECA web perde método/rounds/séries/check-ins — **CORRIGIDO (RPC 231, provada)**
`programs/actions/duplicate-program.ts:73-115` — INSERTs sem `method_key`/`rounds`, nenhuma cópia
de `workout_item_set_templates` nem `program_form_triggers`; erros parciais engolidos. A cópia
fica com agregados órfãos (reps literal "3× 10/10/10"). Contraste: o `kinevo_duplicate_program`
do MCP copia tudo — o caminho web é o quebrado.

---

## MÉDIOS

### R13. Feeds diários usam INNER JOIN — sessões de treino deletado somem (blast-radius da 227) — **CORRIGIDO (LEFT + snapshot; migration 232 provada)**
- `actions/dashboard/get-daily-activity.ts:52` e `lib/dashboard/get-dashboard-data.ts:297` —
  embed `assigned_workouts!inner` (únicos 2 `!inner` remanescentes no monorepo).
- RPC `get_trainer_daily_activity` (`049:293`, INNER JOIN; consumida por
  `useTrainerDashboard.ts:88`) — feed diário do dashboard mobile do treinador.
Aluno treinou hoje + treinador editou o programa removendo o treino → a sessão некуда some do feed
(é exatamente o dado que a 227 quis preservar). Fix: LEFT + fallback `ws.workout_name`.

### R14. Histórico expandido do aluno (mobile) esconde séries de exercício removido — **CORRIGIDO (pseudo-itens órfãos)**
`useWorkoutHistory.ts:195-208` + `logs.tsx:579-582` — detalhe expandido renderiza só itens ATUAIS
da prescrição (`logsByItem` só indexa `if (itemId)`); fallback `session.exercises` (que inclui
órfãos) só quando o treino inteiro foi deletado. Séries órfãs contam no volume/PR mas ficam
invisíveis na lista. Web e `useSessionDetails` foram adaptados; este hook não.

### R15. Fila do Watch: poison-pill sem TTL — treino deletado antes do FINISH drenar → retry infinito — **CORRIGIDO (erros permanentes tratados; treino preservado)**
`finishWorkoutFromWatch.ts:187-195, 403-441` — treino/item deletado → PGRST116/FK 23503 tratados
como transientes → refila para sempre (fila em SecureStore SEM TTL, ao contrário da
`pendingSetLogQueue`, 24h). A 227 tornou "deletar prescrição com histórico" fluxo legítimo →
frequência sobe. Correlato: `pendingSetLogQueue.ts:223-273` descarta séries silenciosamente após
24h; sessão pode ficar `completed` com séries faltando. Fix: tratar 23503/PGRST116 como
permanentes (gravar com FK null usando os snapshots do payload).

### R16. Trigger da 227 grava o nome PRESCRITO no snapshot quando o aluno fez SWAP de exercício
`migrations/227:82-89` — `fill_set_log_snapshot` prefere `assigned_workout_items.exercise_name`
(prescrito) e ignora `executed_exercise_id` quando o item tem snapshot. Mobile/sala inserem
set_logs sem `exercise_name` e COM `executed_exercise_id` no swap. O leitor novo prefere o
snapshot (`get-session-details.ts:218-219`) → detalhe da sessão mostra o exercício que NÃO foi
executado. Fix: trigger resolver primeiro por `executed_exercise_id`.

### R17. Swap via `kinevo_update_workout_item` sem escopo de tenant — **CORRIGIDO (junto com R6)**
`workouts-write.ts:556-560` — único dos 5 caminhos de lookup de exercício SEM o filtro
`owner_id is null or owner_id = trainer` (os outros 4 têm, com comentário explícito). Permite
apontar item para exercício privado de outro treinador (vaza nome/equipamento; vídeo quebrado
para o aluno por RLS).

### R18. RPC 214 não persiste `exercise_function` — duplicar programa via MCP zera o campo
`migrations/214:94-105,125-136` — coluna fora dos INSERTs (a 198, lado template, persiste).
`kinevo_duplicate_program` MANDA o campo e a RPC ignora → cópia assigned→draft perde a
classificação warmup/main de todos os itens (afeta volume "main" e UX de aquecimento).

### R19. Lost-update multi-superfície: save do editor web DELETA itens criados via MCP durante a edição
RPC full-tree (`229:78-83,129-131`) apaga o que não está no payload; nenhuma superfície tem
versão/etag. Builder aberto + assistente adiciona exercício → próximo "Salvar" da aba (payload
stale) deleta o item novo sem aviso. Variante: rascunho localStorage referenciando item deletado
no servidor → save inteiro falha com erro críptico ("Item % does not belong to workout") e o
treinador fica preso até descartar o rascunho.

### R20. Editar programa expirado via editor re-ativa permanentemente (interop `kinevo_expire_program` × 229)
`programs-write.ts:568-576` marca `expired` sem tocar `expires_at`; o editor força
`status='active'` para não-draft (`edit-assigned-program-client.tsx:459-464`); se
`duration_weeks NULL` → 229 põe `expires_at=NULL` → reativação que o cron nunca pega, desfazendo
a ação do assistente (e estado `active` + `completed_at` preenchido). Se o aluno já tem outro
ativo → save aborta no índice único com erro críptico.

### R21. Fix M1 (expires_at) só existe no web — save mobile continua com o bug original
`useProgramBuilder.ts:383-390` — comentário "expires_at is intentionally not touched" ficou
errado após a 229: o mobile não usa o RPC → estender 4→8 semanas pelo app expira na semana 4.

### R22. Mobile: remover FILHO de superset não re-deriva o rest do pai nem auto-dissolve
`item-helpers.ts:47-62` (teste fixa o comportamento divergente) vs web `builder-model.ts:604-647`
(re-deriva + dissolve com ≤1 filho). Superset A(0s)→B(90s), deletar B → último filho vira A(0s)
→ aluno treina rodadas SEM descanso (execução usa rest por filho). Superset de 1 filho persiste
como container degenerado.

### R23. Mobile: reordenar filhos dentro do superset quebra "último filho carrega o rest da rodada"
`program-builder-store.ts:1469-1500` — drag preserva rests posicionais antigos: B(90) vira
intermediário e A(0) vira último → timer pós-rodada 0s. Nenhum código restaura a convenção
após reorder.

### R24. Mobile: save de edição desparenta TODOS os filhos antes do delete/re-parent — queda de rede achata supersets no banco
`useProgramBuilder.ts:463-477` (assigned) e `727-741` (template) — espelho client-side da 215 em
3 requests separados; crash entre o unparent e o re-parent deixa os supersets do treino inteiros
achatados em prod (filhos viram avulsos com rest 0s). Extensão do known N+1: a falha parcial
passou de "perde edição" para "corrompe estrutura". Fix real = portar para RPC (197).

### R25. `exercise_function` no editor de atribuído: exibido vazio, edição descartada, "Salvar Modelo" grava NULL
`edit/page.tsx:54-79` não seleciona a coluna; hidratação não mapeia; payload/RPC não escrevem;
a UI PERMITE editar (`ExerciseMetricsTrack.tsx:130-132`); "Salvar Modelo" grava
`item.exercise_function || null` → sempre NULL (o builder de criação preserva).

### R26. Falha do save de check-ins engolida / erro tardio mente
`edit-assigned-program-client.tsx:520-526` — retorno `{success:false}` não checado; se a action
LANÇAR, cai no catch "Erro ao salvar programa" — mas o RPC já salvou. No builder de criação o
erro vai só pro console (`program-builder-client.tsx:901-910`).

### R27. Check-in em programa sem `source_template_id`: UI funcional, save no-op silencioso
Painel renderiza por `formTriggerTemplates.length` (`:763-779`), save gated em `sourceTemplateId`
(`:520`). Programas criados via MCP/assistente (draft sem template) ou com template deletado
(FK SET NULL; e o churn de IDs conhecido da edição de template anula o vínculo): treinador
configura check-in, toast de sucesso, nada persiste.

### R28. Mobile: criar MODELO com falha parcial deixa template truncado VISÍVEL na biblioteca; retry multiplica
`useProgramBuilder.ts:91-215` — `is_template=true` no INSERT inicial, N+1 sem transação e SEM o
ref de idempotência A8 (só existe no `saveAndAssign`). Rede cai no treino 3 → template com 2
treinos na biblioteca; cada retry cria outro.

### R29. Mobile: double-tap no create+assign legado durante o invoke da Edge Function
`useProgramBuilder.ts:212-214` — `setSaving` resetado no finally ANTES do
`functions.invoke("assign-program")` (:310-317) → botão ativo por segundos; segundo tap reusa o
programId → 2 invokes concorrentes → programa "concluído" fantasma + 2 pushes. Só o caminho
legado tem o buraco (AI e edição cobrem a chamada inteira).

### R30. Mobile: QuickEdit no card do PAI do superset — edições no-op/divergentes
`index.tsx:903-923` — pai (parent_item_id=null) libera QuickEdit e até Edição avançada:
(a) rest do pai não é o timer real (que usa o último filho); (b) séries no pai não mudam rodadas;
(c) salvar sem tocar reps grava `reps='0'` no pai (`QuickEditSheet.tsx:62`); (d) Edição avançada
pendura rows num pai; swap troca o snapshot do pai (cosmético).

### R31. Web: rascunho localStorage auto-restaura SEM banner por cima de programa da IA / entre abas
`program-builder-client.tsx:640-655` — auto-restore silencioso (só suprimido com
`streamAnimate=true`; deep-link/refresh não têm a flag) → canvas da IA substituído por rascunho
velho mantendo `prescriptionGenerationId` (geração aprovada com conteúdo divergente). Chave
`template:new` compartilhada entre abas; `edit:{programId}` restaura sobre estado mais novo do
servidor. No editor de atribuído há banner; aqui não.

### R32. MCP: snapshot `exercise_muscle_group` ausente (add/create_superset) e stale (swap)
`workouts-write.ts:367-369, 722-724` gravam só name/equipment; swap (:566-570) mantém o grupo do
exercício ANTIGO (Supino→Agachamento continua "Peito"). Afeta `get-program-muscle-volume.ts`.

---

## MENORES

- **Web**: atribuição imediata ignora a data de início escolhida no timeline
  (`assign-program.ts:48-56` só repassa quando scheduled; 184 usa `now()`).
- **Web**: 229 + `started_at` date-only — cada save recalcula `expires_at` a partir da meia-noite
  UTC, adiantando a expiração em até ~24h vs a ativação original (mobile tem guard M11; web não).
- **Mobile**: import por texto — pai recebe rest do PRIMEIRO exercício, último filho fica com o
  próprio → viola "pai espelha último filho" (`store.ts:625/638/665, 754/767/794`).
- **Mobile**: sync do pai usa `siblings[length-1]` por ordem de array, não por `order_index`
  (frágil, hoje seguro pelos loaders).
- **Mobile**: preview renderiza nota/aquecimento/cardio como ExerciseCard vazio
  (`preview.tsx:31-65`) — display-only.
- **Mobile**: em modo edição, empty-state "Gerar com IA"/"Usar existente" desliga o modo edição
  silenciosamente (`index.tsx:301-336`) — Salvar cria programa novo.
- **Mobile**: loader do builder não seleciona o snapshot `exercise_name` da própria row (só o
  join) — exercício deletado da biblioteca → save grava `""` por cima do snapshot
  (`useLoadAssignedProgram.ts:107-117`).
- **Leitores 227 cosméticos**: perfil do aluno web mostra nome em branco
  (`active-program-dashboard.tsx:675`, sem fallback); "Treino" genérico em
  `program-history-section.tsx:320`, `mcp/tools/progress.ts:74`, `celebrationStats.ts:70-78`
  (o snapshot `workout_name` existe e não é usado).
- **Higiene**: sessões `in_progress` órfãs (treino deletado durante treino ativo) ficam
  penduradas para sempre — reattach busca por `assigned_workout_id` e não há cron de limpeza.
- **Tipos**: `schedule-projection.ts:21`, `get-sessions-for-range.ts:7`, `useActiveProgram.ts:19`
  declaram `assigned_workout_id: string` (runtime pode entregar null; inócuo hoje).
  `shared/types/database.ts` está CORRETO.
- **MCP miudezas**: `rounds` sem `set_scheme` é ignorado; `set_scheme` novo sem `method_key`
  deixa method stale; `add_workout_session` em programa ativo sem agenda; `order_index` sem
  unicidade entre superfícies concorrentes.
- **cardio-config**: legado `objective:'distance'` sem teste; edits de duração num cardio
  intervalado silenciosamente descartados (documentado, mas depende do sheet ocultar os campos).

- **(achados do QA, 06/jul)**: web — o botão "Salvar Modelo" do editor de atribuído só
  renderiza em viewport `min-[1700px]` sem fallback (`edit-assigned-program-client.tsx:849`):
  a feature é INALCANÇÁVEL em telas ≤1440px CSS (a maioria dos laptops). Mobile — filhos de
  superset não têm NENHUMA affordance de exclusão no builder (Swipeable desabilitado
  `WorkoutItemRow.tsx:597-598` + menu "…" gated `:347`); remover um filho só é possível pelo
  builder web.

## Conhecidos re-encontrados (rodada 1, ainda abertos — anotações novas)

- **M3 (rodada 1)** ganhou 2 agravantes: `get-trainer-library.ts:56-63` retorna `[]` em erro de
  fetch → um save anula `exercise_name` de TODOS os itens; e a 227 propaga o snapshot anulado
  para `set_logs.exercise_name` nos INSERTs seguintes.
- **N+1 mobile** ganhou a nuance R24 (corrupção estrutural, não só perda de edição).
- **M4 (gate 177)** segue aberto, sem novidade.

## O que foi verificado e ESTÁ correto (rodada 2)

- Migration 227: RLS de set_logs/workout_sessions não depende das FKs anuladas; triggers BEFORE
  INSERT cobrem todos os writers; backfill completo; `database.ts` correto; leitores núcleo
  adaptados (tonelagem, PDF com "Exercício removido", get-session-details com seção de órfãos,
  cron de insights com filter(Boolean)).
- Migration 228: nenhum writer legítimo cria set rows em filho (fora o MCP, R6); revoke da 224
  sobrevive aos CREATE OR REPLACE.
- Migration 229: draft/scheduled → NULL correto; duração indefinida = nunca expira, coerente com
  o cron (exceto R1).
- `toSimpleChild`, `sortItemsHierarchically`, `removeItemDissolvingSuperset`, cardio-config
  (parse/merge), gates A3/A4: corretos.
- RPC 184 copia tudo (set rows com round_number, method/rounds, item_config, substitutos,
  function, scheduled_days, snapshots); `kinevo_duplicate_program` íntegro (exceto R18 via 214);
  ponte do canvas IA usa os mesmos construtores puros; round-trip per-set com método composto
  é simétrico; chaves de rascunho entre contextos não colidem; RLS pós-225 ok; cron idempotente;
  matemática de set_scheme genuinamente compartilhada (shared/lib/prescription).
- Fluxos de template mobile pós-A3: round-trip completo sem perda (foco 1 da rodada — limpo).

## Ordem sugerida de ataque

1. **R1 + R2** (regressões de hoje no editor web — efeito destrutivo atrás de saves banais):
   um fix pequeno cada, mesmo arquivo. Considerar hotfix imediato.
2. **R3** (check-ins cross-aluno): curto prazo = dirty-flag; produto decide o modelo definitivo.
3. **R4 + R8** (MCP assign/activate → apontar para os núcleos 184/activateAssignedProgram).
4. **R5 + R6 + R7** (contrato MCP × builder: rounds compostos, filho sem scheme, rest por filho).
5. **R9 + R10 + R11** (mobile: caminho IA, menu "…", sheets do iPad).
6. **R13 + R14 + R15** (leitores 227: 3 feeds com INNER JOIN, histórico mobile, fila do Watch).
7. **R12** (duplicate web) e o restante dos médios conforme prioridade.
