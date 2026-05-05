'use client'

export interface ChipOption<T extends string> {
    value: T
    label: string
}

interface SingleChipRowProps<T extends string> {
    options: ChipOption<T>[]
    value: T
    onChange: (next: T) => void
    multi?: false
    ariaLabel?: string
}

interface MultiChipRowProps<T extends string> {
    options: ChipOption<T>[]
    value: T[]
    onChange: (next: T[]) => void
    multi: true
    minSelected?: number
    ariaLabel?: string
}

type ChipRowProps<T extends string> = SingleChipRowProps<T> | MultiChipRowProps<T>

export function ChipRow<T extends string>(props: ChipRowProps<T>) {
    const isMulti = props.multi === true
    const selected = new Set<T>(isMulti ? props.value : [props.value])

    const handleClick = (option: T) => {
        if (isMulti) {
            const minSelected = props.minSelected ?? 0
            const isSelected = selected.has(option)
            if (isSelected) {
                if (props.value.length <= minSelected) return
                props.onChange(props.value.filter((v) => v !== option))
            } else {
                props.onChange([...props.value, option])
            }
        } else {
            if (props.value === option) return
            props.onChange(option)
        }
    }

    return (
        <div
            role={isMulti ? 'group' : 'radiogroup'}
            aria-label={props.ariaLabel}
            className="flex flex-wrap gap-1.5"
        >
            {props.options.map((option) => {
                const active = selected.has(option.value)
                return (
                    <button
                        key={option.value}
                        type="button"
                        {...(isMulti
                            ? { 'aria-pressed': active }
                            : { role: 'radio', 'aria-checked': active })}
                        onClick={() => handleClick(option.value)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors duration-150 ${
                            active
                                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border-transparent'
                                : 'bg-surface-card text-k-text-tertiary border-k-border-subtle hover:text-k-text-primary'
                        }`}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
