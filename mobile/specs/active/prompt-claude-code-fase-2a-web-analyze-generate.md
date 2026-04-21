# Prompt — Fase 2a: Web (analyze + generate)

> Copie e cole o bloco abaixo em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo`.

---

Essa é a **Fase 2a de 4** da unificação da prescrição IA no mobile. Aqui você expõe a state machine agentiva via HTTP para o mobile consumir, **sem mudar o endpoint `/api/programs/assign`** (isso é Fase 2b, com considerações de segurança separadas).

## Prerequisito

- **Fase 1 precisa estar mergeada** (ou disponível localmente). Essa fase só depende dos tipos compartilhados; o mapper em si não é usado por analyze/generate.

## Spec

Leia por inteiro: `mobile/specs/active/unificacao-prescricao-ia-mobile.md`. Essa fase corresponde à seção "Estratégia de execução → Fase 2a" e às entradas "(Fase 2a)" em "Arquivos Afetados" + "Critérios de Aceite".

## Contexto

- O web tem hoje:
  - Server action `analyzeStudentContext(studentId, selectedFormIds)` em `web/src/actions/prescription/analyze-context.ts`. Retorna `AnalyzeContextResult` (state + perguntas iniciais).
  - Server action `generateProgram(studentId, agentState?, selectedFormIds?, options?)` em `web/src/actions/prescription/generate-program.ts`. Hoje o endpoint HTTP `POST /api/prescription/generate` **não passa** `agentState`/`selectedFormIds` — chama `generateProgram(studentId)` direto, o que é OK pra web (usa direto a server action) mas ruim pro mobile (que precisa passar o estado do agente via HTTP).
  - Rate limit em `/api/prescription/generate`: 5 por minuto, 20 por dia, aplicado via `web/src/lib/rate-limit/...` (veja o route atual).
  - Feature flag: `trainer.ai_prescriptions_enabled`. Retorna 403 se o trainer não tiver.
- O mobile (Fase 3) vai chamar:
  - `POST ${EXPO_PUBLIC_WEB_URL}/api/prescription/analyze` — novo.
  - `POST ${EXPO_PUBLIC_WEB_URL}/api/prescription/generate` — hoje existe, mas precisa aceitar `agentState` + `selectedFormIds`.

## Trabalho

### 1. Criar `POST /api/prescription/analyze`

- Arquivo: `web/src/app/api/prescription/analyze/route.ts`.
- Contrato:
  - Body JSON: `{ studentId: string, selectedFormIds?: string[] }`.
  - Response 200: `AnalyzeContextResult` (mesmo shape que `analyzeStudentContext` retorna — tipo de `shared/types/prescription.ts`).
  - Response 401: sem Bearer.
  - Response 403: trainer sem `ai_prescriptions_enabled`.
  - Response 400: `studentId` ausente/inválido.
  - Response 500: erro inesperado.
- Autenticação: espelhe exatamente o padrão usado em `web/src/app/api/prescription/generate/route.ts` (Bearer JWT via `Authorization` header, `createClient` com ANON + `global.headers.Authorization`, depois `supabase.auth.getUser()`).
- Ownership: o trainer autenticado precisa ser dono do `studentId`. Faça o mesmo check que `generate` faz hoje. Se não for dono, 403.
- Feature flag: mesmo check de `ai_prescriptions_enabled` do `generate`.
- Rate limit: aplique os **mesmos limites** do `generate` (5/min, 20/day) usando o mesmo helper. Se não houver helper reusável, extraia para `web/src/lib/rate-limit/prescription.ts` e use nos dois routes.
- Delega para `analyzeStudentContext(studentId, selectedFormIds ?? [])`. Não duplique lógica.
- Erros do `analyzeStudentContext` viram 500 com mensagem genérica (ou 400 se for erro de validação).

### 2. Estender `POST /api/prescription/generate`

- Arquivo: `web/src/app/api/prescription/generate/route.ts`.
- **Backward compat é obrigatória**: clientes que mandam `{ studentId }` hoje devem continuar funcionando sem mudanças.
- Aceitar no body:
  - `agentState?: PrescriptionAgentState` — opcional.
  - `selectedFormIds?: string[]` — opcional.
- Quando presentes, repassar para `generateProgram(studentId, agentState, selectedFormIds, { supabase })`.
- Quando ausentes, comportamento atual idêntico (`generateProgram(studentId, undefined, undefined, { supabase })` ou assinatura equivalente).
- Validação: se `agentState` presente, valide shape com Zod (ou equivalente) contra `PrescriptionAgentState` de `shared/types/prescription.ts`. Se inválido, 400.
- Rate limit, auth, feature flag: mantenha o que já tem.

### 3. Testes

- Adicione testes unitários (Vitest) para os dois routes em `web/src/app/api/prescription/__tests__/` (ou siga a convenção do projeto):
  - `analyze`: 200 happy path, 401 sem Bearer, 403 sem feature flag, 403 trainer não é dono do student, 400 body inválido.
  - `generate`: "com `agentState` válido chama `generateProgram` com os 3 args"; "sem `agentState` mantém chamada atual"; "com `agentState` inválido retorna 400".
- Use mocks dos helpers existentes (supabase client, rate-limit) espelhando o que os testes atuais do `generate` fazem.

### 4. Verificação final

- `cd web && npx tsc --noEmit` → zero novos erros vs `main`.
- `cd web && npm run test` → verde, incluindo os testes novos.
- Teste manual rápido via curl (opcional, mas recomendado):
  ```bash
  curl -X POST http://localhost:3000/api/prescription/analyze \
    -H "Authorization: Bearer <valid-jwt>" \
    -H "Content-Type: application/json" \
    -d '{"studentId":"<valid>","selectedFormIds":[]}'
  ```

## Restrições

- **Não toque em `assign-from-snapshot.ts` nem em `/api/programs/assign`.** Isso é Fase 2b e tem considerações de segurança próprias.
- **Não toque em `shared/`, `mobile/`, `supabase/functions/`.**
- **Backward compat no `generate` é inegociável.** Teste explicitamente o caminho sem `agentState`.
- **Não duplique lógica de auth/feature-flag/rate-limit.** Se precisar, extraia para helper.
- Siga convenções do web: `web/CLAUDE.md` se existir, erros em pt-BR quando apropriado, tipos de `@kinevo/shared`.

## Entregáveis finais

1. `web/src/app/api/prescription/analyze/route.ts` novo.
2. `web/src/app/api/prescription/generate/route.ts` estendido.
3. (Opcional) helper de rate-limit extraído se a duplicação ficar feia.
4. Testes verdes em `web/`.
5. `tsc --noEmit` limpo em `web/`.
6. Resumo em bullets: endpoints criados/modificados, contratos, decisões não-óbvias.

Quando terminar, **não crie PR ou commit** — deixe as mudanças locais para o dev revisar.
