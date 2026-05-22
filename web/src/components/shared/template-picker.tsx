'use client'

export interface TemplatePickerOption {
    id: string
    title: string
    /** Display extra (ex.: "v3"). */
    version?: number
}

interface TemplatePickerProps {
    /** Categoria informativa — usada pra placeholder e label do badge. */
    category: 'form' | 'assessment'
    templates: TemplatePickerOption[]
    value: string
    onChange: (id: string) => void
}

// M8/D3 — picker de template compartilhado. Renderiza select dropdown.
// O server já filtra por category — esse componente só varia a UI textual
// conforme a prop category.
export function TemplatePicker({ category, templates, value, onChange }: TemplatePickerProps) {
    const placeholder =
        category === 'assessment'
            ? 'Selecione um template de avaliação...'
            : 'Selecione um template...'

    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50 dark:focus:ring-violet-500/10"
            required
        >
            <option value="">{placeholder}</option>
            {templates.map(t => {
                const label = t.version != null
                    ? `${cleanTemplateName(t.title)} (v${t.version})`
                    : cleanTemplateName(t.title)
                return (
                    <option key={t.id} value={t.id}>
                        {label}
                    </option>
                )
            })}
        </select>
    )
}

function cleanTemplateName(name: string): string {
    const parts = name.split(' - ')
    if (parts.length === 2 && parts[1].toLowerCase().includes(parts[0].toLowerCase())) {
        return parts[1]
    }
    return name
}
