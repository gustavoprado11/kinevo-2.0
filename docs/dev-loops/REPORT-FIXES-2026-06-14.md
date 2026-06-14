# Loop de Implementação (fix-loop) — estreia — 2026-06-14

Primeira run da Camada 3 (`fix-loop.js`) sobre os 4 fixes de SEO/GEO do `REPORT-SEO-GEO-2026-06-14.md`.

## Bug de design encontrado (e corrigido)
Cada `agent()` com `isolation:'worktree'` ganha o **próprio** worktree. O fix-loop estava
em **pipeline de 2 estágios** (implementar → verificar), ambos com `isolation:'worktree'` →
o verificador nascia num worktree **limpo diferente** e não via a implementação do irmão.
Resultado: só G2 "passou" (aquele verificador foi esperto e reaplicou o diff do irmão via
`git apply --3way` antes de checar); G1/G3/G4 reportaram corretamente "fix ausente no meu
worktree" → falso `nao_resolve`.

**Correção aplicada:** colapsado para **um agente por fix** que implementa E verifica no
MESMO worktree (`parallel()` em vez de `pipeline()` de 2 estágios). Também documentado o
symlink de `node_modules` (worktree é checkout limpo, monorepo hoisted → tsc/vitest vivem na raiz).

## Resultado real dos 4 fixes
Todos os 4 foram implementados corretamente (os diffs existiam nos worktrees de implementação).
Salvados para o working tree principal e **verificados juntos**: `tsc --noEmit` limpo + suíte
web **1105 testes verdes / 1 skip / 0 vermelhos**.

| Fix | Arquivos | Status |
|---|---|---|
| G1 — parágrafo definitório citável no hero | `landing-hero.tsx` (+9) | ✅ aplicado |
| G2 — métodos avançados no featureList + SSR | `app/layout.tsx`, `landing-pillars.tsx` (+6) | ✅ verificado na run (tsc+1105) |
| G3 — 2 FAQ nomeando MFIT/Tecnofit/Trainerize (feed do FAQPage JSON-LD) | `faqs-data.ts` (+8) | ✅ aplicado |
| G4 — canonicals self-referentes + og:url www | `android/page.tsx`, `terms/page.tsx`, `privacy/page.tsx` (+22) | ✅ aplicado |

Diffs no working tree principal, **sem commit/push** até autorização. Worktrees da run removidos.
