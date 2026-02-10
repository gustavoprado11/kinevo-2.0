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

export default function TermsPage() {
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
                        Termos de Uso
                    </h1>
                    <p className="text-slate-400 text-sm">Última atualização: 10 de fevereiro de 2026</p>
                </header>

                <Section title="1. Aceitação">
                    Ao acessar e utilizar o Kinevo, você declara que leu, entendeu e concorda com estes termos. Caso
                    não concorde, deve interromper o uso da plataforma.
                </Section>

                <Section title="2. Uso permitido">
                    O serviço deve ser utilizado de forma lícita e conforme sua finalidade de gestão e acompanhamento
                    de treinos. É proibido uso abusivo, fraudulento ou que comprometa a segurança do sistema.
                </Section>

                <Section title="3. Conta e segurança">
                    Você é responsável por manter suas credenciais em sigilo e por todas as atividades realizadas em
                    sua conta. Em caso de suspeita de acesso indevido, entre em contato com o suporte imediatamente.
                </Section>

                <Section title="4. Saúde e responsabilidade">
                    O Kinevo não substitui avaliação médica. Recomenda-se acompanhamento de profissional qualificado
                    antes de iniciar ou alterar treinos e rotinas físicas.
                </Section>

                <Section title="5. Propriedade intelectual">
                    Marca, software, design e conteúdos da plataforma são protegidos por legislação aplicável. É
                    proibida reprodução, modificação ou distribuição sem autorização prévia.
                </Section>

                <Section title="6. Suspensão e encerramento">
                    O serviço pode ser suspenso ou encerrado em caso de violação destes termos, risco de segurança,
                    fraude ou descumprimento legal.
                </Section>

                <Section title="7. Alterações destes termos">
                    Podemos atualizar estes termos periodicamente. O uso continuado da plataforma após atualização
                    caracteriza aceitação da versão vigente.
                </Section>

                <Section title="8. Contato">
                    Para dúvidas jurídicas ou operacionais, utilize os canais oficiais de suporte da plataforma.
                </Section>
            </div>
        </main>
    );
}
