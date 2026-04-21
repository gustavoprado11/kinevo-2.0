# Fase 2 — Unificar "Texto para Treino" como aba do painel de IA

**Pré-leitura obrigatória:** `00-visao-geral.md` e `01-fase-1-embutir-painel-ia.md`.
Pode rodar em paralelo à Fase 1.5 (mexem em arquivos diferentes), mas depende da Fase 1 estar mergeada.

## 1. Objetivo

Hoje o `AiPrescribePanel` ("Texto para Treino") vive como um botão separado na barra de ações do construtor (ícone `FileText`, `ViewMode='ai_prescribe'`). Essa dualidade foi mantida na Fase 1 por segurança; agora consolidamos tudo no painel de IA unificado.

No fim da Fase 2:

- O botão `FileText` separado **não existe mais** na barra de ações.
- O `ProgramBuilderClient` **não tem mais** `BuilderViewMode='ai_prescribe'` — o enum volta a ser `'normal' | 'preview' | 'compare'`.
- O painel de IA (`<AiPrescriptionPanel />`) agora tem **duas abas** funcionais: "A partir do aluno" e "A partir de texto".
- A UX de "cole o texto, IA parseia, exercícios vão pro treino ativo" segue funcionando igual.

## 2. O que fica fora de escopo

- Mudar o prompt de `parse-text` ou o shape de `ParseTextResponse`.
- Mudar o comportamento de matching de exercícios ("matched" / "unmatched") — já é bom, não mexer.
- Juntar o fluxo de "A partir de texto" no mesmo estado do fluxo "A partir do aluno" (não faz sentido; são modos de uso diferentes).

## 3. Arquitetura alvo

A Fase 1 já montou o `AiPrescriptionPanel` com as abas **declaradas**, mas só a aba "A partir do aluno" foi implementada — a aba "A partir de texto" aparecia desabilitada (ou escondida; ver decisão da Fase 1 seção 4.3).

A Fase 2 implementa a aba "A partir de texto" **extraindo o corpo do atual `AiPrescribePanel`** para dentro do painel unificado. A lógica de parsing (`POST /api/prescription/parse-text`) e inserção de exercícios no treino ativo é preservada 1:1.

## 4. Arquivos a tocar

### Criar
- `web/src/components/programs/ai-prescription-panel/text-tab.tsx` — nova aba. Recebe as mesmas props que o atual `AiPrescribePanel` (`exercises`, `workouts`, `activeWorkoutId`, `onAddExerciseToWorkout`, `onCreateWorkout`). Internamente, reusa ~80% do conteúdo atual.

### Editar
- `web/src/components/programs/ai-prescription-panel.tsx` — habilitar a aba "A partir de texto", renderizar `<TextTab />`.
- `web/src/components/programs/program-builder-client.tsx`:
  - Remover o botão `FileText` da barra de ações (linhas ~1328–1338 no código pré-Fase-1; confirmar posição após a Fase 1).
  - Remover `BuilderViewMode='ai_prescribe'` do tipo e todas as referências (`handleEnterAiPrescribe`, `handleExitAiPrescribe`, branches `builderViewMode === 'ai_prescribe'`).
  - Remover a renderização inline do `<AiPrescribePanel>` antigo — a aba do painel unificado assume.
  - Ajustar layout: onde antes o modo `ai_prescribe` mudava `max-w-6xl flex gap-8` (ver linhas ~1810–1812 originais), revisar o layout para só considerar `preview`.

### Deletar
- `web/src/components/programs/ai-prescribe-panel.tsx` — **apagar depois** de mover o conteúdo para `text-tab.tsx`. Verificar que nada mais o importa (`grep -r "AiPrescribePanel\b" web/src/`).
- `web/src/components/programs/__tests__/ai-prescribe-panel.test.tsx` — mover os testes relevantes para `text-tab.test.tsx` ou adaptá-los; deletar o arquivo original depois.

### Não mexer
- `web/src/app/api/prescription/parse-text/route.ts` — a API segue idêntica.
- Types `ParseTextResponse` e `ParsedExercise`.

## 5. Passos de execução

### 5.1 Extrair o corpo do `AiPrescribePanel` para `TextTab`

Copiar o conteúdo de `ai-prescribe-panel.tsx` para `ai-prescription-panel/text-tab.tsx`. Ajustes:

- Remover o header do painel (título, botão X) — isso agora vive no `AiPrescriptionPanel` pai, não na aba.
- Remover o prop `onClose` — idem, agora é do pai.
- Manter o textarea, botão "Gerar", estados de loading/erro/sucesso, lista de exercícios parseados (matched/unmatched).
- Layout: padding menor (a aba já está dentro do container com padding do painel).

### 5.2 Remover o toggle de view-mode do construtor

No `program-builder-client.tsx`:

1. Atualizar o tipo: `export type BuilderViewMode = 'normal' | 'preview' | 'compare'` (sem `'ai_prescribe'`).
2. Remover `handleEnterAiPrescribe` e `handleExitAiPrescribe`.
3. Remover o botão com ícone `FileText` e tooltip "Texto para Treino".
4. Remover os branches que testavam `builderViewMode === 'ai_prescribe'` — existem em pelo menos 4 lugares (atualizar `max-w` condicional, remover a renderização do `<AiPrescribePanel>`, etc.).
5. Rodar `tsc --noEmit` — qualquer uso do literal `'ai_prescribe'` vira erro de tipo. Corrigir todos.

### 5.3 Ativar a aba no painel

Em `ai-prescription-panel.tsx`, descomentar/adicionar a aba "A partir de texto", renderizando `<TextTab ...props />` com os mesmos props que o `ProgramBuilderClient` hoje passa pro `AiPrescribePanel`.

Estado da aba ativa:

- Default ao abrir o painel pela primeira vez na sessão: `'student'`.
- Preservar aba ativa entre open/close do painel (useState no pai).

### 5.4 Testes

- Mover `ai-prescribe-panel.test.tsx` → `text-tab.test.tsx`, ajustar imports e renderização (agora renderiza a aba dentro do painel, não o componente solto).
- Adicionar teste: abrir painel, clicar na aba "A partir de texto", colar texto, clicar "Gerar" → exercícios matched são adicionados ao treino ativo via `onAddExerciseToWorkout`.
- Teste de regressão: se tem dois treinos ("Treino A" e "Treino B") e o texto colado tem só um, exercícios vão pro treino **ativo** (o atualmente aberto no canvas).

## 6. Checklist final

- [ ] `TextTab` implementada e testada.
- [ ] `AiPrescriptionPanel` com duas abas funcionais.
- [ ] `ai-prescribe-panel.tsx` deletado.
- [ ] `BuilderViewMode='ai_prescribe'` e botão `FileText` removidos.
- [ ] `tsc --noEmit` verde.
- [ ] Todos os testes verdes.
- [ ] Regressão: "Texto para Treino" continua funcionando igual, só mudou de lugar.

## 7. Armadilhas conhecidas

- **Estado interno do TextTab.** Hoje o `AiPrescribePanel` mantém estado local de texto, resultado, stats. Se o treinador muda de aba pra "A partir do aluno" e volta, **queremos preservar o texto** (ruim perder o que foi colado). Usar `useState` no nível do `AiPrescriptionPanel` pai em vez de dentro do `TextTab`, ou usar key estável para não desmontar a aba inativa (preferir manter montada via `display: none` do contrário). **Decisão:** abas ficam sempre montadas, só uma visível — preserva estado automaticamente.
- **activeWorkoutId pode ser null.** Se o construtor está vazio, não existe treino ativo. Hoje o `AiPrescribePanel` trata isso criando um treino novo. Preservar essa lógica. Se o treinador acabou de gerar com IA e o primeiro treino existe, o ativo já estará setado.
- **Conflito visual com geração em andamento (Fase 1.5).** Se a aba "A partir do aluno" está no meio de uma geração streaming, e o treinador pula pra "A partir de texto" e gera algo — pode adicionar exercícios no meio de aulas sendo preenchidas pelo worker da Edge Function. **Decisão:** se `status === 'generating'` do progresso, desabilitar a aba "A partir de texto" com tooltip "Aguarde a geração atual terminar". Não é um cenário comum; proteção simples.
- **Deletar o arquivo antigo.** Garantir que não haja import residual: `grep -r "ai-prescribe-panel\b" web/src/` antes de deletar.
