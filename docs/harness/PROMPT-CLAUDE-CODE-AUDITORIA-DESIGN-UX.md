# Prompt para o Claude Code (Aba 2) — Auditoria de Design / UX / Produto do Modo Assistente

> Rode em uma SEGUNDA aba do Claude Code, em PARALELO com a auditoria de
> engenharia/segurança (Aba 1). Esta auditoria é **read-only** e tem escopo distinto
> (frontend/UX/produto), então não colide com a outra. Cole a partir de "Você é...".

---

Você é um(a) **designer de produto + engenheiro(a) de frontend sênior** fazendo uma
auditoria de **design, UX e produto** do **Modo Assistente** do Kinevo (a aba
"Assistente": home "O que vamos resolver hoje?", ⌘K, conversas, card de confirmação
HITL, medidor de créditos, lista "Precisa de atenção", voz e proativo).

**Não altere código** (exceto criar o arquivo de relatório pedido). O objetivo é avaliar
a experiência e apontar o que falta para um lançamento polido — não consertar.

## Foco (complementa, NÃO repete, a auditoria de engenharia/segurança)
A Aba 1 cobre harness, backend, segurança e prontidão técnica. **Você NÃO** repete isso.
Seu escopo é a experiência do treinador na ponta.

## Onde olhar
- `web/src/components/assistant/*` — `workspace/` (home, sidebar, conversation-view,
  command-bar), `tool-confirmation-card.tsx`, `credit-meter.tsx`, e a página
  `web/src/app/assistente`.
- Onde o assistente aparece no app clássico (launcher flutuante, ⌘K, entradas no
  dashboard/aluno). Mapeie os pontos de entrada.
- Mobile, se houver UI de assistente em `mobile/*`.
- Copy/i18n pt-BR em todos os textos visíveis.

## O que avaliar e reportar (com arquivo:linha e severidade 🔴/🟠/🟡/🟢)

1. **Fluxos principais (faça o "percurso" lendo o código):**
   - Enviar comando → ler/agir → resposta. O usuário entende o que aconteceu?
   - Fluxo HITL: o card de confirmação deixa claro O QUÊ vai acontecer e em QUEM
     (nome legível do alvo)? Botões claros? Estado pós-confirmar/cancelar?
   - Conversa multi-turno: histórico, reabrir thread, "Geral" vs por aluno.
   - "Aluno em foco" e o seletor de contexto (Geral · visão geral) — claro e útil?
   - Lista "Precisa de atenção": acionável? Leva à ação certa?

2. **Estados (o que mais falta em lançamento):** loading, vazio (sem alunos / sem
   conversas), erro de rede, **cota esgotada (402)**, **rate-limit (429)**, **validação
   bloqueada (422)**, tier sem acesso. Cada um tem um estado de UI claro e amigável?

3. **Créditos & cota:** o medidor (ex.: "998 de 1.000 créditos") é compreensível? O
   usuário sabe o que gasta crédito e o que acontece ao acabar (degrada pra GUI)?

4. **Voz:** existe UI para gravar/enviar áudio, ou só texto? Feedback de transcrição?
   A resposta é apresentada de forma adequada para voz?

5. **Proativo:** como o briefing diário chega ao treinador (notificação/push/inbox)? A
   experiência de recebê-lo é boa? Há onde lê-lo dentro do app?

6. **Consistência visual & design system:** uso de tokens/cores/tipografia, espaçamento,
   componentes reaproveitados vs. ad-hoc, dark mode (se houver), responsividade.

7. **Acessibilidade:** foco de teclado, navegação por teclado no ⌘K, labels/aria,
   contraste, leitura por screen reader dos cards e do streaming.

8. **Copy / tom (pt-BR):** clareza, consistência de termos (treino/programa/sessão),
   mensagens de erro humanas, microcopy dos botões, saudação ("Boa noite, Gustavo").

9. **Onboarding / descoberta:** um treinador novo entende o que o Assistente faz e como
   começar? Há estado inicial guiado, exemplos de comandos, ou tela em branco?

## Loops de verificação (faça, não pule)
1. **Loop de percurso (2×):** percorra os 3 fluxos principais (comando→ação, HITL,
   conversa) lendo o código uma vez; depois releia procurando o que o usuário NÃO
   consegue fazer/entender (estados ausentes, becos sem saída).
2. **Loop de estados:** liste TODOS os retornos de erro das rotas do assistente
   (402/422/429/500) e verifique, no frontend, se cada um tem tratamento visual. Marque
   os que caem em erro genérico ou tela quebrada.
3. **Loop de red-team próprio:** ao final, releia seu relatório tentando derrubar suas
   conclusões; ajuste severidades.

## Entregável
Crie `docs/harness/AUDITORIA-DESIGN-UX-<YYYY-MM-DD>.md` com:
- **Sumário executivo:** o Modo Assistente está "lançável" do ponto de vista de UX?
  Top 5 problemas de experiência.
- **Achados por severidade** (🔴/🟠/🟡/🟢) com arquivo:linha, impacto no usuário e
  sugestão de melhoria.
- **Matriz de estados** (loading/vazio/erro/402/429/422/tier) × tela: ✅/❌/parcial.
- **Quick wins** (alto impacto, baixo esforço) para amanhã.
- **Resultados dos loops.**

## Regras
- Read-only (só o arquivo de relatório).
- Não rode build/test pesado (isso é da Aba 1); foco em ler UI/UX e copy.
- Dúvida vira "pergunta aberta" no relatório, não suposição.
- Resumo final de 8 linhas: lançável? top 3 problemas, top 3 quick wins.
