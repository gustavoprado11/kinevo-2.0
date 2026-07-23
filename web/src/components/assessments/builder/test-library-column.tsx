'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { CATALOG_GROUPS, TEST_CATALOG, type CatalogEntry } from './test-catalog'
import { DraggableTestItem } from './draggable-test-item'

interface TestLibraryColumnProps {
    onAdd: (entry: CatalogEntry) => void
}

export function TestLibraryColumn({ onAdd }: TestLibraryColumnProps) {
    const [query, setQuery] = useState('')

    const grouped = useMemo(() => {
        const norm = query.trim().toLowerCase()
        const filter = (e: CatalogEntry) =>
            !norm
            || e.label.toLowerCase().includes(norm)
            || e.description.toLowerCase().includes(norm)

        return CATALOG_GROUPS.map(group => ({
            ...group,
            entries: TEST_CATALOG.filter(e => e.group === group.id).filter(filter),
        })).filter(g => g.entries.length > 0)
    }, [query])

    return (
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-panel border border-k-border-subtle bg-surface-card">
            <div className="flex-shrink-0 border-b border-k-border-subtle px-4 py-3">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-tertiary">
                    Biblioteca de testes
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-k-border-subtle bg-surface-inset px-2.5 py-1.5">
                    <Search className="h-3.5 w-3.5 text-k-text-quaternary" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar teste"
                        className="w-full bg-transparent text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
                {grouped.length === 0 ? (
                    <div className="px-2 py-8 text-center text-sm text-k-text-tertiary">
                        Nenhum teste encontrado para “{query}”.
                    </div>
                ) : (
                    grouped.map(group => (
                        <div key={group.id} className="mb-4 last:mb-0">
                            <div className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-k-text-quaternary">
                                {group.label}
                            </div>
                            <div className="space-y-1.5">
                                {group.entries.map(entry => (
                                    <DraggableTestItem key={entry.catalogId} entry={entry} onAdd={onAdd} />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </aside>
    )
}
