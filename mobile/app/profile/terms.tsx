import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import type { ReactNode } from "react";

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <View style={{ marginBottom: 20 }}>
            <Text
                style={{
                    color: "#f1f5f9",
                    fontSize: 16,
                    fontWeight: "700",
                    marginBottom: 8,
                }}
            >
                {title}
            </Text>
            <Text
                style={{
                    color: "#94a3b8",
                    fontSize: 13,
                    lineHeight: 21,
                }}
            >
                {children}
            </Text>
        </View>
    );
}

export default function TermsScreen() {
    return (
        <>
            <Stack.Screen options={{ title: "Termos de Uso" }} />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <Text style={{ color: "#f8fafc", fontSize: 26, fontWeight: "800", marginBottom: 6 }}>
                    Termos de Uso
                </Text>
                <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 22 }}>
                    Última atualização: 10/02/2026
                </Text>

                <Section title="1. Aceitação dos termos">
                    Ao usar o app Kinevo, você concorda com estes termos e com a política de privacidade vigente.
                    Se não concordar, interrompa o uso do serviço.
                </Section>

                <Section title="2. Uso da plataforma">
                    O app é destinado ao acompanhamento de treinos e evolução física. Você concorda em fornecer
                    informações verdadeiras, manter suas credenciais seguras e utilizar a plataforma de forma lícita.
                </Section>

                <Section title="3. Responsabilidades do usuário">
                    Você é responsável pelas ações realizadas em sua conta. Recomendamos não compartilhar login e
                    senha com terceiros e reportar qualquer uso suspeito imediatamente.
                </Section>

                <Section title="4. Limitações e isenção">
                    O Kinevo não substitui avaliação médica ou orientação profissional de saúde. Sempre consulte um
                    profissional qualificado antes de iniciar ou alterar seu treino.
                </Section>

                <Section title="5. Suspensão e encerramento">
                    Podemos suspender ou encerrar contas em caso de violação destes termos, fraude, uso abusivo ou
                    risco à segurança do serviço e de outros usuários.
                </Section>

                <Section title="6. Propriedade intelectual">
                    O software, design, marca e conteúdos da plataforma são protegidos por legislação aplicável e não
                    podem ser reproduzidos sem autorização prévia.
                </Section>

                <Section title="7. Alterações destes termos">
                    Podemos atualizar estes termos periodicamente. Em caso de mudanças relevantes, informaremos no app
                    e a continuidade de uso após a atualização implica aceite da nova versão.
                </Section>

                <Section title="8. Contato">
                    Para dúvidas contratuais ou suporte, utilize os canais oficiais disponibilizados no aplicativo.
                </Section>
            </ScrollView>
        </>
    );
}
