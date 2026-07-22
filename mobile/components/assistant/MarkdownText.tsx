/**
 * MarkdownText — markdown LEVE das respostas do Assistente em React Native.
 *
 * O system-prompt pede "markdown leve" ao modelo desde a Onda 1; o web renderiza
 * com react-markdown e o app mostrava o texto cru (###, **). Aqui um renderer
 * próprio do subset que o Assistente realmente emite — sem dependência nova
 * (nada de lib de markdown no bundle/EAS): títulos, listas (1 nível de
 * aninhamento), negrito/itálico/código inline, citação, régua e tabela GFM
 * compacta (linhas com colunas em "a · b · c"). O que não reconhece degrada
 * para parágrafo normal — nunca some texto.
 *
 * Tokens DS v2 + Mona Sans (código em monospace do sistema).
 */
import React from 'react';
import { Platform, Text, View, type TextStyle } from 'react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing } = v2;

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Block =
    | { kind: 'p'; text: string }
    | { kind: 'h'; level: number; text: string }
    | { kind: 'li'; ordered: boolean; marker: string; depth: number; text: string }
    | { kind: 'quote'; text: string }
    | { kind: 'hr' }
    | { kind: 'table'; rows: string[][]; header: boolean };

/** Divide as linhas em blocos (parágrafos juntam linhas adjacentes). */
function parseBlocks(src: string): Block[] {
    const blocks: Block[] = [];
    const lines = src.replace(/\r\n/g, '\n').split('\n');
    let para: string[] = [];
    const flushPara = () => {
        if (para.length > 0) {
            blocks.push({ kind: 'p', text: para.join(' ') });
            para = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trimEnd();
        const trimmed = line.trim();

        if (trimmed === '') {
            flushPara();
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
        if (heading) {
            flushPara();
            blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] });
            continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            flushPara();
            blocks.push({ kind: 'hr' });
            continue;
        }
        const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(line);
        if (bullet) {
            flushPara();
            blocks.push({ kind: 'li', ordered: false, marker: '•', depth: bullet[1].length >= 2 ? 1 : 0, text: bullet[2] });
            continue;
        }
        const ordered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
        if (ordered) {
            flushPara();
            blocks.push({ kind: 'li', ordered: true, marker: `${ordered[2]}.`, depth: ordered[1].length >= 2 ? 1 : 0, text: ordered[3] });
            continue;
        }
        if (trimmed.startsWith('> ')) {
            flushPara();
            blocks.push({ kind: 'quote', text: trimmed.slice(2) });
            continue;
        }
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            flushPara();
            const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
            // Linha separadora (|---|---|) marca a anterior como cabeçalho.
            if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
                const prev = blocks[blocks.length - 1];
                if (prev?.kind === 'table') prev.header = true;
                continue;
            }
            const prev = blocks[blocks.length - 1];
            if (prev?.kind === 'table') prev.rows.push(cells);
            else blocks.push({ kind: 'table', rows: [cells], header: false });
            continue;
        }
        para.push(trimmed);
    }
    flushPara();
    return blocks;
}

type Segment = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

/** Inline: **negrito**, *itálico*, `código`; [rótulo](url) vira só o rótulo. */
function parseInline(text: string): Segment[] {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    const segments: Segment[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
    let last = 0;
    for (let m = re.exec(cleaned); m; m = re.exec(cleaned)) {
        if (m.index > last) segments.push({ text: cleaned.slice(last, m.index) });
        const tok = m[0];
        if (tok.startsWith('**')) segments.push({ text: tok.slice(2, -2), bold: true });
        else if (tok.startsWith('`')) segments.push({ text: tok.slice(1, -1), code: true });
        else segments.push({ text: tok.slice(1, -1), italic: true });
        last = m.index + tok.length;
    }
    if (last < cleaned.length) segments.push({ text: cleaned.slice(last) });
    return segments.length > 0 ? segments : [{ text: cleaned }];
}

function InlineText({ text, style, boldColor, codeBg }: {
    text: string;
    style: TextStyle;
    boldColor: string;
    codeBg: string;
}) {
    const segments = parseInline(text);
    return (
        <Text style={style}>
            {segments.map((s, i) => {
                if (s.code) {
                    return (
                        <Text key={i} style={{ fontFamily: MONO, fontSize: (style.fontSize ?? 14) - 1.5, backgroundColor: codeBg }}>
                            {` ${s.text} `}
                        </Text>
                    );
                }
                return (
                    <Text
                        key={i}
                        style={{
                            ...(s.bold ? { fontFamily: 'MonaSans_700Bold', color: boldColor } : null),
                            ...(s.italic ? { fontStyle: 'italic' as const } : null),
                        }}
                    >
                        {s.text}
                    </Text>
                );
            })}
        </Text>
    );
}

export function MarkdownText({ children }: { children: string }) {
    const colors = useV2Colors();
    const base: TextStyle = {
        fontFamily: 'MonaSans_500Medium',
        fontSize: 14,
        lineHeight: 22,
        color: colors.text.secondary,
    };
    const blocks = parseBlocks(children);

    return (
        <View style={{ gap: spacing[2] }}>
            {blocks.map((b, i) => {
                switch (b.kind) {
                    case 'h': {
                        const size = b.level <= 1 ? 16 : b.level === 2 ? 15.5 : 15;
                        return (
                            <Text
                                key={i}
                                style={{
                                    fontFamily: 'MonaSans_700Bold',
                                    fontSize: size,
                                    lineHeight: size + 6,
                                    color: colors.text.primary,
                                    marginTop: i > 0 ? spacing[2] : 0,
                                }}
                            >
                                {b.text}
                            </Text>
                        );
                    }
                    case 'li':
                        return (
                            <View key={i} style={{ flexDirection: 'row', gap: 7, paddingLeft: b.depth ? spacing[5] : spacing[1] }}>
                                <Text style={{ ...base, color: colors.text.tertiary, ...(b.ordered ? { fontVariant: ['tabular-nums'] } : null) }}>
                                    {b.marker}
                                </Text>
                                <View style={{ flex: 1 }}>
                                    <InlineText text={b.text} style={base} boldColor={colors.text.primary} codeBg={colors.surface.card2} />
                                </View>
                            </View>
                        );
                    case 'quote':
                        return (
                            <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: colors.border.default, paddingLeft: spacing[3] }}>
                                <InlineText text={b.text} style={{ ...base, color: colors.text.tertiary }} boldColor={colors.text.secondary} codeBg={colors.surface.card2} />
                            </View>
                        );
                    case 'hr':
                        return <View key={i} style={{ height: 1, backgroundColor: colors.border.default, marginVertical: spacing[1] }} />;
                    case 'table':
                        return (
                            <View
                                key={i}
                                style={{
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                }}
                            >
                                {b.rows.map((row, ri) => (
                                    <View
                                        key={ri}
                                        style={{
                                            paddingVertical: 7,
                                            paddingHorizontal: 11,
                                            backgroundColor: b.header && ri === 0 ? colors.surface.card2 : 'transparent',
                                            borderTopWidth: ri > 0 ? 1 : 0,
                                            borderTopColor: colors.border.default,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily: b.header && ri === 0 ? 'MonaSans_600SemiBold' : 'MonaSans_500Medium',
                                                fontSize: 12.5,
                                                lineHeight: 18,
                                                color: b.header && ri === 0 ? colors.text.tertiary : colors.text.secondary,
                                                fontVariant: ['tabular-nums'],
                                            }}
                                        >
                                            {row.filter(Boolean).join('  ·  ')}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        );
                    default:
                        return (
                            <InlineText key={i} text={b.text} style={base} boldColor={colors.text.primary} codeBg={colors.surface.card2} />
                        );
                }
            })}
        </View>
    );
}
