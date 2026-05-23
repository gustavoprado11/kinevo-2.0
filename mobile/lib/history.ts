/**
 * Helpers puros do redesign de `Histórico de Treinos`.
 *
 * Sem React — só lógica + formatação. Consumido por WeekGoalCard, JourneyCard
 * e ActivityRow (components/history/*) e testável isoladamente.
 *
 * Convenção de semana: domingo 00:00 → sábado 23:59 (igual ao resto do app,
 * ver shared/utils/schedule-projection getWeekRange). A spec usa segunda como
 * início, mas alinhamos com a meta semanal (useActiveProgram.weeklyProgress)
 * pra os números baterem.
 */
import type { HistorySession } from '../hooks/useWorkoutHistory';

/* ─── Formatação numérica (pt-BR) ─── */

/** Toneladas com vírgula decimal. `formatTon(45500, 1)` → "45,5". */
export function formatTon(volumeKg: number, decimals = 1): string {
    const tons = volumeKg / 1000;
    return tons.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/** Duração semanal compacta: `8100` → "2:15h". */
export function formatDurationHm(totalSec: number): string {
    const totalMin = Math.round(totalSec / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${String(m).padStart(2, '0')}h`;
}

/** Horas arredondadas pro JourneyCard: `61200` → "17". */
export function formatHours(totalSec: number): string {
    return String(Math.round(totalSec / 3600));
}

/* ─── Dias da semana pt-BR (narrativa) ─── */

const WEEKDAY_PT: { label: string; preposition: 'no' | 'na' }[] = [
    { label: 'domingo', preposition: 'no' }, // 0
    { label: 'segunda', preposition: 'na' },
    { label: 'terça', preposition: 'na' },
    { label: 'quarta', preposition: 'na' },
    { label: 'quinta', preposition: 'na' },
    { label: 'sexta', preposition: 'na' },
    { label: 'sábado', preposition: 'no' }, // 6
];

/** "no sábado" / "na sexta". */
function weekdayPhrase(dow: number): string {
    const w = WEEKDAY_PT[dow];
    return `${w.preposition} ${w.label}`;
}

/* ─── Datas ─── */

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

function dateKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Domingo 00:00 da semana que contém `ref`. */
export function startOfWeek(ref: Date = new Date()): Date {
    const d = startOfDay(ref);
    return addDays(d, -d.getDay());
}

/** Mês curto pt-BR sem ponto: "mai". */
function shortMonth(d: Date): string {
    return d
        .toLocaleDateString('pt-BR', { month: 'short' })
        .replace('.', '')
        .toLowerCase();
}

/** Range da semana em label: "18–24 mai." ou "29 mai – 4 jun". */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    if (sameMonth) {
        return `${weekStart.getDate()}–${weekEnd.getDate()} ${shortMonth(weekEnd)}.`;
    }
    return `${weekStart.getDate()} ${shortMonth(weekStart)} – ${weekEnd.getDate()} ${shortMonth(weekEnd)}`;
}

/** Data longa de um treino: "Sex, 22 mai · 12:54". */
export function formatActivityDate(iso: string): string {
    const d = new Date(iso);
    const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const weekday = wd.charAt(0).toUpperCase() + wd.slice(1);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${weekday}, ${d.getDate()} ${shortMonth(d)} · ${time}`;
}

/** Data de início da jornada: "12 de setembro" ou "começou há 8 dias". */
export function formatJourneyStart(first: Date | null): string {
    if (!first) return '';
    const days = Math.floor((Date.now() - first.getTime()) / 86400000);
    if (days < 30) {
        return days <= 0 ? 'começou hoje' : `começou há ${days} dia${days === 1 ? '' : 's'}`;
    }
    const label = first.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    return `desde ${label}`;
}

/* ─── Categoria do treino (cor do ícone na ActivityRow) ─── */

export type WorkoutCategory = 'inferior' | 'superior' | 'fullbody' | 'cardio' | 'default';

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getWorkoutCategory(name: string): WorkoutCategory {
    const n = normalize(name);
    if (/(cardio|corrida|run|aerob|aero|bike|esteira|hiit|spinning)/.test(n)) return 'cardio';
    if (/(full ?body|corpo inteiro|corpo todo|fullbody)/.test(n)) return 'fullbody';
    if (/(inferior|perna|leg|lower|gluteo|posterior|quadr|panturrilha)/.test(n)) return 'inferior';
    if (/(superior|upper|peito|costas|ombro|biceps|triceps|push|pull|braco|dorsal)/.test(n)) return 'superior';
    return 'default';
}

/* ─── Intensidade (apresentação) ─── */

export type IntensityLevel = 'leve' | 'moderado' | 'intenso';

/**
 * Classificação de apresentação derivada do volume da sessão. Mantém o limiar
 * existente (>8000 kg = intenso, igual `is_intense`), refinando os outros dois
 * patamares pra rotular toda sessão.
 */
export function getIntensity(volumeKg: number): IntensityLevel {
    if (volumeKg > 8000) return 'intenso';
    if (volumeKg >= 4000) return 'moderado';
    return 'leve';
}

/* ─── Narrativa da semana (WeekGoalCard) ─── */

export interface WeekNarrativeInput {
    goal: number;
    completed: number;
    daysRemainingInWeek: number;
    favoriteRemainingWeekday?: string;
}

export interface WeekNarrative {
    heading: string;
    subline: string;
}

function plural(n: number, singular: string, pluralForm: string): string {
    return n === 1 ? singular : pluralForm;
}

/**
 * Seleciona o estado narrativo conforme handoff-historico/narrative-states.json.
 * Ordem importa: zero treinos e meta batida são tratados antes dos casos "faltam N".
 */
export function getWeekNarrative({
    goal,
    completed,
    daysRemainingInWeek,
    favoriteRemainingWeekday,
}: WeekNarrativeInput): WeekNarrative {
    const remaining = goal - completed;

    if (completed >= goal) {
        return {
            heading: 'Meta batida.',
            subline: `Você completou ${completed} ${plural(completed, 'treino', 'treinos')} esta semana — bom trabalho.`,
        };
    }

    if (completed === 0) {
        return {
            heading: 'Semana ainda em branco.',
            subline: 'Comece quando quiser — uma sessão já conta.',
        };
    }

    if (remaining === 1) {
        if (favoriteRemainingWeekday) {
            return {
                heading: 'Você está no ritmo.',
                subline: `Falta 1 treino para bater a meta — você costuma fechar a semana ${favoriteRemainingWeekday}.`,
            };
        }
        return {
            heading: 'Quase lá.',
            subline: 'Mais 1 treino fecha a meta semanal.',
        };
    }

    if (remaining <= daysRemainingInWeek) {
        return {
            heading: 'Dá pra fechar.',
            subline: `Faltam ${remaining} treinos — restam ${daysRemainingInWeek} dias na semana.`,
        };
    }

    return {
        heading: 'Semana corrida.',
        subline: `Faltam ${remaining} treinos com ${daysRemainingInWeek} dias restando — vê se rola encaixar amanhã.`,
    };
}

/* ─── WeekGoalCard data ─── */

export interface WeekGoalData {
    weekStart: Date;
    weekEnd: Date;
    goal: number;
    completed: number;
    volumeKg: number;
    totalSets: number;
    totalDurationSec: number;
    favoriteRemainingWeekday?: string;
    daysRemainingInWeek: number;
}

/** Dia da semana (0-6) em que o aluno mais treina historicamente. */
function favoriteWeekday(history: HistorySession[]): number | null {
    if (history.length === 0) return null;
    const counts = new Array(7).fill(0);
    for (const s of history) counts[new Date(s.completed_at).getDay()]++;
    let best = 0;
    for (let i = 1; i < 7; i++) if (counts[i] > counts[best]) best = i;
    return counts[best] > 0 ? best : null;
}

export function buildWeekGoalData(history: HistorySession[], goal: number): WeekGoalData {
    const now = new Date();
    const wkStart = startOfWeek(now);
    const wkEnd = addDays(wkStart, 6);
    wkEnd.setHours(23, 59, 59, 999);

    let completed = 0;
    let volumeKg = 0;
    let totalSets = 0;
    let totalDurationSec = 0;

    for (const s of history) {
        const t = new Date(s.completed_at).getTime();
        if (t >= wkStart.getTime() && t <= wkEnd.getTime()) {
            completed++;
            volumeKg += s.volume_load;
            totalSets += s.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
            totalDurationSec += s.duration_seconds ?? 0;
        }
    }

    const todayDow = now.getDay();
    const daysRemainingInWeek = 7 - todayDow; // inclui hoje

    // Dia favorito ainda à frente nesta semana (e logo não treinado ainda).
    let favoriteRemainingWeekday: string | undefined;
    const fav = favoriteWeekday(history);
    if (fav !== null && fav > todayDow) {
        favoriteRemainingWeekday = weekdayPhrase(fav);
    }

    return {
        weekStart: wkStart,
        weekEnd: wkEnd,
        goal,
        completed,
        volumeKg,
        totalSets,
        totalDurationSec,
        favoriteRemainingWeekday,
        daysRemainingInWeek,
    };
}

/* ─── JourneyCard data ─── */

export interface JourneyData {
    totalWorkouts: number;
    firstWorkoutDate: Date | null;
    volumeKg: number;
    totalDurationSec: number;
    streakDays: number;
    activeDaysLast7: number; // dias distintos com treino nos últimos 7 dias
    avgMinutesPerWorkout: number;
    weeklyWorkoutCounts: number[]; // 8 semanas, mais antiga primeiro
}

export function buildJourneyData(history: HistorySession[]): JourneyData {
    const totalWorkouts = history.length;

    let volumeKg = 0;
    let totalDurationSec = 0;
    let firstWorkoutDate: Date | null = null;
    const dayKeys = new Set<string>();

    for (const s of history) {
        volumeKg += s.volume_load;
        totalDurationSec += s.duration_seconds ?? 0;
        const d = new Date(s.completed_at);
        dayKeys.add(dateKey(startOfDay(d)));
        if (!firstWorkoutDate || d.getTime() < firstWorkoutDate.getTime()) {
            firstWorkoutDate = d;
        }
    }

    const avgMinutesPerWorkout = totalWorkouts > 0
        ? Math.round(totalDurationSec / 60 / totalWorkouts)
        : 0;

    // Sequência: dias consecutivos com treino contando pra trás de hoje. Se hoje
    // não houve treino, considera o streak ativo terminando ontem.
    let streakDays = 0;
    let cursor = startOfDay(new Date());
    if (!dayKeys.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    while (dayKeys.has(dateKey(cursor))) {
        streakDays++;
        cursor = addDays(cursor, -1);
    }

    // Dias distintos com treino nos últimos 7 dias (inclui hoje).
    let activeDaysLast7 = 0;
    const today = startOfDay(new Date());
    for (let i = 0; i < 7; i++) {
        if (dayKeys.has(dateKey(addDays(today, -i)))) activeDaysLast7++;
    }

    // Últimas 8 semanas (domingo-sábado), mais antiga primeiro.
    const thisWeekStart = startOfWeek(new Date());
    const weeklyWorkoutCounts: number[] = [];
    for (let i = 7; i >= 0; i--) {
        const ws = addDays(thisWeekStart, -i * 7).getTime();
        const we = addDays(thisWeekStart, (-i + 1) * 7).getTime();
        let count = 0;
        for (const s of history) {
            const t = new Date(s.completed_at).getTime();
            if (t >= ws && t < we) count++;
        }
        weeklyWorkoutCounts.push(count);
    }

    return {
        totalWorkouts,
        firstWorkoutDate,
        volumeKg,
        totalDurationSec,
        streakDays,
        activeDaysLast7,
        avgMinutesPerWorkout,
        weeklyWorkoutCounts,
    };
}
