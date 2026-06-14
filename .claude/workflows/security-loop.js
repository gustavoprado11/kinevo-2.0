export const meta = {
  name: 'security-loop',
  description: 'Loop de segurança do Kinevo: varre RLS/IDOR/auth/segredos/abuso de IA por área em paralelo, verifica adversarialmente (tenta REFUTAR cada vuln lendo a policy/guard real; opção de exploit ao vivo via contas A/B) e sintetiza vulns priorizadas + prompts de fix DESCRITOS (nunca aplicados). Só leitura.',
  whenToUse: 'Periodicamente e após mudanças de DDL/rotas/edge. Detecta regressões de isolamento entre tenants.',
  phases: [
    { title: 'Scan', detail: '1 agente por área: RLS, API/IDOR, edge, segredos/bundle, IA/MCP, deps' },
    { title: 'Verify', detail: '1 agente cético por vuln tenta refutar lendo o código real (+exploit ao vivo opcional)' },
    { title: 'Synthesize', detail: 'vulns por severidade + fix-prompts descritos' },
  ],
}

// args: { date, repoRoot, repoRootAbs, reportDir, supabaseProjectId?, liveProbe?: boolean }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const date = A.date || 'sem-data'
const repoRoot = A.repoRoot || '/Users/gustavoprado/kinevo/web/src'
const repoRootAbs = A.repoRootAbs || '/Users/gustavoprado/kinevo'
const reportDir = A.reportDir || '/Users/gustavoprado/kinevo/docs/dev-loops'
const SB = A.supabaseProjectId || 'lylksbtgrihzepbteest'
const liveProbe = A.liveProbe === true // exploit ao vivo via contas A/B (cria/derruba contas em prod) — OFF por padrão

const VULN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'area', 'evidence', 'exploitScenario'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critico', 'alto', 'medio', 'baixo'] },
          area: { type: 'string', enum: ['rls', 'api-idor', 'edge', 'segredos', 'ia-mcp', 'deps'] },
          evidence: { type: 'string', description: 'file:line + trecho de código que sustenta a suspeita.' },
          exploitScenario: { type: 'string', description: 'Como um atacante exploraria, concreto (qual request, qual id de outro tenant).' },
          liveProbe: { type: 'string', description: 'Se aplicável: como confirmar ao vivo (request A→dados de B). Senão vazio.' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'severity', 'verdict', 'evidence', 'fixWorthy'],
  properties: {
    title: { type: 'string' },
    severity: { type: 'string', enum: ['critico', 'alto', 'medio', 'baixo'] },
    verdict: {
      type: 'string',
      enum: ['confirmado', 'mitigado', 'by_design', 'false_positive', 'uncertain'],
      description: 'confirmado = vuln real (código não protege; ou exploit reproduziu); mitigado = há guard/policy que bloqueia (cite-o); by_design = exposição intencional e aceitável; false_positive = não procede; uncertain = precisa de teste ao vivo.',
    },
    evidence: { type: 'string', description: 'file:line da policy/guard que confirma ou refuta + resultado do probe se houve.' },
    fixPrompt: { type: 'string', description: 'Se fixWorthy: correção DESCRITA (nunca código aplicado), citando arquivo, terminando em Outcome.' },
    fixWorthy: { type: 'boolean', description: 'true só p/ verdict=confirmado severidade critico/alto/medio.' },
  },
}

phase('Scan')
// Checklist-semente = PROMPT-ANALISE-NOTURNA.md §A. Uma área por agente, em paralelo (barreira p/ dedup).
const AREAS = [
  { key: 'rls', prompt: `RLS cross-tenant. Leia as migrations em ${repoRootAbs}/supabase/migrations (políticas por tabela) e use ToolSearch→get_advisors(type security) + execute_sql (SELECT) no project ${SB} pra introspeccionar pg_policies. Para CADA tabela com dado de tenant: a policy realmente impede um trainer de ver dados de OUTRO trainer e um aluno de ver de OUTRO aluno? Procure tabelas sem RLS, policies USING(true), SECURITY DEFINER sem filtro, service_role usado em caminho cliente.` },
  { key: 'api-idor', prompt: `API routes Next (${repoRoot}/app/api/**) e Server Actions: para cada rota/action, há verificação de auth E autorização? IDOR (passar id de outro usuário e ser servido)? mass assignment? validação de input (zod)? rate limiting em endpoints caros/abusáveis?` },
  { key: 'edge', prompt: `Edge functions em ${repoRootAbs}/supabase/functions/**: verify_jwt correto? validação de input? autorização? idempotência? alguma aceita POST anônimo sem secret? (o caso send-push-notification já foi corrigido c/ x-push-secret — confirme que segue protegido).` },
  { key: 'segredos', prompt: `Segredos: chaves hardcoded no código; segredos em app.json/eas.json/.env versionados (cheque git ls-files); NEXT_PUBLIC_* que expõem algo sensível no bundle client. Use Grep no repo ${repoRootAbs}.` },
  { key: 'ia-mcp', prompt: `Superfícies de IA/MCP (${repoRoot}: @anthropic-ai/sdk, AI SDK, route /api/mcp, trainer_api_keys): prompt injection via dado do usuário no contexto; vazamento de dados de OUTRO trainer no contexto do modelo; auth das tools do MCP (bcrypt hash?); custo/abuso sem limite de taxa.` },
  { key: 'deps', prompt: `Dependências: rode \`npm audit --omit=dev\` (ou audit) nos workspaces web/, mobile/, shared/ de ${repoRootAbs} e liste só vulns high/critical com pacote, versão e caminho. Não conserte.` },
]

const scanned = await parallel(AREAS.map((ar) => () => agent(
  `Você é auditor de SEGURANÇA do Kinevo (SaaS B2B multi-tenant; isolamento por trainer/aluno é a propriedade crítica). Foco desta passada: **${ar.key}**.
Código em ${repoRoot} (e repo em ${repoRootAbs}). Use Grep/Glob/Read/Bash e ToolSearch (Supabase MCP) pra LER o real.

${ar.prompt}

Reporte só vulns com evidência concreta (file:line + cenário de exploração). Severidade: critico (vaza/escreve dado de outro tenant; RCE; auth bypass), alto (exposição séria condicionada), medio, baixo. Nada inventado — sem achado, findings vazio.`,
  { label: `scan:${ar.key}`, phase: 'Scan', schema: VULN_SCHEMA },
)))

const vulns = scanned.filter(Boolean).flatMap((s) => s.findings || [])
log(`Scan: ${vulns.length} vulns candidatas em ${scanned.filter(Boolean).length} áreas` + (liveProbe ? ' · liveProbe ON' : ' · liveProbe OFF (verify só por código)'))

phase('Verify')
// pipeline: cada vuln passa por um cético que tenta REFUTAR lendo a policy/guard real.
const verdicts = (await pipeline(
  vulns,
  (v, _o, i) => agent(
    `Você é o VERIFICADOR de segurança do Kinevo. Sua função é tentar **REFUTAR** a vuln — default cético: a maioria das suspeitas tem um guard/policy que o scanner não leu. Só marque \`confirmado\` se o código REALMENTE não protege.

Código em ${repoRoot} (repo ${repoRootAbs}). Use Grep/Read/Bash + ToolSearch (Supabase MCP: get_advisors, execute_sql SELECT) pra ler a policy/guard real.

Vuln candidata (área ${v.area}):
${JSON.stringify(v, null, 2)}

Tente refutar: existe RLS policy, check de auth, validação ou middleware que bloqueia o exploit? Leia-o e cite file:line.
${liveProbe
  ? `EXPLOIT AO VIVO autorizado: se for IDOR/RLS, use Bash p/ rodar ${repoRootAbs}/scripts/qa-loop/lib/qa-account.mjs e criar DUAS contas (A e B), pegue o token de A e tente ler/escrever dado de B via REST do Supabase/API; reporte o HTTP. Ao terminar, FAÇA TEARDOWN das duas contas. confirmado só se o exploit retornar dado de B.`
  : `Exploit ao vivo DESLIGADO: conclua só por leitura de código. Se não der pra ter certeza sem teste ao vivo, marque \`uncertain\` e descreva o probe que faltou.`}

Veredito: confirmado / mitigado (cite o guard) / by_design / false_positive / uncertain.
fixWorthy=true só p/ confirmado severidade critico/alto/medio; aí escreva \`fixPrompt\` DESCRITO (nunca aplique código — fix de segurança é revisado por humano), citando arquivo e terminando em Outcome.`,
    { label: `verify:${v.area}:${i}`, phase: 'Verify', schema: VERDICT_SCHEMA },
  ),
)).filter(Boolean)

phase('Synthesize')
const out = await agent(
  `Você sintetiza o loop de SEGURANÇA do Kinevo. ${verdicts.length} vulns JÁ VERIFICADAS (tentou-se refutar cada uma).

DADOS (JSON):
${JSON.stringify(verdicts, null, 2)}

Relatório Markdown:
# Loop de Segurança — ${date}
## Resumo (nº por verdict; quantas confirmadas por severidade; liveProbe ${liveProbe ? 'ON' : 'OFF'})
## 🔴 Vulns confirmadas (verdict=confirmado) — tabela: severidade | área | título | evidência (file:line) | exploit — ordene critico→baixo
## 🛠️ Prompts de fix (descritos — NÃO aplicar sem revisão) — só fixWorthy=true
## 🟡 Incertos (uncertain) — o probe ao vivo que falta pra concluir
## 🗑️ Refutados — tabela: título | verdict (mitigado/by_design/false_positive) | o guard que protege (file:line)

Regras: NÃO gere fix para mitigado/by_design/false_positive/uncertain. Se nada confirmado, diga que o isolamento se sustentou nas áreas checadas. Conciso.
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

return { reportPath: `${reportDir}/REPORT-SEGURANCA-${date}.md`, markdown: out.markdown, headline: out.headline, candidates: vulns.length, verified: verdicts.length }
