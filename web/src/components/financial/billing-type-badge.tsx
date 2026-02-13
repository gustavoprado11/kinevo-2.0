import { CreditCard, HandCoins, Banknote, Heart } from 'lucide-react'

interface BillingTypeBadgeProps {
    billingType: string
}

const config: Record<string, { label: string; icon: React.ElementType; classes: string }> = {
    stripe_auto: {
        label: 'Stripe',
        icon: CreditCard,
        classes: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    },
    manual_recurring: {
        label: 'Manual',
        icon: HandCoins,
        classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    manual_one_off: {
        label: 'Avulso',
        icon: Banknote,
        classes: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    },
    courtesy: {
        label: 'Cortesia',
        icon: Heart,
        classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
}

export function BillingTypeBadge({ billingType }: BillingTypeBadgeProps) {
    const item = config[billingType] || config.manual_recurring
    const Icon = item.icon

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border ${item.classes}`}>
            <Icon size={12} strokeWidth={2} />
            {item.label}
        </span>
    )
}
