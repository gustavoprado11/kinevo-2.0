import { ImageResponse } from 'next/og'

// Imagem de preview (Open Graph) gerada por código no build — 1200×630.
// Substitui o antigo /og-image.png que retornava 404. Usada em cartões de
// link no WhatsApp, redes sociais e previews de busca/IA.

export const alt = 'Kinevo — Sistema para personal trainers'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background:
                        'linear-gradient(135deg, #0A0A0B 0%, #1A1030 55%, #2A1A4A 100%)',
                    padding: '80px',
                }}
            >
                {/* Marca */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
                    <div
                        style={{
                            display: 'flex',
                            width: 72,
                            height: 72,
                            borderRadius: 18,
                            background: '#7C3AED',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 44,
                            fontWeight: 800,
                            color: 'white',
                        }}
                    >
                        K
                    </div>
                    <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: 'white' }}>
                        Kinevo
                    </div>
                </div>

                {/* Mensagem principal */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                        style={{
                            display: 'flex',
                            fontSize: 70,
                            fontWeight: 800,
                            color: 'white',
                            lineHeight: 1.08,
                            maxWidth: 960,
                        }}
                    >
                        Sistema para personal trainers
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            fontSize: 34,
                            color: '#C9B8F0',
                            marginTop: 28,
                            maxWidth: 1000,
                            lineHeight: 1.35,
                        }}
                    >
                        Prescrição com IA que você revisa e aprova · App nativo iOS, Android e
                        Apple Watch · Sem taxa
                    </div>
                </div>

                {/* Rodapé */}
                <div style={{ display: 'flex', fontSize: 28, color: '#8E8E93' }}>
                    www.kinevoapp.com
                </div>
            </div>
        ),
        { ...size },
    )
}
