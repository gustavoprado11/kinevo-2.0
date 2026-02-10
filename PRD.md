# PRD — Kinevo 2.0

## 1. Visão do Produto

O **Kinevo 2.0** é uma plataforma SaaS focada em **prescrição e execução de treinos de força**, construída para treinadores que trabalham com metodologia, evidência científica e acompanhamento de performance real.

O produto conecta **treinadores (Web)** e **alunos (App Mobile)**, garantindo que a **prescrição planejada** seja executada com o mínimo de fricção possível, ao mesmo tempo em que coleta dados confiáveis de execução (carga, repetições, descanso).

O Kinevo 2.0 nasce como uma **reconstrução limpa**, baseada em um domínio já validado, eliminando dívida técnica e priorizando clareza de regras de negócio, escalabilidade e consistência de experiência.

---

## 2. Problema que o Produto Resolve

### Para Treinadores

* Ferramentas genéricas não respeitam metodologias reais (bi-sets, notas, progressões manuais).
* Prescrição e execução se misturam, gerando perda de controle do template.
* Dificuldade de acompanhar o que o aluno realmente fez.

### Para Alunos

* Aplicativos confusos, com excesso de cliques.
* Falta de histórico claro de carga.
* Dificuldade em seguir o treino exatamente como prescrito, especialmente em ambientes de academia.

---

## 3. Objetivos do Kinevo 2.0

### Objetivos Principais

1. Ser a **melhor ferramenta de prescrição de treino de força** para treinadores.
2. Oferecer ao aluno uma **experiência de execução fluida, à prova de falhas**.
3. Garantir **integridade entre prescrição e execução**.
4. Criar uma base sólida para evolução futura (Watch, Analytics, IA), sem incluí-los no MVP.

### Métricas de Sucesso (KPIs)

* Tempo médio para prescrever um treino (Treinador).
* Taxa de conclusão de treinos (Aluno).
* Aderência semanal (treinos realizados / treinos prescritos).
* Retenção de alunos em 30 e 90 dias.

---

## 4. Público-Alvo

### Treinador (Power User)

* Profissionais de Educação Física
* Personal trainers e estúdios
* Treinadores orientados por evidência

### Aluno (Executor)

* Praticantes de musculação
* Pessoas treinando em academias comerciais
* Usuários que valorizam clareza e simplicidade

---

## 5. Escopo do Produto

### Dentro do Escopo (Kinevo 2.0)

* Prescrição de treinos (Web)
* Execução de treinos (Mobile)
* Registro de carga, reps e descanso
* Histórico de execução
* Funcionamento offline-first

### Fora do Escopo (explicitamente)

* Pagamentos e assinaturas
* Chat treinador–aluno
* Avaliações físicas
* Gamificação

---

## 6. Funcionalidades — Treinador (Web)

### 6.1 Autenticação

* Login seguro
* Perfil do treinador

### 6.2 Biblioteca de Exercícios

* Exercícios do sistema
* Exercícios personalizados do treinador
* Campos: nome, grupo muscular, mídia opcional

### 6.3 Builder de Programas (Core Feature)

#### Criação de Programas

* Nome do programa
* Duração (semanas)
* Criação de múltiplos treinos (A, B, C...)

#### Montagem do Treino

* Lista ordenável de itens
* Tipos de itens:

  * Exercício (Single)
  * Superset (container)
  * Nota

#### Parâmetros de Prescrição

* Séries
* Repetições (texto livre)
* Descanso (segundos)
* Notas técnicas

#### Operações Avançadas

* Agrupar exercícios (criar Superset)
* Desagrupar
* Reordenar itens

### 6.4 Templates e Instâncias

* Salvar programa como Template
* Atribuir programa a aluno
* Garantia de imutabilidade do template

---

## 7. Funcionalidades — Aluno (Mobile)

### 7.1 Home

* Treino do dia
* Status (pendente, concluído)

### 7.2 Player de Treino (Core Feature)

#### Preparação

* Carregar treino prescrito
* Carregar última carga usada por exercício
* Criar sessão local (offline)

#### Execução

* Lista de exercícios
* Séries com inputs de carga e reps
* Checkbox para completar série
* Supersets visualmente agrupados

#### Timer de Descanso

* Início automático ao completar série
* Opções: pular descanso, adicionar +30s

#### UX Inteligente

* Propagação automática de carga para séries futuras
* Navegação livre entre exercícios

### 7.3 Finalização

* Botão "Finalizar Treino"
* Cálculo de duração
* Sincronização com backend

---

## 8. Regras de Negócio (Resumo)

* Prescrição é imutável durante a sessão.
* Execução registra a realidade do aluno.
* Offline-first é obrigatório.
* Supersets compartilham lógica de descanso.
* O sistema nunca invalida o input do aluno.

---

## 9. Estados do Sistema (Aluno)

* Idle
* Active
* Resting
* Finished

Transições baseadas em ações explícitas do usuário.

---

## 10. Requisitos Não-Funcionais

* Performance em ambientes offline
* Sincronização resiliente
* Interface clara e rápida
* Código orientado a domínio

---

## 11. MVP — Entregáveis

### Web

* Autenticação
* Builder de programas
* Atribuição de treino

### Mobile

* Home
* Player de treino
* Registro de logs

### Backend

* CRUD de domínio
* API de sincronização

---

## 12. Riscos Conhecidos

* Complexidade de estado do treino
* Sincronização offline
* Ambiguidade entre template e instância

Mitigação: domínio bem definido e testes de lógica.

---

## 13. Visão de Futuro (não escopo)

* Apple Watch
* Live Activities
* Análises avançadas
* Prescrição assistida por IA

---

## 14. Critério de Sucesso

O Kinevo 2.0 é considerado bem-sucedido se:

* Um treinador consegue prescrever treinos complexos rapidamente
* Um aluno executa um treino inteiro sem dúvidas
* Os dados de execução refletem fielmente a realidade

---

**Documento base para desenvolvimento do Kinevo 2.0**
