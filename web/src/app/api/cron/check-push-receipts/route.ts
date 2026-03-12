import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * CRON: Check Expo push receipts for tickets older than 15 minutes.
 * Handles DeviceNotRegistered by deactivating tokens.
 * Cleans up tickets older than 7 days.
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Get pending tickets older than 15 minutes (Expo recommends waiting before checking)
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

        const { data: pendingTickets } = await supabaseAdmin
            .from('push_tickets')
            .select('id, ticket_id, push_token_id')
            .eq('status', 'pending')
            .lte('created_at', fifteenMinAgo)
            .order('created_at', { ascending: true })
            .limit(300) // Expo accepts up to 300 per request

        if (!pendingTickets || pendingTickets.length === 0) {
            // Cleanup old tickets
            await cleanupOldTickets()
            return NextResponse.json({ checked: 0, cleaned: true })
        }

        // 2. Fetch receipts from Expo
        const ticketIds = pendingTickets.map(t => t.ticket_id)

        const receiptResponse = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: ticketIds }),
        })

        if (!receiptResponse.ok) {
            console.error('[check-push-receipts] Expo API error:', receiptResponse.status)
            return NextResponse.json({ error: 'Expo API error' }, { status: 502 })
        }

        const { data: receipts } = await receiptResponse.json()

        // 3. Process each receipt
        let processed = 0
        let deactivated = 0

        for (const ticket of pendingTickets) {
            const receipt = receipts?.[ticket.ticket_id]
            if (!receipt) continue // Not ready yet, will retry next run

            const updatePayload: Record<string, any> = {
                checked_at: new Date().toISOString(),
            }

            if (receipt.status === 'ok') {
                updatePayload.status = 'ok'
                updatePayload.receipt_status = 'ok'
            } else if (receipt.status === 'error') {
                updatePayload.status = 'error'
                updatePayload.receipt_status = 'error'
                updatePayload.receipt_message = receipt.message ?? null
                updatePayload.receipt_error_type = receipt.details?.error ?? null

                // Handle DeviceNotRegistered — deactivate the token
                if (receipt.details?.error === 'DeviceNotRegistered' && ticket.push_token_id) {
                    await supabaseAdmin
                        .from('push_tokens')
                        .update({ active: false, updated_at: new Date().toISOString() })
                        .eq('id', ticket.push_token_id)
                    deactivated++
                }
            }

            await supabaseAdmin
                .from('push_tickets')
                .update(updatePayload)
                .eq('id', ticket.id)

            processed++
        }

        // 4. Cleanup old tickets
        await cleanupOldTickets()

        return NextResponse.json({ checked: processed, deactivated, total: pendingTickets.length })
    } catch (error) {
        console.error('[check-push-receipts] Error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

async function cleanupOldTickets() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 1000).toISOString()
    await supabaseAdmin
        .from('push_tickets')
        .delete()
        .lte('created_at', sevenDaysAgo)
        .neq('status', 'pending') // Don't delete unchecked tickets
}
