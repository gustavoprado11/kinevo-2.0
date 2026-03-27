'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ImagePlus, Send, X, Loader2 } from 'lucide-react'
import { sendMessage } from '@/app/messages/actions'
import type { Message } from '@/types/messages'

interface MessageInputProps {
    studentId: string
    onMessageSent: (msg: Message) => void
}

export function MessageInput({ studentId, onMessageSent }: MessageInputProps) {
    const [text, setText] = useState('')
    const [image, setImage] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 120) + 'px' // max ~4 lines
    }, [text])

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setError('Selecione uma imagem.')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Imagem muito grande. Máximo 5MB.')
            return
        }

        setError(null)
        setImage(file)
        setPreviewUrl(URL.createObjectURL(file))
    }

    const removeImage = useCallback(() => {
        setImage(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }, [previewUrl])

    const handleSubmit = useCallback(async () => {
        const trimmed = text.trim()
        if (!trimmed && !image) return
        if (isSending) return

        setIsSending(true)
        setError(null)

        const formData = new FormData()
        if (trimmed) formData.set('content', trimmed)
        if (image) formData.set('image', image)

        const result = await sendMessage(studentId, formData)

        setIsSending(false)

        if (result.success && result.message) {
            setText('')
            removeImage()
            onMessageSent(result.message)
            textareaRef.current?.focus()
        } else {
            setError(result.error || 'Erro ao enviar.')
        }
    }, [text, image, isSending, studentId, onMessageSent, removeImage])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const canSend = (text.trim().length > 0 || image !== null) && !isSending

    return (
        <div className="border-t border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card px-4 py-3">
            {/* Image preview */}
            {previewUrl && (
                <div className="relative inline-block mb-2">
                    <img
                        src={previewUrl}
                        alt="Preview"
                        className="h-20 rounded-lg object-cover border border-[#E8E8ED] dark:border-k-border-subtle"
                    />
                    <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] flex items-center justify-center"
                    >
                        <X size={10} strokeWidth={2.5} />
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <p className="text-red-500 text-[10px] mb-1.5">{error}</p>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
                {/* Image upload button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-[#86868B] dark:text-k-text-quaternary hover:text-[#007AFF] dark:hover:text-violet-400 transition-colors flex-shrink-0"
                >
                    <ImagePlus size={18} strokeWidth={1.5} />
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleImageSelect}
                    className="hidden"
                />

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => { setText(e.target.value); setError(null) }}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem..."
                    rows={1}
                    className="flex-1 resize-none bg-[#F5F5F7] dark:bg-surface-inset rounded-xl px-3.5 py-2 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder-[#AEAEB2] dark:placeholder-k-text-quaternary outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 max-h-[120px]"
                />

                {/* Send button */}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSend}
                    className="p-2 rounded-full bg-[#007AFF] dark:bg-violet-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0066D6] dark:hover:bg-violet-500 transition-colors flex-shrink-0"
                >
                    {isSending ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Send size={16} strokeWidth={1.5} />
                    )}
                </button>
            </div>
        </div>
    )
}
