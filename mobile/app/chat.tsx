import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ChatView } from '../components/chat/ChatView';

export default function ChatScreen() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }} edges={['top']}>
                <ChatView showBackButton={true} />
            </SafeAreaView>
        </>
    );
}
