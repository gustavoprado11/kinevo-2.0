import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
        // Direção "ferramenta profissional" (fase 3): a ação primária é sólida
        // no token da marca — sem gradiente, sem glow, canto de 8px.
        const baseStyles = 'inline-flex items-center justify-center rounded-control text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]'

        const variants = {
            default: 'bg-primary text-primary-foreground font-semibold shadow-none hover:opacity-90',
            outline: 'border border-k-border-primary bg-surface-card text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary',
            ghost: 'text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary',
            destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
            link: 'text-primary underline-offset-4 hover:underline',
        }

        const sizes = {
            default: 'h-10 px-4 py-2',
            sm: 'h-9 px-3',
            lg: 'h-11 px-8',
            icon: 'h-10 w-10',
        }

        const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`

        return (
            <button
                ref={ref}
                className={combinedClassName}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"
