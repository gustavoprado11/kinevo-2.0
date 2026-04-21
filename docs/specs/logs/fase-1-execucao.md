# Fase 1 — Log de Execução

Data: 2026-04-18. Executor: Claude Code (Opus 4.7).

## 1. Entregas

### Arquivos criados

- `web/src/lib/prescription/__fixtures__/prescription-output.ts` — fixtures mínimas de `PrescriptionOutputSnapshot`, `StudentPrescriptionProfile`, `PrescriptionAgentState`, `PrescriptionContextAnalysis`, `PrescriptionAgentQuestion` para testes.
- `web/src/components/programs/ai-prescription-panel/use-prescription-agent.ts` — hook que encapsula o stepper (anamnese → analyzing → questions → generating → done/error). Expõe `reset`, `toggleForm`, `setAnswer`, `sendQuestionnaire`, `startAnalysis`, `submitAnswersAndGenerate`, `skipQuestionsAndGenerate`, e recebe `initialPageState`/`initialGenerationId` para suportar deeplink.
- `web/src/components/programs/ai-prescription-panel/student-tab.tsx` — aba "A partir do aluno". Replica o layout do antigo `PrescribeClient` adaptado para 440 px, com rodapé sticky para os estados `done`/`error` (nos estados `anamnese`/`questions` o CTA primário já vive dentro dos componentes filhos — `PrescriptionProfileForm` e `AgentQuestionsPanel`).
- `web/src/components/programs/ai-prescription-panel.tsx` — painel principal (drawer direito, 440 px, com backdrop). Header `Sparkles · IA · {studentName}`, botão X para fechar. Monta `TourRunner tourId="prescribe"` dentro do painel (migrado do `/prescribe` antigo).
- Testes:
  - `web/src/components/programs/ai-prescription-panel/__tests__/use-prescription-agent.test.ts` (10 casos, renderHook).
  - `web/src/components/programs/__tests__/ai-prescription-panel.test.tsx` (5 casos, RTL).
  - `web/src/app/students/[id]/prescribe/__tests__/prescribe-redirect.test.ts` (2 casos, mock de `next/navigation`).

### Arquivos editados

- `web/src/components/programs/program-builder-client.tsx`
  - Novo botão "✨ Gerar com IA" (violet-ghost) na barra de ações, visível apenas quando `trainer.ai_prescriptions_enabled && studentContext && prescriptionData`. Ganha variant "active" quando o painel está aberto.
  - Estado `aiPanelOpen` + `aiPanelAutoOpenedRef`.
  - `useEffect` na montagem abre o painel quando `?mode=ai` está na query ou quando `prescriptionGenerationId` prop está presente.
  - `handleAcceptGeneratedProgram` faz `router.replace('/students/:id/program/new?source=prescription&generationId=…')` — aproveita a hidratação SSR existente em `program/new/page.tsx`.
  - Novo import: `Sparkles` de `lucide-react`, `AiPrescriptionPanel`, `PrescriptionData`.
  - Trainer interface agora aceita `ai_prescriptions_enabled?: boolean`.
  - Nova prop `prescriptionData?: PrescriptionData | null`.
- `web/src/app/students/[id]/program/new/page.tsx` — chama `fetchPrescriptionDataDirect(supabase, studentId, trainer.id)` quando `trainer.ai_prescriptions_enabled`. Repassa para o builder.
- `web/src/app/students/[id]/student-detail-client.tsx` — removido `handlePrescribeAI`, removida prop `onPrescribeAI` na composição do `ActiveProgramDashboard`, removido o botão inline "Novo com IA" do cartão "Próximos Programas".
- `web/src/components/students/active-program-dashboard.tsx` — removida a prop `onPrescribeAI` da interface e desestruturação, removidos os dois botões "Novo com IA" (cartão "Sem programa" + toolbar do cartão principal).
- `web/src/app/students/[id]/prescribe/page.tsx` — reescrito como redirect 308 (`permanentRedirect`) para `/students/:id/program/new?mode=ai[&scheduled=true]`. Preserva `?scheduled=true`.

### Arquivos deletados

- `web/src/app/students/[id]/prescribe/prescribe-client.tsx` — conforme spec (o `/prescribe` agora é redirect; a lógica vive no hook `usePrescriptionAgent` + painel).

## 2. Desvios e simplificações em relação ao spec

Foram alinhados previamente com o Gustavo antes da execução.

- **Seção 4.4 — hidratação client-side.** O spec pedia "atualizar URL via `router.replace` e disparar o mesmo fluxo de hidratação que o construtor já tem quando detecta `generationId` na query". No repo atual, a hidratação é **100% Server-Side**: `program/new/page.tsx` já carrega o `output_snapshot` por SSR e passa `program` pronto para o `ProgramBuilderClient`. A simplificação: o hook não faz fetch nenhum; `handleAcceptGeneratedProgram` chama `router.replace` e o Next re-executa o Server Component, que hidrata automaticamente. Resultado: menos código no cliente e o mesmo caminho que refreshes e deeplinks já tomavam. Registrar isto como adendo à spec 01 §4.4.
- **Modal "Substituir programa atual?" (4.4).** Decisão: não implementar nesta fase. Racional do Gustavo: `?mode=ai` é alcançado via (a) redirect de `/prescribe` (construtor vazio, nada a substituir) ou (b) botão explícito no construtor (treinador consciente). Único caso real é "construtor com conteúdo + clicou Gerar no painel + gerou" — será tratado em uma iteração posterior com `confirm()` nativo ou modal estilizado. Deixado como follow-up.
- **Aba "A partir de texto" (4.3).** Seguindo a decisão da spec, **não renderizamos** a aba `text` na Fase 1. O botão `FileText` antigo na barra de ações continua funcional (AiPrescribePanel legado). Fase 2 consolida.
- **Layout "split" ≥ 1280 px (4.3).** Aprovado pelo Gustavo como follow-up: por ora o painel é sempre drawer overlay com backdrop em qualquer viewport. Evita tocar no layout do `ProgramBuilderClient` (2048 linhas) e mantém PR cirúrgica.
- **`TourRunner tourId="prescribe"`.** Migrado para dentro do `AiPrescriptionPanel` (antes vivia no `PrescribeClient`). Os steps do tour (`TOUR_STEPS.prescribe`) não foram alterados; o único seletor potencialmente sensível é `data-onboarding="prescription-profile"`, que foi preservado na `AiPrescriptionPanelStudentTab` no estado `anamnese`. Se o tour usa outros seletores CSS específicos do layout do `/prescribe` (p.ex. `max-w-5xl`), pode haver anchoring impreciso em 440 px — **verificar em walk-through manual** (follow-up caso o tour quebre).

## 3. Checklist da Fase 1

- [x] `usePrescriptionAgent` extraído, testado (10 casos passando), com tipos exportados.
- [x] `<AiPrescriptionPanel />` implementado com aba `student` (Fase 1 não renderiza aba `text`).
- [x] Botão "✨ Gerar com IA" na barra de ações, condicional à feature flag.
- [x] Construtor abre painel quando `?mode=ai`.
- [x] `/students/[id]/prescribe` redireciona (308) para `/program/new?mode=ai`.
- [x] Botões "Novo com IA" removidos do dashboard (2 ocorrências no `student-detail-client`, 2 no `active-program-dashboard`).
- [x] `prescribe-client.tsx` deletado.
- [x] Grep de sanidade: `handlePrescribeAI|onPrescribeAI|Novo com IA` → zero matches em `web/src/`.
- [x] Todos os testes passando (`npx vitest run`: 21 files, 218 tests).
- [x] `?source=prescription&generationId=...` continua funcionando — trajeto SSR intocado.
- [ ] Deploy em staging + walk-through manual — **pendente** (ver seção 5 abaixo; não foi executado nesta sessão por restrição do prompt: "não use git" / "eu mesmo gerencio deploys").

## 4. Verificações automatizadas executadas

- `npx vitest run` — **218/218 passando** (21 arquivos de teste). Log: `Start at 07:52:45 … Duration 2.92s`.
- `npx tsc --noEmit` (web) — meus arquivos tocados estão **limpos**. Restam 11 erros pré-existentes em dois arquivos de teste (`src/components/students/__tests__/program-calendar.test.tsx` e `src/components/students/__tests__/student-insights-card.test.tsx`) que não foram tocados por esta fase e já existiam antes da execução (confirmado antes de editar qualquer arquivo).

## 5. Walk-through manual — a executar pelo Gustavo

A sessão não sobe servidor nem executa cenários ao vivo. Seguem os passos para validação manual antes de considerar a Fase 1 realmente "pronta":

1. `npm run -w web dev` com um trainer que tem `ai_prescriptions_enabled = true` e ao menos um aluno com `student_prescription_profile` preenchido.
2. Navegar a `/students/<id>` — confirmar que os **dois** botões "Novo com IA" desapareceram:
   - No cartão "Programa ativo" (toolbar ao lado de "Editar/Concluir/Trocar").
   - No cartão "Próximos programas" quando sem programas ativos/agendados.
3. Clicar em "Criar Novo" → construtor abre **sem** o painel de IA. Confirmar que o novo botão "✨ Gerar com IA" aparece na barra de ações, à esquerda do grupo de ícones mobile/compare/filetext.
4. Clicar em "Gerar com IA" → painel abre (drawer direito, 440 px, backdrop). Header mostra "IA · {nome}".
5. Estado `anamnese`: validar que o `PrescriptionProfileForm` renderiza em 440 px. **Atenção ao compactMode** — se houver quebra grave (campo fora do container, botão cortado), pausar e reportar.
6. Preencher anamnese e clicar "Gerar programa" → painel vai para `analyzing` → possivelmente `questions` → `generating` → `done`. Canvas à esquerda deve hidratar os treinos gerados (via `router.replace` que re-executa o Server Component). URL final deve ser `/students/<id>/program/new?source=prescription&generationId=<id>`.
7. Clicar "Fechar painel" no estado `done` — painel fecha, construtor segue com o programa gerado visível.
8. Reabrir `/students/<id>/program/new?source=prescription&generationId=<id>` diretamente — painel abre em `done` automaticamente via deeplink.
9. Reabrir `/students/<id>/prescribe` — navegador deve terminar em `/students/<id>/program/new?mode=ai` com o painel aberto em `anamnese`. Testar também `/students/<id>/prescribe?scheduled=true` → deve virar `?mode=ai&scheduled=true`.
10. Ativar/desativar a feature flag `ai_prescriptions_enabled` no banco — painel e botão devem sumir quando `false`.
11. Testar "Ativar como Atual" no final do fluxo para fechar o smoke end-to-end.

## 6. Follow-ups sugeridos

Ordem decrescente de prioridade:

1. **Modal estilizado para "Substituir programa atual?"** — quando o construtor já tem conteúdo e o treinador clica "Gerar programa" no painel. Hoje o `router.replace` substitui sem aviso. Adicionar um confirm antes de disparar `executeGeneration` no hook.
2. **Layout split ≥ 1280 px** — fazer o painel empurrar o canvas em telas grandes, em vez de sobrepor. Requer refactor do layout do `ProgramBuilderClient` (2048 linhas) — intencionalmente fora do escopo da Fase 1.
3. **Verificar `compactMode` do `PrescriptionProfileForm` em 440 px.** Se houver regressão visual pequena (padding/input), ajustar o componente em follow-up; se houver quebra grave, voltar para cá.
4. **Fase 2 consolida a aba "texto".** O botão `FileText` da barra de ações continua renderizando o `AiPrescribePanel` antigo — estratégia de compatibilidade até a próxima fase.
5. **Tour `prescribe`** — validar se os steps ainda anchoram corretamente nos novos seletores (especialmente fora de `data-onboarding="prescription-profile"`). Se algum step virar no-op, ajustar `TOUR_STEPS.prescribe` ou remover step específico.
6. **Tests: integração `<ProgramBuilderClient />` + painel.** O teste de integração que eu escrevi cobre só o painel isolado e o redirect; um teste end-to-end com mock das actions (montando o builder com `?mode=ai` e `?source=prescription&generationId=...`) ficaria mais robusto — evitei pela superfície grande do builder.
7. **`getTrainerWithSubscription` faz query extra** para `fetchPrescriptionDataDirect` quando `ai_prescriptions_enabled=true`. É aceitável (flag raramente `true` hoje), mas medir TTFB do `program/new` em produção antes de escalar uso.

## 7. Pré-existente fora do escopo (não-toques)

- Erros TS em `src/components/students/__tests__/program-calendar.test.tsx` e `src/components/students/__tests__/student-insights-card.test.tsx` — **preexistentes, 11 erros total**, não tocados nesta fase conforme "no refactor oportunista". Abrir issue separada.
- Comentários de schema (`@ts-ignore — ai_prescriptions_enabled from migration 036`) em actions de prescrição — estavam lá, não modifiquei.
