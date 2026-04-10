import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    timeAgo,
    getInitials,
    getMessagePreview,
    sortConversations,
} from '../../components/trainer/messages/helpers';
import type { Conversation, ConversationLastMessage } from '../useTrainerConversations';

// ─── timeAgo ───

describe('timeAgo', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-09T12:00:00Z'));
    });

    it('returns "agora" for less than 60 seconds ago', () => {
        const date = new Date('2026-04-09T11:59:30Z').toISOString();
        expect(timeAgo(date)).toBe('agora');
    });

    it('returns "Xmin" for minutes', () => {
        const date = new Date('2026-04-09T11:55:00Z').toISOString();
        expect(timeAgo(date)).toBe('5min');
    });

    it('returns "Xh" for hours', () => {
        const date = new Date('2026-04-09T09:00:00Z').toISOString();
        expect(timeAgo(date)).toBe('3h');
    });

    it('returns "Xd" for days', () => {
        const date = new Date('2026-04-07T12:00:00Z').toISOString();
        expect(timeAgo(date)).toBe('2d');
    });

    it('returns "Xsem" for weeks', () => {
        const date = new Date('2026-03-19T12:00:00Z').toISOString();
        expect(timeAgo(date)).toBe('3sem');
    });
});

// ─── getInitials ───

describe('getInitials', () => {
    it('returns two initials for two-word name', () => {
        expect(getInitials('Ana Silva')).toBe('AS');
    });

    it('returns one initial for single name', () => {
        expect(getInitials('Carlos')).toBe('C');
    });

    it('returns max two initials for three-word name', () => {
        expect(getInitials('Ana Maria Silva')).toBe('AM');
    });
});

// ─── getMessagePreview ───

describe('getMessagePreview', () => {
    it('returns content when available', () => {
        const msg: ConversationLastMessage = {
            content: 'Olá, tudo bem?',
            image_url: null,
            sender_type: 'student',
            created_at: '2026-04-09T12:00:00Z',
        };
        expect(getMessagePreview(msg, false)).toBe('Olá, tudo bem?');
    });

    it('returns "Enviou uma imagem" for image-only message', () => {
        const msg: ConversationLastMessage = {
            content: null,
            image_url: 'https://example.com/image.jpg',
            sender_type: 'student',
            created_at: '2026-04-09T12:00:00Z',
        };
        expect(getMessagePreview(msg, false)).toBe('Enviou uma imagem');
    });

    it('returns "Iniciar conversa" when null', () => {
        expect(getMessagePreview(null, false)).toBe('Iniciar conversa');
    });

    it('returns content even when image is present', () => {
        const msg: ConversationLastMessage = {
            content: 'Olha essa foto',
            image_url: 'https://example.com/image.jpg',
            sender_type: 'student',
            created_at: '2026-04-09T12:00:00Z',
        };
        expect(getMessagePreview(msg, false)).toBe('Olha essa foto');
    });
});

// ─── sortConversations ───

function makeConversation(name: string, lastMessageDate: string | null, unreadCount = 0): Conversation {
    return {
        student: { id: name.toLowerCase().replace(/\s/g, '-'), name, avatar_url: null, status: 'active' },
        lastMessage: lastMessageDate
            ? { content: 'test', image_url: null, sender_type: 'student', created_at: lastMessageDate }
            : null,
        unreadCount,
    };
}

describe('sortConversations', () => {
    it('puts conversations with messages before those without', () => {
        const convs = [
            makeConversation('Ana', null),
            makeConversation('Bruno', '2026-04-09T10:00:00Z'),
        ];
        const sorted = sortConversations(convs);
        expect(sorted[0].student.name).toBe('Bruno');
        expect(sorted[1].student.name).toBe('Ana');
    });

    it('sorts conversations with messages by most recent first', () => {
        const convs = [
            makeConversation('Ana', '2026-04-09T08:00:00Z'),
            makeConversation('Bruno', '2026-04-09T10:00:00Z'),
            makeConversation('Carlos', '2026-04-09T09:00:00Z'),
        ];
        const sorted = sortConversations(convs);
        expect(sorted[0].student.name).toBe('Bruno');
        expect(sorted[1].student.name).toBe('Carlos');
        expect(sorted[2].student.name).toBe('Ana');
    });

    it('sorts conversations without messages alphabetically', () => {
        const convs = [
            makeConversation('Carlos', null),
            makeConversation('Ana', null),
            makeConversation('Bruno', null),
        ];
        const sorted = sortConversations(convs);
        expect(sorted[0].student.name).toBe('Ana');
        expect(sorted[1].student.name).toBe('Bruno');
        expect(sorted[2].student.name).toBe('Carlos');
    });

    it('handles mixed conversations correctly', () => {
        const convs = [
            makeConversation('Zara', null),
            makeConversation('Bruno', '2026-04-09T10:00:00Z'),
            makeConversation('Ana', null),
            makeConversation('Carlos', '2026-04-09T08:00:00Z'),
        ];
        const sorted = sortConversations(convs);
        // With messages first (by recency)
        expect(sorted[0].student.name).toBe('Bruno');
        expect(sorted[1].student.name).toBe('Carlos');
        // Without messages (alphabetical)
        expect(sorted[2].student.name).toBe('Ana');
        expect(sorted[3].student.name).toBe('Zara');
    });
});
