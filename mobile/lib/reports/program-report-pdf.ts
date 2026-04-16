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

// ── Main Export ──

export function generateReportHTML(
    report: ProgramReport,
    studentName: string,
    trainerName: string,
): string {
    const m = report.metrics_json;
    const hasFrequency = m.frequency && m.frequency.completed_sessions > 0;
    const hasVolume = m.volume && m.volume.total_tonnage_kg > 0;
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
  .prog-delta { font-weight: 700; color: ${C.green}; }
  .prog-delta.negative { color: #ef4444; }
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
${buildKPISection(m, hasFrequency, hasVolume, hasRPE, isCompleted)}

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

<!-- Volume Semanal -->
${hasVolume && m.volume.weekly_tonnage.some(v => v > 0) ? `
<div class="section-title">Volume Semanal</div>
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
${report.trainer_notes ? `
<div class="section-title">Observações do Treinador</div>
<div class="notes-block">
  <div class="notes-text">${esc(report.trainer_notes)}</div>
  <div class="notes-author">— ${esc(trainerName)}</div>
</div>
` : ""}

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

    if (hasVolume) {
        // Só comparar com programa anterior quando o atual estiver concluído — senão o delta
        // fica sempre enganoso (programa em andamento vs programa inteiro).
        const comp = isCompleted
            ? volumeComparison(m.volume.total_tonnage_kg, m.volume.previous_program_tonnage_kg)
            : "";
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Volume Total</div>
            <div class="kpi-value">${formatTonnage(m.volume.total_tonnage_kg)}</div>
            ${comp ? `<div class="kpi-sub">${esc(comp)}</div>` : ""}
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
            `<td>${w !== null ? `${w}kg` : "—"}</td>`
        ).join("");
        const sign = ex.change_kg >= 0 ? "+" : "";
        const deltaClass = ex.change_kg >= 0 ? "" : " negative";
        return `<tr>
            <td class="prog-name">${esc(ex.exercise_name)}</td>
            ${weekCells}
            <td class="prog-delta${deltaClass}">${sign}${ex.change_kg}kg (${sign}${ex.change_pct}%)</td>
        </tr>`;
    }).join("");

    return `<table class="prog-table">
        <thead><tr><th>Exercício</th>${weekHeaders}<th>Δ</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}
