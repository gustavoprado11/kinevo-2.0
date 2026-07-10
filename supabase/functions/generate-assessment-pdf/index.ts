// ============================================================================
// generate-assessment-pdf — B2 (full layout)
// ============================================================================
// PDF generation for assessment session reports. Auth: trainer-owner OR
// student-owner of a completed session. Reads via service-role admin client
// (bypasses RLS) but enforces ownership in code.
//
// Layout (B2):
//   3.1 Header
//   3.2 Identification
//   3.3 Results cards
//   3.4 Comparativo (only when a previous completed session of the same
//       template exists for the same student)
//   3.5 Raw measurements grouped by template section
//   3.6 Engine + protocol citations + disclaimer + page X/Y footer
//
// Pagination is manual via PdfCtx + ensureSpace().
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts } from 'npm:pdf-lib@1.17.1';
import {
    asciiSlug,
    drawCitations,
    drawFooterOnAllPages,
    drawHeader,
    drawLabelValueGrid,
    drawResultCards,
    drawSectionTitle,
    drawTable,
    formatDatePtBr,
    formatShortDatePtBr,
    formatYmdSp,
    kColors,
    kPage,
    kSizes,
    newPage,
    safe,
    type Fonts,
    type PdfCtx,
    type ResultCard,
    type TableRow,
} from './_helpers.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonError(error: string, status: number) {
    return new Response(JSON.stringify({ success: false, error }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT_SEX_KEY = 'subject_sex';
const SUBJECT_AGE_KEY = 'subject_age_years';

// ============================================================================
// Types
// ============================================================================
interface MeasurementRow {
    metric_key: string;
    value_numeric: number | null;
    value_text: string | null;
    value_unit: string | null;
    is_selected: boolean | null;
}

interface ComputedMetrics {
    bmi?: number;
    rcq?: number;
    body_fat_percent?: number;
    body_density?: number;
    fat_mass_kg?: number;
    lean_mass_kg?: number;
    [key: string]: number | string | undefined;
}

type ProtocolId = 'jackson_pollock_3' | 'jackson_pollock_7' | 'petroski_4' | 'faulkner_4';

interface TemplateTest {
    id?: string;
    type?: string;
    label?: string;
    metric_key?: string;
    unit?: string;
    protocol?: ProtocolId;
}
interface TemplateSection {
    id?: string;
    title?: string;
    tests?: TemplateTest[];
}
interface TemplateSnapshot {
    sections?: TemplateSection[];
}

// ============================================================================
// Classifications (light-weight; full engine lives in shared/, kept here to
// avoid coupling the Edge bundle to the workspace import map)
// ============================================================================
function bmiClass(bmi: number | undefined): { label: string; tone: ResultCard['tone'] } {
    if (bmi == null) return { label: '', tone: 'neutral' };
    if (bmi < 18.5) return { label: 'Abaixo do peso', tone: 'warning' };
    if (bmi < 25) return { label: 'Peso normal', tone: 'success' };
    if (bmi < 30) return { label: 'Sobrepeso', tone: 'warning' };
    if (bmi < 35) return { label: 'Obesidade grau I', tone: 'danger' };
    if (bmi < 40) return { label: 'Obesidade grau II', tone: 'danger' };
    return { label: 'Obesidade grau III', tone: 'danger' };
}

function whrClass(rcq: number | undefined, sex: 'male' | 'female' | null): { label: string; tone: ResultCard['tone'] } {
    if (rcq == null) return { label: '', tone: 'neutral' };
    if (sex === 'female') {
        if (rcq < 0.80) return { label: 'Risco baixo', tone: 'success' };
        if (rcq < 0.85) return { label: 'Risco moderado', tone: 'warning' };
        return { label: 'Risco alto', tone: 'danger' };
    }
    if (rcq < 0.90) return { label: 'Risco baixo', tone: 'success' };
    if (rcq < 0.95) return { label: 'Risco moderado', tone: 'warning' };
    return { label: 'Risco alto', tone: 'danger' };
}

function bodyFatClass(pct: number | undefined, sex: 'male' | 'female' | null, age: number | null): { label: string; tone: ResultCard['tone'] } {
    if (pct == null) return { label: '', tone: 'neutral' };
    const isFem = sex === 'female';
    const a = age ?? 30;
    let athletic: number, fitness: number, average: number, obese: number;
    if (isFem) {
        if (a < 30) { athletic = 16; fitness = 22; average = 27; obese = 32; }
        else if (a < 50) { athletic = 18; fitness = 24; average = 29; obese = 34; }
        else { athletic = 20; fitness = 26; average = 31; obese = 36; }
    } else {
        if (a < 30) { athletic = 8; fitness = 14; average = 19; obese = 24; }
        else if (a < 50) { athletic = 11; fitness = 17; average = 22; obese = 27; }
        else { athletic = 13; fitness = 19; average = 24; obese = 29; }
    }
    if (pct < athletic) return { label: 'Atlético', tone: 'success' };
    if (pct < fitness) return { label: 'Bom', tone: 'success' };
    if (pct < average) return { label: 'Médio', tone: 'warning' };
    if (pct < obese) return { label: 'Acima da média', tone: 'warning' };
    return { label: 'Obeso', tone: 'danger' };
}

// ============================================================================
// Protocol mapping — names use en-dash (validated cp1252-safe via local probe)
// ============================================================================
const PROTOCOL_INFO: Record<ProtocolId, { label: string; citation: string }> = {
    jackson_pollock_3: {
        label: 'Jackson & Pollock – 3 dobras',
        citation: 'Jackson AS, Pollock ML. Br J Nutr 1978;40(3):497-504.',
    },
    jackson_pollock_7: {
        label: 'Jackson & Pollock – 7 dobras',
        citation: 'Jackson AS, Pollock ML. Br J Nutr 1978;40(3):497-504.',
    },
    petroski_4: {
        label: 'Petroski – 4 dobras (BR)',
        citation: 'Petroski EL. Tese de Doutorado, UFSM, 1995.',
    },
    faulkner_4: {
        label: 'Faulkner – 4 dobras',
        citation: 'Faulkner JA. In: Falls H (ed). Exercise Physiology, Academic Press, 1968.',
    },
};

function findProtocols(snapshot: TemplateSnapshot | null): ProtocolId[] {
    if (!snapshot?.sections) return [];
    const seen = new Set<ProtocolId>();
    for (const s of snapshot.sections) {
        for (const t of s.tests ?? []) {
            if (t.type === 'protocol' && t.protocol && t.protocol in PROTOCOL_INFO) {
                seen.add(t.protocol);
            }
        }
    }
    return [...seen];
}

function protocolLabel(snapshot: TemplateSnapshot | null): string {
    const ids = findProtocols(snapshot);
    if (ids.length === 0) return 'Antropometria';
    return ids.map((id) => PROTOCOL_INFO[id].label).join(' + ');
}

// ============================================================================
// Helpers
// ============================================================================
function readSubjectFromMeasurements(rows: MeasurementRow[]): { sex: 'male' | 'female' | null; age: number | null } {
    let sex: 'male' | 'female' | null = null;
    let age: number | null = null;
    for (let i = rows.length - 1; i >= 0; i--) {
        const m = rows[i];
        if (sex == null && m.metric_key === SUBJECT_SEX_KEY) {
            if (m.value_text === 'male' || m.value_text === 'female') sex = m.value_text;
        }
        if (age == null && m.metric_key === SUBJECT_AGE_KEY && m.value_numeric != null) {
            age = m.value_numeric;
        }
        if (sex != null && age != null) break;
    }
    return { sex, age };
}

function fmtNumber(n: number | undefined | null, digits = 1): string {
    if (n == null || !Number.isFinite(n)) return '—'; // em-dash; cp1252-safe
    return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtSignedDelta(delta: number | undefined | null, digits = 1): string {
    if (delta == null || !Number.isFinite(delta)) return '—';
    const sign = delta > 0 ? '+' : (delta < 0 ? '' : '');
    return `${sign}${delta.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const RAW_METRIC_LABELS: Record<string, string> = {
    weight_kg: 'Peso',
    height_m: 'Estatura',
    waist_cm: 'Cintura',
    hip_cm: 'Quadril',
    skinfold_chest: 'Dobra peitoral',
    skinfold_abdomen: 'Dobra abdominal',
    skinfold_thigh: 'Dobra coxa',
    skinfold_triceps: 'Dobra tríceps',
    skinfold_subscapular: 'Dobra subescapular',
    skinfold_suprailiac: 'Dobra supra-ilíaca',
    skinfold_midaxillary: 'Dobra axilar média',
    skinfold_biceps: 'Dobra bíceps',
    skinfold_calf: 'Dobra panturrilha',
};

function rawMetricLabel(metricKey: string): string {
    return RAW_METRIC_LABELS[metricKey] ?? metricKey;
}

function formatRawValue(m: MeasurementRow): string {
    const unit = m.value_unit ? ` ${m.value_unit}` : '';
    if (m.value_numeric != null) {
        // Use 2 decimals for height (m), 1 for everything else
        const digits = m.value_unit === 'm' ? 2 : 1;
        return `${fmtNumber(m.value_numeric, digits)}${unit}`;
    }
    if (m.value_text != null) return m.value_text;
    return '—';
}

// ============================================================================
// Build PDF
// ============================================================================
interface BuildArgs {
    studentName: string;
    sex: 'male' | 'female' | null;
    age: number | null;
    trainerName: string;
    sessionDateIso: string | null;
    snapshot: TemplateSnapshot | null;
    metrics: ComputedMetrics | null;
    measurements: MeasurementRow[];
    previous: { metrics: ComputedMetrics | null; sessionDateIso: string | null } | null;
}

async function buildAssessmentPdf(args: BuildArgs): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const fonts: Fonts = {
        regular: await pdf.embedFont(StandardFonts.Helvetica),
        bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
    const ctx: PdfCtx = {
        pdf, fonts,
        pages: [], pageIndex: -1, page: undefined as unknown as PdfCtx['page'],
        y: 0,
        generatedAtIso: new Date().toISOString(),
    };
    newPage(ctx); // first page

    // -------- 3.1 Header
    drawHeader(ctx, {
        title: 'Laudo de Avaliação Física',
        subtitle: `Gerado em ${formatDatePtBr(ctx.generatedAtIso)} · Kinevo`,
    });

    // -------- 3.2 Identification
    drawSectionTitle(ctx, 'Identificação');
    const sexLabel = args.sex === 'male' ? 'Masculino' : args.sex === 'female' ? 'Feminino' : '—';
    const ageLabel = args.age != null ? `${args.age} anos` : '—';
    const protoLabel = protocolLabel(args.snapshot);
    drawLabelValueGrid(ctx, [
        { label: 'Aluno(a)', value: args.studentName || '—' },
        { label: 'Sexo', value: sexLabel },
        { label: 'Idade na sessão', value: ageLabel },
        { label: 'Data da avaliação', value: formatDatePtBr(args.sessionDateIso) },
        { label: 'Educador físico', value: args.trainerName || '—' },
        { label: 'Protocolo', value: protoLabel },
    ], 2);

    // -------- 3.3 Results
    drawSectionTitle(ctx, 'Resultados principais');
    const m = args.metrics ?? {};
    const cards: ResultCard[] = [];
    if (m.bmi != null) {
        const c = bmiClass(m.bmi);
        cards.push({ label: 'IMC', value: `${fmtNumber(m.bmi, 1)} kg/m²`, classification: c.label, tone: c.tone });
    }
    if (m.rcq != null) {
        const c = whrClass(m.rcq, args.sex);
        cards.push({ label: 'RCQ', value: fmtNumber(m.rcq, 2), classification: c.label, tone: c.tone });
    }
    if (m.body_fat_percent != null) {
        const c = bodyFatClass(m.body_fat_percent, args.sex, args.age);
        cards.push({ label: '% Gordura', value: `${fmtNumber(m.body_fat_percent, 1)}%`, classification: c.label, tone: c.tone });
    }
    if (m.lean_mass_kg != null) cards.push({ label: 'Massa magra', value: `${fmtNumber(m.lean_mass_kg, 1)} kg`, tone: 'neutral' });
    if (m.fat_mass_kg != null) cards.push({ label: 'Massa gorda', value: `${fmtNumber(m.fat_mass_kg, 1)} kg`, tone: 'neutral' });
    if (m.body_density != null) cards.push({ label: 'Densidade corporal', value: `${fmtNumber(m.body_density, 4)} g/cm³`, tone: 'neutral' });

    if (cards.length === 0) {
        ctx.page.drawText('Sessão sem métricas calculadas.', {
            x: kPage.marginX, y: ctx.y - 4, size: 10, font: fonts.regular, color: kColors.textSecondary,
        });
        ctx.y -= 18;
    } else {
        drawResultCards(ctx, cards, 3);
    }

    // -------- 3.4 Comparativo (only if previous session exists)
    if (args.previous?.metrics) {
        drawSectionTitle(ctx, 'Comparativo com sessão anterior');

        const prev = args.previous.metrics;
        const prevDate = formatShortDatePtBr(args.previous.sessionDateIso);
        const currDate = formatShortDatePtBr(args.sessionDateIso);

        // metric_key, label, digits, lower_is_better (true) | higher_is_better (false) | neutral (null)
        const cmpRows: Array<{ key: keyof ComputedMetrics; label: string; digits: number; lowerBetter: boolean | null; suffix?: string }> = [
            { key: 'bmi', label: 'IMC', digits: 1, lowerBetter: null, suffix: ' kg/m²' },
            { key: 'rcq', label: 'RCQ', digits: 2, lowerBetter: true },
            { key: 'body_fat_percent', label: '% Gordura', digits: 1, lowerBetter: true, suffix: '%' },
            { key: 'lean_mass_kg', label: 'Massa magra', digits: 1, lowerBetter: false, suffix: ' kg' },
            { key: 'fat_mass_kg', label: 'Massa gorda', digits: 1, lowerBetter: true, suffix: ' kg' },
        ];

        const tableRows: TableRow[] = [];
        for (const r of cmpRows) {
            const cur = m[r.key];
            const old = prev[r.key];
            if (typeof cur !== 'number' || typeof old !== 'number') continue;
            const delta = cur - old;
            // Tone for delta cell
            let dColor = kColors.textSecondary;
            if (r.lowerBetter === true) dColor = delta < 0 ? kColors.success : delta > 0 ? kColors.danger : kColors.textSecondary;
            else if (r.lowerBetter === false) dColor = delta > 0 ? kColors.success : delta < 0 ? kColors.danger : kColors.textSecondary;
            // Trend marker (cp1252-safe). Avoid duplicate sign: use v/^/= and
            // let fmtSignedDelta carry the +/-/0 numeric sign.
            const arrow = delta > 0 ? '^' : delta < 0 ? 'v' : '=';
            tableRows.push({
                cells: [
                    r.label,
                    `${fmtNumber(old, r.digits)}${r.suffix ?? ''}`,
                    `${fmtNumber(cur, r.digits)}${r.suffix ?? ''}`,
                    `${arrow} ${fmtSignedDelta(delta, r.digits)}${r.suffix ?? ''}`,
                ],
                cellColors: [undefined, undefined, undefined, dColor],
            });
        }

        if (tableRows.length === 0) {
            ctx.page.drawText('Sessão anterior encontrada, mas sem métricas comparáveis.', {
                x: kPage.marginX, y: ctx.y - 4, size: 10, font: fonts.regular, color: kColors.textSecondary,
            });
            ctx.y -= 18;
        } else {
            drawTable(ctx, [
                { label: 'Métrica', width: 2 },
                { label: `Anterior (${prevDate})`, width: 2, align: 'right' },
                { label: `Atual (${currDate})`, width: 2, align: 'right' },
                { label: 'Var.', width: 1.4, align: 'right' },
            ], tableRows);
        }
    }

    // -------- 3.5 Raw measurements
    const sectionsForRaw = (args.snapshot?.sections ?? []).filter((s) => (s.tests ?? []).some((t) => t.type === 'numeric_unit'));
    if (sectionsForRaw.length > 0) {
        drawSectionTitle(ctx, 'Medições brutas');

        const measurementByKey = new Map<string, MeasurementRow>();
        for (const m of args.measurements) {
            if (m.metric_key === SUBJECT_SEX_KEY || m.metric_key === SUBJECT_AGE_KEY) continue;
            const existing = measurementByKey.get(m.metric_key);
            // Prefere a tentativa SELECIONADA (is_selected); senão mantém a primeira
            // vista. Antes pegava sempre a #1, ignorando a tentativa escolhida.
            if (!existing || (m.is_selected !== false && existing.is_selected === false)) {
                measurementByKey.set(m.metric_key, m);
            }
        }

        // Iterate template sections to preserve trainer-defined order; fall back
        // to 'protocol' tests via raw_measurements not in template (skinfolds)
        let drewAny = false;
        for (const sec of args.snapshot?.sections ?? []) {
            const tests = sec.tests ?? [];
            const pairs: Array<{ label: string; value: string }> = [];

            for (const t of tests) {
                if (t.type === 'numeric_unit' && t.metric_key) {
                    const row = measurementByKey.get(t.metric_key);
                    if (row) {
                        pairs.push({ label: t.label ?? rawMetricLabel(t.metric_key), value: formatRawValue(row) });
                        measurementByKey.delete(t.metric_key);
                    }
                } else if (t.type === 'protocol') {
                    // Protocol tests don't carry a single metric_key — flush any
                    // skinfold_* measurements that exist in this session under
                    // the same section heading.
                    const skinfolds: MeasurementRow[] = [];
                    for (const [k, row] of measurementByKey.entries()) {
                        if (k.startsWith('skinfold_')) {
                            skinfolds.push(row);
                            measurementByKey.delete(k);
                        }
                    }
                    for (const row of skinfolds) {
                        pairs.push({ label: rawMetricLabel(row.metric_key), value: formatRawValue(row) });
                    }
                }
            }

            if (pairs.length > 0) {
                ensureSpaceForSubtitle(ctx);
                ctx.page.drawText(safe(sec.title ?? ''), {
                    x: kPage.marginX, y: ctx.y - 10,
                    size: kSizes.label + 1, font: fonts.bold, color: kColors.textPrimary,
                });
                ctx.y -= 16;
                drawLabelValueGrid(ctx, pairs, 2);
                drewAny = true;
            }
        }

        // Anything left in measurementByKey is 'unaffiliated' — render as Outras
        const leftover = [...measurementByKey.values()].filter((m) => m.metric_key !== SUBJECT_SEX_KEY && m.metric_key !== SUBJECT_AGE_KEY);
        if (leftover.length > 0) {
            ensureSpaceForSubtitle(ctx);
            ctx.page.drawText(safe('Outras medições'), {
                x: kPage.marginX, y: ctx.y - 10,
                size: kSizes.label + 1, font: fonts.bold, color: kColors.textPrimary,
            });
            ctx.y -= 16;
            drawLabelValueGrid(ctx, leftover.map((m) => ({ label: rawMetricLabel(m.metric_key), value: formatRawValue(m) })), 2);
            drewAny = true;
        }

        if (!drewAny) {
            ctx.page.drawText('Sessão sem medições registradas.', {
                x: kPage.marginX, y: ctx.y - 4, size: 10, font: fonts.regular, color: kColors.textSecondary,
            });
            ctx.y -= 18;
        }
    }

    // -------- 3.6 Citations + disclaimer
    drawSectionTitle(ctx, 'Notas');
    const protocolIds = findProtocols(args.snapshot);
    const citations = protocolIds.map((id) => `· ${PROTOCOL_INFO[id].citation}`);
    drawCitations(ctx, {
        engineLine: 'Cálculos realizados pela engine Kinevo M2.',
        citations,
    });

    drawFooterOnAllPages(ctx, {
        citations: [],
        generatedAtIso: ctx.generatedAtIso,
        disclaimer: 'Valores devem ser interpretados por educador físico habilitado.',
    });

    return await pdf.save();
}

// Local helper — separate so the section subtitles never split awkwardly.
function ensureSpaceForSubtitle(ctx: PdfCtx) {
    if (ctx.y - 50 < kPage.marginBottom) newPage(ctx);
}

// ============================================================================
// Handler
// ============================================================================
Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return jsonError('unauthorized', 401);

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseAnonKey || !serviceKey) return jsonError('server_misconfigured', 500);

        let body: { session_id?: string };
        try {
            body = await req.json();
        } catch {
            return jsonError('bad_request', 400);
        }
        const sessionId = body.session_id?.trim();
        if (!sessionId || !UUID_RE.test(sessionId)) return jsonError('bad_request', 400);

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) return jsonError('unauthorized', 401);
        const userId = userData.user.id;

        const admin = createClient(supabaseUrl, serviceKey);

        const [sessionRes, measurementsRes] = await Promise.all([
            admin.from('assessment_sessions')
                .select('id, status, completed_at, scheduled_at, computed_metrics, template_snapshot, template_id, trainer_id, student_id')
                .eq('id', sessionId)
                .maybeSingle(),
            admin.from('assessment_measurements')
                .select('metric_key, value_numeric, value_text, value_unit, is_selected')
                .eq('session_id', sessionId),
        ]);
        if (sessionRes.error) {
            console.error('[pdf] session error', sessionRes.error);
            return jsonError('server_error', 500);
        }
        const session = sessionRes.data;
        if (!session) return jsonError('session_not_found', 404);

        const [trainerRes, studentRes] = await Promise.all([
            admin.from('trainers').select('id, name, auth_user_id').eq('id', session.trainer_id).maybeSingle(),
            admin.from('students').select('id, name, auth_user_id').eq('id', session.student_id).maybeSingle(),
        ]);
        if (trainerRes.error || studentRes.error) return jsonError('server_error', 500);

        const trainer = trainerRes.data;
        const student = studentRes.data;
        if (!trainer || !student) return jsonError('session_not_found', 404);

        const isTrainerOwner = trainer.auth_user_id === userId;
        const isStudentOwner = student.auth_user_id === userId && session.status === 'completed';
        if (!isTrainerOwner && !isStudentOwner) return jsonError('forbidden', 403);

        // Look up previous completed session (same student + same template_id),
        // strictly older than the current session. NULL completed_at on the
        // current session means we look at scheduled_at as the cutoff.
        const cutoff = session.completed_at ?? session.scheduled_at;
        let previous: BuildArgs['previous'] = null;
        if (session.template_id && cutoff) {
            const prevRes = await admin
                .from('assessment_sessions')
                .select('completed_at, computed_metrics')
                .eq('student_id', session.student_id)
                .eq('template_id', session.template_id)
                .eq('status', 'completed')
                .lt('completed_at', cutoff)
                .neq('id', sessionId)
                .order('completed_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!prevRes.error && prevRes.data) {
                previous = {
                    metrics: prevRes.data.computed_metrics as ComputedMetrics | null,
                    sessionDateIso: prevRes.data.completed_at,
                };
            }
        }

        const measurements: MeasurementRow[] = measurementsRes.data ?? [];
        const { sex, age } = readSubjectFromMeasurements(measurements);
        const sessionDateIso = session.completed_at ?? session.scheduled_at;

        const t0 = Date.now();
        const bytes = await buildAssessmentPdf({
            studentName: student.name,
            sex, age,
            trainerName: trainer.name,
            sessionDateIso,
            snapshot: session.template_snapshot as TemplateSnapshot | null,
            metrics: (session.computed_metrics as ComputedMetrics | null) ?? null,
            measurements,
            previous,
        });
        const elapsedMs = Date.now() - t0;

        const filename = `laudo-${asciiSlug(student.name)}-${formatYmdSp(sessionDateIso)}.pdf`;

        return new Response(bytes, {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Generation-Ms': String(elapsedMs),
            },
        });
    } catch (err) {
        console.error('[generate-assessment-pdf] unhandled', err);
        return jsonError('server_error', 500);
    }
});

