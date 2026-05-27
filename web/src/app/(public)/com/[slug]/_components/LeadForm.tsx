'use client'

import { useState, useTransition } from 'react'
import { submitTrainerLead } from '@/actions/leads/submit-trainer-lead'
import { GOAL_OPTIONS, LEVEL_OPTIONS } from '@/lib/landing/defaults'

interface LeadFormProps {
    slug: string
    trainerFirstName: string
}

/**
 * Formulário da landing pública — captação de leads.
 * Honeypot field (`hp`) detecta bots. Submete via server action.
 */
export function LeadForm({ slug, trainerFirstName }: LeadFormProps) {
    const [isPending, startTransition] = useTransition()
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [goal, setGoal] = useState<string | null>(null)
    const [level, setLevel] = useState<string | null>(null)

    const handleSubmit = (formData: FormData) => {
        setError(null)
        startTransition(async () => {
            const result = await submitTrainerLead({
                slug,
                name: String(formData.get('name') ?? ''),
                email: String(formData.get('email') ?? ''),
                whatsapp: String(formData.get('whatsapp') ?? ''),
                goal,
                level,
                message: String(formData.get('message') ?? '') || null,
                hp: String(formData.get('hp') ?? ''),
            })
            if (!result.success) {
                setError(result.message)
                return
            }
            setSubmitted(true)
        })
    }

    if (submitted) {
        return (
            <div className="lt-form-success">
                <b>Recebi sua mensagem.</b>
                <span>Retorno em até 24h — geralmente no mesmo dia. Fica de olho no WhatsApp, {trainerFirstName} vai falar com você.</span>
            </div>
        )
    }

    return (
        <form action={handleSubmit} className="lt-form" noValidate>
            {/* Honeypot: visualmente oculto, bots preenchem */}
            <input
                className="lt-honeypot"
                type="text"
                name="hp"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
            />

            <div className="lt-field-row">
                <div className="lt-field">
                    <label htmlFor="name">Nome</label>
                    <input id="name" name="name" type="text" placeholder="Como te chamo?" required minLength={2} maxLength={100} />
                </div>
                <div className="lt-field">
                    <label htmlFor="whatsapp">WhatsApp</label>
                    <input id="whatsapp" name="whatsapp" type="tel" placeholder="(31) 9 0000-0000" required minLength={8} maxLength={30} />
                </div>
            </div>

            <div className="lt-field">
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" placeholder="seu@email.com" required maxLength={200} />
            </div>

            <div className="lt-field">
                <label>Seu objetivo principal</label>
                <div className="lt-field-chips" role="group" aria-label="Objetivo">
                    {GOAL_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={goal === opt.value ? 'on' : ''}
                            onClick={() => setGoal(goal === opt.value ? null : opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="lt-field">
                <label>Seu nível atual</label>
                <div className="lt-field-chips" role="group" aria-label="Nível">
                    {LEVEL_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={level === opt.value ? 'on' : ''}
                            onClick={() => setLevel(level === opt.value ? null : opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="lt-field">
                <label htmlFor="message">Quer contar algo a mais? (opcional)</label>
                <textarea id="message" name="message" maxLength={1000} placeholder="Histórico de treino, lesões, rotina de trabalho..." />
            </div>

            {error && <div className="lt-form-error">{error}</div>}

            <div className="lt-form-submit">
                <button type="submit" className="lt-btn-primary" disabled={isPending}>
                    {isPending ? 'Enviando…' : 'Enviar mensagem'}
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
                <span className="lt-note">
                    <span className="lt-note-dot" />
                    Resposta em até 24h
                </span>
            </div>
        </form>
    )
}
