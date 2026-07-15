# Auditoria de telas — Web (prod) — 13/jul/2026

> **STATUS (15/jul/2026): ENCERRADA.** P1.1–P1.3 corrigidos (`3d13d80`, `5e27f6f`, `b3c7487`) e P2.4/6/7/8/9 corrigidos (`ba59dd6`, `48d0818`) — tudo em prod, smoke verificado. P2.5 (avatar) era falso positivo: a foto existe e responde 200; a causa era o PNG de 1,3 MB — mitigado com compressão de avatar no upload (cliente, ≤512px WebP). P2.10 é comportamento correto (tooltip já explica cortesias). Cosméticos não atacados por decisão de escopo.

Auditoria visual e funcional de todas as telas do sistema web em produção (www.kinevoapp.com), navegando logado como Gustavo, em modo somente leitura (nenhum dado criado/alterado/enviado). Viewport 1460×812, tema claro. Console e rede verificados em cada bloco — **zero erros de console em todas as telas**.

## Veredito geral

O sistema está sólido: todas as 12 superfícies auditadas carregam, navegam e renderizam sem erro de console, e o design é consistente (cards brancos, violeta como cor de ação, tipografia uniforme) — com **uma exceção grande (Consultoria IA em dark forçado)** e alguns achados pontuais de dados/copy.

## Achados por severidade

### P1 — Inconsistências reais

1. **/consultoria força tema escuro na aplicação inteira** (sidebar inclusive), enquanto o resto do app está claro. Ao sair da página, o claro volta. Se for intencional (página "premium"), a sidebar não deveria escurecer junto; se não for, é provável classe `dark` vazando no root (ver gotcha do `@custom-variant` de 13/jul).
2. **Configurações: seções 04 e 05 se contradizem.** "Plano e Cobrança" mostra **Kinevo PRO — R$ 39,90/mês**, mas na grade de planos o "PLANO ATUAL" é **Premium IA (R$ 129,90)** e o PRO IA custa R$ 79,90 (R$ 39,90 é o Essencial). Provável naming legado da assinatura Stripe vs. tiers novos de IA — confunde o que o treinador de fato paga.
3. **Saudação do Dashboard calculada em UTC no primeiro load (SSR):** às 21h35 (BRT) a primeira carga exibiu **"Bom dia, Gustavo"**; na visita seguinte (client-side) corrigiu para "Boa noite". 21h35 BRT = 00h35 UTC → "bom dia". Usar o fuso do treinador (migr 249 já existe para o Assistente).

### P2 — Menores

4. **Alunos: contador vs. linhas.** Header e filtro dizem "2", mas a tabela lista 3 linhas (a conta própria "Eu" não entra na contagem). Coerente, mas visualmente estranho ("Todos 2" com 3 linhas).
5. **Alunos: avatar do Gustavo vazio** na lista (círculo sem iniciais/foto), enquanto os demais têm inicial.
6. **Perfil do aluno: copy "Faltam 0 semanas!"** no card Próximos Programas (última semana do ciclo). Melhor "Última semana!" ou "Termina em X dias".
7. **Formulários: resposta sem nome de template.** Na lista "Todas as Respostas", a última linha (Gustavo, há 4 meses) não mostra o nome do formulário — provável template apagado; exibir "(formulário removido)".
8. **Sidebar sem estado ativo nas Bibliotecas:** ao entrar em /programs ou /exercises o submenu "Bibliotecas" recolhe e nenhum item fica marcado como ativo.
9. **Notificação vs. perfil: "último treino" divergente.** Resumo de 12/07 diz "Marina treinou há 2 dias"; treino foi 09/07 (3 dias antes do resumo; perfil diz "há 4 dias" em 13/07). Checar base de cálculo/fuso do resumo diário.
10. **Dashboard/Financeiro: "Receita do mês R$ 5,00" com "Alunos pagantes 0"** — coerente com pagamento avulso de teste, mas a combinação pode confundir; conferir a definição de "alunos pagantes".

### Cosmético / observações

- Ranking de alunos no Dashboard com pódio 1º/2º ambos 0% de adesão — correto pelos dados, apenas curioso com poucos alunos.
- Marketing → Landing: a coluna de preview (iframe do celular) não acompanha o scroll do formulário; sobra área vazia à direita.
- Card "Integração com IA" (Configurações §01) tem grande área vazia entre o texto e o CTA "Abrir IA & API keys".
- Feed "Assistente Kinevo" do Dashboard captura o scroll da página quando o mouse está sobre ele (scroll-trap); a página só rola fora do card.

## O que foi verificado e está OK

| Tela | Status |
|---|---|
| Dashboard (KPIs, feed Assistente, Programas encerrando, Treinos de hoje, Metas, Ranking, Personalizar) | OK |
| Alunos (lista, filtros, busca) | OK |
| Perfil do aluno (header, insight, programa, adesão, calendário, sessões, progressão de carga, comparativo de volume, saúde/anamnese, financeiro, histórico) | OK |
| Consultoria IA (empty state, campo CREF) | OK funcional; dark forçado (P1.1) |
| Marketing (Visão geral, Leads, Landing editor + preview) | OK |
| Agenda (semana, linha do "agora", navegação) | OK |
| Formulários (templates, respostas, feedback aguardando) e Avaliações (templates, empty state) | OK |
| Financeiro (saldo, KPIs, atividade recente, atalhos Planos/Assinaturas/PIX/Config) | OK |
| Assistente IA (dock lateral, página /assistente, sugestões, créditos 945/1000, conversas) | OK |
| Bibliotecas: Programas (2) e Exercícios (572, filtros, grid) | OK |
| Configurações (perfil, marca+preview, aparência, relatórios, assinatura, planos IA) | OK visual; P1.2 |
| Sala de Treino (empty state), Mensagens (lista+thread), busca global ⌘K, notificações | OK |

## Método

Chrome dirigido via extensão (claude-in-chrome), 1 tela por vez, screenshot + scroll integral + leitura de console (onlyErrors) por bloco. Nenhuma ação mutante: nada enviado, salvo, publicado ou clicado em CTA de escrita.
