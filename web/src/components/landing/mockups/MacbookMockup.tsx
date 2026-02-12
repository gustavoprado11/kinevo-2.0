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
                <div className="h-[7px] bg-gradient-to-b from-[#2f3138] to-[#23252b] rounded-b-sm border-x border-slate-700/50" />
                {/* Base / keyboard deck */}
                <div className="relative mx-auto border border-t-0 border-slate-700/40 rounded-b-2xl bg-gradient-to-b from-[#343842] via-[#2b2f39] to-[#21252d] h-4 md:h-5 [clip-path:polygon(1.8%_0%,98.2%_0%,100%_100%,0%_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.08)]">
                    {/* Notch / opening indent */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-[4px] bg-[#3b3f48] rounded-b-lg" />
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-14 h-[2px] rounded-full bg-slate-300/20" />
                </div>
            </div>
        </div>
    )
}
