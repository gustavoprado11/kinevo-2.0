import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { decrementUnreadMessages } from './useUnreadCount';

// Upload file to Supabase Storage via native XMLHttpRequest (bypasses whatwg-fetch polyfill issues)
function uploadToSupabaseStorage(
    bucketName: string,
    filePath: string,
    fileUri: string,
    mimeType: string,
    supabaseUrl: string,
    accessToken: string,
    anonKey: string
): Promise<{ error: string | null }> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucketName}/${filePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('apikey', anonKey);
        xhr.setRequestHeader('x-upsert', 'false');

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                if (__DEV__) console.log('[Chat] Upload success, status:', xhr.status);
                resolve({ error: null });
            } else {
                if (__DEV__) console.error('[Chat] Upload failed, status:', xhr.status, 'response:', xhr.responseText);
                resolve({ error: `Upload failed: ${xhr.status}` });
            }
        };

        xhr.onerror = () => {
            if (__DEV__) console.error('[Chat] XHR upload error');
            resolve({ error: 'XHR network error' });
        };

        const formData = new FormData();
        formData.append('file', {
            uri: fileUri,
            name: filePath.split('/').pop(),
            type: mimeType,
        } as any);

        xhr.send(formData);
    });
}

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

export interface TrainerInfo {
    id: string;
    name: string;
    avatar_url: string | null;
}

export function useTrainerChat() {
    const { user } = useAuth();
    const [studentId, setStudentId] = useState<string | null>(null);
    const [trainer, setTrainer] = useState<TrainerInfo | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const studentIdRef = useRef<string | null>(null);

    // Resolve student_id + trainer info
    useEffect(() => {
        if (!user) return;

        (async () => {
            const { data: student }: { data: any } = await supabase
                .from('students' as any)
                .select('id, coach_id')
                .eq('auth_user_id', user.id)
                .single();

            if (!student?.id) return;

            setStudentId(student.id);
            studentIdRef.current = student.id;

            // Fetch trainer info
            const { data: trainerData }: { data: any } = await supabase
                .from('trainers' as any)
                .select('id, name, avatar_url')
                .eq('id', student.coach_id)
                .single();

            if (trainerData) {
                setTrainer(trainerData);
            }

            // Fetch unread count + last message
            await fetchSummary(student.id);
        })();
    }, [user]);

    const fetchSummary = useCallback(async (sid: string) => {
        setIsLoading(true);

        // Unread count (trainer messages not read by student)
        const { count } = await supabase
            .from('messages' as any)
            .select('id', { count: 'exact', head: true })
            .eq('student_id', sid)
            .eq('sender_type', 'trainer')
            .is('read_at', null);

        setUnreadCount(count ?? 0);

        // Last message
        const { data: lastMsgs }: { data: any } = await supabase
            .from('messages' as any)
            .select('id, student_id, sender_type, sender_id, content, image_url, read_at, created_at')
            .eq('student_id', sid)
            .order('created_at', { ascending: false })
            .limit(1);

        setLastMessage(lastMsgs?.[0] ?? null);
        setIsLoading(false);
    }, []);

    // Fetch paginated messages for the chat screen
    const fetchMessages = useCallback(async (cursor?: string, limit = 50): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
        const sid = studentIdRef.current;
        if (!sid) return { messages: [], hasMore: false };

        let query = supabase
            .from('messages' as any)
            .select('id, student_id, sender_type, sender_id, content, image_url, read_at, created_at')
            .eq('student_id', sid)
            .order('created_at', { ascending: false })
            .limit(limit + 1);

        if (cursor) {
            query = query.lt('created_at', cursor);
        }

        const { data, error } = await query;

        if (error || !data) return { messages: [], hasMore: false };

        const hasMore = data.length > limit;
        const msgs = (hasMore ? data.slice(0, limit) : data).reverse() as ChatMessage[];
        return { messages: msgs, hasMore };
    }, []);

    // Send a text message
    const sendTextMessage = useCallback(async (content: string): Promise<ChatMessage | null> => {
        const sid = studentIdRef.current;
        if (!sid || !user) return null;

        const { data, error } = await supabase
            .from('messages' as any)
            .insert({
                student_id: sid,
                sender_type: 'student',
                sender_id: user.id,
                content: content.trim(),
            })
            .select()
            .single();

        if (error) {
            if (__DEV__) console.error('[useTrainerChat] sendTextMessage error:', error);
            return null;
        }

        // Notify trainer (fire-and-forget)
        notifyTrainer(sid, content.trim()).catch((err) => {
            if (__DEV__) console.error('[useTrainerChat] notifyTrainer (text) error:', err);
        });

        return data as ChatMessage;
    }, [user]);

    // Send an image message
    const sendImageMessage = useCallback(async (imageUri: string, content?: string, assetMimeType?: string): Promise<ChatMessage | null> => {
        const sid = studentIdRef.current;
        if (!sid || !user) return null;

        // Resolve content-type from asset metadata (reliable) instead of URI extension (unreliable on iOS)
        const mimeType = assetMimeType?.startsWith('image/') ? assetMimeType : 'image/jpeg';
        const ext = mimeType === 'image/png' ? 'png'
            : mimeType === 'image/webp' ? 'webp'
            : 'jpg'; // jpeg, heic, and anything else → jpg (ImagePicker compresses to jpeg at quality < 1)
        const fileName = `${sid}/${Date.now()}.${ext}`;

        if (__DEV__) console.log('[Chat] Asset mimeType:', assetMimeType, 'uri:', imageUri);
        if (__DEV__) console.log('[Chat] Computed ext:', ext, 'contentType:', mimeType, 'fileName:', fileName);

        // Get auth token for direct upload
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            if (__DEV__) console.error('[useTrainerChat] No auth session for upload');
            return null;
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

        // Upload via native XMLHttpRequest + FormData (bypasses whatwg-fetch polyfill)
        const { error: uploadError } = await uploadToSupabaseStorage(
            'messages', fileName, imageUri, mimeType,
            supabaseUrl, session.access_token, anonKey
        );

        if (uploadError) {
            if (__DEV__) console.error('[useTrainerChat] upload error:', uploadError);
            return null;
        }

        const { data: publicData } = supabase.storage.from('messages').getPublicUrl(fileName);
        if (__DEV__) console.log('[Chat] Public URL:', publicData.publicUrl);

        const { data, error } = await supabase
            .from('messages' as any)
            .insert({
                student_id: sid,
                sender_type: 'student',
                sender_id: user.id,
                content: content?.trim() || null,
                image_url: publicData.publicUrl,
            })
            .select()
            .single();

        if (error) {
            if (__DEV__) console.error('[useTrainerChat] sendImageMessage error:', error);
            return null;
        }

        notifyTrainer(sid, content?.trim() || 'Enviou uma imagem').catch((err) => {
            if (__DEV__) console.error('[useTrainerChat] notifyTrainer (image) error:', err);
        });

        return data as ChatMessage;
    }, [user]);

    // Mark trainer messages as read
    const markAsRead = useCallback(async () => {
        const sid = studentIdRef.current;
        if (!sid) return;

        // Optimistically decrement the shared badge count
        const currentUnread = unreadCount;
        if (currentUnread > 0) {
            decrementUnreadMessages(currentUnread);
        }

        await supabase
            .from('messages' as any)
            .update({ read_at: new Date().toISOString() })
            .eq('student_id', sid)
            .eq('sender_type', 'trainer')
            .is('read_at', null);

        setUnreadCount(0);
    }, [unreadCount]);

    // Notify trainer via web API route
    const notifyTrainer = useCallback(async (sid: string, messageContent: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.kinevo.com.br';
            await fetch(`${baseUrl}/api/messages/notify-trainer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ studentId: sid, messageContent }),
            });
        } catch (err) {
            if (__DEV__) console.error('[useTrainerChat] notifyTrainer error:', err);
        }
    }, []);

    // Realtime subscription
    useEffect(() => {
        if (!studentId) return;

        const channel = supabase
            .channel(`student_messages_${studentId}`)
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
                    setLastMessage(newMsg);
                    if (newMsg.sender_type === 'trainer') {
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [studentId]);

    return {
        studentId,
        trainer,
        messages,
        unreadCount,
        lastMessage,
        isLoading,
        fetchMessages,
        sendTextMessage,
        sendImageMessage,
        markAsRead,
        refreshSummary: () => studentIdRef.current ? fetchSummary(studentIdRef.current) : Promise.resolve(),
    };
}
