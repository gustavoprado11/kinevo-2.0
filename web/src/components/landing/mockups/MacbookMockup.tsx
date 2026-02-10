import NextImage from 'next/image'

interface MacbookMockupProps {
    src: string
    alt?: string
    className?: string
}

export function MacbookMockup({ src, alt = 'Dashboard Kinevo', className = '' }: MacbookMockupProps) {
    const keyboardRows = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
        [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
        [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3],
        [2, 2, 2, 6, 2, 2],
    ]

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
                <div className="relative mx-auto border border-t-0 border-slate-700/40 rounded-b-2xl bg-gradient-to-b from-[#2a2a2e] via-[#24262b] to-[#1f2126] px-2.5 md:px-4 pt-1.5 md:pt-2 pb-2.5 md:pb-3 [clip-path:polygon(1.8%_0%,98.2%_0%,100%_100%,0%_100%)]">
                    {/* Notch / opening indent */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[4px] bg-[#36363a] rounded-b-lg" />

                    {/* Keyboard */}
                    <div className="rounded-xl border border-slate-600/30 bg-[#181b20] px-2 py-1.5 md:px-3 md:py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-8px_20px_rgba(0,0,0,0.4)]">
                        <div className="space-y-1 md:space-y-1.5">
                            {keyboardRows.map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-14 gap-1 md:gap-1.5">
                                    {row.map((span, keyIndex) => (
                                        <div
                                            key={`${rowIndex}-${keyIndex}`}
                                            className="h-[6px] md:h-[8px] rounded-[4px] border border-slate-500/20 bg-gradient-to-b from-slate-500/20 to-slate-700/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                                            style={{
                                                gridColumn: `span ${span} / span ${span}`,
                                            }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Trackpad */}
                        <div className="mx-auto mt-2 md:mt-3 w-[34%] h-5 md:h-6 rounded-md border border-slate-500/30 bg-gradient-to-b from-slate-500/10 to-slate-700/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
                    </div>

                    {/* Front lip */}
                    <div className="mx-auto mt-1.5 w-16 h-[2px] rounded-full bg-slate-400/25" />
                </div>
            </div>
        </div>
    )
}
