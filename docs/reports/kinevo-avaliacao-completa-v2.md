# KINEVO — Relatório de Avaliação Completa V2

**Agente:** Avaliação funcional + código + banco de dados
**Data:** 23 de março de 2026
**Conta de teste:** agente.auditor.kinevo@gmail.com
**Escopo:** Criação de conta → Navegação completa → Cadastro de alunos → Prescrição IA → Edição manual → Todas as páginas + Banco de dados produção + Código-fonte (400+ arquivos)

---

## 1. Resumo Executivo

O Kinevo é uma plataforma de gestão para personal trainers que combina web app (Next.js), mobile (React Native/Expo) e integração com Apple Watch. A avaliação revelou um produto com **design profissional e funcionalidades abrangentes**, mas com **problemas críticos de onboarding, engine de IA e performance** que comprometem a experiência do trainer e a qualidade das prescrições geradas.

**Score geral: 71/100**

| Dimensão | Score | Tendência |
|---|---|---|
| Onboarding & First-Use | **45/100** | ⬇ Crítico |
| Arquitetura & Código | **82/100** | ➡ Estável |
| Engine de IA | **50/100** | ⬇ Degradado |
| UX / Interface Web | **75/100** | ➡ Bom com ressalvas |
| Performance | **62/100** | ⬇ Preocupante |
| Segurança | **80/100** | ➡ Sólido |
| Integridade de Dados | **78/100** | ➡ Bom |

---

## 2. Problemas Críticos

### 2.1 Tour de onboarding em loop infinito (CRÍTICO — UX)

**O que acontece:** O tour de onboarding ("Cadastrar Alunos", "Prescrição de Treino", "Dias de Treino", etc.) reaparece **TODA VEZ** que o usuário visita qualquer página do sistema — mesmo após clicar "Pular tour" repetidamente. Durante a avaliação, o tour apareceu **14 vezes** em diferentes páginas, bloqueando interações e forçando o trainer a fechar o tooltip antes de cada ação.

**Impacto:** Extremamente irritante para o trainer no dia a dia. Cada interação com o sistema começa com um bloqueio visual. Isso gera a impressão de um produto inacabado e pode causar abandono nos primeiros dias de uso.

**Causa raiz:** O estado "tour pulado" não é persistido. O componente de tour verifica se o trainer já completou os passos, mas clicar "Pular tour" não grava essa preferência em `localStorage`, cookie ou banco de dados. O tour é reiniciado a cada renderização de página.

**Correção sugerida:** Gravar `tour_completed_at` ou `tour_skipped_at` no registro do trainer na tabela `trainers` e verificar antes de exibir. Estimativa: 2 horas.

### 2.2 Engine de IA inacessível para novos trainers (CRÍTICO — IA/Negócio)

**O que acontece:** Ao clicar "Novo com IA" → preencher toda a anamnese (nível, objetivo, equipamentos, dias, duração) → clicar "Gerar Programa", o sistema exibe: **"Agente de IA não configurado. Contate o suporte."** O trainer não tem como resolver isso sozinho.

**Impacto:** A funcionalidade principal diferenciadora do produto (prescrição com IA) é completamente inacessível para trainers novos. O fluxo de onboarding não inclui configuração do agente de IA. O trainer descobre a limitação só depois de preencher um formulário completo, gerando frustração.

**Causa raiz:** O campo `ai_agent_config` ou chaves de API (OpenAI/Anthropic) não são provisionados automaticamente na criação da conta. Exige configuração manual pelo suporte.

**Correção sugerida:** (1) Provisionar automaticamente o acesso à IA no signup, ou (2) Mostrar um aviso claro ANTES do trainer preencher a anamnese, ou (3) Incluir um passo de configuração de IA no onboarding.

### 2.3 Violações massivas na engine de prescrição (CRÍTICO — IA)

**Dados do banco de produção:** Das 48 prescrições já geradas no sistema, 54% apresentam violações nas regras de qualidade. No modo agent (Claude), a taxa é de **87.5%** (14 de 16 prescrições). As violações mais frequentes:

- `volume_below_minimum`: **57 ocorrências** — IA prescreve volume insuficiente para o objetivo
- `duplicate_exercise`: **28 ocorrências** — mesmo exercício aparece 2x no mesmo treino
- `volume_exceeds_max`: **23 ocorrências** — risco de overtraining
- `function_ordering`: **14 ocorrências** — exercícios na ordem errada (isolador antes de composto)

**Agravante:** Apenas **1 de 135 violações** foi auto-corrigida (taxa de 0.7%). O rules engine detecta problemas mas praticamente nunca os conserta.

### 2.4 N+1 queries no mobile (CRÍTICO — Performance)

**Local:** `hooks/useWorkoutSession.ts:443-450`

`fetchPreviousSets()` é chamado individualmente para CADA exercício. Um treino com 10 exercícios gera 30 queries ao Supabase (3 fallbacks por exercício). Isso causa lentidão perceptível ao abrir um treino e consumo excessivo de dados móveis.

### 2.5 Perda silenciosa de dados de treino em produção (CRÍTICO — Dados)

**Local:** `hooks/useWorkoutSession.ts:245-273`

`persistSetLog()` é fire-and-forget sem retry. Se a chamada ao Supabase falhar (rede instável, timeout), o set log é perdido sem qualquer feedback ao aluno. Erros são logados apenas em `__DEV__` — em produção, a perda é completamente silenciosa.

---

## 3. Problemas Médios

### 3.1 Botão "Nova Senha" exposto no header do perfil do aluno

O botão está ao lado de "Editar" no topo do perfil, sem confirmação. Um clique acidental redefine a senha do aluno. Deveria estar em um menu secundário ou exigir confirmação.

### 3.2 Rate limiter in-memory inútil em serverless

**Local:** `lib/rate-limit.ts`

O rate limiter usa um Map em memória. Em ambiente Vercel serverless, cada invocação é uma instância isolada, tornando o rate limiting completamente ineficaz.

### 3.3 Webhook Stripe Connect sem validação de ownership

**Local:** `api/webhooks/stripe-connect/route.ts`

O webhook não valida que o `connectedAccountId` pertence a um trainer conhecido. Um atacante poderia enviar webhooks maliciosos com IDs de conta arbitrários.

### 3.4 Componentes monolíticos (1800+ linhas)

`program-builder-client.tsx` (1887 linhas) e `edit-assigned-program-client.tsx` (1780 linhas) não têm code splitting. Carregam integralmente no bundle inicial, impactando o tempo de carregamento. O hook `useWorkoutSession.ts` tem 1029 linhas com 5+ responsabilidades.

### 3.5 130 instâncias de `any` no TypeScript

Espalhadas pelo codebase (26 só no `useWorkoutSession`), escondem bugs que o compilador deveria capturar.

### 3.6 Sessões de treino abandonadas sem cleanup

7 sessões travadas como `in_progress` no banco (a mais antiga com 17 dias). A função `cleanup_stale_sessions()` existe na migration 041 mas **nenhum cron job a invoca**. Os 5 crons existentes não incluem cleanup de sessões.

### 3.7 325 de 435 exercícios (75%) nunca utilizados

A biblioteca de exercícios tem 432 itens, mas 75% nunca foram usados em nenhum template ou programa. Isso polui a interface de busca e pode confundir a IA na seleção de exercícios.

### 3.8 Trainer lookup duplicado 30+ vezes

O padrão de buscar o trainer pelo `auth_user_id` é repetido em 30+ server actions ao invés de usar uma função utilitária centralizada.

---

## 4. Melhorias Sugeridas

### 4.1 Onboarding guiado com progresso real

O "Primeiros Passos 0/7" existe mas não guia efetivamente. Sugestão: transformar em um wizard passo-a-passo que bloqueia a próxima etapa até a anterior ser concluída, com vídeos curtos e dados de exemplo pré-carregados.

### 4.2 Provisionamento automático de IA no signup

A IA é o diferencial do produto. Deveria funcionar imediatamente após criar a conta, sem necessidade de contatar suporte.

### 4.3 Dashboard com projeção e tendências

O dashboard mostra apenas números absolutos (alunos ativos, treinos semana, receita). Faltam gráficos de tendência (evolução semanal), projeções e metas. Em meses iniciais, "Receita do mês: R$ 0,00" pode desanimar — melhor mostrar projeção.

### 4.4 Notificações de ação rápida para alunos inativos

Na lista de alunos, 4 estavam com "Último treino: Nunca" mas não há ação de nudge/lembrete direto. Um botão "Enviar lembrete" por WhatsApp ou push seria valioso.

### 4.5 Receita mascarada sem opção de revelar

O card "Receita mensal: R$ •••••" está permanentemente mascarado na dashboard. O ícone de olho existe mas o comportamento não ficou claro durante o teste.

### 4.6 Templates pré-prontos para acelerar primeiros programas

A página de Programas começa vazia ("Nenhum modelo salvo"). Para trainers iniciantes na plataforma, ter 3-5 templates prontos (Hipertrofia Iniciante, Emagrecimento, Full Body, etc.) aceleraria drasticamente o time-to-value.

### 4.7 Stall detection na engine de IA

Há um TODO no código em `generate-program.ts:200` para implementar detecção de estagnação de carga. Sem isso, a IA não consegue identificar quando um aluno parou de progredir e precisa de ajustes.

### 4.8 Structured logging no engine de prescrição

161+ `console.log` no engine de prescrição deveriam ser substituídos por structured logging para facilitar monitoramento e debugging em produção.

---

## 5. Análise do Treinador (Visão de Negócio)

### O que funciona bem

- **Design visual profissional** — Interface limpa, cores consistentes, tipografia adequada. Não parece um MVP.
- **Perfil do aluno 360°** — Quando populado, o perfil mostra heatmap de adesão, calendário semanal, PSE, variação de carga, programa, financeiro e avaliações em uma única tela.
- **Sistema de avaliações robusto** — 4 templates pré-configurados (Check-in Semanal, Reavaliação, Feedback, Avaliação Inicial com 47 perguntas), envio direto ao aluno, versionamento de schema.
- **Financeiro flexível** — 3 modalidades (Stripe, Manual, Cortesia) cobrem todos os cenários de cobrança.
- **Alertas contextuais excelentes** — "Programa termina em 0 semanas!" em laranja, alunos com "Nunca" treinou em vermelho, "Tudo em dia!" quando ok.
- **Criação de aluno fluida** — Formulário simples (nome, email, telefone, modalidade), senha provisória gerada automaticamente, opções de envio por WhatsApp.

### O que preocupa

- **Time-to-value alto** — Um trainer novo precisa: criar conta → cadastrar alunos → tentar usar IA (falha) → criar programa manualmente → ativar programa → esperar aluno treinar. São muitos passos antes de ver valor.
- **IA como promessa não cumprida** — O "Novo com IA" aparece na interface mas não funciona sem configuração manual. Isso quebra a confiança do trainer no produto.
- **Tour que atrapalha ao invés de ajudar** — O onboarding deveria ser o primeiro aliado do trainer, mas se torna o primeiro inimigo por aparecer em loop.

---

## 6. Análise do Desenvolvedor (Visão Técnica)

### Pontos Fortes

- **Monorepo bem estruturado** — `web/`, `mobile/`, `shared/`, types compartilhados via `@kinevo/shared`. Consistência entre plataformas.
- **Segurança sólida** — RLS em todas as 34 tabelas, SECURITY DEFINER com `search_path` fixo em RPCs, ownership guards consistentes.
- **Mobile diferenciado** — Integração Apple Watch + Live Activity é um diferencial significativo no mercado fitness.
- **Offline-first** — Idempotência com `UNIQUE(local_id, device_id)` em `set_logs`.
- **Knowledge graph de exercícios** — `exercise_relationships`, `exercise_synergies`, `exercise_condition_constraints` formam base para prescrição inteligente.
- **Integridade referencial perfeita** — Zero registros órfãos em todas as verificações.
- **Form versioning** — `form_submissions` guarda `schema_snapshot_json`, imune a mudanças futuras no template.

### Débitos Técnicos Prioritários

1. **Auto-fix do rules engine** (2-3 dias) — `volume_below_minimum` e `duplicate_exercise` devem ser auto-corrigidos
2. **Cron para cleanup de sessões** (1 hora) — função existe, só falta invocá-la
3. **RPC batch para exercícios** (1-2 dias) — `get_exercises_with_previous_sets(exercise_ids[])` elimina N+1
4. **Retry em persistSetLog** (meio dia) — exponential backoff para evitar perda de dados
5. **Code splitting** (1-2 dias) — `dynamic()` nos 3 maiores componentes web
6. **Função utilitária getTrainerByAuthUser** (2 horas) — elimina 30+ duplicatas
7. **Persistir estado do tour** (2 horas) — gravar preferência de skip no banco

---

## 7. Sugestões Estratégicas

### 7.1 Prioridade Imediata (Semana 1)

- Corrigir o tour em loop — é a primeira impressão do trainer e está negativa
- Provisionar IA automaticamente no signup — o diferencial do produto precisa funcionar out-of-the-box
- Criar cron de cleanup de sessões — 1 hora de trabalho para resolver 7 sessões órfãs

### 7.2 Curto Prazo (Mês 1)

- Implementar auto-fix no rules engine para as 3 violações mais frequentes
- Adicionar retry com backoff em persistSetLog
- Criar 5 templates de programa pré-prontos
- Adicionar gráficos de tendência no dashboard

### 7.3 Médio Prazo (Trimestre)

- Refatorar useWorkoutSession em hooks menores
- Implementar code splitting nos componentes >1000 linhas
- Eliminar 130 usos de `any`
- Implementar stall detection na engine de IA
- Arquivar/esconder 325 exercícios nunca usados

### 7.4 Visão de Produto

O Kinevo tem uma base técnica sólida e um design profissional. Os principais riscos são: (1) a IA como feature flag que poucos conseguem ativar, (2) o onboarding que repele ao invés de engajar, e (3) débitos técnicos de performance no mobile que afetam a experiência de treino. Resolver os itens 7.1 e 7.2 teria impacto desproporcional na satisfação do trainer e na retenção de novos usuários.

---

## 8. Métricas da Avaliação

| Métrica | Valor |
|---|---|
| Páginas web navegadas (esta sessão) | 10 |
| Alunos criados para teste | 3 |
| Tours interrompidos pelo sistema | 14+ |
| Tentativas de gerar programa com IA | 1 (bloqueada) |
| Programas manuais criados | 1 (parcial - exercício adicionado) |
| Queries SQL no banco de produção | 12+ (sessão anterior) |
| Arquivos de código analisados | 400+ TypeScript/TSX |
| Linhas de código estimadas | ~80.000+ |
| Tabelas com RLS | 34 |
| Migrations Supabase | 86 |
| Problemas críticos | 5 |
| Problemas médios | 8 |
| Melhorias sugeridas | 8 |
| Sugestões estratégicas | 4 grupos |
