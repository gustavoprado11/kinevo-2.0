import NextImage from 'next/image'

interface MacbookMockupProps {
    src: string
    alt?: string
    className?: string
}

export function MacbookMockup({ src, alt = 'Dashboard Kinevo', className = '' }: MacbookMockupProps) {
    return (
        <div className={`relative ${className}`}>
            {/* Screen bezel */}
            <div className="relative bg-[#1a1a1a] rounded-t-xl pt-3 px-3 pb-0 border border-slate-700/60 border-b-0">
                {/* Camera + top bar */}
                <div className="flex items-center justify-center mb-2">
                    <div className="w-2 h-2 rounded-full bg-slate-600/80" />
                </div>

                {/* Screen area */}
                <div className="relative rounded-t-sm overflow-hidden bg-slate-900 aspect-[16/10]">
                    <NextImage
                        src={src}
                        alt={alt}
                        fill
                        className="object-cover object-top"
                        unoptimized
                    />
                </div>
            </div>

            {/* Bottom bezel / hinge */}
            <div className="relative">
                {/* Hinge strip */}
                <div className="h-[6px] bg-gradient-to-b from-[#2a2a2a] to-[#1e1e1e] rounded-b-sm border-x border-slate-700/60" />
                {/* Base / keyboard deck */}
                <div className="relative mx-auto">
                    <div
                        className="h-3 bg-gradient-to-b from-[#2a2a2e] to-[#222226] rounded-b-xl border border-t-0 border-slate-700/40"
                        style={{
                            clipPath: 'polygon(3% 0%, 97% 0%, 100% 100%, 0% 100%)',
                        }}
                    />
                    {/* Notch / opening indent */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[4px] bg-[#333] rounded-b-lg" />
                </div>
            </div>
        </div>
    )
}
