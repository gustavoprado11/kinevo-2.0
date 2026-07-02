/**
 * Onda 6 — helpers puros do modo voz (o loop de STT/TTS é browser-only;
 * aqui garantimos o que dá para garantir em node: a fala nunca lê markdown).
 */
import { describe, it, expect } from 'vitest'
import { sanitizeForSpeech, CONFIRMATION_SPEECH, extractCompleteSentences } from '../use-voice-mode'

describe('sanitizeForSpeech', () => {
    it('remove markdown que o TTS leria mal', () => {
        expect(sanitizeForSpeech('**3 alunos** ativos: *João*, `Maria` e ~Pedro~')).toBe(
            '3 alunos ativos: João, Maria e Pedro',
        )
    })

    it('links viram o rótulo; URLs cruas viram "link"', () => {
        expect(sanitizeForSpeech('Veja [o programa](https://kinevoapp.com/p/1).')).toBe('Veja o programa.')
        expect(sanitizeForSpeech('Acesse https://kinevoapp.com/checkout agora')).toBe('Acesse link agora')
    })

    it('blocos de código somem e espaços colapsam', () => {
        expect(sanitizeForSpeech('Antes\n```js\nconst x = 1\n```\nDepois')).toBe('Antes Depois')
        expect(sanitizeForSpeech('  muito \n\n espaço  ')).toBe('muito espaço')
    })

    it('texto já falável passa intacto', () => {
        const s = 'Você tem 3 alunos ativos. Quer que eu detalhe algum?'
        expect(sanitizeForSpeech(s)).toBe(s)
    })

    it('frase de confirmação HITL existe e é falável', () => {
        expect(CONFIRMATION_SPEECH).toBe(sanitizeForSpeech(CONFIRMATION_SPEECH))
    })
})

describe('extractCompleteSentences — fala em streaming', () => {
    it('fatia só frases completas e devolve o consumido', () => {
        const { sentences, consumed } = extractCompleteSentences('Você tem 3 alunos. O mais ativo é o João! E a Mari')
        expect(sentences).toEqual(['Você tem 3 alunos.', 'O mais ativo é o João!'])
        expect(consumed).toBe('Você tem 3 alunos. O mais ativo é o João!'.length)
    })

    it('sem pontuação fechada → nada a falar ainda', () => {
        const { sentences, consumed } = extractCompleteSentences('Analisando o histórico do alu')
        expect(sentences).toEqual([])
        expect(consumed).toBe(0)
    })

    it('quebra de linha fecha frase; markdown sai limpo', () => {
        const { sentences } = extractCompleteSentences('**Resumo:**\nTudo em dia.')
        expect(sentences).toEqual(['Resumo:', 'Tudo em dia.'])
    })

    it('fragmento só de pontuação/espacos não vira fala', () => {
        const { sentences } = extractCompleteSentences('. ! ')
        expect(sentences).toEqual([])
    })
})
