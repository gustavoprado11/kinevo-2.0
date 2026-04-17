// ============================================================================
// Program Report PDF — HTML Template Generator
// ============================================================================
// Generates a self-contained HTML string (inline CSS, no JS) that renders
// a polished A4-sized training program report, ready for expo-print → PDF.

// ── Types (mirrored from report/[id].tsx) ──

interface ReportFrequency {
    completed_sessions: number;
    planned_sessions: number;
    percentage: number;
    weekly_breakdown: number[];
    best_streak_weeks: number;
}

interface ReportVolume {
    total_tonnage_kg: number;
    weekly_tonnage: number[];
    previous_program_tonnage_kg: number | null;
    previous_program_completed_sets?: number | null;
    avg_weight_per_set_kg?: number | null;
    previous_program_avg_weight_per_set_kg?: number | null;
    total_completed_sets?: number;
    series_by_muscle_group?: {
        total: Record<string, number>;
        weekly: Array<Record<string, number>>;
    };
}

interface ReportRPE {
    weekly_avg: (number | null)[];
    overall_avg: number | null;
}

interface ReportExerciseProgression {
    exercise_id: string;
    exercise_name: string;
    weekly_max_weight: (number | null)[];
    start_weight: number;
    end_weight: number;
    change_kg: number;
    change_pct: number;
    weekly_est_1rm?: (number | null)[];
    start_est_1rm?: number;
    end_est_1rm?: number;
    change_est_1rm_kg?: number;
    change_est_1rm_pct?: number;
}

interface ReportCheckins {
    averages: Array<{
        question_label: string;
        avg_value: number;
        scale_max: number;
    }>;
}

interface ProgramReportMetrics {
    frequency: ReportFrequency;
    volume: ReportVolume;
    rpe: ReportRPE;
    progression: { top_exercises: ReportExerciseProgression[] };
    checkins: ReportCheckins;
}

interface ProgramReport {
    id: string;
    assigned_program_id: string;
    student_id: string;
    trainer_id: string;
    status: "draft" | "published";
    program_name: string;
    program_duration_weeks: number | null;
    program_started_at: string | null;
    program_completed_at: string | null;
    metrics_json: ProgramReportMetrics;
    trainer_notes: string | null;
    /**
     * Rascunho automático gerado a partir de metrics_json. Usado como fallback
     * quando trainer_notes está vazio — edição do treinador vai pra
     * trainer_notes e tem precedência aqui.
     */
    auto_notes_draft: string | null;
    generated_at: string;
    published_at: string | null;
}

// ── Colors ──

const C = {
    primary: "#7c3aed",
    primaryLight: "#ede9fe",
    text: "#1a1a2e",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    green: "#16a34a",
    greenLight: "#dcfce7",
    amber: "#d97706",
    blue: "#3b82f6",
    border: "#e2e8f0",
    cardBg: "#f8fafc",
    white: "#ffffff",
};

// ── Helpers ──

function esc(s: string | null | undefined): string {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTonnage(kg: number): string {
    if (kg >= 1000) {
        const t = Math.round(kg / 100) / 10;
        return `${t.toLocaleString("pt-BR")}t`;
    }
    return `${Math.round(kg).toLocaleString("pt-BR")}kg`;
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPeriod(start: string | null, end: string | null): string {
    if (!start) return "";
    // Use 4-digit year — "mar. de 26" is ambiguous.
    const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    if (end) return `${fmt(start)} — ${fmt(end)}`;
    return `Desde ${fmt(start)}`;
}

function volumeComparison(current: number, previous: number | null): string {
    if (!previous || previous === 0) return "";
    const diff = ((current - previous) / previous) * 100;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${Math.round(diff)}% vs programa anterior`;
}

const UNCLASSIFIED_MUSCLE_GROUP_KEY = "__unclassified";

function displayMuscleGroup(key: string): string {
    return key === UNCLASSIFIED_MUSCLE_GROUP_KEY ? "Sem grupo" : key;
}

function sumSeriesRecord(rec: Record<string, number> | undefined | null): number {
    if (!rec) return 0;
    let s = 0;
    for (const v of Object.values(rec)) s += v;
    return s;
}

function totalSeries(m: ProgramReportMetrics): number {
    const explicit = m.volume?.total_completed_sets;
    if (typeof explicit === "number") return explicit;
    return sumSeriesRecord(m.volume?.series_by_muscle_group?.total);
}

function formatKg(v: number): string {
    const rounded = Math.round(v * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}kg` : `${rounded.toFixed(1)}kg`;
}

// Delta de carga com sinal explícito e formatação consistente:
//   +3kg   / -2.5kg / 0kg   (o zero não leva sinal — não é nem ganho nem perda)
// Sempre passa por formatKg pra manter as casas decimais coerentes.
function formatDeltaKg(v: number): string {
    if (v === 0) return "0kg";
    const body = formatKg(Math.abs(v));
    return v > 0 ? `+${body}` : `-${body}`;
}

// Classe CSS do delta em três estados (positivo/neutro/negativo).
// "neutral" evita pintar +0kg de verde — que sugeriria progresso inexistente.
function deltaStateClass(v: number): string {
    if (v > 0) return " positive";
    if (v < 0) return " negative";
    return " neutral";
}

function buildSeriesByMuscleGroupCard(volume: ReportVolume): string {
    const total = volume?.series_by_muscle_group?.total ?? {};
    const entries = Object.entries(total).filter(([, v]) => v > 0);
    if (entries.length === 0) return "";

    entries.sort(([ka, va], [kb, vb]) => {
        if (ka === UNCLASSIFIED_MUSCLE_GROUP_KEY) return 1;
        if (kb === UNCLASSIFIED_MUSCLE_GROUP_KEY) return -1;
        return vb - va;
    });

    const max = Math.max(...entries.map(([, v]) => v), 1);
    const rows = entries.map(([k, v]) => {
        const pct = (v / max) * 100;
        return `<div class="mg-row">
            <span class="mg-label">${esc(displayMuscleGroup(k))}</span>
            <div class="mg-bar-track"><div class="mg-bar-fill" style="width:${pct}%"></div></div>
            <span class="mg-value">${v}</span>
        </div>`;
    }).join("");

    return rows;
}

// ── Main Export ──

export function generateReportHTML(
    report: ProgramReport,
    studentName: string,
    trainerName: string,
): string {
    const m = report.metrics_json;
    const hasFrequency = m.frequency && m.frequency.completed_sessions > 0;
    const hasVolume = m.volume && m.volume.total_tonnage_kg > 0;
    const hasSeries = totalSeries(m) > 0;
    const hasRPE = m.rpe && m.rpe.overall_avg !== null;
    const hasProgression = m.progression?.top_exercises?.length > 0;
    const hasCheckins = m.checkins?.averages?.length > 0;
    const period = formatPeriod(report.program_started_at, report.program_completed_at);
    const isCompleted = !!report.program_completed_at;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=595"/>
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: ${C.text};
    background: ${C.white};
    width: 595px;
    padding: 40px 36px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header { margin-bottom: 32px; }
  .brand {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: ${C.primary};
    margin-bottom: 16px;
  }
  .student-name { font-size: 24px; font-weight: 700; color: ${C.text}; margin-bottom: 4px; }
  .program-info { font-size: 13px; color: ${C.textSecondary}; margin-bottom: 2px; }
  .divider { height: 1px; background: ${C.border}; margin: 20px 0; }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: ${C.textMuted};
    margin-bottom: 12px;
    margin-top: 28px;
  }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 8px; }
  .kpi-card {
    flex: 1;
    background: ${C.cardBg};
    border-radius: 10px;
    padding: 14px;
    border: 1px solid ${C.border};
  }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: ${C.textMuted}; font-weight: 600; margin-bottom: 6px; }
  .kpi-value { font-size: 22px; font-weight: 700; color: ${C.text}; }
  .kpi-sub { font-size: 11px; color: ${C.textSecondary}; margin-top: 3px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 90px; margin-bottom: 6px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
  .bar {
    width: 100%;
    max-width: 28px;
    border-radius: 3px;
    min-height: 2px;
  }
  .bar-label { font-size: 9px; color: ${C.textMuted}; margin-top: 4px; }
  .bar-value { font-size: 9px; color: ${C.textSecondary}; margin-bottom: 3px; }
  .chart-card { background: ${C.cardBg}; border-radius: 10px; padding: 16px; border: 1px solid ${C.border}; margin-bottom: 8px; }
  .prog-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .prog-table th { text-align: left; font-weight: 600; color: ${C.textMuted}; padding: 6px 8px; border-bottom: 1px solid ${C.border}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .prog-table td { padding: 8px 8px; border-bottom: 1px solid #f1f5f9; color: ${C.text}; }
  .prog-table tr:last-child td { border-bottom: none; }
  .prog-name { font-weight: 600; }
  .prog-delta { font-weight: 700; color: ${C.textSecondary}; }
  .prog-delta.positive { color: ${C.green}; }
  .prog-delta.negative { color: #ef4444; }
  .prog-delta.neutral { color: ${C.textSecondary}; }
  .prog-1rm { font-size: 10px; color: ${C.textSecondary}; white-space: nowrap; }
  .prog-1rm-val { color: ${C.text}; font-weight: 600; }
  .mg-row { display: flex; align-items: center; margin-bottom: 8px; }
  .mg-label { font-size: 12px; color: ${C.text}; width: 130px; flex-shrink: 0; }
  .mg-bar-track { flex: 1; height: 8px; background: ${C.border}; border-radius: 4px; margin: 0 10px; overflow: hidden; }
  .mg-bar-fill { height: 8px; border-radius: 4px; background: ${C.primary}; }
  .mg-value { font-size: 12px; font-weight: 700; color: ${C.text}; width: 40px; text-align: right; flex-shrink: 0; }
  .checkin-row { display: flex; align-items: center; margin-bottom: 10px; }
  .checkin-label { font-size: 12px; color: ${C.text}; width: 160px; flex-shrink: 0; }
  .checkin-bar-track { flex: 1; height: 8px; background: ${C.border}; border-radius: 4px; margin: 0 10px; overflow: hidden; }
  .checkin-bar-fill { height: 8px; border-radius: 4px; background: ${C.primary}; }
  .checkin-value { font-size: 12px; font-weight: 600; color: ${C.text}; width: 40px; text-align: right; flex-shrink: 0; }
  .notes-block {
    background: ${C.cardBg};
    border-left: 3px solid ${C.primary};
    border-radius: 0 10px 10px 0;
    padding: 16px 20px;
    margin-top: 8px;
  }
  .notes-text { font-size: 13px; color: ${C.text}; line-height: 1.6; font-style: italic; white-space: pre-wrap; }
  .notes-author { font-size: 11px; color: ${C.textSecondary}; margin-top: 10px; font-style: normal; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid ${C.border}; text-align: center; }
  .footer-text { font-size: 10px; color: ${C.textMuted}; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="brand">KINEVO</div>
  <div class="student-name">${esc(studentName)}</div>
  <div class="program-info">${esc(report.program_name)}${period ? ` · ${esc(period)}` : ""}</div>
  ${report.program_duration_weeks ? `<div class="program-info">${report.program_duration_weeks} semanas de programa</div>` : ""}
</div>

<div class="divider"></div>

<!-- KPI Cards -->
${buildKPISection(m, hasFrequency, hasVolume, hasRPE, hasSeries, isCompleted)}

<!-- Frequência Semanal -->
${hasFrequency && m.frequency.weekly_breakdown.length > 0 ? `
<div class="section-title">Frequência Semanal</div>
<div class="chart-card">
  ${buildBarChart(m.frequency.weekly_breakdown, C.primary)}
</div>
` : ""}

<!-- Progressão de Carga -->
${hasProgression ? `
<div class="section-title">Progressão de Carga</div>
<div class="chart-card">
  ${buildProgressionTable(m.progression.top_exercises, report.program_duration_weeks)}
</div>
` : ""}

<!-- RPE Semanal -->
${hasRPE && m.rpe.weekly_avg.some(v => v !== null) ? `
<div class="section-title">PSE por Semana</div>
<div class="chart-card">
  ${buildBarChart(m.rpe.weekly_avg.map(v => v ?? 0), C.amber, 10, (v) => v > 0 ? v.toFixed(1) : "")}
</div>
` : ""}

<!-- Séries por grupo muscular (vocabulário do treinador: "X séries por grupo/semana") -->
${hasSeries ? `
<div class="section-title">Séries por grupo muscular</div>
<div class="chart-card">
  ${buildSeriesByMuscleGroupCard(m.volume)}
</div>
` : ""}

<!-- Carga total por semana -->
${hasVolume && m.volume.weekly_tonnage.some(v => v > 0) ? `
<div class="section-title">Carga total por semana</div>
<div class="chart-card">
  ${buildBarChart(m.volume.weekly_tonnage, C.green, undefined, (v) => v > 0 ? formatTonnage(v) : "")}
</div>
` : ""}

<!-- Check-ins -->
${hasCheckins ? `
<div class="section-title">Check-ins</div>
<div class="chart-card">
  ${m.checkins.averages.map(item => {
      const pct = item.scale_max > 0 ? Math.min((item.avg_value / item.scale_max) * 100, 100) : 0;
      return `<div class="checkin-row">
        <span class="checkin-label">${esc(item.question_label)}</span>
        <div class="checkin-bar-track"><div class="checkin-bar-fill" style="width:${pct}%"></div></div>
        <span class="checkin-value">${item.avg_value.toFixed(1)}/${item.scale_max}</span>
      </div>`;
  }).join("")}
</div>
` : ""}

<!-- Observações do Treinador -->
${(() => {
  // trainer_notes (edição do treinador) tem precedência. Se não houver,
  // renderiza o rascunho automático — sem assinatura do treinador, já que
  // é texto gerado por padrão.
  const effectiveNotes = report.trainer_notes ?? report.auto_notes_draft ?? null;
  if (!effectiveNotes) return "";
  const showAuthor = !!report.trainer_notes;
  return `
<div class="section-title">Observações do Treinador</div>
<div class="notes-block">
  <div class="notes-text">${esc(effectiveNotes)}</div>
  ${showAuthor ? `<div class="notes-author">— ${esc(trainerName)}</div>` : ""}
</div>
`;
})()}

<!-- Footer -->
<div class="footer">
  <div class="footer-text">Gerado pelo Kinevo em ${formatDate(report.generated_at)}</div>
</div>

</body>
</html>`;
}

// ── Section Builders ──

function buildKPISection(
    m: ProgramReportMetrics,
    hasFrequency: boolean,
    hasVolume: boolean,
    hasRPE: boolean,
    hasSeries: boolean,
    isCompleted: boolean,
): string {
    const cards: string[] = [];

    if (hasFrequency) {
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Frequência</div>
            <div class="kpi-value">${m.frequency.percentage}%</div>
            <div class="kpi-sub">${m.frequency.completed_sessions} de ${m.frequency.planned_sessions} sessões</div>
        </div>`);
    }

    if (hasSeries) {
        const total = totalSeries(m);
        const weeks = m.volume?.series_by_muscle_group?.weekly?.length ?? 0;
        const weeklyAvg = weeks > 0 ? Math.round(total / weeks) : 0;
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Séries completadas</div>
            <div class="kpi-value">${total.toLocaleString("pt-BR")}</div>
            <div class="kpi-sub">${weeklyAvg}/semana em média</div>
        </div>`);
    }

    // Carga média / série: peso médio LEVANTADO por set (ignora sets corporais).
    // Valor pré-calculado pelo service. Fallback pra tonelagem/sets só pra não
    // quebrar relatórios cacheados antes da nova métrica — o número fica inflado
    // pelas reps, mas é melhor que esconder o KPI.
    const avgLoad: number | null = (() => {
        if (typeof m.volume.avg_weight_per_set_kg === "number") {
            return m.volume.avg_weight_per_set_kg;
        }
        const sets = m.volume.total_completed_sets;
        if (hasVolume && typeof sets === "number" && sets > 0) {
            return m.volume.total_tonnage_kg / sets;
        }
        return null;
    })();
    if (avgLoad !== null && avgLoad > 0) {
        const prevAvg: number | null = (() => {
            if (typeof m.volume.previous_program_avg_weight_per_set_kg === "number") {
                return m.volume.previous_program_avg_weight_per_set_kg;
            }
            const prevTonnage = m.volume.previous_program_tonnage_kg;
            const prevSets = m.volume.previous_program_completed_sets ?? null;
            if (prevTonnage && prevSets && prevSets > 0) return prevTonnage / prevSets;
            return null;
        })();
        const comp = isCompleted ? volumeComparison(avgLoad, prevAvg) : "";
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Carga média / série</div>
            <div class="kpi-value">${formatKg(avgLoad)}</div>
            <div class="kpi-sub">${comp ? esc(comp) : "Peso médio levantado"}</div>
        </div>`);
    }

    if (hasRPE) {
        // PSE = percepção subjetiva de esforço, auto-relatada pelo aluno. Sem alvo
        // prescrito, mostramos só o número, sem qualificativos.
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">PSE Média</div>
            <div class="kpi-value">${m.rpe.overall_avg}</div>
            <div class="kpi-sub">Percepção de esforço do aluno</div>
        </div>`);
    }

    if (hasFrequency && m.frequency.best_streak_weeks > 0) {
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Melhor Sequência</div>
            <div class="kpi-value">${m.frequency.best_streak_weeks}</div>
            <div class="kpi-sub">semanas consecutivas</div>
        </div>`);
    }

    if (cards.length === 0) return "";

    // Arrange in rows of 2
    const rows: string[] = [];
    for (let i = 0; i < cards.length; i += 2) {
        const pair = cards.slice(i, i + 2);
        rows.push(`<div class="kpi-row">${pair.join("")}</div>`);
    }
    return rows.join("");
}

function buildBarChart(
    data: number[],
    color: string,
    maxOverride?: number,
    formatLabel?: (v: number) => string,
): string {
    const max = maxOverride ?? Math.max(...data, 1);

    const bars = data.map((val, i) => {
        const height = max > 0 ? Math.max((val / max) * 70, val > 0 ? 3 : 1) : 1;
        const bg = val > 0 ? color : "#e2e8f0";
        const label = formatLabel ? formatLabel(val) : (val > 0 ? String(val) : "");
        return `<div class="bar-col">
            ${label ? `<div class="bar-value">${label}</div>` : ""}
            <div class="bar" style="height:${height}px;background:${bg}"></div>
            <div class="bar-label">S${i + 1}</div>
        </div>`;
    }).join("");

    return `<div class="bar-chart">${bars}</div>`;
}

function buildProgressionTable(
    exercises: ReportExerciseProgression[],
    durationWeeks: number | null,
): string {
    const weeks = durationWeeks ?? (exercises[0]?.weekly_max_weight?.length || 8);
    const weekHeaders = Array.from({ length: weeks }, (_, i) => `<th>S${i + 1}</th>`).join("");

    const rows = exercises.map(ex => {
        const weekCells = ex.weekly_max_weight.map(w =>
            `<td>${w !== null ? formatKg(w) : "—"}</td>`
        ).join("");
        const deltaClass = deltaStateClass(ex.change_kg);
        const pctBody = ex.change_pct === 0
            ? "0%"
            : `${ex.change_pct > 0 ? "+" : ""}${ex.change_pct}%`;

        const startEst = ex.start_est_1rm ?? 0;
        const endEst = ex.end_est_1rm ?? 0;
        const hasEst1RM = startEst > 0 || endEst > 0;
        const est1RMCell = hasEst1RM
            ? `<span class="prog-1rm-val">${formatKg(startEst)} → ${formatKg(endEst)}</span>`
            : "—";
        const changeEst = ex.change_est_1rm_kg ?? 0;
        const est1RMDelta = hasEst1RM
            ? `<span class="prog-delta${deltaStateClass(changeEst)}">${formatDeltaKg(changeEst)}</span>`
            : "";

        return `<tr>
            <td class="prog-name">${esc(ex.exercise_name)}</td>
            ${weekCells}
            <td class="prog-delta${deltaClass}">${formatDeltaKg(ex.change_kg)} (${pctBody})</td>
            <td class="prog-1rm">${est1RMCell}${est1RMDelta ? ` ${est1RMDelta}` : ""}</td>
        </tr>`;
    }).join("");

    return `<table class="prog-table">
        <thead><tr><th>Exercício</th>${weekHeaders}<th>Δ carga</th><th>1RM est. (ini → fim)</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}
