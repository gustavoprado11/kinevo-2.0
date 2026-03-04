# Kinevo Mobile — Análise de Viabilidade: Funcionalidades do Treinador no App

## 0. Estratégia de Branching e Controle de Risco

### OBRIGATÓRIO: Todo o trabalho deve ser feito em branch exclusiva

Antes de qualquer alteração no código, crie uma branch dedicada a partir da `main` (ou branch principal do projeto):

```bash
git checkout main
git pull origin main
git checkout -b feature/mobile-trainer-mode
```

**Regras de branching:**

1. **Nunca commite direto na main.** Todo o trabalho desta feature acontece em `feature/mobile-trainer-mode`.
2. **Commits atômicos e descritivos.** Cada commit deve representar uma unidade lógica completa (ex: "feat: add role switcher component", "feat: trainer dashboard with KPIs"). Isso facilita reverter mudanças específicas se algo der errado.
3. **Não misture correções de bugs existentes com código novo.** Se encontrar bugs no código atual durante a implementação, corrija-os em commits separados e claramente identificados (ex: "fix: RLS policy missing student_id filter").
4. **Teste antes de cada commit.** Garanta que o app compila e roda sem erros antes de commitar. Não acumule código quebrado na branch.
5. **Mantenha a branch atualizada com a main.** Periodicamente faça rebase ou merge da main para evitar conflitos grandes:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
6. **Organize sub-branches se necessário.** Para fases independentes, considere criar sub-branches (ex: `feature/mobile-trainer-mode/sala-de-treino`) e mergear de volta na branch principal da feature antes de ir para a main.

**Fluxo de merge para produção:**
```
feature/mobile-trainer-mode → Pull Request com review → main
```

O merge na main só acontece após validação completa. Isso protege a base de código atual e permite que o app dos alunos continue funcionando normalmente durante todo o desenvolvimento.

---

## 1. Visão Geral da Estratégia

### Princípio fundamental: Paridade de informações com a web

Todas as telas do modo treinador no mobile devem exibir **as mesmas informações** que suas equivalentes no sistema web. O layout será adaptado para tela mobile (cards em vez de tabelas, por exemplo), mas os **dados** devem ser idênticos. Isso garante que o treinador tenha familiaridade imediata com o app e não sinta que está usando uma versão inferior.

**Regra para o Claude Code:** Antes de implementar qualquer tela do modo treinador, analise a tela equivalente no sistema web e identifique **todos os campos e dados** que ela exibe. A versão mobile deve conter os mesmos campos. Se a tela web tem colunas em uma tabela, o mobile deve ter os mesmos dados organizados em cards ou listas — sem omitir nenhum campo.

---

### Modelo de acesso: Login Dual com Role Switcher

O treinador faz login normalmente no app. Ao detectar que o usuário tem `role = 'trainer'` (ou equivalente), o app exibe um **seletor de contexto** que permite alternar entre:

- **Modo Aluno:** Experiência atual completa (treinos, inbox, histórico, perfil)
- **Modo Treinador:** Nova experiência com tab bar dedicada

Esse modelo é superior a duas apps separadas porque o treinador frequentemente é também aluno (testa seus próprios treinos), reduz fricção de login, e unifica a base de código.

**Implementação sugerida:** Tela de seleção após login (estilo Apple — cards com ícone + label para cada modo), com persistência da última escolha no SecureStore. Toggle rápido acessível via long-press no avatar ou nas configurações.

---

## 2. Estratégia Financeira: Assinatura Kinevo e Stripe Connect

### 2.1 Assinatura do Kinevo (treinador paga para usar a plataforma)

| Aspecto | Decisão | Justificativa |
|---------|---------|---------------|
| Onde assinar | **Somente via web** | Evita taxa de 30% da Apple/Google |
| O que mostrar no app | Status da assinatura, plano atual, data de renovação | Informativo, sem ação de compra |
| Upgrade/downgrade | **Redirecionar para web** (deep link ou Safari) | Permitido pelas políticas atuais da Apple (pós-2022) |
| Assinatura bloqueada | Tela de bloqueio no modo treinador com CTA para web | Já existe padrão similar para aluno |

**Atenção com as regras da Apple:** Desde as mudanças pós-processo Epic vs Apple, apps podem informar sobre opções de compra fora do app. Porém, a Apple ainda não permite processar pagamento diretamente via link externo dentro do app sem usar o sistema IAP em algumas categorias. Como o Kinevo é uma ferramenta SaaS B2B (treinador é o negócio, não o consumidor final), o modelo de assinatura via web é seguro — apps como Notion, Slack e Figma fazem o mesmo.

### 2.2 Stripe Connect (treinador recebe dos alunos)

Isso **não é** uma compra in-app — é uma ferramenta de gestão financeira do negócio do treinador. Portanto, não se aplica a política de IAP da Apple.

| Funcionalidade | No App? | Detalhes |
|----------------|---------|----------|
| Dashboard financeiro (MRR, status) | Sim | Leitura de dados, sem risco regulatório |
| Lista de contratos/assinaturas | Sim | Visualização e filtros |
| Marcar pagamento manual como pago | Sim | Ação simples, sem processamento de pagamento Apple |
| Histórico de transações | Sim | Timeline de eventos |
| Gerar link de checkout Stripe | Sim | O link abre no browser do aluno, não no app do treinador |
| Onboarding Stripe Connect | **Web only** | Verificação de identidade + vinculação bancária = complexo demais para WebView |
| Criar/editar planos | **Web only** | Operação rara, interface complexa |
| Configurar billing avançado | **Web only** | Melhor UX no desktop |

**Resumo:** O app mostra o panorama financeiro e permite ações rápidas do dia-a-dia. Operações de configuração e setup ficam na web.

---

## 3. Roadmap de Implementação por Fases

### Fase 1 — Fundação (4-6 semanas)

Objetivo: Infraestrutura do modo treinador + funcionalidades de consulta rápida.

#### 1.1 Role Switcher e Navegação
- Detecção de role no login (query ao perfil do usuário)
- Tela de seleção de modo (Aluno vs Treinador)
- Tab bar do treinador com 4-5 tabs (Dashboard, Alunos, Sala de Treino, Mais)
- Persistência da última escolha
- Toggle rápido entre modos

**Complexidade: Média**
**Dependências: Nenhuma externa — o role já existe no Supabase**

#### 1.2 Dashboard do Treinador (leitura)
- **Analisar a tela `/dashboard` no web e replicar todos os dados:**
  - KPIs: alunos ativos, sessões da semana, MRR, aderência média
  - Feed de atividade diária (treinos concluídos, formulários enviados)
  - Ações pendentes: pagamentos atrasados, formulários pendentes, alunos inativos
  - Programas expirando (alerta)
  - Sparkline de sessões/dia (adaptar para mobile — mini gráfico ou resumo numérico)
- **Referência:** Analisar componentes `stat-cards.tsx`, `pending-actions.tsx`, `daily-activity-feed.tsx`, `expiring-programs.tsx`

**Complexidade: Média**
**Dependências: Provavelmente precisa de 1-2 RPCs novas ou adaptar as existentes para não depender de server actions/cookies**

#### 1.3 Lista de Alunos
- Lista com busca e filtros (ativo/inativo, modalidade)
- **Cada card de aluno deve exibir os mesmos campos da tabela web:**
  - Nome + avatar
  - Modalidade (Online, Presencial, etc.)
  - Programa ativo (nome do programa ou "—" se nenhum)
  - Semana atual do programa (ex: "1/5", "3/8" ou "—")
  - Último treino (ex: "Ontem", "há 5 dias", "Nunca")
  - Status (Ativo, Inativo — badge colorido)
- Tap → navega para perfil do aluno
- **Referência:** Analisar `students` page no web para garantir que nenhum campo fique de fora

**Complexidade: Média**
**Dependências: A query de alunos provavelmente já existe via Supabase client. Verificar se a query web inclui campos calculados (semana, último treino) que precisem de RPC ou lógica adicional.**

---

### Fase 2 — Operação Presencial (3-4 semanas)

Objetivo: O treinador consegue dar aulas presenciais usando só o celular.

#### 2.1 Sala de Treino Mobile
- **Analisar a tela `/training-room` no web e replicar toda a funcionalidade, incluindo sessões múltiplas simultâneas:**
  - Adicionar aluno à sessão (picker com busca + treino do dia)
  - **Múltiplos alunos simultâneos:** O treinador pode adicionar mais de um aluno à sessão, assim como na web. Isso é essencial para treinadores que acompanham 2-4 alunos ao mesmo tempo em aulas presenciais ou turmas pequenas.
  - **Navegação entre alunos:** Implementar um seletor de aluno ativo no topo da tela (tabs horizontais com nome/avatar ou swipe entre alunos). O treinador vê o treino de um aluno por vez, mas alterna rapidamente entre eles. Referência de UX: padrão de tabs do Apple Messages ou Safari (tabs de abas).
  - **Estado independente por aluno:** Cada aluno mantém seu próprio progresso (sets completados, peso registrado, timer). Trocar de aluno não perde o progresso do anterior.
  - **Indicador visual de progresso por aluno:** No seletor de alunos, mostrar um indicador de quantos sets/exercícios cada aluno já completou (ex: badge "3/12" ou barra de progresso mini), para o treinador saber de relance quem precisa de atenção.
  - Acompanhar sets: peso, reps, checkbox — mesmos campos que a web
  - Timer de descanso (independente por aluno)
  - Supersets agrupados (já implementado na tela do aluno — reutilizar)
  - Notas do treinador visíveis (já implementado — reutilizar)
  - Troca de exercício com sugestões
  - Feedback pós-treino (RPE) — coletado individualmente por aluno ao finalizar
  - Finalizar sessão — pode finalizar um aluno individualmente (se terminou antes) ou todos de uma vez
  - **Limite sugerido:** 4-6 alunos simultâneos no mobile (tela pequena). Se o treinador tentar adicionar mais, avisar que para turmas grandes a web é mais adequada.
- **Referência:** Analisar `training-room-store.ts` (Zustand com estado por aluno), `exercise-card.tsx`, `superset-group.tsx`, `student-picker-modal.tsx`

**Complexidade: Alta**
**Nota estratégica:** Esta é a funcionalidade de maior impacto para treinadores presenciais. O principal caso de uso é: treinador está na academia, celular no bolso, acompanha o aluno sem precisar de notebook. Se priorizar bem, pode entregar uma V1 funcional com sessão única + tracking de sets + timer em 2-3 semanas, e iterar depois.

**Reutilização:** Muitos componentes da tela de execução do aluno podem ser reaproveitados (ExerciseCard, SupersetGroup, TrainerNote, RestTimer). A diferença principal é que o treinador controla a sessão de outro usuário.

#### 2.2 Perfil Simplificado do Aluno
- Programa ativo com resumo
- Aderência (%) e streak
- Últimas 5 sessões com resumo
- Botão "Iniciar Sala de Treino" direto do perfil
- Link para histórico completo (pode ser web inicialmente)

**Complexidade: Média**

---

### Fase 3 — Gestão Remota (3-4 semanas)

Objetivo: O treinador consegue gerenciar alunos remotos pelo celular.

#### 3.1 Formulários — Enviar e Revisar
- **Analisar as telas `/forms` e `/forms/templates` no web e replicar os dados:**
  - Listar templates de formulário existentes (com mesmos metadados da web)
  - Atribuir formulário a aluno(s) (seleção múltipla + prazo + mensagem)
  - Ver respostas recebidas (lista tipo inbox — mesmos campos: aluno, formulário, data, status)
  - Detalhe da resposta (perguntas + respostas + fotos com zoom)
  - Enviar feedback ao aluno
- **Referência:** Analisar `assign-form-modal.tsx`, `submission-detail-sheet.tsx`

**Complexidade: Média**
**Nota:** Criar templates de formulário fica na web (alta complexidade, UX de builder). O mobile foca em enviar e revisar.

#### 3.2 Atribuir Programa ao Aluno
- Selecionar programa existente (lista de templates)
- Definir data de início
- Confirmar atribuição
- Visualizar resumo do programa (sem editar)

**Complexidade: Média**
**Nota:** O Program Builder completo (drag-and-drop, criar treinos do zero) fica na web. No mobile, o treinador apenas atribui programas já criados.

#### 3.3 Prescrição com IA (simplificada)
- Preencher perfil de prescrição do aluno (nível, objetivo, equipamento, restrições)
- Disparar geração
- Preview do programa gerado
- Aprovar ou rejeitar
- Se aprovar, já atribui ao aluno

**Complexidade: Alta (mas o backend pesado já existe)**
**Nota:** A maior parte da complexidade está no backend/IA que já funciona. O mobile precisa apenas de um wizard de input + tela de preview + ações de aprovar/rejeitar.

---

### Fase 4 — Financeiro no Mobile (2-3 semanas)

Objetivo: Treinador acompanha receita e gerencia cobranças básicas pelo celular.

#### 4.1 Dashboard Financeiro
- **Analisar a tela `/financial` no web e replicar todos os dados:**
  - MRR atual
  - Contagem por status (ativo, vencido, cancelado)
  - Transações recentes (últimos 30 dias — mesmos campos: aluno, valor, status, data)

#### 4.2 Gestão de Contratos (leitura + ações rápidas)
- **Analisar `/financial/subscriptions` no web e replicar os dados:**
  - Lista de contratos com mesmos campos: aluno, plano, tipo de cobrança, valor, status, próximo vencimento
  - Detalhe do contrato (timeline de eventos — mesma timeline da web)
  - Marcar pagamento manual como pago
  - Gerar e compartilhar link de checkout Stripe (via share sheet nativo)
- **Referência:** Analisar `new-subscription-modal.tsx`, `contract-detail-modal.tsx`

#### 4.3 Status da Assinatura Kinevo
- Plano atual, data de renovação
- CTA "Gerenciar assinatura" → abre Safari na página de billing

**Complexidade: Média**
**O que NÃO entra no app:** Criar planos, onboarding Stripe Connect, configurar billing avançado.

---

### Fase 5 — Refinamentos (ongoing)

- Calendário de treinos do aluno (heatmap) — complexo mas de alto valor
- Histórico completo de sessões com drill-down
- Notificações push para o treinador (pagamento recebido, formulário respondido, treino concluído)
- Biblioteca de exercícios (consulta, não CRUD completo)

---

## 4. Decisões Arquiteturais Recomendadas

### 4.1 Server Actions vs RPCs

O web usa Next.js Server Actions que dependem de cookies de sessão. O mobile usa Supabase client direto. Para as funcionalidades do treinador no mobile, há duas opções:

| Opção | Prós | Contras |
|-------|------|---------|
| **RPCs dedicadas para mobile** | Performance, controle granular, não depende de server actions | Duplicação de lógica, manutenção de 2 caminhos |
| **API Routes Next.js com auth por token** | Reutiliza lógica existente, single source of truth | Latência extra (mobile → Next.js → Supabase), mais infraestrutura |

**Recomendação:** Para funcionalidades simples (listar alunos, ver dashboard), usar Supabase client direto com RLS — é o que o mobile já faz. Para operações complexas (atribuir programa, finalizar sessão da Sala de Treino), criar RPCs no Supabase que encapsulam a lógica — isso é mais robusto que chamar API routes.

### 4.2 Navegação do Treinador

```
Tab Bar (modo treinador):
├── Dashboard     → KPIs, ações pendentes, feed
├── Alunos        → Lista → Perfil → Sala de Treino
├── Formulários   → Templates → Atribuir → Respostas
├── Financeiro    → Dashboard → Contratos
└── Mais          → Configurações, switch para modo aluno, assinatura
```

### 4.3 Componentes Reutilizáveis

Componentes que já existem no mobile (modo aluno) e podem ser reaproveitados no modo treinador:

- ExerciseCard → Sala de Treino
- SupersetGroup → Sala de Treino
- TrainerNote / WorkoutNoteCard → Sala de Treino
- RestTimer → Sala de Treino
- FormResponseView → Formulários (já existe na inbox do aluno)

Componentes novos necessários:
- RoleSwitcher (seleção de modo)
- StatCard (KPI do dashboard)
- StudentCard (card na lista de alunos)
- ContractCard (card na lista de contratos)
- StudentPicker (seletor de aluno para Sala de Treino e formulários)

---

## 5. O que fica exclusivo na Web (não portar)

| Funcionalidade | Motivo |
|----------------|--------|
| Program Builder (drag-and-drop) | UX incompatível com touch em tela pequena. Mantém como diferencial da web. |
| Criador de templates de formulário | Builder visual complexo, melhor no desktop. |
| Onboarding Stripe Connect | Fluxo de verificação da Stripe, funciona melhor no browser. |
| Gestão de planos financeiros | Operação rara, interface com muitos campos. |
| Biblioteca de exercícios (CRUD) | Cadastro com vídeo, instruções, taxonomia — melhor no desktop. |
| Configurações avançadas de billing | Complexidade de UI sem benefício mobile. |
| Landing page | Não se aplica. |

---

## 6. Estimativa Consolidada

| Fase | Escopo | Estimativa | Acumulado |
|------|--------|------------|-----------|
| Fase 1 | Fundação + Dashboard + Alunos | 4-6 semanas | 4-6 sem |
| Fase 2 | Sala de Treino + Perfil do Aluno | 3-4 semanas | 7-10 sem |
| Fase 3 | Formulários + Atribuir Programa + IA | 3-4 semanas | 10-14 sem |
| Fase 4 | Financeiro no Mobile | 2-3 semanas | 12-17 sem |
| Fase 5 | Refinamentos | Ongoing | — |

**MVP viável (Fases 1+2):** ~7-10 semanas para o treinador poder dar aulas presenciais e consultar dados básicos pelo celular. Esse é o ponto onde o app já tem valor real para treinadores.

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Apple rejeitar app por link externo de assinatura | Baixa (SaaS B2B é permitido) | Alto | Seguir guidelines da Apple sobre "reader apps" e external purchases. Ter fallback IAP se necessário. |
| Performance com múltiplas queries no dashboard | Média | Médio | Consolidar em 1-2 RPCs otimizadas para o dashboard |
| Sala de Treino com sessão do aluno conflitando com sessão do treinador | Média | Alto | Definir prioridade (treinador sobrescreve) ou lock de sessão |
| Treinador editar programa no mobile e quebrar prescrição | Baixa | Alto | Não permitir edição de programa no mobile — somente na web |
| RLS insuficiente para modo treinador no mobile | Média | Alto | Auditar RLS antes de implementar — treinador precisa acessar dados dos seus alunos sem ser o próprio aluno |
