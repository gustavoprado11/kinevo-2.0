// Shared source of truth for FAQ entries. Imported by:
//   - landing-faq.tsx (renders the accordion UI)
//   - faq-jsonld.tsx (renders schema.org FAQPage JSON-LD for rich snippets)
//
// Keep the question/answer copy identical in both places — Google's
// Rich Results Test flags mismatches between visible and structured
// FAQ content. If you edit here, that change flows to both surfaces.

export interface Faq {
    question: string
    answer: string
}

export const faqs: Faq[] = [
    {
        question: 'Preciso pagar para testar?',
        answer: 'Não. Você tem 7 dias grátis com acesso completo. Cancele a qualquer momento se não gostar.',
    },
    {
        question: 'Quanto o Kinevo cobra sobre meus pagamentos?',
        answer: 'Zero. Nós não cobramos nenhum percentual. Você paga apenas as taxas padrão do Stripe (processador de pagamentos internacional).',
    },
    {
        question: 'Meus alunos precisam pagar algo?',
        answer: 'Não. O app do aluno é 100% gratuito. Eles baixam, criam a conta e já podem treinar.',
    },
    {
        question: 'O assistente de prescrição substitui o personal trainer?',
        answer: 'De jeito nenhum. Ele gera rascunhos de programas baseados no perfil do aluno para você ganhar tempo. Você edita, ajusta e aprova tudo antes de chegar ao aluno. E quanto mais você edita, mais ele aprende o seu estilo de prescrever.',
    },
    {
        question: 'Funciona para treino presencial e online?',
        answer: 'Sim. Para presencial, você tem a Sala de Treino — um modo exclusivo para acompanhar múltiplos alunos na academia em tempo real. Para online, o app + dashboard de aderência te dão visibilidade total.',
    },
    {
        question: 'Como funciona a Sala de Treino?',
        answer: 'É um modo presencial. Você abre a Sala de Treino no Kinevo e seleciona os alunos que estão com você na academia. Vê o que cada um está fazendo em tempo real — série atual, frequência cardíaca, tempo de descanso. Quando alguém precisa de você, fica em destaque. Não substitui sua atenção, só evita você ter que olhar 5 celulares.',
    },
    {
        question: 'Posso cancelar quando quiser?',
        answer: 'Sim. Sem fidelidade, sem multa. Cancele direto no painel, sem precisar falar com ninguém.',
    },
    {
        question: 'O app funciona no iPhone e Android?',
        answer: 'Sim. App nativo para ambos, com Apple Watch e Live Activity no iOS.',
    },
    {
        question: 'Como funciona o app no Apple Watch?',
        answer: 'É um app Watch nativo (não uma extensão). O aluno marca série, vê frequência cardíaca em tempo real e timer de descanso direto no relógio — sem tirar o celular do bolso. Sincroniza com o iPhone via WatchConnectivity em background. Funciona com qualquer Apple Watch (Series 4 ou superior, watchOS 9+).',
    },
    {
        question: 'E se a internet da academia for ruim?',
        answer: 'O app funciona offline. O aluno treina normalmente e os dados sincronizam quando a conexão volta.',
    },
    {
        question: 'Os dados sincronizam entre dispositivos?',
        answer: 'Sim, em tempo real. O aluno pode começar o treino no iPhone, marcar séries no Apple Watch e ver o histórico no iPad. Você vê tudo no painel web ou no seu celular. Tudo via Supabase Realtime.',
    },
    {
        question: 'O Kinevo usa inteligência artificial?',
        answer: 'Sim, mas como ferramenta, não como substituto. O assistente de prescrição gera rascunhos de programas para agilizar seu trabalho. Você sempre tem a palavra final. Também usamos IA nos formulários, gerando anamneses e check-ins em segundos a partir de templates.',
    },
    {
        question: 'O que acontece com meus dados se eu cancelar?',
        answer: 'Você consegue exportar tudo (alunos, programas, históricos, financeiro) em CSV antes de cancelar. Após o cancelamento, mantemos seus dados por 90 dias caso você queira voltar — depois disso, exclusão permanente conforme LGPD.',
    },
]
