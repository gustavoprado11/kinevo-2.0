export const meta = {
  name: 'dev-loops',
  description: 'Orquestrador dos loops de desenvolvimento do Kinevo (modelo Replit): roda os domínios escolhidos (produção, segurança, seo, visual) em paralelo, deduplica cross-domínio e emite uma lista de ação única priorizada. Cada domínio é um loop isolado também disparável sozinho.',
  whenToUse: 'Para uma varredura completa multi-domínio (noturno/pós-deploy). Para um só domínio, dispare o loop dele diretamente (production-runtime-loop, security-loop, seo-geo-loop, qa-visual-loop).',
  phases: [
    { title: 'Domínios', detail: 'roda cada loop de domínio selecionado (sub-workflow)' },
    { title: 'Unificar', detail: 'dedup cross-domínio + lista de ação priorizada única' },
  ],
}

// args: {
//   date, repoRoot, repoRootAbs, reportDir,
//   domains?: ['production','security','seo','visual'],  // default: production+security+seo (visual só se vier manifest)
//   supabaseProjectId?, vercel?:{projectId,teamId}, base?, liveProbe?, visualManifest?
// }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const date = A.date || 'sem-data'
const repoRoot = A.repoRoot || '/Users/gustavoprado/kinevo/web/src'
const repoRootAbs = A.repoRootAbs || '/Users/gustavoprado/kinevo'
const reportDir = A.reportDir || '/Users/gustavoprado/kinevo/docs/dev-loops'
const common = { date, repoRoot, repoRootAbs, reportDir }

// Visual só roda se houver um manifest já capturado (capture.sh usa CDP — não roda headless aqui).
const wantsVisual = (A.domains ? A.domains.includes('visual') : !!A.visualManifest) && !!A.visualManifest
const domains = A.domains || ['production', 'security', 'seo']

// Mapeia domínio → (workflow, args).
const PLAN = {
  production: { wf: 'production-runtime-loop', args: { ...common, supabaseProjectId: A.supabaseProjectId, vercel: A.vercel } },
  security: { wf: 'security-loop', args: { ...common, supabaseProjectId: A.supabaseProjectId, liveProbe: A.liveProbe === true } },
  seo: { wf: 'seo-geo-loop', args: { ...common, base: A.base, routes: A.routes, targetQueries: A.targetQueries } },
  mobile: { wf: 'mobile-loop', args: { ...common, mobileRootAbs: A.mobileRootAbs, supabaseProjectId: A.supabaseProjectId } },
  visual: { wf: 'qa-visual-loop', args: { manifest: A.visualManifest, date, reportDir, repoRoot } },
}

const toRun = domains.filter((d) => PLAN[d] && (d !== 'visual' || wantsVisual))
if (A.domains && A.domains.includes('visual') && !wantsVisual)
  log('Domínio "visual" pedido mas sem visualManifest — rode scripts/qa-loop/capture.sh antes e passe o manifest. Pulando visual.')

phase('Domínios')
log(`Rodando domínios: ${toRun.join(', ')}`)
// Paralelo: domínios são independentes. Cada loop usa agentes internamente (1 nível de aninhamento, ok).
const results = await parallel(
  toRun.map((d) => () =>
    workflow(PLAN[d].wf, PLAN[d].args)
      .then((r) => ({ domain: d, ok: true, ...r }))
      .catch((e) => ({ domain: d, ok: false, error: String(e) })),
  ),
)

const ok = results.filter((r) => r && r.ok)
const failed = results.filter((r) => r && !r.ok)
if (failed.length) log(`Falharam: ${failed.map((f) => f.domain).join(', ')}`)

phase('Unificar')
// Sintetizador cross-domínio: dedup + lista de ação única. Recebe os markdowns/headlines de cada domínio.
const unified = await agent(
  `Você é o ORQUESTRADOR dos loops de desenvolvimento do Kinevo. Recebeu os relatórios JÁ VERIFICADOS de ${ok.length} domínios. Sua tarefa: unificar SEM re-verificar (confie nos vereditos), DEDUPLICAR achados que aparecem em mais de um domínio, e produzir UMA lista de ação priorizada.

RELATÓRIOS POR DOMÍNIO (JSON):
${JSON.stringify(ok.map((r) => ({ domain: r.domain, headline: r.headline, markdown: r.markdown })), null, 2)}

${failed.length ? `Domínios que FALHARAM (registre como gap de cobertura): ${failed.map((f) => f.domain + ' — ' + (f.error || '').slice(0, 160)).join(' · ')}` : ''}

Monte um relatório Markdown:
# Dev Loops — Relatório Unificado — ${date}
## Cobertura (domínios rodados ✓ / falhos ✗) — e o que ficou sem cobertura
## 🎯 Lista de ação priorizada — tabela única: prioridade | domínio(s) | item | severidade/impacto | esforço (P/M/G) | evidência. Junte duplicatas (mesmo arquivo/causa em domínios diferentes = 1 linha citando ambos). Ordene por severidade×impacto.
## 🛠️ Prompts de fix (consolidados) — os fix-prompts de todos os domínios, agrupados por domínio; NÃO inclua fix de segurança como "auto-aplicável" (marque "requer revisão humana").
## Por domínio — um parágrafo de headline de cada (+ link pro REPORT-<dominio>-${date}.md)

Regras: não invente; se um domínio veio limpo, diga. Conciso e acionável.
NÃO use Write. Devolva via \`markdown\`.`,
  {
    label: 'unify', phase: 'Unificar',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['markdown', 'headline'],
      properties: { markdown: { type: 'string' }, headline: { type: 'string' } },
    },
  },
)

// Devolve o unificado + cada relatório de domínio pro pai gravar (subagentes não podem Write).
return {
  unifiedReportPath: `${reportDir}/REPORT-UNIFICADO-${date}.md`,
  unifiedMarkdown: unified.markdown,
  headline: unified.headline,
  domainReports: ok.map((r) => ({ domain: r.domain, reportPath: r.reportPath, markdown: r.markdown })),
  failed: failed.map((f) => ({ domain: f.domain, error: f.error })),
}
