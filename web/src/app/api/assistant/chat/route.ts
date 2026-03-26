import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { buildChatContext } from '@/lib/assistant/context-builder'

export const maxDuration = 30

export async function POST(req: Request) {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    // 2. Resolve trainer
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return new Response('Trainer not found', { status: 404 })
    }

    // 3. Parse body
    const { messages, studentId } = await req.json()

    // 4. Build context
    const systemPrompt = await buildChatContext(trainer.id, trainer.name, studentId || undefined)

    // 5. Stream
    const result = streamText({
        model: openai('gpt-4.1-mini'),
        system: systemPrompt,
        messages,
        maxTokens: 1000,
        temperature: 0.7,
    })

    return result.toTextStreamResponse()
}
