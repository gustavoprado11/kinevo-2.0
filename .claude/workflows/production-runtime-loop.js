export const meta = {
  name: 'production-runtime-loop',
  description: 'Loop de produção/runtime do Kinevo: coleta telemetria REAL (advisors + logs Supabase, runtime logs Vercel, anomalias de webhook/pagamento), verifica adversarialmente (erro atual? reproduz? é ruído conhecido?) e sintetiza relatório + prompts de fix. Só leitura — não toca código nem dados.',
  whenToUse: 'Periodicamente (noturno ou pós-deploy) para ver o que de fato está quebrando em produção, não o que o código sugere.',
  phases: [
    { title: 'Collect', detail: '1 agente por fonte de sinal: advisors, logs SB, runtime Vercel, SQL de webhooks' },
    { title: 'Verify', detail: '1 agente cético por achado: atual? reproduz? ruído conhecido?' },
    { title: 'Synthesize', detail: 'unifica, prioriza e gera prompts de fix' },
  ],
}

// args: { date, repoRoot, reportDir, supabaseProjectId?, vercel?: {projectId, teamId}, allowlist?: string[] }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const date = A.date || 'sem-data'
const repoRoot = A.repoRoot || '/Users/gustavoprado/kinevo/web/src'
const reportDir = A.reportDir || '/Users/gustavoprado/kinevo/docs/dev-loops'
// Project ref REAL do Kinevo (o MCP local pode apontar pro projeto errado — confirme via list_projects).
const SB = A.supabaseProjectId || 'lylksbtgrihzepbteest'
// Vercel: descubra projectId/teamId em .vercel/project.json (projectId + orgId) se não vier.
const VC = A.vercel || null
// Ground-truth do domínio: ruído ESPERADO que NÃO é falha (passa a verify como by_design/low_value).
const ALLOWLIST = A.allowlist || [
  'POST anônimo em send-push-notification retornando 401 (proteção por x-push-secret — é o comportamento correto)',
  'Avisos de hydration já tratados / intermitentes por Date.now()/Math.random() em libs de terceiros',
  '404 de rotas de probe/scanner externas',
  'Logs de nível info/debug sem erro associado',
]

// Candidatos crus de cada fonte.
const SIGNAL_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'source', 'signal', 'suspectedCodePath'],
        properties: {
          title: { type: 'string', description: 'Resumo curto da falha.' },
          severity: { type: 'string', enum: ['high', 'med', 'low'] },
          source: { type: 'string', enum: ['supabase-advisor', 'supabase-log', 'vercel-runtime', 'webhook-sql'] },
          signal: { type: 'string', description: 'Evidência crua: linha de log / advisor / linha de SQL, com timestamp/contagem quando houver.' },
          frequency: { type: 'string', description: 'Quantas vezes / janela observada (se aplicável).' },
          suspectedCodePath: { type: 'string', description: 'Arquivo/rota/edge que provavelmente emite (palpite — a Verify confirma).' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'verdict', 'severity', 'evidence', 'fixWorthy'],
  properties: {
    title: { type: 'string' },
    severity: { type: 'string', enum: ['high', 'med', 'low'] },
    verdict: {
      type: 'string',
      enum: ['real', 'stale', 'by_design', 'false_positive', 'low_value', 'uncertain'],
      description: 'real = falha atual confirmada; stale = erro antigo/já corrigido (timestamp velho ou código já mudou); by_design = ruído esperado (ver allowlist); false_positive = não procede; low_value = real mas trivial/sem impacto; uncertain = não deu pra concluir.',
    },
    evidence: { type: 'string', description: 'file:line do caminho que emite + nota de reprodução/recência. Cite o timestamp mais recente do sinal.' },
    fixPrompt: { type: 'string', description: 'Se fixWorthy: prompt de fix pronto (descreve a correção, cita arquivo, termina com Outcome). Senão vazio.' },
    fixWorthy: { type: 'boolean', description: 'true só para verdict=real com impacto high/med.' },
  },
}

phase('Collect')
const allowlistTxt = ALLOWLIST.map((a) => `- ${a}`).join('\n')

// 4 fontes em paralelo (barreira: precisamos do conjunto inteiro antes de verificar/dedup).
const sources = await parallel([
  // --- Supabase advisors (segurança + performance) ---
  () => agent(
    `Você coleta sinal de PRODUÇÃO do Kinevo (Supabase project_id = \`${SB}\`).
Use ToolSearch p/ carregar e então chamar \`get_advisors\` DUAS vezes: type "security" e type "performance".
(Se o project_id parecer errado, confirme com \`list_projects\` e use o do Kinevo 2.0.)
Para cada notice relevante, vire um finding: title, severity (high p/ RLS faltando/SECURITY DEFINER exposto; med p/ índice faltando em query quente; low p/ resto), source "supabase-advisor", signal = o texto do advisor + a remediation URL, suspectedCodePath = tabela/função citada. Ignore notices puramente informativos. Sem advisors → findings vazio.`,
    { label: 'collect:advisors', phase: 'Collect', schema: SIGNAL_SCHEMA },
  ),
  // --- Supabase logs (api, postgres, edge, auth) ---
  () => agent(
    `Você coleta sinal de PRODUÇÃO do Kinevo (Supabase project_id = \`${SB}\`).
Use ToolSearch e chame \`get_logs\` para os serviços: "api", "postgres", "edge-function", "auth" (últimas 24h).
Agrupe por ASSINATURA de erro (mensagem normalizada). Para cada cluster com erro/warn real, um finding: title, severity por frequência×gravidade, source "supabase-log", signal = mensagem + timestamp MAIS RECENTE + contagem aproximada, frequency, suspectedCodePath (edge function / query / rota).
NÃO reporte ruído esperado:
${allowlistTxt}
Sem erros reais → findings vazio.`,
    { label: 'collect:sb-logs', phase: 'Collect', schema: SIGNAL_SCHEMA },
  ),
  // --- Vercel runtime logs + deploys recentes ---
  () => agent(
    `Você coleta sinal de PRODUÇÃO do Kinevo na Vercel.
${VC ? `Use projectId="${VC.projectId}" teamId="${VC.teamId}".` : 'Descubra projectId e teamId lendo /Users/gustavoprado/kinevo/.vercel/project.json (campos projectId e orgId=teamId). Se não houver, use list_projects/list_teams.'}
Use ToolSearch e chame \`get_runtime_logs\` com environment="production", level=["error","fatal"], since="24h", limit 100. Cheque também \`list_deployments\` recentes (algum deploy quebrou/rollback?).
Agrupe por assinatura. Cada cluster vira finding: title, severity, source "vercel-runtime", signal = mensagem + statusCode + timestamp recente + requestId se útil, frequency, suspectedCodePath (rota/serverless/edge-middleware).
NÃO reporte ruído esperado:
${allowlistTxt}
Sem erros reais → findings vazio.`,
    { label: 'collect:vercel', phase: 'Collect', schema: SIGNAL_SCHEMA },
  ),
  // --- Anomalias de webhook/pagamento via SQL (somente SELECT) ---
  () => agent(
    `Você audita a saúde de WEBHOOKS/PAGAMENTOS do Kinevo em produção (Supabase project_id = \`${SB}\`).
Use ToolSearch e \`execute_sql\` SOMENTE com SELECT (nunca escreva). Investigue anomalias conhecidas deste sistema:
- contract_events com contract_id NULL (INSERT de contrato sem .select()).
- pagamentos duplicados por paymentId / contract duplicado (lookup .single() que deveria ativar e criou novo).
- webhook_events processados mas com handler que falhou (evento gravado e retry pulado).
- eventos recentes (últimos 7-14 dias) com status de erro.
Descubra os nomes reais das tabelas com \`list_tables\` antes. Cada anomalia com linhas > 0 vira finding: title, severity, source "webhook-sql", signal = a query + contagem + exemplo de linha (sem PII: use ids, não nomes/emails), suspectedCodePath (handler do webhook). Zero anomalias → findings vazio.`,
    { label: 'collect:webhook-sql', phase: 'Collect', schema: SIGNAL_SCHEMA },
  ),
])

const candidates = sources.filter(Boolean).flatMap((s) => s.findings || [])
log(`Collect: ${candidates.length} achados candidatos de ${sources.filter(Boolean).length} fontes`)

phase('Verify')
// pipeline por achado: verifica recência + reproduz + cruza com allowlist + mapeia ao código real.
const verdicts = (await pipeline(
  candidates,
  (c, _orig, i) => agent(
    `Você é o VERIFICADOR do loop de produção do Kinevo. Ceticismo máximo: a maioria do "sinal de prod" é ruído antigo ou esperado. Só deixe passar o que é falha ATUAL e REAL.

Código-fonte em: ${repoRoot}. Use Grep/Glob/Read/Bash p/ ler o código real; use ToolSearch p/ reconsultar logs/SQL se precisar confirmar recência.

Achado candidato (fonte: ${c.source}):
${JSON.stringify(c, null, 2)}

Ruído ESPERADO (qualquer coincidência → by_design/low_value, NÃO real):
${allowlistTxt}

Decida o \`verdict\`:
- **real**: o caminho de código emite isso HOJE (timestamp recente E código atual ainda contém o defeito). Cite file:line e o timestamp mais recente do sinal.
- **stale**: erro antigo OU o código já foi corrigido desde então (leia o código atual e/ou git log do arquivo). Não gere fix.
- **by_design**: bate com a allowlist ou é comportamento intencional.
- **false_positive**: não procede no código / leitura errada do sinal.
- **low_value**: real mas trivial, sem impacto em usuário.
- **uncertain**: não deu pra concluir (diga o que falta).

Defina \`fixWorthy\`=true SÓ se verdict=real e severity high/med, e nesse caso escreva \`fixPrompt\` pronto (descreve a correção, cita arquivo, termina com "Outcome: ..."). Regra de ouro: julgue pelo código ATUAL + recência do sinal, não pela existência do log.`,
    { label: `verify:${c.source}:${i}`, phase: 'Verify', schema: VERDICT_SCHEMA },
  ),
)).filter(Boolean)

phase('Synthesize')
const out = await agent(
  `Você sintetiza o loop de produção/runtime do Kinevo. Recebeu ${verdicts.length} achados JÁ VERIFICADOS contra o código atual e a recência do sinal.

DADOS (JSON):
${JSON.stringify(verdicts, null, 2)}

Monte um relatório Markdown:
# Loop de Produção/Runtime — ${date}
## Resumo (nº por verdict: real/stale/by_design/false_positive/low_value/uncertain; quantos viraram fix)
## 🔴 Falhas reais (verdict=real) — tabela: severidade | título | fonte | evidência (file:line + timestamp) — ordene high→low
## 🛠️ Prompts de fix prontos — só para fixWorthy=true; cada um em bloco de código, terminando em Outcome
## 🟡 Incertos (verdict=uncertain) — o que falta pra concluir (curto)
## 🗑️ Descartados — tabela: título | verdict (stale/by_design/false_positive/low_value) | motivo — prova de que o ruído foi filtrado

Regras: NÃO gere fix para stale/by_design/false_positive/low_value/uncertain. Se não há falha real, diga claramente que produção está limpa nas fontes checadas (bom resultado). Conciso.

NÃO use Write (bloqueado p/ subagente). Devolva tudo via o campo \`markdown\`.`,
  {
    label: 'synthesize', phase: 'Synthesize',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['markdown', 'headline'],
      properties: {
        markdown: { type: 'string' },
        headline: { type: 'string', description: '4-6 linhas: reais x descartados e os top itens.' },
      },
    },
  },
)

return { reportPath: `${reportDir}/REPORT-PRODUCAO-${date}.md`, markdown: out.markdown, headline: out.headline, candidates: candidates.length, verified: verdicts.length }
