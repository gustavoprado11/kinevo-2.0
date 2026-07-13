#!/usr/bin/env node
/**
 * Análise de custo do modelo do Assistente — dados MEDIDOS de produção.
 *
 * Alimenta o comando /analise-custo-modelo (.claude/commands/). Lê as tabelas
 * assistant_turn_traces e ai_usage_events e imprime, para a janela pedida:
 *   1. Agregado por modelo: turnos, input/cached/output, CACHE HIT %, passos,
 *      custo médio e total (cache e steps medidos desde a migr 250, 13/jul).
 *   2. Turnos de BUILD individuais (qualquer turno com create_*_program ou
 *      modelo ≠ conversa): a unidade de análise de custo.
 *   3. Regressão de buscas seriais: turnos com >2 kinevo_list_exercises usando
 *      `search` unitário (o padrão que o searches[] em lote substituiu).
 *   4. Retries de build ([build-retry…]) com o custo da tentativa falha.
 *   5. Turnos perdidos (fallback "Não consegui concluir…").
 *   6. Economia de créditos: custo total vs créditos consumidos → R$/crédito.
 *
 * Uso (da pasta web/):
 *   node scripts/analyze-model-cost.mjs            # últimos 30 dias
 *   node scripts/analyze-model-cost.mjs 7          # últimos 7 dias
 *   node scripts/analyze-model-cost.mjs 30 --fx 5.50
 *
 * Lê NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de web/.env.local.
 * Só leitura; nada é escrito no banco.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const days = Number(process.argv[2]) || 30
const fxIdx = process.argv.indexOf('--fx')
const FX = fxIdx > -1 ? Number(process.argv[fxIdx + 1]) || 5.5 : 5.5

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local')
const env = Object.fromEntries(
    readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => {
            const i = l.indexOf('=')
            return [l.slice(0, i), l.slice(i + 1).trim()]
        }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

const { data: traces, error } = await sb
    .from('assistant_turn_traces')
    .select('created_at, kind, model, surface, input, output, tools, credits, input_tokens, cached_input_tokens, output_tokens, cost_usd_micros, steps')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)
if (error) {
    console.error('Erro lendo traces:', error.message)
    process.exit(1)
}

const usd = (micros) => (micros ?? 0) / 1e6
const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('pt-BR'))
const pct = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '—')
const p50 = (arr) => {
    if (arr.length === 0) return null
    const s = [...arr].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
}

const isRetry = (t) => /^\[build-retry /.test(t.output ?? '')
const isLost = (t) => /^Não consegui concluir essa ação agora/.test(t.output ?? '')
const toolsOf = (t) => (Array.isArray(t.tools) ? t.tools : [])
const isBuild = (t) =>
    toolsOf(t).some((c) => c.toolName === 'kinevo_create_student_draft_program' || c.toolName === 'kinevo_create_program_template')

const metered = traces.filter((t) => t.input_tokens != null && !isRetry(t))

console.log(`═══ ANÁLISE DE CUSTO DO MODELO — últimos ${days} dias (${traces.length} traces, câmbio R$${FX.toFixed(2)}) ═══`)

// 1. Agregado por modelo
console.log('\n── 1. Agregado por modelo (turnos com tokens medidos) ──')
const byModel = new Map()
for (const t of metered) {
    const key = t.model ?? '?'
    if (!byModel.has(key)) byModel.set(key, [])
    byModel.get(key).push(t)
}
for (const [model, ts] of [...byModel.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const inputs = ts.map((t) => t.input_tokens)
    const withCache = ts.filter((t) => t.cached_input_tokens != null)
    const cacheIn = withCache.reduce((s, t) => s + t.input_tokens, 0)
    const cacheHit = withCache.reduce((s, t) => s + t.cached_input_tokens, 0)
    const stepsArr = ts.filter((t) => t.steps != null).map((t) => t.steps)
    const cost = ts.reduce((s, t) => s + usd(t.cost_usd_micros), 0)
    console.log(
        `  ${model}: ${ts.length} turnos · input méd ${fmt(inputs.reduce((a, b) => a + b, 0) / ts.length)} (p50 ${fmt(p50(inputs))})` +
            ` · cache hit ${pct(cacheHit, cacheIn)} (${withCache.length} medidos)` +
            ` · passos méd ${stepsArr.length ? (stepsArr.reduce((a, b) => a + b, 0) / stepsArr.length).toFixed(1) : '—'}` +
            ` · custo méd $${(cost / ts.length).toFixed(4)} · total $${cost.toFixed(2)}`,
    )
}

// 2. Builds individuais
console.log('\n── 2. Turnos de BUILD (create executado) ──')
const builds = metered.filter(isBuild)
for (const t of builds) {
    const lists = toolsOf(t).filter((c) => c.toolName === 'kinevo_list_exercises').length
    const cached = t.cached_input_tokens
    console.log(
        `  ${t.created_at.slice(0, 10)} ${t.model} · in ${fmt(t.input_tokens)}${cached != null ? ` (cache ${pct(cached, t.input_tokens)})` : ' (cache não medido)'}` +
            ` · out ${fmt(t.output_tokens)} · ${t.steps ?? '—'} passos · ${toolsOf(t).length} tools (${lists} list_exercises) · $${usd(t.cost_usd_micros).toFixed(3)}`,
    )
}
if (builds.length === 0) console.log('  (nenhum build na janela)')
const buildCosts = builds.map((t) => usd(t.cost_usd_micros))
if (builds.length > 0) {
    console.log(`  → custo/build: méd $${(buildCosts.reduce((a, b) => a + b, 0) / builds.length).toFixed(3)} · p50 $${p50(buildCosts).toFixed(3)} · máx $${Math.max(...buildCosts).toFixed(3)}`)
}

// 3. Regressão: buscas seriais
console.log('\n── 3. Buscas seriais (>2 list_exercises com `search` unitário no turno) ──')
console.log('  (searches[] em lote foi deployado 13/jul/2026 ~20h UTC: ocorrências ANTERIORES são a baseline; POSTERIORES são regressão)')
const BATCH_SEARCH_DEPLOY = '2026-07-13T20:00'
let serialAfterDeploy = 0
for (const t of metered) {
    const serial = toolsOf(t).filter((c) => c.toolName === 'kinevo_list_exercises' && c.args && 'search' in c.args && !('searches' in c.args))
    if (serial.length > 2) {
        const regression = t.created_at.slice(0, 16) >= BATCH_SEARCH_DEPLOY
        if (regression) serialAfterDeploy++
        console.log(`  ${regression ? '⚠️ REGRESSÃO' : '· baseline '} ${t.created_at.slice(0, 16)} ${t.model}: ${serial.length} buscas seriais`)
    }
}
console.log(serialAfterDeploy === 0 ? '  ✅ nenhuma regressão pós-deploy (o searches[] em lote está segurando)' : `  → ${serialAfterDeploy} turnos em regressão`)

// 4. Retries
console.log('\n── 4. Retries de build (tentativas falhas — custo cobrado pelo provider) ──')
const retries = traces.filter(isRetry)
for (const t of retries) {
    console.log(`  ${t.created_at.slice(0, 16)} ${t.model} · $${usd(t.cost_usd_micros).toFixed(3)} (in ${fmt(t.input_tokens)}) · ${String(t.output).slice(0, 90)}`)
}
console.log(retries.length === 0 ? '  ✅ nenhum' : `  → ${retries.length} retries, $${retries.reduce((s, t) => s + usd(t.cost_usd_micros), 0).toFixed(3)} de custo extra`)

// 5. Turnos perdidos
const lost = traces.filter(isLost)
console.log(`\n── 5. Turnos perdidos (fallback): ${lost.length} ──`)
for (const t of lost) console.log(`  ${t.created_at.slice(0, 16)} ${t.model} · $${usd(t.cost_usd_micros).toFixed(3)} · "${String(t.input).slice(0, 70)}"`)

// 6. Economia de créditos (ai_usage_events é a fonte do billing)
const { data: events } = await sb
    .from('ai_usage_events')
    .select('credits, cost_usd_micros, action_class')
    .gte('created_at', since)
    .limit(20000)
const totCredits = (events ?? []).reduce((s, e) => s + (e.credits ?? 0), 0)
const totCost = (events ?? []).reduce((s, e) => s + usd(e.cost_usd_micros), 0)
console.log('\n── 6. Economia de créditos (janela inteira, todas as superfícies) ──')
console.log(`  ${totCredits} créditos consumidos · COGS $${totCost.toFixed(2)} → R$ ${((totCost * FX) / Math.max(1, totCredits)).toFixed(3)}/crédito`)
console.log('  Compare com a receita/crédito dos planos em web/src/lib/billing/tiers.ts (peso do build em tool-policy.ts).')
console.log('\nBaseline histórica: docs/analise-custo-modelo-ponta-2026-07-13-peer-review.md ($0,51/build pré-correções; cache hit 80% medido no 1º E2E pós-migr-250).')
