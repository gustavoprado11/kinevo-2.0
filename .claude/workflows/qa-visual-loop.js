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
            enum: ['absent', 'already_exists', 'partial', 'low_value'],
            description: 'absent = não existe e VALE fazer; already_exists = já implementado (descartar); partial = existe parcialmente; low_value = não existe mas é clichê/cosmético sem ganho real (descartar).',
          },
          evidence: { type: 'string', description: 'Citação file:line.' },
        },
      },
    },
  },
}

phase('Analyze')
const routes = (manifest.routes || []).filter((r) => (r.shots && r.shots.length) || r.shot)

// pipeline: cada tela é analisada por visão e, assim que sai, verificada contra o
// código — sem barreira entre as fases (tela B é verificada enquanto C ainda analisa).
const verified = await pipeline(
  routes,
  // -- Stage 1: análise por visão (sem acesso ao repo, só as imagens + intent) --
  (r) => {
    const shots = (r.shots && r.shots.length ? r.shots : [r.shot]).filter(Boolean)
    const shotsList = shots.map((s, i) => `  ${i + 1}. ${s}${i === 0 ? '  (topo / above-the-fold)' : ''}`).join('\n')
    return agent(
      `Você é revisor de QA visual + qualidade de produto do **Kinevo** (SaaS B2B para personal trainers, UI em português).
Tela: rota \`${r.path}\` ("${r.key}"). HTTP ${r.status}.

O QUE ESTA TELA É (ground-truth — use pra NÃO reportar design intencional como bug nem sugerir o que já é proposital):
${r.intent || '(sem intent registrado)'}

Console errors capturados nesta rota: ${r.errors && r.errors.length ? JSON.stringify(r.errors) : 'nenhum'}

A tela foi capturada em ${shots.length} segmento(s) rolado(s) — a página INTEIRA, não só a dobra. Use Read em CADA imagem antes de concluir:
${shotsList}

Identifique, SEM INVENTAR (tela sem problema → arrays vazios; é esperado e correto retornar vazio):

1. REGRESSIONS — quebras de verdade que ATRAPALHAM o uso: layout sobreposto, texto cortado, imagem quebrada, string crua/não traduzida, contraste ilegível, elemento fora do lugar, empty-state que parece erro de fato.
   - Se houver console error acima, CADA um é uma regressão candidata (severity ≥ med) — ex.: hydration mismatch é bug real mesmo sem sintoma visual.
   - NÃO conte como regressão nada coberto pelo ground-truth acima (ex.: KPI em 0, grade começando 05h, preview vazio sem slug).

2. IMPROVEMENTS — só melhorias que passem a BARRA DE VALOR: corrigem uma falha real de compreensão/uso ou destravam uma ação. Cada uma precisa de um "porquê" concreto ligado ao que se vê.
   - NÃO sugira clichê de baixo valor: "adicione tooltip/helper text/microcopy/dirty-state/subtítulo" só porque cabe. Se a tela já comunica, NÃO sugira.
   - Prefira 2 melhorias que importam a 10 cosméticas.

Severidade/impacto realistas: \`high\` só para algo que de fato impede o uso; \`low\` é exceção, não regra.`,
      { label: `analyze:${r.key}`, phase: 'Analyze', schema: FINDINGS_SCHEMA },
    ).then((f) => ({ key: r.key, path: r.path, intent: r.intent || '', status: r.status, consoleErrors: r.errors || [], ...f }))
  },
  // -- Stage 2: verificação contra o código (agente com Grep/Read/Bash no repo) --
  (analysis, r) => {
    if (!analysis || (!analysis.regressions?.length && !analysis.improvements?.length)) return analysis
    return agent(
      `Você é o VERIFICADOR do loop de QA do Kinevo. Sua função é ser cético e **matar ruído** (falso-positivo E sugestão de baixo valor) antes que vire trabalho inútil.

Código-fonte do app em: ${repoRoot}
A tela analisada é a rota \`${r.path}\` (key "${r.key}"). Páginas ficam em \`app/<rota>/page.tsx\` e \`app/<rota>/*-client.tsx\`; componentes em \`components/<domínio>/\`. Use Grep/Glob/Read/Bash para achar e LER o código real.

O QUE A TELA É (intenção/by-design — qualquer achado coberto por isto é by_design/low_value, não bug):
${r.intent || '(sem intent registrado)'}

Achados da análise visual (JSON):
${JSON.stringify({ regressions: analysis.regressions, improvements: analysis.improvements }, null, 2)}

Para CADA regressão, leia o código relevante e dê um \`verdict\`:
- **real**: o bug existe no código (cite file:line). Console error (ex.: hydration mismatch) confirmado no código = real.
- **false_positive**: artefato do harness (screenshot que cortou scroll, leitura errada) ou não procede no código.
- **by_design**: comportamento intencional (cobre o intent acima; redirect; exclusão de perfil de auto-treino \`is_trainer_profile\`; empty-state proposital).
- **uncertain**: não foi possível concluir.

Para CADA melhoria, leia o código e marque \`status\`:
- **already_exists**: já implementado (cite file:line). Ex.: pediram "adicionar busca" e já há \`<input placeholder="Buscar...">\`.
- **partial**: existe parcialmente.
- **absent**: NÃO existe E VALE fazer — só marque assim se a melhoria corrige uma falha real de uso/compreensão.
- **low_value**: não existe, mas é clichê cosmético (tooltip/helper/microcopy/dirty-state/contraste sutil) sem ganho real de uso — DESCARTE. Na dúvida entre absent e low_value para item \`low\`, escolha low_value.

Sempre cite file:line. Regra de ouro: julgue pelo CÓDIGO, não pela screenshot. Seja rigoroso — é melhor um relatório curto e confiável que uma lista longa de cosmético.`,
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
## Resumo (telas analisadas; nº de regressões REAL/by_design/false_positive; nº de melhorias que valem [absent/partial] vs descartadas [already_exists/low_value])
## ✅ Regressões confirmadas (verdict=real) — tabela: tela | severidade | o quê | evidência (file:line). Ordene por severidade (high→low).
## 💡 Melhorias que valem (status=absent ou partial) — tabela: tela | impacto | o quê | porquê. Ordene por impacto (high→low).
## 🛠️ Prompts de fix prontos — APENAS para: regressões \`real\` + melhorias \`absent\`/\`partial\` com impacto \`high\` ou \`med\`. Cada um em bloco de código, uma frase de outcome citando a rota.
## 🗑️ Descartados na verificação — tabela: item | veredito (by_design/false_positive/already_exists/low_value) | motivo (com file:line) — prova de que o ruído foi filtrado.

Regras:
- NÃO gere prompt de fix para itens by_design/false_positive/already_exists/low_value.
- Itens \`absent\`/\`partial\` de impacto \`low\` entram só na tabela "Melhorias que valem" (sem prompt), para não inflar a lista de ação.
- Se uma tela não tem nada real nem absent/partial, NÃO invente — é um bom resultado.
- Seja conciso nas tabelas.

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
