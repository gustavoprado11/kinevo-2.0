# ⚡ KINEVO — Módulo de Prescrição Inteligente
> **Product Requirements Document (PRD) v1.0 — Confidencial**

| | |
|---|---|
| Versão | 1.0 |
| Status | Draft — Revisão Fundador |
| Autor | Gustavo — Fundador Kinevo |
| Data | Fevereiro 2026 |

---

## 1. Visão Geral e Problema a Resolver

### 1.1 O Problema Central

O treinador de personal training enfrenta hoje um paradoxo cruel: quanto mais qualidade técnica entrega, menos escala consegue atingir. Montar um programa do zero, do jeito certo, leva entre 30 a 90 minutos por aluno. Para um profissional com 20 alunos ativos, isso representa até 30 horas mensais gastas apenas em prescrição — antes mesmo de atender qualquer aluno presencialmente.

> **O custo real da prescrição manual**
> - 30–90 min por programa novo × 20 alunos = até 30h/mês só em prescrição
> - Reavaliações e ajustes mensais consomem mais 10–15h adicionais
> - Resultado: treinador trava em ~20 alunos por limitação de tempo, não de capacidade técnica
> - Perda de receita potencial: se cada aluno vale R$ 300/mês, 10 alunos a mais = R$ 3.000/mês

### 1.2 A Oportunidade

O Kinevo já tem a infraestrutura certa: banco de dados de exercícios, perfil de alunos, registro de execução. Falta a camada de inteligência que conecta tudo isso à metodologia do treinador. Um módulo de prescrição com IA não vai substituir o treinador — vai multiplicar sua capacidade técnica, permitindo que ele atenda 2x ou 3x mais alunos sem perder a personalização que é seu diferencial competitivo.

> **A proposta de valor em uma frase**
> *"O Kinevo aprende como você pensa como treinador e replica sua lógica de prescrição para cada aluno — com velocidade de IA e qualidade de especialista."*

### 1.3 Personas Afetadas

| Persona | Dor Principal | Ganho com o Módulo |
|---|---|---|
| Treinador Personal (1–30 alunos) | Tempo gasto em prescrição manual | Gera programa em < 3 min, revisa e envia |
| Treinador de Academia (30+ alunos) | Inconsistência entre programas de alunos diferentes | Padrão metodológico em todos os programas |
| Treinador Online | Difícil personalizar sem ver o aluno | IA usa dados do app para adaptar remotamente |
| Aluno Iniciante | Programa genérico que não respeita seu nível | Programa calibrado ao seu volume e preferências |
| Aluno Avançado | Programa que não evolui com seu desempenho | Progressão automática baseada em log de cargas |

---

## 2. A Metodologia Kinevo

> O DNA técnico que diferencia o produto de qualquer concorrente genérico

Esta seção documenta a metodologia prescritiva do Gustavo — fundador e profissional de Educação Física. É essa lógica, e não um modelo de linguagem genérico, que o módulo de IA deve aprender, aplicar e replicar. Isso é o que torna o Kinevo impossível de copiar no curto prazo.

### 2.1 Princípio Máximo: Aderência Acima de Tudo

O maior preditor de resultado em qualquer programa de treino não é a periodização, nem o volume, nem a frequência — é a consistência. Um programa que o aluno segue 80% das vezes supera qualquer programa perfeito que seja seguido 40% das vezes. Por isso, o módulo de IA deve priorizar:

- Preferências do aluno em relação a exercícios e equipamentos
- Disponibilidade real de dias e tempo por sessão
- Histórico de aderência das últimas semanas (dados do app)
- Nível de experiência para evitar overtraining inicial

### 2.2 Volume por Nível de Treino

O volume semanal total de séries por grupo muscular segue a escala validada pela prática clínica:

| Nível | Volume Semanal (séries/grupo) | Critério de Classificação |
|---|---|---|
| Iniciante | 10–12 séries / grupo muscular | Menos de 1 ano de treino consistente |
| Intermediário | 12–15 séries / grupo muscular | 1–3 anos de treino consistente |
| Avançado | 15–20 séries / grupo muscular | Mais de 3 anos + boa técnica consolidada |

> **Regra de ouro do volume**
> A IA deve sempre iniciar no limite inferior da faixa e só progredir após 2 semanas sem sinais de fadiga excessiva. Melhor errar para menos volume do que para mais — o erro mais comum no mercado é exagerar na quantidade.

### 2.3 Estrutura do Programa por Frequência

| Dias/Semana | Estrutura Recomendada | Justificativa |
|---|---|---|
| 2 dias | Full Body A / Full Body B | Frequência por grupo é 2x/semana — ideal para iniciantes |
| 3 dias | Full Body A / B / C | Máxima frequência por grupo com poucos dias disponíveis |
| 4 dias | Upper/Lower ou Push-Pull-Legs adaptado | Começa a dividir grupos sem perder frequência |
| 5 dias | PPL + 2 complementares ou Split focado | Maior volume total com menor overlap de grupos |
| 6 dias | Upper/Lower alternado ou PPL completo | Somente para intermediários e avançados |

### 2.4 Periodização Linear (Modelo Base)

O modelo padrão do Kinevo usa periodização linear simples: progressão de carga ou volume a cada semana dentro de um bloco de 4 semanas. Ao final do bloco, o programa pode ser reciclado com novos exercícios ou o bloco é repetido com cargas ajustadas.

| Semana | Foco | Ação da IA | Gatilho de Progressão |
|---|---|---|---|
| Semana 1 | Adaptação técnica | Volume no limite inferior da faixa | Nenhum — semana de calibragem |
| Semana 2 | Consolidação | Aumenta 1–2 séries se aderência > 80% | Aderência + ausência de queixa |
| Semana 3 | Sobrecarga progressiva | Sugere aumento de carga (+2,5–5kg) | Aluno completou todas as séries/reps |
| Semana 4 | Deload ou teste | Reduz 20% do volume ou mantém para teste de carga máxima | Automático ao fim do bloco |

### 2.5 Erros a Evitar (Restrições da IA)

A IA deve ser programada para **nunca** gerar programas que cometam estes erros:

- Excesso de exercícios de isolamento para iniciantes (ex: rosca concentrada como exercício principal)
- Volume acima da faixa máxima do nível do aluno na primeira semana
- Mais de 2 exercícios por grupo muscular pequeno (bíceps, tríceps) para iniciantes
- Intervalos de descanso inferiores a 60 segundos para exercícios compostos pesados
- Ausência de exercícios compostos principais (agachamento, supino, remada, terra) como base do programa
- Progressão de carga sem confirmação de que o aluno completou as séries prescritas

---

## 3. Fluxo de Prescrição Adaptativo

> *"Depende do tipo de aluno"* — como a IA decide o modo de operação

A resposta mais importante do fundador foi que o nível de autonomia da IA depende do tipo de aluno. Isso significa que o sistema não tem um único modo de operação — ele calibra a si mesmo com base no perfil de quem vai receber o programa.

### 3.1 Modos de Operação da IA

#### Modo 1 — Piloto Automático (Aluno Novo ou Iniciante)

Para alunos com menos de 6 meses de histórico no app ou classificados como iniciantes na anamnese, a IA gera o programa completo e o envia diretamente após aprovação do treinador. O treinador não precisa mexer em nada — apenas revisar e clicar em "Enviar".

> **Critérios de ativação do Modo 1**
> - Nível = Iniciante (< 1 ano de treino consistente)
> - Menos de 4 semanas de histórico de execução no app
> - Treinador marcou aluno como "prescrição padrão" nas configurações
> - Aluno não tem restrições médicas complexas registradas

#### Modo 2 — Copiloto (Aluno Intermediário com Histórico)

Para alunos com histórico de 6+ semanas no app, a IA gera o programa e destaca as decisões não-óbvias com justificativas. O treinador revisa, ajusta o que quiser, e envia. A IA aprende com as edições do treinador para calibrar melhor as próximas prescrições desse aluno.

> **Critérios de ativação do Modo 2**
> - Nível = Intermediário
> - 6+ semanas de histórico de execução no app
> - Treinador tem preferência de revisão antes do envio (configurável)
> - Aluno com restrições médicas simples (ex: dor no joelho — evitar leg press)

#### Modo 3 — Assistente (Aluno Avançado ou Caso Especial)

Para alunos avançados, atletas, ou alunos com histórico médico complexo, a IA age como um assistente de pesquisa: apresenta opções de estrutura, sugere exercícios com dados de execução do aluno, e deixa o treinador compor o programa.

> **Critérios de ativação do Modo 3**
> - Nível = Avançado (3+ anos de treino)
> - Atleta competitivo ou com objetivo muito específico
> - Restrições médicas complexas (lesões, condições crônicas)
> - Treinador marcou aluno como "prescrição manual" nas configurações

### 3.2 Fluxo Completo de uma Nova Prescrição

| Etapa | O que acontece |
|---|---|
| 1. Treinador abre "Nova Prescrição" | Sistema carrega perfil completo do aluno: nível, histórico, preferências, restrições, aderência |
| 2. IA determina o Modo de Operação | Analisa os critérios dos 3 modos e seleciona automaticamente |
| 3. IA gera proposta de programa | Monta estrutura de dias, grupos musculares, exercícios e volumes conforme metodologia Kinevo |
| 4. Painel de revisão do treinador | Exibe programa com destaques: decisões automáticas, pontos de atenção, sugestões de ajuste |
| 5. Treinador revisa / ajusta / aprova | Modo 1: revisão rápida (30s). Modo 2: edição assistida. Modo 3: composição guiada |
| 6. Envio ao aluno | Programa publicado no app mobile do aluno com notificação push |
| 7. Feedback loop | App coleta dados de execução e a IA usa para calibrar a próxima prescrição |

---

## 4. Funcionalidades Detalhadas

### 4.1 Anamnese Inteligente (Input Foundation)

Toda prescrição começa com dados. O módulo usa uma anamnese estruturada que alimenta a IA com as variáveis necessárias. Esta anamnese é preenchida uma vez e atualizada automaticamente com dados do app.

**Campos da Anamnese Inicial (Preenchimento Único)**

| Campo | Propósito para a IA |
|---|---|
| Objetivo principal (hipertrofia / emagrecimento / performance / saúde) | Define seleção de exercícios e faixa de repetições |
| Dias disponíveis e duração de cada sessão | Determina estrutura do programa (Full Body, Split, etc.) |
| Equipamentos disponíveis (academia / home gym / ao ar livre) | Filtra biblioteca de exercícios |
| Nível de treino autodeclarado + validação pelo treinador | Define volume e complexidade dos exercícios |
| Exercícios favoritos e que odeia | Aumenta aderência — preferência do aluno tem peso alto |
| Restrições médicas e lesões ativas | Ativa flags de substituição automática de exercícios |
| Disponibilidade de aquecimento / volta à calma | Ajusta tempo de sessão e rotinas complementares |

**Campos Atualizados Automaticamente pelo App**

- Taxa de aderência semanal (% de treinos realizados)
- Histórico de cargas por exercício (detecta platôs e progressões)
- Feedback do aluno após cada sessão (emojis de fadiga e satisfação)
- Tempo médio real de sessão (vs. tempo prescrito)
- Exercícios com maior e menor taxa de conclusão de séries

### 4.2 Motor de Geração de Programas

O núcleo técnico do módulo. Recebe os dados da anamnese + histórico e produz uma proposta de programa estruturada, seguindo estritamente a metodologia Kinevo.

**Algoritmo de Seleção de Exercícios**

1. Filtrar biblioteca pelo equipamento disponível do aluno
2. Remover exercícios com flags de restrição médica ativa
3. Priorizar exercícios compostos principais como base de cada dia
4. Adicionar exercícios preferidos do aluno quando tecnicamente apropriados
5. Completar volume com acessórios conforme nível — mínimo de isolados para iniciantes
6. Validar que nenhum grupo muscular secundário ultrapassa o volume máximo do nível

**Regras de Volume e Progressão Automáticas**

| Variável | Regra | Fonte de dados |
|---|---|---|
| Volume inicial | Limite inferior da faixa do nível (ex: 10 séries para iniciante) | Nível da anamnese |
| Progressão de série | Adiciona +1 série se aderência > 80% na semana anterior | Log do app |
| Progressão de carga | Sugere +2,5kg quando aluno completa todas as séries/reps por 2 semanas | Log de cargas |
| Deload automático | Reduz 20% do volume na semana 4 do bloco ou se fadiga elevada por 3+ dias | Feedback de fadiga |
| Substituição de exercício | Sugere troca se taxa de conclusão < 60% por 2 semanas seguidas | Log de execução |

### 4.3 Painel de Revisão do Treinador

A interface onde o treinador revisa, ajusta e aprova o programa gerado pela IA. Projetada para ser rápida no Modo 1 e informativa no Modo 2/3.

**Elementos do Painel**

- Visão geral do programa: resumo de dias, grupos musculares, volume total por grupo
- Cards de exercício editáveis: nome, séries, repetições, descanso, carga sugerida, notas
- Sinalizadores de atenção: pontos onde a IA tomou decisões não-óbvias
- Histórico rápido: últimos 2 programas do aluno lado a lado para comparação
- Botão "Regenerar seção": permite pedir à IA que refaça apenas um dia ou grupo muscular
- Notas do treinador: campo para adicionar orientações personalizadas ao aluno
- Preview mobile: visualização de como o aluno verá o programa no app

### 4.4 Feedback Loop e Aprendizado Contínuo

| Evento capturado | Como a IA usa esse dado |
|---|---|
| Treinador edita exercício gerado pela IA | Registra a preferência e pondera menos esse exercício no futuro |
| Aluno pula série de um exercício consistentemente | Sinaliza candidato a substituição na próxima revisão |
| Aluno registra fadiga alta 3+ dias seguidos | IA sugere deload na próxima semana |
| Aluno completa 100% das séries por 2 semanas | IA sinaliza *ready to progress* no próximo acesso do treinador |
| Carga não aumenta por 3 semanas | IA sinaliza platô e sugere variação de exercício ou técnica |
| Aluno falta 2+ treinos seguidos | Notificação proativa ao treinador: "João não treina há 8 dias" |

---

## 5. Requisitos Técnicos

### 5.1 Arquitetura do Módulo

O módulo de prescrição inteligente se integra à arquitetura existente do Kinevo (Supabase + Next.js + Expo) sem exigir mudança de stack. A IA é implementada via OpenAI API (já existente no projeto) com um sistema de prompts estruturados que encapsulam a metodologia do fundador.

> ⚠️ **Decisão de arquitetura crítica**
> A metodologia Kinevo **NÃO** deve estar apenas no prompt de sistema da OpenAI. Ela deve ser codificada como regras de negócio no backend (TypeScript) que pré-processam e pós-processam a saída da IA. Isso garante: (1) controle sobre erros da IA, (2) consistência mesmo se o modelo mudar, (3) propriedade intelectual protegida.

**Stack e Integrações**

| Componente | Tecnologia / Abordagem |
|---|---|
| Backend de regras (metodologia Kinevo) | TypeScript puro — lógica separada da IA |
| Motor de IA (geração de texto e seleção) | OpenAI GPT-4o via actions (já existente) |
| Banco de dados de exercícios | Supabase — tabela `exercises` com tags de equipamento, grupo muscular, nível |
| Histórico de execução | Supabase — tabela `workout_logs` (já existente no fluxo mobile) |
| Notificações proativas | Supabase Edge Functions + Expo Push Notifications |
| Estado do programa ativo | Supabase — tabela `programs` com versionamento por ciclo de 4 semanas |
| Painel web do treinador | Next.js — nova rota `/programs/[studentId]/prescribe` |

### 5.2 Schema de Dados (Novas Tabelas Supabase)

**Tabela: `student_profiles` (extensão do perfil existente)**

| Campo | Tipo | Descrição |
|---|---|---|
| `training_level` | enum (beginner/intermediate/advanced) | Nível validado pelo treinador |
| `goal` | enum (hypertrophy/weight_loss/performance/health) | Objetivo principal |
| `available_days` | int[] | Array de dias da semana disponíveis (0=Dom, 6=Sab) |
| `session_duration_min` | int | Duração média de sessão em minutos |
| `equipment` | text[] | Equipamentos disponíveis |
| `favorite_exercises` | uuid[] | FK para tabela exercises |
| `disliked_exercises` | uuid[] | Exercícios a evitar por preferência |
| `medical_restrictions` | jsonb | Restrições médicas com exercícios afetados |
| `ai_mode` | enum (auto/copilot/assistant) | Modo de operação da IA |
| `adherence_rate` | float | Taxa de aderência — atualizada semanalmente |

**Tabela: `programs`**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `student_id` | uuid | FK para users |
| `trainer_id` | uuid | FK para users |
| `cycle_week` | int (1–4) | Semana dentro do bloco de periodização |
| `ai_generated_at` | timestamp | Quando a IA gerou a proposta inicial |
| `trainer_approved_at` | timestamp | Quando o treinador aprovou e enviou |
| `ai_mode_used` | enum | Qual modo foi usado na geração |
| `trainer_edits_count` | int | Quantas edições o treinador fez |
| `status` | enum (draft/active/completed) | Status do programa |

### 5.3 Prompt de Sistema (Estrutura)

O prompt de sistema da OpenAI deve ser tratado como código — versionado, testado e mantido.

> **Estrutura do Prompt de Sistema**
> - **Seção 1 — Identidade:** "Você é o motor de prescrição do Kinevo, desenvolvido com a metodologia do Prof. Gustavo..."
> - **Seção 2 — Regras de volume:** transcrição exata das regras da Seção 2 deste PRD como constraints
> - **Seção 3 — Estrutura de output:** JSON schema fixo que a IA deve retornar (nunca texto livre)
> - **Seção 4 — Restrições absolutas:** lista de erros que a IA jamais pode cometer (Seção 2.5 deste PRD)
> - **Seção 5 — Contexto do aluno:** injetado dinamicamente via template com dados do Supabase

---

## 6. Métricas de Sucesso

### 6.1 Métricas Primárias (North Star)

| Métrica | Meta em 90 dias | Como medir |
|---|---|---|
| Tempo médio de prescrição | < 5 minutos (vs. 30–90 min atual) | Timestamp: abertura → aprovação no painel |
| Taxa de aceitação sem edições (Modo 1) | > 70% dos programas aprovados sem alteração | (programs sem edições) / total no Modo 1 |
| Taxa de edições mínimas (Modo 2) | < 3 edições por programa em média | `trainer_edits_count` na tabela programs |
| NPS do treinador com o módulo | > 50 | Pesquisa in-app após 3ª prescrição via módulo |

### 6.2 Métricas Secundárias (Saúde do Produto)

| Métrica | Meta | Significado |
|---|---|---|
| Aderência do aluno (antes vs. depois) | +15% vs. período sem o módulo | Programas mais personalizados = mais seguidos |
| Churn de treinadores | < 5% ao mês | O módulo cria lock-in — difícil migrar com todo o histórico |
| Capacidade de alunos por treinador | +30% em 6 meses | Treinador atende mais porque prescreve mais rápido |
| Programas gerados por treinador/mês | > 95% via módulo IA (vs. manual) | Adoção do módulo como fluxo padrão |

### 6.3 Critérios de Qualidade da IA

Antes de lançar o módulo para usuários reais, a IA deve ser validada internamente:

- 100% dos programas gerados dentro da faixa de volume correta para o nível do aluno
- 0% de programas com exercícios bloqueados por restrição médica ativa
- > 90% dos programas com pelo menos 1 exercício composto principal por dia de treino
- O fundador (Gustavo) avalia 30 programas gerados e classifica > 80% como "aprovaria sem edição"

---

## 7. Roadmap de Implementação

### Fase 1 — Foundation (Semanas 1–3)

> **Objetivo:** MVP funcionando para o treinador testar internamente
> **Entrega:** Anamnese básica + Geração pelo Modo 2 (copiloto) + Painel de revisão simples
> **Por que essa ordem:** O Modo 2 é o mais seguro para validar — a IA sugere, o treinador valida. Zero risco de programa ruim chegar ao aluno.

| Tarefa | Estimativa |
|---|---|
| Schema de banco: tabelas `student_profiles` e `programs` no Supabase | 2 dias |
| Migração SQL + tipos compartilhados `@kinevo/shared` | 1 dia |
| Backend: lógica de regras de metodologia (TypeScript, sem IA) | 3 dias |
| Integração OpenAI: prompt de sistema v1 + output JSON estruturado | 2 dias |
| Rota Next.js: `/programs/[studentId]/prescribe` — painel de revisão básico | 4 dias |
| Testes internos: 10 programas gerados e validados pelo fundador | 2 dias |

### Fase 2 — Modos Adaptativos (Semanas 4–6)

> **Objetivo:** Implementar os 3 modos de operação e o feedback loop básico
> **Entrega:** Modo 1 (auto) + Modo 3 (assistente) + captura de edições do treinador
> **Por que agora:** Com o Modo 2 validado, expandir para os extremos com dados reais.

| Tarefa | Estimativa |
|---|---|
| Lógica de seleção de modo (Modo 1 / 2 / 3) baseada em perfil do aluno | 2 dias |
| UI do Modo 1: fluxo de revisão rápida (< 30s para aprovar) | 2 dias |
| UI do Modo 3: painel de composição guiada com insights da IA | 3 dias |
| Captura de edições do treinador (`trainer_edits_count` + diff de exercícios) | 2 dias |
| Notificação proativa: aluno sem treinar por X dias | 1 dia |
| Testes com 2–3 treinadores beta (feedback qualitativo) | 1 semana |

### Fase 3 — Inteligência Progressiva (Semanas 7–10)

> **Objetivo:** O sistema aprende e melhora com o uso — diferencial competitivo de longo prazo
> **Entrega:** Progressão automática, detecção de platô, relatório de evolução para o aluno
> **Por que por último:** Requer dados históricos acumulados nas fases anteriores.

| Tarefa | Estimativa |
|---|---|
| Engine de progressão automática: carga, volume, deload por regras + IA | 4 dias |
| Detecção de platô: alerta ao treinador quando aluno estagna por 3+ semanas | 2 dias |
| Relatório mensal de evolução automático para o aluno (PDF ou in-app) | 3 dias |
| Refinamento de prompt com base nas edições coletadas na Fase 2 | 2 dias |
| Dashboard do treinador: visão de todos os alunos com status de programa | 3 dias |
| Launch público do módulo — comunicação e onboarding | 1 semana |

### 7.1 Dependências e Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| IA gera programa fora da metodologia Kinevo | Média | Regras de negócio em TypeScript validam o output antes de exibir ao treinador |
| Treinador não confia na IA e edita tudo | Média | Iniciar pelo Modo 2 — posicionar como assistente, não substituto |
| Custo de API OpenAI escala com volume | Baixa | Cache de programas similares + limitar chamadas de IA por operação |
| Biblioteca de exercícios incompleta | Alta | Fase 1 inclui curadoria mínima de 100 exercícios com tags completas |
| Alunos com casos médicos complexos recebem programa inadequado | Baixa | Modo 3 obrigatório para qualquer aluno com flags médicas críticas |

---

## 8. Por Que Isso É Impossível de Copiar

Qualquer empresa pode integrar a OpenAI à sua plataforma de treino. Mas nenhuma pode replicar o seguinte:

### 8.1 A Metodologia Como Vantagem Estrutural

A lógica de prescrição do Kinevo não é um prompt de ChatGPT — é um conjunto de regras validadas por anos de prática clínica do fundador, codificadas como lógica de negócio e refinadas continuamente com dados reais de aderência.

| Camada | Vantagem | Tempo para concorrente replicar |
|---|---|---|
| Metodologia documentada | Regras claras de volume, estrutura e progressão | 3–6 meses (se souberem o que copiar) |
| Dados de aderência reais | Quais exercícios alunos brasileiros realmente fazem | 12–24 meses (requer escala de usuários) |
| Feedback loop de treinadores | A IA melhora com cada edição de cada treinador | Impossível sem a mesma base de usuários |

### 8.2 O Efeito de Rede Invisível

Cada prescrição aprovada ou editada pelo treinador é um sinal de aprendizado. Quanto mais treinadores usam o Kinevo, mais a IA aprende os padrões de prescrição que funcionam. Um concorrente que entrar depois começa do zero — o Kinevo já terá meses ou anos de dados de qualidade real.

### 8.3 O Lock-in do Histórico

Um treinador que usa o módulo por 6 meses tem todo o histórico de seus alunos dentro do Kinevo: programas anteriores, progressão de cargas, padrões de aderência, restrições médicas. Migrar para outro sistema significa perder tudo isso.

---

> **Resumo Executivo**
> - **Problema:** prescrição manual consome 30h/mês do treinador e trava seu crescimento
> - **Solução:** IA que aprende a metodologia do treinador e gera programas em < 5 minutos
> - **Diferencial:** 3 modos adaptativos + aprendizado contínuo com dados reais de aderência
> - **Resultado esperado:** treinador atende 2–3x mais alunos sem perder qualidade de prescrição
> - **Prazo:** MVP funcionando em 3 semanas, módulo completo em 10 semanas
> - **Fosso competitivo:** metodologia proprietária + dados de aderência + histórico de alunos

---

*⚡ Kinevo — Transformando expertise em escala | PRD v1.0 | Fevereiro 2026 | Confidencial*
