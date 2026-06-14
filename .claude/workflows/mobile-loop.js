export const meta = {
  name: 'mobile-loop',
  description: 'Loop de detecção do app mobile (Expo/React Native) do Kinevo: varre por área (integridade/offline do treino, segurança client-side/gates, performance, correção RN, módulos nativos Watch/HealthKit) em paralelo, verifica adversarialmente contra o código, e sintetiza achados priorizados + prompts de fix. Só leitura.',
  whenToUse: 'Periodicamente e após mudanças no fluxo de treino/sync/Watch. O risco #1 é perda de dados no treino; gates client-side são o #2.',
  phases: [
    { title: 'Scan', detail: '1 agente por área: offline/integridade, security-client, performance, rn-correctness, native' },
    { title: 'Verify', detail: '1 agente cético por achado rastreia o caminho no código' },
    { title: 'Synthesize', detail: 'achados por severidade + fix-prompts' },
  ],
}

// args: { date, mobileRootAbs, repoRootAbs, reportDir, supabaseProjectId? }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const date = A.date || 'sem-data'
const repoRootAbs = A.repoRootAbs || '/Users/gustavoprado/kinevo'
const mobileRoot = A.mobileRootAbs || '/Users/gustavoprado/kinevo/mobile'
const reportDir = A.reportDir || '/Users/gustavoprado/kinevo/docs/dev-loops'
const SB = A.supabaseProjectId || 'lylksbtgrihzepbteest'

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'area', 'evidence', 'impact'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critico', 'alto', 'medio', 'baixo'] },
          area: { type: 'string', enum: ['offline-integridade', 'security-client', 'performance', 'rn-correctness', 'native'] },
          evidence: { type: 'string', description: 'file:line + trecho que sustenta o achado.' },
          impact: { type: 'string', description: 'Impacto CONCRETO no usuário (ex.: perde 3 séries ao matar o app; aluno inadimplente acessa treino).' },
          repro: { type: 'string', description: 'Passos/condição que disparam o bug (se aplicável). Senão vazio.' },
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
      description: 'confirmado = bug real rastreado no código (cite file:line); mitigado = há guard/proteção (cite-o); by_design = intencional/aceitável; false_positive = não procede; uncertain = precisa de teste em device/sim.',
    },
    evidence: { type: 'string', description: 'file:line do caminho de código que confirma ou refuta.' },
    fixPrompt: { type: 'string', description: 'Se fixWorthy: correção descrita citando arquivo, terminando em Outcome.' },
    fixWorthy: { type: 'boolean', description: 'true só p/ verdict=confirmado severidade critico/alto/medio.' },
  },
}

phase('Scan')
// Áreas tunadas pro RN. Risco #1 = perda de dados no treino; #2 = gate client-side.
const AREAS = [
  { key: 'offline-integridade', prompt: `INTEGRIDADE E OFFLINE DO TREINO (risco #1 do produto). Rastreie o fluxo de execução de treino por inteiro: hooks/useWorkoutSession.ts, hooks/useTrainerWorkoutSession.ts, lib/workoutStatePersistence.ts (MMKV), lib/pendingSetLogQueue.ts (fila offline), lib/hydrateWorkoutSets.ts, lib/persistWatchSetLog.ts, lib/finishWorkoutFromWatch.ts, app/workout/**, app/training-room.tsx. Procure: PERDA DE DADOS ao matar/crashar o app no meio do treino; séries digitadas que não persistem; descartar treino que não apaga set_logs; fila offline que não dreina, duplica ou ressuscita séries; corrida Watch×celular (quem ganha ao marcar/finalizar nos dois lados); finish que não chega ao banco sem rede. Para cada risco, rastreie o caminho REAL (não especule) com file:line e o cenário que dispara.` },
  { key: 'security-client', prompt: `SEGURANÇA CLIENT-SIDE. (1) Gate de inadimplência: app/trainer-subscription-blocked.tsx, app/payment.tsx, e onde o acesso do aluno/treinador é barrado — a decisão é só no cliente (contornável) ou há backstop no servidor/RLS? (2) Armazenamento de token/sessão: lib/supabase.ts, uso de SecureStore/Keychain/MMKV pra tokens — token em storage inseguro? (3) Deep links / app/_layout.tsx routing — deep link pula auth? (4) Segredos no bundle: app.json/eas.json/app.config, chaves embutidas (anon key é ok; service_role NUNCA deve estar no app). (5) Autorização decidida no cliente que deveria ser server-side. file:line + cenário.` },
  { key: 'performance', prompt: `PERFORMANCE RN. Listas longas com .map em vez de FlatList/FlashList (app/exercises, histórico, alunos); re-renders desnecessários; imagens não otimizadas; trabalho pesado na main thread; startup lento (app/_layout.tsx, providers); bundles/deps pesadas. Reanimated/gesture-handler usados corretamente? Cite file:line e o impacto (trava ao rolar, jank, etc.).` },
  { key: 'rn-correctness', prompt: `CORREÇÃO RN. Bugs específicos de React Native: cleanup de listeners/subscriptions em useEffect (NetInfo, AppState, WatchConnectivity, Realtime) — vazam? deps de useEffect erradas (stale closure, loops); unhandled promise rejection; ausência de error boundary nas telas críticas; crashes por acesso a undefined; Pressable com style-função + objeto inline que não pinta / flex direto no Pressable (gotchas conhecidos do projeto); texto que some com flex:1 dentro de Animated.View; bottom sheet (gorhom) que não rola. file:line.` },
  { key: 'native', prompt: `MÓDULOS NATIVOS. Apple Watch (targets/watch-app/**, hooks/useWatchConnectivity.ts, modules/watch-connectivity, lib/getProgramSnapshotForWatch.ts, lib/finishWorkoutFromWatch.ts): WCSession lifecycle, perda de FINISH, relay morto, integridade duplo-lado. HealthKit/Health Connect (hooks/useHealthKitSync.ts, hooks/useHealthConnectSync.ts, lib/healthSync*, lib/healthSyncTask.ts): permissões negadas degradam bem? background fetch confiável? privacidade do que é coletado. Push/notificações: confiabilidade, permissões. file:line + cenário.` },
]

const scanned = await parallel(AREAS.map((ar) => () => agent(
  `Você é auditor do app MOBILE (Expo/React Native, expo-router) do Kinevo — app do aluno (executa treino, HealthKit, Watch) e do treinador. Foco desta passada: **${ar.key}**.
Código mobile em ${mobileRoot} (repo em ${repoRootAbs}). Use Grep/Glob/Read/Bash pra LER o código real. Pode rodar \`npx tsc --noEmit\` e \`npm run test\` dentro de ${mobileRoot} pra checar o estado, e ToolSearch (Supabase MCP, project ${SB}) se precisar conferir schema/RLS que o app depende.

${ar.prompt}

Reporte só achados com evidência concreta (file:line + impacto no usuário). Severidade: critico (perda de dados do treino; aluno acessa sem pagar; crash no fluxo principal), alto, medio, baixo. NÃO invente — sem achado, findings vazio. Lembre: o app é o produto mais crítico; a tela de execução de treino é sagrada.`,
  { label: `scan:${ar.key}`, phase: 'Scan', schema: FINDINGS_SCHEMA },
)))

const found = scanned.filter(Boolean).flatMap((s) => s.findings || [])
log(`Scan: ${found.length} achados candidatos em ${scanned.filter(Boolean).length} áreas`)

phase('Verify')
const verdicts = (await pipeline(
  found,
  (f, _o, i) => agent(
    `Você é o VERIFICADOR do loop mobile do Kinevo. Ceticismo: rastreie o caminho de código de ponta a ponta antes de confirmar; muita suspeita tem um guard/persistência que o scanner não leu. Distinga "confirmado por leitura do código" de "hipótese que precisa de teste em device/sim".

Código mobile em ${mobileRoot} (repo ${repoRootAbs}). Use Grep/Read/Bash + ToolSearch (Supabase MCP) pra ler o real.

Achado candidato (área ${f.area}):
${JSON.stringify(f, null, 2)}

Rastreie e dê o veredito:
- **confirmado**: o bug existe no código (cite file:line do caminho completo). Pra perda de dados, mostre ONDE o estado se perde.
- **mitigado**: há persistência/guard/backstop que evita (ex.: MMKV restaura; RLS barra no servidor; fila dreina no reconnect). Cite o mecanismo (file:line).
- **by_design**: comportamento intencional/aceitável.
- **false_positive**: não procede.
- **uncertain**: só dá pra concluir testando em device/sim — diga qual teste.

fixWorthy=true só p/ confirmado severidade critico/alto/medio; aí escreva fixPrompt citando arquivo e terminando em Outcome. Julgue pelo código, não pela suspeita.`,
    { label: `verify:${f.area}:${i}`, phase: 'Verify', schema: VERDICT_SCHEMA },
  ),
)).filter(Boolean)

phase('Synthesize')
const out = await agent(
  `Você sintetiza o loop mobile do Kinevo. ${verdicts.length} achados JÁ VERIFICADOS contra o código.

DADOS (JSON):
${JSON.stringify(verdicts, null, 2)}

Relatório Markdown:
# Loop Mobile (Expo/RN) — ${date}
## Resumo (nº por verdict; confirmados por severidade; quantos viraram fix; nota: deploy mobile é via build EAS, não automático)
## 🔴 Achados confirmados (verdict=confirmado) — tabela: severidade | área | título | evidência (file:line) | impacto — ordene critico→baixo
## 🛠️ Prompts de fix prontos — só fixWorthy=true
## 🟡 Incertos (uncertain) — o teste em device/sim que falta pra concluir (curto)
## 🗑️ Refutados — tabela: título | verdict (mitigado/by_design/false_positive) | mecanismo que protege (file:line)

Regras: NÃO gere fix para mitigado/by_design/false_positive/uncertain. Se nada confirmado numa área, diga. Conciso.
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

return { reportPath: `${reportDir}/REPORT-MOBILE-${date}.md`, markdown: out.markdown, headline: out.headline, candidates: found.length, verified: verdicts.length }
