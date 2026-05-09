import type { TourStep } from '@/stores/onboarding-store'

export const TOUR_STEPS: Record<string, TourStep[]> = {
  // =============================================
  // WELCOME TOUR — played from dashboard after Welcome Modal
  // =============================================
  welcome: [
    {
      id: 'welcome-1',
      targetSelector: '[data-onboarding="sidebar-students"]',
      title: 'Seus Alunos',
      description:
        'Cadastre e gerencie todos os seus alunos. Cada aluno tem perfil completo, programa ativo e histórico de sessões.',
      placement: 'right',
    },
    {
      id: 'welcome-2',
      targetSelector: '[data-onboarding="sidebar-exercises"]',
      title: 'Biblioteca de Exercícios',
      description:
        'Mais de 400 exercícios do sistema com vídeo demonstrativo. Crie exercícios personalizados quando precisar.',
      placement: 'right',
    },
    {
      id: 'welcome-3',
      targetSelector: '[data-onboarding="sidebar-programs"]',
      title: 'Templates de Programa',
      description:
        'Monte programas de treino reutilizáveis. Crie uma vez e atribua para vários alunos com um clique.',
      placement: 'right',
    },
    {
      id: 'welcome-4',
      targetSelector: '[data-onboarding="sidebar-forms"]',
      title: 'Avaliações e Formulários',
      description:
        'Envie anamneses, check-ins semanais e formulários personalizados. Receba respostas e dê feedback direto pela plataforma.',
      placement: 'right',
    },
    {
      id: 'welcome-5',
      targetSelector: '[data-onboarding="sidebar-financial"]',
      title: 'Financeiro',
      description:
        'Crie planos de consultoria, conecte com Stripe para cobrar automaticamente ou controle pagamentos manuais.',
      placement: 'right',
    },
    {
      id: 'welcome-6',
      targetSelector: '[data-onboarding="sidebar-settings"]',
      title: 'Configurações',
      description:
        'Personalize seu perfil, escolha tema claro ou escuro e gerencie sua assinatura.',
      placement: 'right',
    },
    {
      id: 'welcome-7',
      targetSelector: '[data-onboarding="dashboard-new-student"]',
      title: 'Primeiro Passo: Cadastre um Aluno',
      description:
        'Comece cadastrando seu primeiro aluno. Você também pode usar o perfil "Meu Perfil" para testar os treinos no App Mobile.',
      placement: 'bottom',
    },
    {
      id: 'welcome-8',
      targetSelector: '[data-onboarding="dashboard-training-room"]',
      title: 'Sala de Treino',
      description:
        'Quando treinar presencialmente com seus alunos, use a Sala de Treino para registrar cargas e séries em tempo real.',
      placement: 'bottom',
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

  program_builder: [
    {
      id: 'builder-1',
      targetSelector: '[data-onboarding="program-workouts"]',
      title: 'Dias de Treino',
      description:
        'Cada aba representa um dia (A, B, C...). Adicione quantos dias precisar e organize exercícios dentro de cada um.',
      placement: 'bottom',
    },
    {
      id: 'builder-2',
      targetSelector: '[data-onboarding="program-exercise-library"]',
      title: 'Biblioteca de Exercícios',
      description:
        'Arraste exercícios para o treino ou use o botão + para adicionar. Filtre por grupo muscular para encontrar mais rápido.',
      placement: 'left',
    },
    {
      id: 'builder-3',
      targetSelector: '[data-onboarding="program-volume"]',
      title: 'Volume Semanal Automático',
      description:
        'Total de séries por grupo muscular calculado em tempo real. Use como guia para equilibrar o programa.',
      placement: 'bottom',
    },
    {
      id: 'builder-4',
      targetSelector: '[data-onboarding="program-save"]',
      title: 'Salvar e Publicar',
      description:
        'Salve como template reutilizável ou atribua direto ao aluno. Escolha início imediato ou data agendada.',
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
}
