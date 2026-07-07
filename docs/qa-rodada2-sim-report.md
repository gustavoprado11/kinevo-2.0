# QA no simulador — fixes da rodada 2 do builder (working tree)

Data: 06/jul/2026. Executor: Claude (sessão de QA a partir de `docs/qa-rodada2-sim-prompt.md`).
Escopo: validar o **comportamento dos clients** (mobile no simulador iOS "iPhone 17 Pro Conectado" +
web local `localhost:3000`) para os fixes R9–R31 da rodada 2. Migrations 230–235 já provadas por SQL
no relatório da auditoria; aqui só o client.

Banco: **produção** (`lylksbtgrihzepbteest`). Conta de teste: **Dono Teste**
(`dono@kinevolab.test`, trainer `96734318-a1b5-447a-aef0-0e0fed4f2aa0`). Aluno de teste: **Ana Atleta**
(`54b46ba7-2ae0-40cd-8a93-a594d92d41bb`, sem auth). Nenhum dado de treinador/aluno real foi tocado.
`git commit`/`push`/migrations: **não executados**.

## Resumo

| QA | Fix | Superfície | Veredito |
|----|-----|-----------|----------|
| QA-1 | R10 — menu "…" roteia item avançado p/ SetSchemeEditor | mobile | ✅ PASS |
| QA-2 | R30 — QuickEdit no container de superset (só descanso + espelho; alerts) | mobile | ✅ PASS |
| QA-3 | R22 — remover filho re-deriva pai / dissolve com 1 filho | mobile | ⚠️ NÃO TESTÁVEL |
| QA-4 | R23 — reordenar filhos re-espelha o pai | mobile | ⚠️ NÃO TESTÁVEL |
| QA-5 | R21 — expires_at no save de edição mobile | mobile | ✅ PASS |
| QA-6 | R2-mobile — programa agendado→ativado não regride no save | mobile | ✅ PASS |
| QA-7 | R14 — histórico expandido mostra séries de exercício removido | mobile | ✅ PASS |
| QA-8 | R28 — modelo só entra na biblioteca com árvore completa | mobile | ✅ PASS |
| QA-9 | R29 — sem double-tap no create+assign | mobile | ✅ PASS |
| QA-10 | R9 — revisão de IA bloqueia métodos avançados | mobile | ⚠️ NÃO TESTÁVEL |
| QA-11 | R11 — sheets no iPad | mobile | ⚠️ NÃO TESTÁVEL |
| QA-12 | R25 — exercise_function no editor de atribuído | web | ✅ PASS (passo 4 bloqueado) |
| QA-13 | R27 — check-in oculto sem template de origem | web | ✅ PASS |
| QA-14 | R12 — duplicar modelo copia tudo | web | ✅ PASS |
| QA-15 | R13 — feed diário mostra sessão de treino deletado | web+mobile | ✅ PASS |
| R15 | fila de FINISH do Watch | watch | ⚠️ NÃO TESTÁVEL |

**11 PASS, 5 NÃO TESTÁVEL, 0 FAIL.** Nenhum comportamento divergente do esperado foi observado nos
itens testáveis. Os NÃO TESTÁVEL são todos por limitação de ambiente/ferramental (detalhado abaixo),
não por falha do fix.

---

## MOBILE

### QA-1 · R10 — ✅ PASS
Builder de criação com Ana → adicionei o exercício "90/90 Inferior Dinâmico", abri Edição avançada,
apliquei o preset **Pirâmide ↓** (4 fases: 12/10/8/6) e salvei o scheme. O card passou a exibir o chip
**PIRÂMIDE ↓** com as 4 fases (`/tmp/qa1-h.png`). Abri o menu "…" → **"Editar (séries, reps, descanso)"**
(`/tmp/qa1-i.png`): abriu o **SetSchemeEditor** (tabela de fases, "Método: Pirâmide ↓", "4 fases",
Série 1/2 com chips Normal/Top/Backoff e CARGA/DESCANSO) — `/tmp/qa1-j.png` — e **não** o QuickEdit de
agregados. Roteamento do R10 confirmado (o save não descarta mais o método).

### QA-2 · R30 — ✅ PASS
Superset semeado no programa de teste (container espelhando o último filho, filhos 0/0/90). Tap no
**card do container** abriu o QuickEdit; mudei o DESCANSO 90→75 (um toque em "−" = −15s) sem tocar em
reps e salvei (`/tmp/qa2-c.png`, `/tmp/qa2-d.png`). Após persistir, o SQL confirmou o espelho e a
não-corrupção de reps:

```
role       | item_type | order_index | exercise_name                  | reps | rest_seconds
CONTAINER  | superset  | 1           |                                | 10   | 75
child o0   | exercise  | 0           | Rosca Direta 21 com Halteres   | 10   | 0
child o1   | exercise  | 1           | Rosca Direta 21 Barra W        | 10   | 0
child o2   | exercise  | 2           | Rosca Direta 21 com Barra Reta | 10   | 75   <- último filho = espelho
```
Container `rest=75` = último filho `rest=75`; intermediários `0`; **container.reps='10' (não '0')**. Obs.:
o '10' vem do default do loader (`reps ?? '10'` quando null), não do QuickEdit — o bug era `reps='0'`, que
não ocorre. No menu "…" do container: **"Trocar exercício"** → Alert *"O bloco não tem exercício próprio —
troque os exercícios de dentro dele."* (`/tmp/qa2-h.png`); **"Edição avançada"** → Alert *"Métodos avançados
são configurados nos exercícios de dentro do bloco."* (`/tmp/qa2-i.png`). Os três comportamentos do R30 OK.

### QA-3 · R22 — ⚠️ NÃO TESTÁVEL (sem affordance de delete por-filho no builder mobile)
O cenário "delete (swipe) do último filho" **não é reproduzível pela UI mobile**: filhos de superset
**não têm swipe-to-delete** (`WorkoutItemRow.tsx:597-598` desabilita o `Swipeable` quando `inSuperset`) e
**não têm o menu "…"** (`WorkoutItemRow.tsx:347` gating em `!inSuperset`); o QuickEdit do filho só edita
sets/reps/rest, sem excluir (`/tmp/qa3-f.png`). Logo, `removeItem` sobre um filho não tem gatilho de UI no
builder mobile (só é alcançável no builder **web**, que tem "Excluir exercício"/"Desvincular do superset"
por filho — visto em QA-12). Mitigação: `normalizeSupersetsAfterChange` tem 4 testes de unidade novos, e o
QA-2 comprova ao vivo que o invariante "pai espelha o último filho" está ativo no client mobile.

### QA-4 · R23 — ⚠️ NÃO TESTÁVEL (idb não faz long-press-drag)
Reordenar filho exige drag iniciado por long-press (DraggableFlatList via `onLongPress`,
`index.tsx:285`). O `idb ui swipe` não faz "segurar-e-arrastar": um swipe longo (2.2s, delta 5) da última
posição para o topo **não reordenou** (ordem inalterada na árvore de acessibilidade). Sem ferramental para
o gesto, o item fica não-testável no meu ambiente. Mesma mitigação do QA-3 (4 testes de unidade + espelho
comprovado no QA-2).

### QA-5 · R21 — ✅ PASS
Programa ativo de 4 semanas (pré-estado via SQL). No app (edit builder, deep-link), mudei a duração
**4→8** e salvei:
```
duration_weeks=8 · expires_at=2026-08-31 21:48:28.401  ·  started_at + 8 semanas = 2026-08-31 21:48:28.401845
```
Igual até o milissegundo (o client recomputa `started+8w` e grava em precisão de ms; a diferença de µs é
truncamento do JS, não divergência). Depois esvaziei a duração (**→0**) e salvei:
```
duration_weeks IS NULL · expires_at IS NULL · status='active'
```
Convenção 229/230 confirmada no save mobile (`/tmp/qa5-e.png`, `/tmp/qa5-h.png`).

### QA-6 · R2-mobile — ✅ PASS
Pré-estado simulando o cron: `status='active'`, `started_at=now()`, `scheduled_start_date=ontem`. Editei
só o nome (metadado) no app e salvei. SQL pós-save:
```
status='active' · started_at=2026-07-06 21:54:57 (NOT NULL) · name='QA9 Double2 QA6'
```
**Não** regrediu para 'scheduled'/started_at NULL. O loader/save agora deriva o tipo do `status`, não do
`scheduled_start_date`.

### QA-7 · R14 — ✅ PASS
*(Desvio anotado: Ana não tem auth login, então usei o espelho-aluno da própria conta Dono Teste
(student `7443ecc4`) em **modo aluno** — exercita diretamente `useWorkoutHistory`, que é o hook do R14.)*
SQL de setup: `workout_sessions` completed de ontem com `assigned_workout_id=NULL`,
`workout_name='QA Treino Deletado'` + 2 `set_logs` com `assigned_workout_item_id=NULL`,
`exercise_name='QA Exercício Removido'`, `is_completed=true`. Em `kinevo://logs`, expandi a sessão
"QA Treino Deletado": aparecem as 2 séries sob o pseudo-item **"QA Exercício Removido"** (#1 50kg×10 ✓,
#2 50kg×10 ✓) — `/tmp/qa7-b.png`. Antes do R14 sumiam da visão expandida.

### QA-8 · R28 — ✅ PASS
Builder SEM aluno (fluxo modelo) → montei 2 treinos × 2 exercícios e salvei. O modelo entrou na
biblioteca. SQL:
```
program_templates "QA8 Template": is_template=true · workouts=2 · items=4
```
Flag `is_template=true` só com a árvore completa. (Também confirmado na UI web `/programs`
em `/tmp` ss_79993515y — "QA8 Template · 2 treinos · 4 exercícios".) O caminho de falha parcial não é
testável no sim (coberto por code review, conforme o prompt).

### QA-9 · R29 — ✅ PASS
Builder com Ana (fluxo manual). **Save único**: o botão Salvar mostrou spinner durante todo o save
(`/tmp/qa9-b.png`) e criou **exatamente 1** `assigned_program` (`0d8a8f7d`). **Teste do double-tap**:
montei outro programa e disparei **2 taps rápidos** no Salvar → o SQL confirmou **ainda 1** programa
novo (`8e2a39b1`, 1 source template) — nenhum assign concorrente. `isSaving` cobre o invoke da Edge
Function.

### QA-10 · R9 — ⚠️ NÃO TESTÁVEL
A conta Dono Teste está com `ai_tier='free'` e `ai_prescriptions_enabled=false` — sem IA habilitada, o
fluxo de revisão de IA não existe. Conforme o prompt, item condicional a IA = NÃO TESTÁVEL.

### QA-11 · R11 — ⚠️ NÃO TESTÁVEL
`xcrun simctl list devices | grep -i ipad` → **nenhum iPad** instalado. Instalar dev client em iPad = build
(fora de escopo). NÃO TESTÁVEL.

### R15 (fila do Watch) — ⚠️ NÃO TESTÁVEL
WatchConnectivity não funciona em simulador (validação só em device físico).

---

## WEB (dev local + Chrome CDP, logado como Dono Teste)

### QA-12 · R25 — ✅ PASS (passos 2-3; passo 4 bloqueado por viewport)
Editor de atribuído (`/students/<ana>/program/<8e2a39b1>/edit`). **Passo 2** (função aparece preenchida
quando existe): setei via SQL `exercise_function='warmup'` no item 90/90 e o campo **FUNÇÃO** renderizou
"**Aquecimento**" (`ss_4120whx8w`); os filhos do superset mostram "—". **Passo 3** (mudar → salvar →
persistir): mudei para "**Principal**" e salvei; SQL: `exercise_function='main'`; recarreguei e o campo
segue "Principal" (`ss_3351n431p`). **Passo 4** ("Salvar Modelo" carrega a função): **não exercitável neste
display** — o botão "Salvar Modelo" só renderiza em viewport `min-[1700px]` (código
`edit-assigned-program-client.tsx:849`, sem fallback em telas menores) e o viewport CSS aqui é limitado a
1440px pelo tamanho da tela (resize da janela e zoom do browser não passaram de 1440). O passo 2-3 já prova
a hidratação+persistência de `exercise_function`; o "Salvar Modelo" reusa o mesmo mapeamento `builderData`,
e o contrato de presença-de-chave da migration 235 foi provado por SQL na auditoria. **Núcleo do R25 OK.**

### QA-13 · R27 — ✅ PASS
Com `source_template_id` presente, o header do editor exibia o ícone **"Configurar check-in"** (checklist)
— `ref_24` no primeiro `read_page`. Setei `source_template_id=NULL` via SQL e recarreguei: o ícone de
check-in **sumiu** (header ficou só com preview-no-celular + comparar) — zoom em `/tmp` ss_23352v9g1 mostra
apenas 2 ícones. UI de check-in oculta sem template de origem (antes: painel funcional com save no-op).

### QA-14 · R12 — ✅ PASS
Garanti um modelo com método: adicionei `method_key='pyramid_down'` + 4 séries por fase (12/10/8/6) ao
primeiro item do "QA8 Template". Biblioteca `/programs` → "…" → **Duplicar**. Surgiu **"QA8 Template
(Cópia)"** (2 treinos · 4 exercícios). SQL comparando original × cópia:
```
name                  | items | items_with_method | methods       | set_rows
QA8 Template          | 4     | 1                 | pyramid_down  | 4
QA8 Template (Cópia)  | 4     | 1                 | pyramid_down  | 4
```
Contagens de `workout_item_set_templates` e `method_key` **idênticas** — a duplicação copia método +
séries por fase (RPC `duplicate_program_template` / migration 231).

### QA-15 · R13 — ✅ PASS (web + mobile)
SQL: `workout_sessions` completed de HOJE com `assigned_workout_id=NULL`,
`workout_name='QA Sessão Órfã'` (aluno Ana). **Web** (dashboard, seção "Treinos de hoje"): aparece
**"Ana Atleta · Concluiu QA Sessão Órfã · 18:26"** (`ss_79993515y`). **Mobile** (dashboard do treinador
"Clássico", seção "ATIVIDADE DO DIA"): aparece **"Ana Atleta — QA Sessão Órfã 18:26"** (`/tmp/qa15m-c.png`).
Os 3 feeds (2 web + 1 mobile) trocaram INNER JOIN por LEFT JOIN + fallback `workout_name`; antes a sessão
órfã sumia.

---

## Resíduo zero

Todas as linhas criadas durante o QA foram deletadas e a deleção verificada por SQL. Estado final do
tenant Dono Teste: **3 alunos (inalterados), 0 programas, 0 templates, 0 subscriptions** — idêntico ao
inicial.

| Recurso | id | Prova de deleção |
|---|---|---|
| subscriptions (trialing temp, gate M4) | `0930daca-…` | `subscriptions(trainer)` = **0** |
| assigned_programs QA9 DoubleTap | `0d8a8f7d-…` (+ src template `9800e5e5`) | `assigned_programs(test ids)` = **0** |
| assigned_programs QA9 Double2 (+ superset container `d99ab22d` + 3 filhos) | `8e2a39b1-…` (+ src template `39e03a94`) | `assigned_programs(trainer total)` = **0** |
| program_templates QA8 Template | `047c86aa-…` | `program_templates(trainer total)` = **0** |
| program_templates QA8 Template (Cópia) | `deefdd9d-…` | idem = **0** |
| workout_sessions QA Treino Deletado + 2 set_logs | `a652aff4-…` | `workout_sessions(QA ids/names)` = **0**, `set_logs(QA orphan)` = **0** |
| workout_sessions QA Sessão Órfã | `8cc011ec-…` | idem = **0** |

**Alteração de auth (restaurada):** para habilitar o login web como Dono Teste (o Gustavo não sabia a senha
da conta de teste e o domínio `.test` não recebe email de reset), com autorização explícita do usuário
resetei a senha via service-role SQL. No teardown **restaurei o hash `encrypted_password` original**
(`$2a$10$sQhDSVdjh8sQ…SP4sumDm`), verificado (`restored_to_original=true`). A conta está byte-idêntica ao
estado pré-QA. (As sessões web/mobile em curso não dependem da senha; seguem válidas.)

## Notas de método e desvios

- **Mobile**: dirigido com `idb` (taps por coordenada lógica 402×874; `cliclick` não registra taps neste
  setup) + `xcrun simctl io screenshot`. Deep-links: `kinevo://program-builder?studentId=…`,
  `kinevo://program-builder/edit/<id>`, `kinevo://logs`, `kinevo://dashboard`. Subscription `trialing`
  temporária inserida antes dos testes de save (gate M4/migração 177 zera writes sem ela) e removida no fim.
- **Web**: Chrome CDP, viewport limitado a 1440px CSS (tela) — impediu o passo 4 do QA-12.
- **Superset (QA-2/3/4)**: as tools MCP do Kinevo autenticam como *Gustavo Prado* (treinador real), então
  **não** foram usadas para semear dados (regra: não tocar em tenant real). O superset foi semeado por SQL
  direto no tenant Dono Teste, replicando a representação do loader (container `item_type='superset'` +
  filhos por `parent_item_id`, rest por-filho intermediários 0 / último = rodada / pai = espelho).
- **QA-7**: testado via espelho-aluno da conta Dono Teste em modo aluno (Ana não tem auth login).
