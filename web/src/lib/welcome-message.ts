const IOS_LINK = 'https://apps.apple.com/br/app/kinevo/id6759053587'
const ANDROID_LINK = '' // Not yet available

interface WelcomeMessageParams {
    studentName: string
    email: string
    password: string
    formName?: string | null
}

export function buildWelcomeMessage({ studentName, email, password, formName }: WelcomeMessageParams): string {
    const firstName = studentName.split(' ')[0]
    const androidLine = ANDROID_LINK
        ? `Android: ${ANDROID_LINK}`
        : 'Android: Em breve!'

    let msg = `Olá, ${firstName}! 👋\nBem-vindo(a) ao meu acompanhamento de treinos! A partir de agora, seus treinos estarão organizados no app Kinevo.\n\n📱 Baixe o app:\niPhone: ${IOS_LINK}\n${androidLine}\n\n🔐 Seus dados de acesso:\nEmail: ${email}\nSenha: ${password}`

    if (formName) {
        msg += `\n\n📋 Preparei um formulário para conhecer melhor você: "${formName}". Ele estará disponível no app assim que você fizer login — procure na aba Inbox. Responda com calma e com o máximo de detalhes possível!`
    }

    msg += '\n\nQualquer dúvida, estou à disposição! Vamos juntos! 💪'
    return msg
}

export function buildWelcomeMessageWhatsApp({ studentName, email, password, formName }: WelcomeMessageParams): string {
    const firstName = studentName.split(' ')[0]
    const androidLine = ANDROID_LINK
        ? `*Android:* ${ANDROID_LINK}`
        : '*Android:* Em breve!'

    let msg = `Olá, ${firstName}!\nBem-vindo(a) ao meu acompanhamento de treinos! A partir de agora, seus treinos estarão organizados no app *Kinevo*.\n\n*Baixe o app:*\n*iPhone:* ${IOS_LINK}\n${androidLine}\n\n*Seus dados de acesso:*\n*Email:* ${email}\n*Senha:* ${password}`

    if (formName) {
        msg += `\n\nPreparei um formulário para conhecer melhor você: *"${formName}"*. Ele estará disponível no app assim que você fizer login — procure na aba *Inbox*. Responda com calma e com o máximo de detalhes possível!`
    }

    msg += '\n\nQualquer dúvida, estou à disposição! Vamos juntos!'
    return msg
}

export function formatPhoneForWhatsApp(phone: string): string {
    let digits = phone.replace(/\D/g, '')
    if (digits.startsWith('0')) digits = digits.slice(1)
    if (!digits.startsWith('55')) digits = '55' + digits
    return digits
}
