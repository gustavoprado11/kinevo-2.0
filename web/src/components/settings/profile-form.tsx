'use client'

import Image from 'next/image'
import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, User } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { updateTrainerProfile } from '@/actions/trainer/update-profile'

type TrainerProfile = {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    landing_cref?: string | null
}

interface ProfileFormProps {
    trainer: TrainerProfile
}

function SaveButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {pending ? 'Salvando...' : 'Salvar'}
        </button>
    )
}

function getInitials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

export function ProfileForm({ trainer }: ProfileFormProps) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [name, setName] = useState(trainer.name)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(trainer.avatar_url ?? null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const handleChooseAvatar = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Selecione um arquivo de imagem válido.' })
            event.target.value = ''
            return
        }

        const objectUrl = URL.createObjectURL(file)
        setAvatarPreview(objectUrl)
    }

    const initials = getInitials(name || trainer.name)

    return (
        <div className="flex h-full flex-col rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm">
            {/* Header slim */}
            <div className="mb-5 flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-k-text-primary">Perfil</h2>
                    <p className="text-xs text-k-text-tertiary">Dados públicos da sua conta.</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <User size={16} strokeWidth={1.5} />
                </div>
            </div>

            <form
                action={async (formData: FormData) => {
                    setMessage(null)
                    const result = await updateTrainerProfile(formData)

                    if (!result.success) {
                        setMessage({ type: 'error', text: result.message })
                        return
                    }

                    setName(result.name || name)
                    if (typeof result.avatarUrl !== 'undefined') {
                        setAvatarPreview(result.avatarUrl)
                    }
                    setMessage({ type: 'success', text: result.message })
                    router.refresh()
                }}
                className="flex flex-1 flex-col gap-4"
            >
                {/* Linha avatar + campos */}
                <div className="flex items-start gap-5">
                    <div className="flex flex-none flex-col items-center gap-2">
                        <button
                            type="button"
                            onClick={handleChooseAvatar}
                            className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-k-border-primary bg-surface-inset ring-2 ring-violet-500/30 transition-all hover:ring-violet-500/60"
                            aria-label="Alterar foto"
                        >
                            {avatarPreview ? (
                                <Image
                                    src={avatarPreview}
                                    alt="Avatar do treinador"
                                    width={64}
                                    height={64}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <span className="text-base font-semibold text-k-text-tertiary">{initials}</span>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                <Camera size={16} />
                            </span>
                        </button>
                        <input
                            ref={fileInputRef}
                            id="avatar"
                            name="avatar"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
                        <div>
                            <label htmlFor="name" className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                Nome
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                minLength={2}
                                className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary placeholder:text-k-text-quaternary transition-all focus:border-violet-500/50 focus:outline-none"
                                placeholder="Seu nome"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={trainer.email}
                                disabled
                                className="w-full cursor-not-allowed rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-quaternary"
                            />
                            <p className="mt-1 text-[11px] text-k-text-quaternary">
                                O e-mail de acesso não pode ser alterado por aqui.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="cref" className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                CREF
                            </label>
                            <input
                                id="cref"
                                name="cref"
                                type="text"
                                defaultValue={trainer.landing_cref ?? ''}
                                maxLength={40}
                                className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary placeholder:text-k-text-quaternary transition-all focus:border-violet-500/50 focus:outline-none"
                                placeholder="Ex: 012345-G/SP"
                            />
                            <p className="mt-1 text-[11px] text-k-text-quaternary">
                                Obrigatório para validar prescrições da Consultoria IA — vira o carimbo legal do programa.
                            </p>
                        </div>
                    </div>
                </div>

                {message && (
                    <div
                        className={`rounded-lg border px-3 py-2 text-xs ${message.type === 'success'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="mt-auto flex justify-end pt-2">
                    <SaveButton />
                </div>
            </form>
        </div>
    )
}
