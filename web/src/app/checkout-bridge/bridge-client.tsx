'use client'

import { useEffect, useState } from 'react'

const APP_STORE_IOS = 'https://apps.apple.com/br/app/kinevo/id6759053587'
const APP_STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.kinevo.mobile'

interface Props {
    result: 'success' | 'canceled'
}

export function CheckoutBridgeClient({ result }: Props) {
    const [phase, setPhase] = useState<'detecting' | 'redirecting' | 'fallback'>('detecting')
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase()
        const isMobileUA = /android|iphone|ipad|ipod/.test(ua)
        // Defensive: iPad/iPhone em "Solicitar site para desktop" reporta UA
        // Macintosh mas mantém touchscreen. maxTouchPoints>1 cobre.
        const hasTouchAndMac = navigator.maxTouchPoints > 1 && /macintosh/.test(ua)
        const mobile = isMobileUA || hasTouchAndMac
        setIsMobile(mobile)

        if (!mobile) {
            window.location.replace(
                result === 'success'
                    ? '/dashboard?checkout=success'
                    : '/subscription/blocked?checkout=canceled'
            )
            return
        }

        setPhase('redirecting')
        const deepLink =
            result === 'success'
                ? 'kinevo://dashboard?checkout=success'
                : 'kinevo://subscription-blocked?checkout=canceled'

        window.location.href = deepLink

        const fallbackTimer = setTimeout(() => setPhase('fallback'), 2000)
        return () => clearTimeout(fallbackTimer)
    }, [result])

    if (!isMobile || phase === 'detecting' || phase === 'redirecting') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-6">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                    <h1 className="text-xl font-bold text-slate-900">
                        {result === 'success' ? 'Pagamento confirmado!' : 'Voltando ao app...'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">Abrindo o Kinevo no seu celular...</p>
                </div>
            </div>
        )
    }

    const deepLink =
        result === 'success'
            ? 'kinevo://dashboard?checkout=success'
            : 'kinevo://subscription-blocked?checkout=canceled'

    const successCopy = result === 'success'
    return (
        <div className="min-h-screen flex items-center justify-center bg-white p-6">
            <div className="max-w-md w-full text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${successCopy ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <svg className={`w-8 h-8 ${successCopy ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={successCopy ? 'M5 13l4 4L19 7' : 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">
                    {successCopy ? 'Pagamento confirmado!' : 'Pagamento cancelado'}
                </h1>
                <p className="text-sm text-slate-500 mt-2 mb-6">
                    {successCopy
                        ? 'Não conseguimos abrir o app automaticamente. Toque no botão abaixo pra voltar ao Kinevo.'
                        : 'Você pode tentar novamente no app.'}
                </p>
                <a
                    href={deepLink}
                    className="block w-full py-3 px-6 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors"
                >
                    Abrir Kinevo
                </a>
                <p className="text-xs text-slate-400 mt-6 mb-3">Não tem o app instalado?</p>
                <div className="flex gap-2 justify-center">
                    <a href={APP_STORE_IOS} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline">iOS · App Store</a>
                    <span className="text-slate-300">·</span>
                    <a href={APP_STORE_ANDROID} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline">Android · Play Store</a>
                </div>
            </div>
        </div>
    )
}
