'use client'

/**
 * MarkdownText — corpo de resposta do Assistente renderizado como markdown.
 *
 * O system-prompt pede "markdown leve" ao modelo desde a Onda 1, mas a UI
 * mostrava o texto cru (###, **) — este componente fecha o contrato. Mapeia os
 * elementos para o idioma "ferramenta profissional": títulos discretos em Mona,
 * rótulos/código em Geist Mono, tabelas hairline, violeta só em link.
 *
 * Usado no texto persistido da mensagem E no stream token a token (o parser
 * re-roda por chunk; para os tamanhos de resposta do Assistente é barato).
 * Segurança: react-markdown constrói a árvore React (sem innerHTML) e HTML
 * embutido é ignorado por padrão.
 */

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const COMPONENTS: Components = {
    p: ({ children }) => <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-k-text-primary">{children}</strong>,
    h1: ({ children }) => <h1 className="mb-2 mt-5 text-[17px] font-semibold tracking-[-0.015em] text-k-text-primary first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-1.5 mt-5 text-[16px] font-semibold tracking-[-0.01em] text-k-text-primary first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-[15px] font-semibold tracking-[-0.01em] text-k-text-primary first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="mb-1 mt-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary first:mt-0">{children}</h4>,
    ul: ({ children }) => <ul className="my-2 space-y-1 pl-[22px] [&_ul]:my-1 [&_ul]:list-[circle] list-disc marker:text-k-text-quaternary">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-[22px] marker:font-mono marker:text-[13px] marker:text-k-text-quaternary [&_ol]:my-1">{children}</ol>,
    li: ({ children }) => <li className="pl-0.5 leading-[1.6]">{children}</li>,
    a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
            className="font-medium text-primary underline decoration-primary/35 underline-offset-2 transition hover:decoration-primary">
            {children}
        </a>
    ),
    blockquote: ({ children }) => (
        <blockquote className="my-2.5 border-l-2 border-k-border-primary pl-3.5 text-k-text-secondary [&_p]:my-1">{children}</blockquote>
    ),
    hr: () => <hr className="my-4 border-k-border-subtle" />,
    code: ({ children, className }) => {
        // Sem linguagem/className e sem quebra de linha = código inline.
        const text = String(children ?? '')
        if (!className && !text.includes('\n')) {
            return <code className="rounded-[6px] bg-surface-inset px-1.5 py-0.5 font-mono text-[12.5px] text-k-text-primary">{children}</code>
        }
        return <code className={`font-mono text-[12.5px] leading-[1.6] ${className ?? ''}`}>{children}</code>
    },
    pre: ({ children }) => (
        <pre className="kv-scroll my-3 overflow-x-auto rounded-panel border border-k-border-subtle bg-surface-inset p-3.5">{children}</pre>
    ),
    table: ({ children }) => (
        <div className="kv-scroll my-3 overflow-x-auto rounded-panel border border-k-border-subtle">
            <table className="w-full border-collapse text-[13px]">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="border-b border-k-border-subtle bg-surface-inset/60">{children}</thead>,
    th: ({ children }) => (
        <th className="px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary">{children}</th>
    ),
    td: ({ children }) => (
        <td className="border-t border-k-border-subtle/60 px-3 py-1.5 align-top tabular-nums text-k-text-primary">{children}</td>
    ),
}

export function MarkdownText({ children, className }: { children: string; className?: string }) {
    return (
        <div className={`text-[15.5px] leading-[1.7] text-k-text-primary ${className ?? ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>{children}</ReactMarkdown>
        </div>
    )
}
