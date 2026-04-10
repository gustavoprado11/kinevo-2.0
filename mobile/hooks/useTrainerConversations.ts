import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export interface ConversationStudent {
    id: string;
    name: string;
    avatar_url: string | null;
    status: string;
}

export interface ConversationLastMessage {
    content: string | null;
    image_url: string | null;
    sender_type: 'trainer' | 'student';
    created_at: string;
}

export interface Conversation {
    student: ConversationStudent;
    lastMessage: ConversationLastMessage | null;
    unreadCount: number;
}

export interface UseTrainerConversationsReturn {
    conversations: Conversation[];
    totalUnread: number;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useTrainerConversations(): UseTrainerConversationsReturn {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const trainerIdRef = useRef<string | null>(null);
    const studentIdsRef = useRef<Set<string>>(new Set());

    const fetchConversations = useCallback(async () => {
        if (!user) return;

        // Resolve trainer id
        let trainerId = trainerIdRef.current;
        if (!trainerId) {
            const { data: trainer }: { data: any } = await supabase
                .from('trainers' as any)
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            if (!trainer?.id) {
                setIsLoading(false);
                return;
            }
            trainerId = trainer.id as string;
            trainerIdRef.current = trainerId;
        }

        // Fetch active students
        const { data: students }: { data: any } = await supabase
            .from('students' as any)
            .select('id, name, avatar_url, status')
            .eq('coach_id', trainerId)
            .eq('status', 'active');

        if (!students || students.length === 0) {
            setConversations([]);
            setIsLoading(false);
            return;
        }

        const studentIds = students.map((s: any) => s.id) as string[];
        studentIdsRef.current = new Set(studentIds);

        // Fetch all messages for these students (ordered by recency)
        const { data: messages }: { data: any } = await supabase
            .from('messages' as any)
            .select('student_id, content, image_url, sender_type, created_at')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false });

        // Fetch unread counts (student messages not read by trainer)
        const { data: unreadRows }: { data: any } = await supabase
            .from('messages' as any)
            .select('student_id')
            .in('student_id', studentIds)
            .eq('sender_type', 'student')
            .is('read_at', null);

        // Build last-message map (first occurrence per student_id = most recent)
        const lastMessageMap = new Map<string, ConversationLastMessage>();
        if (messages) {
            for (const msg of messages) {
                if (!lastMessageMap.has(msg.student_id)) {
                    lastMessageMap.set(msg.student_id, {
                        content: msg.content,
                        image_url: msg.image_url,
                        sender_type: msg.sender_type,
                        created_at: msg.created_at,
                    });
                }
            }
        }

        // Build unread count map
        const unreadMap = new Map<string, number>();
        if (unreadRows) {
            for (const row of unreadRows) {
                unreadMap.set(row.student_id, (unreadMap.get(row.student_id) ?? 0) + 1);
            }
        }

        // Build conversations
        const convs: Conversation[] = students.map((s: any) => ({
            student: {
                id: s.id,
                name: s.name,
                avatar_url: s.avatar_url,
                status: s.status,
            },
            lastMessage: lastMessageMap.get(s.id) ?? null,
            unreadCount: unreadMap.get(s.id) ?? 0,
        }));

        // Sort: conversations with messages first (by recency), then without (alphabetical)
        convs.sort((a, b) => {
            if (a.lastMessage && b.lastMessage) {
                return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
            }
            if (a.lastMessage && !b.lastMessage) return -1;
            if (!a.lastMessage && b.lastMessage) return 1;
            return a.student.name.localeCompare(b.student.name);
        });

        setConversations(convs);
        setIsLoading(false);
    }, [user]);

    // Initial fetch
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Real-time: listen for new messages across all students
    useEffect(() => {
        if (!trainerIdRef.current) return;

        const channel = supabase
            .channel(`trainer_conversations_${trainerIdRef.current}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const newMsg = payload.new as any;
                    const sid = newMsg.student_id as string;

                    // Only process messages for our students
                    if (!studentIdsRef.current.has(sid)) return;

                    setConversations(prev => {
                        const updated = prev.map(conv => {
                            if (conv.student.id !== sid) return conv;

                            const lastMessage: ConversationLastMessage = {
                                content: newMsg.content,
                                image_url: newMsg.image_url,
                                sender_type: newMsg.sender_type,
                                created_at: newMsg.created_at,
                            };

                            return {
                                ...conv,
                                lastMessage,
                                unreadCount: newMsg.sender_type === 'student'
                                    ? conv.unreadCount + 1
                                    : conv.unreadCount,
                            };
                        });

                        // Re-sort after update
                        updated.sort((a, b) => {
                            if (a.lastMessage && b.lastMessage) {
                                return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
                            }
                            if (a.lastMessage && !b.lastMessage) return -1;
                            if (!a.lastMessage && b.lastMessage) return 1;
                            return a.student.name.localeCompare(b.student.name);
                        });

                        return updated;
                    });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [conversations.length > 0]); // Re-subscribe once we have student data

    const refresh = useCallback(async () => {
        setIsLoading(true);
        await fetchConversations();
    }, [fetchConversations]);

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    return { conversations, totalUnread, isLoading, refresh };
}
