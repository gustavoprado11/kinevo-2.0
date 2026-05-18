// ============================================================================
// POST /api/wallet/documents/[id]
// ============================================================================
// Recebe um arquivo multipart/form-data (campo `file`) e envia pro Asaas
// como um documento do grupo {id}. Usado para tipos que NÃO têm
// onboardingUrl (ex.: IDENTIFICATION, IDENTIFICATION_SELFIE).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { AsaasApiError, uploadDocument } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
])

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const trainer = await requireTrainer(request)

        const formData = await request.formData()
        const file = formData.get('file')
        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: 'Arquivo ausente (campo "file" obrigatório)' },
                { status: 400 }
            )
        }
        if (file.size === 0) {
            return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 })
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json(
                { error: `Arquivo muito grande (máx. ${MAX_BYTES / 1024 / 1024} MB)` },
                { status: 413 }
            )
        }
        if (!ALLOWED_MIME.has(file.type)) {
            return NextResponse.json(
                { error: `Tipo de arquivo não suportado (${file.type || 'desconhecido'}). Use JPG, PNG ou PDF.` },
                { status: 415 }
            )
        }

        const documentType = (formData.get('type') as string | null) ?? 'IDENTIFICATION'

        const apiKey = await getDecryptedApiKey(trainer.id)
        const arrayBuffer = await file.arrayBuffer()
        const result = await uploadDocument(
            apiKey,
            id,
            {
                data: arrayBuffer,
                filename: file.name || `upload.${file.type.split('/')[1] || 'bin'}`,
                contentType: file.type,
            },
            documentType
        )

        return NextResponse.json({ success: true, group: result }, { status: 201 })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/documents POST] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: 502 }
            )
        }
        console.error('[wallet/documents POST] Error:', err)
        const message = err instanceof Error ? err.message : 'Erro ao enviar documento'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
