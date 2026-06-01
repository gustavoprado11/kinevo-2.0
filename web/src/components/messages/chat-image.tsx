'use client'

import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Signed URLs live long enough for a chat session; regenerated on every mount.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 // 24h

/**
 * Renders a chat message image. When an `image_path` is available it resolves a
 * short-lived **signed URL** (so the `messages` bucket can be private). Falls
 * back to the legacy public `fallbackUrl` while the bucket is still public or if
 * signing fails — so this is safe to ship before the bucket is flipped.
 */
export function ChatImage({
    path,
    fallbackUrl,
}: {
    path?: string | null
    fallbackUrl: string | null
}) {
    const [url, setUrl] = useState<string | null>(fallbackUrl)

    useEffect(() => {
        if (!path) {
            setUrl(fallbackUrl)
            return
        }
        let active = true
        createClient()
            .storage.from('messages')
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
            .then(({ data }) => {
                if (active && data?.signedUrl) setUrl(data.signedUrl)
            })
            .catch(() => {
                /* keep fallback */
            })
        return () => {
            active = false
        }
    }, [path, fallbackUrl])

    if (!url) return null

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-1.5"
            data-img-container
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={url}
                alt=""
                className="max-w-[280px] max-h-[200px] rounded-lg object-cover cursor-pointer"
                onError={(e) => {
                    const target = e.currentTarget
                    target.style.display = 'none'
                    const container = target.closest('[data-img-container]')
                    const fallback = container?.querySelector<HTMLElement>('[data-fallback="img-error"]')
                    if (fallback) fallback.style.display = 'flex'
                }}
            />
            <div
                data-fallback="img-error"
                className="hidden items-center justify-center gap-1.5 w-[200px] h-[80px] rounded-lg bg-[#F5F5F7] dark:bg-k-bg-tertiary"
            >
                <ImageOff size={16} className="text-[#86868B] dark:text-k-text-quaternary" />
                <span className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                    Imagem indisponível
                </span>
            </div>
        </a>
    )
}
