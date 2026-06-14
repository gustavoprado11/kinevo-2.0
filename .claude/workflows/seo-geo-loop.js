export const meta = {
  name: 'seo-geo-loop',
  description: 'Loop de SEO/GEO da landing B2B do Kinevo: faz fetch do HTML SSR real, audita meta/canonical/OG/JSON-LD/robots/sitemap + answerability GEO (uma IA acharia a resposta no conteúdo?), verifica contra o HTML/asset de verdade (não suposição) e sintetiza gaps + prompts de fix.',
  whenToUse: 'Após mudanças na landing/SSR/metadata, ou periodicamente para flagrar regressão de SEO/GEO.',
  phases: [
    { title: 'Fetch', detail: 'baixa HTML SSR das rotas-chave + sitemap/robots' },
    { title: 'Audit', detail: '1 agente por rota: SEO técnico + answerability GEO' },
    { title: 'Verify', detail: 'confirma cada gap contra o HTML/asset real (fetch do og:image etc.)' },
    { title: 'Synthesize', detail: 'gaps priorizados + fix-prompts' },
  ],
}

// args: { date, repoRoot, repoRootAbs, reportDir, base?, routes?: string[], targetQueries?: string[] }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const date = A.date || 'sem-data'
const repoRoot = A.repoRoot || '/Users/gustavoprado/kinevo/web/src'
const repoRootAbs = A.repoRootAbs || '/Users/gustavoprado/kinevo'
const reportDir = A.reportDir || '/Users/gustavoprado/kinevo/docs/dev-loops'
const BASE = A.base || 'https://www.kinevoapp.com'
// Rotas-chave da landing B2B. Se vazio, o Fetch descobre via sitemap.xml.
const ROUTES = A.routes || ['/']
// Perguntas que o público-alvo faria a uma IA — base do check GEO (answerability).
const TARGET_QUERIES = A.targetQueries || [
  'melhor app para personal trainer gerenciar alunos e treinos no Brasil',
  'sistema para personal com prescrição de treino, financeiro e app do aluno',
  'alternativa a MFIT / Tecnofit / Trainerize',
]

const PAGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['url', 'findings'],
  properties: {
    url: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'kind', 'impact', 'evidence'],
        properties: {
          title: { type: 'string' },
          kind: { type: 'string', enum: ['meta', 'canonical', 'og-twitter', 'jsonld', 'headings', 'robots-sitemap', 'geo-answerability', 'perf-seo'] },
          impact: { type: 'string', enum: ['alto', 'medio', 'baixo'] },
          evidence: { type: 'string', description: 'O que o HTML SSR mostra (ou não): cite a tag/trecho real ou a ausência.' },
          assetToCheck: { type: 'string', description: 'URL a confirmar na Verify (ex.: og:image) — senão vazio.' },
        },
      },
    },
  },
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'kind', 'impact', 'status', 'evidence', 'fixWorthy'],
  properties: {
    title: { type: 'string' },
    kind: { type: 'string' },
    impact: { type: 'string', enum: ['alto', 'medio', 'baixo'] },
    status: {
      type: 'string',
      enum: ['gap_real', 'ja_ok', 'by_design', 'false_positive', 'low_value'],
      description: 'gap_real = falta de verdade e vale corrigir; ja_ok = já presente no HTML/asset (descartar); by_design; false_positive = leitura errada; low_value = real mas irrelevante p/ SEO/GEO.',
    },
    evidence: { type: 'string', description: 'Confirmação contra o HTML/asset real (ex.: og:image retornou 200 e 1200x630, ou 404). Cite também o arquivo de origem em ' + repoRoot + ' quando o fix for no código.' },
    fixPrompt: { type: 'string', description: 'Se fixWorthy: fix pronto citando o arquivo (ex.: app/layout.tsx metadata, opengraph-image.tsx, middleware matcher), terminando em Outcome.' },
    fixWorthy: { type: 'boolean', description: 'true só p/ status=gap_real impacto alto/medio.' },
  },
}

phase('Fetch')
const fetchAgent = await agent(
  `Você coleta o estado de SEO/GEO da landing B2B do Kinevo em ${BASE}.
Use Bash (curl -sL) e/ou WebFetch para baixar o HTML **SSR** (não-renderizado por JS) de: ${JSON.stringify(ROUTES)}.
Baixe também ${BASE}/robots.txt e ${BASE}/sitemap.xml (se existir, liste as URLs dele — pode revelar rotas-chave além de "/").
Para cada rota, EXTRAIA do HTML: <title>, meta description, link canonical, og:* e twitter:*, blocos JSON-LD (@type), <h1>/<h2>, e se o conteúdo textual principal está no HTML SSR (vs injetado por JS).
Devolva um resumo estruturado por rota (não precisa de schema rígido aqui): cole os trechos relevantes do HEAD e a lista de headings/JSON-LD. Marque o que está AUSENTE. Não conclua gaps ainda — só colete o material cru pros auditores.`,
  { label: 'fetch:ssr', phase: 'Fetch' },
)

phase('Audit')
// um auditor por rota (+ um auditor GEO transversal). Barreira leve: poucas rotas.
const auditRoutes = ROUTES.length ? ROUTES : ['/']
const audited = await parallel([
  ...auditRoutes.map((rt) => () => agent(
    `Você é auditor de SEO técnico do Kinevo. Material SSR coletado da landing ${BASE}:
${fetchAgent}

Audite a rota \`${rt}\` SÓ com base no HTML SSR real coletado (se faltou material dela, baixe via curl -sL ${BASE}${rt}). Cheque: title (tamanho/único), meta description, canonical correto/absoluto, og:title/description/image + twitter card, JSON-LD presente e válido (@type Organization/SoftwareApplication/FAQ?), 1 único <h1>, hierarquia de headings, indexabilidade (robots/noindex).
Cada lacuna real vira finding (kind/impact/evidence; assetToCheck=URL do og:image se suspeito). Se a página está sólida, findings vazio.`,
    { label: `audit:${rt}`, phase: 'Audit', schema: PAGE_SCHEMA },
  )),
  // Auditor GEO transversal (answerability)
  () => agent(
    `Você é auditor de GEO (Generative Engine Optimization) do Kinevo. Material SSR coletado:
${fetchAgent}

O público faria a uma IA perguntas como:
${TARGET_QUERIES.map((q) => `- "${q}"`).join('\n')}

Avalie: o CONTEÚDO em HTML SSR (não JS) responde objetivamente a essas perguntas? Há um parágrafo citável que diz o que o Kinevo é, pra quem, e os diferenciais (IA, HealthKit, financeiro, métodos avançados)? Há FAQ/structured data que uma IA extrairia? O conteúdo está no SSR ou só aparece após hidratação (IAs não rodam JS)?
Cada gap de answerability vira finding kind="geo-answerability". Conecte com o trabalho de GEO já feito (domínio canônico, JSON-LD, OG). Se já responde bem, findings vazio.`,
    { label: 'audit:geo', phase: 'Audit', schema: PAGE_SCHEMA },
  ),
])

const gaps = audited.filter(Boolean).flatMap((p) => (p.findings || []).map((f) => ({ ...f, url: p.url })))
log(`Audit: ${gaps.length} gaps candidatos`)

phase('Verify')
const verdicts = (await pipeline(
  gaps,
  (g, _o, i) => agent(
    `Você é o VERIFICADOR de SEO/GEO do Kinevo. Confirme cada gap contra o HTML/asset REAL — nunca por suposição.

Gap candidato:
${JSON.stringify(g, null, 2)}

Material SSR coletado:
${fetchAgent}

Confirme: se o gap é "og:image faltando", faça curl -sLI no assetToCheck e cheque 200 + content-type/imagem (e dimensões se der). Se é "meta X faltando", confirme no HTML que não está lá. Se for corrigível no código, ache o arquivo de origem em ${repoRoot} (app/layout.tsx/metadata, opengraph-image.tsx, robots.ts, sitemap.ts) e cite — ATENÇÃO ao gotcha do middleware matcher: opengraph-image/twitter-image precisam de exclusão no matcher senão 307→/login.
Status: gap_real / ja_ok / by_design / false_positive / low_value.
fixWorthy=true só p/ gap_real impacto alto/medio; aí escreva \`fixPrompt\` citando o arquivo, terminando em Outcome.`,
    { label: `verify:${g.kind}:${i}`, phase: 'Verify', schema: VERIFY_SCHEMA },
  ),
)).filter(Boolean)

phase('Synthesize')
const out = await agent(
  `Você sintetiza o loop de SEO/GEO do Kinevo. ${verdicts.length} gaps JÁ VERIFICADOS contra o HTML/asset real.

DADOS (JSON):
${JSON.stringify(verdicts, null, 2)}

Relatório Markdown:
# Loop de SEO/GEO — ${date}
## Resumo (nº por status; quantos gap_real por impacto; base ${BASE})
## 🔎 Gaps reais (status=gap_real) — tabela: impacto | kind | título | evidência (HTML/asset + arquivo de origem) — ordene alto→baixo
## 🛠️ Prompts de fix prontos — só fixWorthy=true
## 🗑️ Descartados — tabela: título | status (ja_ok/by_design/false_positive/low_value) | motivo (com o que o HTML real mostra)

Regras: NÃO gere fix para ja_ok/by_design/false_positive/low_value. Se a landing está sólida, diga. Conciso.
NÃO use Write. Devolva via \`markdown\`.`,
  {
    label: 'synthesize', phase: 'Synthesize',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['markdown', 'headline'],
      properties: { markdown: { type: 'string' }, headline: { type: 'string' } },
    },
  },
)

return { reportPath: `${reportDir}/REPORT-SEO-GEO-${date}.md`, markdown: out.markdown, headline: out.headline, candidates: gaps.length, verified: verdicts.length }
