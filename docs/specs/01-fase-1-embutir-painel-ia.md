# Fase 1 — Embutir o painel de IA dentro do Construtor de Treinos

**Pré-leitura obrigatória:** `00-visao-geral.md` (decisões já tomadas, invariantes).

## 1. Objetivo

Migrar o fluxo completo de prescrição com IA (hoje em `/students/[id]/prescribe`) para um **painel lateral** dentro do construtor de treinos (`ProgramBuilderClient`). No fim da Fase 1, a rota `/prescribe` redireciona para o construtor, os dois botões "Novo com IA" do dashboard são removidos, e o treinador aciona IA por um único botão dentro do construtor.

**Esta fase não inclui** streaming parcial (Fase 1.5), unificação de "Texto para Treino" como aba (Fase 2), ajustes iterativos pós-geração (Fase 3), nem IA por aula (Fase 4).

## 2. O que fica fora de escopo

- Não mexer em `AiPrescribePanel` (o "Texto para Treino" atual). Ele continua como está na barra de ações com o ícone `FileText`. Fase 2 consolida.
- Não mudar o schema da LLM, do prompt, das tabelas do Supabase ou dos types `PrescriptionOutputSnapshot` / `StudentPrescriptionProfile`.
- Não trocar OpenAI por Anthropic, nem vice-versa. O pipeline de geração é caixa-preta nesta fase.
- Não adicionar streaming. A geração continua sendo "clica → espera 15–30s → aparece".

## 3. Arquivos a tocar

### Criar
- `web/src/components/programs/ai-prescription-panel.tsx` — componente do painel. Exporta `<AiPrescriptionPanel />`.
- `web/src/components/programs/ai-prescription-panel/student-tab.tsx` — conteúdo da aba "A partir do aluno". Quase todo o corpo atual de `PrescribeClient` vive aqui.
- `web/src/components/programs/ai-prescription-panel/use-prescription-agent.ts` — hook que encapsula o estado do stepper (`pageState`, `profile`, `agentState`, `questions`, `answers`, `selectedFormIds`, `handleAnalyze`, `handleGenerate`) para ser consumido pela aba.
- `web/src/components/programs/__tests__/ai-prescription-panel.test.tsx` — cobertura do painel (ver seção 5).

### Editar
- `web/src/components/programs/program-builder-client.tsx`
  - Adicionar estado `aiPanelOpen: boolean` e tab state `aiPanelTab: 'student' | 'text'` (na Fase 1, só `'student'` é implementada; `'text'` permanece redirecionando para o `AiPrescribePanel` existente via o botão `FileText` antigo — a unificação é Fase 2).
  - Adicionar botão primário **"✨ Gerar com IA"** na barra de ações do construtor (ver seção 4.2 para posição e estilo).
  - Renderizar `<AiPrescriptionPanel>` quando `aiPanelOpen === true`.
  - Ao abrir via query-param `?mode=ai` na montagem, setar `aiPanelOpen = true` uma única vez.
  - Preservar o comportamento atual de `?source=prescription&generationId=...` (hidratação do programa gerado).

- `web/src/app/students/[id]/student-detail-client.tsx`
  - **Remover** `handlePrescribeAI` e as duas props/callbacks que disparam `/prescribe`:
    - Linha ~532 — remover `onPrescribeAI={trainer.ai_prescriptions_enabled ? handlePrescribeAI : undefined}` do `<ActiveProgramDashboard>`.
    - Linhas ~686 a ~690 — remover o botão "Novo com IA" inline no cartão "Próximos Programas".
  - Se `ActiveProgramDashboard` aceitar `onPrescribeAI` como prop obrigatória ou usada internamente, **remover a prop da interface** e limpar o código interno que condicionalmente rendereia o botão.

- `web/src/components/students/active-program-dashboard.tsx` (provável)
  - Remover a prop `onPrescribeAI?: () => void` e qualquer branch `if (onPrescribeAI)` que renderizava o botão com ícone Sparkles "Novo com IA". Ler o arquivo antes de editar, nome pode variar.

- `web/src/app/students/[id]/prescribe/page.tsx`
  - Substituir conteúdo por um redirect permanente para `/students/${params.id}/program/new?mode=ai`. Usar `redirect()` do `next/navigation` com status 308 (permanent). Preservar query params existentes se houver (raro, mas `?scheduled=true` deve virar `?mode=ai&scheduled=true`).

### Remover (ao final da fase, depois de confirmar que nada mais importa)
- `web/src/app/students/[id]/prescribe/prescribe-client.tsx` — apagar depois da Fase 1 funcionando end-to-end. Se achar mais seguro, mantenha por 1 sprint e delete em follow-up.
- Imports de `PrescribeClient` em `prescribe/page.tsx` (o arquivo só tem o redirect agora).

## 4. Passos de execução

### 4.1 Extrair lógica em `usePrescriptionAgent`

Hoje o `PrescribeClient` (~700 linhas) mistura: layout, estado, side effects e UI. A Fase 1 pede que a **lógica** (estado + ações) seja extraída para um hook reutilizável, e o layout seja reescrito como painel.

O hook deve expor pelo menos:

```ts
export function usePrescriptionAgent(args: {
  studentId: string
  prescriptionData: PrescriptionData
}) {
  return {
    // state
    pageState,        // 'anamnese' | 'analyzing' | 'questions' | 'generating' | 'done' | 'error'
    profile,          // StudentPrescriptionProfile | null
    agentState,       // PrescriptionAgentState | null
    analysis,         // PrescriptionContextAnalysis | null
    questions,        // PrescriptionAgentQuestion[]
    answers,          // Record<string, string>
    selectedFormIds,  // string[]
    error,            // string | null
    generationId,     // string | null   (setado quando 'done')

    // actions
    setProfile,
    setAnswers,
    toggleForm,            // (id: string) => void
    startAnalysis,         // () => Promise<void>
    submitAnswersAndGenerate, // () => Promise<void>
    reset,                 // volta pro estado inicial; usar quando treinador fecha o painel
    sendQuestionnaire,     // () => Promise<void>  (ver QuestionnairePromptCard atual)
  }
}
```

**Critério de aceitação:** o hook é testável sem montar o painel (testes unitários com `renderHook`).

### 4.2 Adicionar botão "✨ Gerar com IA" no construtor

**Posição.** Hoje a barra de ações tem, da esquerda pra direita: ícone celular (preview), ícone comparar, ícone `FileText` (texto para treino atual). Então o grupo de saves ("Salvar Modelo", "Agendar na Fila", "Ativar como Atual") — veja `program-builder-client.tsx` linhas ~1302 a ~1370.

**Inserir o novo botão à esquerda desse grupo de toggles** (antes do ícone celular), separado por divisor visual sutil, ocupando mais espaço. Classe: botão com label, estilo *primary ghost* da paleta violet (roxo) do projeto. Ícone: `Sparkles` do `lucide-react`. Label: "Gerar com IA".

Se `trainer.ai_prescriptions_enabled !== true`, o botão **não renderiza**.

Comportamento: `onClick` → `setAiPanelOpen(prev => !prev)`. Quando aberto, botão ganha variant "active" (igual como preview/compare já fazem).

### 4.3 Implementar `<AiPrescriptionPanel />`

**Layout.**

- Painel fixo na direita do canvas, largura padrão 440px.
- Desktop (≥1280px): painel empurra o canvas (layout split), não sobrepõe.
- Entre 1024–1280px: painel sobrepõe como drawer (overlay com backdrop click-to-close).
- <1024px: painel vira fullscreen modal (já que o construtor em si é desktop-first, isso é um fallback).

**Header do painel.** Altura ~56px.
- Esquerda: ícone `Sparkles` + título **"IA · {student.name}"** truncado.
- Direita: botão `X` (ícone) fecha o painel.

**Abas.** Logo abaixo do header, duas abas:
- **"A partir do aluno"** (`student`) — ativa por padrão. Implementação completa nesta fase.
- **"A partir de texto"** (`text`) — na Fase 1, este tab está **visível mas desabilitado** com tooltip "Em breve" (a aba real vem na Fase 2). Alternativa: não renderizar a aba nesta fase e habilitar só na Fase 2. **Decisão:** não renderizar na Fase 1 (mantém o botão `FileText` atual da barra de ações funcionando para Texto para Treino; menos mudanças simultâneas).

**Conteúdo da aba "A partir do aluno".** Rendera um dos estados abaixo conforme `pageState` do hook:

| pageState | Renderiza |
|---|---|
| `anamnese` | `<PrescriptionStepper currentStep={0} />` + `<QuestionnairePromptCard />` (se aplicável) + `<FormSubmissionsCard />` + `<PrescriptionProfileForm compactMode />` com botão "Analisar contexto" no rodapé do painel |
| `analyzing` | `<PrescriptionStepper currentStep={1} />` + `<GenerationStatus phase="analyzing" />` |
| `questions` | `<PrescriptionStepper currentStep={1} />` + `<AgentQuestionsPanel />` com botão "Gerar programa" no rodapé |
| `generating` | `<PrescriptionStepper currentStep={2} />` + `<GenerationStatus phase="generating" />` |
| `done` | confirmação compacta ("Programa gerado. Revise à esquerda.") + botão "Fechar painel". O construtor já estará hidratado via `builder-mapper` (igual hoje). |
| `error` | mensagem de erro + botão "Tentar de novo" |

**Importantíssimo:** o rodapé do painel é "sticky", com o CTA principal do estado corrente ("Analisar contexto", "Gerar programa", "Tentar de novo", "Fechar"). Não misturar CTA com conteúdo scrollável.

**Modo compact.** O `PrescriptionProfileForm` já aceita a prop `compactMode` (ver `prescribe-client.tsx:285`). Passar `compactMode` aqui; se a prop não existir ou estiver inconsistente, ajustar o componente para lidar com largura de 440px sem quebrar layout.

### 4.4 Interação com o estado do construtor ao gerar

Fluxo atual do `PrescribeClient`: após geração bem-sucedida, faz `router.push('/program/new?source=prescription&generationId=...')` e sai de cena. No novo fluxo, **o construtor já está aberto**. Então:

- Quando `generateProgram()` retorna com sucesso e recebemos `generationId`:
  1. **Não redirecionar.** O construtor atual é a página certa.
  2. Atualizar a URL (via `router.replace` para não empurrar histórico) para `?source=prescription&generationId=${id}` — mantém o deeplink acessível ao refresh.
  3. Disparar o mesmo fluxo de hidratação que o construtor já tem quando detecta `generationId` na query na montagem: carregar `output_snapshot` da tabela `prescription_generations` e popular workouts no estado local do `ProgramBuilderClient`.

- **Se o treinador já tinha conteúdo no construtor** quando disparou a geração: a Fase 1 pede uma confirmação simples — um modal "Este programa tem treinos. Substituir por uma nova geração?" (botões "Substituir" / "Cancelar"). Se "Substituir", limpa o estado e hidrata. Esta confirmação é nova; não existe hoje porque o fluxo antigo sempre começava de um construtor vazio.

### 4.5 Remover os botões "Novo com IA" do dashboard

Remover referências a `handlePrescribeAI` e aos dois botões (linhas 532 e 686 em `student-detail-client.tsx`). Limpar props correlatas em `ActiveProgramDashboard`.

**Verificação:** após remover, um `grep -r "handlePrescribeAI\|onPrescribeAI\|Novo com IA" web/src/` não deve retornar nada (exceto talvez a própria spec de redirect em `prescribe/page.tsx`, que não referencia a função — só redireciona).

### 4.6 Redirect `/prescribe`

Em `web/src/app/students/[id]/prescribe/page.tsx`, substituir por:

```ts
import { redirect } from 'next/navigation'

export default function PrescribeRedirect({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  const scheduled = searchParams?.scheduled === 'true' ? '&scheduled=true' : ''
  redirect(`/students/${params.id}/program/new?mode=ai${scheduled}`)
}
```

Testar manualmente: abrir `/students/<id>/prescribe` no navegador → deve pular para `/students/<id>/program/new?mode=ai`.

### 4.7 Tratar `?mode=ai` no construtor

No `ProgramBuilderClient`, no `useEffect` de montagem (já existe um que lida com `generationId`), detectar `mode=ai` e chamar `setAiPanelOpen(true)`.

Se `?mode=ai` **e** `?source=prescription&generationId=...` vierem juntos, abrir o painel **no estado `done`** (programa já gerado, painel mostra confirmação/reabre opção de regenerar). Isso vai casar com refreshes e deeplinks.

## 5. Testes obrigatórios

### 5.1 Unitários — `usePrescriptionAgent`

- Fluxo feliz: `anamnese` → `startAnalysis()` → `analyzing` → `questions` → `submitAnswersAndGenerate()` → `generating` → `done` com `generationId` setado.
- Error handling: `startAnalysis` lança → estado vai pra `error` com mensagem.
- `reset()` volta pra `anamnese` com profile preservado (não queremos perder o formulário).

### 5.2 Componente — `<AiPrescriptionPanel />`

- Renderiza com `pageState='anamnese'` por padrão quando aberto fresh.
- Clica "Analisar contexto" → chama o hook, renderiza `<GenerationStatus phase="analyzing" />`.
- Submete respostas → renderiza `<GenerationStatus phase="generating" />`.
- Estado `done` mostra CTA "Fechar painel".
- Botão X fecha o painel (dispara callback).

### 5.3 Integração — `<ProgramBuilderClient />` com painel

- Monta construtor com `?mode=ai` → painel abre automaticamente, aba `student` ativa, `pageState='anamnese'`.
- Monta construtor com `?source=prescription&generationId=<id>` → painel abre em `done`, canvas mostra treinos hidratados. (Mock de `prescription_generations` via MSW ou stub.)
- Com construtor já preenchido, abrir painel + gerar → modal de confirmação aparece.

### 5.4 Smoke e2e (Playwright se existir; senão, teste integrado via `render` do App Router)

Script: abrir `/students/<id>` → clicar em "Criar Novo" → chega em `/program/new` → clicar em "Gerar com IA" → preencher mínimo de anamnese → gerar → ver treino no canvas → clicar "Ativar como Atual" → redireciona para o dashboard com programa ativo.

### 5.5 Redirect

Abrir `/students/<id>/prescribe` → espera ver URL final `/students/<id>/program/new?mode=ai` e o painel aberto.

## 6. Checklist final antes de abrir PR

- [ ] `usePrescriptionAgent` extraído, testado, com tipos exportados.
- [ ] `<AiPrescriptionPanel />` implementado com aba "student".
- [ ] Botão "Gerar com IA" na barra de ações, condicional à feature flag.
- [ ] Construtor abre painel quando `?mode=ai`.
- [ ] `/students/[id]/prescribe` redireciona para `/program/new?mode=ai`.
- [ ] Botões "Novo com IA" removidos do dashboard.
- [ ] `prescribe-client.tsx` deletado (ou marcado como `// TODO remove in next sprint` se preferir).
- [ ] Nenhum `grep` sobrevivente de `handlePrescribeAI` ou `onPrescribeAI`.
- [ ] Todos os testes passando.
- [ ] `?source=prescription&generationId=...` continua funcionando no construtor.
- [ ] Deploy em staging + walk-through manual do fluxo completo com um aluno real do seed.

## 7. Armadilhas conhecidas

- **`PrescriptionProfileForm.compactMode`** — existe a prop (`prescribe-client.tsx:285`) mas o layout pode ter assumido largura ≥ 640px. Testar em 440px antes de assumir que "só usar a prop".
- **`scheduled=true`** — hoje o `PrescribeClient` não propaga isso; os botões "Novo com IA" do dashboard já vinham sem essa info. Como estamos removendo os botões, o caso `mode=ai&scheduled=true` só ocorre via deeplink ou redirect — é suportado porque o próprio construtor já tem o contexto "scheduled" (o grupo de botões do rodapé troca entre "Agendar na Fila" / "Ativar como Atual" baseado em `isStudentContext` e outras flags). **Verificar que ao gerar com `?mode=ai&scheduled=true` o construtor prioriza "Agendar na Fila" como CTA primária.**
- **Double-effect** — ao abrir painel por `?mode=ai` via `useEffect`, o efeito pode disparar duas vezes em dev (StrictMode). O setter de boolean é idempotente, então está ok; não implementar lógica com side effect aqui.
- **`PrescribeClient` usa `AppLayout`** para envolver tudo. O painel vai estar dentro do layout do construtor, que já tem seu próprio AppLayout. Não aninhe layouts.
- **Migration 035.** A tabela `prescription_generations` tem `expires_at = now + 90 days`. Links antigos (`?generationId=...`) podem estar expirados — o construtor precisa tratar o erro de "generation expirou" graciosamente (mostrar toast "Este programa expirou; gere novamente").
- **Testes de e2e precisam de mock de LLM** — a geração chama OpenAI real. Usar `nock`/`msw` ou feature flag `AI_MOCK_MODE=true` com stub de `PrescriptionOutputSnapshot` (se não existir, criar um pequeno utilitário de seed em `web/src/lib/prescription/__fixtures__/`).
