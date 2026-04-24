'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    AlertCircle,
    Calendar,
    Check,
    ExternalLink,
    Link2,
    Loader2,
    Unlink,
} from 'lucide-react'
import { AppLayout } from '@/components/layout'
import { selectGoogleCalendar } from '@/actions/google-calendar/select-calendar'
import { disconnectGoogleCalendar } from '@/actions/google-calendar/disconnect'

interface Props {
    trainerName: string
    trainerEmail: string
    trainerAvatarUrl: string | null
    trainerTheme?: 'light' | 'dark' | 'system'
    connection: {
        email: string
        calendarId: string
        status: 'active' | 'revoked' | 'error'
        connectedAt: string
        lastSyncAt: string | null
        lastSyncError: string | null
        watchExpiresAt: string | null
    } | null
    calendarOptions: Array<{ id: string; summary: string; primary: boolean }>
    isPickingCalendar: boolean
    errorCode: string | null
    errorDetail?: string | null
}

const ERROR_MESSAGES: Record<string, string> = {
    access_denied: 'Acesso negado pelo Google.',
    invalid_state: 'Sessão expirou, tente novamente.',
    trainer_not_found: 'Treinador não localizado.',
    token_exchange_failed: 'Erro ao trocar tokens com o Google.',
    missing_refresh_token: 'Google não forneceu refresh token. Remova o acesso do app na sua conta Google e tente de novo.',
    userinfo_failed: 'Não conseguimos ler o email da sua conta Google.',
    calendar_list_failed: 'Não conseguimos listar seus calendários.',
    no_calendars: 'Nenhum calendário disponível.',
    save_failed: 'Erro ao salvar conexão.',
}

export function GoogleCalendarClient({
    trainerName,
    trainerEmail,
    trainerAvatarUrl,
    trainerTheme,
    connection,
    calendarOptions,
    isPickingCalendar,
    errorCode,
    errorDetail,
}: Props) {
    const router = useRouter()
    const [selectedId, setSelectedId] = useState<string>(
        connection?.calendarId ??
            calendarOptions.find((c) => c.primary)?.id ??
            calendarOptions[0]?.id ??
            '',
    )
    const [saving, setSaving] = useState(false)
    const [disconnecting, setDisconnecting] = useState(false)
    const [error, setError] = useState<string | null>(
        errorCode
            ? `${ERROR_MESSAGES[errorCode] ?? errorCode}${errorDetail ? ` — ${errorDetail}` : ''}`
            : null,
    )

    const isConnected = !!connection && connection.status === 'active'
    const isRevoked = connection?.status === 'revoked'

    const handleSaveCalendar = async () => {
        if (!selectedId) return
        setSaving(true)
        setError(null)
        const result = await selectGoogleCalendar(selectedId)
        setSaving(false)
        if (!result.success) {
            setError(result.error ?? 'Erro ao salvar calendário')
            return
        }
        router.push('/settings/integrations/google-calendar')
        router.refresh()
    }

    const handleDisconnect = async () => {
        if (!confirm('Desconectar Google Calendar? Os eventos já criados permanecem no Google.')) {
            return
        }
        setDisconnecting(true)
        setError(null)
        const result = await disconnectGoogleCalendar()
        setDisconnecting(false)
        if (!result.success) {
            setError(result.error ?? 'Erro ao desconectar')
            return
        }
        router.refresh()
    }

    return (
        <AppLayout
            trainerName={trainerName}
            trainerEmail={trainerEmail}
            trainerAvatarUrl={trainerAvatarUrl}
            trainerTheme={trainerTheme}
        >
            <div className="max-w-2xl mx-auto p-8 space-y-6">
                <header>
                    <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary">
                        Google Calendar
                    </h1>
                    <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary mt-1">
                        Conecte sua conta Google pra ver todos os agendamentos do Kinevo no seu calendário.
                    </p>
                </header>

                {error && (
                    <div
                        role="alert"
                        className="bg-[#FF3B30]/10 dark:bg-red-500/10 border border-[#FF3B30]/20 dark:border-red-500/20 text-[#FF3B30] dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3"
                    >
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        {error}
                    </div>
                )}

                {isRevoked && (
                    <div
                        role="alert"
                        className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-300 px-4 py-3 rounded-xl text-sm flex items-start gap-3"
                    >
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <div>
                            <p className="font-semibold">
                                Acesso ao Google foi revogado
                            </p>
                            <p className="text-xs mt-1">
                                Os agendamentos no Kinevo continuam funcionando. Pra voltar a sincronizar com o Google, reconecte.
                            </p>
                        </div>
                    </div>
                )}

                {/* Picking calendar */}
                {isPickingCalendar && calendarOptions.length > 0 && (
                    <section className="rounded-2xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card p-6 space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                Escolha o calendário destino
                            </h2>
                            <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary mt-1">
                                Os agendamentos do Kinevo vão aparecer neste calendário.
                            </p>
                        </div>
                        <ul className="space-y-2">
                            {calendarOptions.map((cal) => (
                                <li key={cal.id}>
                                    <label
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                            selectedId === cal.id
                                                ? 'border-[#007AFF] dark:border-violet-500/50 bg-[#007AFF]/5 dark:bg-violet-500/10'
                                                : 'border-[#E8E8ED] dark:border-k-border-subtle hover:bg-[#F9F9FB] dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="calendar"
                                            value={cal.id}
                                            checked={selectedId === cal.id}
                                            onChange={() => setSelectedId(cal.id)}
                                            className="accent-[#007AFF] dark:accent-violet-500"
                                        />
                                        <Calendar className="w-4 h-4 text-[#86868B] dark:text-k-text-quaternary" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">
                                                {cal.summary}
                                            </span>
                                            {cal.primary && (
                                                <span className="ml-2 text-[10px] font-semibold uppercase text-[#86868B] dark:text-k-text-quaternary">
                                                    principal
                                                </span>
                                            )}
                                        </div>
                                    </label>
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={handleSaveCalendar}
                            disabled={saving || !selectedId}
                            className="w-full px-4 py-2.5 bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0056B3] dark:hover:bg-violet-500 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin w-4 h-4" />
                                    Conectando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Confirmar calendário
                                </>
                            )}
                        </button>
                    </section>
                )}

                {/* Connection status */}
                {!isPickingCalendar && (
                    <section className="rounded-2xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card p-6">
                        {isConnected && connection ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-5 h-5 text-emerald-500" strokeWidth={2} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                            Conectado
                                        </p>
                                        <p className="text-xs text-[#6E6E73] dark:text-k-text-secondary mt-0.5">
                                            {connection.email}
                                        </p>
                                        <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary mt-1">
                                            Calendário: <span className="font-mono">{connection.calendarId}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <a
                                        href="/settings/integrations/google-calendar?step=select"
                                        className="flex-1 px-4 py-2 text-sm font-medium text-[#007AFF] dark:text-violet-400 border border-[#007AFF]/20 dark:border-violet-500/30 hover:bg-[#007AFF]/5 dark:hover:bg-violet-500/10 rounded-full transition-all text-center"
                                    >
                                        Trocar calendário
                                    </a>
                                    <button
                                        type="button"
                                        onClick={handleDisconnect}
                                        disabled={disconnecting}
                                        className="flex-1 px-4 py-2 text-sm font-medium text-red-500 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
                                    >
                                        {disconnecting ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Unlink className="w-3.5 h-3.5" />
                                        )}
                                        Desconectar
                                    </button>
                                </div>
                                {connection.lastSyncError && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-2">
                                        Último erro: {connection.lastSyncError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 text-center py-4">
                                <div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mx-auto">
                                    <Calendar className="w-6 h-6 text-violet-500" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                        Nenhuma conta conectada
                                    </p>
                                    <p className="text-xs text-[#6E6E73] dark:text-k-text-secondary mt-1 max-w-sm mx-auto">
                                        Ao conectar, você escolhe qual calendário recebe os agendamentos. Mudanças feitas no Google aparecem aqui automaticamente.
                                    </p>
                                </div>
                                <a
                                    href="/settings/integrations/google-calendar/start"
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0056B3] dark:hover:bg-violet-500 text-white text-sm font-semibold rounded-full transition-all active:scale-95"
                                >
                                    <Link2 className="w-4 h-4" />
                                    Conectar Google Calendar
                                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                                </a>
                            </div>
                        )}
                    </section>
                )}

                <footer className="text-[11px] text-[#86868B] dark:text-k-text-quaternary space-y-1">
                    <p>
                        Os eventos criados pelo Kinevo aparecem como “[Kinevo] Treino — &lt;aluno&gt;”. Mudanças de horário feitas direto no Google aparecem como notificação no Kinevo antes de serem aplicadas.
                    </p>
                </footer>
            </div>
        </AppLayout>
    )
}
