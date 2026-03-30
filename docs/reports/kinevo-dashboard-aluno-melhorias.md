# Kinevo — Mapeamento de Melhorias: Dashboard do Aluno (Visão do Treinador)

**Autor:** Claude (Análise de Front-end & UX)
**Data:** 28 de Março de 2026
**Versão:** 1.0

---

## Sumário Executivo

Este documento mapeia **18 oportunidades de melhoria** para o dashboard do aluno na visão do treinador no sistema web Kinevo. A análise foi feita com base em:

- Screenshot atual do dashboard do aluno no Kinevo web
- Referência de design do app Future (coaching platform premium)
- Análise do código-fonte existente (Next.js 16 + React 19 + Tailwind + Supabase)
- Benchmarking com TrueCoach, Everfit, My PT Hub e outros líderes de mercado
- Auditorias anteriores já realizadas no sistema (score 71-74/100)

O objetivo central é transformar o dashboard do aluno em um **centro de comando para o treinador** — onde ele consiga realizar as principais ações e visualizar as principais informações sem precisar navegar para outras páginas.

---

## 1. Visão Geral das Melhorias

### Categorização por Impacto × Esforço

| # | Melhoria | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| 1 | Goal & Tags no Header | Alto | Baixo | P0 |
| 2 | Stat Pills compactas no header | Alto | Baixo | P0 |
| 3 | Mensagem rápida inline | Alto | Médio | P0 |
| 4 | AI Insights Card (ações sugeridas) | Alto | Médio | P0 |
| 5 | Feedback do aluno visível nas sessões | Alto | Baixo | P1 |
| 6 | Detalhes de exercícios expandíveis | Médio | Baixo | P1 |
| 7 | Métricas corporais com histórico visual | Médio | Médio | P1 |
| 8 | Ação sugerida por IA no chat | Alto | Médio | P1 |
| 9 | Cards da sidebar sem borda (visual limpo) | Médio | Baixo | P1 |
| 10 | Alerta contextual na fila de programas | Médio | Baixo | P1 |
| 11 | Calendário semanal com PSE visual | Médio | Baixo | P2 |
| 12 | Gráfico de progressão de carga | Alto | Médio | P2 |
| 13 | Timeline de programa com sparkline | Médio | Médio | P2 |
| 14 | Atalhos de teclado para ações rápidas | Médio | Médio | P2 |
| 15 | Empty states contextuais e orientadores | Médio | Baixo | P2 |
| 16 | Notificações e alertas de inatividade | Alto | Médio | P3 |
| 17 | Comparativo entre programas (relatório) | Médio | Alto | P3 |
| 18 | Modo de visualização condensada (multi-aluno) | Médio | Alto | P3 |

---

## 2. Detalhamento das Melhorias

### MELHORIA 1 — Goal & Tags visíveis no Header do Aluno

**Problema atual:** O header do aluno exibe apenas nome, status, email e data de início. O objetivo do aluno e suas características (nível, frequência) não estão visíveis de imediato.

**Inspiração Future:** O Future exibe o objetivo ("Getting back into fitness after baby") e tags contextuais ("New Mom", "Maisie · 4 Months") diretamente abaixo do nome do aluno. Isso dá ao coach contexto instantâneo.

**Proposta:**
- Adicionar campo `goal` (objetivo) no perfil do aluno (já existe `trainer_notes`, mas o goal deve ser separado e visível)
- Exibir tags como pills abaixo do nome: nível de experiência, frequência semanal, restrições, etc.
- Usar um pill com ícone de alvo (Target) para o objetivo principal

**Dados necessários:**
- Novo campo `goal` na tabela `students` (ou usar campo existente se houver)
- Array de tags configuráveis pelo treinador

**Implementação sugerida:**
```tsx
<div className="flex items-center gap-2 mt-2">
  <div className="flex items-center gap-1.5 bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full text-xs font-medium">
    <Target className="h-3 w-3" />
    {student.goal}
  </div>
  {student.tags.map(tag => (
    <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full text-xs">{tag}</span>
  ))}
</div>
```

---

### MELHORIA 2 — Stat Pills compactas no Header

**Problema atual:** As métricas rápidas (5/4 esta semana, 4 treinos seguidos, PSE média, +6% carga) existem mas estão separadas do header, ocupando espaço visual. A informação é boa, mas a apresentação pode ser mais scannável.

**Proposta:**
- Mover as stat pills para dentro do header, abaixo das info do aluno, como uma barra horizontal
- Usar design de pills coloridas com ícones contextuais
- Cada pill: ícone + label + valor + badge opcional (ex: "Meta atingida!")

**Vantagem:** O treinador consegue absorver o estado do aluno em um único glance sem scroll.

---

### MELHORIA 3 — Mensagem Rápida Inline (Inspiração Core do Future)

**Problema atual:** A funcionalidade de mensagens existe no Kinevo, mas está em uma página separada (`/messages`). O treinador precisa navegar para fora do dashboard do aluno para se comunicar.

**Inspiração Future:** O Future coloca a conversa recente e um campo de envio de mensagem **diretamente no perfil do aluno**. O coach vê a última mensagem do aluno e pode responder sem sair da tela.

**Proposta:**
- Adicionar card "Mensagem Rápida" no sidebar direito (acima das observações)
- Exibir últimas 2-3 mensagens trocadas em formato mini-chat
- Campo de texto + botão enviar para resposta rápida
- Link "Ver conversa completa" para ir à página de mensagens
- Preview da mensagem com timestamp

**Dados necessários:**
- Últimas mensagens do thread aluno-treinador (já disponível via tabela de mensagens)
- Endpoint para envio rápido de mensagem

**Impacto:** Esta é a melhoria de maior impacto. Treinadores que usam Future dizem que a comunicação inline é o recurso #1 que os mantém na plataforma. Reduz a fricção de comunicação de ~4 cliques para 0.

---

### MELHORIA 4 — AI Insights Card (Ações Sugeridas pelo Motor de IA)

**Problema atual:** O Kinevo já tem um motor de IA (OpenAI + Claude) e a tabela `assistant_insights`, mas os insights não aparecem no dashboard do aluno de forma proativa.

**Inspiração Future:** O Future mostra "Suggested Action" contextual — ex: "Shorten workouts this week to 20 minutes" baseado na mensagem do aluno.

**Proposta:**
- Card de insights no topo da coluna principal (antes do programa ativo)
- 3 tipos de insight:
  - **Positivo** (verde): progressão de carga, adesão alta, streak
  - **Alerta** (amarelo): PSE alta, risco de overtraining, inatividade
  - **Ação** (violeta): preparar próximo programa, fazer avaliação, etc.
- Cada insight é clicável e leva à ação correspondente
- IA gera insights automaticamente com base nos dados do aluno

**Dados necessários:**
- Consulta à tabela `assistant_insights` filtrada pelo aluno
- Ou geração on-demand com base nas métricas (carga, PSE, adesão, programa)

---

### MELHORIA 5 — Feedback do Aluno visível nas Sessões

**Problema atual:** O aluno pode deixar feedback ao final do treino (ex: "Treinei rápido"), mas esse feedback fica enterrado no detalhe da sessão. O treinador precisa expandir cada sessão para ver.

**Proposta:**
- Exibir feedback do aluno como um badge ou balão inline na lista de sessões recentes
- Usar ícone de mensagem (💬) ao lado do nome do treino quando há feedback
- Na expansão da sessão, mostrar o feedback em destaque (caixa azul claro)

**Implementação:**
```tsx
{session.feedback && (
  <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
    <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
    <span className="text-xs text-blue-700">"{session.feedback}"</span>
  </div>
)}
```

---

### MELHORIA 6 — Detalhes de Exercícios Expandíveis nas Sessões

**Problema atual:** A sessão recente mostra nome do treino, PSE e variação de carga, mas para ver os exercícios individuais, é necessário abrir um sheet separado.

**Proposta:**
- Ao expandir uma sessão na lista, mostrar tabela resumida dos exercícios
- Colunas: Exercício | Séries×Reps | Carga | Δ Carga
- Variação de carga com cor (verde = aumento, vermelho = diminuição)
- Manter o sheet para detalhes completos, mas o resumo inline reduz o número de cliques

---

### MELHORIA 7 — Métricas Corporais com Histórico Visual

**Problema atual:** O card de avaliações mostra peso e % gordura, mas apenas o valor mais recente. Não há visualização de tendência.

**Proposta:**
- Adicionar mini sparkline abaixo de cada métrica mostrando evolução nos últimos 3-6 meses
- Exibir delta (Δ) em relação à medição anterior
- Exemplo: "78.5kg ↓1.2kg desde jan"

**Dados necessários:**
- Histórico de `form_submissions` com tipo assessment/body metrics
- Parsing dos valores JSON de respostas

---

### MELHORIA 8 — Ação Sugerida por IA no Chat

**Problema atual:** Não existe sugestão automática de mensagem.

**Inspiração Future:** O Future sugere ações como "Shorten workouts this week to 20 minutes" baseado no contexto da conversa e dos dados do aluno.

**Proposta:**
- Abaixo do campo de mensagem rápida, exibir um card rosa/lilás com sugestão de mensagem
- A sugestão é gerada pela IA com base em:
  - Dados do treino (meta batida → parabenizar; inativo → motivar)
  - Última mensagem do aluno (contexto conversacional)
  - Eventos do programa (início, fim de semana, conclusão)
- Botão "Usar" que preenche o campo de texto com a sugestão
- Botão "Ignorar" que descarta

---

### MELHORIA 9 — Cards sem Borda (Design Limpo)

**Problema atual:** Os cards da sidebar usam bordas visíveis, criando visual "boxy" e pesado.

**Proposta:**
- Remover `border` dos cards e usar apenas `shadow-sm` com `bg-white`
- Alinha com o design Apple HIG que o Kinevo já segue
- Background da página `#F5F5F7` (já em uso) cria separação natural

---

### MELHORIA 10 — Alertas Contextuais na Fila de Programas

**Problema atual:** A fila de programas já tem mensagens contextuais, mas são genéricas e fáceis de ignorar.

**Proposta:**
- Tornar o alerta mais visual com cores e urgência:
  - **75%+ concluído:** Borda laranja, ícone de relógio, "Prepare o próximo ciclo!"
  - **Programa expirado:** Borda vermelha, ícone de alerta, "Programa expirado — ação necessária"
  - **Sem programa:** Borda tracejada cinza, "Configure o primeiro programa"
- Adicionar botão de ação direto no alerta (não só na área inferior)

---

### MELHORIA 11 — Calendário Semanal com PSE Visual

**Problema atual:** O calendário semanal mostra dias com check (✓) para treinos completados, mas não diferencia a intensidade.

**Proposta:**
- Usar cores no círculo do dia baseadas no PSE:
  - PSE 1-6: verde claro
  - PSE 7-8: verde/emerald
  - PSE 9+: violeta/roxo (alta intensidade)
  - Dia de descanso: cinza
- Exibir o valor do PSE dentro do círculo (como já parcialmente implementado)
- Tooltip ao hover com nome do treino e duração

---

### MELHORIA 12 — Gráfico de Progressão de Carga

**Problema atual:** A progressão de carga é mostrada apenas como percentual na stat bar (+6%). Não há visualização temporal.

**Proposta:**
- Adicionar mini line chart (sparkline) mostrando tonelagem total por sessão nas últimas 4-8 semanas
- Usar a biblioteca Recharts (já disponível em projetos React)
- Exibir no card do programa ativo, abaixo das stats
- Hover mostra dados da sessão

**Dados necessários:**
- `session_tonnage` já calculado no server component (tonnage map exists)

---

### MELHORIA 13 — Timeline de Programa com Sparkline de Adesão

**Problema atual:** O gráfico de adesão semanal existe (`weeklyAdherence`) mas é básico.

**Proposta:**
- Sparkline de barras dentro da barra de progresso do programa
- Cada barra = 1 semana, altura = % de adesão
- Cor: verde se ≥100%, amarelo se 75-99%, vermelho se <75%
- Integrado visualmente à progress bar existente

---

### MELHORIA 14 — Atalhos de Teclado para Ações Rápidas

**Problema atual:** Todas as ações requerem clique.

**Proposta:**
- `M` → Abrir campo de mensagem rápida
- `E` → Editar aluno
- `N` → Nova prescrição / programa
- `R` → Ver relatório
- `F` → Enviar formulário
- Exibir hint de atalho em tooltips dos botões

---

### MELHORIA 15 — Empty States Contextuais e Orientadores

**Problema atual:** Identificado na auditoria — empty states são genéricos ou inexistentes.

**Proposta:**
- Cada seção sem dados deve ter:
  - Ilustração ou ícone contextual
  - Mensagem explicativa
  - CTA primário para a ação mais provável
- Exemplos:
  - Sem programa: "Crie o primeiro programa para {nome}" + botão Criar
  - Sem avaliações: "Envie uma anamnese para conhecer melhor {nome}" + botão Enviar
  - Sem mensagens: "Inicie a conversa com {nome}" + botão Mensagem

---

### MELHORIA 16 — Notificações e Alertas de Inatividade Melhorados

**Problema atual:** Existe o alerta de inatividade, mas é sutil.

**Proposta:**
- Banner de inatividade no topo do dashboard (abaixo do header) quando:
  - Aluno não treina há 3+ dias (amarelo)
  - Aluno não treina há 7+ dias (vermelho)
  - Programa expirou sem renovação (vermelho)
  - Pagamento atrasado (vermelho)
- Banner com ação direta: "Enviar mensagem de motivação" / "Renovar programa"
- Dismissable pelo treinador

---

### MELHORIA 17 — Comparativo Entre Programas

**Problema atual:** O histórico de programas mostra dados individuais, mas não há comparação.

**Proposta:**
- Tabela/gráfico comparativo acessível pelo botão "Relatório"
- Métricas: adesão, volume total, PSE média, duração média por sessão
- Visualização lado-a-lado ou em gráfico de barras agrupadas
- Útil para o treinador avaliar qual tipo de programa funciona melhor para o aluno

---

### MELHORIA 18 — Modo Condensado (Dashboard Multi-Aluno)

**Problema atual:** O dashboard é voltado para 1 aluno por vez. Treinadores com muitos alunos precisam alternar constantemente.

**Proposta:**
- Visão condensada acessível pela lista de alunos
- Cards compactos mostrando: nome, stat pills, último treino, alerta (se houver)
- Ações rápidas inline (mensagem, ver perfil)
- Útil para revisão matinal de todos os alunos

---

## 3. Arquitetura de Dados Necessária

### Novos campos sugeridos

| Tabela | Campo | Tipo | Descrição |
|--------|-------|------|-----------|
| `students` | `goal` | `text` | Objetivo principal do aluno |
| `students` | `tags` | `text[]` | Tags configuráveis (nível, restrições, etc.) |
| `students` | `preferred_frequency` | `int` | Frequência semanal preferida |

### Consultas otimizadas

O server component atual (`page.tsx`) já faz 3 batches paralelos de queries. As melhorias propostas adicionam:

- Últimas 3 mensagens do thread (batch 3)
- Insights do motor de IA para o aluno (batch 3)
- Histórico de métricas corporais - últimas 6 medições (batch 3)

Todas podem ser adicionadas ao `Promise.all` existente no batch 3 sem impacto de performance.

---

## 4. Prioridades de Implementação

### Sprint 1 (1-2 semanas) — Quick Wins
- [ ] Melhoria 1: Goal & Tags no header
- [ ] Melhoria 2: Stat pills compactas
- [ ] Melhoria 5: Feedback do aluno nas sessões
- [ ] Melhoria 9: Cards sem borda
- [ ] Melhoria 11: Calendário com PSE visual
- [ ] Melhoria 15: Empty states

### Sprint 2 (2-3 semanas) — Core Features
- [ ] Melhoria 3: Mensagem rápida inline
- [ ] Melhoria 4: AI Insights card
- [ ] Melhoria 6: Exercícios expandíveis
- [ ] Melhoria 10: Alertas contextuais na fila

### Sprint 3 (3-4 semanas) — Diferenciação
- [ ] Melhoria 7: Métricas com histórico
- [ ] Melhoria 8: Sugestão de IA no chat
- [ ] Melhoria 12: Gráfico de progressão
- [ ] Melhoria 13: Sparkline de adesão
- [ ] Melhoria 14: Atalhos de teclado

### Sprint 4 (4-5 semanas) — Avançado
- [ ] Melhoria 16: Alertas de inatividade
- [ ] Melhoria 17: Comparativo entre programas
- [ ] Melhoria 18: Modo condensado multi-aluno

---

## 5. Benchmarking: O que nos Diferencia

| Feature | Future | TrueCoach | Everfit | Kinevo (atual) | Kinevo (proposto) |
|---------|--------|-----------|---------|----------------|-------------------|
| Chat inline no perfil | ✅ | ❌ | ❌ | ❌ | ✅ |
| AI suggestions | ✅ | ❌ | ❌ | Parcial | ✅ |
| Goal visível | ✅ | ❌ | ✅ | ❌ | ✅ |
| Exercícios expandíveis | ✅ | ✅ | ✅ | Parcial | ✅ |
| PSE visual no calendário | ❌ | ❌ | ❌ | Parcial | ✅ |
| Progressão de carga gráfica | ❌ | ✅ | ❌ | ❌ | ✅ |
| Atalhos de teclado | ❌ | ❌ | ❌ | ❌ | ✅ |
| Sugestão de mensagem IA | ✅ | ❌ | ❌ | ❌ | ✅ |
| Alertas contextuais | ❌ | ✅ | ❌ | Parcial | ✅ |
| Empty states | ❌ | ✅ | ❌ | ❌ | ✅ |

**Diferencial competitivo do Kinevo proposto:** A combinação de IA proativa + chat inline + PSE visual + atalhos de teclado criaria uma experiência única no mercado brasileiro de software para treinadores.

---

## 6. Protótipo Interativo

Um protótipo funcional em React foi criado demonstrando as principais melhorias propostas. O arquivo está disponível como `kinevo-student-dashboard-prototype.html` e pode ser aberto diretamente no navegador.

O protótipo demonstra:
- Header redesenhado com goal, tags e stat pills
- Card de AI Insights com 3 tipos de alerta
- Programa ativo com stats em grid 4 colunas
- Calendário semanal com PSE visual (cores por intensidade)
- Sessões recentes com expansão e tabela de exercícios
- Sidebar: mensagem rápida com preview de conversa + sugestão IA
- Sidebar: observações, fila de programas, avaliações com métricas, financeiro
- Design limpo (sem bordas, shadow-sm, fundo #F5F5F7)
