# PROMPT — Milestone 6: Templates seed + onboarding (Avaliações Presenciais)

> Cole este prompt no Claude Code. M1, M2, M3, M4 já estão em main.

---

Você vai implementar o **Milestone 6 — Templates de sistema seedados +
onboarding** do módulo de Avaliações Presenciais do Kinevo. Esse milestone
resolve o atrito que o user identificou em M4: "preciso criar template antes
de usar protocolo".

Entrega: 5 templates de sistema seedados via migration SQL + tour de
onboarding web + onboarding inline mobile.

⚠️ **Atenção:** este é o ÚLTIMO milestone antes do M5 (PDF). Quando
finalizado, a Fase 1 fica completa exceto pelo PDF.

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/00-visao-geral.md`
   - `docs/specs/avaliacoes-presenciais/05-milestone-6-templates-seed.md`
   - `docs/specs/avaliacoes-presenciais/MILESTONE-1-STATUS.md`
   - `docs/specs/avaliacoes-presenciais/MILESTONE-4-STATUS.md`

2. Examine arquivos existentes que serão estendidos ou referenciados:
   - `supabase/migrations/066_system_form_templates.sql` (pattern de seed)
   - `web/src/components/onboarding/tours/tour-definitions.ts` (já existe?)
   - `web/src/components/onboarding/tours/tour-runner.tsx` (já existe?)
   - `web/src/app/forms/forms-dashboard-client.tsx` (trigger do tour)
   - `mobile/app/(trainer-tabs)/forms.tsx` (onboarding mobile)
   - Procurar infra de tour no mobile: grep por "tour", "onboarding", "Joyride"

3. Confirme entendimento:
   - 5 templates de sistema (Antropometria, J&P 3, J&P 7, Petroski 4, Inicial completa)
   - Tour web via TourRunner existente
   - Tour mobile inline (provavelmente sem infra)
   - Persist via `trainer.onboarding_state` (web) e MMKV (mobile)

4. Se algo for ambíguo, **PARE e pergunte**. Não invente.

## Workflow (mesmo padrão dos M1-M4)

- **Sem branch.** Direto em main.
- **Sem `git commit` nem `git push` durante desenvolvimento.** Eu autorizo
  ao final.
- **DIVIDIDO em 3 sub-blocos** (B1 → B2 → B3) com paradas obrigatórias:

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (read-only)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (deve estar limpo, exceto cosméticos pré-existentes)
2. `git log --oneline -5` (último commit deve ser o do M4)
3. Próximo número de migration disponível:
   `ls supabase/migrations/ | sort | tail -3`
4. `head -100 supabase/migrations/066_system_form_templates.sql` para entender
   pattern de seed
5. `cat web/src/components/onboarding/tours/tour-definitions.ts | head -80`
   se existir (e listar tours definidos)
6. `cat web/src/components/onboarding/tours/tour-runner.tsx | head -60`
   se existir
7. Procurar infra mobile de onboarding:
   `grep -rln "tour\|onboarding\|Joyride\|walkthrough" mobile/ --include="*.tsx" | head -10`
8. Verificar se `trainer.onboarding_state` existe:
   `grep -rln "onboarding_state" web/ shared/ --include="*.ts" | head -5`

PARE e me reporte. Foco especial em:
- Próximo número de migration (provavelmente 123 ou 124)
- Se TourRunner existe e como é usado
- Se mobile tem alguma infra de tour ou se vamos fazer inline
- Estrutura de `trainer.onboarding_state` (jsonb? campos?)

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — MIGRATION SQL COM TEMPLATES SEEDADOS
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

Implementar:
- `supabase/migrations/{N}_assessment_seed_templates.sql` (N = próximo
  número confirmado no Bloco A)
- 5 INSERTs em `form_templates` com `trainer_id = NULL`, `system_key` único,
  `category = 'assessment'`, `delivery_mode = 'trainer_in_person'`,
  `created_source = 'system'`, `is_active = true`,
  `is_default_for_new_students = false`
- Schema completo de cada template conforme seção 3 da spec
- Idempotência via `ON CONFLICT (system_key) DO NOTHING` ou
  pattern UPSERT

⚠️ Importante:
- Match com `'use server'` patterns existentes em migration 066
- `schema_json` deve ser JSONB válido — testar localmente antes de aplicar
- Não criar novas RLS — já coberto por policies existentes

Verificações:
- Migration valida sintaticamente (psql --check ou DB local)
- 5 templates inseríveis sem erro
- Re-run da migration não duplica (idempotência)

PARE e reporte. Aguardo aprovação antes de aplicar em prod.

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — TOUR ONBOARDING WEB
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

Implementar:
- Estender `web/src/components/onboarding/tours/tour-definitions.ts`
  com `assessmentsFirstTime: TourStep[]` (3-4 steps)
- Trigger no `forms-dashboard-client.tsx`:
  - Quando `activeTab === 'assessments'` E `trainer.onboarding_state.assessments_tour_seen` é falsy
  - Mostrar TourRunner com `steps={TOUR_STEPS.assessmentsFirstTime}`
- Action server-side para marcar como visto:
  - `web/src/actions/onboarding/mark-tour-seen.ts` (NEW se não existir)
  - Ou usar pattern existente (verificar)

Steps sugeridos (ajustar conforme TourRunner API):
1. **Welcome** — texto sem highlight, "Bem-vindo às Avaliações Presenciais..."
2. **Templates de sistema** — highlight "+ Novo template de avaliação", texto sobre clones
3. **Criar sessão** — highlight "+ Nova avaliação"
4. **Mobile capture** — texto sem highlight, "Captura acontece no app mobile"

Verificações:
- TypeScript clean
- Tour aparece em refresh limpo (limpar onboarding_state.assessments_tour_seen no DB)
- Tour não reaparece após dispensar/completar
- Botão "Pular" funciona

PARE e reporte com screen-recording (se possível) ou descrição do flow.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — TOUR ONBOARDING MOBILE + STATUS DOC
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

Implementar:
- Investigar infra mobile (resultado do Bloco A)
- Se NÃO houver infra: card inline persistente no estado vazio da aba
  "Presenciais" do `mobile/app/(trainer-tabs)/forms.tsx`:
  - Texto: "Use templates do Kinevo ou crie o seu. Toque no + pra começar."
  - Botão "Entendi" → MMKV: `kinevo-assessment-tour-seen = true`
  - Não reaparece após dispensar
- Se HOUVER infra: usar e seguir mesmo pattern do web
- `MILESTONE-6-STATUS.md` final em `docs/specs/avaliacoes-presenciais/`

Verificações:
- TypeScript clean em mobile/
- Card aparece na primeira vez na aba Presenciais (lista vazia + tour não visto)
- Card desaparece após "Entendi"
- Card não reaparece em refresh

PARE e reporte:
- Lista de arquivos criados/alterados
- MILESTONE-6-STATUS.md gerado
- Screenshot do card mobile (se possível)

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL + COMMIT + PUSH
═══════════════════════════════════════════════════════════════════════

Eu vou:
1. Aplicar a migration em prod via apply_migration MCP (depois do B1
   aprovado, não no commit)
2. Validar via SQL que os 5 templates apareceram
3. Pedir user pra fazer smoke test no web e mobile
4. Aprovar commit + push

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- TourRunner não existir ou ter API muito diferente da esperada
- Mobile tour exigir lib nova
- Schema do template não passar validação (JSONB syntax error)
- Conflito com algum template `system_key` existente
- Estrutura de `trainer.onboarding_state` ser muito diferente do esperado
- Necessidade de migration extra pra trainer.onboarding_state

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. BLOCO B1 → reportar → aguardar aprovação
3. BLOCO B2 → reportar → aguardar aprovação
4. BLOCO B3 → reportar → aguardar aprovação
5. BLOCO C (eu aplico migration, valido, autorizo commit + push)

NÃO commit, NÃO push até autorização explícita após smoke test.

COMECE PELO BLOCO A.
