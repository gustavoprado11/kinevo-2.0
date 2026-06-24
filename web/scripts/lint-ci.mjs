#!/usr/bin/env node
/**
 * Ratchet de lint — trava dívida NOVA sem exigir limpar a antiga.
 *
 * Roda o eslint do web e compara o nº de ERROS com o BASELINE. Falha se SUBIR
 * (alguém introduziu erro novo). Se CAIR, passa e sugere baixar o baseline.
 *
 * Por que ratchet por CONTAGEM e não por arquivo/linha: há ~559 erros legados
 * espalhados em 161 arquivos — um gate por arquivo deixaria o CI vermelho em
 * quase todo push. A contagem só pode estagnar ou cair → a dívida nunca cresce,
 * e a gente limpa aos poucos baixando o BASELINE.
 */
import { execSync } from 'node:child_process'

// Erros de lint legados (medido em 24/jun/2026). REGRA: só pode CAIR.
const BASELINE = 559

let raw = '[]'
try {
    raw = execSync('npx eslint -f json', {
        cwd: process.cwd(),
        maxBuffer: 64 * 1024 * 1024,
    }).toString()
} catch (e) {
    // eslint sai com código != 0 quando há erros; o JSON ainda vem no stdout.
    raw = (e.stdout && e.stdout.toString()) || '[]'
}

let errors = 0
try {
    for (const r of JSON.parse(raw)) errors += r.errorCount || 0
} catch {
    console.error('lint-ci: não consegui parsear a saída do eslint.')
    process.exit(2)
}

console.log(`Lint: ${errors} erro(s) (baseline ${BASELINE}).`)

if (errors > BASELINE) {
    console.error(
        `\n❌ A dívida de lint AUMENTOU (${errors} > ${BASELINE}).\n` +
            `   Limpe o(s) erro(s) novo(s) que você introduziu. Se for intencional/inevitável,\n` +
            `   ajuste o BASELINE em web/scripts/lint-ci.mjs conscientemente.`,
    )
    process.exit(1)
}

if (errors < BASELINE) {
    console.log(
        `\n✅ Dívida CAIU de ${BASELINE} → ${errors}. Baixe o BASELINE em web/scripts/lint-ci.mjs ` +
            `para travar o ganho (impede regressão futura).`,
    )
}

console.log('✅ Sem dívida de lint nova.')
