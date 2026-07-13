// Teste LIVE (gated por RUN_LIVE_MINER=1) — NÃO roda na suíte normal.
// Lê os programas REAIS do treinador e minera. É só leitura: nada é escrito, e o
// estilo minerado nunca é salvo aqui (na feature ele vira PROPOSTA editável).
//
// Serve para provar o que fixture nenhuma prova: que a query do wrapper casa com o
// schema real e que a análise sobrevive à bagunça dos dados de produção.
//
//   RUN_LIVE_MINER=1 TRAINER_ID=<uuid> npx vitest run src/lib/assistant/style-miner.live
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { mineTrainerStyle } from './style-miner'
import { buildStyleBlock, sanitizeStyle } from './style-block'

const RUN = process.env.RUN_LIVE_MINER === '1'

function env(key: string): string | null {
    try {
        const file = readFileSync(resolve(import.meta.dirname, '../../../.env.local'), 'utf8')
        const m = file.match(new RegExp(`^${key}=(.+)$`, 'm'))
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
    } catch {
        return null
    }
}

describe.skipIf(!RUN)('LIVE — mineração de estilo sobre programas reais', () => {
    it('minera e renderiza o bloco de prompt', async () => {
        const url = env('NEXT_PUBLIC_SUPABASE_URL')
        const key = env('SUPABASE_SERVICE_ROLE_KEY')
        const trainerId = process.env.TRAINER_ID
        expect(url && key && trainerId, 'faltou env/TRAINER_ID').toBeTruthy()

        const admin = createClient(url!, key!, { auth: { persistSession: false } })
        const result = await mineTrainerStyle(admin, trainerId!)

        const block = buildStyleBlock(
            sanitizeStyle(result.style, {
                source: 'mined',
                mined: {
                    programs_analyzed: result.programsAnalyzed,
                    last_mined_at: new Date().toISOString(),
                },
            }),
        )

        // O console do vitest é engolido pelo setup — grava o relatório para inspeção.
        const out = process.env.MINER_OUT
        if (out) {
            writeFileSync(
                out,
                [
                    `programas analisados: ${result.programsAnalyzed}`,
                    `slots respondidos pela mineração: ${result.minedSlots.join(', ') || '(nenhum)'}`,
                    '',
                    '--- estilo minerado (bruto) ---',
                    JSON.stringify(result.style, null, 2),
                    '',
                    '--- bloco que iria no prompt ---',
                    block,
                ].join('\n'),
                'utf8',
            )
        }

        expect(result.programsAnalyzed).toBeGreaterThanOrEqual(0)
    }, 30000)
})
