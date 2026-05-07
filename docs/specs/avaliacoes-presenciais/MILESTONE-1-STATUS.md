# Milestone 1 — Status de validação

**Estado:** código pronto no working tree, validação SQL diferida.

## O que foi feito
- Migration 122 escrita e revisada (ver `122_assessments_phase1.sql`)
- Tipos compartilhados em `shared/types/assessments.ts`
- Hooks placeholder mobile e web
- Rollback script pronto (`m1-rollback.sql`)
- Roteiro de validação SQL pronto com placeholders (`m1-validation.sql`)
- Typecheck nos 3 packages: zero erros novos

## O que NÃO foi feito
- Migration NÃO foi aplicada em nenhum ambiente
- Roteiro SQL NÃO foi executado (Docker não disponível no momento)
- Supabase types NÃO foram regenerados

## Como completar a validação

No momento de aplicar a migration 122 em produção:

1. Aplicar migration:
   `supabase migration up` ou via Supabase MCP `apply_migration`
2. Substituir placeholders em `m1-validation.sql` usando UUIDs reais
   de um trainer e student de teste (criar se necessário)
3. Rodar o roteiro contra prod, capturar output de cada STEP
4. Verificar que STEP 7 e STEP 7b falham com mensagem de access denied
   (esperado — RLS funcionando)
5. Rodar cleanup do roteiro (já incluído no SQL)
6. Rodar `npm run gen:types` apontando para prod para atualizar
   `shared/types/database.ts` com as tabelas novas
7. Se algo der errado, executar `m1-rollback.sql` no mesmo ambiente

Em caso de bug crítico descoberto na validação que exija mudança de
schema, criar nova migration aditiva (`123_assessments_fix_*.sql`),
nunca editar a 122 in-place após estar aplicada.
