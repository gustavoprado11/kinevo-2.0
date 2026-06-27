// Fonte de verdade do FAQ para o JSON-LD (schema.org FAQPage) em faq-jsonld.tsx.
//
// IMPORTANTE: estas perguntas/respostas DEVEM bater 1:1 com o FAQ VISÍVEL da
// landing (renderizado em components/landing/v2 — seção #faq do HTML do design).
// O Rich Results Test do Google sinaliza divergência entre o FAQ visível e o
// estruturado. Se editar o FAQ da landing, atualize aqui também.

export interface Faq {
    question: string
    answer: string
}

export const faqs: Faq[] = [
    {
        question: 'O Kinevo cobra comissão sobre os pagamentos?',
        answer: 'O Kinevo não cobra comissão sobre o que você recebe dos seus alunos — só a assinatura do plano. A única tarifa que incide é a padrão do processador de pagamentos (Asaas) ao cobrar por PIX, cartão ou boleto — a mesma que você pagaria usando o Asaas direto.',
    },
    {
        question: 'A IA substitui o meu trabalho?',
        answer: 'Não. O Assistente de IA é ferramenta, não substituto. Ele monta rascunhos e adianta o trabalho chato, mas nada vai pro aluno sem o seu OK. Você sempre tem a palavra final.',
    },
    {
        question: 'Funciona pra quem atende presencial e online?',
        answer: 'Sim. Pra presencial tem a Sala de Treino (acompanha vários alunos ao mesmo tempo). Pra online o aluno treina pelo app, com tudo preenchido e lembrete no dia certo.',
    },
    {
        question: 'O Apple Watch funciona de verdade?',
        answer: 'Funciona. O treino aparece direto no relógio do aluno — ele marca a série e vê os batimentos sem precisar tirar o celular do bolso.',
    },
    {
        question: 'E se faltar internet na academia?',
        answer: 'O app funciona sem internet. O aluno treina normalmente e tudo sincroniza sozinho quando a conexão voltar.',
    },
    {
        question: 'Meus dados ficam presos no Kinevo?',
        answer: 'Não. Seus dados são seus: você exporta tudo em CSV quando quiser. Tratamos os dados conforme a LGPD.',
    },
    {
        question: 'Como o Kinevo se compara ao MFIT, Tecnofit ou Trainerize?',
        answer: 'A diferença está na prescrição avançada de verdade, no Assistente de IA que você aprova, no Apple Watch nativo e no recebimento sem taxa — tudo em português e com suporte de gente de verdade.',
    },
]
