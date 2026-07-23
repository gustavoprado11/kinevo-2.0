import { type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface AuthLayoutProps {
    children: ReactNode
    /** Rótulo em mono acima do headline (padrão: "Para personal trainers"). */
    eyebrow?: string
    tagline: string
    /** Trecho do headline destacado no acento violeta (sólido, não gradiente). */
    taglineAccent: string
    subtitle: string
    /** null esconde o botão voltar. Padrão '/'. */
    backHref?: string | null
    backLabel?: string
    /** Conteúdo abaixo do form (ex.: "Já tem conta? Entrar"). */
    footer?: ReactNode
}

// Classes compartilhadas dos campos/botão — fonte única pra login e cadastro
// falarem o mesmo idioma (superfícies quentes do app, acento violeta sólido).
export const authInputClass =
    'w-full px-3.5 py-3 text-[15px] bg-white text-[#1C1917] border border-[#DBD8D5] rounded-[9px] placeholder-[#B4AEA8] focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 transition'
export const authLabelClass = 'block text-[13px] font-semibold text-[#57534E] mb-1.5'
export const authButtonClass =
    'w-full py-3.5 bg-[#6D28D9] hover:bg-[#5B21B6] active:bg-[#4C1D95] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-[15px] rounded-[9px] transition-colors'

// Semana-modelo mostrada no painel de marca — o vocabulário real de treino como
// textura tipográfica (índice com hairlines + mono), não um cartão decorativo.
const WEEK: [string, string, string][] = [
    ['A', 'Peito & Tríceps', 'seg · 4 ex'],
    ['B', 'Costas & Bíceps', 'qua · 4 ex'],
    ['C', 'Pernas', 'sex · 4 ex'],
]

export function AuthLayout({
    children,
    eyebrow = 'Para personal trainers',
    tagline,
    taglineAccent,
    subtitle,
    backHref = '/',
    backLabel = 'Voltar',
    footer,
}: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex bg-[#FAFAF9]">
            {/* Painel esquerdo — bloco liso escuro, carregado pela tipografia (desktop) */}
            <div className="hidden lg:flex lg:w-[44%] bg-[#141013] text-[#F4F1EE] flex-col justify-between p-12 border-r border-white/[0.06]">
                {/* Marca */}
                <div className="flex items-center gap-2.5">
                    <Image src="/logo-icon.png" alt="Kinevo" width={30} height={30} className="rounded-lg" />
                    <span className="text-lg font-extrabold tracking-tight">Kinevo</span>
                </div>

                {/* Bloco central: eyebrow + headline + subtítulo + semana do aluno */}
                <div className="py-8">
                    <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#8E7FB8]">{eyebrow}</div>
                    <h2 className="mt-4 text-[clamp(28px,3.1vw,37px)] leading-[1.06] font-extrabold tracking-[-0.03em] text-balance max-w-[16ch]">
                        {tagline} <span className="text-[#B7A6F7]">{taglineAccent}</span>
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-[#F4F1EE]/60 max-w-[34ch]">{subtitle}</p>

                    <div className="mt-8 max-w-[21rem]">
                        <div className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-[#F4F1EE]/40 pb-2.5 border-b border-white/[0.12]">
                            Treinos da semana · Raquel
                        </div>
                        {WEEK.map(([k, name, meta]) => (
                            <div key={k} className="flex items-baseline gap-3.5 py-3 border-b border-white/[0.08]">
                                <span className="font-mono text-xs text-[#B7A6F7] w-3">{k}</span>
                                <span className="flex-1 text-[14.5px] font-medium tracking-[-0.01em]">{name}</span>
                                <span className="font-mono text-[11.5px] text-[#F4F1EE]/40 tabular-nums">{meta}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rodapé: prova honesta, sem badge decorativo */}
                <div className="pt-4 border-t border-white/10 text-[13px] text-[#F4F1EE]/50 flex items-center gap-2.5">
                    <span className="font-mono font-bold text-[#F4F1EE]">0%</span>
                    <span>de comissão — você recebe o que cobra do aluno.</span>
                </div>
            </div>

            {/* Painel direito — formulário direto na superfície (sem card flutuante) */}
            <div className="flex-1 flex flex-col min-h-screen">
                {backHref && (
                    <div className="p-6">
                        <Link
                            href={backHref}
                            className="inline-flex items-center gap-2 text-[#8A8580] hover:text-[#57534E] transition-colors text-sm"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 19-7-7 7-7" />
                                <path d="M19 12H5" />
                            </svg>
                            <span>{backLabel}</span>
                        </Link>
                    </div>
                )}

                <div className="flex-1 flex items-center px-6 lg:pl-14 lg:pr-8 pb-12">
                    <div className="w-full max-w-sm mx-auto lg:mx-0">
                        {/* Marca no mobile */}
                        <div className="lg:hidden flex items-center gap-2.5 mb-10">
                            <Image src="/logo-icon.png" alt="Kinevo" width={30} height={30} className="rounded-lg" />
                            <span className="text-lg font-extrabold text-[#1C1917] tracking-tight">Kinevo</span>
                        </div>

                        {children}
                        {footer}

                        {/* Selo de segurança — só no mobile (no desktop o rodapé
                            do painel esquerdo já ancora a confiança). */}
                        <div className="lg:hidden flex items-center gap-2 text-[#B4AEA8] text-xs mt-8">
                            <Lock size={12} />
                            <span>Criptografia de ponta a ponta</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
