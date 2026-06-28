import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: 'Política de Privacidade',
    description: 'Política de Privacidade do Kinevo: como coletamos, usamos e protegemos seus dados pessoais e de treino.',
    alternates: {
        canonical: 'https://www.kinevoapp.com/privacy',
    },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{children}</p>
        </section>
    );
}

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
                <div className="mb-8">
                    <Link href="/" className="text-sm text-violet-400 hover:text-violet-300">
                        Voltar para início
                    </Link>
                </div>

                <header className="mb-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
                        Política de Privacidade
                    </h1>
                    <p className="text-slate-400 text-sm">Última atualização: 24 de junho de 2026</p>
                </header>

                <Section title="1. Dados coletados">
                    Coletamos dados de cadastro (nome, e-mail e identificadores de autenticação), informações de
                    perfil e dados de treino (sessões, exercícios, carga, repetições, duração e feedback).
                </Section>

                <Section title="2. Finalidade do uso">
                    Usamos os dados para operar a plataforma, disponibilizar histórico e acompanhamento de evolução,
                    oferecer suporte, prevenir fraude e melhorar estabilidade e experiência do produto.
                </Section>

                <Section title="3. Compartilhamento">
                    Não vendemos dados pessoais. O compartilhamento ocorre apenas com provedores essenciais para
                    autenticação, infraestrutura e pagamentos, quando necessário para prestação do serviço.
                </Section>

                <Section title="4. Segurança">
                    Adotamos medidas técnicas e organizacionais para proteger dados contra acesso não autorizado, perda
                    ou alteração. Mesmo assim, nenhum sistema garante risco zero.
                </Section>

                <Section title="5. Direitos do titular">
                    Você pode solicitar acesso, correção e exclusão de dados, conforme a legislação aplicável.
                    Solicitações podem ser feitas pelos canais oficiais de suporte.
                </Section>

                <Section title="6. Retenção e descarte">
                    Mantemos os dados apenas pelo período necessário para cumprir finalidades legítimas, obrigações
                    legais e prevenção de fraude. Após isso, os dados podem ser anonimizados ou excluídos.
                </Section>

                <Section title="7. Recursos de IA do próprio Kinevo (Assistente, prescrição, formulários e voz)">
                    Além do conector opcional descrito abaixo, o Kinevo oferece recursos de inteligência
                    artificial integrados — o Assistente do treinador, a prescrição assistida por IA, a
                    geração de formulários, os rascunhos de mensagens, os insights e a transcrição de
                    comandos de voz. Para gerar essas respostas, trechos dos dados da sua conta são
                    transmitidos a provedores de modelos de linguagem que atuam como operadores
                    (sub-processadores) por nossa conta, todos com processamento nos{" "}
                    <strong className="text-slate-100">Estados Unidos (EUA)</strong>:{" "}
                    <a
                        href="https://openai.com/policies/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 underline"
                    >
                        OpenAI
                    </a>{" "}
                    (provedor principal — Assistente, geração de formulários, rascunhos de mensagens,
                    insights e transcrição de voz), a{" "}
                    <a
                        href="https://www.anthropic.com/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 underline"
                    >
                        Anthropic
                    </a>{" "}
                    (modelo Claude — prescrição assistida por IA e parte do Assistente) e o{" "}
                    <a
                        href="https://policies.google.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 underline"
                    >
                        Google
                    </a>{" "}
                    (modelo Gemini — geração de programas de treino). Esses dados podem incluir
                    informações pessoais e <strong className="text-slate-100">dados sensíveis de saúde</strong>{" "}
                    dos seus alunos (por exemplo, restrições clínicas e respostas de check-in). Como o
                    processamento ocorre nos EUA, há{" "}
                    <strong className="text-slate-100">transferência internacional de dados pessoais</strong>,{" "}
                    realizada com base nas salvaguardas e hipóteses legais previstas na LGPD. Nos planos de
                    API pagos que utilizamos, esses provedores{" "}
                    <strong className="text-slate-100">não usam o conteúdo enviado para treinar seus modelos</strong>{" "}
                    e aplicam retenção limitada apenas para segurança e prevenção de abuso. Aplicamos
                    minimização de dados: informações clínicas e respostas de saúde só são enviadas quando a
                    tarefa exige (por exemplo, ao prescrever um treino).
                </Section>

                <Section title="8. Conector MCP e assistentes de IA">
                    O Kinevo oferece um conector MCP (Model Context Protocol) que permite operar a plataforma a partir
                    de assistentes de IA como o Claude (Anthropic) e o ChatGPT (OpenAI). A conexão é opcional e iniciada
                    por você: ao autorizá-la, o assistente passa a poder consultar e gerenciar, em seu nome, dados da
                    sua conta — alunos (incluindo dados de contato, objetivos e eventuais restrições clínicas
                    informadas), programas e sessões de treino, histórico de cargas e progresso, mensagens trocadas com
                    alunos e informações financeiras. O acesso é restrito exclusivamente aos dados da sua conta de
                    treinador autenticada.
                </Section>

                <Section title="9. Compartilhamento com provedores de IA (conector)">
                    Quando você usa o conector, os dados retornados pelas ferramentas são transmitidos ao provedor do
                    assistente que você escolheu (por exemplo, a Anthropic, no caso do Claude) para que ele gere as
                    respostas, passando a ser tratados conforme a política de privacidade desse provedor. Como esses
                    dados podem incluir informações pessoais de seus alunos — inclusive dados sensíveis de saúde —,
                    recomendamos conectar apenas assistentes em que você confia e não expor informações além do
                    necessário. Consulte a{" "}
                    <a
                        href="https://www.anthropic.com/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 underline"
                    >
                        Política de Privacidade da Anthropic
                    </a>
                    .
                </Section>

                <Section title="10. Credenciais, autenticação e revogação">
                    O acesso ao conector é autenticado por API keys ou por tokens OAuth 2.0. As credenciais são
                    armazenadas apenas de forma cifrada (hash) — nunca em texto puro — e a chave ou segredo é exibida
                    uma única vez, no momento da criação. Os tokens de acesso expiram automaticamente e podem ser
                    renovados; você pode revogar qualquer API key ou autorização a qualquer momento nas configurações
                    da sua conta, encerrando imediatamente o acesso do assistente. Registramos metadados de uso das
                    ferramentas (qual ferramenta foi chamada, data, hora e resultado) para fins de segurança, suporte e
                    prevenção de abuso.
                </Section>

                <Section title="11. Contato">
                    Em caso de dúvidas sobre privacidade e proteção de dados, utilize os canais de suporte oficiais da
                    plataforma.
                </Section>
            </div>
        </main>
    );
}
