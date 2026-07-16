/**
 * PricingV2 — bloco de cards de preço da nova landing, renderizado a partir de
 * TIER_DISPLAY (fonte única — promessa nunca desalinha do produto). Visual fiel
 * ao Claude Design. Substitui o markup estático que vinha no .dc.html.
 */
import type { CSSProperties } from 'react'
import { Check, Sparkles, Lock, Building2 } from 'lucide-react'
import { TIER_DISPLAY, type TierDisplay } from '@/lib/billing/tiers'
import { PURCHASABLE_STUDIO_TIERS } from '@/lib/studio/studio-tiers'

const SIGNUP = 'https://www.kinevoapp.com/signup'

/** "R$ 39,90" → { main: "R$ 39", dec: ",90" }. "R$ 0" → { main: "R$ 0", dec: "" }. */
function splitPrice(price: string): { main: string; dec: string } {
    const m = price.match(/^(.*?)(,\d+)$/)
    return m ? { main: m[1], dec: m[2] } : { main: price, dec: '' }
}

function PriceCard({ t }: { t: TierDisplay }) {
    const featured = !!t.featured
    const { main, dec } = splitPrice(t.price)
    const href = t.free ? SIGNUP : `${SIGNUP}?tier=${t.tier}`

    const card: CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        background: featured ? '#fff' : 'var(--kv-neutral-50)',
        border: featured ? '2px solid var(--kv-brand-600)' : '1px solid var(--kv-border-subtle)',
        borderRadius: 20,
        padding: 24,
        position: 'relative',
        ...(featured ? { boxShadow: 'var(--kv-shadow-brand)' } : {}),
    }

    // Chip de créditos: pro = preenchido violeta; pago = tint brand-50; free = branco.
    const chip: CSSProperties = featured
        ? { background: 'var(--kv-brand-600)', boxShadow: 'var(--kv-shadow-brand-sm)' }
        : t.free
          ? { background: '#fff', border: '1px solid var(--kv-border-subtle)' }
          : { background: 'var(--kv-brand-50)', border: '1px solid var(--kv-brand-200)' }
    const chipText = featured ? '#fff' : t.free ? 'var(--kv-text-secondary)' : 'var(--kv-brand-800)'
    const chipIcon = featured ? '#fff' : t.free ? 'var(--kv-text-tertiary)' : 'var(--kv-brand-600)'

    const ctaStyle: CSSProperties = featured
        ? { color: '#fff', background: 'var(--kv-brand-600)', boxShadow: 'var(--kv-shadow-brand-sm)', fontWeight: 700 }
        : { color: 'var(--kv-text-primary)', background: '#fff', border: '1px solid var(--kv-border-default)', fontWeight: 600 }

    return (
        <div style={card}>
            {featured && (
                <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--kv-brand-600)', padding: '5px 14px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    ★ Recomendado
                </span>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, ...(featured ? { color: 'var(--kv-brand-700)' } : {}) }}>{t.name}</div>
            <div style={{ fontSize: 13, color: 'var(--kv-text-tertiary)', marginBottom: 14 }}>{t.tagline}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {main}
                {dec && <span style={{ fontSize: 16, fontWeight: 600 }}>{dec}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--kv-text-tertiary)' }}>{t.priceNote ?? 'por mês'}</div>

            {/* Chip de créditos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: t.free ? 7 : 8, borderRadius: 11, padding: t.free ? '9px 11px' : '10px 12px', margin: t.free ? '14px 0 18px' : '14px 0 6px', ...chip }}>
                <Sparkles size={t.free ? 15 : 16} color={chipIcon} style={{ flexShrink: 0 }} strokeWidth={1.6} />
                {t.creditsPerMonth != null ? (
                    <span style={{ fontSize: 13, color: chipText }}>
                        <strong style={{ fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                            {t.creditsPerMonth.toLocaleString('pt-BR')}
                        </strong>{' '}
                        créditos de IA/mês
                    </span>
                ) : (
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: chipText }}>{t.credits}</span>
                )}
            </div>
            {t.creditsHint && (
                <div style={{ fontSize: 11.5, color: 'var(--kv-text-tertiary)', margin: '0 0 18px', paddingLeft: 2 }}>{t.creditsHint}</div>
            )}

            <a href={href} style={{ textAlign: 'center', fontSize: 13.5, padding: 11, borderRadius: 11, marginBottom: 18, ...ctaStyle }}>
                {t.cta}
            </a>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {t.features.map((f) => (
                    <li key={f.label} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--kv-text-secondary)' }}>
                        <Check size={15} color="var(--kv-success)" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={1.6} />
                        <span>{f.label}</span>
                    </li>
                ))}
            </ul>

            {t.footnote && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--kv-text-tertiary)', marginTop: 13, lineHeight: 1.45 }}>
                    <Lock size={13} style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={1.6} />
                    {t.footnote}
                </div>
            )}
        </div>
    )
}

/** Faixa "Estúdios" — produto por organização (não por treinador). Abaixo do
 *  grid solo, resume as faixas por nº de alunos e leva ao signup. */
function StudioBanner() {
    const faixas = PURCHASABLE_STUDIO_TIERS.map(t => `${t.name} (${t.studentLimit}) ${t.price}`).join(' · ')
    return (
        <div
            className="studio-banner"
            style={{
                marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, padding: '20px 24px', borderRadius: 16,
                border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.06)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', flexShrink: 0 }}>
                    <Building2 size={22} />
                </div>
                <div>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>Tem uma equipe? Kinevo Estúdios</p>
                    <p style={{ fontSize: 13, opacity: 0.7 }}>Vários treinadores, alunos compartilhados e painel do gestor — a partir de R$ 219,90/mês. {faixas}.</p>
                </div>
            </div>
            <a href={SIGNUP} style={{ flexShrink: 0, fontSize: 13.5, fontWeight: 700, padding: '11px 20px', borderRadius: 11, background: '#8b5cf6', color: '#fff', textAlign: 'center' }}>
                Criar estúdio
            </a>
        </div>
    )
}

export function PricingV2() {
    return (
        <>
            <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, alignItems: 'stretch' }}>
                {TIER_DISPLAY.map((t) => (
                    <PriceCard key={t.tier} t={t} />
                ))}
            </div>
            <StudioBanner />
        </>
    )
}
