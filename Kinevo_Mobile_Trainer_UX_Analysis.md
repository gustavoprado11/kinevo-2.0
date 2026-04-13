# Kinevo Mobile - Análise de UX do Perfil Treinador

**Data:** 7 de Abril de 2026
**Objetivo:** Tornar a experiência mobile do treinador tão boa — ou melhor — que a versão web, posicionando o Kinevo como o melhor aplicativo de prescrição de treinos do mundo.

---

## 1. Visão Geral da Análise

Esta análise foi construída a partir de três frentes: exploração completa do codebase (monorepo com Expo + Next.js), pesquisa de mercado com os principais concorrentes globais (TrueCoach, Trainerize, TrainHeroic, Hevy Coach, Everfit) e regionais (MFIT, TreinoAI, PersonalGO), e revisão de tendências de UX em apps de fitness para 2025-2026.

O Kinevo já tem uma base técnica sólida: monorepo com tipos compartilhados, Expo Router com navegação por role, Zustand com persistência MMKV, integração com Apple Watch, e prescrição por IA com Claude. O desafio está em fechar os gaps entre web e mobile e refinar a experiência para que o treinador consiga operar com autonomia total pelo celular.

---

## 2. Mapeamento de Gaps: Web vs Mobile

### 2.1 Gaps Críticos (Bloqueiam Autonomia Mobile)

**Program Builder — Inexistente no Mobile**
A web tem um builder completo com drag-and-drop (dnd-kit), painel de exercícios, preview em frame de celular, comparação de programas, resumo de volume e configuração de form triggers. No mobile, o treinador só consegue atribuir templates existentes via AssignProgramWizard. Se ele precisa criar ou editar um programa, precisa abrir o notebook. Isso é o maior limitador de autonomia.

**Form Builder — Somente Web**
O builder de formulários da web tem geração assistida por IA, reordenação drag-and-drop, configuração de tipos de pergunta, auditoria de qualidade com IA e preview. No mobile, o treinador só vê templates prontos e atribui para alunos. A tela de Forms exibe literalmente: "Crie templates de formulário pelo site para usá-los aqui". Isso quebra o fluxo de trabalho do treinador em campo.

### 2.2 Gaps Altos (Limitam Produtividade)

**Biblioteca de Exercícios — Somente Leitura no Mobile**
A web permite criar exercícios customizados, gerenciar grupos musculares, fazer upload de vídeos, busca avançada com filtros. No mobile, o treinador só navega e visualiza. Não pode adicionar exercícios próprios nem subir vídeos — funcionalidades essenciais para treinadores que criam exercícios proprietários.

**Gestão Financeira — Dashboard Passivo**
A web tem integração completa com Stripe Connect, gerenciamento de planos, assinaturas, contratos e onboarding financeiro. No mobile, existe apenas visualização de KPIs (receita mensal, alunos pagantes) e lista de transações. Nenhuma ação de configuração é possível.

### 2.3 Gaps Moderados (Reduzem Percepção de Valor)

**Analytics e Progresso**
A web exibe gráficos SVG de progressão de carga, tendência de métricas corporais, aderência semanal e insights gerados por IA. No mobile, existem apenas KPIs numéricos (sessões da semana, aderência %), heatmap de sessões e lista de sessões recentes. Não há nenhum gráfico de tendência.

**Detalhe do Aluno**
A web tem sidebar rica com status financeiro, dados de avaliação, card de mensagem rápida, insights IA, métricas corporais, alertas contextuais e comparação de programas. O mobile tem três tabs (Visão Geral, Programas, Formulários) com dados básicos, mas sem a profundidade analítica da web.

**Notificações**
Existe configuração de preferências de push no mobile, mas não há tela de histórico de notificações nem centro de notificações navegável. As notificações chegam via push, mas não podem ser consultadas retroativamente.

### 2.4 Gaps Baixos (Paridade ou Complementares)

**Chat/Mensagens** — Praticamente em paridade. Mobile tem envio de texto e imagens, indicadores de leitura, paginação.

**Sala de Treino** — Bem equilibrada. Mobile tem gestos de drag-to-reorder, timer de sessão, haptic feedback. Web tem modal de vídeo. Funcionalmente equivalentes.

**Configurações** — Complementares. Web gerencia billing; mobile gerencia preferências de notificação e integração com Apple Health.

---

## 3. Problemas de Usabilidade Identificados

### 3.1 Loading States — Sem Skeleton Loaders

Todas as telas usam `ActivityIndicator` em tela cheia durante carregamento inicial. Não há skeleton placeholders. Isso cria percepção de lentidão e falta de polish.

**Telas afetadas:** Dashboard, Students, Forms, Student Detail, Chat.

**Padrão atual problemático:**
```tsx
if (isLoading) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#7c3aed" />
    </SafeAreaView>
  );
}
```

**Recomendação:** Implementar skeleton loaders específicos para cada tipo de card (StatCard, StudentCard, FormSubmissionCard) que reflitam o layout final do conteúdo.

### 3.2 Tratamento de Erros — Abrupto e Descontextualizado

Erros são tratados com `Alert.alert()` nativo, que interrompe o fluxo do usuário com um modal de sistema. Não existem toast notifications para feedback não-bloqueante. Erros de formulário não são exibidos inline nos campos.

**Exemplo problemático:**
```tsx
Alert.alert("Sem programa ativo", "Este aluno não tem um programa ativo.");
```

**Recomendação:** Implementar sistema de toast (react-native-toast-message ou similar) para erros não-críticos. Usar mensagens inline em formulários. Reservar Alert.alert apenas para ações destrutivas que precisam de confirmação.

### 3.3 Acessibilidade — Severamente Deficiente

Apenas 13 instâncias de `accessibilityLabel` em todo o projeto mobile. Componentes interativos (StudentCard, FormTemplateCard, StatCard, inputs de formulários) não possuem labels de acessibilidade. O app não é usável por leitores de tela.

**Recomendação:** Adicionar accessibilityLabel a todos os componentes interativos. Implementar accessibilityRole correto (button, link, tab). Testar com VoiceOver (iOS) e TalkBack (Android).

### 3.4 Offline — Inexistente

Zero padrões offline-first detectados. Sem integração NetInfo para detectar perda de conexão. Sem fila de sync para operações pendentes. Sem cache local de dados frequentes. Falha de rede resulta em telas em branco.

**Impacto real:** Treinador em academia com wifi instável não consegue consultar fichas dos alunos. A Sala de Treino, que depende de conexão real-time, falha silenciosamente.

**Recomendação:** Implementar cache local com MMKV para dados essenciais (lista de alunos, programas ativos, último treino). Adicionar banner de status de conexão. Criar fila de sync para operações (finalizar sessão, enviar feedback).

### 3.5 Suporte a Tablet — Configurado mas Não Implementado

`supportsTablet: true` no app.json, mas não existe nenhum layout responsivo. Todas as telas são single-column e se esticam em iPads, desperdiçando espaço.

**Recomendação:** Implementar layouts de duas colunas para iPad (lista + detalhe) nas telas de Students e Forms. Usar `useWindowDimensions()` para breakpoints.

### 3.6 Cores Hard-coded — Sem Sistema de Tema

Cores estão espalhadas como literais por todo o código (`#F2F2F7`, `#7c3aed`, `#1a1a2e`). Não existe um theme provider centralizado. O `userInterfaceStyle: "dark"` no app.json configura o chrome do sistema mas a UI usa cores claras.

**Recomendação:** Criar arquivo de tokens de design centralizado. Migrar todas as cores literais para referências ao tema. Preparar infraestrutura para dark mode real.

### 3.7 Gestos Limitados

O training room tem drag-to-reorder sofisticado com Reanimated, mas o restante do app não usa gestos avançados. Não há swipe-to-delete, swipe-to-reveal actions, ou gestos de atalho em nenhuma lista.

**Recomendação:** Adicionar swipe actions na lista de alunos (swipe → iniciar treino, ver perfil). Swipe em submissões de forms (swipe → marcar como revisado). Ações de deslizar em notificações.

---

## 4. Pesquisa de Mercado e Benchmarks

### 4.1 O Que os Concorrentes Fazem Bem

**TrueCoach** — Referência em workout builder mobile. Trainers podem criar treinos completos pelo celular com 3.500+ vídeos que auto-linkam conforme o treinador digita. Auto-save contínuo. Fraqueza: interface visualmente poluída.

**ABC Trainerize** — Mobile-first de verdade. Treinadores gerenciam 100% do negócio pelo smartphone: prescrição, nutrição, hábitos, booking, pagamentos. Apple Watch integrado. Update 2025: experiência de booking redesenhada com menos passos.

**Hevy Coach** — UI mais limpa que MyPTHub. Timers automáticos de descanso, tipos de séries (drop set, superset), biblioteca de exercícios intuitiva. Colaboração entre treinadores da mesma equipe.

**TrainHeroic** — Forte em coaching atlético. Dashboard informativo com feed de atividade e analytics por aluno. Builder flexível e direto.

### 4.2 Tendências 2025-2026

**IA Adaptativa:** Programas que se ajustam automaticamente baseado no desempenho do aluno. Detecção de platô e sugestão de progressão. O Kinevo já tem prescrição IA, mas pode expandir para ajustes automáticos mid-programa.

**Video Feedback em Tempo Real:** Correção de forma usando pose estimation no dispositivo (Edge AI). Apps como Tempo e Tonal já oferecem scoring de forma 0-100. Oportunidade para o Kinevo integrar no training room.

**Voz como Input:** Comandos de voz para operar o app hands-free durante sessões de treino. "Próximo exercício", "Registrar 80kg, 10 reps". Nenhum concorrente direto implementou isso ainda — oportunidade de diferenciação.

**Onboarding Conversacional:** Intake de novos alunos via conversa natural em vez de formulários longos. O Kinevo pode usar IA para conduzir anamnese por chat.

### 4.3 Dores Comuns de Treinadores

Os maiores problemas relatados por treinadores em plataformas de review são: apps lentos que travam e perdem dados; interfaces poluídas com muitas opções visíveis; inconsistência entre web e mobile; bibliotecas de exercícios desorganizadas e sem vídeos instrucionais; dificuldade em ver histórico completo de performance; ferramentas de comunicação fragmentadas; e processo de geração de programas que leva horas em vez de minutos.

---

## 5. Roadmap de Melhorias — Priorizado

### Fase 1: Quick Wins (1-2 sprints)

Estas melhorias não exigem nova arquitetura e geram impacto imediato na percepção de qualidade.

**1.1 Skeleton Loaders**
Criar componentes skeleton para StudentCard, StatCard, FormSubmissionCard, e ActivityFeedItem. Substituir os ActivityIndicator de tela cheia por layouts skeleton que reflitam o conteúdo final.

**1.2 Sistema de Toast Notifications**
Integrar react-native-toast-message. Substituir Alert.alert() por toasts para feedback não-crítico (sucesso ao atribuir programa, erro de rede, etc.). Manter Alert apenas para confirmações destrutivas.

**1.3 Tokens de Design Centralizados**
Criar `theme/colors.ts`, `theme/spacing.ts`, `theme/typography.ts`. Migrar todas as 50+ instâncias de cores hard-coded para referências ao tema. Isso prepara a base para dark mode e temas customizados.

**1.4 Acessibilidade Básica**
Adicionar accessibilityLabel a todos os componentes interativos nas telas principais (Dashboard, Students, Forms, Training Room). Priorizar StudentCard, StatCard, botões de ação e inputs de formulário.

**1.5 Banner de Status de Conexão**
Integrar @react-native-community/netinfo. Exibir banner não-intrusivo quando offline ("Sem conexão — dados podem estar desatualizados"). Esconder automaticamente ao reconectar.

**1.6 Debounce na Busca**
Adicionar debounce de 300ms nas buscas de alunos e exercícios. Implementar minimum de 2 caracteres antes de filtrar. Adicionar estado visual de "buscando".

### Fase 2: Funcionalidades Essenciais (3-5 sprints)

Estas fecham os gaps críticos que impedem autonomia total no mobile.

**2.1 Program Builder Mobile (Simplificado)**
Criar um builder otimizado para toque, não uma réplica do web. O conceito: tela full-screen com lista vertical de exercícios. Tap para expandir e configurar (séries, reps, carga, descanso, notas). Botão "+" flutuante para adicionar exercício com search modal. Reorder via long-press + drag. Agrupamento em supersets via seleção múltipla. Preview do treino antes de salvar.

Decisão de design: Não replicar o drag-and-drop do web. Em vez disso, usar padrão "tap to configure" que é nativo do mobile. O builder deve permitir criar um treino completo em menos de 5 minutos.

**2.2 Biblioteca de Exercícios — CRUD Completo**
Permitir criar exercícios customizados com nome, grupos musculares, equipamento, dificuldade e vídeo (URL do YouTube ou upload). Adicionar filtros por grupo muscular e equipamento como chips scrolláveis. Implementar busca com auto-sugestão baseada nos exercícios mais usados pelo treinador.

**2.3 Gráficos de Progressão no Detalhe do Aluno**
Adicionar gráfico de progressão de carga (tonnage) na aba Overview do student detail. Usar victory-native ou react-native-gifted-charts (bibliotecas leves para RN). Implementar gráfico de aderência semanal (barras) e tendência de métricas corporais (linha).

**2.4 Centro de Notificações**
Criar tela acessível via ícone de sino no header (como a web). Listar notificações com tipos visuais distintos (treino concluído, form submetido, pagamento, etc.). Marcar como lido via tap ou swipe. Badge no ícone com contagem de não-lidas.

**2.5 Cache Offline para Dados Essenciais**
Cachear lista de alunos, programas ativos e último treino de cada aluno em MMKV (já instalado no projeto). Servir dados do cache enquanto fetch atualizado acontece em background. Implementar fila de sync para operações de escrita (finalizar sessão, enviar feedback de form).

### Fase 3: Diferenciação (5-8 sprints)

Estas funcionalidades colocam o Kinevo à frente dos concorrentes.

**3.1 Voice Input para Training Room**
Reconhecimento de voz para registrar dados durante sessão de treino: "80 quilos, 10 reps, RPE 8". Usar expo-speech ou react-native-voice. Funciona especialmente bem para treinadores que estão acompanhando múltiplos alunos simultaneamente e não podem ficar digitando.

**3.2 Quick Actions com 3D Touch / Haptic Touch**
Ações rápidas no ícone do app: "Iniciar Treino", "Ver Alunos", "Notificações". Deep links diretos para as telas mais usadas. Implementar com expo-quick-actions.

**3.3 AI Insights no Mobile**
Trazer insights gerados por IA para o detalhe do aluno no mobile. Sugestões de ajuste de programa, detecção de platô, recomendações de progressão. Card expandível com "IA identificou que [aluno] pode estar estagnando em [exercício]. Considere aumentar volume."

**3.4 Widget para iOS e Android**
Widget de home screen mostrando: próximo treino agendado, alunos ativos hoje, sessões completadas. Usar expo-widget (experimental) ou react-native-widget-extension. Reduz fricção — treinador vê dados sem abrir o app.

**3.5 Layout Responsivo para iPad**
Implementar split-view (lista + detalhe) nas telas de Students e Forms. Usar useWindowDimensions() para breakpoints (>768px = tablet layout). No iPad, o detalhe do aluno abre ao lado da lista em vez de navegar para nova tela.

**3.6 Form Builder Mobile (Simplificado)**
Builder compacto que permite criar formulários básicos no celular: título, descrição, e lista de perguntas. Tipos de pergunta: texto livre, escala 1-10, escolha única, sim/não, foto. Não precisa ter a sofisticação do builder web, mas deve cobrir 80% dos casos de uso.

**3.7 Modo Apresentação para Alunos**
Tela que o treinador pode virar e mostrar para o aluno: próximo exercício com vídeo demonstrativo grande, séries/reps em fonte grande, timer de descanso proeminente. Otimizado para quando o treinador deixa o celular apoiado na bancada da academia para o aluno consultar.

**3.8 Gestão Financeira Básica**
Permitir criar e enviar cobranças pelo mobile. Visualizar status de cada aluno (pago, atrasado, cortesia). Enviar lembrete de pagamento via chat integrado. Não precisa replicar toda a gestão Stripe da web, mas deve permitir as operações do dia-a-dia.

---

## 6. Detalhamento Técnico das Prioridades

### 6.1 Program Builder Mobile — Proposta de Arquitetura

**Navegação:** Nova rota `/student/[id]/build-program` com stack navigation.

**Fluxo proposto:**
1. Tela inicial: Nome do programa + dias da semana (checkboxes)
2. Para cada dia: tela de construção do treino
3. Adicionar exercício: modal com busca + filtros
4. Configurar exercício: sheet expandível com inputs (séries × reps, carga, descanso, notas)
5. Reordenar: long-press + drag (reutilizar pattern do training room)
6. Preview: scroll vertical com resumo do programa completo
7. Salvar: POST `/api/programs/create` + opção de atribuir imediatamente

**Componentes necessários:**
- `ProgramBuilderScreen` — orquestrador de estado
- `WorkoutDayEditor` — editor de um dia de treino
- `ExerciseSearchModal` — busca com filtros
- `ExerciseConfigSheet` — bottom sheet com inputs de configuração
- `ProgramPreviewScreen` — preview antes de salvar

**Estado:** Zustand store local (`program-builder-store.ts`) com persistência MMKV para não perder progresso se o app fechar.

### 6.2 Skeleton Loaders — Implementação

Criar componentes skeleton reutilizáveis que espelham o layout dos cards reais:

**SkeletonStudentCard:**
- Círculo (avatar) + retângulo (nome) + retângulo menor (email)
- Dois retângulos pequenos (badges)
- Animação shimmer com Reanimated

**SkeletonStatCard:**
- Retângulo (label) + retângulo grande (número)
- Animação pulse

**SkeletonDashboard:**
- Header greeting skeleton + 4 StatCard skeletons + 3 ActivityFeed skeletons

### 6.3 Sistema de Tema — Estrutura

```
mobile/theme/
├── colors.ts       # Paleta completa (light + dark)
├── spacing.ts      # Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48
├── typography.ts   # Font sizes, weights, line heights
├── shadows.ts      # Platform-specific shadows
└── index.ts        # Export unificado + hook useTheme()
```

Cores sugeridas para o token system:
- `background.primary`: #F2F2F7 (light) / #0D0D17 (dark)
- `background.card`: #FFFFFF / #1A1A2E
- `text.primary`: #1a1a2e / #FFFFFF
- `text.secondary`: #6b7280 / #9ca3af
- `accent.primary`: #7c3aed (purple — marca do Kinevo)
- `accent.success`: #16a34a
- `accent.warning`: #f59e0b
- `accent.error`: #ef4444

---

## 7. Métricas de Sucesso

Para validar que as melhorias estão funcionando, recomendo acompanhar:

**Métricas de Engajamento:**
- Tempo médio de sessão do treinador no mobile (meta: aumentar 40%)
- Programas criados via mobile vs web (meta: 30% dos programas criados no mobile em 6 meses)
- DAU/MAU ratio de treinadores no mobile (meta: >50%)

**Métricas de Qualidade:**
- Crash rate por tela (meta: <0.1%)
- Tempo médio de carregamento de tela (meta: <1.5s)
- Task completion rate para fluxos críticos (prescrever treino, iniciar sessão)

**Métricas de Satisfação:**
- NPS de treinadores (meta: >70)
- App Store rating (meta: >4.7)
- Tickets de suporte relacionados a UX mobile (meta: reduzir 50%)

---

## 8. Conclusão

O Kinevo tem fundamentos técnicos fortes — monorepo bem organizado, tipos compartilhados, integração com IA, Apple Watch, e uma Sala de Treino robusta. O que falta para ser o melhor app de prescrição do mundo é fechar a distância entre web e mobile para o treinador.

O treinador moderno precisa operar com autonomia total pelo celular. Ele está na academia, entre um aluno e outro, sem notebook à mão. As três mudanças de maior impacto são: um program builder mobile nativo e otimizado para toque, skeleton loaders e polish de UX que transmitam qualidade, e cache offline para garantir que o app funcione mesmo com wifi instável.

Com a execução das fases 1 e 2, o Kinevo já estará à frente da maioria dos concorrentes. Com a fase 3, estará definindo o padrão do mercado.
