'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
    Inbox,
    UserCog,
    Crown,
    Moon,
    LogOut,
    User,
    Users,
    Dumbbell,
    ChevronRight,
    ExternalLink,
    Instagram,
    Wifi,
    LayoutGrid,
    MessageSquare,
    ClipboardList,
    MoreHorizontal,
    Home,
    LineChart,
} from 'lucide-react'

/**
 * Mockup fiel do app mobile pro slide "Aluno ⇄ Treinador" do onboarding.
 *
 * Reproduz a aba "Mais" do treinador (com o card hero, seções e a linha
 * "Modo Aluno") e, em loop, a troca pro app do aluno (home com calendário da
 * semana + "Seus Treinos"). Reconstruído a partir do código real do mobile
 * (`app/(trainer-tabs)/more.tsx`, `app/(tabs)/home.tsx`, `UnifiedCalendar`,
 * `WorkoutList`) na paleta dark real do app.
 *
 * O celular renderiza SEMPRE no tema dark do app (independe do tema do web) —
 * por isso as cores são hex fixos (mesma estratégia de hex hardcoded do resto
 * do app). Respeita prefers-reduced-motion (mostra a aba Mais estática).
 */
export function ModeSwitchMockup() {
    const reduce = useReducedMotion()
    const repeat = reduce ? 0 : Infinity
    const loop = { duration: 7.5, ease: 'easeInOut' as const, repeat }

    const trainerAnim = reduce
        ? { opacity: 1 }
        : { opacity: [1, 1, 0, 0, 1, 1], y: [0, 0, -8, -8, 0, 0] }
    const trainerTimes = [0, 0.32, 0.42, 0.84, 0.93, 1]

    const studentAnim = reduce
        ? { opacity: 0 }
        : { opacity: [0, 0, 1, 1, 0, 0], y: [8, 8, 0, 0, 8, 8] }
    const studentTimes = [0, 0.32, 0.42, 0.84, 0.93, 1]

    const ctaShadow = reduce
        ? {}
        : {
              boxShadow: [
                  '0 0 0 0 rgba(124,58,237,0)',
                  '0 0 0 5px rgba(124,58,237,0.16)',
                  '0 0 0 0 rgba(124,58,237,0)',
                  '0 0 0 0 rgba(124,58,237,0)',
              ],
          }
    const ctaTimes = [0, 0.18, 0.28, 1]

    const tapAnim = reduce
        ? { opacity: 0 }
        : { opacity: [0, 0, 0.32, 0, 0], scale: [0.4, 0.4, 1, 1.9, 1.9] }
    const tapTimes = [0, 0.18, 0.24, 0.33, 1]

    return (
        <div className="flex justify-center">
            <div className="relative w-[268px] overflow-hidden rounded-[44px] border-[8px] border-[#050506] bg-[#09090B] text-[#FAFAFA] shadow-2xl">
                {/* Dynamic island */}
                <span className="absolute left-1/2 top-[9px] z-20 h-[21px] w-[82px] -translate-x-1/2 rounded-full bg-black" />
                {/* Status bar */}
                <div className="relative z-10 flex items-center justify-between px-5 pb-[3px] pt-[11px] text-xs font-bold text-[#FAFAFA]">
                    <span>13:21</span>
                    <span className="flex items-center gap-[5px]">
                        <span className="flex items-end gap-[2px]">
                            <span className="h-[4px] w-[3px] rounded-[1px] bg-[#FAFAFA]" />
                            <span className="h-[7px] w-[3px] rounded-[1px] bg-[#FAFAFA]" />
                            <span className="h-[10px] w-[3px] rounded-[1px] bg-[#FAFAFA]/40" />
                            <span className="h-[13px] w-[3px] rounded-[1px] bg-[#FAFAFA]/40" />
                        </span>
                        <Wifi className="h-[13px] w-[13px]" />
                        <span className="flex items-center gap-[3px]">
                            <span className="text-[11px] font-bold">74</span>
                            <span className="relative h-[11px] w-[20px] rounded-[3px] border-[1.3px] border-[#FAFAFA]">
                                <span className="absolute inset-[1.3px] w-[70%] rounded-[1px] bg-[#FAFAFA]" />
                                <span className="absolute -right-[3px] top-[3px] h-[4px] w-[2px] rounded-r-sm bg-[#FAFAFA]" />
                            </span>
                        </span>
                    </span>
                </div>

                {/* Stage: duas telas sobrepostas com cross-fade */}
                <div className="relative h-[534px]">
                    {/* ── TREINADOR: aba Mais ── */}
                    <motion.div
                        className="absolute inset-0 flex flex-col bg-[#09090B]"
                        initial={{ opacity: 1 }}
                        animate={trainerAnim}
                        transition={{ ...loop, times: trainerTimes }}
                    >
                        <div className="flex flex-1 flex-col gap-2 overflow-hidden px-[15px]">
                            <div className="mb-0.5 mt-0.5 text-[24px] font-extrabold tracking-tight text-[#FAFAFA]">Mais</div>

                            {/* Hero */}
                            <div className="relative flex items-center gap-[11px] overflow-hidden rounded-2xl p-[14px]" style={{ background: 'linear-gradient(135deg,#18181B 0%,#27272A 55%,#4C1D95 140%)' }}>
                                <span className="pointer-events-none absolute -right-[26px] -top-[46px] h-[120px] w-[120px] rounded-full bg-[#8B5CF6] opacity-20" />
                                <span className="relative h-[46px] w-[46px] flex-none rounded-full bg-[#7C3AED] p-[2px]">
                                    <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-[15px] font-extrabold text-[#6D28D9]">GP</span>
                                </span>
                                <div className="relative">
                                    <div className="flex items-center gap-[7px]">
                                        <span className="text-[15px] font-extrabold tracking-tight text-white">Gustavo Prado</span>
                                        <span className="rounded-[5px] border border-[#F59E0B]/40 bg-[#F59E0B]/[0.18] px-1.5 py-px text-[9px] font-extrabold tracking-wide text-[#FCD34D]">PRO</span>
                                    </div>
                                    <div className="mt-[3px] text-[11px] text-white/60">gustavocostap11@gmail.com</div>
                                </div>
                            </div>

                            <MaisSection label="Captação" />
                            <MaisCard>
                                <MaisRow icon={<Inbox className="h-4 w-4" />} tint title="Leads" sub="Vindos da sua landing pública" trailing={<ChevronRight className="h-4 w-4 text-[#52525B]" />} />
                            </MaisCard>

                            <MaisSection label="Conta" />
                            <MaisCard>
                                <MaisRow
                                    icon={<UserCog className="h-4 w-4" />}
                                    tint
                                    title="Editar perfil"
                                    sub={
                                        <span className="flex items-center gap-1">
                                            <Instagram className="h-[13px] w-[13px]" />@gustavocprado
                                        </span>
                                    }
                                    trailing={<ChevronRight className="h-4 w-4 text-[#52525B]" />}
                                />
                                <MaisRow
                                    icon={<Crown className="h-4 w-4" />}
                                    iconClass="bg-[#F59E0B]/[0.14] text-[#F59E0B]"
                                    title="Assinatura Kinevo"
                                    sub={
                                        <span className="mt-[3px] inline-flex items-center gap-1 rounded-full bg-[#10B981]/[0.14] px-2 py-[2px] text-[10px] font-bold text-[#10B981]">
                                            <span className="h-[5px] w-[5px] rounded-full bg-current" />Pro · ativa
                                        </span>
                                    }
                                    trailing={<ExternalLink className="h-4 w-4 text-[#52525B]" />}
                                />
                                <MaisRow icon={<Moon className="h-4 w-4" />} tint title="Aparência" sub="Escuro" trailing={<ChevronRight className="h-4 w-4 text-[#52525B]" />} />
                            </MaisCard>

                            <MaisSection label="Suporte" />
                            <MaisCard>
                                <MaisRow icon={<LogOut className="h-4 w-4" />} iconClass="bg-[#EF4444]/[0.12] text-[#EF4444]" title={<span className="text-[#EF4444]">Sair da conta</span>} />
                            </MaisCard>
                        </div>

                        {/* Rodapé fixo: Modo Aluno + versão */}
                        <div className="flex-none px-[15px] pt-2.5">
                            <motion.div
                                className="relative flex items-center gap-3 rounded-[20px] border border-[#7C3AED]/[0.28] bg-[#7C3AED]/[0.16] px-4 py-[15px]"
                                animate={ctaShadow}
                                transition={{ ...loop, times: ctaTimes }}
                            >
                                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[#7C3AED]/20 text-[#8B5CF6]">
                                    <User className="h-4 w-4" />
                                </span>
                                <span className="flex-1 text-[15px] font-semibold text-[#8B5CF6]">Modo Aluno</span>
                                <ChevronRight className="h-4 w-4 text-[#8B5CF6]" />
                                <motion.span
                                    aria-hidden
                                    className="pointer-events-none absolute left-7 top-1/2 -mt-[18px] h-[36px] w-[36px] rounded-full bg-[#7C3AED]"
                                    initial={{ opacity: 0, scale: 0.4 }}
                                    animate={tapAnim}
                                    transition={{ ...loop, times: tapTimes }}
                                />
                            </motion.div>
                            <div className="py-2.5 text-center text-[10px] text-[#52525B]">Kinevo v1.5.8 — Modo Treinador</div>
                        </div>

                        <TabBar
                            active="Mais"
                            tabs={[
                                { label: 'Dashboard', icon: <LayoutGrid className="h-[18px] w-[18px]" /> },
                                { label: 'Alunos', icon: <Users className="h-[18px] w-[18px]" /> },
                                { label: 'Mensagens', icon: <MessageSquare className="h-[18px] w-[18px]" /> },
                                { label: 'Formulários', icon: <ClipboardList className="h-[18px] w-[18px]" />, badge: '1' },
                                { label: 'Mais', icon: <MoreHorizontal className="h-[18px] w-[18px]" /> },
                            ]}
                        />
                    </motion.div>

                    {/* ── ALUNO: home ── */}
                    <motion.div
                        className="absolute inset-0 flex flex-col bg-[#09090B]"
                        initial={{ opacity: 0 }}
                        animate={studentAnim}
                        transition={{ ...loop, times: studentTimes }}
                    >
                        <div className="flex flex-1 flex-col gap-2 overflow-hidden px-[15px]">
                            <div className="flex items-center gap-[11px] pb-1 pt-1">
                                <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[#7C3AED] text-[13px] font-extrabold text-white">GP</span>
                                <div>
                                    <div className="text-xs font-medium text-[#71717A]">Boa tarde,</div>
                                    <div className="-mt-px text-[20px] font-bold tracking-tight text-[#FAFAFA]">Gustavo</div>
                                </div>
                            </div>

                            {/* Calendário da semana (UnifiedCalendar) */}
                            <div className="mb-2 mt-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[2px] text-[#52525B]">
                                <span>14/07 — 20/07</span>
                            </div>
                            <div className="mb-1.5 flex justify-between">
                                {WEEK.map((d) => (
                                    <div key={d.n} className="flex w-[34px] flex-col items-center">
                                        <span className="mb-[9px] text-[10px] font-normal uppercase tracking-[3px] text-[#52525B]">{d.dow}</span>
                                        <span
                                            className={
                                                'flex h-9 w-9 items-center justify-center rounded-full text-sm ' +
                                                (d.sel
                                                    ? 'bg-[#7C3AED] font-bold text-white'
                                                    : d.today
                                                      ? 'font-semibold text-[#FAFAFA]'
                                                      : 'text-[#71717A]')
                                            }
                                        >
                                            {d.n}
                                        </span>
                                        <span className={'mt-1.5 h-[5px] w-[5px] rounded-full ' + (d.done ? 'bg-[#22c55e]' : 'bg-transparent')} />
                                    </div>
                                ))}
                            </div>

                            {/* Seus Treinos (WorkoutList) */}
                            <div className="mb-1 mt-2 text-[20px] font-bold tracking-[0.3px] text-[#FAFAFA]">Seus Treinos</div>
                            <WorkoutRow name="Treino A · Peito e tríceps" sub="6 exercícios" tag="Feito hoje" />
                            <WorkoutRow name="Treino B · Costas e bíceps" sub="7 exercícios" />
                        </div>

                        <TabBar
                            active="Início"
                            tabs={[
                                { label: 'Início', icon: <Home className="h-[18px] w-[18px]" /> },
                                { label: 'Mensagens', icon: <MessageSquare className="h-[18px] w-[18px]" /> },
                                { label: 'Histórico', icon: <LineChart className="h-[18px] w-[18px]" /> },
                                { label: 'Perfil', icon: <User className="h-[18px] w-[18px]" /> },
                            ]}
                        />
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

const WEEK: { dow: string; n: string; done?: boolean; today?: boolean; sel?: boolean }[] = [
    { dow: 'S', n: '14', done: true },
    { dow: 'T', n: '15' },
    { dow: 'Q', n: '16', done: true },
    { dow: 'Q', n: '17', today: true, sel: true },
    { dow: 'S', n: '18' },
    { dow: 'S', n: '19' },
    { dow: 'D', n: '20' },
]

function MaisSection({ label }: { label: string }) {
    return <div className="-mb-0.5 mt-[7px] text-[8.5px] font-extrabold uppercase tracking-[0.13em] text-[#71717A]">{label}</div>
}

function MaisCard({ children }: { children: React.ReactNode }) {
    return <div className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#18181B] [&>*+*]:border-t [&>*+*]:border-white/[0.05]">{children}</div>
}

function MaisRow({
    icon,
    title,
    sub,
    trailing,
    tint,
    iconClass,
}: {
    icon: React.ReactNode
    title: React.ReactNode
    sub?: React.ReactNode
    trailing?: React.ReactNode
    tint?: boolean
    iconClass?: string
}) {
    return (
        <div className="flex items-center gap-[11px] px-3 py-2.5">
            <span className={'flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] ' + (iconClass ?? (tint ? 'bg-[#7C3AED]/[0.12] text-[#8B5CF6]' : ''))}>{icon}</span>
            <div className="min-w-0">
                <div className="text-[13px] font-semibold leading-tight text-[#FAFAFA]">{title}</div>
                {sub && <div className="mt-0.5 flex items-center gap-[3px] text-[11px] text-[#71717A]">{sub}</div>}
            </div>
            {trailing && <span className="ml-auto flex-none">{trailing}</span>}
        </div>
    )
}

function WorkoutRow({ name, sub, tag }: { name: string; sub: string; tag?: string }) {
    return (
        <div className="mt-3 flex items-center gap-3.5 rounded-[20px] border border-white/[0.08] bg-[#18181B] px-[18px] py-4 first:mt-0">
            <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-[#7C3AED]/[0.12] text-[#8B5CF6]">
                <Dumbbell className="h-[22px] w-[22px]" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[#FAFAFA]">{name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[#52525B]">
                    {sub}
                    {tag && <span className="rounded-md bg-[#10B981]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#16a34a]">{tag}</span>}
                </div>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 flex-none text-[#52525B]" />
        </div>
    )
}

function TabBar({ tabs, active }: { tabs: { label: string; icon: React.ReactNode; badge?: string }[]; active: string }) {
    return (
        <div className="flex flex-none items-start justify-around border-t border-white/[0.08] bg-[#09090B]/60 px-0.5 pb-3 pt-[7px]">
            {tabs.map((t) => (
                <span key={t.label} className={'relative flex flex-col items-center gap-[3px] text-[8px] font-semibold ' + (t.label === active ? 'text-[#8B5CF6]' : 'text-[#71717A]')}>
                    {t.icon}
                    {t.label}
                    {t.badge && (
                        <span className="absolute -top-1 right-[5px] flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-[#EF4444] px-[3px] text-[8px] font-extrabold text-white">
                            {t.badge}
                        </span>
                    )}
                </span>
            ))}
        </div>
    )
}
