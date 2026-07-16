import type { Metadata } from 'next'
import Link from 'next/link'
import {
    Building2,
    Users,
    LayoutDashboard,
    Repeat,
    Lock,
    Dumbbell,
    Bell,
    Check,
    ArrowRight,
} from 'lucide-react'
import { STUDIO_TIERS } from '@/lib/studio/studio-tiers'

export const metadata: Metadata = {
    title: 'Kinevo Estúdios — gestão completa para estúdios de personal training',
    description:
        'Vários treinadores, alunos compartilhados, painel do gestor e biblioteca de exercícios do estúdio. Planos por número de alunos a partir de R$ 219,90/mês, treinadores ilimitados.',
    alternates: { canonical: 'https://www.kinevoapp.com/estudios' },
    openGraph: {
        title: 'Kinevo Estúdios',
        description: 'A plataforma do seu estúdio: equipe, alunos compartilhados e visão do gestor — a partir de R$ 219,90/mês.',
        url: 'https://www.kinevoapp.com/estudios',
    },
}

const SIGNUP_STUDIO = '/signup?intent=studio'

const FEATURES = [
    {
        icon: Users,
        title: 'Alunos compartilhados',
        body: 'Todo treinador do estúdio vê e atende os alunos do estúdio — um coach substitui o outro no treino sem fricção, no web e no app.',
    },
    {
        icon: LayoutDashboard,
        title: 'Painel do gestor',
        body: 'Visão geral do estúdio: alunos ativos, treinos da semana e aderência por treinador, além dos alunos em risco — no web e no app.',
    },
    {
        icon: Repeat,
        title: 'Coach substituto de verdade',
        body: 'Conduza a sessão de qualquer aluno do estúdio pela Sala de Treino, com o programa prescrito pelo colega e atribuição correta nos números.',
    },
    {
        icon: Dumbbell,
        title: 'Biblioteca do estúdio',
        body: 'Exercícios e vídeos customizados são compartilhados entre a equipe — e o aluno vê o vídeo certo, não importa quem prescreveu.',
    },
    {
        icon: Lock,
        title: 'Carteira particular separada',
        body: 'Cada treinador pode manter os próprios alunos particulares na mesma conta, invisíveis ao estúdio e fora da faixa cobrada.',
    },
    {
        icon: Bell,
        title: 'Gestor sempre informado',
        body: 'Notificações de treinos e formulários dos alunos do estúdio, aviso ao se aproximar do limite da faixa e alerta se a cobrança falhar.',
    },
]

const STEPS = [
    { n: '1', title: 'Crie o estúdio', body: 'Dê um nome, escolha a faixa pelo nº de alunos e pague no Stripe. Ativa na hora.' },
    { n: '2', title: 'Convide a equipe', body: 'Adicione treinadores por e-mail — cada um define a própria senha e já entra vendo os alunos do estúdio.' },
    { n: '3', title: 'Opere junto', body: 'Prescrição, treinos, formulários e avaliações compartilhados; o gestor acompanha tudo pelo painel.' },
]

const FAQ = [
    {
        q: 'Quantos treinadores posso ter?',
        a: 'Ilimitados, em todas as faixas. O plano do estúdio é cobrado pelo número de alunos, nunca pela equipe.',
    },
    {
        q: 'E se um treinador tiver alunos particulares?',
        a: 'Ele mantém a carteira própria na mesma conta com um plano pessoal do Kinevo — os particulares ficam invisíveis ao estúdio e não contam na faixa.',
    },
    {
        q: 'O que acontece se eu atingir o limite de alunos?',
        a: 'O gestor é avisado ao chegar em 80% da faixa. No limite, novos cadastros são bloqueados até fazer upgrade — a troca de faixa é imediata, com valor proporcional.',
    },
    {
        q: 'O estúdio cobra os alunos pelo Kinevo?',
        a: 'A cobrança dos alunos fica a cargo do estúdio, fora da plataforma. O plano Kinevo Estúdios cobre a operação: treinos, equipe, acompanhamento e gestão.',
    },
]

export default function EstudiosPage() {
    return (
        <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
            {/* Header */}
            <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white text-sm font-black">K</span>
                    Kinevo
                </Link>
                <div className="flex items-center gap-3">
                    <Link href="/login" className="text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F]">Entrar</Link>
                    <Link
                        href={SIGNUP_STUDIO}
                        className="rounded-full bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9]"
                    >
                        Criar estúdio
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <section className="mx-auto max-w-4xl px-6 pt-14 pb-12 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED]">
                    <Building2 size={28} />
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                    O seu estúdio inteiro,<br />
                    <span className="text-[#7C3AED]">numa plataforma só.</span>
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-lg text-[#6E6E73]">
                    Vários treinadores, alunos compartilhados e a visão do gestor — com a mesma prescrição,
                    Sala de Treino e app do aluno que os melhores personais já usam no Kinevo.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                        href={SIGNUP_STUDIO}
                        className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-[#6D28D9]"
                    >
                        Criar meu estúdio <ArrowRight size={18} />
                    </Link>
                    <span className="text-sm text-[#86868B]">A partir de R$ 219,90/mês · treinadores ilimitados</span>
                </div>
            </section>

            {/* Features */}
            <section className="mx-auto max-w-6xl px-6 py-12">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map(f => (
                        <div key={f.title} className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]">
                                <f.icon size={20} />
                            </div>
                            <h3 className="text-base font-bold">{f.title}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-[#6E6E73]">{f.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Como funciona */}
            <section className="mx-auto max-w-4xl px-6 py-12">
                <h2 className="text-center text-2xl font-bold">Como funciona</h2>
                <div className="mt-8 grid gap-5 sm:grid-cols-3">
                    {STEPS.map(s => (
                        <div key={s.n} className="text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-black text-white">{s.n}</div>
                            <h3 className="font-bold">{s.title}</h3>
                            <p className="mt-1 text-sm text-[#6E6E73]">{s.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Preços */}
            <section className="mx-auto max-w-6xl px-6 py-12">
                <h2 className="text-center text-2xl font-bold">Planos por número de alunos</h2>
                <p className="mt-2 text-center text-[#6E6E73]">Treinadores ilimitados em todas as faixas. Só mensal, cancele quando quiser.</p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {STUDIO_TIERS.map(t => (
                        <div key={t.tier} className="flex flex-col rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
                            <h3 className="font-bold">{t.name}</h3>
                            <p className="mt-2 text-2xl font-bold">
                                {t.price}
                                {!t.custom && <span className="text-sm font-normal text-[#86868B]">/mês</span>}
                            </p>
                            <p className="mt-1 flex-1 text-sm text-[#6E6E73]">{t.blurb}</p>
                            <ul className="mt-4 space-y-1.5 text-sm text-[#6E6E73]">
                                <li className="flex items-center gap-1.5"><Check size={14} className="text-[#34C759]" /> Treinadores ilimitados</li>
                                <li className="flex items-center gap-1.5"><Check size={14} className="text-[#34C759]" /> Painel do gestor</li>
                                <li className="flex items-center gap-1.5"><Check size={14} className="text-[#34C759]" /> App do aluno incluso</li>
                            </ul>
                            {t.custom ? (
                                <a
                                    href="mailto:contato@kinevoapp.com?subject=Kinevo%20Est%C3%BAdio%20200%2B"
                                    className="mt-5 rounded-xl border border-[#D2D2D7] py-2.5 text-center text-sm font-bold hover:bg-[#F5F5F7]"
                                >
                                    Falar com a gente
                                </a>
                            ) : (
                                <Link
                                    href={SIGNUP_STUDIO}
                                    className="mt-5 rounded-xl bg-[#7C3AED] py-2.5 text-center text-sm font-bold text-white hover:bg-[#6D28D9]"
                                >
                                    Começar agora
                                </Link>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section className="mx-auto max-w-3xl px-6 py-12">
                <h2 className="text-center text-2xl font-bold">Perguntas frequentes</h2>
                <div className="mt-8 space-y-4">
                    {FAQ.map(item => (
                        <div key={item.q} className="rounded-2xl border border-black/[0.06] bg-white p-5">
                            <h3 className="font-bold">{item.q}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-[#6E6E73]">{item.a}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA final */}
            <section className="mx-auto max-w-4xl px-6 pb-20 pt-8 text-center">
                <div className="rounded-3xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] px-8 py-12 text-white shadow-xl shadow-violet-500/20">
                    <h2 className="text-3xl font-bold">Monte seu estúdio no Kinevo hoje</h2>
                    <p className="mx-auto mt-3 max-w-xl text-white/85">
                        Ativação imediata, sem implantação e sem contrato de fidelidade. Sua equipe operando junta em minutos.
                    </p>
                    <Link
                        href={SIGNUP_STUDIO}
                        className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-[#7C3AED] hover:bg-white/90"
                    >
                        Criar meu estúdio <ArrowRight size={18} />
                    </Link>
                </div>
                <p className="mt-10 text-xs text-[#86868B]">
                    <Link href="/" className="underline underline-offset-2 hover:text-[#6E6E73]">Kinevo para personal trainers</Link>
                    {' · '}
                    <Link href="/privacy" className="underline underline-offset-2 hover:text-[#6E6E73]">Privacidade</Link>
                    {' · '}
                    <Link href="/terms" className="underline underline-offset-2 hover:text-[#6E6E73]">Termos</Link>
                </p>
            </section>
        </div>
    )
}
