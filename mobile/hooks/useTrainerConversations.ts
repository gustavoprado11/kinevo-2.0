import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    isRefreshing: boolean;
    refresh: () => Promise<void>;
}

export function useTrainerConversations(): UseTrainerConversationsReturn {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
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

        // PF2: agregação no BANCO (RPC da migration 244) — antes baixávamos
        // TODAS as mensagens de todos os alunos, sem limit, a cada foco da
        // aba, só pra achar a última por aluno (payload O(histórico) e
        // preview errado acima do cap de 1000 linhas do PostgREST).
        const { data: rows, error } = await (supabase as any).rpc(
            'get_trainer_conversations',
            { p_trainer_id: trainerId },
        );

        if (error) {
            if (__DEV__) console.error('[useTrainerConversations] RPC error:', error.message);
            setIsLoading(false);
            return;
        }

        // A RPC já ordena: com mensagens por recência, depois sem mensagens
        // por nome — mesma semântica do sort antigo.
        const convs: Conversation[] = ((rows as any[]) ?? []).map((r: any) => ({
            student: {
                id: r.student_id,
                name: r.student_name,
                avatar_url: r.avatar_url,
                status: r.student_status,
            },
            lastMessage: r.last_created_at
                ? {
                    content: r.last_content,
                    image_url: r.last_image_url,
                    sender_type: (r.last_sender_type ?? 'student') as 'trainer' | 'student',
                    created_at: r.last_created_at,
                }
                : null,
            unreadCount: r.unread_count ?? 0,
        }));

        studentIdsRef.current = new Set(convs.map((c) => c.student.id));

        setConversations(convs);
        setIsLoading(false);
    }, [user]);

    // Initial fetch
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Chave estável dos IDs dos alunos: só muda quando o conjunto muda (não a
    // cada mensagem nova), evitando re-subscribe desnecessário/perda de eventos.
    const studentIdsKey = useMemo(
        () => conversations.map(c => c.student.id).sort().join(','),
        [conversations]
    );

    // Real-time: escuta mensagens novas — filtradas SERVER-SIDE pelos alunos
    // do treinador (antes recebia todos os INSERTs do projeto e filtrava no cliente).
    useEffect(() => {
        if (!trainerIdRef.current || !studentIdsKey) return;
        const ids = studentIdsKey.split(',');

        const channel = supabase
            .channel(`trainer_conversations_${trainerIdRef.current}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `student_id=in.(${ids.join(',')})`,
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
    }, [studentIdsKey]); // Re-subscribe só quando o conjunto de alunos muda

    // Pull-to-refresh: usa flag própria (não isLoading) pra mostrar o spinner
    // sutil em vez de trocar a lista inteira por skeletons (flicker).
    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchConversations();
        setIsRefreshing(false);
    }, [fetchConversations]);

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    return { conversations, totalUnread, isLoading, isRefreshing, refresh };
}
