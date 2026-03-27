export interface Message {
    id: string
    student_id: string
    sender_type: 'trainer' | 'student'
    sender_id: string
    content: string | null
    image_url: string | null
    read_at: string | null
    created_at: string
}

export interface Conversation {
    student: {
        id: string
        name: string
        avatar_url: string | null
        status: string
    }
    lastMessage: {
        content: string | null
        image_url: string | null
        sender_type: 'trainer' | 'student'
        created_at: string
    } | null
    unreadCount: number
}
