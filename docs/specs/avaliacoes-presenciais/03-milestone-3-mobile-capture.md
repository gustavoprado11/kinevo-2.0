# Milestone 3 — Mobile capture flow

**Pré-requisitos:** ler `00-visao-geral.md`. M1 (data foundation, migration 122 em prod) e M2 (engine de fórmulas) estão completos.

**Goal:** entregar a primeira UI real consumindo M1+M2. Treinador no celular consegue: ver lista de sessões, agendar nova, capturar medições com o aluno na frente, ver resultado calculado e comparado com sessão anterior.

**Plataforma:** mobile (React Native / Expo).

**Dura:** 10-15 dias úteis. Maior que M1+M2 somados.

**Branch:** sem branch — direto em main, sem commit/push até autorização.

---

## 1. Por que esse milestone é qualitativamente diferente

M1 e M2 foram backend/shared puros. Erro = teste falha no laptop. Fix = corrigir e reaplicar.

M3 roda no celular do treinador na sala de avaliação. Erro = treinador na frente do aluno tem app travado em momento crítico. Fix = patch via OTA ou app update (latência de horas até dias).

Por isso M3 prioriza, em ordem decrescente:

1. **Robustez offline-friendly** — WiFi de academia é instável. App não pode quebrar se conexão cair no meio.
2. **Recovery de meio-processo** — crash recovery pra retomar wizard onde parou.
3. **UX fast-input** — anotar 25 medições em 15min sem fricção.
4. **Validação humana de range** — peso = 7,5 (esqueceu o 7) deve gerar warning, não silêncio.
5. **Integração não-disruptiva** — terceira aba dentro de `forms.tsx` sem quebrar Respostas/Templates existentes.

A complexidade não é técnica (React Native nativo, sem libs novas), é de produto. Cada decisão de UX importa.

---

## 2. O que entra no escopo

### 2.1 Novos question types no schema (consumidos por novos renderers)

A tabela `form_templates.schema_json` já existe e é dinâmica. Os tipos atuais (`short_text`, `long_text`, `single_choice`, `scale`, `photo`) continuam intocados. Adicionamos cinco tipos novos, exclusivos para `category='assessment'`:

| Tipo | Renderer | Uso |
|---|---|---|
| `numeric_unit` | NumericUnitInput | Uma medida única (peso, altura, dobra individual) |
| `bilateral_numeric` | BilateralNumericInput | Dois inputs lado-a-lado (braço D/E, perna D/E) |
| `multi_attempt_numeric` | MultiAttemptInput | 2-3 tentativas, retorna mediana/melhor (dobras com 2 medidas) |
| `computed` | ComputedDisplay | Read-only; calcula de inputs anteriores em runtime (IMC) |
| `protocol` | ProtocolWizard | Agrupa N skinfolds + cálculo de densidade/%BG (Jackson&Pollock 7) |

Os tipos canônicos vivem em `shared/types/assessments.ts` (já criados em M1, ver seção 3 do `01-milestone-1-data-foundation.md`).

### 2.2 Telas novas

| Tela | Path | Função |
|---|---|---|
| **Lista de sessões (em `forms.tsx`)** | `mobile/app/(trainer-tabs)/forms.tsx` (estendido) | Terceira aba "Presenciais" ao lado de Respostas/Templates |
| **Sessão em andamento** | `mobile/app/assessments/[sessionId].tsx` | Checklist de testes + progresso + finalizar |
| **Wizard de medição** | `mobile/app/assessments/[sessionId]/measure/[testId].tsx` | Fullscreen, big input, multi-attempt slots, anatomia |
| **Resultado** | `mobile/app/assessments/[sessionId]/result.tsx` | Quick stats + comparativo + sugestões básicas |
| **Modal: criar sessão** | `mobile/components/trainer/assessments/CreateSessionModal.tsx` | Selecionar aluno + template + data → cria via RPC |

### 2.3 Componentes novos reutilizáveis

```
mobile/components/trainer/assessments/
├── SessionListItem.tsx           # Card na lista (dentro de forms.tsx)
├── SessionStatusBadge.tsx        # 'agendada' | 'em andamento' | 'concluída' | 'em atraso'
├── CreateSessionModal.tsx        # Modal full-screen, escolhe aluno + template
├── TestChecklistItem.tsx         # Item da lista de testes da sessão (concluído/atual/pendente)
├── inputs/
│   ├── NumericUnitInput.tsx
│   ├── BilateralNumericInput.tsx
│   ├── MultiAttemptInput.tsx
│   ├── ComputedDisplay.tsx
│   └── ProtocolWizard.tsx        # mais complexo — fluxo aninhado de N skinfolds
├── MeasurementWizard.tsx         # Container do wizard (header, progress, footer)
├── AnatomyDiagram.tsx            # SVG simples mostrando ponto da medida (tríceps, supra-ilíaca, etc)
├── ResultStatsCard.tsx           # Quick stats (peso, %BG, IMC + deltas)
├── ResultComparisonRow.tsx       # Linha de comparativo "métrica → sessão anterior → atual → delta"
└── HistoryMiniChart.tsx          # Mini gráfico de série temporal (recharts ou SVG nativo)
```

### 2.4 Hooks novos

```
mobile/hooks/
├── useAssessmentSessionLifecycle.ts    # combina create + save + finalize com loading/error
├── useAssessmentMeasurementForm.ts     # state de uma medição em andamento (dirty, valid, attempts)
├── useAssessmentSessionDraft.ts        # draft local persistido (offline-friendly)
├── useStudentMetricsTimeline.ts        # query de série temporal de uma métrica do aluno
└── useAssessmentResultComparison.ts    # busca sessão anterior + monta deltas
```

`useAssessmentSessions` e `useAssessmentSession` já existem (placeholders M1) — só evoluir.

### 2.5 State management

Usar **Zustand** (já no projeto, ver `web/src/stores/sidebar-store.ts` para padrão; mobile pode ter um `mobile/stores/`). Criar `mobile/stores/assessmentDraftStore.ts`:

```ts
interface AssessmentDraft {
  session_id: string;
  template_snapshot: AssessmentTemplateSchema;
  measurements: AssessmentMeasurement[];   // já capturadas localmente
  current_test_id: string | null;          // teste em foco no wizard
  current_attempts: Record<string, number[]>; // multi-attempt em progresso
  is_dirty: boolean;
  last_synced_at: string | null;
}

// Persistir em AsyncStorage com expo-secure-store ou MMKV (verificar o que o
// projeto já usa).
```

Esse store é o coração do offline-friendly. Toda medição vai pra ele primeiro, e SÓ depois é enviada via RPC.

### 2.6 Estratégia offline e recovery

Não vamos fazer "offline puro" (sem conexão pelo dia inteiro). Vamos fazer **resiliência a perda momentânea de WiFi**:

- **Toda medição** vai pra `assessmentDraftStore` PRIMEIRO. Persistido localmente.
- **Sync para o backend** acontece em batches:
  - A cada N (configurável, default 5) medições
  - No tap em "Próximo teste" do wizard
  - No tap em "Finalizar sessão"
- **Falha de sync** mostra banner "Conectando..." sem bloquear UX. Retry exponencial em background.
- **App crashou no meio**: ao reabrir, detecta draft pendente, oferece "retomar avaliação?" antes de tela de login normal.
- **Finalize** exige sync completo (não pode finalizar com medições não-sincronizadas). Se offline, aviso claro: "Conecte para finalizar".

### 2.7 Validação UX de range

A engine M2 valida tipos e ranges fundamentais (peso > 0, etc). UX adiciona uma camada de sanidade humana:

| Campo | Range warning (não bloqueia) |
|---|---|
| Peso | < 30kg ou > 200kg → "Confirma que é {X}kg?" |
| Altura | < 1,40m ou > 2,20m → "Confirma {X}m?" |
| Dobra | > 50mm → "Dobra grande, confirma {X}mm?" |
| Cintura | < 50cm ou > 150cm | confirmar |

Warning é um modal de confirmação one-tap, não um bloqueio. Treinador profissional pode ter caso fora do range.

### 2.8 Integração com tab existente

`mobile/app/(trainer-tabs)/forms.tsx` atualmente tem `Tab = "responses" | "templates"`. Estender para `"responses" | "templates" | "assessments"`. Manter:

- O FilterChips pattern (mesma estética, novos chips: Todas / Em atraso / Próximas / Concluídas)
- O `AssignFormModal` para Respostas
- O `FormBuilderModal` para Templates (que ganha suporte aos novos question types)
- A SubmissionDetailSheet para Respostas

Adicionar:
- Novo modal `CreateSessionModal` (similar ao Assign mas pega template + aluno + data)
- Lista de sessões reaproveitando o estilo dos cards existentes

---

## 3. Padrão visual

Seguir tokens já estabelecidos:

```
mobile/theme/colors.ts:
  brand.primary: '#7c3aed'        // CTAs principais, navigation
  status.presencial: '#8b5cf6'    // status "presencial" (já tem!)
  status.presencialBg: '#f5f3ff'  // bg para badges presencial
```

E os tokens do `evaluation-preview` (shared web/mobile). Mesmo padrão de cards translúcidos, radius 14-20, big-input radius 10.

**Iconografia:** lucide-react-native (já no projeto). Sugestões:
- Lista de sessões: `Activity`, `Ruler`
- Status: `Calendar`, `Clock`, `CheckCircle2`, `AlertCircle`
- Wizard: `ChevronLeft`, `Check`, `RotateCcw` (refazer tentativa)
- Result: `TrendingUp`, `TrendingDown`, `Share2`

---

## 4. Acceptance criteria

### Funcionalidade

- ✅ Aba "Presenciais" aparece em `(trainer-tabs)/forms.tsx` ao lado de Respostas/Templates sem regredir nenhuma das duas
- ✅ Lista de sessões mostra: agendadas próximas, em andamento, em atraso (>7d sem completar), concluídas recentes
- ✅ Tap em "Nova sessão" abre modal com seleção de aluno + template + data opcional → chama `create_assessment_session` RPC
- ✅ Tap em sessão agendada/em-andamento abre tela de checklist
- ✅ Tap em teste do checklist abre wizard de medição
- ✅ Wizard suporta os 5 novos question types
- ✅ Wizard salva medições localmente (Zustand + AsyncStorage)
- ✅ Wizard sincroniza com `save_assessment_measurements` em batches
- ✅ "Finalizar sessão" calcula `computed_metrics` via M2 engine, chama `finalize_assessment_session`, mostra resultado
- ✅ Tela de resultado mostra: %BG, IMC, peso, comparativo com sessão anterior (se houver), classificação P&W
- ✅ Em caso de crash mid-session, ao reabrir o app aparece prompt "Continuar avaliação de {aluno}?"

### Qualidade

- ✅ TypeScript compila sem erros novos em `mobile/`
- ✅ Sem regressão visual nas telas existentes (Respostas, Templates)
- ✅ Empty state da aba "Presenciais" tem estética alinhada com EmptyState existente
- ✅ Loading states em todas as ações de rede (criar, salvar, finalizar)
- ✅ Error states tratados (RPC error, validação engine, range warnings)
- ✅ Haptic feedback nas transições principais (Haptics.impactAsync, padrão do projeto)
- ✅ Funciona em iOS e Android (test build em ambos)

### Validação manual

- ✅ Em modo offline (Airplane Mode): consigo abrir uma sessão em andamento e adicionar medições; ao voltar o WiFi, sync acontece silenciosamente
- ✅ Mato o app no meio do wizard: ao reabrir, prompt de retomar aparece e estado é restaurado
- ✅ Range warning aparece para inputs absurdos sem bloquear

---

## 5. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Wizard fica pesado com muitos testes | Lazy mount: só monta o teste atual + próximo (preload simples) |
| AsyncStorage corrompe draft | Versionamento de schema do draft, com fallback "draft inválido — descartar?" |
| ProtocolWizard com 7 dobras é uma sub-jornada | Ele tem seu próprio progress interno, separado do progress da sessão |
| TypeScript types do M1 não cobrem perfeitamente schema dinâmico | Considerar `zod` runtime parsing dos templates ao carregar — mas adiar pra M4 se for fricção |
| Comparativo histórico requer sessão anterior do mesmo template | Fallback gracioso: se não houver, mostrar "Primeira avaliação" no lugar dos deltas |
| Engine M2 lança `FormulaInputError` se site obrigatório faltar | Wizard não permite "finalizar" se medição obrigatória estiver vazia. Botão fica disabled com tooltip "Faltam X medições" |
| Erros de rede no save_assessment_measurements deixam estado dessincronizado | Banner persistente "Sincronizando..." + retry exponencial. Usuário pode sair da tela; sync continua em background |
| Big-input numérico em telas pequenas | Auto-scroll do keyboardAvoidingView. Test em iPhone SE |
| Anatomia SVG fica grande no bundle | SVGs simples (1 path por região), inline — < 5KB cada |

---

## 6. Fora de escopo (Fase 2 ou depois)

- ❌ CMJ vídeo (Fase 2)
- ❌ Auto-detecção pose detection (Fase 3)
- ❌ Balanças bluetooth (Fase 3)
- ❌ Postural analysis (Fase 2)
- ❌ Recomendações automáticas que viram bloco no programa (Fase 2)
- ❌ PDF gerado in-app (Fase 1, mas Milestone **5**)
- ❌ Painel multi-trainer / estúdio (Fase 2)
- ❌ Reavaliação inteligente / sugestão de cadência (Fase 3)
- ❌ Builder de pacote no mobile (deixa pro M4 web — mobile só consome templates já criados)
- ❌ Edição de sessões já finalizadas (read-only após finalize)

---

## 7. Validação manual antes de pushar

Cenários obrigatórios a executar em **simulador iOS e Android**:

1. **Happy path — antropometria simples (5 minutos):**
   - Trainer cria sessão com template "Antropometria mínima" (peso, altura, cintura, quadril, IMC computed, RCQ computed)
   - Captura todas as medidas via wizard
   - Tap finalizar → resultado mostra IMC, RCQ classificações
   - Cleanup do test data (deletar via SQL/MCP)

2. **Sessão com dobras (Petroski 4):**
   - Cria sessão, captura 4 dobras + peso/altura
   - Engine M2 calcula densidade → %BG via Siri
   - Result mostra %BG + classificação P&W

3. **Crash recovery:**
   - Inicia sessão, captura 2 medidas, mata o app forçadamente
   - Reabre: prompt aparece, retoma do ponto certo

4. **Offline:**
   - Airplane mode ON
   - Captura 5 medidas — todas salvas localmente
   - Airplane mode OFF
   - Banner "sincronizando" some em <30s sem erro

5. **Range warning:**
   - Inputa peso = 7,5kg → warning aparece
   - Confirma → segue
   - Inputa peso = 750kg → warning aparece
   - Cancela → volta pro input

6. **Finalize bloqueado:**
   - Sessão com medição obrigatória faltando
   - Botão "Finalizar" disabled com tooltip
   - Completa medição → botão habilita

Cada cenário gera um print/screen-recording salvo em `docs/specs/avaliacoes-presenciais/m3-validation-evidence/` e listado no `MILESTONE-3-STATUS.md`.

---

## 8. Estrutura sugerida do trabalho (sub-blocos)

Por causa do tamanho, sugiro ao Claude Code dividir a implementação em sub-blocos B1, B2, B3 e parar entre eles para verificação:

- **B1 — Infraestrutura local (2 dias):**
  - assessmentDraftStore (Zustand + persistência)
  - useAssessmentSessionLifecycle, useAssessmentMeasurementForm, useAssessmentSessionDraft
  - useStudentMetricsTimeline, useAssessmentResultComparison
  - Sem UI ainda — só hooks + store + types
  - Test rapidamente via console

- **B2 — UI de inputs e wizard (4-5 dias):**
  - 5 input components (NumericUnit, Bilateral, MultiAttempt, Computed, Protocol)
  - MeasurementWizard container
  - AnatomyDiagram para skinfolds
  - Sem integração ainda com /forms — testáveis em isolamento

- **B3 — Telas e integração (4-5 dias):**
  - Forms tab estendido com aba "Presenciais"
  - Lista de sessões + filterchips
  - CreateSessionModal
  - Assessment session screen (checklist)
  - Result screen com comparativo

- **B4 — Recovery, range warnings, polish (2-3 dias):**
  - Crash recovery prompt
  - Range warning modal
  - Empty states
  - Loading/error states refinados
  - Haptic feedback consistente

Cada sub-bloco termina com PARADA pra reportar e aprovar antes de avançar.
