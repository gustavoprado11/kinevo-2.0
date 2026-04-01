import { ReactNode } from 'react'
import { Z } from '@/lib/z-index'

// Base dimensions of the phone (iPhone 14 proportions)
export const PHONE_WIDTH = 375
export const PHONE_HEIGHT = 812

interface PhoneFrameProps {
    children: ReactNode
    /** Scale factor (0.55 – 1). Controls how large the phone appears. */
    scale?: number
}

export function PhoneFrame({ children, scale = 0.82 }: PhoneFrameProps) {
    return (
        <div
            style={{
                // Container occupies the scaled visual size so flex layout respects it
                width: PHONE_WIDTH * scale,
                height: PHONE_HEIGHT * scale,
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    width: PHONE_WIDTH,
                    height: PHONE_HEIGHT,
                    borderRadius: 40,
                    border: '8px solid #1a1a2e',
                    backgroundColor: '#f8fafc',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
                    position: 'relative',
                    flexShrink: 0,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    transition: 'transform 200ms ease',
                }}
            >
                {/* Dynamic Island */}
                <div
                    style={{
                        position: 'absolute',
                        top: 8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 120,
                        height: 34,
                        borderRadius: 20,
                        backgroundColor: '#000',
                        zIndex: Z.STICKY,
                    }}
                />

                {/* Screen content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {children}
                </div>

                {/* Home indicator */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        paddingBottom: 8,
                        paddingTop: 4,
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
                            width: 134,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: '#000',
                            opacity: 0.2,
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
