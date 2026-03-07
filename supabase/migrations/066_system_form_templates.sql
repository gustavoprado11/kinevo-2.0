-- Migration 066: System form templates (weekly_checkin, periodic_reassessment, program_feedback)
-- These are system templates (trainer_id = NULL) with clone-on-write behavior

-- Expand created_source check constraint to allow 'system'
ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_created_source_check;
ALTER TABLE form_templates ADD CONSTRAINT form_templates_created_source_check
    CHECK (created_source IN ('manual', 'ai_assisted', 'system'));

-- Update existing system template to use correct source
UPDATE form_templates SET created_source = 'system' WHERE system_key = 'initial_assessment' AND created_source = 'manual';

-- 1. Check-in Semanal (weekly_checkin) — 10 questions, ~3 min
INSERT INTO form_templates (trainer_id, title, description, category, system_key, schema_json, created_source)
VALUES (
    NULL,
    'Check-in Semanal',
    'Acompanhamento semanal rápido para monitorar progresso, disposição e aderência do aluno.',
    'checkin',
    'weekly_checkin',
    $checkin${
  "schema_version": 1,
  "layout": {
    "estimated_minutes": 3,
    "progress_mode": "bar"
  },
  "questions": [
    {
      "id": "ci01",
      "type": "scale",
      "label": "Como você avalia sua disposição geral nesta semana?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Muito baixa", "maxLabel": "Excelente" }
    },
    {
      "id": "ci02",
      "type": "single_choice",
      "label": "Quantos treinos você completou esta semana?",
      "required": true,
      "options": ["Nenhum", "1", "2", "3", "4", "5 ou mais"]
    },
    {
      "id": "ci03",
      "type": "single_choice",
      "label": "Como está sua aderência à dieta/plano alimentar?",
      "required": true,
      "options": ["Não estou seguindo", "Seguindo parcialmente", "Seguindo bem", "Seguindo 100%"]
    },
    {
      "id": "ci04",
      "type": "scale",
      "label": "Qual seu nível de dor ou desconforto muscular/articular?",
      "required": true,
      "scale": { "min": 0, "max": 10, "minLabel": "Nenhuma dor", "maxLabel": "Dor intensa" }
    },
    {
      "id": "ci05",
      "type": "single_choice",
      "label": "Como está a qualidade do seu sono?",
      "required": true,
      "options": ["Péssima", "Ruim", "Regular", "Boa", "Excelente"]
    },
    {
      "id": "ci06",
      "type": "scale",
      "label": "Qual seu nível de estresse nesta semana?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Muito baixo", "maxLabel": "Muito alto" }
    },
    {
      "id": "ci07",
      "type": "single_choice",
      "label": "Você sentiu alguma dificuldade nos exercícios prescritos?",
      "required": true,
      "options": ["Não, todos tranquilos", "Sim, alguns exercícios", "Sim, muitos exercícios"]
    },
    {
      "id": "ci08",
      "type": "short_text",
      "label": "Se sentiu dificuldade, em quais exercícios?",
      "required": false,
      "placeholder": "Ex: supino reto, agachamento..."
    },
    {
      "id": "ci09",
      "type": "scale",
      "label": "Qual sua motivação para a próxima semana de treino?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Muito baixa", "maxLabel": "Muito alta" }
    },
    {
      "id": "ci10",
      "type": "long_text",
      "label": "Alguma observação ou pedido para o treinador?",
      "required": false,
      "placeholder": "Comentários livres sobre a semana, dúvidas, sugestões..."
    }
  ]
}$checkin$::jsonb,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;

-- 2. Reavaliação Periódica (periodic_reassessment) — 15 questions, ~10 min
INSERT INTO form_templates (trainer_id, title, description, category, system_key, schema_json, created_source)
VALUES (
    NULL,
    'Reavaliação Periódica',
    'Formulário completo de reavaliação para acompanhar evolução física, hábitos e ajustar o programa de treino.',
    'anamnese',
    'periodic_reassessment',
    $reassess${
  "schema_version": 1,
  "layout": {
    "estimated_minutes": 10,
    "progress_mode": "bar"
  },
  "questions": [
    {
      "id": "ra01",
      "type": "short_text",
      "label": "Peso atual (kg)",
      "required": true,
      "placeholder": "Ex: 75.5"
    },
    {
      "id": "ra02",
      "type": "short_text",
      "label": "Percentual de gordura atual (%) — se disponível",
      "required": false,
      "placeholder": "Ex: 18"
    },
    {
      "id": "ra03",
      "type": "single_choice",
      "label": "Em relação ao início do programa, como você percebe sua composição corporal?",
      "required": true,
      "options": ["Piorou", "Manteve igual", "Melhorou pouco", "Melhorou bastante", "Melhorou muito"]
    },
    {
      "id": "ra04",
      "type": "scale",
      "label": "Como avalia sua evolução de força nos exercícios?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Nenhuma evolução", "maxLabel": "Evolução excelente" }
    },
    {
      "id": "ra05",
      "type": "scale",
      "label": "Como avalia sua evolução de condicionamento/resistência?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Nenhuma evolução", "maxLabel": "Evolução excelente" }
    },
    {
      "id": "ra06",
      "type": "single_choice",
      "label": "Você está conseguindo manter a frequência de treino planejada?",
      "required": true,
      "options": ["Nunca", "Raramente", "Às vezes", "Quase sempre", "Sempre"]
    },
    {
      "id": "ra07",
      "type": "multi_choice",
      "label": "Houve mudança em algum desses aspectos desde a última avaliação?",
      "required": false,
      "options": ["Lesão ou dor nova", "Mudança na rotina de trabalho", "Mudança na alimentação", "Mudança no sono", "Início/pausa de medicamento", "Mudança emocional significativa", "Nenhuma mudança relevante"]
    },
    {
      "id": "ra08",
      "type": "long_text",
      "label": "Descreva as mudanças assinaladas acima, se houver.",
      "required": false,
      "placeholder": "Detalhe o que mudou..."
    },
    {
      "id": "ra09",
      "type": "single_choice",
      "label": "Como está sua aderência ao plano alimentar?",
      "required": true,
      "options": ["Não sigo nenhum plano", "Sigo menos de 50%", "Sigo cerca de 50-70%", "Sigo mais de 70%", "Sigo integralmente"]
    },
    {
      "id": "ra10",
      "type": "single_choice",
      "label": "Quantas horas de sono você tem dormido em média por noite?",
      "required": true,
      "options": ["Menos de 5h", "5-6h", "6-7h", "7-8h", "Mais de 8h"]
    },
    {
      "id": "ra11",
      "type": "scale",
      "label": "Qual sua satisfação geral com os resultados até agora?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Muito insatisfeito", "maxLabel": "Muito satisfeito" }
    },
    {
      "id": "ra12",
      "type": "single_choice",
      "label": "Seus objetivos mudaram desde o início?",
      "required": true,
      "options": ["Não, continuam os mesmos", "Sim, mudaram parcialmente", "Sim, mudaram totalmente"]
    },
    {
      "id": "ra13",
      "type": "long_text",
      "label": "Se seus objetivos mudaram, descreva os novos objetivos.",
      "required": false,
      "placeholder": "Novos objetivos..."
    },
    {
      "id": "ra14",
      "type": "photo",
      "label": "Foto de acompanhamento (frente, lado, costas) — opcional",
      "required": false
    },
    {
      "id": "ra15",
      "type": "long_text",
      "label": "Observações finais ou pedidos para o próximo ciclo de treino.",
      "required": false,
      "placeholder": "Algo que gostaria de mudar, manter ou experimentar..."
    }
  ]
}$reassess$::jsonb,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;

-- 3. Feedback do Programa (program_feedback) — 12 questions, ~5 min
INSERT INTO form_templates (trainer_id, title, description, category, system_key, schema_json, created_source)
VALUES (
    NULL,
    'Feedback do Programa',
    'Pesquisa de satisfação e feedback sobre o programa de treinamento, atendimento e experiência geral.',
    'survey',
    'program_feedback',
    $feedback${
  "schema_version": 1,
  "layout": {
    "estimated_minutes": 5,
    "progress_mode": "bar"
  },
  "questions": [
    {
      "id": "fb01",
      "type": "scale",
      "label": "De 0 a 10, o quanto você recomendaria este programa a um amigo? (NPS)",
      "required": true,
      "scale": { "min": 0, "max": 10, "minLabel": "Jamais recomendaria", "maxLabel": "Recomendaria com certeza" }
    },
    {
      "id": "fb02",
      "type": "scale",
      "label": "Como avalia a qualidade dos treinos prescritos?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Muito ruim", "maxLabel": "Excelente" }
    },
    {
      "id": "fb03",
      "type": "scale",
      "label": "Como avalia o acompanhamento e suporte do treinador?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Muito ruim", "maxLabel": "Excelente" }
    },
    {
      "id": "fb04",
      "type": "single_choice",
      "label": "A comunicação com o treinador é adequada?",
      "required": true,
      "options": ["Insuficiente — gostaria de mais contato", "Adequada", "Excessiva — preferiria menos contato"]
    },
    {
      "id": "fb05",
      "type": "single_choice",
      "label": "Os treinos estão adequados ao seu nível e rotina?",
      "required": true,
      "options": ["Muito fáceis", "Um pouco fáceis", "Na medida certa", "Um pouco difíceis", "Muito difíceis"]
    },
    {
      "id": "fb06",
      "type": "single_choice",
      "label": "A duração dos treinos está adequada?",
      "required": true,
      "options": ["Muito curtos", "Um pouco curtos", "Na medida certa", "Um pouco longos", "Muito longos"]
    },
    {
      "id": "fb07",
      "type": "single_choice",
      "label": "A variedade de exercícios está adequada?",
      "required": true,
      "options": ["Muito repetitivo", "Poderia variar mais", "Na medida certa", "Muita variedade, preferiria mais consistência"]
    },
    {
      "id": "fb08",
      "type": "scale",
      "label": "Como avalia a plataforma/app utilizado?",
      "required": true,
      "scale": { "min": 1, "max": 10, "minLabel": "Muito ruim", "maxLabel": "Excelente" }
    },
    {
      "id": "fb09",
      "type": "multi_choice",
      "label": "O que você mais valoriza no programa?",
      "required": false,
      "options": ["Personalização dos treinos", "Acompanhamento do treinador", "Resultados obtidos", "Praticidade do app", "Variedade de exercícios", "Flexibilidade de horários", "Custo-benefício"]
    },
    {
      "id": "fb10",
      "type": "multi_choice",
      "label": "O que poderia melhorar?",
      "required": false,
      "options": ["Mais opções de exercício", "Vídeos demonstrativos", "Plano alimentar integrado", "Mais check-ins com o treinador", "Interface do app", "Conteúdo educativo", "Nada a melhorar"]
    },
    {
      "id": "fb11",
      "type": "long_text",
      "label": "Deixe um depoimento sobre sua experiência (pode ser compartilhado anonimamente).",
      "required": false,
      "placeholder": "Conte como tem sido sua experiência com o programa..."
    },
    {
      "id": "fb12",
      "type": "long_text",
      "label": "Sugestões ou comentários adicionais para o treinador.",
      "required": false,
      "placeholder": "Qualquer feedback adicional..."
    }
  ]
}$feedback$::jsonb,
    'system'
)
ON CONFLICT (system_key) DO NOTHING;
