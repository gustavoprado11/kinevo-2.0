'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
    Copy,
    Check,
    Instagram,
    MessageCircle,
    QrCode,
    Sparkles,
} from 'lucide-react'

/**
 * Guia "Como divulgar" — mostrado no hub Marketing quando a landing está
 * publicada. Ajuda o trainer a transformar a URL num funil de verdade:
 * copiar o link, QR pra stories/cartão, e 3 canais práticos.
 */
export function ShareLandingCard({ slug }: { slug: string }) {
    const [copied, setCopied] = useState(false)
    const url = `https://www.kinevoapp.com/com/${slug}`

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
        } catch { /* ignore */ }
    }

    return (
        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-400">
                    <Sparkles size={16} strokeWidth={1.8} />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-k-text-primary">Como divulgar</h2>
                    <p className="text-xs text-k-text-tertiary">Transforme sua URL em alunos.</p>
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
                {/* QR code */}
                <div className="flex flex-col items-center gap-2">
                    <div className="rounded-xl border border-k-border-subtle bg-white p-3">
                        <QRCodeSVG value={url} size={116} level="M" fgColor="#0E0E0E" bgColor="#FFFFFF" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">
                        <QrCode size={11} /> Print pra stories
                    </span>
                </div>

                {/* Link + canais */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl border border-k-border-subtle bg-glass-bg px-3 py-2.5">
                        <span className="flex-1 truncate font-mono text-sm text-k-text-secondary">
                            <span className="text-k-text-quaternary">kinevoapp.com/com/</span>
                            <span className="font-semibold text-k-text-primary">{slug}</span>
                        </span>
                        <button
                            onClick={copy}
                            className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-500"
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copiado' : 'Copiar'}
                        </button>
                    </div>

                    <ul className="space-y-2">
                        <ShareTip
                            icon={<Instagram size={14} />}
                            title="Bio do Instagram"
                            body="Cole o link no campo de site do seu perfil — é o primeiro lugar que todo lead procura."
                        />
                        <ShareTip
                            icon={<QrCode size={14} />}
                            title="Stories e cartão"
                            body="Salve o QR e poste nos stories ou imprima no seu cartão — quem aponta a câmera cai direto na página."
                        />
                        <ShareTip
                            icon={<MessageCircle size={14} />}
                            title="WhatsApp e bio do TikTok"
                            body="Mande o link pra quem te chama no direct, e fixe no status. Cada toque vira um lead seu."
                        />
                    </ul>
                </div>
            </div>
        </div>
    )
}

function ShareTip({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
        <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-k-border-subtle text-k-text-tertiary">
                {icon}
            </span>
            <div>
                <p className="text-xs font-bold text-k-text-primary">{title}</p>
                <p className="text-xs text-k-text-tertiary leading-relaxed">{body}</p>
            </div>
        </li>
    )
}
