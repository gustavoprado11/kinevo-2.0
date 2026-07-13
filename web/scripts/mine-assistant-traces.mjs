#!/usr/bin/env node
/**
 * Minerador de traces do Assistente (P8) — falhas de produção viram evals.
 *
 * Varre assistant_turn_traces e agrupa os SINAIS DE FALHA conhecidos:
 *   - fallback      → turno terminou em "Não consegui concluir…" (perda total)
 *   - build_retry   → tentativa de build falhou ([build-retry i/n] no trace)
 *   - leak          → thinking/JSON vazou como texto (thought / "exercise_id":)
 *   - empty         → turno sem output nenhum
 *   - tool_failed   → alguma tool do turno falhou (ok=false)
 * e imprime a distribuição por PROMPT_VERSION/modelo + amostras de input —
 * cada padrão recorrente é candidato a caso novo em evals/cases.ts.
 *
 * Uso (da pasta web/):
 *   node scripts/mine-assistant-traces.mjs             # últimos 7 dias
 *   node scripts/mine-assistant-traces.mjs 30          # últimos 30 dias
 *   node scripts/mine-assistant-traces.mjs 7 --samples 5
 *
 * Lê NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de web/.env.local.
 * Só leitura; nada é escrito no banco.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const days = Number(process.argv[2]) || 7
const samplesPerBucket = process.argv.includes('--samples')
    ? Number(process.argv[process.argv.indexOf('--samples') + 1]) || 3
    : 3

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
    .select('created_at, trainer_id, surface, model, prompt_version, input, output, tools, input_tokens, output_tokens')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)
if (error) {
    console.error('Erro lendo traces:', error.message)
    process.exit(1)
}

const FALLBACK_RE = /^Não consegui concluir essa ação agora/
const RETRY_RE = /^\[build-retry /
const LEAK_RE = /^\s*thought\b|"exercise_id"\s*:/

function classify(t) {
    const out = t.output ?? ''
    if (RETRY_RE.test(out)) return 'build_retry'
    if (FALLBACK_RE.test(out)) return 'fallback'
    if (LEAK_RE.test(out)) return 'leak'
    if (!out.trim()) return 'empty'
    if ((t.tools ?? []).some((x) => x.ok === false)) return 'tool_failed'
    return null
}

const buckets = new Map()
let turns = 0
const byVersion = new Map()
for (const t of traces ?? []) {
    turns++
    const pv = t.prompt_version ?? '?'
    const v = byVersion.get(pv) ?? { total: 0, failures: 0 }
    v.total++
    const kind = classify(t)
    if (kind) {
        v.failures++
        const b = buckets.get(kind) ?? []
        b.push(t)
        buckets.set(kind, b)
    }
    byVersion.set(pv, v)
}

console.log(`\n═══ Traces do Assistente — últimos ${days} dias (${turns} turnos) ═══\n`)

console.log('Por PROMPT_VERSION (taxa de falha):')
for (const [pv, v] of [...byVersion.entries()].sort()) {
    const rate = v.total ? ((v.failures / v.total) * 100).toFixed(1) : '0'
    console.log(`  ${pv.padEnd(8)} ${String(v.total).padStart(5)} turnos | ${String(v.failures).padStart(4)} falhas (${rate}%)`)
}

if (buckets.size === 0) {
    console.log('\nNenhum sinal de falha no período. 🎯')
    process.exit(0)
}

console.log('\nPadrões de falha:')
for (const [kind, items] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n▌ ${kind} — ${items.length}×`)
    for (const t of items.slice(0, samplesPerBucket)) {
        const toolsStr = (t.tools ?? []).map((x) => `${x.toolName}${x.ok === false ? '!' : ''}`).join('→') || '(sem tools)'
        console.log(`  · ${t.created_at.slice(0, 16)} [${t.model} ${t.prompt_version ?? '?'}] "${(t.input ?? '').slice(0, 70)}"`)
        console.log(`    tools: ${toolsStr}`)
        console.log(`    out:   ${(t.output ?? '').slice(0, 90).replace(/\n/g, ' ')}`)
    }
    if (items.length > samplesPerBucket) console.log(`  … +${items.length - samplesPerBucket}`)
}

console.log('\n→ Padrão recorrente? Vire um caso em web/src/lib/assistant/evals/cases.ts (P8).')
