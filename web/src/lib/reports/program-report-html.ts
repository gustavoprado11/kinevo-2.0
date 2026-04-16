// ============================================================================
// Program Report HTML — Web Template Generator
// ============================================================================
// Adapted from mobile/lib/reports/program-report-pdf.ts
// Generates a self-contained HTML page for browser viewing + print-to-PDF.
// Optimized for single A4 page print with 2-column chart grid.

import type { ProgramReport } from './program-report-service'

// ── Colors ──

const C = {
    primary: '#7c3aed',
    primaryLight: '#ede9fe',
    text: '#1a1a2e',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    green: '#16a34a',
    greenLight: '#dcfce7',
    amber: '#d97706',
    blue: '#3b82f6',
    border: '#e2e8f0',
    cardBg: '#f8fafc',
    white: '#ffffff',
}

// ── Helpers ──

function esc(s: string | null | undefined): string {
    if (!s) return ''
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatTonnage(kg: number): string {
    if (kg >= 1000) {
        const t = Math.round(kg / 100) / 10
        return `${t.toLocaleString('pt-BR')}t`
    }
    return `${Math.round(kg).toLocaleString('pt-BR')}kg`
}

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPeriod(start: string | null, end: string | null): string {
    if (!start) return ''
    // Use 4-digit year — "mar. de 26" is ambiguous (1926? 2026?).
    const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    if (end) return `${fmt(start)} — ${fmt(end)}`
    return `Desde ${fmt(start)}`
}

function volumeComparison(current: number, previous: number | null): string {
    if (!previous || previous === 0) return ''
    const diff = ((current - previous) / previous) * 100
    const sign = diff >= 0 ? '+' : ''
    return `${sign}${Math.round(diff)}% vs programa anterior`
}

// ── Bar Chart Builder ──

function buildBarChart(
    data: number[],
    color: string,
    maxOverride?: number,
    formatLabel?: (v: number) => string,
): string {
    const max = maxOverride ?? Math.max(...data, 1)

    const bars = data.map((val, i) => {
        const height = max > 0 ? Math.max((val / max) * 55, val > 0 ? 3 : 1) : 1
        const bg = val > 0 ? color : '#e2e8f0'
        const label = formatLabel ? formatLabel(val) : (val > 0 ? String(val) : '')
        return `<div class="bar-col">
            ${label ? `<div class="bar-value">${label}</div>` : ''}
            <div class="bar" style="height:${height}px;background:${bg}"></div>
            <div class="bar-label">S${i + 1}</div>
        </div>`
    }).join('')

    return `<div class="bar-chart">${bars}</div>`
}

// ── Progression Table Builder ──

function buildProgressionTable(
    exercises: ProgramReport['metrics_json']['progression']['top_exercises'],
    durationWeeks: number | null,
): string {
    const weeks = durationWeeks ?? (exercises[0]?.weekly_max_weight?.length || 8)
    const weekHeaders = Array.from({ length: weeks }, (_, i) => `<th>S${i + 1}</th>`).join('')

    const rows = exercises.map(ex => {
        const weekCells = ex.weekly_max_weight.map(w =>
            `<td>${w !== null ? `${w}kg` : '—'}</td>`
        ).join('')
        const sign = ex.change_kg >= 0 ? '+' : ''
        const deltaClass = ex.change_kg >= 0 ? '' : ' negative'
        return `<tr>
            <td class="prog-name">${esc(ex.exercise_name)}</td>
            ${weekCells}
            <td class="prog-delta${deltaClass}">${sign}${ex.change_kg}kg (${sign}${ex.change_pct}%)</td>
        </tr>`
    }).join('')

    return `<table class="prog-table">
        <thead><tr><th>Exercício</th>${weekHeaders}<th>Δ</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`
}

// ── KPI Section Builder (all cards in one row) ──

function buildKPISection(
    m: ProgramReport['metrics_json'],
    hasFrequency: boolean,
    hasVolume: boolean,
    hasRPE: boolean,
    isCompleted: boolean,
): string {
    const cards: string[] = []

    if (hasFrequency) {
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Frequência</div>
            <div class="kpi-value">${m.frequency.percentage}%</div>
            <div class="kpi-sub">${m.frequency.completed_sessions} de ${m.frequency.planned_sessions} sessões</div>
        </div>`)
    }

    if (hasVolume) {
        // Only compare to previous program once the current one is completed — comparing a
        // partial (in-flight) program to a full prior program always yields a misleading
        // large negative delta (e.g. "-94% vs programa anterior" mid-cycle).
        const comp = isCompleted
            ? volumeComparison(m.volume.total_tonnage_kg, m.volume.previous_program_tonnage_kg)
            : ''
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Volume Total</div>
            <div class="kpi-value">${formatTonnage(m.volume.total_tonnage_kg)}</div>
            ${comp ? `<div class="kpi-sub">${esc(comp)}</div>` : ''}
        </div>`)
    }

    if (hasRPE) {
        // PSE (percepção subjetiva de esforço) é auto-relatado pelo aluno, não prescrito.
        // Mostrar o número neutro, sem qualificativos como "Bem dosado" que sugerem meta.
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">PSE Média</div>
            <div class="kpi-value">${m.rpe.overall_avg}</div>
            <div class="kpi-sub">Percepção de esforço do aluno</div>
        </div>`)
    }

    if (hasFrequency && m.frequency.best_streak_weeks > 0) {
        cards.push(`<div class="kpi-card">
            <div class="kpi-label">Melhor Sequência</div>
            <div class="kpi-value">${m.frequency.best_streak_weeks}</div>
            <div class="kpi-sub">semanas consecutivas</div>
        </div>`)
    }

    if (cards.length === 0) return ''

    return `<div class="kpi-row">${cards.join('')}</div>`
}

// ── Main Export ──

export function generateReportHTML(
    report: ProgramReport,
    studentName: string,
    trainerName: string,
): string {
    const m = report.metrics_json
    const hasFrequency = m.frequency && m.frequency.completed_sessions > 0
    const hasVolume = m.volume && m.volume.total_tonnage_kg > 0
    const hasRPE = m.rpe && m.rpe.overall_avg !== null
    const hasProgression = m.progression?.top_exercises?.length > 0
    const hasCheckins = m.checkins?.averages?.length > 0
    const period = formatPeriod(report.program_started_at, report.program_completed_at)
    const isDraft = report.status === 'draft'
    const isCompleted = !!report.program_completed_at

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Relatório — ${esc(studentName)} — ${esc(report.program_name)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  @media print {
    body { padding: 0; max-width: none; font-size: 10px; }
    .no-print { display: none !important; }
    .print-spacer { display: none !important; }
    .section-title { page-break-after: avoid; margin-top: 14px; margin-bottom: 6px; font-size: 9px; }
    .chart-grid { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px; }
    .chart-card { page-break-inside: avoid; padding: 10px; margin-bottom: 4px; }
    .kpi-row { page-break-inside: avoid; gap: 6px; margin-bottom: 4px; }
    .kpi-card { padding: 8px; }
    .kpi-value { font-size: 16px; }
    .kpi-sub { font-size: 9px; }
    .kpi-label { font-size: 8px; margin-bottom: 3px; }
    .notes-block { page-break-inside: avoid; padding: 10px 14px; }
    .notes-textarea { display: none !important; }
    .notes-static { display: block !important; }
    .prog-table { page-break-inside: avoid; font-size: 9px; }
    .prog-table th { padding: 4px 5px; font-size: 8px; }
    .prog-table td { padding: 5px 5px; }
    .bar-chart { height: 55px; }
    .bar-value { font-size: 7px; }
    .bar-label { font-size: 7px; margin-top: 2px; }
    .header { margin-bottom: 16px; }
    .brand { font-size: 11px; margin-bottom: 8px; }
    .student-name { font-size: 18px; }
    .program-info { font-size: 11px; }
    .divider { margin: 10px 0; }
    .checkin-label { font-size: 10px; width: 130px; }
    .checkin-value { font-size: 10px; }
    .checkin-bar-track { height: 6px; }
    .checkin-bar-fill { height: 6px; }
    .checkin-row { margin-bottom: 6px; }
    .footer { margin-top: 16px; padding-top: 8px; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: ${C.text};
    background: ${C.white};
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 36px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: ${C.text};
    color: ${C.white};
    padding: 10px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 1000;
    font-size: 13px;
    font-weight: 600;
  }
  .print-bar button {
    background: ${C.primary};
    color: ${C.white};
    border: none;
    padding: 8px 20px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }
  .print-bar button:hover { opacity: 0.9; }
  .print-spacer { height: 52px; }
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
  .chart-grid { display: block; }
  .chart-grid-item { margin-bottom: 8px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 70px; margin-bottom: 6px; }
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
  .chart-card .section-title-inline { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${C.textMuted}; margin-bottom: 8px; }
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
  .notes-textarea {
    width: 100%;
    min-height: 80px;
    border: 1px solid ${C.border};
    border-radius: 8px;
    padding: 12px;
    font-family: inherit;
    font-size: 13px;
    color: ${C.text};
    line-height: 1.6;
    resize: vertical;
    background: ${C.white};
    margin-top: 8px;
  }
  .notes-textarea:focus { outline: none; border-color: ${C.primary}; }
  .notes-textarea::placeholder { color: ${C.textMuted}; font-style: italic; }
  .notes-static { display: none; }
  .notes-save-status { font-size: 11px; color: ${C.textMuted}; margin-top: 6px; min-height: 16px; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid ${C.border}; text-align: center; }
  .footer-text { font-size: 10px; color: ${C.textMuted}; }
  .footer-brand { font-size: 11px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: ${C.primary}; margin-top: 6px; }
</style>
</head>
<body>

<!-- Print Bar (hidden in print) -->
<div class="print-bar no-print">
  <span>Relatório de Programa — ${esc(studentName)}</span>
  <button onclick="window.print()">Imprimir / Salvar PDF</button>
</div>
<div class="print-spacer no-print"></div>

<!-- Header -->
<div class="header">
  <div class="brand">KINEVO</div>
  <div class="student-name">${esc(studentName)}</div>
  <div class="program-info">${esc(report.program_name)}${period ? ` · ${esc(period)}` : ''}</div>
  ${report.program_duration_weeks ? `<div class="program-info">${report.program_duration_weeks} semanas de programa</div>` : ''}
</div>

<div class="divider"></div>

<!-- KPI Cards (all inline) -->
${buildKPISection(m, hasFrequency, hasVolume, hasRPE, isCompleted)}

<!-- Charts Grid: 2 columns in print -->
<div class="chart-grid">
${hasFrequency && m.frequency.weekly_breakdown.length > 0 ? `
<div class="chart-grid-item">
  <div class="chart-card">
    <div class="section-title-inline">Frequência Semanal</div>
    ${buildBarChart(m.frequency.weekly_breakdown, C.primary)}
  </div>
</div>
` : ''}

${hasRPE && m.rpe.weekly_avg.some(v => v !== null) ? `
<div class="chart-grid-item">
  <div class="chart-card">
    <div class="section-title-inline">PSE por Semana</div>
    ${buildBarChart(m.rpe.weekly_avg.map(v => v ?? 0), C.amber, 10, (v) => v > 0 ? v.toFixed(1) : '')}
  </div>
</div>
` : ''}

${hasVolume && m.volume.weekly_tonnage.some(v => v > 0) ? `
<div class="chart-grid-item">
  <div class="chart-card">
    <div class="section-title-inline">Volume Semanal</div>
    ${buildBarChart(m.volume.weekly_tonnage, C.green, undefined, (v) => v > 0 ? formatTonnage(v) : '')}
  </div>
</div>
` : ''}

${hasProgression ? `
<div class="chart-grid-item">
  <div class="chart-card">
    <div class="section-title-inline">Progressão de Carga</div>
    ${buildProgressionTable(m.progression.top_exercises, report.program_duration_weeks)}
  </div>
</div>
` : ''}
</div>

<!-- Check-ins -->
${hasCheckins ? `
<div class="section-title">Check-ins</div>
<div class="chart-card">
  ${m.checkins.averages.map(item => {
      const pct = item.scale_max > 0 ? Math.min((item.avg_value / item.scale_max) * 100, 100) : 0
      return `<div class="checkin-row">
        <span class="checkin-label">${esc(item.question_label)}</span>
        <div class="checkin-bar-track"><div class="checkin-bar-fill" style="width:${pct}%"></div></div>
        <span class="checkin-value">${item.avg_value.toFixed(1)}/${item.scale_max}</span>
      </div>`
  }).join('')}
</div>
` : ''}

<!-- Observações do Treinador -->
<div class="section-title">Observações do Treinador</div>
${isDraft ? `
<textarea
  id="trainer-notes"
  class="notes-textarea no-print"
  placeholder="Adicione suas observações sobre o desempenho do aluno..."
  data-report-id="${esc(report.id)}"
>${esc(report.trainer_notes)}</textarea>
<div id="notes-status" class="notes-save-status no-print"></div>
` : ''}
${report.trainer_notes ? `
<div class="notes-block notes-static${isDraft ? '' : ' notes-published'}">
  <div class="notes-text">${esc(report.trainer_notes)}</div>
  <div class="notes-author">— ${esc(trainerName)}</div>
</div>
` : `
<div class="notes-block notes-static">
  <div class="notes-text" style="color:${C.textMuted};font-style:italic">Nenhuma observação adicionada.</div>
</div>
`}

<!-- Footer -->
<div class="footer">
  <div class="footer-text">Gerado pelo Kinevo em ${formatDate(report.generated_at)}</div>
  <div class="footer-brand">KINEVO</div>
</div>

${isDraft ? `
<script>
(function() {
  var textarea = document.getElementById('trainer-notes');
  var status = document.getElementById('notes-status');
  var notesBlock = document.querySelector('.notes-static');
  var notesText = notesBlock ? notesBlock.querySelector('.notes-text') : null;
  if (!textarea) return;
  var timer = null;
  var reportId = textarea.getAttribute('data-report-id');

  textarea.addEventListener('input', function() {
    if (timer) clearTimeout(timer);
    status.textContent = 'Salvando...';
    timer = setTimeout(function() {
      var body = JSON.stringify({ notes: textarea.value });
      fetch('/api/reports/' + reportId + '/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body
      }).then(function(res) {
        if (res.ok) {
          status.textContent = 'Salvo';
          if (notesText) {
            notesText.textContent = textarea.value || 'Nenhuma observação adicionada.';
            notesText.style.color = textarea.value ? '' : '${C.textMuted}';
          }
          setTimeout(function() { status.textContent = ''; }, 2000);
        } else {
          status.textContent = 'Erro ao salvar';
        }
      }).catch(function() {
        status.textContent = 'Erro ao salvar';
      });
    }, 1500);
  });
})();
</script>
` : ''}

</body>
</html>`
}
