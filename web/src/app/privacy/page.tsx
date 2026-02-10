import Link from "next/link";
import type { ReactNode } from "react";

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
                    <p className="text-slate-400 text-sm">Última atualização: 10 de fevereiro de 2026</p>
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

                <Section title="7. Contato">
                    Em caso de dúvidas sobre privacidade e proteção de dados, utilize os canais de suporte oficiais da
                    plataforma.
                </Section>
            </div>
        </main>
    );
}
