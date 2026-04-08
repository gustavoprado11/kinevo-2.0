import { NextResponse } from 'next/server'

/**
 * DEPRECATED: Video transcoding is now handled client-side.
 * See: web/src/lib/video-utils.ts (convertVideoToWebM)
 *
 * This route can be safely deleted.
 */
export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Video conversion now happens client-side.' },
        { status: 410 }
    )
}
