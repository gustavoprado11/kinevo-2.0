import NextImage from 'next/image'

interface IphoneMockupProps {
    src: string
    alt?: string
    className?: string
}

export function IphoneMockup({ src, alt = 'App Kinevo', className = '' }: IphoneMockupProps) {
    return (
        <div className={`relative ${className}`}>
            {/* Phone chassis — titanium */}
            <div className="relative bg-[#3a3a3c] rounded-[2.5rem] p-[5px] border-[3px] border-[#48484a]/60 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
                {/* Inner frame with screen */}
                <div className="relative rounded-[2.2rem] overflow-hidden bg-slate-900 aspect-[9/19.5]">
                    {/* Dynamic Island */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-[90px] h-[26px] bg-black rounded-full" />

                    {/* Screenshot */}
                    <NextImage
                        src={src}
                        alt={alt}
                        fill
                        className="object-cover object-top"
                        unoptimized
                    />
                </div>
            </div>

            {/* Side button (power) */}
            <div className="absolute top-[22%] -right-[2px] w-[3px] h-10 bg-[#636366]/50 rounded-r-sm" />
            {/* Volume buttons */}
            <div className="absolute top-[18%] -left-[2px] w-[3px] h-6 bg-[#636366]/50 rounded-l-sm" />
            <div className="absolute top-[26%] -left-[2px] w-[3px] h-10 bg-[#636366]/50 rounded-l-sm" />
            <div className="absolute top-[34%] -left-[2px] w-[3px] h-10 bg-[#636366]/50 rounded-l-sm" />
        </div>
    )
}
