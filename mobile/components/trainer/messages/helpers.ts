import type { Conversation, ConversationLastMessage } from '../../../hooks/useTrainerConversations';

export function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'agora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}sem`;
}

export function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function getMessagePreview(
    lastMessage: ConversationLastMessage | null,
    senderIsTrainer: boolean
): string {
    if (!lastMessage) return 'Iniciar conversa';
    if (lastMessage.image_url && !lastMessage.content) return 'Enviou uma imagem';
    return lastMessage.content || '';
}

export function sortConversations(convs: Conversation[]): Conversation[] {
    return [...convs].sort((a, b) => {
        if (a.lastMessage && b.lastMessage) {
            return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
        }
        if (a.lastMessage && !b.lastMessage) return -1;
        if (!a.lastMessage && b.lastMessage) return 1;
        return a.student.name.localeCompare(b.student.name);
    });
}
