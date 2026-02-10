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
            className="w-full inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {pending ? 'Salvando...' : 'Salvar alterações'}
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
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-card-foreground">Perfil</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Dados públicos da sua conta.</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <User size={18} />
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
                className="space-y-5"
            >
                <div className="flex flex-col items-center text-center">
                    <div className="relative">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ring-2 ring-violet-500/50">
                            {avatarPreview ? (
                                <Image
                                    src={avatarPreview}
                                    alt="Avatar do treinador"
                                    width={96}
                                    height={96}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <span className="text-lg font-semibold text-foreground">{initials}</span>
                            )}
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        id="avatar"
                        name="avatar"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={handleChooseAvatar}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                        <Camera size={14} />
                        Alterar foto
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">PNG, JPG ou WEBP.</p>
                </div>

                <div className="space-y-4 pt-1">
                    <div>
                        <label htmlFor="name" className="mb-1.5 block text-sm text-foreground">
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
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                            placeholder="Seu nome"
                        />
                    </div>

                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-sm text-foreground">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={trainer.email}
                            disabled
                            className="w-full cursor-not-allowed rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground"
                        />
                    </div>
                </div>

                {message && (
                    <div
                        className={`rounded-xl border px-3 py-2 text-sm ${
                            message.type === 'success'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="border-t border-border pt-2">
                    <SaveButton />
                </div>
            </form>
        </div>
    )
}
