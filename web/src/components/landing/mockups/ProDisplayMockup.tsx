import NextImage from 'next/image'

interface ProDisplayMockupProps {
    src: string
    alt?: string
    className?: string
}

export function ProDisplayMockup({ src, alt = 'Dashboard Kinevo', className = '' }: ProDisplayMockupProps) {
    return (
        <div className={`relative ${className}`}>
            {/* Monitor body — aluminum outer bezel */}
            <div className="relative bg-gradient-to-b from-[#e4e4e7] to-[#d4d4d8] rounded-[12px] p-[6px] shadow-[0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.08)]">
                {/* Inner black bezel */}
                <div className="bg-[#1a1a1a] rounded-[8px] p-[4px]">
                    {/* Screen area */}
                    <div className="relative rounded-[4px] overflow-hidden bg-slate-900 aspect-[16/10]">
                        <NextImage
                            src={src}
                            alt={alt}
                            fill
                            className="object-cover object-top"
                            unoptimized
                        />
                    </div>
                </div>
            </div>

            {/* Stand arm */}
            <div className="mx-auto w-[6%] h-10 md:h-14 bg-gradient-to-b from-[#d4d4d8] to-[#c4c4c8] relative">
                {/* Subtle center highlight */}
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[60%] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>

            {/* Stand base — oval */}
            <div className="mx-auto w-[22%] h-[6px] md:h-2 bg-gradient-to-b from-[#c4c4c8] to-[#b4b4b8] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.1)]" />
        </div>
    )
}
