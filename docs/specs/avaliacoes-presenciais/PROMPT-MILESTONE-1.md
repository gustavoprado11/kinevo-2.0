# PROMPT — Milestone 1: Data Foundation (Avaliações Presenciais)

> Cole este prompt no Claude Code. Ele assume que você está na raiz do repo `kinevo`.

---

Você vai implementar o **Milestone 1 — Data Foundation** do módulo de Avaliações Presenciais do Kinevo.

## Antes de começar

1. Leia, **na ordem**, estes três arquivos da raiz/docs do repo:
   - `docs/specs/avaliacoes-presenciais/00-visao-geral.md`
   - `docs/specs/avaliacoes-presenciais/01-milestone-1-data-foundation.md`
   - `Estrategia_Avaliacoes_Presenciais_Kinevo.md` (apenas seções 2, 7 e 8 — contexto e plano de integração)

2. Confirme que entendeu o escopo:
   - Quais tabelas e colunas serão criadas/alteradas?
   - Quais RPCs e quais permissões?
   - O que está **fora** de escopo deste milestone?

3. Se algo na spec for ambíguo, **pare e pergunte**. Não invente.

## O que fazer

Implementar exatamente o que está na seção "Entregas" do arquivo `01-milestone-1-data-foundation.md`:

1. **Migration `supabase/migrations/122_assessments_phase1.sql`** (confirme antes que 121 ainda é o último committed via `ls supabase/migrations/ | sort | tail -3`; se outro número tiver entrado, use o próximo disponível e me avise)
   - Estender `form_templates` (categoria `assessment`, coluna `delivery_mode`).
   - Criar tabelas `assessment_sessions` e `assessment_measurements` com índices, triggers e comentários.
   - Habilitar RLS e criar policies trainer (CRUD) + student (read-only nas sessions com `status='completed'`).
   - Criar 5 RPCs: `get_assessment_sessions`, `get_assessment_session`, `create_assessment_session`, `save_assessment_measurements`, `finalize_assessment_session`.
   - Aplicar `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`.

2. **Tipos TypeScript em `shared/types/assessments.ts`** seguindo exatamente o que a spec descreve.

3. **Regenerar Supabase types** com `npx supabase gen types typescript ...` para incluir as tabelas novas em `shared/types/database.ts` (ou no caminho equivalente do projeto — descobrir lendo `package.json` e `supabase/config.toml`).

4. **Hooks placeholder mínimos**:
   - Mobile: `mobile/hooks/useAssessmentSessions.ts` e `mobile/hooks/useAssessmentSession.ts` (apenas chamada de RPC + tipagem; sem UI).
   - Web: `web/src/actions/assessments/get-sessions.ts`, `create-session.ts`, `save-measurements.ts`, `finalize-session.ts` (seguir padrão de `web/src/actions/forms/*`).

## Convenções obrigatórias

- **Branch:** `feature/avaliacoes-presenciais-m1`. Crie via `git checkout -b ...` antes de qualquer edit.
- **Migration aditiva.** Nunca dropar coluna ou apagar dado. Sempre `IF NOT EXISTS` / `IF EXISTS`.
- **Padrão de migrations existentes.** Antes de escrever, **leia ao menos 3 migrations recentes** para entender o estilo:
  - `supabase/migrations/047_fix_inbox_data_leak.sql` (RLS pattern)
  - `supabase/migrations/049_trainer_mobile_rpcs.sql` (RPCs com SECURITY DEFINER)
  - `supabase/migrations/065_initial_assessment_template.sql` (seed de form template)
  - `supabase/migrations/120_trainer_prescription_preferences.sql` (mais recente)
- **Helpers já existentes**: `current_trainer_id()`, `current_student_id()`, `update_updated_at_column()`. Use, não recrie.
- **Naming:** snake_case nas tabelas e RPCs, camelCase no TypeScript.
- **i18n:** strings user-facing em pt-BR (relevante apenas para mensagens de inbox).
- **Sem libs novas.** Se sentir que precisa de uma, pare e pergunte.

## Padrão de commits

Commits pequenos e atômicos:
1. `feat(db): extend form_templates with assessment category and delivery_mode`
2. `feat(db): create assessment_sessions and assessment_measurements tables`
3. `feat(db): RLS policies for assessment tables`
4. `feat(db): RPCs for assessment session lifecycle`
5. `feat(types): assessment types in shared/`
6. `chore: regenerate supabase types`
7. `feat(hooks): placeholder hooks for assessments (mobile + web)`

## Verificação antes de abrir PR

Rode obrigatoriamente, na ordem, e me mostre o output:

1. `npx supabase db reset` (ou equivalente do projeto) — confirma que a migration aplica do zero.
2. Aplicar a migration **2 vezes seguidas** num banco já populado para confirmar idempotência (sem erro).
3. `tsc --noEmit` na raiz dos projetos `shared/`, `mobile/`, `web/` para garantir que não quebrou typing.
4. Executar manualmente o roteiro de teste descrito na seção "Como testar manualmente" da spec (1. criar template → 2. criar sessão → 3. salvar medição → 4. finalizar → 5. ler como aluno → 6. tentar como outro trainer e verificar que falha).
5. Listar todos os arquivos criados/alterados.

## Entrega final

Abra um Pull Request `feature/avaliacoes-presenciais-m1` com:
- **Título:** `feat(assessments): M1 — data foundation`
- **Descrição:** mencione cada item dos acceptance criteria da seção 3 da spec, marcando ✅ os que rodaram.
- **Screenshots:** print do Supabase Studio mostrando as duas tabelas novas + um print do output do roteiro de teste manual.
- **Notas:** qualquer decisão tomada que não estava 100% explícita na spec.

## Gatilhos para parar e perguntar

Pare e me chame antes de prosseguir se:

- A função `update_updated_at_column()` não existir (improvável, mas possível).
- O tipo `system_alert` não estiver no CHECK de `student_inbox_items.type`.
- A constraint atual de `form_templates_category_check` tiver formato diferente do esperado.
- Qualquer migration recente tiver alterado a estrutura de `form_templates` de forma incompatível.
- Você precisar criar uma nova lib/dependência.
- Você sentir que precisa **dropar** algo (jamais).
- A geração de Supabase types não tiver script no `package.json` — descobrir o caminho certo antes de assumir.

**Não comece a escrever código antes de ter lido a spec inteira.**
