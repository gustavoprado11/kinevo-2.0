'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check } from 'lucide-react'
import { IOS_APP_URL, ANDROID_APP_URL } from '@/lib/constants/app-links'
import { useOnboardingStore } from '@/stores/onboarding-store'

/**
 * Conteúdo customizado do último step do welcome tour v2.
 *
 * Renderizado dentro do `OnboardingTooltip` quando step.id === WELCOME_MOBILE_STEP_ID.
 * Mostra QR codes do app + links com botão de copiar (reaproveita lógica do AppDownloadCard).
 *
 * QR cor: fgColor="currentColor" + bgColor="transparent" — adapta light/dark automaticamente.
 */
export function WelcomeMobileStep() {
  const [copied, setCopied] = useState<'ios' | 'android' | null>(null)

  const handleCopy = async (platform: 'ios' | 'android', link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      useOnboardingStore.getState().completeMilestone('app_link_shared')
      setCopied(platform)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore — clipboard pode falhar em iframe/safari old
    }
  }

  return (
    <div className="mt-3 space-y-3 text-foreground">
      <div className="grid grid-cols-2 gap-3">
        {/* iOS */}
        <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-3 flex flex-col items-center">
          <div className="w-20 h-20 flex items-center justify-center">
            <QRCodeSVG
              value={IOS_APP_URL}
              size={80}
              fgColor="currentColor"
              bgColor="transparent"
              level="M"
            />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground/80 mt-2">
            iOS
          </p>
          <button
            onClick={() => handleCopy('ios', IOS_APP_URL)}
            className="mt-1 flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-400 transition-colors"
          >
            {copied === 'ios' ? (
              <>
                <Check size={10} className="text-emerald-500" /> Copiado
              </>
            ) : (
              <>
                <Copy size={10} /> Copiar link
              </>
            )}
          </button>
        </div>

        {/* Android */}
        <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-3 flex flex-col items-center">
          <div className="w-20 h-20 flex items-center justify-center">
            <QRCodeSVG
              value={ANDROID_APP_URL}
              size={80}
              fgColor="currentColor"
              bgColor="transparent"
              level="M"
            />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground/80 mt-2">
            Android
          </p>
          <button
            onClick={() => handleCopy('android', ANDROID_APP_URL)}
            className="mt-1 flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-400 transition-colors"
          >
            {copied === 'android' ? (
              <>
                <Check size={10} className="text-emerald-500" /> Copiado
              </>
            ) : (
              <>
                <Copy size={10} /> Copiar link
              </>
            )}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        Aponte a câmera do celular pro QR pra abrir a loja. Login do app é o
        mesmo do web.
      </p>
    </div>
  )
}
