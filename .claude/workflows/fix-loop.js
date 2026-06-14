export const meta = {
  name: 'fix-loop',
  description: 'Camada 3 — loop de implementação: pega fix-prompts JÁ VERIFICADOS e aprovados, aplica cada um em worktree ISOLADO, roda testes (tsc/lint/test) + revisão adversarial do diff, e devolve só os diffs que passaram (NÃO faz push, NÃO landa em main, NÃO aplica fix de segurança sem flag explícita). O humano revisa/aplica.',
  whenToUse: 'Depois de um loop de detecção, com um conjunto de fixes selecionado/aprovado pelo Gustavo. Cada fix vira um patch verificado pronto pra revisão.',
  phases: [
    { title: 'Implementar', detail: '1 worktree isolado por fix; agente aplica só aquele fix' },
    { title: 'Verificar', detail: 'tsc/lint/test + revisor adversarial do diff' },
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

phase('Implementar')
log(`${fixes.length} fix(es) a implementar (cada um em worktree isolado).`)

// pipeline 1-item: cada fix é implementado e verificado no SEU worktree, em paralelo e sem colisão.
const results = (await pipeline(
  fixes,
  // -- Stage 1: implementar em worktree isolado --
  (f, _o, i) => {
    const ws = f.workspace || 'web'
    return agent(
      `Você implementa UM fix no Kinevo, isolado num worktree próprio (não afeta os outros). Repo: ${repoRootAbs}. Workspace alvo: ${ws}/.

FIX #${f.id || i} (${f.domain || 'geral'} · severidade ${f.severity || '?'}): ${f.title || ''}

PROMPT DE FIX (verificado por um loop de detecção):
${f.prompt}

Regras ESTRITAS:
- Aplique SOMENTE este fix. Não toque em nada fora dos arquivos que o prompt indica.
- Siga as convenções do CLAUDE.md do repo (TS strict, sem \`any\`, Server Actions, etc.).
- NÃO rode migration em banco, NÃO faça push, NÃO commite em main. Mude só arquivos.
- Se o fix exigir DDL/migration, CRIE o arquivo .sql em supabase/migrations (não aplique no banco).
- Ao terminar, deixe as mudanças no working tree do worktree (não precisa commitar).

Devolva: filesTouched e um resumo do que mudou. (A verificação roda no próximo estágio.)`,
      { label: `impl:${f.id || i}`, phase: 'Implementar', isolation: 'worktree', schema: {
        type: 'object', additionalProperties: false,
        required: ['id', 'summary', 'filesTouched'],
        properties: { id: { type: 'string' }, summary: { type: 'string' }, filesTouched: { type: 'array', items: { type: 'string' } } },
      } }).then((r) => ({ ...r, _fix: f, _i: i, _ws: ws }))
  },
  // -- Stage 2: verificar (tsc/lint/test + revisão adversarial) NO MESMO worktree --
  (impl) => {
    if (!impl) return null
    const f = impl._fix, ws = impl._ws
    return agent(
      `Você VERIFICA o fix recém-aplicado, no MESMO worktree isolado onde ele foi feito. Repo: ${repoRootAbs}, workspace ${ws}/.

Fix #${f.id || impl._i}: ${f.title || ''}
Resumo da implementação: ${impl.summary}
Arquivos tocados: ${JSON.stringify(impl.filesTouched || [])}

Faça, nesta ordem:
1) \`git diff\` no worktree p/ ver exatamente o que mudou.
2) Checks no workspace ${ws}/ (rode dentro de ${ws}/, NÃO na raiz do monorepo): \`npm run typecheck\` (ou tsc --noEmit), \`npm run lint\` se houver, e os testes do workspace (\`npm run test:run\`/\`vitest run\`). Reporte nº verde/vermelho.
3) REVISÃO ADVERSARIAL do diff (seja cético): (a) resolve de fato o que o fix prometia (o Outcome)? (b) introduz regressão ou efeito colateral? (c) respeitou o ESCOPO (não tocou fora do previsto)? (d) segue as convenções?

Veredito:
- status "passed" SÓ se tsc limpo + testes verdes + reviewVerdict "ok".
- status "failed" se qualquer check falhou ou reviewVerdict ∈ {regressao, fora_de_escopo, nao_resolve} — explique no summary.
Inclua o \`git diff\` completo no campo diff SE passed (senão vazio). NÃO faça push nem commite em main.`,
      { label: `verify:${f.id || impl._i}`, phase: 'Verificar', isolation: 'worktree', schema: RESULT_SCHEMA },
    )
  },
)).filter(Boolean)

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
