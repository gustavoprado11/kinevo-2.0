import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Conecte o Kinevo ao Claude e a outros assistentes de IA",
    description:
        "Como conectar sua conta Kinevo a assistentes de IA como o Claude e o ChatGPT via conector MCP — login OAuth ou API key, prompts de exemplo e privacidade.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
            <div className="text-slate-300 leading-relaxed space-y-3">{children}</div>
        </section>
    );
}

function Code({ children }: { children: ReactNode }) {
    return (
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-violet-300">
            {children}
        </code>
    );
}

export default function ConectorDocPage() {
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
                        Conecte o Kinevo ao Claude e a outros assistentes de IA
                    </h1>
                    <p className="text-slate-400">
                        O conector do Kinevo permite operar sua conta a partir de um assistente de IA — como o{" "}
                        <strong>Claude</strong> (Anthropic) ou o <strong>ChatGPT</strong> (OpenAI) — usando linguagem
                        natural. Em vez de navegar pelo painel, você conversa: &quot;quais alunos não treinaram essa
                        semana?&quot;, &quot;cria um programa de hipertrofia de 8 semanas para a Maria&quot;, &quot;qual a
                        progressão de carga do João no agachamento?&quot;. Tudo o que o assistente acessa é restrito à
                        sua conta de treinador e exige uma assinatura Kinevo ativa.
                    </p>
                </header>

                <Section title="Pré-requisitos">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Conta Kinevo de treinador com assinatura ativa (ou em período de teste).</li>
                        <li>Um cliente que suporte conectores MCP (Claude.ai, Claude Desktop, ChatGPT, etc.).</li>
                    </ul>
                </Section>

                <Section title="Como conectar no Claude (OAuth — recomendado)">
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>No Claude, vá em <strong>Configurações → Conectores → Adicionar conector personalizado</strong>.</li>
                        <li>Em <strong>URL do servidor</strong>, informe: <Code>https://www.kinevoapp.com/api/mcp</Code></li>
                        <li>O Claude abrirá a tela de autorização do Kinevo. <strong>Faça login</strong> com seu e-mail e senha de treinador.</li>
                        <li>Revise o que será autorizado e confirme. Pronto — o conector aparece como conectado.</li>
                    </ol>
                    <p className="text-slate-400 text-sm">
                        O acesso usa OAuth 2.1 com PKCE. Nenhuma senha é compartilhada com o Claude; ele recebe apenas um
                        token de acesso temporário que você pode revogar quando quiser.
                    </p>
                </Section>

                <Section title="Como conectar via API Key (alternativa)">
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>No Kinevo, vá em <strong>Configurações → API Keys</strong> e clique em <strong>Gerar nova key</strong>.</li>
                        <li>Copie a key (<Code>kinevo_trainer_…</Code>). <strong>Ela é exibida uma única vez.</strong></li>
                        <li>No seu cliente, configure o cabeçalho de autorização: <Code>Authorization: Bearer kinevo_trainer_…</Code></li>
                    </ol>
                </Section>

                <Section title="O que você pode fazer">
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Alunos:</strong> listar, ver perfil completo (incl. restrições clínicas), cadastrar, atualizar.</li>
                        <li><strong>Programas:</strong> listar, ver detalhes, criar, atribuir a um aluno, expirar.</li>
                        <li><strong>Prescrição:</strong> montar sessões agendadas por dia da semana, adicionar exercícios, métodos avançados (pirâmide, drop-set, cluster, 5x5), supersets.</li>
                        <li><strong>Progresso:</strong> histórico de treinos, aderência, progressão de carga (com 1RM estimado), respostas de formulários.</li>
                        <li><strong>Comunicação:</strong> listar conversas, ler e enviar mensagens para alunos.</li>
                        <li><strong>Financeiro:</strong> assinaturas/contratos dos alunos, resumo de receita (MRR).</li>
                    </ul>
                </Section>

                <Section title="Prompts de exemplo">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>&quot;Quais alunos não treinaram nos últimos 7 dias?&quot;</li>
                        <li>&quot;Me dá um resumo do meu mês: alunos ativos, programas e receita.&quot;</li>
                        <li>&quot;Cria um programa de hipertrofia de 8 semanas para a Maria, treinos A/B/C, e agenda para segunda, quarta e sexta.&quot;</li>
                        <li>&quot;No programa do João, troca o agachamento livre por hack squat e muda para 4x6-8.&quot;</li>
                        <li>&quot;Qual a progressão de carga do Carlos no supino nos últimos 3 meses?&quot;</li>
                        <li>&quot;Manda uma mensagem motivacional pro Pedro.&quot;</li>
                    </ul>
                </Section>

                <Section title="Privacidade e segurança">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>O conector acessa apenas os dados da sua conta. Ele não acessa dados de outros treinadores.</li>
                        <li>Ao usar o conector, os dados retornados são enviados ao provedor do assistente (ex.: Anthropic) para gerar as respostas, conforme a política de privacidade dele. Como podem incluir dados de saúde dos alunos, conecte apenas assistentes em que você confia.</li>
                        <li>Credenciais (API keys e tokens OAuth) são armazenadas apenas de forma cifrada. Você pode revogar qualquer acesso a qualquer momento em <strong>Configurações → API Keys</strong> (ou removendo o conector no cliente).</li>
                        <li>Detalhes completos na <Link href="/privacy" className="text-violet-400 hover:text-violet-300 underline">Política de Privacidade</Link>.</li>
                    </ul>
                </Section>

                <Section title="Solução de problemas">
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>&quot;Sua assinatura está inativa&quot;:</strong> o conector exige assinatura ativa. Renove em Configurações → Financeiro.</li>
                        <li><strong>Token expirado:</strong> tokens de acesso expiram periodicamente e são renovados automaticamente; se necessário, reconecte.</li>
                        <li><strong>Limite de requisições:</strong> o conector limita o volume de chamadas por minuto/dia para proteger sua conta.</li>
                    </ul>
                </Section>
            </div>
        </main>
    );
}
