import type { TourStep } from '@/stores/onboarding-store'
import type { TrainerModalityFocus } from '@kinevo/shared/types/onboarding'

/** Fase 17b — id usado pelo TourRunner pra renderizar o WelcomeMobileStep custom. */
export const WELCOME_MOBILE_STEP_ID = 'welcome-mobile-qr'

export const TOUR_STEPS: Record<string, TourStep[]> = {
  // =============================================
  // WELCOME TOUR v2 (Fase 17b) — 6 steps, adapta por modalityFocus
  // =============================================
  welcome: [
    // 1. Alunos
    {
      id: 'welcome-1',
      targetSelector: '[data-onboarding="sidebar-students"]',
      title: 'Seus Alunos',
      description:
        'Cadastre e gerencie todos os seus alunos. Perfil completo, programa ativo e histórico de sessões em um só lugar.',
      placement: 'right',
    },
    // 2. Formulários
    {
      id: 'welcome-2',
      targetSelector: '[data-onboarding="sidebar-forms"]',
      title: 'Formulários',
      description:
        'Envie anamneses e formulários personalizados. Receba respostas e dê feedback direto pela plataforma.',
      placement: 'right',
      byModality: {
        presencial: {
          description:
            'Anamnese pra novos alunos. Você também pode usar pra check-ins quando quiser.',
        },
        online: {
          description:
            'Anamnese, check-in semanal e qualquer formulário recorrente. Receba respostas e dê feedback pela plataforma.',
        },
      },
    },
    // 3. Bibliotecas (Programas + Exercícios consolidados)
    {
      id: 'welcome-3',
      targetSelector: '[data-onboarding="sidebar-programs"]',
      title: 'Programas e Exercícios',
      description:
        'Monte programas reutilizáveis e use a biblioteca com 400+ exercícios. Crie exercícios próprios quando precisar.',
      placement: 'right',
    },
    // 4. Financeiro
    {
      id: 'welcome-4',
      targetSelector: '[data-onboarding="sidebar-financial"]',
      title: 'Financeiro',
      description:
        'Cobrança recorrente via Stripe ou controle manual de pagamentos e relatórios — escolha o que faz sentido pro seu negócio.',
      placement: 'right',
      byModality: {
        presencial: {
          description:
            'Controle manual de pagamentos e relatórios. Stripe é opcional aqui.',
        },
        online: {
          description:
            'Stripe pra cobrança recorrente automática. Crie planos e venda no checkout.',
        },
      },
    },
    // 5. Sala de Treino — oculto pra 'online'
    {
      id: 'welcome-5',
      targetSelector: '[data-onboarding="dashboard-training-room"]',
      title: 'Sala de Treino',
      description:
        'Pra treinos presenciais: registre carga, reps e RPE em tempo real ao lado do aluno. Histórico e PRs ficam salvos automaticamente.',
      placement: 'bottom',
      visibleFor: ['presencial', 'ambos'],
    },
    // 6. App Mobile (sempre presente — copy adapta; conteúdo custom QR)
    {
      id: WELCOME_MOBILE_STEP_ID,
      targetSelector: '[data-onboarding="dashboard-share-app"]',
      title: 'App Mobile',
      description:
        'Sala de Treino, formulários e notificações também acontecem no app. O login é o mesmo do web.',
      placement: 'left',
      customContentId: 'welcome-mobile-step',
      byModality: {
        presencial: {
          description:
            'Sala de Treino e captura de avaliação acontecem aqui. O login é o mesmo do web.',
        },
        online: {
          description:
            'Mensagens, notificações e acompanhamento dos alunos. O login é o mesmo do web.',
        },
      },
    },
  ],

  // =============================================
  // PER-SCREEN TOURS (Phase 3 — definitions ready)
  // =============================================
  students: [
    {
      id: 'students-1',
      targetSelector: '[data-onboarding="students-add-btn"]',
      title: 'Cadastrar Alunos',
      description:
        'Adicione alunos com nome, email e telefone. Eles receberão acesso automático ao App Mobile para treinar.',
      placement: 'bottom',
    },
    {
      id: 'students-2',
      targetSelector: '[data-onboarding="students-search"]',
      title: 'Busca Rápida',
      description:
        'Encontre qualquer aluno pelo nome ou email instantaneamente.',
      placement: 'bottom',
    },
    {
      id: 'students-3',
      targetSelector: '[data-onboarding="students-self-profile"]',
      title: 'Seu Perfil de Treino',
      description:
        'Este é você! Prescreva treinos para si mesmo e teste tudo pelo App Mobile antes de enviar para alunos.',
      placement: 'bottom',
    },
  ],

  student_detail: [
    {
      id: 'detail-1',
      targetSelector: '[data-onboarding="student-actions"]',
      title: 'Prescrição de Treino',
      description:
        'Três formas de prescrever: criar manualmente do zero, usar a IA para gerar automaticamente, ou atribuir um template pronto da sua biblioteca.',
      placement: 'bottom',
    },
    {
      id: 'detail-2',
      targetSelector: '[data-onboarding="student-calendar"]',
      title: 'Calendário de Sessões',
      description:
        'Visualize todas as sessões completadas e agendadas. Clique em um dia para ver detalhes de carga, volume e feedback do aluno.',
      placement: 'top',
    },
    {
      id: 'detail-3',
      targetSelector: '[data-onboarding="student-history-summary"]',
      title: 'Acompanhamento',
      description:
        'Total de sessões, última sessão e frequência semanal. Monitore a aderência e ajuste o programa quando necessário.',
      placement: 'left',
    },
    {
      id: 'detail-4',
      targetSelector: '[data-onboarding="student-header-actions"]',
      title: 'Ações do Aluno',
      description:
        'Edite dados pessoais, altere modalidade (presencial/online), redefina senha de acesso ou gerencie o perfil completo.',
      placement: 'bottom',
    },
  ],

  prescribe: [
    {
      id: 'prescribe-1',
      targetSelector: '[data-onboarding="prescription-profile"]',
      title: 'Perfil de Prescrição',
      description:
        'Preencha nível, objetivo, frequência, equipamentos e restrições. A IA usa todas essas informações para montar o programa ideal.',
      placement: 'right',
    },
    {
      id: 'prescribe-2',
      targetSelector: '[data-onboarding="prescription-ai-mode"]',
      title: 'Modo da Inteligência Artificial',
      description:
        'Automático: a IA decide tudo. Copiloto: a IA sugere e você edita. Assistente: você monta e a IA apoia.',
      placement: 'bottom',
    },
    {
      id: 'prescribe-3',
      targetSelector: '[data-onboarding="prescription-generate"]',
      title: 'Gerar Programa',
      description:
        'Após salvar o perfil, clique para gerar. Você poderá editar tudo antes de publicar. Nada chega ao aluno sem sua aprovação.',
      placement: 'top',
    },
  ],

  // Passeio completo do builder. Dispara sozinho na 1ª criação de programa
  // (jornada de boas-vindas → ?welcome=1, após o wizard de preferências) e
  // fica sob demanda no "?" (TourHelpButton) do próprio builder.
  // Passos condicionais (compare exige contexto de aluno; check-in exige
  // formulários) usam o auto-skip de 2s do TourRunner quando o alvo não existe.
  program_builder: [
    {
      id: 'builder-1',
      targetSelector: '[data-onboarding="program-workouts"]',
      title: 'Seus dias de treino',
      description:
        'Cada aba é um dia (A, B, C...). Adicione quantos precisar no + e organize os exercícios dentro de cada um.',
      placement: 'bottom',
    },
    {
      id: 'builder-2',
      targetSelector: '[aria-label="Tipo do treino"]',
      title: 'Força ou aeróbio',
      description:
        'Cada treino pode ser de força ou só aeróbio (zonas, intervalos, contínuo). O app do aluno se adapta ao tipo.',
      placement: 'top',
    },
    {
      id: 'builder-3',
      targetSelector: '[data-onboarding="program-exercise-library"]',
      title: 'Biblioteca de exercícios',
      description:
        'Arraste um exercício pro treino ou use o + pra adicionar. Filtre por grupo muscular pra achar mais rápido.',
      placement: 'left',
    },
    {
      id: 'builder-4',
      targetSelector: '[data-onboarding="program-workouts"]',
      title: 'Como criar um superset',
      description:
        'Pra unir dois exercícios, passe o mouse entre eles e clique em “Criar superset”. Veja como funciona:',
      placement: 'bottom',
      spotlightPadding: 16,
      customContentId: 'superset-demo',
    },
    {
      id: 'builder-5',
      targetSelector: '[data-onboarding="program-volume"]',
      title: 'Volume semanal automático',
      description:
        'Total de séries por grupo muscular, calculado em tempo real. Use como guia pra equilibrar o programa.',
      placement: 'bottom',
    },
    {
      id: 'builder-6',
      targetSelector: '[data-onboarding="builder-preferences"]',
      title: 'Preferências de prescrição',
      description:
        'Defina uma vez seus padrões — séries, reps, descanso, campos que você usa — e o builder já vem do seu jeito toda vez.',
      placement: 'bottom',
    },
    {
      id: 'builder-7',
      targetSelector: '[data-onboarding="builder-text"]',
      title: 'Texto para treino',
      description:
        'Já tem o treino escrito? Cole aqui e a IA estrutura em exercícios e séries pra você revisar.',
      placement: 'bottom',
    },
    {
      id: 'builder-8',
      targetSelector: '[data-onboarding="builder-compare"]',
      title: 'Comparar com o anterior',
      description:
        'Veja lado a lado o programa anterior do aluno e monte o próximo ciclo em cima do que ele executava.',
      placement: 'bottom',
    },
    {
      id: 'builder-9',
      targetSelector: '[data-onboarding="builder-preview"]',
      title: 'Pré-visualizar no celular',
      description:
        'Veja o treino exatamente como o aluno recebe no app — antes de publicar.',
      placement: 'bottom',
    },
    {
      id: 'builder-10',
      targetSelector: '[data-onboarding="builder-checkin"]',
      title: 'Configurar check-in',
      description:
        'Dispare um formulário antes ou depois do treino: RPE, dor, feedback. Aparece quando você já tem formulários criados.',
      placement: 'bottom',
    },
    {
      id: 'builder-11',
      targetSelector: '[data-onboarding="program-save"]',
      title: 'Salvar e publicar',
      description:
        'Salve como modelo reutilizável ou atribua direto ao aluno. Escolha início imediato ou data agendada.',
      placement: 'top',
    },
  ],

  programs: [
    {
      id: 'programs-1',
      targetSelector: '[data-onboarding="programs-create-btn"]',
      title: 'Criar Templates',
      description:
        'Templates são programas reutilizáveis. Monte uma vez e atribua para quantos alunos quiser.',
      placement: 'bottom',
    },
  ],

  exercises: [
    {
      id: 'exercises-1',
      targetSelector: '[data-onboarding="exercises-add-btn"]',
      title: 'Exercícios Personalizados',
      description:
        'Crie exercícios com nome, vídeo, equipamento e grupo muscular. Aparecem em destaque na biblioteca.',
      placement: 'bottom',
    },
    {
      id: 'exercises-2',
      targetSelector: '[data-onboarding="exercises-muscle-filters"]',
      title: 'Filtros por Grupo Muscular',
      description:
        'Filtre rapidamente para encontrar exercícios de peito, costas, pernas e outros grupos.',
      placement: 'bottom',
    },
    {
      id: 'exercises-3',
      targetSelector: '[data-onboarding="exercises-search"]',
      title: 'Busca por Nome',
      description:
        'Digite parte do nome para encontrar qualquer exercício do sistema ou personalizado.',
      placement: 'bottom',
    },
  ],

  // Legacy tour mantido como alias para retro-compat de checkers que ainda
  // usam o nome 'forms'. Reescrito em M8/B4 com selectors da nova IA
  // (forms-only). Trainers que completaram esse tour antigo recebem
  // 'tour_forms_first_time' como completed via migration (script SQL).
  forms: [], // unused — preservado pra retro-compat com tours_completed antigos

  // M8/B4 — TOUR DEDICADO À ROTA /forms (forms-only).
  // Dispara em /forms na primeira visita pós-deploy.
  tour_forms_first_time: [
    {
      id: 'tour-forms-1',
      targetSelector: '[data-onboarding="forms-send-cta"]',
      title: 'Envie formulários para alunos',
      description:
        'Atribua anamneses, check-ins ou pesquisas para qualquer aluno em poucos cliques. Você pode enviar para vários alunos de uma vez.',
      placement: 'bottom',
    },
    {
      id: 'tour-forms-2',
      targetSelector: '[data-onboarding="forms-templates-card"]',
      title: 'Templates personalizados',
      description:
        'Crie questionários reutilizáveis com o builder. Use IA para gerar um rascunho ou monte pergunta por pergunta.',
      placement: 'bottom',
    },
    {
      id: 'tour-forms-3',
      targetSelector: '[data-onboarding="forms-pending"]',
      title: 'Aguardando seu feedback',
      description:
        'Respostas dos alunos chegam aqui. Feedback rápido aumenta o engajamento — clique para revisar e responder.',
      placement: 'top',
    },
  ],

  form_builder: [
    {
      id: 'fb-1',
      targetSelector: '[data-onboarding="form-choose-method"]',
      title: 'Como Criar o Formulário',
      description:
        'Use IA para gerar um rascunho automaticamente ou monte pergunta por pergunta. Você pode editar tudo depois.',
      placement: 'bottom',
    },
    {
      id: 'fb-2',
      targetSelector: '[data-onboarding="form-question-types"]',
      title: 'Tipos de Pergunta',
      description:
        'Texto curto, texto longo, escolha única, escala numérica e foto. Combine para avaliações completas.',
      placement: 'right',
    },
  ],

  // Legacy tour mantido como alias para retro-compat de checkers antigos.
  // Reescrito em M8/B4 como 'tour_assessments_first_time' apontando pra
  // /avaliacoes. Migration mapeia esse id antigo pro novo.
  assessments_first_time: [], // unused — preservado pra retro-compat

  // M9/B3 — TOUR DEDICADO AO NewStudentWizard (slide-in pós-criação de aluno).
  // Dispara na primeira vez que o wizard abre (auto-start dentro do componente).
  // 3 steps explicam o conceito + skippability + expectativa do flow completo.
  tour_new_student_wizard: [
    {
      id: 'tour-wiz-1',
      targetSelector: '[data-onboarding="wizard-step-1"]',
      title: 'Onboarding em 2 passos',
      description:
        'Recém-criou um aluno? Aqui você envia uma anamnese e agenda a primeira avaliação sem sair desta tela.',
      placement: 'left',
    },
    {
      id: 'tour-wiz-2',
      targetSelector: '[data-onboarding="wizard-skip"]',
      title: 'Cada passo é opcional',
      description:
        'Pular não cancela o flow — apenas avança sem fazer aquela ação. Você sempre pode enviar uma anamnese ou agendar avaliação manualmente depois.',
      placement: 'top',
    },
    {
      id: 'tour-wiz-3',
      targetSelector: '[data-onboarding="wizard-step-1"]',
      title: 'Próximo: avaliação presencial',
      description:
        'Após a anamnese, o segundo passo agenda a captura de medições. Pode ser pra hoje, semana que vem ou começar agora.',
      placement: 'left',
    },
  ],

  // M8/B4 — TOUR DEDICADO À ROTA /avaliacoes (assessments-only).
  // Dispara em /avaliacoes na primeira visita pós-deploy.
  tour_assessments_first_time: [
    {
      id: 'tour-asm-1',
      targetSelector: '[data-onboarding="avaliacoes-header"]',
      title: 'Avaliações presenciais',
      description:
        'Sessões de avaliação que você agenda e captura no app mobile com o aluno presente. Aqui no web você acompanha o progresso e gera laudos.',
      placement: 'bottom',
    },
    {
      id: 'tour-asm-2',
      targetSelector: '[data-onboarding="assessments-new-template"]',
      title: 'Templates prontos',
      description:
        'Já temos 5 templates Kinevo prontos pra usar — Antropometria, Jackson & Pollock 3 e 7 dobras, Petroski 4 (BR) e Avaliação Inicial. Pode clonar e personalizar.',
      placement: 'bottom',
    },
    {
      id: 'tour-asm-3',
      targetSelector: '[data-onboarding="assessments-new-session"]',
      title: 'Agende uma avaliação',
      description:
        'Escolha o aluno, o template, sexo e idade. Esses dados alimentam os protocolos de composição corporal automaticamente.',
      placement: 'bottom',
    },
  ],

  // =============================================
  // ASSISTENTE — tour sob demanda da tela /assistente (TourHelpButton no
  // canto da AssistantHome). Âncoras vivem em assistant-home.tsx; os passos
  // de seções condicionais (ex.: "Precisa de atenção") são auto-skipados
  // pelo TourRunner quando a seção não está renderizada.
  // =============================================
  assistente: [
    {
      id: 'assistente-1',
      targetSelector: '[data-onboarding="assistant-composer"]',
      title: 'Peça em português, ele executa',
      description:
        'Descreva o que precisa — montar um treino, cobrar um aluno, enviar uma anamnese. O assistente age de verdade na plataforma, e toda ação importante pede sua confirmação antes.',
      placement: 'bottom',
    },
    {
      id: 'assistente-2',
      targetSelector: '[data-onboarding="assistant-scope"]',
      title: 'Geral ou um aluno em foco',
      description:
        'Converse sobre a carteira toda ou coloque um aluno em foco: com foco, as respostas usam o contexto dele — treinos, medidas, histórico e financeiro.',
      placement: 'bottom',
    },
    {
      id: 'assistente-3',
      targetSelector: '[data-onboarding="assistant-attention"]',
      title: 'Ele avisa o que precisa de você',
      description:
        'Estagnação, pagamento atrasado, check-in sem resposta: o assistente vigia sua carteira e traz aqui. Toque num card pra resolver direto na conversa.',
      placement: 'top',
    },
    {
      id: 'assistente-4',
      targetSelector: '[data-onboarding="assistant-starters"]',
      title: 'Sem saber por onde começar?',
      description:
        'Prompts prontos por área — financeiro, alunos, treinos e comunicação. Tocar preenche o campo; você ajusta e envia.',
      placement: 'top',
    },
    {
      id: 'assistente-5',
      targetSelector: '[data-onboarding="assistant-composer"]',
      title: 'Disponível em qualquer tela',
      description:
        'Fora daqui, pressione ⌘K (Ctrl+K no Windows) pra chamar o assistente e agir na tela em que você estiver.',
      placement: 'bottom',
    },
  ],
}

/**
 * Fase 17b — Filtra/ajusta steps de um tour pela modalidade do trainer.
 *
 * - `visibleFor`: undefined = step sempre visível. Caso contrário, só inclui
 *   se a modalidade resolvida (null → 'ambos') estiver no array.
 * - `byModality`: copy override por modalidade. Mescla title/description.
 */
export function resolveSteps(
  tourId: string,
  modality: TrainerModalityFocus,
): TourStep[] {
  const steps = TOUR_STEPS[tourId] ?? []
  const resolved: Exclude<TrainerModalityFocus, null> = modality ?? 'ambos'

  return steps
    .filter((s) => !s.visibleFor || s.visibleFor.includes(resolved))
    .map((s) => {
      const override = s.byModality?.[resolved]
      if (!override) return s
      return { ...s, ...override }
    })
}
