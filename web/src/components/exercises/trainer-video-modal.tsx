'use client'

import { useState, useRef } from 'react'
import { X, Upload, Link, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveTrainerVideoMetadata, deleteTrainerVideo } from '@/actions/exercises/manage-trainer-video'
import { VideoPlayer } from './video-player'
import { isLikelyHEVC, canBrowserPlayVideo, convertVideoToWebM } from '@/lib/video-utils'

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.webm']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export interface TrainerVideoData {
    video_url: string
    video_type: 'upload' | 'external_url'
}

interface TrainerVideoModalProps {
    isOpen: boolean
    onClose: () => void
    exerciseId: string
    exerciseName: string
    currentCustomVideo: TrainerVideoData | null
    onSuccess: (video: TrainerVideoData | null) => void
}

type TabMode = 'upload' | 'link'

export function TrainerVideoModal({
    isOpen,
    onClose,
    exerciseId,
    exerciseName,
    currentCustomVideo,
    onSuccess,
}: TrainerVideoModalProps) {
    const [tab, setTab] = useState<TabMode>(currentCustomVideo?.video_type === 'external_url' ? 'link' : 'upload')
    const [externalUrl, setExternalUrl] = useState(currentCustomVideo?.video_type === 'external_url' ? currentCustomVideo.video_url : '')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [transcodeStatus, setTranscodeStatus] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!isOpen) return null

    const validateFile = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return 'Formato não suportado. Use MP4, MOV ou WebM.'
        }
        if (file.size > MAX_FILE_SIZE) {
            return 'Arquivo muito grande. Máximo 50MB.'
        }
        return null
    }

    const handleFileSelect = (file: File) => {
        const err = validateFile(file)
        if (err) {
            setError(err)
            return
        }
        setError(null)
        setSelectedFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) handleFileSelect(file)
    }

    const handleSaveUpload = async () => {
        if (!selectedFile) return
        setUploading(true)
        setError(null)
        setUploadProgress(5)
        setTranscodeStatus(null)

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Sessão inválida')

            // Determine which file to upload — convert HEVC if needed
            let fileToUpload = selectedFile
            let needsConversion = false

            if (isLikelyHEVC(selectedFile)) {
                setTranscodeStatus('Verificando compatibilidade...')
                const canPlay = await canBrowserPlayVideo(selectedFile)

                if (!canPlay) {
                    needsConversion = true
                    setTranscodeStatus('Convertendo vídeo para formato compatível...')
                    setUploadProgress(10)

                    const converted = await convertVideoToWebM(selectedFile, (percent) => {
                        // Map conversion progress to 10-60% of total progress
                        setUploadProgress(10 + Math.round(percent * 0.5))
                    })

                    if (converted) {
                        fileToUpload = converted
                        setTranscodeStatus(null)
                    } else {
                        // Conversion failed — upload original with warning
                        console.warn('[TrainerVideoModal] Client-side conversion failed, uploading original')
                        setTranscodeStatus(null)
                        needsConversion = false
                    }
                }
            }

            setUploadProgress(needsConversion ? 65 : 30)
            setTranscodeStatus(null)

            const ext = fileToUpload.name.split('.').pop()?.toLowerCase() || 'mp4'
            const storagePath = `${user.id}/${exerciseId}/${Date.now()}_video.${ext}`

            // Set correct content-type
            let uploadContentType = fileToUpload.type
            if (uploadContentType === 'video/quicktime') {
                uploadContentType = 'video/mp4'
            } else if (!uploadContentType || uploadContentType === '') {
                uploadContentType = ext === 'webm' ? 'video/webm' : 'video/mp4'
            }

            const { error: uploadError } = await supabase.storage
                .from('trainer-videos')
                .upload(storagePath, fileToUpload, {
                    upsert: true,
                    contentType: uploadContentType,
                })

            if (uploadError) throw uploadError

            setUploadProgress(85)

            const { data: publicData } = supabase.storage
                .from('trainer-videos')
                .getPublicUrl(storagePath)

            const result = await saveTrainerVideoMetadata({
                exerciseId,
                videoType: 'upload',
                videoUrl: publicData.publicUrl,
                storagePath,
                originalFilename: selectedFile.name, // Keep original filename for reference
                fileSizeBytes: fileToUpload.size,
            })

            if (!result.success) throw new Error(result.message)

            setUploadProgress(100)
            onSuccess({ video_url: publicData.publicUrl, video_type: 'upload' })
            onClose()
        } catch (err: any) {
            console.error('[TrainerVideoModal] Upload error:', err)
            setError(err.message || 'Falha no upload.')
            setTranscodeStatus(null)
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const handleSaveLink = async () => {
        const url = externalUrl.trim()
        if (!url) {
            setError('Insira uma URL.')
            return
        }

        try {
            new URL(url)
        } catch {
            setError('URL inválida.')
            return
        }

        setUploading(true)
        setError(null)

        try {
            const result = await saveTrainerVideoMetadata({
                exerciseId,
                videoType: 'external_url',
                videoUrl: url,
            })

            if (!result.success) throw new Error(result.message)

            onSuccess({ video_url: url, video_type: 'external_url' })
            onClose()
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar link.')
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = async () => {
        setDeleting(true)
        setError(null)

        try {
            const result = await deleteTrainerVideo(exerciseId)
            if (!result.success) throw new Error(result.message)

            onSuccess(null)
            onClose()
        } catch (err: any) {
            setError(err.message || 'Erro ao remover vídeo.')
        } finally {
            setDeleting(false)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-white dark:bg-surface-card rounded-2xl shadow-2xl border border-[#E8E8ED] dark:border-k-border-primary flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-k-text-primary">Meu vídeo</h2>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary truncate mt-0.5">{exerciseName}</p>
                    </div>
                    <button onClick={onClose} className="text-[#AEAEB2] dark:text-muted-foreground hover:text-[#6E6E73] dark:hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Current video preview */}
                    {currentCustomVideo && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-[#86868B] dark:text-k-text-quaternary uppercase tracking-wider">Vídeo atual</p>
                            <VideoPlayer url={currentCustomVideo.video_url} title={exerciseName} />
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-[#F5F5F7] dark:bg-surface-inset rounded-lg">
                        <button
                            onClick={() => { setTab('upload'); setError(null) }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                                tab === 'upload'
                                    ? 'bg-white dark:bg-surface-card text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                    : 'text-[#86868B] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-k-text-secondary'
                            }`}
                        >
                            <Upload size={14} />
                            Upload
                        </button>
                        <button
                            onClick={() => { setTab('link'); setError(null) }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                                tab === 'link'
                                    ? 'bg-white dark:bg-surface-card text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                    : 'text-[#86868B] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-k-text-secondary'
                            }`}
                        >
                            <Link size={14} />
                            Link externo
                        </button>
                    </div>

                    {/* Upload tab */}
                    {tab === 'upload' && (
                        <div className="space-y-3">
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-[#D2D2D7] dark:border-k-border-primary rounded-xl p-6 text-center cursor-pointer hover:border-[#007AFF] dark:hover:border-violet-500/50 transition-colors"
                            >
                                <Upload size={24} className="mx-auto mb-2 text-[#AEAEB2] dark:text-k-text-quaternary" />
                                {selectedFile ? (
                                    <div>
                                        <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">{selectedFile.name}</p>
                                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-1">{formatSize(selectedFile.size)}</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary">Arraste um vídeo ou clique para selecionar</p>
                                        <p className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary mt-1">MP4, MOV ou WebM (máx. 50MB)</p>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_EXTENSIONS.join(',')}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileSelect(file)
                                }}
                            />
                            {uploading && uploadProgress > 0 && (
                                <div className="space-y-2">
                                    <div className="h-1.5 bg-[#F5F5F7] dark:bg-surface-inset rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#007AFF] dark:bg-violet-500 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    {transcodeStatus && (
                                        <div className="flex items-center gap-2 text-xs text-[#86868B] dark:text-k-text-quaternary">
                                            <RefreshCw size={12} className="animate-spin" />
                                            <span>{transcodeStatus}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Link tab */}
                    {tab === 'link' && (
                        <div className="space-y-2">
                            <input
                                type="url"
                                placeholder="https://www.youtube.com/watch?v=... ou link direto"
                                value={externalUrl}
                                onChange={(e) => { setExternalUrl(e.target.value); setError(null) }}
                                className="w-full px-4 py-2.5 rounded-lg border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-inset text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-violet-500/30 focus:border-[#007AFF] dark:focus:border-violet-500"
                            />
                            <p className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">YouTube, Vimeo, ou URL direta de vídeo</p>
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-[#FF3B30] dark:text-red-400">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#E8E8ED] dark:border-k-border-subtle flex items-center gap-3">
                    {currentCustomVideo && (
                        <button
                            onClick={handleRemove}
                            disabled={deleting || uploading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#FF3B30] dark:text-red-400 hover:bg-[#FF3B30]/5 dark:hover:bg-red-400/10 transition-colors disabled:opacity-50"
                        >
                            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Remover
                        </button>
                    )}

                    <div className="flex-1" />

                    <button
                        onClick={onClose}
                        disabled={uploading || deleting}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[#6E6E73] dark:text-k-text-tertiary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={tab === 'upload' ? handleSaveUpload : handleSaveLink}
                        disabled={uploading || deleting || (tab === 'upload' && !selectedFile) || (tab === 'link' && !externalUrl.trim())}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0066D6] dark:hover:bg-violet-700 transition-colors disabled:opacity-50"
                    >
                        {uploading && <Loader2 size={14} className="animate-spin" />}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    )
}
