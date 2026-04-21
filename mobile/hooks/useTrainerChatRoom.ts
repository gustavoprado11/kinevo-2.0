import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
    id: string;
    student_id: string;
    sender_type: 'trainer' | 'student';
    sender_id: string;
    content: string | null;
    image_url: string | null;
    read_at: string | null;
    created_at: string;
}

export interface UseTrainerChatRoomReturn {
    messages: ChatMessage[];
    isLoading: boolean;
    hasMore: boolean;
    sendText: (content: string) => Promise<ChatMessage | null>;
    markAsRead: () => Promise<void>;
    loadMore: () => Promise<void>;
}

export function useTrainerChatRoom(studentId: string): UseTrainerChatRoomReturn {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const isLoadingMoreRef = useRef(false);

    // Fetch paginated messages
    const fetchMessages = useCallback(async (cursor?: string, limit = 50): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
        let query = supabase
            .from('messages' as any)
            .select('id, student_id, sender_type, sender_id, content, image_url, read_at, created_at')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .limit(limit + 1);

        if (cursor) {
            query = query.lt('created_at', cursor);
        }

        const { data, error } = await query;

        if (error || !data) return { messages: [], hasMore: false };

        const hasMoreResult = data.length > limit;
        const msgs = (hasMoreResult ? data.slice(0, limit) : data).reverse() as ChatMessage[];
        return { messages: msgs, hasMore: hasMoreResult };
    }, [studentId]);

    // Initial load
    useEffect(() => {
        if (!studentId) return;
        setIsLoading(true);

        fetchMessages().then(result => {
            setMessages(result.messages);
            setHasMore(result.hasMore);
            setIsLoading(false);
        });
    }, [studentId, fetchMessages]);

    // Mark student messages as read
    const markAsRead = useCallback(async () => {
        if (!studentId) return;

        await supabase
            .from('messages' as any)
            .update({ read_at: new Date().toISOString() })
            .eq('student_id', studentId)
            .eq('sender_type', 'student')
            .is('read_at', null);
    }, [studentId]);

    // Auto-mark as read on load
    useEffect(() => {
        if (!isLoading && messages.length > 0) {
            markAsRead();
        }
    }, [isLoading, messages.length > 0, markAsRead]);

    // Send text message
    const sendText = useCallback(async (content: string): Promise<ChatMessage | null> => {
        if (!user || !studentId) return null;

        const { data, error } = await supabase
            .from('messages' as any)
            .insert({
                student_id: studentId,
                sender_type: 'trainer',
                sender_id: user.id,
                content: content.trim(),
            })
            .select()
            .single();

        if (error) {
            if (__DEV__) console.error('[useTrainerChatRoom] sendText error:', error);
            return null;
        }

        // Notify student via push (fire-and-forget)
        notifyStudent(studentId, content.trim()).catch((err) => {
            if (__DEV__) console.error('[useTrainerChatRoom] notifyStudent error:', err);
        });

        return data as ChatMessage;
    }, [user, studentId]);

    // Notify student via web API push route
    const notifyStudent = useCallback(async (sid: string, messageContent: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.kinevo.com.br';
            await fetch(`${baseUrl}/api/messages/notify-student`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ studentId: sid, messageContent }),
            });
        } catch (err) {
            if (__DEV__) console.error('[useTrainerChatRoom] notifyStudent error:', err);
        }
    }, []);

    // Load more (older messages)
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoadingMoreRef.current || messages.length === 0) return;
        isLoadingMoreRef.current = true;

        const oldestCreatedAt = messages[0].created_at;
        const result = await fetchMessages(oldestCreatedAt);

        setMessages(prev => [...result.messages, ...prev]);
        setHasMore(result.hasMore);
        isLoadingMoreRef.current = false;
    }, [hasMore, messages, fetchMessages]);

    // Real-time subscription
    useEffect(() => {
        if (!studentId) return;

        const channel = supabase
            .channel(`trainer_chat_${studentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    const newMsg = payload.new as ChatMessage;
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                    // Auto-mark student messages as read (trainer is viewing)
                    if (newMsg.sender_type === 'student') {
                        markAsRead();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    const updated = payload.new as ChatMessage;
                    setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [studentId, markAsRead]);

    return { messages, isLoading, hasMore, sendText, markAsRead, loadMore };
}
