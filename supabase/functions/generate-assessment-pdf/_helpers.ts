// ============================================================================
// generate-assessment-pdf — drawing helpers
// ============================================================================
// pdf-lib has no flexbox; everything is x/y. These helpers encapsulate the
// repeating layout primitives (header, label/value pairs, result cards, table
// rows, footer, manual pagination) so the entrypoint stays declarative.
// Coordinates are in PDF points (1/72").
// ============================================================================

import { type PDFFont, type PDFPage, rgb, type RGB } from 'npm:pdf-lib@1.17.1';

// ---------- Theme (Kinevo light, RGB normalized 0–1) ----------------------
export const kColors = {
    textPrimary: rgb(0x1d / 255, 0x1d / 255, 0x1f / 255),     // #1D1D1F
    textSecondary: rgb(0x6e / 255, 0x6e / 255, 0x73 / 255),   // #6E6E73
    accent: rgb(0x7c / 255, 0x3a / 255, 0xed / 255),          // #7c3aed (presencial)
    success: rgb(0x16 / 255, 0xa3 / 255, 0x4a / 255),         // #16a34a
    warning: rgb(0xf5 / 255, 0x9e / 255, 0x0b / 255),         // #f59e0b
    danger: rgb(0xef / 255, 0x44 / 255, 0x44 / 255),          // #ef4444
    cardBg: rgb(0xf5 / 255, 0xf5 / 255, 0xf7 / 255),          // #F5F5F7
    border: rgb(0xe5 / 255, 0xe5 / 255, 0xea / 255),          // #E5E5EA
};

export const kSizes = {
    title: 22,
    section: 11,
    body: 10,
    label: 8,
    cardValue: 18,
    footer: 8,
};

// A4 portrait in points
export const kPage = {
    width: 595.28,
    height: 841.89,
    marginX: 56, // ~2cm
    marginTop: 56,
    marginBottom: 72, // bigger to leave room for footer
};

export interface Fonts {
    regular: PDFFont;
    bold: PDFFont;
}

// ---------- WinAnsi sanitizer ---------------------------------------------
// pdf-lib's StandardFonts use WinAnsi (cp1252). cp1252 covers Latin-1 + en/em
// dash, curly quotes, middle dot (validated locally). Glyphs OUTSIDE cp1252
// (arrows, U+2191/U+2193, math symbols) crash drawText. We ASCII-fold those
// before drawing.
const SANITIZE: Array<[RegExp, string]> = [
    [/…/g, '...'],
    [/[‐‑―]/g, '-'],
    [/ /g, ' '],
    [/[↑▲]/g, '+'],
    [/[↓▼]/g, '-'],
    [/→/g, '->'],
    [/←/g, '<-'],
    [/•/g, '·'], // bullet -> middle dot (cp1252)
    [/Δ/g, 'd'], // Greek delta -> ASCII (defensive; we use 'Var.' in the
                 // current template, but a future label might slip through).
];

export function safe(text: string | null | undefined): string {
    if (text == null) return '';
    let out = String(text);
    for (const [re, rep] of SANITIZE) out = out.replace(re, rep);
    return out;
}

// ---------- Layout context (manual pagination) ----------------------------
export interface PdfCtx {
    pdf: import('npm:pdf-lib@1.17.1').PDFDocument;
    fonts: Fonts;
    pages: PDFPage[];
    pageIndex: number;     // 0-based
    page: PDFPage;
    y: number;             // current cursor y on page
    generatedAtIso: string;
}

export function newPage(ctx: PdfCtx): void {
    const page = ctx.pdf.addPage([kPage.width, kPage.height]);
    ctx.pages.push(page);
    ctx.pageIndex = ctx.pages.length - 1;
    ctx.page = page;
    ctx.y = kPage.height - kPage.marginTop;
}

/** Reserve `needed` points of vertical space; opens a new page if missing. */
export function ensureSpace(ctx: PdfCtx, needed: number): void {
    if (ctx.y - needed < kPage.marginBottom) {
        newPage(ctx);
    }
}

// ---------- Header --------------------------------------------------------
export function drawHeader(
    ctx: PdfCtx,
    opts: { title: string; subtitle?: string },
): void {
    const { width, marginX } = kPage;
    const titleSize = kSizes.title;
    const top = kPage.height - kPage.marginTop;

    ctx.page.drawText(safe(opts.title), {
        x: marginX,
        y: top - titleSize,
        size: titleSize,
        font: ctx.fonts.bold,
        color: kColors.textPrimary,
    });

    let y = top - titleSize - 8;

    if (opts.subtitle) {
        ctx.page.drawText(safe(opts.subtitle), {
            x: marginX,
            y: y - 11,
            size: 9,
            font: ctx.fonts.regular,
            color: kColors.textSecondary,
        });
        y -= 14;
    }

    y -= 12;
    ctx.page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 0.5,
        color: kColors.border,
    });

    ctx.y = y - 24;
}

// ---------- Section title -------------------------------------------------
export function drawSectionTitle(ctx: PdfCtx, title: string): void {
    ensureSpace(ctx, 24);
    ctx.page.drawText(safe(title.toUpperCase()), {
        x: kPage.marginX,
        y: ctx.y,
        size: kSizes.section,
        font: ctx.fonts.bold,
        color: kColors.textSecondary,
    });
    ctx.y -= 18;
}

// ---------- Label/value rows ----------------------------------------------
export function drawLabelValueGrid(
    ctx: PdfCtx,
    pairs: Array<{ label: string; value: string }>,
    cols = 2,
): void {
    const { width, marginX } = kPage;
    const usable = width - marginX * 2;
    const colWidth = usable / cols;
    const rowHeight = 36;
    const rows = Math.ceil(pairs.length / cols);
    ensureSpace(ctx, rows * rowHeight + 8);

    pairs.forEach((p, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = marginX + col * colWidth;
        const yRow = ctx.y - row * rowHeight;

        ctx.page.drawText(safe(p.label), {
            x, y: yRow, size: kSizes.label, font: ctx.fonts.regular, color: kColors.textSecondary,
        });
        ctx.page.drawText(safe(p.value), {
            x, y: yRow - 14, size: kSizes.body + 1, font: ctx.fonts.bold, color: kColors.textPrimary,
        });
    });

    ctx.y -= rows * rowHeight + 8;
}

// ---------- Result cards (grid, big number) -------------------------------
export interface ResultCard {
    label: string;
    value: string;
    classification?: string;
    tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export function drawResultCards(ctx: PdfCtx, cards: ResultCard[], cols = 3): void {
    if (cards.length === 0) return;
    const { width, marginX } = kPage;
    const gap = 12;
    const usable = width - marginX * 2;
    const cardWidth = (usable - gap * (cols - 1)) / cols;
    const cardHeight = 78;
    const rows = Math.ceil(cards.length / cols);
    ensureSpace(ctx, rows * (cardHeight + gap) + 8);

    cards.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = marginX + col * (cardWidth + gap);
        const yTop = ctx.y - row * (cardHeight + gap);
        const tone =
            c.tone === 'success' ? kColors.success
            : c.tone === 'warning' ? kColors.warning
            : c.tone === 'danger' ? kColors.danger
            : kColors.textPrimary;

        ctx.page.drawRectangle({
            x, y: yTop - cardHeight, width: cardWidth, height: cardHeight,
            color: kColors.cardBg, borderColor: kColors.border, borderWidth: 0.6,
        });
        ctx.page.drawText(safe(c.label.toUpperCase()), {
            x: x + 12, y: yTop - 18, size: kSizes.label,
            font: ctx.fonts.bold, color: kColors.textSecondary,
        });
        ctx.page.drawText(safe(c.value), {
            x: x + 12, y: yTop - 44, size: kSizes.cardValue,
            font: ctx.fonts.bold, color: tone,
        });
        if (c.classification) {
            ctx.page.drawText(safe(c.classification), {
                x: x + 12, y: yTop - 62, size: kSizes.label + 1,
                font: ctx.fonts.regular, color: kColors.textSecondary,
            });
        }
    });

    ctx.y -= rows * (cardHeight + gap) + 8;
}

// ---------- Table (used by comparativo) -----------------------------------
export interface TableColumn {
    label: string;
    width: number; // proportional weight; total normalized below
    align?: 'left' | 'right';
}

export interface TableRow {
    cells: string[];
    cellColors?: Array<RGB | undefined>; // override color for individual cells
}

export function drawTable(
    ctx: PdfCtx,
    columns: TableColumn[],
    rows: TableRow[],
): void {
    if (rows.length === 0) return;
    const { width, marginX } = kPage;
    const usable = width - marginX * 2;
    const totalWeight = columns.reduce((a, b) => a + b.width, 0);
    const colWidths = columns.map((c) => (usable * c.width) / totalWeight);

    const rowHeight = 22;
    const headerHeight = 24;
    const totalH = headerHeight + rows.length * rowHeight + 8;
    ensureSpace(ctx, totalH);

    // Header
    let cursorX = marginX;
    columns.forEach((col, i) => {
        const cw = colWidths[i];
        const align = col.align ?? 'left';
        const txt = safe(col.label);
        const txtWidth = ctx.fonts.bold.widthOfTextAtSize(txt, kSizes.label);
        const tx = align === 'right' ? cursorX + cw - txtWidth - 4 : cursorX + 4;
        ctx.page.drawText(txt, {
            x: tx, y: ctx.y - 14, size: kSizes.label,
            font: ctx.fonts.bold, color: kColors.textSecondary,
        });
        cursorX += cw;
    });
    // Header underline
    ctx.page.drawLine({
        start: { x: marginX, y: ctx.y - 18 },
        end: { x: marginX + usable, y: ctx.y - 18 },
        thickness: 0.5,
        color: kColors.border,
    });
    ctx.y -= headerHeight;

    // Rows
    rows.forEach((r) => {
        let x = marginX;
        r.cells.forEach((cell, i) => {
            const cw = colWidths[i];
            const align = columns[i].align ?? 'left';
            const txt = safe(cell);
            const txtWidth = ctx.fonts.regular.widthOfTextAtSize(txt, kSizes.body);
            const tx = align === 'right' ? x + cw - txtWidth - 4 : x + 4;
            const color = r.cellColors?.[i] ?? kColors.textPrimary;
            ctx.page.drawText(txt, {
                x: tx, y: ctx.y - 13, size: kSizes.body,
                font: ctx.fonts.regular, color,
            });
            x += cw;
        });
        // Light row separator
        ctx.page.drawLine({
            start: { x: marginX, y: ctx.y - 18 },
            end: { x: marginX + usable, y: ctx.y - 18 },
            thickness: 0.3,
            color: kColors.border,
        });
        ctx.y -= rowHeight;
    });

    ctx.y -= 8;
}

// ---------- Plain paragraph text -----------------------------------------
export function drawWrappedText(
    ctx: PdfCtx,
    text: string,
    opts: { font: PDFFont; size: number; color: RGB; maxWidth: number; lineHeight?: number },
): void {
    const words = safe(text).split(/\s+/);
    const lh = opts.lineHeight ?? opts.size + 3;
    let line = '';
    const flush = () => {
        ensureSpace(ctx, lh);
        ctx.page.drawText(line, {
            x: kPage.marginX, y: ctx.y - opts.size,
            size: opts.size, font: opts.font, color: opts.color,
        });
        ctx.y -= lh;
        line = '';
    };
    for (const w of words) {
        const probe = line ? `${line} ${w}` : w;
        const wd = opts.font.widthOfTextAtSize(probe, opts.size);
        if (wd > opts.maxWidth && line) {
            flush();
            line = w;
        } else {
            line = probe;
        }
    }
    if (line) flush();
}

// ---------- Slug & date helpers -------------------------------------------
export function asciiSlug(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'aluno';
}

export function formatYmdSp(iso: string | null): string {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function formatDatePtBr(iso: string | null): string {
    if (!iso) return '—'; // em-dash placeholder
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    });
}

export function formatShortDatePtBr(iso: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    });
}

// ---------- Footer (drawn last, on every page) ----------------------------
export interface FooterArgs {
    citations: string[];                      // protocol citation lines
    generatedAtIso: string;
    disclaimer?: string;
}

export function drawFooterOnAllPages(ctx: PdfCtx, args: FooterArgs): void {
    const { width, marginX } = kPage;
    const total = ctx.pages.length;
    const generatedLabel = `Gerado em ${formatDatePtBr(args.generatedAtIso)}`;

    ctx.pages.forEach((p, idx) => {
        const yLine = 56;          // footer band top
        const yLeft = yLine;
        // Top separator
        p.drawLine({
            start: { x: marginX, y: yLine + 32 },
            end: { x: width - marginX, y: yLine + 32 },
            thickness: 0.4,
            color: kColors.border,
        });

        // Disclaimer (if any) sits one line above generated/page
        if (args.disclaimer) {
            p.drawText(safe(args.disclaimer), {
                x: marginX, y: yLine + 22,
                size: kSizes.footer, font: ctx.fonts.regular, color: kColors.textSecondary,
            });
        }

        // Citations stacked just under disclaimer (only on last page to avoid clutter)
        if (idx === total - 1 && args.citations.length > 0) {
            // Citations live directly above the footer band on the last page,
            // not in the footer itself — we'll render them via a separate helper
            // before saving (see drawCitations below).
        }

        // Bottom row: generated date | page X de Y
        p.drawText(safe(generatedLabel), {
            x: marginX, y: yLeft,
            size: kSizes.footer, font: ctx.fonts.regular, color: kColors.textSecondary,
        });
        const pageLabel = `Página ${idx + 1} de ${total}`;
        const pw = ctx.fonts.regular.widthOfTextAtSize(pageLabel, kSizes.footer);
        p.drawText(safe(pageLabel), {
            x: width - marginX - pw, y: yLeft,
            size: kSizes.footer, font: ctx.fonts.regular, color: kColors.textSecondary,
        });
    });
}

/** Render citation lines inline at the current cursor (last section before footer). */
export function drawCitations(
    ctx: PdfCtx,
    args: { engineLine: string; citations: string[] },
): void {
    const { width, marginX } = kPage;
    const usable = width - marginX * 2;

    drawWrappedText(ctx, args.engineLine, {
        font: ctx.fonts.regular, size: kSizes.footer + 1,
        color: kColors.textSecondary, maxWidth: usable, lineHeight: 12,
    });

    args.citations.forEach((c) => {
        drawWrappedText(ctx, c, {
            font: ctx.fonts.regular, size: kSizes.footer,
            color: kColors.textSecondary, maxWidth: usable, lineHeight: 11,
        });
    });
}
