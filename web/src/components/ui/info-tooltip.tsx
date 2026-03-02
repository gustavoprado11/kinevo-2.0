'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

interface InfoTooltipProps {
    content: string
    side?: 'top' | 'bottom'
}

export function InfoTooltip({ content, side = 'top' }: InfoTooltipProps) {
    const [visible, setVisible] = useState(false)
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
    const triggerRef = useRef<HTMLSpanElement>(null)
    const tooltipRef = useRef<HTMLSpanElement>(null)

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current
        const tooltip = tooltipRef.current
        if (!trigger || !tooltip) return

        const rect = trigger.getBoundingClientRect()
        const tooltipRect = tooltip.getBoundingClientRect()

        let top: number
        if (side === 'top') {
            top = rect.top - tooltipRect.height - 8
        } else {
            top = rect.bottom + 8
        }

        let left = rect.left + rect.width / 2 - tooltipRect.width / 2

        // Clamp to viewport
        const margin = 8
        if (left < margin) left = margin
        if (left + tooltipRect.width > window.innerWidth - margin) {
            left = window.innerWidth - margin - tooltipRect.width
        }

        setCoords({ top, left })
    }, [side])

    useEffect(() => {
        if (visible) {
            // Position after portal renders
            requestAnimationFrame(updatePosition)
        }
    }, [visible, updatePosition])

    const show = () => setVisible(true)
    const hide = () => {
        setVisible(false)
        setCoords(null)
    }

    return (
        <>
            <span
                ref={triggerRef}
                className="inline-flex ml-1 cursor-help align-middle"
                onMouseEnter={show}
                onMouseLeave={hide}
            >
                <HelpCircle className={`h-3.5 w-3.5 transition-colors ${visible ? 'text-k-text-tertiary' : 'text-k-text-quaternary'}`} />
            </span>
            {visible && createPortal(
                <span
                    ref={tooltipRef}
                    style={coords ? { top: coords.top, left: coords.left, opacity: 1 } : { top: 0, left: -9999, opacity: 0 }}
                    className="fixed w-64 px-3 py-2 text-[11px] leading-relaxed text-k-text-secondary bg-surface-card border border-k-border-primary rounded-xl shadow-xl z-[100] pointer-events-none transition-opacity duration-150"
                >
                    {content}
                </span>,
                document.body
            )}
        </>
    )
}
