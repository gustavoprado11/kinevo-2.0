# Prompt para Claude Code — Fase 2.5.3 (fixes de middleware mobile Bearer + notify-student + log de catches)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `docs/specs/logs/auditoria-middleware-mobile.md` — a auditoria completa que originou esta fase. §3 lista os 3 bugs confirmados; §4 o endpoint fantasma; §6 a inconsistência entre `middleware.ts` matcher e `lib/supabase/middleware.ts` updateSession.
2. `docs/specs/logs/fase-2.5.1-execucao.md` §4 — padrão do fix de middleware aplicado em `api/prescription/generate`. Serve de template.
3. `web/src/app/api/notifications/notify-trainer/route.ts` — a route existente que serve como base para clone simétrico de `notify-student`.
4. `web/src/app/api/prescription/generate/route.ts` — padrão canônico de route Bearer-based (pós-2.5.1), inclui `createServerClientFromToken` + `supabase.auth.getUser()` + ownership check + rate-limit.

## Contexto

A auditoria de middleware revelou 3 rotas mobile-first fora da whitelist (bugs confirmados: `/api/programs/assign`, `/api/messages/notify-trainer`, `/api/stripe/portal`), 1 endpoint fantasma chamado pelo mobile mas nunca implementado (`/api/messages/notify-student`), e 1 inconsistência estrutural entre os dois pontos de whitelist.

Três dos fixes são triviais (2 linhas de middleware por route). O quarto (`notify-student`) requer implementação de route inteira, mas com infra simétrica já existente (`sendStudentPush`, `insertStudentNotification`, preferências de notificação no schema). O quinto item do pacote é tratamento de erro cosmético: trocar 3 `.catch(() => {})` silenciosos no mobile por pattern com `console.error` em `__DEV__`, mesmo pattern já usado em outras partes do código.

**Objetivo:** fechar a dívida técnica de middleware mobile revelada pela auditoria. Mobile passa a ter fluxo E2E real: gerar programa (2.5.1), aprovar (2.5.3), trocar mensagens com notificação bidirecional (2.5.3), gerenciar assinatura (2.5.3).

## Escopo

5 entregas em ordem estrita:

1. **Alinhamento §6**: sincronizar `middleware.ts` matcher com `lib/supabase/middleware.ts` updateSession. Deve ser o primeiro commit — zero risco, elimina armadilha futura.
2. **`/api/programs/assign`**: adicionar à whitelist (2 linhas).
3. **`/api/messages/notify-student`** (criar): clone simétrico de `notify-trainer` com auth do trainer + ownership check.
4. **`/api/messages/notify-trainer`**: adicionar à whitelist (2 linhas).
5. **`/api/stripe/portal`**: adicionar à whitelist (2 linhas). Somente o branch Bearer é afetado — branch cookies preservado.

Complementar: trocar 3 `.catch(() => {})` silenciosos no mobile por `.catch((err) => { if (__DEV__) console.error(...) })`.

**Cada etapa é um commit lógico, com testes verdes antes da próxima.**

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde aprovação. O plano deve cobrir:

### Etapa 1 — Alinhamento §6 (pré-fixes)

**Investigação primeiro:**

- Ler `web/src/middleware.ts` linha ~27 (matcher negative lookahead) e listar **todos** os paths excluídos.
- Ler `web/src/lib/supabase/middleware.ts` l.41-54 (cadeia de `!pathname.startsWith(...)`) e listar **todos** os paths excluídos lá.
- Montar a diff exata entre os dois. A auditoria §6 reporta: matcher exclui `api/financial`/`api/notifications`, updateSession não. Confirmar e reportar se há mais divergências.

**Fix proposto:**

- Adicionar em `updateSession` os paths que estão no matcher mas não em updateSession (e vice-versa — reportar se algum).
- Zero mudança semântica hoje (o matcher já filtra antes), mas previne armadilha futura se o matcher for simplificado.
- Nenhuma rota nova entra nesta etapa — apenas alinhamento do estado atual.

**Teste:** não há teste automatizado de middleware no projeto (confirmado na 2.5.1). `npm test` + `tsc` devem continuar verdes.

### Etapa 2 — Whitelist `/api/programs/assign`

**Investigação primeiro:**

- Ler `web/src/app/api/programs/assign/route.ts` inteiro.
- Confirmar que a route **já** autentica via Bearer (`request.headers.get('authorization')` + `createServerClientFromToken` OU equivalente) e faz `supabase.auth.getUser()` com rejeição 401 se inválido.
- Confirmar que a route faz ownership check (trainer só aprova programa de seus próprios alunos).
- Se **qualquer** um desses não estiver correto: pausa e reporta. Adicionar à whitelist com auth frágil = buraco de segurança. 2.5.1 só adicionou `api/prescription/generate` porque a route reescrita atendia contract. Mesma barra aqui.

**Fix:**

- Adicionar `api/programs/assign` em **dois** lugares: matcher de `middleware.ts` e updateSession de `lib/supabase/middleware.ts`.
- Formato idêntico ao pattern `api/prescription/generate` aplicado na 2.5.1.

**Teste E2E:**

- Validação real via curl Bearer contra `localhost:3000` (mesmo padrão da 2.5.1/walk-through/2.5.2).
- Student alvo: qualquer aluno do trainer `7aec3555-…` com prescription_generation pendente de aprovação. Se não houver, criar uma chamando `api/prescription/generate` primeiro (já validado na 2.5.1).
- Expectativa: 200 OK + programa persistido em `programs` + referência cruzada em `prescription_generations.approved_program_id` (ou equivalente — confirmar no código).
- Query de validação:
  ```sql
  SELECT p.id, p.name, p.created_by_generation_id, pg.status
  FROM programs p
  LEFT JOIN prescription_generations pg ON pg.id = p.created_by_generation_id
  WHERE p.trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
  ORDER BY p.created_at DESC LIMIT 1;
  ```

### Etapa 3 — Criar `/api/messages/notify-student`

**Investigação primeiro:**

- Ler `web/src/app/api/notifications/notify-trainer/route.ts` inteiro. Confirmar path exato (pode ser `api/notifications/notify-trainer` ou `api/messages/notify-trainer` — a auditoria diz messages, confirmar).
- Ler `web/src/lib/notifications/send-student-push.ts` (ou equivalente) — a função que vai ser chamada internamente.
- Ler `web/src/lib/notifications/insert-student-notification.ts` (ou equivalente) — função que persiste a notificação em tabela.
- Confirmar shape esperado do body: provavelmente `{ studentId, messageId, preview? }` ou algo similar.
- Confirmar coluna `students.notification_preferences` — a migration 080 citada pelo Gustavo deve ter criado o campo. Ler schema atual.

**Fix — nova route em `web/src/app/api/messages/notify-student/route.ts`** (confirmar path exato seguindo convenção existente):

- Auth via Bearer JWT (trainer é quem dispara: "trainer enviou mensagem ao aluno X").
- `supabase.auth.getUser()` → 401 se inválido.
- Ownership check: `trainer.id === student.coach_id`. 403 se não for o coach do aluno.
- Payload: `{ studentId: string, messageId: string, preview?: string }` (confirmar shape consumido pelo mobile em `mobile/hooks/useTrainerChatRoom.ts:118`).
- Chama `sendStudentPush({ studentId, data: { type: 'trainer_message', messageId, preview } })`.
- Chama `insertStudentNotification({ studentId, type, title, body, data })` (shape exato a confirmar no código).
- `sendStudentPush` já respeita `notification_preferences` internamente (conforme Gustavo) — caller não precisa checar.
- Rate-limit: mesma política de `notify-trainer` ou maior tolerância? Investigar e replicar. Trainer em sessão ativa de coaching pode enviar 20+ mensagens em minutos; cap muito baixo quebra UX.
- Response shape: `{ success: true, notified: boolean, reason?: 'disabled_by_preferences' | 'no_push_token' }` — simétrico a `notify-trainer`.

**Whitelist:**

- Já adicionar `api/messages/notify-student` à whitelist (dois lugares) nesta mesma etapa. Evita deploy de route quebrada.
- Se `api/messages/notify-trainer` seguir mesma hierarquia de path, considerar whitelist em `api/messages/*` (prefixo), **mas apenas se todas as routes dessa pasta forem Bearer** — verificar antes. Se houver route cookies no `api/messages/`, whitelist individual.

**Teste unitário:**

- `web/src/app/api/messages/notify-student/route.test.ts` (seguir padrão de `generate-program.test.ts` pós-2.5.1):
  - 401 sem Authorization.
  - 401 com token inválido.
  - 403 quando trainer não é coach do student.
  - 400 quando body malformado.
  - 200 + `{ notified: true }` no happy path (mock `sendStudentPush` retornando sucesso).
  - 200 + `{ notified: false, reason: 'disabled_by_preferences' }` quando prefs bloqueiam.

**Teste E2E:**

- Via curl Bearer, com student_id do trainer logado.
- Verificar que row é inserida em `student_notifications` (nome da tabela a confirmar).
- Verificar logs do dev server com chamada a `sendStudentPush`.
- **Não é necessário** testar recepção real do push no device — out of scope.

### Etapa 4 — Whitelist `/api/messages/notify-trainer`

**Investigação:**

- Ler a route existente. Confirmar que já está Bearer-based e segura (provavelmente sim — a auditoria só marcou como "fora da whitelist", não como "auth quebrada").
- Se route precisa ajuste de auth, registrar e fazer **antes** da whitelist.

**Fix:**

- Adicionar `api/messages/notify-trainer` à whitelist (dois lugares).

**Teste E2E:**

- Curl Bearer simulando aluno enviando mensagem (requer JWT de aluno, não de trainer — investigar se `mobile/hooks/useTrainerChat.ts:180` envia como student ou como trainer).
- Se não for fácil obter JWT de aluno: pular E2E direto, validar via log do dev server (route responde 200 em vez de 307).
- **Alternativa**: depois da Etapa 3 estar validada, trigar via mobile real (Gustavo manda mensagem do app do aluno-teste).

### Etapa 5 — Whitelist `/api/stripe/portal`

**Investigação:**

- Ler `web/src/app/api/stripe/portal/route.ts` — a auditoria diz que o branch Bearer está lá, só não está na whitelist.
- Confirmar que o branch cookies continua funcionando após whitelist (adicionar à whitelist **não** desabilita cookies — apenas desativa o redirect 307 para Bearer).
- Se a route tem lógica condicional `if (bearer) { ... } else { ... cookies ... }`, ambos branches sobrevivem.

**Fix:**

- Adicionar `api/stripe/portal` à whitelist (dois lugares).

**Teste E2E:**

- Curl Bearer com trainer que tenha subscription ativa. Esperar 200 + URL do Stripe Customer Portal na response.
- Se não houver trainer com subscription ativa no DB de dev: pular E2E e validar via log.

### Complementar — Mobile: log de catches silenciosos

**Arquivos:**

- `mobile/hooks/useTrainerChat.ts:180`
- `mobile/hooks/useTrainerChat.ts:241`
- `mobile/hooks/useTrainerChatRoom.ts:106`

**Fix:**

- Substituir `.catch(() => {})` por:
  ```ts
  .catch((err) => {
      if (__DEV__) console.error('[<context>]', err)
  })
  ```
  onde `<context>` descreve a operação (ex: `'notify-trainer'`, `'send-message'`). Seguir exatamente o pattern já usado em `useTrainerChatRoom.ts:127-129`.
- **Não** trocar pelo pattern que propaga erro ao usuário — swallow preservado (senão crasha chat quando push falha). Só adiciona rastro em dev.

**Teste:**

- Validar apenas que app compila (`npm run build` ou `expo start --type metro-only` — o que for padrão do projeto).
- Não há teste automatizado de hooks mobile no projeto (confirmar via `find mobile -name "*.test.*"`).

### Validação final end-to-end

Após as 5 etapas + fix complementar, rodar:

- `npm test` (web) — todos testes verdes, inclusive os novos da etapa 3.
- `npx tsc --noEmit` (web) — zero erros.
- Build do mobile (Expo/Metro) — zero erros.
- Query de sanidade:
  ```sql
  -- Confirmar que student_notifications recebeu row da Etapa 3
  SELECT * FROM student_notifications 
  WHERE student_id = '<id usado no teste>' 
  ORDER BY created_at DESC LIMIT 5;
  
  -- Confirmar que program assignment funcionou
  SELECT id, name, trainer_id, created_at 
  FROM programs 
  WHERE trainer_id = '7aec3555-600c-4e7c-966e-028116921683' 
  ORDER BY created_at DESC LIMIT 1;
  ```

## O que **não** fazer

- Não refatore a whitelist para polaridade invertida (opções X/Y/Z da auditoria §8). Ficam como follow-up explícito.
- Não mova arquivos entre `api/messages/` e `api/notifications/` mesmo que haja inconsistência de convenção — só documente no log.
- Não toque em routes categoria B (web cookies) nem categoria C (webhooks).
- Não aplique migration SQL nesta fase (a tabela `student_notifications` e a coluna `notification_preferences` já devem existir — se não existirem, pausa e reporta).
- Não ligue flag `smart_v2_enabled` para outros trainers.
- Não use git.

## Regras desta sessão

- Plano primeiro, espera aprovação explícita antes de editar.
- Se investigação da Etapa 2 ou 4 ou 5 revelar que auth da route não está hardened, **pause e reporte** antes de adicionar à whitelist. Whitelist = confiança no handler. 2.5.1 estabeleceu essa barra; manter.
- Se investigação da Etapa 3 revelar que a infra (`sendStudentPush`, `insertStudentNotification`, schema) não existe como Gustavo relatou, pause e reporte. Não crie infra nova sem confirmar.
- Se a inconsistência §6 (Etapa 1) for maior que a auditoria reportou, pause e reporte antes de alinhar às cegas.
- `npm test` verde. `npx tsc --noEmit` verde.
- Strings user-facing em pt-BR; código/comentários em inglês.

## Definição de "pronto"

- Etapas 1, 2, 4, 5: whitelist alinhada, 3 routes acessíveis via Bearer.
- Etapa 3: route `notify-student` criada, testes unitários verdes, E2E valida persistência em `student_notifications`.
- Complementar: 3 `.catch` com log em dev.
- `npm test` verde (318 + novos da etapa 3).
- `npx tsc --noEmit` verde.
- Build mobile OK.
- `docs/specs/logs/fase-2.5.3-execucao.md` criado com:
  - §1 Escopo (5 etapas + complementar).
  - §2 Investigações por etapa (especialmente inconsistência §6 real, e shape de `notify-trainer` que serviu de clone).
  - §3 Diffs resumidos por etapa.
  - §4 Evidência E2E por route (status, shape de response, row no DB quando aplicável).
  - §5 Follow-ups abertos: decisão sobre opções X/Y/Z de refatoração estrutural da whitelist; convenção de path `api/messages/*` vs `api/notifications/*`; expansão de testes de hooks mobile.
- Atualizar `docs/specs/logs/auditoria-middleware-mobile.md` §3 e §4 marcando os 3 bugs + 1 fantasma como **endereçados** com link pro log 2.5.3.

Comece produzindo o plano. Aguarde aprovação.
