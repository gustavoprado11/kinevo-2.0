import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getConversations } from './actions'
import { MessagesClient } from './messages-client'

export default async function MessagesPage() {
    const { trainer } = await getTrainerWithSubscription()
    const conversations = await getConversations()

    return (
        <MessagesClient
            trainer={trainer}
            initialConversations={conversations}
        />
    )
}
