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

export default function PrivacyPolicyScreen() {
    return (
        <>
            <Stack.Screen options={{ title: "Privacidade" }} />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <Text style={{ color: "#f8fafc", fontSize: 26, fontWeight: "800", marginBottom: 6 }}>
                    Política de Privacidade
                </Text>
                <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 22 }}>
                    Última atualização: 10/02/2026
                </Text>

                <Section title="1. Quais dados coletamos">
                    Coletamos dados de conta (nome, e-mail e identificadores de autenticação), informações de perfil
                    e dados de treino (sessões, exercícios, carga, repetições, duração e feedback).
                </Section>

                <Section title="2. Como usamos seus dados">
                    Usamos os dados para permitir o funcionamento do app, exibir histórico, gerar métricas de evolução,
                    oferecer suporte e melhorar a estabilidade e a experiência do produto.
                </Section>

                <Section title="3. Compartilhamento de informações">
                    Não vendemos dados pessoais. Os dados podem ser compartilhados apenas com provedores essenciais de
                    infraestrutura, autenticação e pagamento, quando necessário para operar o serviço.
                </Section>

                <Section title="4. Armazenamento e segurança">
                    Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso indevido, perda ou
                    alteração. Ainda assim, nenhum sistema é 100% infalível.
                </Section>

                <Section title="5. Seus direitos">
                    Você pode solicitar acesso, correção ou exclusão dos seus dados, conforme a legislação aplicável.
                    Também pode encerrar sua conta diretamente no app, quando disponível.
                </Section>

                <Section title="6. Retenção">
                    Mantemos os dados pelo tempo necessário para cumprir finalidades legítimas, obrigações legais e
                    prevenção de fraude. Após esse período, os dados podem ser anonimizados ou excluídos.
                </Section>

                <Section title="7. Contato">
                    Para dúvidas sobre privacidade ou solicitações de titulares, entre em contato pelo canal de suporte
                    disponível no app.
                </Section>
            </ScrollView>
        </>
    );
}
