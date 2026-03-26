import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { buildChatContext } from '@/lib/assistant/context-builder'

export const maxDuration = 30

export async function POST(req: Request) {
    console.log('[CHAT API] POST called')

    try {
        // 1. Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.log('[CHAT API] Unauthorized — no user')
            return new Response('Unauthorized', { status: 401 })
        }

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, name')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            console.log('[CHAT API] Trainer not found for user:', user.id)
            return new Response('Trainer not found', { status: 404 })
        }

        // 3. Parse body
        const { messages, studentId } = await req.json()
        console.log('[CHAT API] Parsed body:', { messagesCount: messages?.length, studentId, firstRole: messages?.[0]?.role })

        // 4. Build context
        const systemPrompt = await buildChatContext(trainer.id, trainer.name, studentId || undefined)
        console.log('[CHAT API] Context built:', {
            systemPromptLength: systemPrompt.length,
            hasApiKey: !!process.env.OPENAI_API_KEY,
            model: 'gpt-4.1-mini',
        })

        // 5. Stream
        const result = streamText({
            model: openai('gpt-4.1-mini'),
            system: systemPrompt,
            messages,
            maxTokens: 1000,
            temperature: 0.7,
        })

        console.log('[CHAT API] streamText called, returning response')
        return result.toTextStreamResponse()
    } catch (error) {
        console.error('[CHAT API] ERROR:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}
