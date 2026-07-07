import { CreditCard, HandCoins, Banknote, Heart, Link2, RefreshCw } from 'lucide-react'

interface BillingTypeBadgeProps {
    billingType: string
}

const config: Record<string, { label: string; icon: React.ElementType; classes: string }> = {
    stripe_auto: {
        label: 'Stripe',
        icon: CreditCard,
        classes: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    },
    manual_recurring: {
        label: 'Manual',
        icon: HandCoins,
        classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    manual_one_off: {
        label: 'Avulso',
        icon: Banknote,
        classes: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
    },
    courtesy: {
        label: 'Cortesia',
        icon: Heart,
        classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
    // Asaas (trilho principal): sem estas entradas o fallback rendia "Manual"
    // — o treinador não distinguia débito automático de cobrança manual.
    asaas_auto: {
        label: 'Cobrança Asaas',
        icon: Link2,
        classes: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    },
    asaas_auto_recurring: {
        label: 'Cartão automático',
        icon: RefreshCw,
        classes: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
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
