import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    DEFAULT_HEADLINE,
    DEFAULT_HEADLINE_HIGHLIGHT,
    DEFAULT_SUBHEADLINE,
    DEFAULT_SPECIALIZATIONS,
    DEFAULT_PROCESS,
    DEFAULT_FAQ,
    type LandingStats,
    type Testimonial,
    type FaqItem,
    type LandingPlan,
} from '@/lib/landing/defaults'
import { LeadForm } from './_components/LeadForm'
import { mix, rgba } from '@/lib/landing/color'
import { isSectionVisible, type LandingSections } from '@/lib/landing/sections'
import { IOS_APP_URL, ANDROID_APP_URL } from '@/lib/constants/app-links'
import './landing.css'

/* ───────── ISR ───────── */
export const revalidate = 60 // segundos

/* ───────── Tipos ───────── */
interface TrainerRow {
    id: string
    name: string
    avatar_url: string | null
    instagram_handle: string | null
    public_slug: string
    landing_published: boolean
    landing_headline: string | null
    landing_subheadline: string | null
    landing_bio: string | null
    landing_city: string | null
    landing_cref: string | null
    landing_certifications: string[] | null
    landing_specializations: string[] | null
    landing_year_started: number | null
    landing_stats: LandingStats | null
    landing_testimonials: Testimonial[] | null
    landing_faq: FaqItem[] | null
    landing_price_label: string | null
    landing_hero_image_url: string | null
    landing_plans: LandingPlan[] | null
    landing_sections: LandingSections | null
    brand_color: string | null
    brand_logo_url: string | null
    brand_name: string | null
}

/* SELECT explícito: NUNCA `select('*')` aqui — landing é pública e qualquer
   coluna extra (email, theme, auth_user_id, etc.) seria vazada. */
const PUBLIC_COLUMNS =
    'id, name, avatar_url, instagram_handle, ' +
    'public_slug, landing_published, ' +
    'landing_headline, landing_subheadline, landing_bio, landing_city, ' +
    'landing_cref, landing_certifications, landing_specializations, ' +
    'landing_year_started, landing_stats, landing_testimonials, ' +
    'landing_faq, landing_price_label, landing_hero_image_url, landing_plans, landing_sections, ' +
    'brand_color, brand_logo_url, brand_name'

async function fetchTrainer(slug: string): Promise<TrainerRow | null> {
    const normalized = slug.toLowerCase()
    const { data, error } = await supabaseAdmin
        .from('trainers')
        .select(PUBLIC_COLUMNS)
        .eq('public_slug', normalized)
        .eq('landing_published', true)
        .maybeSingle()
    if (error) {
        console.error('[landing] fetchTrainer error:', error)
        return null
    }
    return (data as unknown as TrainerRow) ?? null
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const trainer = await fetchTrainer(slug)
    if (!trainer) {
        return { title: 'Treinador não encontrado · Kinevo' }
    }
    const studio = trainer.brand_name ?? trainer.name
    const headline = trainer.landing_headline ?? DEFAULT_HEADLINE
    return {
        title: `${studio} — Personal Trainer`,
        description: `${headline} ${trainer.landing_subheadline ?? DEFAULT_SUBHEADLINE}`.slice(0, 160),
        openGraph: {
            title: `${studio} — Personal Trainer`,
            description: headline,
            type: 'website',
        },
    }
}

/* ───────── Page ───────── */
export default async function TrainerLandingPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const trainer = await fetchTrainer(slug)
    if (!trainer) notFound()

    /* Brand color tokens (CSS vars inline) */
    const brand = trainer.brand_color || '#7C3AED'
    const brandDark = mix(brand, '#000000', 0.32)
    const brandDeep = mix(brand, '#000000', 0.62)
    const brandSoft = rgba(brand, 0.10)
    const brandMid = rgba(brand, 0.22)

    /* Conteúdo (defaults onde NULL) */
    const studio = trainer.brand_name ?? trainer.name
    const headline = trainer.landing_headline ?? DEFAULT_HEADLINE
    const headlineHighlight = !trainer.landing_headline ? DEFAULT_HEADLINE_HIGHLIGHT : null
    const subheadline = trainer.landing_subheadline ?? DEFAULT_SUBHEADLINE
    const bio = trainer.landing_bio
    const city = trainer.landing_city
    const cref = trainer.landing_cref
    const certifications = trainer.landing_certifications ?? []
    const specializations = trainer.landing_specializations ?? DEFAULT_SPECIALIZATIONS
    const stats: LandingStats = trainer.landing_stats ?? {}
    const yearStarted = trainer.landing_year_started
    const yearsCount = yearStarted ? new Date().getFullYear() - yearStarted : null
    const testimonials = (trainer.landing_testimonials ?? []).slice(0, 6)
    const faq = (trainer.landing_faq && trainer.landing_faq.length > 0) ? trainer.landing_faq : DEFAULT_FAQ
    const priceLabel = trainer.landing_price_label
    const plans = (trainer.landing_plans ?? []).filter((p) => p.name && p.price).slice(0, 4)
    const sections = trainer.landing_sections
    const show = (key: Parameters<typeof isSectionVisible>[1]) => isSectionVisible(sections, key)
    const heroImage = trainer.landing_hero_image_url ?? trainer.avatar_url
    const initial = (trainer.brand_name ?? trainer.name).trim().charAt(0).toUpperCase() || 'K'
    const firstName = trainer.name.split(' ')[0] ?? trainer.name

    /* Aluno fictício para o phone mock — apenas estético */
    const exemploAluno = 'Ana'

    /* Brand vars como style inline na raiz */
    const brandStyle = {
        '--lt-brand': brand,
        '--lt-brand-dark': brandDark,
        '--lt-brand-deep': brandDeep,
        '--lt-brand-soft': brandSoft,
        '--lt-brand-mid': brandMid,
    } as React.CSSProperties

    return (
        <div className="lt-root" style={brandStyle}>
            {/* ─── NAV ─── */}
            <nav className="lt-nav">
                <div className="lt-container">
                    <div className="lt-nav-row">
                        <a href="#top" className="lt-brand-mark">
                            <div className="lt-logo">
                                {trainer.brand_logo_url ? (
                                    <img src={trainer.brand_logo_url} alt={studio} />
                                ) : (
                                    initial
                                )}
                            </div>
                            <div className="lt-brand-names">
                                <b>{trainer.name}</b>
                                <span>{studio}{city ? ` · ${city}` : ''}</span>
                            </div>
                        </a>
                        <a href="#fale" className="lt-btn-pill">
                            Falar agora
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </a>
                    </div>
                </div>
            </nav>

            {/* ─── HERO ─── */}
            <header className="lt-hero" id="top">
                <div className="lt-container">
                    <div className="lt-hero-grid">
                        <div>
                            <div className="lt-eyebrow lt-reveal d1">
                                Personal Trainer{city ? ` · ${city}` : ''}
                            </div>
                            <h1 className="lt-reveal d2">
                                {headline} {headlineHighlight ? <em>{headlineHighlight}</em> : null}
                            </h1>
                            <p className="lt-hero-lede lt-reveal d3">
                                {bio ?? subheadline}
                            </p>
                            <div className="lt-hero-ctas lt-reveal d4">
                                <a href="#fale" className="lt-btn-primary">
                                    Quero ser aluno
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </a>
                                <a href="#processo" className="lt-btn-link">
                                    Conheça o método
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </a>
                            </div>
                            {(stats.students_count || yearsCount || stats.rating) && (
                                <div className="lt-hero-stats lt-reveal d5">
                                    {stats.students_count ? (
                                        <div className="lt-stat">
                                            <b>{stats.students_count}+</b>
                                            <span>Alunos</span>
                                        </div>
                                    ) : null}
                                    {yearsCount && yearsCount > 0 ? (
                                        <div className="lt-stat">
                                            <b>{yearsCount} {yearsCount === 1 ? 'ano' : 'anos'}</b>
                                            <span>De prática</span>
                                        </div>
                                    ) : null}
                                    {stats.rating ? (
                                        <div className="lt-stat">
                                            <b>{stats.rating.toFixed(1)}★</b>
                                            <span>{stats.reviews_count ? `${stats.reviews_count} reviews` : 'Avaliação'}</span>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                        {heroImage && (
                            <div className="lt-reveal d3" style={{ position: 'relative' }}>
                                <div className="lt-portrait-deco" />
                                <div className="lt-portrait-frame">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={heroImage} alt={trainer.name} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ─── CREDENTIALS (renderiza só se houver) ─── */}
            {show('credenciais') && (cref || certifications.length > 0) && (
                <section className="lt-credentials">
                    <div className="lt-container">
                        <div className="lt-credentials-row">
                            <span className="lt-cred-label">Formação</span>
                            {cref && (
                                <span className="lt-cred-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <b>CREF {cref}</b>
                                </span>
                            )}
                            {certifications.map((c, i) => (
                                <span key={i} className="lt-cred-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── MÉTODO + ESPECIALIZAÇÕES ─── */}
            {show('metodo') && (
                <section className="lt-section">
                    <div className="lt-container">
                        <div className="lt-section-eyebrow">O método</div>
                        <h2>
                            Treino não é o que <em>parece bonito.</em> É o que <em>faz sentido</em> pro seu corpo.
                        </h2>
                        <p className="lt-section-lede">
                            Cada programa é desenhado a partir da sua história — anamnese, análise e objetivos reais. Sem treino-padrão de planilha.
                        </p>
                        <div className="lt-chips">
                            {specializations.map((s, i) => (
                                <span key={i} className="lt-chip">{s}</span>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── APP VITRINE ─── */}
            {show('app') && (
            <section className="lt-app-section" id="app">
                <div className="lt-container">
                    <div className="lt-section-eyebrow">Tecnologia própria</div>
                    <h2>
                        Meu método tem <em>app próprio.</em>
                    </h2>
                    <p className="lt-section-lede">
                        Não é planilha de WhatsApp, não é PDF. É um app que eu uso pra acompanhar cada série, cada PR e cada ajuste do seu plano em tempo real.
                    </p>

                    <div className="lt-phones-row">
                        {/* Phone 1: Home faithful (com a marca aplicada) */}
                        <div>
                            <div className="lt-phone">
                                <div className="lt-phone-notch" />
                                <div className="lt-phone-screen">
                                    <div className="lt-rh-header">
                                        <div className="lt-rh-left">
                                            <div className="lt-rh-logo">
                                                {trainer.brand_logo_url ? (
                                                    <img src={trainer.brand_logo_url} alt="" />
                                                ) : initial}
                                            </div>
                                            <div className="lt-rh-meta">
                                                <span className="lt-rh-greet">Boa tarde,</span>
                                                <span className="lt-rh-name">{exemploAluno}</span>
                                                <span className="lt-rh-studio">{studio}</span>
                                            </div>
                                        </div>
                                        <div className="lt-rh-avatar">
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="lt-rh-week">
                                        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => {
                                            const num = 25 + i
                                            const isOn = i === 2
                                            return (
                                                <div key={i} className={isOn ? 'lt-rh-day on' : 'lt-rh-day'}>
                                                    <i>{d}</i>
                                                    <b>{num}</b>
                                                    {(i === 0 || i === 2 || i === 3 || i === 5) && <span className="dot" />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="lt-rh-hero">
                                        <div className="lt-rh-hero-top">
                                            <div className="lt-rh-hero-ic">
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m6.5 6.5 11 11" />
                                                    <path d="m21 21-1-1" />
                                                    <path d="m3 3 1 1" />
                                                    <path d="m18 22 4-4" />
                                                    <path d="m2 6 4-4" />
                                                    <path d="m3 10 7-7" />
                                                    <path d="m14 21 7-7" />
                                                </svg>
                                            </div>
                                            <span className="lt-rh-hero-badge">Agendado</span>
                                        </div>
                                        <div className="lt-rh-hero-eyebrow">Treino de hoje</div>
                                        <div className="lt-rh-hero-title">Peito &amp; Tríceps</div>
                                        <div className="lt-rh-hero-row">
                                            <span className="lt-rh-hero-count">7 exercícios</span>
                                            <span className="lt-rh-hero-start">
                                                <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor">
                                                    <polygon points="6 3 20 12 6 21 6 3" />
                                                </svg>
                                                Iniciar
                                            </span>
                                        </div>
                                    </div>
                                    <div className="lt-rh-conq-eb">Suas conquistas</div>
                                    <div className="lt-rh-conq-row">
                                        <div className="lt-rh-conq-card gold">
                                            <div className="ic">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                    <circle cx="12" cy="8" r="6" />
                                                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                                                </svg>
                                            </div>
                                            <b>3 semanas</b>
                                            <span>perfeitas</span>
                                        </div>
                                        <div className="lt-rh-conq-card brandfill">
                                            <div className="ic">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                                </svg>
                                            </div>
                                            <b>8 sem.</b>
                                            <span>consistente</span>
                                        </div>
                                        <div className="lt-rh-conq-card">
                                            <div className="ic">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                    <path d="m6.5 6.5 11 11" />
                                                </svg>
                                            </div>
                                            <b>34</b>
                                            <span>treinos</span>
                                        </div>
                                    </div>
                                    <div className="lt-rh-nav">
                                        <div className="lt-rh-tab on">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                <polyline points="9 22 9 12 15 12 15 22" />
                                            </svg>
                                        </div>
                                        <div className="lt-rh-tab">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                                            </svg>
                                        </div>
                                        <div className="lt-rh-tab">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                                            </svg>
                                        </div>
                                        <div className="lt-rh-tab">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                        </div>
                                        <div className="lt-rh-tab">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="lt-phones-caption">— Incluso no plano —</p>

                    <div className="lt-store-badges">
                        <a href={IOS_APP_URL} target="_blank" rel="noopener noreferrer" className="lt-store-badge" aria-label="Baixar na App Store">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.95-.03-.01-2.72-1.04-2.75-4.12zM14.53 4.42c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.29.69-3.03 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.33-.58 3.05-1.45z" />
                            </svg>
                            <span><i>Baixar na</i><b>App Store</b></span>
                        </a>
                        <a href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer" className="lt-store-badge" aria-label="Disponível no Google Play">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M3.6 1.84c-.24.25-.38.64-.38 1.15v18.02c0 .51.14.9.39 1.15l.06.06L13.8 12.07v-.14L3.66 1.78l-.06.06z" opacity=".9" />
                                <path fill="currentColor" d="M17.18 15.52l-3.38-3.38v-.14l3.38-3.38.08.04 4 2.27c1.14.65 1.14 1.71 0 2.36l-4 2.27-.08.04z" />
                                <path fill="currentColor" d="M17.26 15.48l-3.46-3.46-10.2 10.2c.38.4 1 .45 1.71.05l11.95-6.79" opacity=".8" />
                                <path fill="currentColor" d="M17.26 8.56L5.31 1.77c-.71-.4-1.33-.35-1.71.05l10.2 10.2 3.46-3.46z" opacity=".7" />
                            </svg>
                            <span><i>Disponível no</i><b>Google Play</b></span>
                        </a>
                    </div>
                </div>
            </section>
            )}

            {/* ─── DEPOIMENTOS ─── */}
            {show('depoimentos') && testimonials.length > 0 && (
                <section className="lt-testimonials" id="depoimentos">
                    <div className="lt-container">
                        <div className="lt-section-eyebrow">Quem treina comigo</div>
                        <h2>Resultado não é <em>promessa.</em> É <em>histórico.</em></h2>
                        <div className="lt-testimonials-grid">
                            {testimonials.map((t, i) => (
                                <figure key={i} className="lt-testimonial">
                                    <blockquote>“{t.quote}”</blockquote>
                                    <figcaption>
                                        {t.photo_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={t.photo_url} alt={t.name} className="lt-testimonial-photo" />
                                        ) : (
                                            <span className="lt-testimonial-initial">
                                                {t.name.trim().charAt(0).toUpperCase() || '•'}
                                            </span>
                                        )}
                                        <span className="lt-testimonial-meta">
                                            <b>{t.name}</b>
                                            {(t.goal || t.role) && <span>{t.goal || t.role}</span>}
                                        </span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── PROCESSO ─── */}
            {show('processo') && (
            <section className="lt-process" id="processo">
                <div className="lt-container">
                    <div className="lt-process-head">
                        <div>
                            <div className="lt-section-eyebrow">Como funciona</div>
                            <h2>Do <em>primeiro contato</em> ao primeiro <em>resultado.</em></h2>
                        </div>
                        <p className="lt-section-lede" style={{ marginBottom: 6, maxWidth: 380 }}>
                            Quatro etapas. Sem fricção. Você sai daqui sabendo exatamente o próximo passo.
                        </p>
                    </div>
                    <div className="lt-process-grid">
                        {DEFAULT_PROCESS.map((step) => (
                            <div key={step.number} className="lt-step">
                                <div className="lt-step-num">{step.number} <em>—</em></div>
                                <h3>{step.title}</h3>
                                <p>{step.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            )}

            {/* ─── FAQ ─── */}
            {show('faq') && (
            <section className="lt-faq" id="faq">
                <div className="lt-container">
                    <div className="lt-faq-grid">
                        <div>
                            <div className="lt-section-eyebrow">Antes de falar</div>
                            <h2>Perguntas que <em>todo mundo</em> faz.</h2>
                            <p className="lt-section-lede" style={{ marginTop: 24 }}>
                                Se a sua não tá aqui, é só perguntar no formulário — eu respondo pessoalmente.
                            </p>
                        </div>
                        <div className="lt-faq-list">
                            {faq.map((item, i) => (
                                <details key={i} className="lt-faq-item" open={i === 0}>
                                    <summary>
                                        <h4>{item.question}</h4>
                                        <span className="lt-faq-plus">
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                                                <line x1="12" y1="5" x2="12" y2="19" />
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                        </span>
                                    </summary>
                                    <div className="lt-faq-content">{item.answer}</div>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
            )}

            {/* ─── PLANOS ─── */}
            {show('planos') && plans.length > 0 && (
                <section className="lt-plans" id="planos">
                    <div className="lt-container">
                        <div className="lt-section-eyebrow">Planos</div>
                        <h2>Escolha como <em>quer treinar.</em></h2>
                        <div className={`lt-plans-grid cols-${Math.min(plans.length, 4)}`}>
                            {plans.map((p, i) => (
                                <div key={i} className={p.highlight ? 'lt-plan highlight' : 'lt-plan'}>
                                    {p.highlight && <span className="lt-plan-badge">Mais escolhido</span>}
                                    <h3 className="lt-plan-name">{p.name}</h3>
                                    <div className="lt-plan-price">
                                        <b>{p.price}</b>
                                        {p.period ? <span>{p.period}</span> : null}
                                    </div>
                                    {p.features.length > 0 && (
                                        <ul className="lt-plan-features">
                                            {p.features.map((f, j) => (
                                                <li key={j}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <a href="#fale" className="lt-plan-cta">Quero esse</a>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── FORM ─── */}
            <section className="lt-form-section" id="fale">
                <div className="lt-container">
                    <div className="lt-section-eyebrow">Próximo passo</div>
                    <h2>Vamos <em>conversar.</em></h2>
                    <p className="lt-section-lede">
                        Conta um pouco sobre você. Eu retorno pessoalmente — geralmente no mesmo dia.
                    </p>

                    <div className="lt-form-grid">
                        <div className="lt-form-side">
                            <div className="lt-meta-block">
                                <div className="lbl">Resposta em</div>
                                <div className="val">Até <em>24h</em></div>
                            </div>
                            {plans.length === 0 && priceLabel && (
                                <div className="lt-meta-block">
                                    <div className="lbl">Plano</div>
                                    <div className="val">{priceLabel}</div>
                                </div>
                            )}
                            {trainer.instagram_handle && (
                                <div className="lt-meta-block">
                                    <div className="lbl">Instagram</div>
                                    <div className="val">
                                        <em>@{trainer.instagram_handle}</em>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="lt-form">
                            <LeadForm slug={trainer.public_slug} trainerFirstName={firstName} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="lt-footer">
                <div className="lt-container">
                    <div className="lt-footer-row">
                        <div className="lt-brand-mark">
                            <div className="lt-logo">
                                {trainer.brand_logo_url ? (
                                    <img src={trainer.brand_logo_url} alt="" />
                                ) : initial}
                            </div>
                            <div className="lt-brand-names">
                                <b>{trainer.name}</b>
                                <span>{studio}{cref ? ` · CREF ${cref}` : ''}</span>
                            </div>
                        </div>
                        <a className="lt-powered" href="https://www.kinevoapp.com" target="_blank" rel="noopener noreferrer" aria-label="Powered by Kinevo — abrir site">
                            powered by{' '}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="lt-k" src="/logo-icon.png" alt="Kinevo" />
                            <b>Kinevo</b>
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    )
}
