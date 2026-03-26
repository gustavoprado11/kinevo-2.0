'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Bug, Lightbulb, MessageCircle, ImagePlus, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitFeedback } from '@/actions/submit-feedback'

interface FeedbackModalProps {
    isOpen: boolean
    onClose: () => void
}

type FeedbackType = 'bug' | 'suggestion' | 'other'

const TYPE_OPTIONS: { value: FeedbackType; icon: React.ElementType; label: string; description: string }[] = [
    { value: 'bug', icon: Bug, label: 'Bug', description: 'Algo não funcionou' },
    { value: 'suggestion', icon: Lightbulb, label: 'Sugestão', description: 'Tenho uma ideia' },
    { value: 'other', icon: MessageCircle, label: 'Outro', description: 'Outro assunto' },
]

const PLACEHOLDER_BY_TYPE: Record<FeedbackType, string> = {
    bug: 'Descreva o que aconteceu e o que você esperava...',
    suggestion: 'Descreva sua ideia...',
    other: 'Como podemos ajudar?',
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const [type, setType] = useState<FeedbackType | null>(null)
    const [description, setDescription] = useState('')
    const [screenshot, setScreenshot] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const resetForm = useCallback(() => {
        setType(null)
        setDescription('')
        setScreenshot(null)
        setPreviewUrl(null)
        setError(null)
        setSuccess(false)
    }, [])

    const handleClose = useCallback(() => {
        resetForm()
        onClose()
    }, [onClose, resetForm])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setError('Selecione um arquivo de imagem.')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Imagem muito grande. Máximo 5MB.')
            return
        }

        setError(null)
        setScreenshot(file)
        setPreviewUrl(URL.createObjectURL(file))
    }

    const removeScreenshot = () => {
        setScreenshot(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!type) {
            setError('Selecione o tipo de feedback.')
            return
        }
        if (!description.trim() || description.trim().length < 10) {
            setError('Descreva com mais detalhes (mínimo 10 caracteres).')
            return
        }

        setIsSubmitting(true)

        const formData = new FormData()
        formData.set('type', type)
        formData.set('description', description.trim())
        formData.set('pageUrl', window.location.pathname)
        if (screenshot) formData.set('screenshot', screenshot)

        const result = await submitFeedback(formData)

        setIsSubmitting(false)

        if (result.success) {
            setSuccess(true)
            setTimeout(handleClose, 2000)
        } else {
            setError(result.message)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl dark:border dark:border-transparent dark:backdrop-blur-xl dark:ring-1 dark:ring-k-border-primary animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-inset px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-white tracking-tight">
                            Feedback & Bugs
                        </h2>
                        <p className="text-xs text-[#86868B] dark:text-muted-foreground/60 font-medium mt-0.5">
                            Ajude-nos a melhorar o Kinevo
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="h-8 w-8 text-[#AEAEB2] dark:text-muted-foreground/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </Button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 mb-4">
                                <CheckCircle2 className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white mb-1">
                                Obrigado!
                            </h3>
                            <p className="text-sm text-[#86868B] dark:text-muted-foreground/60">
                                Seu feedback foi enviado com sucesso.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Type selector */}
                            <div>
                                <label className="block text-xs font-semibold text-[#86868B] dark:text-muted-foreground/60 uppercase tracking-wider mb-2.5">
                                    Tipo
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {TYPE_OPTIONS.map((opt) => {
                                        const Icon = opt.icon
                                        const selected = type === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setType(opt.value)}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150 ${
                                                    selected
                                                        ? 'border-[#007AFF] dark:border-violet-500 bg-[#007AFF]/5 dark:bg-violet-500/10'
                                                        : 'border-[#E8E8ED] dark:border-k-border-subtle hover:border-[#AEAEB2] dark:hover:border-k-border-primary bg-white dark:bg-transparent'
                                                }`}
                                            >
                                                <Icon
                                                    size={18}
                                                    strokeWidth={1.5}
                                                    className={selected
                                                        ? 'text-[#007AFF] dark:text-violet-400'
                                                        : 'text-[#AEAEB2] dark:text-muted-foreground/60'
                                                    }
                                                />
                                                <span className={`text-[11px] font-semibold ${
                                                    selected
                                                        ? 'text-[#007AFF] dark:text-violet-400'
                                                        : 'text-[#6E6E73] dark:text-muted-foreground/60'
                                                }`}>
                                                    {opt.label}
                                                </span>
                                                <span className="text-[9px] text-[#AEAEB2] dark:text-muted-foreground/40 leading-tight text-center">
                                                    {opt.description}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="feedback-desc" className="block text-xs font-semibold text-[#86868B] dark:text-muted-foreground/60 uppercase tracking-wider mb-2">
                                    Descrição
                                </label>
                                <textarea
                                    id="feedback-desc"
                                    rows={4}
                                    required
                                    placeholder={type ? PLACEHOLDER_BY_TYPE[type] : 'Selecione o tipo acima...'}
                                    value={description}
                                    onChange={(e) => { setDescription(e.target.value); setError(null) }}
                                    className="w-full rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-inset px-4 py-3 text-sm text-[#1D1D1F] dark:text-foreground placeholder-[#AEAEB2] dark:placeholder-muted-foreground/40 outline-none focus:border-[#007AFF] dark:focus:border-violet-500 focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 transition-colors resize-none"
                                />
                            </div>

                            {/* Screenshot */}
                            <div>
                                <label className="block text-xs font-semibold text-[#86868B] dark:text-muted-foreground/60 uppercase tracking-wider mb-2">
                                    Screenshot <span className="font-normal normal-case text-[#AEAEB2] dark:text-muted-foreground/40">(opcional)</span>
                                </label>

                                {previewUrl ? (
                                    <div className="relative rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle overflow-hidden">
                                        <img
                                            src={previewUrl}
                                            alt="Screenshot preview"
                                            className="w-full max-h-48 object-contain bg-[#F5F5F7] dark:bg-surface-inset"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeScreenshot}
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                                        >
                                            <Trash2 size={14} strokeWidth={1.5} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-[#E8E8ED] dark:border-k-border-subtle hover:border-[#AEAEB2] dark:hover:border-k-border-primary bg-[#FAFAFA] dark:bg-surface-inset/50 transition-colors"
                                    >
                                        <ImagePlus size={20} strokeWidth={1.5} className="text-[#AEAEB2] dark:text-muted-foreground/40" />
                                        <span className="text-xs text-[#AEAEB2] dark:text-muted-foreground/40">
                                            Clique para adicionar uma imagem
                                        </span>
                                    </button>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <p className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {error}
                                </p>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0066D6] dark:hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Enviar Feedback'
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
