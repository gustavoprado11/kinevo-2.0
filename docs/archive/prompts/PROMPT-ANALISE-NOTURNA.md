# Análise Noturna Completa — Kinevo (SOMENTE LEITURA)

## Contexto

Você está no monorepo do Kinevo, uma plataforma para personal trainers gerenciarem alunos, programas de treino, mensagens e financeiro. Estrutura:

- `web/` — Next.js (App Router, Supabase SSR, AI SDK, MCP server)
- `mobile/` — Expo / React Native (expo-router, HealthKit, background fetch)
- `shared/` — pacote compartilhado `@kinevo/shared` (tipos, lógica de domínio, testes vitest)
- `supabase/` — migrations, edge functions, seeds, testes
- `docs/`, `_planning/` — documentação e planejamento existentes

## Regras invioláveis

1. **NÃO altere nenhum arquivo de código, configuração ou migration.** Esta tarefa é 100% análise. Os únicos arquivos que você pode criar são os relatórios em `docs/analise-noturna/` (crie a pasta).
2. **NÃO execute** comandos que modifiquem estado: nada de `git commit`, `git push`, deploy, `supabase db push`, instalação de dependências novas, nem escrita no banco.
3. **PODE executar** comandos de leitura/verificação: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run test:coverage`, `npm audit`, `git log`, buscas com grep/glob.
4. O computador ficará ligado a noite toda — **seja exaustivo, não superficial**. Prefira ler arquivos inteiros a amostrar. Use subagents (Task tool) em paralelo para explorar áreas independentes.
5. Leia primeiro `RELATORIO-ANALISE-MOBILE.md` e `RELATORIO-ANALISE-WEB.md` na raiz. Use-os como baseline: verifique o que já foi corrigido desde então, o que continua pendente, e foque em achados NOVOS. Não repita o que já está lá sem agregar informação.
6. Leia também `docs/` e `_planning/` para entender o roadmap e não sugerir o que já está planejado (ou, se já planejado, avalie criticamente o plano).

## Fase 1 — Mapeamento (antes de tudo)

Construa um mapa mental do sistema: rotas web (app router), telas mobile (expo-router), API routes, edge functions, schema do banco (leia TODAS as migrations em ordem), políticas RLS, fluxos de autenticação (trainer vs aluno), fluxo de pagamentos/assinaturas, sistema de mensagens, e o que `shared/` centraliza vs o que está duplicado entre web e mobile. Registre esse mapa em `docs/analise-noturna/00-mapa-do-sistema.md`.

## Fase 2 — Análises profundas (use subagents em paralelo quando possível)

### A. Segurança (prioridade máxima)
- **RLS**: para cada tabela, a política realmente impede um trainer de ver dados de outro trainer e um aluno de ver dados de outro aluno? Procure tabelas sem RLS, políticas com `USING (true)`, e uso de `service_role` no código cliente.
- **API routes e edge functions**: validação de input (zod?), verificação de autenticação/autorização em CADA rota, IDOR (passar id de outro usuário), mass assignment, rate limiting.
- **Segredos**: chaves hardcoded, segredos em `app.json`/`eas.json`/`.env` versionados, exposição de variáveis no bundle client-side (`NEXT_PUBLIC_*` indevidos).
- **Auth**: fluxo de convite/cadastro de alunos, reset de senha, sessões mobile (storage do token), uso de `bcryptjs` no web (por quê? onde? está correto?).
- **Integrações de IA** (`@anthropic-ai/sdk`, `@ai-sdk/openai`, MCP server no web): prompt injection, exposição de dados de outros usuários no contexto, custo/abuso sem limite.
- **Dependências**: `npm audit` nos três workspaces, versões desatualizadas com CVE conhecido.
- Classifique cada achado: **Crítico / Alto / Médio / Baixo**, com arquivo:linha e cenário de exploração concreto.

### B. Backend e dados
- Qualidade do schema: índices faltando para as queries reais do código, FKs sem índice, colunas não usadas, inconsistências de nomenclatura.
- Queries N+1, queries sem paginação, over-fetching (`select *`).
- Edge functions: tratamento de erro, idempotência, timeouts.
- Consistência transacional em fluxos críticos (criação de programa com sessões e exercícios, pagamentos).
- Migrations: alguma destrutiva ou arriscada? Seeds com dados sensíveis?

### C. Frontend Web
- Arquitetura de componentes, duplicação, componentes gigantes (>300 linhas) que merecem decomposição.
- Performance: bundle, `use client` desnecessário, falta de suspense/streaming, imagens não otimizadas, re-renders.
- Estados de loading/erro/vazio em cada página; tratamento de falha de rede.
- Acessibilidade: navegação por teclado, labels, contraste.
- Resultado real de `typecheck`, `lint` e testes — inclua números no relatório.

### D. Mobile
- Performance: listas longas (FlatList vs map), imagens, re-renders, tamanho do bundle, tempo de startup.
- Offline: o app funciona sem rede? O que acontece no meio de um treino se a conexão cai? Há fila de sync? (netinfo está instalado — é usado bem?)
- Background fetch e notificações: confiabilidade, permissões.
- HealthKit: o que é coletado, está sendo usado de fato, privacidade.
- UX de execução de treino (tela mais crítica do produto): fricção, número de toques, feedback.
- Paridade web vs mobile: o que existe num e falta no outro, e se isso é intencional.

### E. Código compartilhado e qualidade geral
- O que está em `shared/` vs o que está duplicado entre web e mobile (lógica de domínio, validações, formatações). Quantifique a duplicação.
- Cobertura de testes real por workspace; quais fluxos críticos NÃO têm teste (auth, pagamento, prescrição de treino).
- TODOs/FIXMEs/HACKs no código; código morto; arquivos órfãos na raiz do repo que deviam ir para `_planning/` ou ser removidos.

## Fase 3 — Oportunidades e diferenciais

Com o conhecimento profundo adquirido, proponha em `docs/analise-noturna/07-oportunidades.md`:

1. **Quick wins** (< 1 dia cada): melhorias de alto impacto e baixo esforço já identificadas nas análises.
2. **Funcionalidades diferenciais**: ideias que aproveitam o que o Kinevo JÁ tem de único (IA integrada, HealthKit, métodos avançados de treino, mensagens, financeiro) para criar vantagem competitiva frente a apps como MFIT, Tecnofit, Hevy Coach, Trainerize. Para cada ideia: problema do usuário, esboço de solução usando a infraestrutura existente, esforço estimado (P/M/G), por que é diferencial.
3. **Riscos estratégicos**: dívidas técnicas que vão travar o crescimento se não tratadas (ex.: escala do banco, custo de IA, ausência de testes em fluxo de pagamento).

## Entregáveis (em `docs/analise-noturna/`)

- `00-mapa-do-sistema.md`
- `01-seguranca.md`
- `02-backend-dados.md`
- `03-frontend-web.md`
- `04-mobile.md`
- `05-codigo-compartilhado-qualidade.md`
- `06-comparativo-relatorios-anteriores.md` (o que foi corrigido / continua pendente dos relatórios antigos)
- `07-oportunidades.md`
- `RESUMO-EXECUTIVO.md` — máximo 2 páginas: top 10 achados por impacto, tabela de severidade, e plano de ação sugerido em ordem de prioridade para as próximas sessões (estas sim, de implementação).

Cada achado deve ter: severidade, arquivo:linha, evidência (trecho de código), impacto concreto e correção sugerida (descrita, não implementada).

## Critério de conclusão

Antes de finalizar, faça uma passada de verificação: releia o RESUMO-EXECUTIVO e confirme que cada afirmação tem evidência em código (arquivo:linha). Remova especulações que você não confirmou. Se sobrar tempo, aprofunde nas áreas onde a análise ficou mais rasa.
