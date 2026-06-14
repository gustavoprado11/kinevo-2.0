export const meta = {
  name: 'fix-loop',
  description: 'Camada 3 — loop de implementação: pega fix-prompts JÁ VERIFICADOS e aprovados, aplica cada um em worktree ISOLADO, roda testes (tsc/lint/test) + revisão adversarial do diff, e devolve só os diffs que passaram (NÃO faz push, NÃO landa em main, NÃO aplica fix de segurança sem flag explícita). O humano revisa/aplica.',
  whenToUse: 'Depois de um loop de detecção, com um conjunto de fixes selecionado/aprovado pelo Gustavo. Cada fix vira um patch verificado pronto pra revisão.',
  phases: [
    { title: 'Aplicar+Verificar', detail: '1 worktree isolado por fix; o MESMO agente aplica, roda tsc/lint/test e revisa o diff' },
  ],
}

// args: {
//   date, repoRootAbs, reportDir,
//   fixes: [{ id, domain, title, prompt, severity, workspace? }],  // workspace ∈ web|mobile|shared (default web)
//   allowSecurity?: boolean   // libera fixes de domínio "security"/"seguranca" (default false — nunca auto-aplica)
// }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const date = A.date || 'sem-data'
const repoRootAbs = A.repoRootAbs || '/Users/gustavoprado/kinevo'
const reportDir = A.reportDir || '/Users/gustavoprado/kinevo/docs/dev-loops'
const allowSecurity = A.allowSecurity === true
const SEC = new Set(['security', 'seguranca', 'segurança'])

const allFixes = Array.isArray(A.fixes) ? A.fixes : []
// Gate de segurança: fix de segurança nunca é auto-implementado sem flag explícita.
const blocked = allFixes.filter((f) => SEC.has((f.domain || '').toLowerCase()) && !allowSecurity)
const fixes = allFixes.filter((f) => !(SEC.has((f.domain || '').toLowerCase()) && !allowSecurity))
if (blocked.length) log(`Pulando ${blocked.length} fix(es) de SEGURANÇA (exigem revisão humana; passe allowSecurity:true p/ forçar): ${blocked.map((b) => b.id || b.title).join(', ')}`)
if (!fixes.length) { log('Nenhum fix aplicável após o gate.'); return { applied: [], skippedSecurity: blocked.map((b) => b.id || b.title), note: 'nada a fazer' } }

const RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'status', 'summary'],
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['passed', 'failed', 'skipped'], description: 'passed = implementado E verificado; failed = não passou nos checks/revisão; skipped = não aplicável.' },
    summary: { type: 'string', description: 'O que foi feito e o resultado dos checks (tsc/lint/test + revisão).' },
    diff: { type: 'string', description: 'git diff unificado do worktree (vazio se failed/skipped).' },
    filesTouched: { type: 'array', items: { type: 'string' } },
    checks: { type: 'string', description: 'Resultado bruto resumido: tsc, lint, testes (nº verde/vermelho).' },
    reviewVerdict: { type: 'string', enum: ['ok', 'regressao', 'fora_de_escopo', 'nao_resolve'], description: 'Veredito da revisão adversarial do diff.' },
  },
}

phase('Aplicar+Verificar')
log(`${fixes.length} fix(es), cada um num worktree isolado (aplica + verifica no MESMO worktree).`)

// UM agente por fix, no SEU worktree: implementa E verifica no mesmo lugar.
// Lição da 1ª run (14/jun): dois agent() com isolation:'worktree' = DOIS worktrees
// distintos → o verificador nascia num checkout limpo e não via a implementação do
// irmão. Tem que ser um agente só por worktree.
const results = (await parallel(fixes.map((f, i) => () => {
  const ws = f.workspace || 'web'
  return agent(
    `Você IMPLEMENTA e VERIFICA um fix no Kinevo, sozinho num worktree isolado (não afeta os outros). Repo: ${repoRootAbs}. Workspace alvo: ${ws}/.

FIX #${f.id || i} (${f.domain || 'geral'} · severidade ${f.severity || '?'}): ${f.title || ''}

PROMPT DE FIX (verificado por um loop de detecção):
${f.prompt}

PASSO 1 — IMPLEMENTAR. Regras estritas:
- Aplique SOMENTE este fix. Não toque em nada fora dos arquivos que o prompt indica.
- Siga o CLAUDE.md do repo (TS strict, sem \`any\`, Server Actions, Shield Strategy/hex, ícones Lucide).
- NÃO rode migration no banco, NÃO faça push, NÃO commite em main. Mude só arquivos no SEU worktree.
- Se exigir DDL, CRIE o .sql em supabase/migrations (não aplique no banco).

PASSO 2 — PREPARAR DEPS. O worktree é checkout limpo SEM node_modules (gitignored). Da RAIZ do worktree: \`ln -sfn ${repoRootAbs}/node_modules node_modules\` e \`ln -sfn ${repoRootAbs}/${ws}/node_modules ${ws}/node_modules\`. tsc/vitest resolvem do node_modules da RAIZ (monorepo hoisted).

PASSO 3 — CHECKS no workspace ${ws}/ (rode DENTRO de ${ws}/): \`npx tsc --noEmit\`; \`npx eslint\` nos arquivos tocados se houver; e a suíte (\`npx vitest run\`). Reporte nº verde/vermelho no campo checks.

PASSO 4 — REVISÃO ADVERSARIAL do seu próprio diff (cético): (a) resolve o Outcome prometido? (b) introduz regressão/efeito colateral? (c) respeitou o ESCOPO? (d) segue convenções?

VEREDITO:
- status "passed" SÓ se tsc limpo + testes verdes + reviewVerdict "ok". Inclua o \`git diff\` completo no campo diff.
- status "failed" se qualquer check falhou ou reviewVerdict ∈ {regressao, fora_de_escopo, nao_resolve} — explique em summary, diff vazio.
NÃO faça push nem commite em main.`,
    { label: `fix:${f.id || i}`, phase: 'Aplicar+Verificar', isolation: 'worktree', schema: RESULT_SCHEMA },
  )
}))).filter(Boolean)

const passed = results.filter((r) => r.status === 'passed')
const failed = results.filter((r) => r.status === 'failed')
log(`Resultado: ${passed.length} passou, ${failed.length} falhou, ${blocked.length} bloqueado (segurança).`)

// Devolve os diffs verificados pro humano/pai revisar e aplicar. NUNCA landa sozinho.
return {
  date,
  reportPath: `${reportDir}/REPORT-FIXES-${date}.md`,
  passed: passed.map((r) => ({ id: r.id, summary: r.summary, checks: r.checks, reviewVerdict: r.reviewVerdict, filesTouched: r.filesTouched, diff: r.diff })),
  failed: failed.map((r) => ({ id: r.id, summary: r.summary, checks: r.checks, reviewVerdict: r.reviewVerdict })),
  skippedSecurity: blocked.map((b) => ({ id: b.id || b.title, title: b.title })),
  note: 'Diffs verificados — revise e aplique manualmente. O loop não faz push, não landa em main, e não aplica fix de segurança sem allowSecurity:true.',
}
