import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, MessageCircle } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp, Easing } from 'react-native-reanimated';
import { useTrainerConversations, type Conversation } from '../../hooks/useTrainerConversations';
import { ConversationCard } from '../../components/trainer/messages/ConversationCard';

export default function MessagesScreen() {
    const router = useRouter();
    const { conversations, isLoading, refresh } = useTrainerConversations();

    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = useCallback((text: string) => {
        setSearchText(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(text);
        }, 300);
    }, []);

    const filteredConversations = useMemo(() => {
        if (!debouncedSearch.trim()) return conversations;
        const query = debouncedSearch.trim().toLowerCase();
        return conversations.filter(c =>
            c.student.name.toLowerCase().includes(query)
        );
    }, [conversations, debouncedSearch]);

    const handleConversationPress = useCallback((conv: Conversation) => {
        router.push({
            pathname: '/messages/[studentId]',
            params: { studentId: conv.student.id },
        } as any);
    }, [router]);

    const renderItem = useCallback(({ item }: { item: Conversation }) => (
        <ConversationCard
            conversation={item}
            onPress={() => handleConversationPress(item)}
        />
    ), [handleConversationPress]);

    const keyExtractor = useCallback((item: Conversation) => item.student.id, []);

    const ItemSeparator = useCallback(() => <View style={{ height: 12 }} />, []);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }} edges={['top']}>
            <View style={{ flex: 1, paddingHorizontal: 20 }}>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)} style={{ paddingTop: 16 }}>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a' }}>
                        Mensagens
                    </Text>
                </Animated.View>

                {/* Search bar */}
                <Animated.View
                    entering={FadeInUp.delay(60).duration(300).easing(Easing.out(Easing.cubic))}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#ffffff',
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        marginTop: 16,
                        marginBottom: 8,
                        height: 44,
                        borderWidth: 1,
                        borderColor: 'rgba(0,0,0,0.04)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.03,
                        shadowRadius: 4,
                        elevation: 1,
                    }}
                >
                    <Search size={18} color="#94a3b8" strokeWidth={1.5} />
                    <TextInput
                        value={searchText}
                        onChangeText={handleSearchChange}
                        placeholder="Buscar aluno..."
                        placeholderTextColor="#94a3b8"
                        style={{
                            flex: 1,
                            fontSize: 15,
                            color: '#0f172a',
                            marginLeft: 10,
                            paddingVertical: 0,
                        }}
                        autoCorrect={false}
                        returnKeyType="search"
                    />
                </Animated.View>

                {/* Content */}
                {isLoading ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color="#7c3aed" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredConversations}
                        renderItem={renderItem}
                        keyExtractor={keyExtractor}
                        ItemSeparatorComponent={ItemSeparator}
                        contentContainerStyle={{
                            paddingTop: 8,
                            paddingBottom: 120,
                            flexGrow: 1,
                        }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={false}
                                onRefresh={refresh}
                                tintColor="#7c3aed"
                            />
                        }
                        ListEmptyComponent={
                            debouncedSearch.trim() ? (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                                    <View style={{
                                        width: 56, height: 56, borderRadius: 28,
                                        backgroundColor: '#f1f5f9',
                                        alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 16,
                                    }}>
                                        <Search size={24} color="#94a3b8" />
                                    </View>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', textAlign: 'center' }}>
                                        Nenhum aluno encontrado
                                    </Text>
                                </View>
                            ) : (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                                    <View style={{
                                        width: 56, height: 56, borderRadius: 28,
                                        backgroundColor: '#f1f5f9',
                                        alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 16,
                                    }}>
                                        <MessageCircle size={24} color="#94a3b8" />
                                    </View>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', textAlign: 'center' }}>
                                        Você ainda não tem alunos
                                    </Text>
                                </View>
                            )
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}
