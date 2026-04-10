import React from 'react';
import { View, Text } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PressableScale } from '../../shared/PressableScale';
import type { Conversation } from '../../../hooks/useTrainerConversations';
import { timeAgo, getInitials, getMessagePreview } from './helpers';

// ── Component ──

interface ConversationCardProps {
    conversation: Conversation;
    onPress: () => void;
}

export function ConversationCard({ conversation, onPress }: ConversationCardProps) {
    const { student, lastMessage, unreadCount } = conversation;
    const isTrainerSender = lastMessage?.sender_type === 'trainer';
    const preview = getMessagePreview(lastMessage, isTrainerSender);

    return (
        <Animated.View entering={FadeIn.duration(300)}>
            <PressableScale onPress={onPress} pressScale={0.98} style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: unreadCount > 0 ? 'rgba(124, 58, 237, 0.15)' : 'rgba(0, 0, 0, 0.04)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Avatar */}
                    {student.avatar_url ? (
                        <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', marginRight: 12 }}>
                            <Animated.Image
                                source={{ uri: student.avatar_url }}
                                style={{ width: 44, height: 44 }}
                            />
                        </View>
                    ) : (
                        <View style={{
                            width: 44, height: 44, borderRadius: 22,
                            backgroundColor: '#f5f3ff',
                            alignItems: 'center', justifyContent: 'center',
                            marginRight: 12,
                        }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#7c3aed' }}>
                                {getInitials(student.name)}
                            </Text>
                        </View>
                    )}

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 15, fontWeight: unreadCount > 0 ? '700' : '600', color: '#0f172a' }}>
                                {student.name}
                            </Text>
                            {lastMessage && (
                                <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                                    {timeAgo(lastMessage.created_at)}
                                </Text>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                            <Text
                                numberOfLines={1}
                                style={{
                                    flex: 1,
                                    fontSize: 13,
                                    color: unreadCount > 0 ? '#0f172a' : '#64748b',
                                    fontWeight: unreadCount > 0 ? '500' : '400',
                                    marginRight: 8,
                                }}
                            >
                                {isTrainerSender && <Text style={{ color: '#94a3b8' }}>Você: </Text>}
                                {preview}
                            </Text>

                            {unreadCount > 0 ? (
                                <View style={{
                                    minWidth: 20, height: 20, borderRadius: 10,
                                    backgroundColor: '#7c3aed',
                                    alignItems: 'center', justifyContent: 'center',
                                    paddingHorizontal: 6,
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#ffffff' }}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Text>
                                </View>
                            ) : (
                                <ChevronRight size={16} color="#cbd5e1" />
                            )}
                        </View>
                    </View>
                </View>
            </PressableScale>
        </Animated.View>
    );
}
