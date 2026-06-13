export const meta = {
  name: 'qa-visual-loop',
  description: 'QA visual + crítico de melhoria do Kinevo web: analisa screenshots, VERIFICA cada achado contra o código (mata falso-positivo), e sintetiza relatório + prompts de fix',
  whenToUse: 'Após rodar scripts/qa-loop/capture.sh, para analisar as telas e gerar um relatório já verificado.',
  phases: [
    { title: 'Analyze', detail: 'um agente de visão por tela: regressões + melhorias' },
    { title: 'Verify', detail: 'um agente por tela adjudica os achados contra o código-fonte' },
    { title: 'Synthesize', detail: 'separa confirmados de descartados, gera relatório + prompts' },
  ],
}

// args: { manifest, date, reportDir, repoRoot }
//   manifest = conteúdo de scripts/qa-loop/shots/manifest.json (routes[].shot = path PNG absoluto)
//   date     = string YYYY-MM-DD (Date.now() não existe em workflow scripts)
//   reportDir= dir absoluto do relatório · repoRoot = raiz do código (ex.: .../web/src)
const A = typeof args === 'string' ? JSON.parse(args) : args
const { manifest, date, reportDir, repoRoot } = A

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['regressions', 'improvements'],
  properties: {
    regressions: {
      type: 'array',
      description: 'Quebras visíveis: layout sobreposto, texto cortado, imagem quebrada, string não traduzida, contraste ruim, empty-state que parece erro, elemento fora do lugar.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'evidence'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'med', 'low'] },
          evidence: { type: 'string', description: 'O que se vê na tela.' },
        },
      },
    },
    improvements: {
      type: 'array',
      description: 'Melhorias concretas de UX/clareza/visual, ancoradas no que está na tela.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'impact', 'rationale'],
        properties: {
          title: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'med', 'low'] },
          rationale: { type: 'string' },
        },
      },
    },
  },
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['regressions', 'improvements'],
  properties: {
    regressions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'verdict', 'evidence'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'med', 'low'] },
          verdict: {
            type: 'string',
            enum: ['real', 'false_positive', 'by_design', 'uncertain'],
            description: 'real = bug confirmado no código; false_positive = artefato/leitura errada; by_design = comportamento intencional; uncertain = não deu pra concluir.',
          },
          evidence: { type: 'string', description: 'Citação file:line que sustenta o veredito.' },
        },
      },
    },
    improvements: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'impact', 'status', 'evidence'],
        properties: {
          title: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'med', 'low'] },
          status: {
            type: 'string',
            enum: ['absent', 'already_exists', 'partial'],
            description: 'absent = não existe no código (vale fazer); already_exists = já implementado (descartar); partial = existe parcialmente.',
          },
          evidence: { type: 'string', description: 'Citação file:line.' },
        },
      },
    },
  },
}

phase('Analyze')
const routes = (manifest.routes || []).filter((r) => r.shot)

// pipeline: cada tela é analisada por visão e, assim que sai, verificada contra o
// código — sem barreira entre as fases (tela B é verificada enquanto C ainda analisa).
const verified = await pipeline(
  routes,
  // -- Stage 1: análise por visão (sem acesso ao repo, só a imagem) --
  (r) =>
    agent(
      `Você é revisor de QA visual + qualidade de produto do **Kinevo** (SaaS B2B para personal trainers, UI em português).
Analise a screenshot (above-the-fold) da rota \`${r.path}\` (tela "${r.key}").
Contexto: HTTP ${r.status} · console: ${r.errors && r.errors.length ? JSON.stringify(r.errors) : 'sem erros'}.
Use Read na imagem: ${r.shot}

Identifique, SEM INVENTAR (tela ok → arrays vazios):
1. REGRESSIONS — quebras visíveis (layout sobreposto, texto cortado, imagem quebrada, string crua, contraste ruim, empty-state que parece erro, desalinhamento).
2. IMPROVEMENTS — melhorias concretas de UX/clareza/copy ancoradas no que se vê.
Severidade/impacto realistas (high só para algo que atrapalha o uso de verdade).`,
      { label: `analyze:${r.key}`, phase: 'Analyze', schema: FINDINGS_SCHEMA },
    ).then((f) => ({ key: r.key, path: r.path, status: r.status, consoleErrors: r.errors || [], ...f })),
  // -- Stage 2: verificação contra o código (agente com Grep/Read/Bash no repo) --
  (analysis, r) => {
    if (!analysis || (!analysis.regressions?.length && !analysis.improvements?.length)) return analysis
    return agent(
      `Você é o VERIFICADOR do loop de QA do Kinevo. Sua função é ser cético e **matar falso-positivo** antes que vire ruído.

Código-fonte do app em: ${repoRoot}
A tela analisada é a rota \`${r.path}\` (key "${r.key}"). Páginas ficam em \`app/<rota>/page.tsx\` e \`app/<rota>/*-client.tsx\`; componentes em \`components/<domínio>/\`. Use Grep/Glob/Read/Bash para achar e LER o código real.

Achados da análise visual (JSON):
${JSON.stringify({ regressions: analysis.regressions, improvements: analysis.improvements }, null, 2)}

Para CADA regressão, leia o código relevante e dê um \`verdict\`:
- **real**: o bug existe no código (cite file:line).
- **false_positive**: artefato do harness (ex.: screenshot que cortou scroll, leitura errada) ou simplesmente não procede no código.
- **by_design**: comportamento intencional (ex.: rota que faz redirect; coluna que exclui perfil de auto-treino \`is_trainer_profile\`; empty-state proposital).
- **uncertain**: não foi possível concluir.

Para CADA melhoria, verifique se ela JÁ EXISTE no código e marque \`status\`: absent / already_exists / partial (cite file:line). Ex.: se sugerirem "adicionar busca" mas já há \`<input placeholder="Buscar...">\`, é already_exists.

Sempre cite file:line na evidência. Na dúvida entre real e false_positive, prefira marcar conforme o que o código mostra, não conforme a screenshot.`,
      { label: `verify:${r.key}`, phase: 'Verify', schema: VERIFY_SCHEMA },
    ).then((v) => ({ ...analysis, regressions: v.regressions, improvements: v.improvements }))
  },
)

const results = verified.filter(Boolean)

phase('Synthesize')
const out = await agent(
  `Você é o sintetizador do loop de QA visual do Kinevo. Recebeu, para ${results.length} telas, os achados JÁ VERIFICADOS contra o código.

DADOS (JSON):
${JSON.stringify(results, null, 2)}

Monte um relatório em Markdown com esta estrutura:
# QA Visual Loop — ${date}
## Resumo (telas analisadas; nº de regressões REAL/by_design/false_positive; nº de melhorias absent/already_exists)
## ✅ Regressões confirmadas (verdict=real) — tabela: tela | severidade | o quê | evidência (file:line)
## 💡 Melhorias que valem (status=absent ou partial) — tabela: tela | impacto | o quê | porquê
## 🛠️ Prompts de fix prontos — só para os itens confirmados/que valem; cada um em bloco de código, uma frase de outcome citando a rota
## 🗑️ Descartados na verificação — tabela: item | veredito (by_design/false_positive/already_exists) | motivo (com file:line) — para dar confiança de que o ruído foi filtrado

Regras: NÃO gere prompt de fix para itens by_design/false_positive/already_exists. Seja conciso nas tabelas.

NÃO use a ferramenta Write (ela é bloqueada para subagentes). Devolva o relatório completo via o campo \`markdown\` do schema.`,
  {
    label: 'synthesize',
    phase: 'Synthesize',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['markdown', 'headline'],
      properties: {
        markdown: { type: 'string', description: 'O relatório completo em Markdown.' },
        headline: { type: 'string', description: 'Resumo de 4-6 linhas: confirmados x descartados e os top itens.' },
      },
    },
  },
)

return { reportPath: `${reportDir}/REPORT-${date}.md`, markdown: out.markdown, headline: out.headline, analyzedRoutes: results.length }
