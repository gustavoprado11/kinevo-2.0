# Estúdios v1 — Matriz adversarial de RLS (gate da Fase 1)

Prova que a RLS org-aware (migrations 252/253) compartilha os alunos do estúdio **sem** reabrir o furo cross-tenant que motivou a reversão da 225, e sem regredir contas solo.

## Personas (contas QA descartáveis)

| Persona | Papel | Aluno |
|---|---|---|
| G | owner/gestor do Estúdio QA | — |
| A | coach do estúdio | SA (responsável) |
| B | coach do estúdio | SB (responsável) |
| C | treinador SOLO (fora do estúdio) | SC |
| SA | aluno (auth) de A | — |

Alunos SA e SB têm `organization_id = <Estúdio QA>` (via backfill do script); SC tem `organization_id = null`.

## Asserções (runner: `/tmp/kinevo-qa/rls-matrix.mjs`, sessão real anon+login = PostgREST)

**Compartilhamento legítimo**
- A lê o aluno SB do colega ✓
- A edita campo comum de SB (org UPDATE) ✓
- A lê o programa de SB (leitura cruzada) ✓
- A cria programa **como A** para SB (prescrição cruzada) ✓
- G (gestor) lê SA e SB ✓

**Isolamento entre tenants**
- C (solo) NÃO lê SA do estúdio ✓
- A NÃO lê SC (aluno solo de C) ✓
- C NÃO lê programa de SA ✓

**Papel aluno não escala**
- aluno SA NÃO lê SB ✓
- aluno SA no diretório de membros → vazio ✓

**Colunas de posse imutáveis via PostgREST (findings do /security-review)**
- F1: A NÃO reatribui SB para si (coach_id) ✓
- F2: A NÃO desanexa SB do estúdio (organization_id := null) ✓
- F3: A NÃO insere programa forjando trainer_id = B ✓
- F3-update: A NÃO flipa trainer_id de programa do estúdio ✓
- Reatribuição legítima só via service_role (server action `reassignStudent`) ✓

**Regressão solo**
- C lê e edita o próprio SC (comportamento solo intacto) ✓

## Como rodar

Pré: migrations 252/253 aplicadas ao banco alvo; personas criadas (`create-studio-qa.mjs step1/step2` + `provision-studio.ts --backfill`).

```
node /tmp/kinevo-qa/rls-matrix.mjs   # exit 0 = matriz verde
```

## Resultado

**🟢 17/17 — verde (15/jul/2026, prod lylksbtgrihzepbteest, migr 252/253/254 aplicadas).**

Achado durante o gate (corrigido em migr 254): o write-gate RESTRICTIVE de assinatura
(migr 177, `current_trainer_id_active()`) barrava TODO INSERT/UPDATE/DELETE de coach de
estúdio, pois exigia assinatura SOLO ativa. A 254 tornou a função org-aware (acesso ao
núcleo herdado da org, espelhando `isOrgBillingActive`). Sem a matriz esse bloqueio
passaria despercebido — os writes cruzados legítimos simplesmente falhariam em prod.
