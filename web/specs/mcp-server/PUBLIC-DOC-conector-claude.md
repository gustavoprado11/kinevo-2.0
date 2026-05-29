# Conecte o Kinevo ao Claude e a outros assistentes de IA

> Texto-fonte do artigo de ajuda público (a publicar em help center / blog). URL público é exigido na submissão ao Connectors Directory.

O conector do Kinevo permite que você opere sua conta a partir de um assistente de IA — como o **Claude** (Anthropic) ou o **ChatGPT** (OpenAI) — usando linguagem natural. Em vez de navegar pelo painel, você conversa: "quais alunos não treinaram essa semana?", "cria um programa de hipertrofia de 8 semanas para a Maria", "qual a progressão de carga do João no agachamento?".

Tudo o que o assistente acessa é **restrito à sua conta de treinador** e exige uma assinatura Kinevo ativa.

---

## Pré-requisitos

- Conta Kinevo de treinador com **assinatura ativa** (ou em período de teste).
- Um cliente que suporte conectores MCP (Claude.ai, Claude Desktop, ChatGPT, etc.).

---

## Como conectar no Claude (OAuth — recomendado)

1. No Claude, vá em **Configurações → Conectores → Adicionar conector personalizado**.
2. Em **URL do servidor**, informe:
   ```
   https://www.kinevoapp.com/api/mcp
   ```
3. O Claude abrirá a tela de autorização do Kinevo. **Faça login** com seu e-mail e senha de treinador.
4. Revise o que será autorizado e confirme. Pronto — o conector aparece como conectado.

> O acesso usa OAuth 2.1 com PKCE. Nenhuma senha é compartilhada com o Claude; ele recebe apenas um token de acesso temporário que você pode revogar quando quiser.

## Como conectar via API Key (alternativa)

1. No Kinevo, vá em **Configurações → API Keys** e clique em **Gerar nova key**.
2. Copie a key (`kinevo_trainer_…`). **Ela é exibida uma única vez.**
3. No seu cliente, configure o cabeçalho de autorização do conector:
   ```
   Authorization: Bearer kinevo_trainer_xxxxxxxx-...
   ```

---

## O que você pode fazer

| Área | Exemplos |
|---|---|
| **Alunos** | listar, ver perfil completo (incl. restrições clínicas), cadastrar, atualizar |
| **Programas** | listar, ver detalhes, criar, atribuir a um aluno, expirar |
| **Prescrição** | montar sessões agendadas por dia da semana, adicionar exercícios, métodos avançados (pirâmide, drop-set, cluster, 5x5), supersets |
| **Progresso** | histórico de treinos, aderência, progressão de carga (com 1RM estimado), respostas de formulários |
| **Comunicação** | listar conversas, ler e enviar mensagens para alunos |
| **Financeiro** | assinaturas/contratos dos alunos, resumo de receita (MRR) |

---

## Prompts de exemplo

- **Triagem:** "Quais alunos não treinaram nos últimos 7 dias?"
- **Visão geral:** "Me dá um resumo do meu mês: alunos ativos, programas e receita."
- **Prescrição:** "Cria um programa de hipertrofia de 8 semanas para a Maria, treinos A/B/C, e agenda para segunda, quarta e sexta."
- **Edição:** "No programa do João, troca o agachamento livre por hack squat e muda para 4x6-8."
- **Progresso:** "Qual a progressão de carga do Carlos no supino nos últimos 3 meses?"
- **Aderência:** "Como está a aderência da Ana nesse programa?"
- **Comunicação:** "Manda uma mensagem motivacional pro Pedro."

---

## Privacidade e segurança

- O conector acessa **apenas os dados da sua conta**. Ele não acessa dados de outros treinadores.
- Ao usar o conector, os dados retornados são enviados ao provedor do assistente (ex.: Anthropic) para gerar as respostas, conforme a política de privacidade dele. Como podem incluir dados de saúde dos alunos, conecte apenas assistentes em que você confia.
- Credenciais (API keys e tokens OAuth) são armazenadas apenas de forma cifrada. Você pode **revogar** qualquer acesso a qualquer momento em **Configurações → API Keys** (ou removendo o conector no cliente).
- Detalhes completos na [Política de Privacidade](https://www.kinevoapp.com/privacy).

---

## Solução de problemas

- **"Sua assinatura está inativa":** o conector exige assinatura ativa. Renove em **Configurações → Financeiro**.
- **Token expirado:** tokens de acesso expiram periodicamente e são renovados automaticamente; se necessário, reconecte.
- **Limite de requisições:** o conector limita o volume de chamadas por minuto/dia para proteger sua conta.
