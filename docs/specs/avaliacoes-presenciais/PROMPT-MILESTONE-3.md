# PROMPT — Milestone 3: Mobile capture flow (Avaliações Presenciais)

> Cole este prompt no Claude Code. M1 (data foundation, migration 122 em prod) e
> M2 (engine de fórmulas) já estão em main e funcionando.

---

Você vai implementar o **Milestone 3 — Mobile capture flow** do módulo de
Avaliações Presenciais do Kinevo. Esta é a primeira UI real consumindo M1+M2.
O treinador no celular consegue: ver lista de sessões, agendar nova, capturar
medições com o aluno na frente, ver resultado calculado e comparado com
sessão anterior.

⚠️ **Atenção crítica:** este é o primeiro código que roda no celular do
treinador em momento crítico (sala de avaliação, aluno presente). Bugs aqui
custam mais caro que em M1/M2. Robustez offline-friendly, recovery de
meio-processo e UX de input rápido são prioridades **explícitas** desta
fase, não detalhes.

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/00-visao-geral.md`
   - `docs/specs/avaliacoes-presenciais/03-milestone-3-mobile-capture.md`
   - Para contexto rápido dos milestones anteriores (não precisa profundo):
     - `docs/specs/avaliacoes-presenciais/MILESTONE-1-STATUS.md`
     - `docs/specs/avaliacoes-presenciais/MILESTONE-2-STATUS.md`
   - `mobile/app/(trainer-tabs)/forms.tsx` (será estendido — entender padrão atual)
   - `mobile/components/trainer/forms/FormBuilderModal.tsx` (template builder a ser estendido)
   - `mobile/components/forms/FormFieldRenderer.tsx` (renderer a ser estendido)
   - `shared/lib/assessment-protocols/index.ts` e `types.ts` (engine que vai ser consumida)

2. Confirme que entendeu:
   - Os 5 novos question types (numeric_unit, bilateral_numeric, multi_attempt_numeric, computed, protocol)
   - As 4 telas novas (lista, sessão, wizard, resultado)
   - A estratégia offline-friendly (draft local → sync em batches)
   - O que está fora de escopo (CMJ vídeo, auto-detecção ML, etc — Fase 2+)

3. Se algo na spec for ambíguo, **PARE e pergunte**. Não invente solução.

## Workflow (mesmo padrão dos M1 e M2, com sub-blocos)

- **Sem branch.** Trabalho direto em main.
- **Sem `git commit` nem `git push` durante desenvolvimento.** Eu autorizo
  ao final de tudo.
- **DIVIDIDO em 4 sub-blocos** (B1 → B2 → B3 → B4) com PARADAS no meio:

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (read-only)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (deve estar limpo, exceto cosméticos pré-existentes)
2. `git log --oneline -5` (último: `0e188ce feat(assessments): M2 formula engine`)
3. `cat mobile/app/(trainer-tabs)/forms.tsx | head -100` — confirmar estrutura atual de tabs
4. `cat mobile/app/(trainer-tabs)/_layout.tsx | head -60` — entender o tabbar pattern
5. `ls mobile/stores/ 2>/dev/null` — projeto já usa Zustand? Se sim, qual padrão?
6. `grep -rln "AsyncStorage\|@react-native-async-storage\|MMKV\|react-native-mmkv\|expo-secure-store" mobile/ --include="*.ts" --include="*.tsx" | head -5` — quais libs de persistência já estão no projeto?
7. `cat mobile/package.json | grep -E '"react-native|expo-|zustand|mmkv|async-storage|haptics"'` — confirmar deps disponíveis
8. `ls mobile/components/trainer/forms/` e `ls mobile/components/forms/` — entender estrutura de componentes existente
9. Procurar pelos novos question types em código existente:
   `grep -rln "numeric_unit\|bilateral_numeric\|multi_attempt_numeric" mobile/ shared/`
   — espera-se ZERO resultados em `mobile/`, mas alguma referência em `shared/types/assessments.ts` (M1)
10. Testar import:
   `cd mobile && npx tsc --noEmit 2>&1 | tail -20` — confirmar baseline de typecheck
11. Identificar como o projeto faz navegação:
   `find mobile/app -name "*.tsx" | head -20` — confirmar estrutura de rotas (expo-router?)

PARE e me mande o relatório completo. Foco especial em:
- Como o projeto persiste estado local (AsyncStorage / MMKV / SecureStore)
- Como o projeto usa Zustand (se usar) — me mostre 1 store existente como referência
- Erros pré-existentes de typecheck (vamos ignorar mas precisam ser conhecidos)

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — INFRAESTRUTURA LOCAL (sem UI)
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

Implementar:
- `mobile/stores/assessmentDraftStore.ts` — Zustand store + persistência
- `mobile/hooks/useAssessmentSessionLifecycle.ts` — combina create+save+finalize
- `mobile/hooks/useAssessmentMeasurementForm.ts` — state de medição em progresso
- `mobile/hooks/useAssessmentSessionDraft.ts` — draft local persistido
- `mobile/hooks/useStudentMetricsTimeline.ts` — série temporal por métrica
- `mobile/hooks/useAssessmentResultComparison.ts` — busca sessão anterior + monta deltas
- Evolução dos hooks placeholder M1 (`useAssessmentSessions`, `useAssessmentSession`) — sair de placeholder pra implementação completa

Convenções:
- Match o padrão Zustand existente no projeto (descobrir no Bloco A)
- Persistência via biblioteca já presente no projeto (NÃO adicionar nova)
- Versionar o schema do draft (`draft_schema_version: 1`) pra futuro migration
- Engine M2 importada de `@kinevo/shared/lib/assessment-protocols`

Verificações:
- `cd mobile && npx tsc --noEmit` continua limpo (zero erros novos)
- Sem nenhuma UI tocada ainda

PARE e reporte:
- Arquivos criados/modificados
- Decisões sobre persistência (qual lib, padrão de versionamento)
- Output do typecheck

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — UI DE INPUTS E WIZARD (testável em isolamento)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

Implementar:
- `mobile/components/trainer/assessments/inputs/NumericUnitInput.tsx`
- `mobile/components/trainer/assessments/inputs/BilateralNumericInput.tsx`
- `mobile/components/trainer/assessments/inputs/MultiAttemptInput.tsx`
- `mobile/components/trainer/assessments/inputs/ComputedDisplay.tsx`
- `mobile/components/trainer/assessments/inputs/ProtocolWizard.tsx`
- `mobile/components/trainer/assessments/MeasurementWizard.tsx` (container)
- `mobile/components/trainer/assessments/AnatomyDiagram.tsx`

Diretrizes UX:
- Big input numérico (font ≥36, weight 700-800)
- Teclado nativo decimal (`keyboardType="decimal-pad"`)
- Haptic feedback em transições principais (`Haptics.impactAsync`)
- Range warning como modal de confirmação one-tap (não bloqueia)
- Tokens visuais: `colors.brand.primary` para CTAs, `colors.status.presencial` para chrome de avaliação
- Cards com radius 14-20, shadows sutis (espelhar `evaluation-preview` tokens)

⚠️ Importante:
- AnatomyDiagram = SVG inline simples, < 5KB cada (1 path por região marcada)
- Sites cobertos: chest, abdomen, thigh, triceps, subscapular, suprailiac,
  midaxillary, biceps, calf — usar mesmos nomes da engine M2

Verificações:
- Componentes funcionam isolados (criar tela rápida `mobile/app/_dev/assessments-inputs.tsx`
  pra você poder testar visualmente; remover essa tela antes do commit)
- TypeScript clean
- iOS e Android renderam sem warning

PARE e reporte. Pode incluir screenshots dos componentes na tela de dev se conseguir.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — TELAS E INTEGRAÇÃO COM /FORMS TAB
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

Implementar:
- Estender `mobile/app/(trainer-tabs)/forms.tsx`:
  - Tab type `"responses" | "templates" | "assessments"`
  - FilterChips para a aba presencial (Todas / Em atraso / Próximas / Concluídas)
  - Lista de sessões reusando `SessionListItem`
  - FAB para criar nova sessão
- `mobile/components/trainer/assessments/CreateSessionModal.tsx`
- `mobile/components/trainer/assessments/SessionListItem.tsx`
- `mobile/components/trainer/assessments/SessionStatusBadge.tsx`
- `mobile/components/trainer/assessments/TestChecklistItem.tsx`
- `mobile/app/assessments/[sessionId].tsx` — sessão com checklist
- `mobile/app/assessments/[sessionId]/measure/[testId].tsx` — wizard
- `mobile/app/assessments/[sessionId]/result.tsx` — resultado
- `mobile/components/trainer/assessments/ResultStatsCard.tsx`
- `mobile/components/trainer/assessments/ResultComparisonRow.tsx`
- `mobile/components/trainer/assessments/HistoryMiniChart.tsx`

⚠️ Não regredir as duas abas existentes (Respostas, Templates). Smoke test
manual: abrir cada aba antes de publicar.

Verificações:
- Toda a navegação funciona (tap em sessão → checklist → wizard → result)
- Engine M2 é chamada apenas no `finalize`, com inputs validados
- Estado offline: app não trava se RPC falhar mid-process
- Empty state da aba presencial é estética alinhada com EmptyState existente

PARE e reporte com screen-recording de um happy path completo.

═══════════════════════════════════════════════════════════════════════
BLOCO B4 — RECOVERY, RANGE WARNINGS, POLISH
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B3.

Implementar:
- Crash recovery: ao montar a app, se `assessmentDraftStore` tiver draft com
  `is_dirty=true` e mais de 1 minuto desde `last_synced_at`, oferecer
  prompt "Continuar avaliação de {aluno}?" com botões Continuar / Descartar
- Range warning modal: para campos peso, altura, dobras, cintura — confirmação
  one-tap quando fora de range razoável
- Empty states refinados (lista vazia, sessão sem medições)
- Loading states em todas as ações de rede
- Error states user-friendly (RPC error, validação engine)
- Haptic feedback consistente nas transições importantes
- Acessibilidade básica: `accessibilityLabel` em CTAs, contrast check

Verificações finais:
- Smoke test no iOS Simulator + Android Emulator (ou device real)
- Mata app no meio do wizard, reabre → prompt aparece e estado retorna
- Airplane Mode → captura 5 medidas → sai/volta o WiFi → sync silencioso

PARE e reporte:
- TypeScript clean (zero novos erros em mobile/)
- Lista completa de arquivos criados/alterados
- Screenshots dos cenários da seção 7 da spec
- `MILESTONE-3-STATUS.md` gerado com:
  - Sumário do que ficou pronto
  - Decisões registradas (qual lib de persistência usada, padrão de Zustand,
    qualquer ambiguidade resolvida)
  - Limitações conhecidas (ex: "comparativo histórico só funciona se sessão
    anterior usar o mesmo template")
  - Como completar a validação real (cenários da seção 7)

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL ANTES DO COMMIT
═══════════════════════════════════════════════════════════════════════

Eu vou:
1. Revisar o código aqui no Cowork (focar em store, telas-chave, integração com forms.tsx)
2. Possivelmente pedir ao Vercel preview ou Expo dev build pra rodar os
   cenários da seção 7
3. Aprovar ou pedir ajustes

Quando eu aprovar, você executa o commit + push. A mensagem do commit deve
documentar:
- Que estrutura de telas foi criada
- Que persistência foi usada (escolha técnica)
- Que limitações conhecidas existem
- Pre-existing failing test (se ainda relevante)

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- Lib de persistência ambígua (descobrir AsyncStorage vs MMKV no projeto)
- Padrão de Zustand divergente entre stores existentes
- Tela existente quebra quando é estendida
- Engine M2 retorna erro inesperado em fixture conhecido
- Necessidade de adicionar nova lib/dependência
- Templates assessment ainda não foram criados em prod (se a UI não tiver
  templates pra carregar nos testes manuais, a gente cria 1-2 ad-hoc)
- Validação de range tem caso ambíguo (ex: 250kg é absurdo? E 200kg pra um
  bodybuilder profissional?)

**Não invente UX nem flow não-especificado.** Se a spec não disse, pergunte.

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. BLOCO B1 → reportar → aguardar aprovação
3. BLOCO B2 → reportar (com screenshots) → aguardar aprovação
4. BLOCO B3 → reportar (com screen-recording) → aguardar aprovação
5. BLOCO B4 → reportar → aguardar aprovação
6. BLOCO C (validação manual + commit + push)

Cada PARADA é real. Não encadeie blocos sem confirmação minha.

COMECE PELO BLOCO A.
