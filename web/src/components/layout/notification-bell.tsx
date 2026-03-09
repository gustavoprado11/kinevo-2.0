'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Dumbbell, FileText, CreditCard, AlertTriangle, X } from 'lucide-react'

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'agora'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `há ${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `há ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `há ${days}d`
    return `há ${Math.floor(days / 7)} sem.`
}

interface Notification {
    id: string
    type: string
    title: string
    message: string
    read: boolean
    metadata: Record<string, any>
    created_at: string
}

const TYPE_ICONS: Record<string, typeof Bell> = {
    workout_completed: Dumbbell,
    form_submitted: FileText,
    payment_received: CreditCard,
    payment_failed: AlertTriangle,
    financial_alert: AlertTriangle,
    cancellation_alert: AlertTriangle,
    subscription_canceled: AlertTriangle,
}

const TYPE_COLORS: Record<string, string> = {
    workout_completed: 'text-emerald-500 bg-emerald-500/10',
    form_submitted: 'text-blue-500 bg-blue-500/10',
    payment_received: 'text-green-500 bg-green-500/10',
    payment_failed: 'text-red-500 bg-red-500/10',
    financial_alert: 'text-amber-500 bg-amber-500/10',
    cancellation_alert: 'text-red-500 bg-red-500/10',
    subscription_canceled: 'text-red-500 bg-red-500/10',
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/trainer-notifications')
            if (!res.ok) return
            const data = await res.json()
            setNotifications(data.notifications)
            setUnreadCount(data.unreadCount)
        } catch {
            // Silently fail
        }
    }, [])

    // Fetch on mount + poll every 30s
    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 30_000)
        return () => clearInterval(interval)
    }, [fetchNotifications])

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleMarkAllRead = async () => {
        try {
            await fetch('/api/trainer-notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true }),
            })
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            setUnreadCount(0)
        } catch {
            // Silently fail
        }
    }

    const handleMarkOneRead = async (id: string) => {
        try {
            await fetch('/api/trainer-notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] }),
            })
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch {
            // Silently fail
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg text-[#86868B] dark:text-muted-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                        <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground">
                            Notificações
                        </h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-xs text-[#007AFF] dark:text-violet-400 hover:underline"
                                >
                                    Marcar todas como lidas
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-foreground rounded"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <Bell size={24} className="mx-auto text-[#AEAEB2] dark:text-muted-foreground/40 mb-2" />
                                <p className="text-sm text-[#86868B] dark:text-muted-foreground">
                                    Nenhuma notificação
                                </p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const Icon = TYPE_ICONS[notif.type] ?? Bell
                                const colorClass = TYPE_COLORS[notif.type] ?? 'text-[#86868B] bg-[#F5F5F7] dark:text-muted-foreground dark:bg-glass-bg'

                                return (
                                    <button
                                        key={notif.id}
                                        onClick={() => {
                                            if (!notif.read) handleMarkOneRead(notif.id)
                                        }}
                                        className={`
                                            w-full text-left px-4 py-3 flex gap-3 transition-colors border-b border-[#F5F5F7] dark:border-k-border-subtle last:border-b-0
                                            ${!notif.read
                                                ? 'bg-[#007AFF]/[0.03] dark:bg-violet-500/[0.04]'
                                                : 'hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                            }
                                        `}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm leading-tight ${!notif.read ? 'font-semibold text-[#1D1D1F] dark:text-foreground' : 'text-[#1D1D1F] dark:text-foreground/80'}`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.read && (
                                                    <span className="w-2 h-2 rounded-full bg-[#007AFF] dark:bg-violet-500 flex-shrink-0 mt-1.5" />
                                                )}
                                            </div>
                                            <p className="text-xs text-[#86868B] dark:text-muted-foreground mt-0.5 truncate">
                                                {notif.message}
                                            </p>
                                            <p className="text-[10px] text-[#AEAEB2] dark:text-muted-foreground/50 mt-1">
                                                {timeAgo(notif.created_at)}
                                            </p>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
