'use client'

/**
 * PricingV2 — bloco de planos da nova landing (Kinevo.dc.html), com o segmentado
 * Individual / Estúdios. Renderizado a partir das FONTES ÚNICAS (TIER_DISPLAY e
 * STUDIO_TIERS) para a promessa nunca desalinhar do produto. Vai num slot
 * (#kvlp-pricing-slot) via portal — o cabeçalho da seção fica no SSR (SEO).
 */
import { useState, type CSSProperties } from 'react'
import { Check, Sparkles, Lock, Building2, User, Star } from 'lucide-react'
import { TIER_DISPLAY, type TierDisplay } from '@/lib/billing/tiers'
import { STUDIO_TIERS, type StudioTierDisplay } from '@/lib/studio/studio-tiers'

const SIGNUP = 'https://www.kinevoapp.com/signup'

/** "R$ 39,90" → { main: "R$ 39", dec: ",90" }. "R$ 0" → { main: "R$ 0", dec: "" }. */
function splitPrice(price: string): { main: string; dec: string } {
    const m = price.match(/^(.*?)(,\d+)$/)
    return m ? { main: m[1], dec: m[2] } : { main: price, dec: '' }
}

const cardBase: CSSProperties = {
    height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 22, padding: 26,
    boxShadow: 'var(--kv-shadow-sm)',
}
const neutralCard: CSSProperties = { ...cardBase, background: 'var(--kv-neutral-50)', border: '1px solid var(--kv-border-subtle)' }
const featuredCard: CSSProperties = { ...cardBase, background: 'linear-gradient(180deg,#ffffff,#FAF7FF)', border: '1.5px solid var(--kv-brand-600)', boxShadow: 'var(--kv-shadow-brand)' }
const ctaBase: CSSProperties = { textAlign: 'center', fontSize: 13.5, padding: 12, borderRadius: 11, marginBottom: 18 }
const ctaGhost: CSSProperties = { ...ctaBase, color: 'var(--kv-text-primary)', background: '#fff', border: '1px solid var(--kv-border-default)', fontWeight: 600 }
const ctaBrand: CSSProperties = { ...ctaBase, color: '#fff', background: 'var(--kv-brand-600)', boxShadow: 'var(--kv-shadow-brand-sm)', fontWeight: 700 }
const featItem: CSSProperties = { display: 'flex', gap: 8, fontSize: 13, color: 'var(--kv-text-secondary)' }

/* ───────────────────────────── Individual ───────────────────────────── */

function IndividualCard({ t }: { t: TierDisplay }) {
    const featured = !!t.featured
    const { main, dec } = splitPrice(t.price)
    const href = t.free ? SIGNUP : `${SIGNUP}?tier=${t.tier}`

    // Chip de créditos: featured = brand cheio; free = branco; pago = tint brand-50.
    const chip: CSSProperties = featured
        ? { background: 'var(--kv-brand-600)', boxShadow: 'var(--kv-shadow-brand-sm)' }
        : t.free
          ? { background: '#fff', border: '1px solid var(--kv-border-subtle)' }
          : { background: 'var(--kv-brand-50)', border: '1px solid var(--kv-brand-200)' }

    return (
        <div className="kv-feat" style={featured ? featuredCard : neutralCard}>
            {featured && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start', background: 'var(--kv-brand-600)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 9999, marginBottom: 14 }}>
                    <Star size={12} fill="#fff" /> Recomendado
                </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 700, ...(featured ? { color: 'var(--kv-brand-700)' } : {}) }}>{t.name}</div>
            <div style={{ fontSize: 13, color: 'var(--kv-text-tertiary)', marginTop: 3 }}>{t.tagline}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 18, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{main}</span>
                {dec && <span style={{ fontSize: 17, fontWeight: 600 }}>{dec}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--kv-text-tertiary)', marginTop: 2 }}>{t.priceNote ?? 'por mês'}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 11, padding: '10px 12px', margin: t.creditsHint ? '16px 0 6px' : '16px 0 18px', ...chip }}>
                <Sparkles size={16} color={featured ? '#fff' : t.free ? 'var(--kv-text-tertiary)' : 'var(--kv-brand-600)'} style={{ flexShrink: 0 }} strokeWidth={1.8} />
                {t.creditsPerMonth != null ? (
                    <span style={{ fontSize: 13, color: featured ? '#fff' : 'var(--kv-brand-800)' }}>
                        <strong style={{ fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{t.creditsPerMonth.toLocaleString('pt-BR')}</strong> créditos de IA/mês
                    </span>
                ) : (
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--kv-text-secondary)' }}>{t.credits}</span>
                )}
            </div>
            {t.creditsHint && <div style={{ fontSize: 11.5, color: 'var(--kv-text-tertiary)', margin: '0 0 18px', paddingLeft: 2 }}>{t.creditsHint}</div>}

            <a href={href} className="kv-arrow" style={featured ? ctaBrand : ctaGhost}>{t.cta}</a>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {t.features.map((f) => (
                    <li key={f.label} style={featItem}>
                        {f.state === 'star'
                            ? <Star size={15} color="var(--kv-warning)" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={1.8} />
                            : <Check size={15} color="var(--kv-success)" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={1.8} />}
                        <span>{f.label}</span>
                    </li>
                ))}
            </ul>

            {t.footnote && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--kv-text-tertiary)', marginTop: 'auto', paddingTop: 14, lineHeight: 1.45 }}>
                    <Lock size={13} style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={1.8} /> <span>{t.footnote}</span>
                </div>
            )}
        </div>
    )
}

function IndividualPane() {
    return (
        <div className="kvp-pane">
            <div className="kv-plangrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, alignItems: 'stretch' }}>
                {TIER_DISPLAY.map((t) => (
                    <IndividualCard key={t.tier} t={t} />
                ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--kv-text-tertiary)', margin: '26px 0 0' }}>
                Sem cartão pra testar · alunos ilimitados a partir do Essencial · troque de plano quando quiser.
            </p>
        </div>
    )
}

/* ────────────────────────────── Estúdios ────────────────────────────── */

const STUDIO_FEATURES = ['Treinadores ilimitados', 'Alunos compartilhados na equipe', 'Painel do gestor', 'Cobrança única por estúdio']

function StudioCard({ t }: { t: StudioTierDisplay }) {
    const featured = t.tier === 'studio_100'
    const { main, dec } = splitPrice(t.price)
    const href = t.custom ? '/estudios' : `${SIGNUP}?intent=studio&tier=${t.tier}`
    const cta = t.custom ? 'Falar com a gente' : 'Criar estúdio'
    const ctaStyle: CSSProperties = t.custom
        ? { ...ctaBase, color: 'var(--kv-brand-700)', background: 'var(--kv-brand-50)', border: '1px solid var(--kv-brand-200)', fontWeight: 700 }
        : featured ? ctaBrand : ctaGhost
    // "Até 50 alunos" / "Mais de 200 alunos"
    const cap = t.custom ? 'Mais de 200 alunos' : `Até ${t.studentLimit} alunos`
    const priceNote = t.custom ? 'plano negociado' : 'por mês'

    return (
        <div className="kv-feat" style={featured ? featuredCard : neutralCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="kv-tile" style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', color: 'var(--kv-brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(124,58,237,.14)' }}>
                    <Building2 size={21} strokeWidth={1.8} />
                </div>
                {featured && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--kv-brand-600)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 9999 }}>
                        <Star size={12} fill="#fff" /> Popular
                    </span>
                )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, ...(featured ? { color: 'var(--kv-brand-700)' } : {}) }}>{t.name}</div>
            <div style={{ fontSize: 13, color: 'var(--kv-text-tertiary)', marginTop: 3 }}>{cap}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 18, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: t.custom ? 22 : 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{main}</span>
                {dec && <span style={{ fontSize: 17, fontWeight: 600 }}>{dec}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--kv-text-tertiary)', marginTop: 2 }}>{priceNote}</div>
            <div style={{ height: 1, background: 'var(--kv-border-subtle)', margin: '18px 0' }} />
            <a href={href} className="kv-arrow" style={ctaStyle}>{cta}</a>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {STUDIO_FEATURES.map((f) => (
                    <li key={f} style={featItem}>
                        <Check size={15} color="var(--kv-success)" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={1.8} /> <span>{f}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function StudioPane() {
    return (
        <div className="kvp-pane">
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--kv-text-secondary)', maxWidth: 600, margin: '0 auto 28px' }}>
                Cobrança por organização, não por treinador. Treinadores ilimitados em todas as faixas — o que muda é o teto de alunos.
            </p>
            <div className="kv-plangrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, alignItems: 'stretch' }}>
                {STUDIO_TIERS.map((t) => (
                    <StudioCard key={t.tier} t={t} />
                ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--kv-text-tertiary)', margin: '26px 0 0' }}>
                Créditos de IA são contratados por treinador, à parte do acesso do estúdio.
            </p>
        </div>
    )
}

/* ─────────────────────────────── Tabs ─────────────────────────────── */

export function PricingV2() {
    const [tab, setTab] = useState<'ind' | 'est'>('ind')
    return (
        <>
            <div className="kvp-seg" role="tablist" aria-label="Tipo de plano">
                <button type="button" role="tab" aria-selected={tab === 'ind'} className="kvp-tab" onClick={() => setTab('ind')}>
                    <User size={15} strokeWidth={1.8} /> Individual
                </button>
                <button type="button" role="tab" aria-selected={tab === 'est'} className="kvp-tab" onClick={() => setTab('est')}>
                    <Building2 size={15} strokeWidth={1.8} /> Estúdios
                </button>
            </div>
            {tab === 'ind' ? <IndividualPane /> : <StudioPane />}
        </>
    )
}
