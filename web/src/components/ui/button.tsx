import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]'

        const variants = {
            default: 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30',
            outline: 'border border-border bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900',
            ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
