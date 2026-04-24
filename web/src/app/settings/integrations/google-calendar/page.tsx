import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { listCalendars } from '@/lib/google-calendar/client'
import { getFreshAccessToken } from '@/lib/google-calendar/token-refresh'
import { GoogleCalendarClient } from './google-calendar-client'

export default async function GoogleCalendarSettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ step?: string; error?: string; detail?: string }>
}) {
    const { trainer } = await getTrainerWithSubscription()
    const params = await searchParams

    const { data: connection } = await supabaseAdmin
        .from('google_calendar_connections')
        .select(
            'google_account_email, calendar_id, status, connected_at, last_sync_at, last_sync_error, watch_expires_at',
        )
        .eq('trainer_id', trainer.id)
        .maybeSingle()

    const isConnected = !!connection && connection.status === 'active'
    const isPickingCalendar = isConnected && params.step === 'select'

    let calendarOptions: Array<{ id: string; summary: string; primary: boolean }> = []
    if (isPickingCalendar) {
        const creds = await getFreshAccessToken(trainer.id)
        if (creds) {
            const result = await listCalendars(creds.accessToken)
            if (result.ok) {
                calendarOptions = result.data.items
                    .filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer')
                    .map((c) => ({
                        id: c.id,
                        summary: c.summaryOverride ?? c.summary,
                        primary: !!c.primary,
                    }))
            }
        }
    }

    return (
        <GoogleCalendarClient
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
            connection={
                connection
                    ? {
                          email: connection.google_account_email,
                          calendarId: connection.calendar_id,
                          status: connection.status as 'active' | 'revoked' | 'error',
                          connectedAt: connection.connected_at,
                          lastSyncAt: connection.last_sync_at,
                          lastSyncError: connection.last_sync_error,
                          watchExpiresAt: connection.watch_expires_at,
                      }
                    : null
            }
            calendarOptions={calendarOptions}
            isPickingCalendar={isPickingCalendar}
            errorCode={params.error ?? null}
            errorDetail={params.detail ?? null}
        />
    )
}
