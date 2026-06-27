/**
 * Validação server-side de compatibilidade de vídeo (backstop de upload).
 *
 * Roda APENAS no servidor (usa fetch com Range + Buffer). É a última linha de
 * defesa contra vídeos que tocam "som sem imagem" no browser/celular dos alunos:
 *   • H.264 10/12-bit — High 10 (110), High 4:2:2 (122), High 4:4:4 (244);
 *   • HEVC/H.265.
 *
 * Postura conservadora: só REJEITA quando há sinal CLARO de codec incompatível.
 * Qualquer outra coisa (H.264 8-bit, WebM/VP8/VP9, AV1, container não
 * reconhecido, ou falha de rede ao baixar) → ACEITA, pra nunca bloquear um
 * vídeo válido. O caminho client já converte o caso comum; aqui é só rede de
 * segurança pra quando a conversão falha/é contornada.
 */

export type VideoCompatCheck = {
    compatible: boolean
    /** motivo legível quando incompatible (ex.: 'H.264 10-bit', 'HEVC') */
    reason?: string
}

const HEAD_BYTES = 4 * 1024 * 1024 // 4MB do início (cobre MP4 faststart)
const TAIL_BYTES = 5 * 1024 * 1024 // 5MB do fim (MP4 de celular: moov no fim)

function indexOfFourCC(buf: Uint8Array, fourcc: string, from = 0): number {
    const a = fourcc.charCodeAt(0), b = fourcc.charCodeAt(1)
    const c = fourcc.charCodeAt(2), d = fourcc.charCodeAt(3)
    for (let i = from; i + 4 <= buf.length; i++) {
        if (buf[i] === a && buf[i + 1] === b && buf[i + 2] === c && buf[i + 3] === d) return i
    }
    return -1
}

/** Baixa início (+fim se preciso) do objeto pra capturar o box moov onde mora
 *  a config do codec, independente de o arquivo ser faststart ou não. */
async function fetchCodecBytes(url: string): Promise<Uint8Array | null> {
    const head = await fetch(url, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` } })
    if (!head.ok && head.status !== 206 && head.status !== 200) return null
    const headBuf = new Uint8Array(await head.arrayBuffer())

    // Total do Content-Range: "bytes 0-4194303/12345678"
    const cr = head.headers.get('content-range')
    const total = cr ? parseInt(cr.split('/')[1] || '', 10) : NaN

    if (!Number.isFinite(total) || total <= headBuf.length) return headBuf

    const tailStart = Math.max(headBuf.length, total - TAIL_BYTES)
    const tail = await fetch(url, { headers: { Range: `bytes=${tailStart}-${total - 1}` } })
    if (!tail.ok && tail.status !== 206) return headBuf
    const tailBuf = new Uint8Array(await tail.arrayBuffer())

    const merged = new Uint8Array(headBuf.length + tailBuf.length)
    merged.set(headBuf, 0)
    merged.set(tailBuf, headBuf.length)
    return merged
}

/**
 * Verifica a URL pública de um vídeo e diz se é seguro servir aos alunos.
 * Nunca lança — em qualquer erro, retorna { compatible: true }.
 */
export async function checkVideoCompat(publicUrl: string): Promise<VideoCompatCheck> {
    try {
        const buf = await fetchCodecBytes(publicUrl)
        if (!buf) return { compatible: true }

        // HEVC: box de config hvcC ou sample entries hev1/hvc1.
        if (indexOfFourCC(buf, 'hvcC') >= 0 || indexOfFourCC(buf, 'hev1') >= 0 || indexOfFourCC(buf, 'hvc1') >= 0) {
            return { compatible: false, reason: 'HEVC/H.265' }
        }

        // H.264: box avcC → payload [configVersion:1][AVCProfileIndication:1].
        // 110=High 10, 122=High 4:2:2, 244=High 4:4:4 (10/12-bit, não decodáveis).
        const i = indexOfFourCC(buf, 'avcC')
        if (i >= 0 && i + 5 < buf.length) {
            const profileIdc = buf[i + 5]
            if (profileIdc === 110 || profileIdc === 122 || profileIdc === 244) {
                return { compatible: false, reason: 'H.264 10-bit' }
            }
        }

        return { compatible: true }
    } catch {
        return { compatible: true }
    }
}

/** Caractere de controle ou DEL (0x00–0x1F, 0x7F)? Checagem por código pra não
 *  precisar de literais de controle no fonte. */
function hasControlChar(s: string): boolean {
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i)
        if (code < 0x20 || code === 0x7f) return true
    }
    return false
}

/**
 * Valida que um caminho do bucket `trainer-videos` pertence ao usuário
 * autenticado e não escapa do próprio prefixo. Quando o servidor DERIVA a URL
 * pública a partir do storagePath (em vez de confiar no videoUrl do cliente),
 * o path passa a ser a entrada confiável — então precisa barrar traversal e
 * paths de outro dono, senão só trocamos "URL não-confiável" por "path
 * não-confiável". Convenção de upload (exercise-form-modal / trainer-video-modal):
 *   `${authUserId}/${exerciseId}/${timestamp}_video.${ext}`
 */
export function isOwnedStoragePath(path: unknown, ownerId: unknown): boolean {
    if (typeof path !== 'string' || typeof ownerId !== 'string' || ownerId.length === 0) {
        return false
    }
    // Sem traversal, barra inicial/absoluta, backslash, esquema/URL embutida ou
    // caractere de controle/NUL.
    if (
        path.includes('..') ||
        path.startsWith('/') ||
        path.includes('\\') ||
        path.includes('://') ||
        hasControlChar(path)
    ) {
        return false
    }
    // Tem que viver sob o prefixo do próprio usuário, com um nome de arquivo
    // depois da barra (não só `${ownerId}/`).
    return path.startsWith(`${ownerId}/`) && path.length > ownerId.length + 1
}
