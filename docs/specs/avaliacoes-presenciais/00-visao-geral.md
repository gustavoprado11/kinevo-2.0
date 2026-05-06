# Specs — Avaliações Presenciais (Fase 1 do roadmap)

**Leia isto primeiro.** Este arquivo define contexto, decisões já tomadas, invariantes que valem para todas as fases, e a ordem sugerida de execução. Cada milestone tem (ou terá) seu próprio arquivo com spec executiva para o Claude Code.

---

## 1. Contexto rápido

O Kinevo já tem um módulo robusto de **formulários** (`form_templates`, `form_submissions`, `student_inbox_items`) com três categorias: `anamnese`, `checkin`, `survey`. Esse módulo é o que aparece na sidebar como "Avaliações" (rota `/forms`). Funciona bem, mas é **assíncrono** — o treinador atribui, o aluno preenche, o treinador revisa.

Falta o que existe no MFIT (líder no Brasil): **avaliação presencial**, com o treinador na frente do aluno medindo coisas (peso, dobras cutâneas, perímetros, CMJ, etc), com cálculo automático de protocolos e comparativo histórico. Hoje, treinadores que querem isso saem do Kinevo e usam MFIT à parte.

A Fase 1 deste roadmap resolve a paridade competitiva crítica: **antropometria + dobras + cálculos + comparativo simples + PDF**, mobile e web.

A análise estratégica completa está em `Estrategia_Avaliacoes_Presenciais_Kinevo.md` (raiz do repo). Os mockups conceituais em `Mockups_Avaliacoes_Presenciais_Kinevo.html`.

## 2. Decisões já tomadas (não revisar)

1. **Não criamos rota nova nem item de menu novo.** A sidebar já tem "Avaliações" → `/forms`. A página `/forms` ganha uma terceira aba interna ("Avaliações Presenciais") ao lado de "Respostas" e "Templates". Mesmo padrão no mobile dentro de `(trainer-tabs)/forms.tsx`.
2. **Reutilizar a infra de `form_templates`** estendendo com `category = 'assessment'` e nova coluna `delivery_mode`. Não criamos uma tabela separada de "templates de avaliação".
3. **Sessões e medições são tabelas novas** (`assessment_sessions` + `assessment_measurements`), porque o lifecycle é completamente diferente do `form_submissions` (multi-step, múltiplas tentativas por medida, métricas calculadas).
4. **Cor da nova categoria: violeta `#8b5cf6`.** Não foi escolha aleatória — o token `colors.status.presencial` já está definido em `mobile/theme/colors.ts`. Reutilizar para consistência semântica.
5. **Engine de fórmulas vive em `shared/`.** Tanto mobile quanto web consomem o mesmo pacote, evitando divergência. Padrão idêntico ao que já existe em `shared/utils/schedule-projection`.
6. **Fórmulas implementadas na Fase 1**: IMC, RCQ (razão cintura/quadril), Jackson & Pollock 3 dobras, Jackson & Pollock 7 dobras, Petroski 4 dobras (validado para população brasileira), Faulkner 4 dobras, equação de Siri (densidade → %BG). Outras fórmulas (Guedes, Durnin & Womersley, Brozek) ficam para depois.
7. **Sem CMJ via vídeo nesta fase.** Fica para Fase 2. Esta fase entrega só medições numéricas + foto opcional (já tem campo `photo` no sistema atual).
8. **Templates de sistema** seedados em SQL, no padrão das migrations 065/066 que já existem.
9. **PDF em Edge Function** (Supabase) com `react-pdf` server-side, mesmo layout no mobile e web.

## 3. Arquitetura alvo em uma frase

Treinador agenda uma sessão de avaliação → escolhe um pacote (template categoria `assessment`) → captura medidas no mobile/web (modo wizard ou painel) → app calcula `%BG`, IMC, RCQ etc → resultado mostra deltas vs avaliação anterior → PDF gerado por Edge Function.

## 4. Invariantes que valem para todos os milestones

Todos os milestones respeitam as regras abaixo — se algum parecer violar, **pare e reporte antes de executar**:

1. **Não quebrar o fluxo atual de formulários.** Toda a infra de `form_templates`, `form_submissions`, `student_inbox_items` continua funcionando para anamnese/checkin/survey exatamente como hoje. Estamos estendendo, não substituindo.
2. **RLS é obrigatório.** Todas as tabelas novas começam com RLS habilitado e policies trainer-scoped + student-scoped, espelhando o padrão de `supabase/migrations/047_fix_inbox_data_leak.sql`.
3. **RPCs com `SECURITY DEFINER`** seguindo o padrão de `049_trainer_mobile_rpcs.sql` (uso de `current_trainer_id()` ou `current_student_id()`, `RAISE EXCEPTION` em violação, `SET search_path = public`).
4. **Migrations puramente aditivas.** Nenhuma migration desta fase deve dropar colunas, mudar tipos ou apagar dados. Numeração começa em **121** (a última é 120).
5. **Convenção de naming**:
   - Tabelas: `assessment_sessions`, `assessment_measurements` (snake_case, plural).
   - Colunas: snake_case.
   - RPCs: `verbo_objeto` (ex: `get_assessment_session`).
   - TypeScript: camelCase no client, mapeado de/para snake_case via Supabase types.
6. **Tipos compartilhados em `shared/`.** Não duplicar enums, units, protocols entre mobile e web.
7. **Não introduzir libs novas sem aprovação.** Ferramentas já presentes: react-native, Next 15, Supabase JS, shadcn/ui, recharts, lucide. Para PDF usar `react-pdf` (já parte do stack web). Não trazer nada novo.
8. **i18n**: strings user-facing em pt-BR.
9. **Testes**: cada milestone entrega testes. Engine de fórmulas → 100% coverage de unit tests. Componentes UI → smoke tests. RPCs → testes de integração em SQL ou via Supabase test harness.
10. **Branch por milestone**: `feature/avaliacoes-presenciais-m1`, `m2`, etc. PR pequenos e revisáveis.

## 5. Ordem de execução (6 milestones)

| # | Milestone | Dura | Plataforma | Dependências |
|---|---|---|---|---|
| **1** | **Data foundation** — migrations, tabelas, RLS, RPCs, tipos compartilhados | 4-6 dias | shared/backend | nenhuma |
| **2** | **Engine de fórmulas** — pacote em `shared/lib/assessment-protocols/` com testes | 3-5 dias | shared | M1 |
| **3** | **Mobile capture flow** — novos question types, wizard de medição, sessão, resultado | 10-15 dias | mobile | M1, M2 |
| **4** | **Web builder + view** — aba "Avaliações Presenciais", builder de pacote, visualização, comparativo simples | 8-12 dias | web | M1, M2 |
| **5** | **PDF generation** — edge function + react-pdf, CTA mobile e web | 4-6 dias | edge functions | M3, M4 |
| **6** | **Templates de sistema + polish** — seed dos 3 templates, tour de onboarding, e2e tests | 3-5 dias | mobile + web | tudo |

**Total: ~32-49 dias úteis, alinhado com a estimativa de 8-12 semanas do roadmap.**

Cada milestone tem (ou terá) um arquivo `01-...md`, `02-...md`, etc. com spec detalhada e PROMPT-MILESTONE-N.md emparelhado.

## 6. O que está fora de escopo da Fase 1

Para evitar escopo creep, o seguinte fica explicitamente **fora** da Fase 1:

- ❌ Testes via vídeo (CMJ, SJ, DJ, RSI) — Fase 2
- ❌ Auto-detecção via ML (CoreML, MLKit) — Fase 3
- ❌ Integração com balanças bluetooth (Renpho, Mi Body) — Fase 3
- ❌ Painel de estúdio multi-trainer — Fase 2
- ❌ Análise postural por foto com marcação de pontos — Fase 2
- ❌ Dinamometria — Fase 3
- ❌ Exportação em massa de laudos — Fase 3
- ❌ Comparativo avançado (gráficos sobrepostos, exportação CSV) — Fase 2
- ❌ Recomendações automáticas que viram bloco no programa — Fase 2

A Fase 1 entrega apenas o que cobre 80% do uso real: **antropometria + dobras + cálculos + 1 comparativo simples + PDF**.

## 7. Métricas de sucesso da Fase 1

Para considerar a Fase 1 concluída e bem-sucedida:

- ✅ Treinador consegue criar pacote, atribuir a aluno, capturar medidas e ver resultado em mobile e web sem bugs.
- ✅ Cálculo de %BG por J&P 3, J&P 7, Petroski 4 e Faulkner 4 reproduz valores idênticos a calculadoras de referência (validar com 5 casos cada via test fixtures).
- ✅ PDF do laudo abre corretamente no Adobe Reader, Chrome, Apple Preview.
- ✅ Aluno tem acesso de leitura ao próprio laudo via inbox.
- ✅ Migrations idempotentes (rodam mais de uma vez sem erro).
- ✅ Cobertura de unit tests da engine de fórmulas: 100%.
- ✅ Smoke test e2e: trainer entra em `/forms`, vê aba nova, cria sessão, captura todos os campos de antropometria, salva, vê resultado.

## 8. Como começar

Ordem recomendada para o Claude Code (e para o time humano):

1. Ler este arquivo até o fim.
2. Ler `01-milestone-1-data-foundation.md`.
3. Criar a branch `feature/avaliacoes-presenciais-m1`.
4. Executar o que está em `PROMPT-MILESTONE-1.md`.
5. Abrir PR. Quando merged, passar para M2 e assim por diante.
