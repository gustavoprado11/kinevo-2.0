import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description: string
    action?: {
        label: string
        onClick: () => void
    }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-glass-bg mb-5">
                <Icon size={24} strokeWidth={1.5} className="text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold text-k-text-primary mb-1.5">
                {title}
            </h3>
            <p className="text-sm text-k-text-secondary text-center max-w-sm">
                {description}
            </p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-5 px-5 py-2.5 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    )
}
