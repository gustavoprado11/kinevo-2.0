# Assistente — Estilo de Prescrição do Treinador (MVP)

## Status
- [x] Investigação concluída (13/jul/2026) — código mapeado, decisões de produto fechadas
- [ ] Em implementação
- [ ] Concluída

> **Para o executor:** leia `web/CLAUDE.md` INTEIRO antes de qualquer coisa. Esta spec é
> autocontida: traz as decisões fechadas, o mapa do código atual (verificado em 13/jul/2026),
> os contratos de dados, o plano faseado e os critérios de aceite. Linhas citadas podem derivar —
> confie nos nomes de arquivo/função e re-localize se necessário. NÃO commitar/pushar sem
> autorização explícita do Gustavo (WORKFLOW.md).

---

## 1. Objetivo

O treinador configura **o seu estilo de prescrição** — e o Assistente passa a montar programas
"como ele montaria". Dois insumos, combinados:

1. **Mineração** dos programas que ele já prescreveu (splits, reps, descansos, métodos,
   exercícios favoritos, volume típico);
2. **Entrevista roteirizada** dentro do `/assistente`, no formato "ask the user" (pergunta +
   opções clicáveis, uma por turno), cobrindo só o que a mineração não responde.

O resultado é um perfil estruturado (`trainers.prescription_style`, JSONB) que:
- é apresentado ao treinador como **proposta editável** antes de salvar (Aprovar/Ajustar);
- é injetado como bloco `<<ESTILO_DO_TREINADOR>>` nos turnos de prescrição do Assistente.

**Por que importa:** é o diferencial estrutural do in-app contra o MCP externo — o claude.ai não
tem os programas do treinador; o Kinevo tem. "Prescreve como EU" é o argumento de retenção.

## 2. Decisões fechadas (13/jul/2026, com Gustavo)

| # | Decisão | Valor |
|---|---|---|
| D1 | Quantos estilos por treinador | **Um só** (variações por público ficam no campo livre `special_populations`/`notes`; per-objetivo é fase futura) |
| D2 | Formato da entrevista | **Roteirizada por slots** (ordem fixa, uma pergunta por turno, opções clicáveis + "Outro"), NÃO conversa livre |
| D3 | Piso de dados para minerar | **5 programas** elegíveis (abaixo disso: entrevista completa) |
| D4 | Segurança do bloco no prompt | Delimitadores + regra de precedência (ver §7.2); tetos absolutos de volume são INVIOLÁVEIS pelo estilo |

Decisões derivadas (desta spec, ratificar na revisão):
- **D5** Turnos da entrevista **não consomem créditos** (é onboarding/configuração, não uso).
  Custo LLM registrado só no turn-trace.
- **D6** A entrevista roda **sem a ponte MCP** (não precisa de tools do Kinevo — a mineração já
  aconteceu server-side). Toolset restrito: `perguntar_estilo` + `propor_ao_treinador` + `salvar_estilo`.
- **D7** MVP injeta o estilo **só no caminho do Assistente** (command-engine). O canvas/"Gerar com
  IA" já tem personalização própria (`trainer-patterns.ts`) — unificação é fase futura.

## 3. Mapa do código existente (verificado 13/jul/2026)

**O que JÁ existe e será reutilizado (não recriar):**

| Peça | Onde | Papel aqui |
|---|---|---|
| `perguntar_treinador` (client tool sem execute → `QuestionRequest`) | `lib/assistant/command-engine.ts` (~l.537) + `hitl-types.ts` | Molde do "ask the user": a UI já renderiza pergunta + opções clicáveis + "Outro". A entrevista usa uma variante com `slot` (§6.2) |
| `propor_ao_treinador` (client tool → `ProposalRequest`) | idem (~l.543) | Proposta final do estilo com valores editáveis + Aprovar/Cancelar — a UI já existe |
| Parts persistidas `question`/`proposal` | `lib/assistant/conversations.ts` (`AssistantMessagePart`) | Persistência dos turnos da entrevista sem schema novo de mensagem |
| Motor de turno + streaming | `command-engine.ts` (`runAssistantTurn`) | A entrevista é um MODO do motor (flag), não um motor novo |
| Precedente de mineração | `lib/prescription/trainer-patterns.ts` + `trainers.prescription_patterns` (JSONB) | Prova o padrão "análise → JSONB no trainers"; NÃO reutilizar o código em si (ele minera diffs de edição do canvas, sinal diferente) |
| Árvore de programa com tudo que a mineração precisa | `lib/mcp/tools/programs.ts` (select em ~l.101: `sets, reps, rest_seconds, method_key, rounds, exercise_function, exercise_name, exercise_muscle_group, exercise_equipment, set_scheme(...)`) | Fonte das agregações (§5) |
| Detecção de turno de build + montagem do system | `command-engine.ts` (`isBuildTurn`, ~l.580 montagem do `system`) | Ponto de injeção do bloco de estilo (§7) |

**O que NÃO existe (criar):**
- Coluna `trainers.prescription_style` (JSONB) — o perfil salvo.
- Colunas `ai_conversations.kind` + `ai_conversations.style_state` — a conversa-entrevista e o
  rascunho de respostas (a tabela 209 hoje só tem id/trainer/student/title/timestamps).
- Módulo de mineração (`lib/assistant/style-miner.ts`).
- Bloco de prompt (`lib/assistant/style-block.ts`).
- Modo entrevista no motor + tools `perguntar_estilo`/`salvar_estilo`.
- Proveniência de programa: **não há** coluna `created_via`/`source` em `assigned_programs` —
  a elegibilidade da mineração usa heurística (§5.1).

## 4. Contrato de dados — `PrescriptionStyle`

Tipo em `shared/types/prescription.ts` (junto de `TrainerPatterns`). Persistido em
`trainers.prescription_style` (JSONB). Todos os campos de dose são OPCIONAIS (`null` = "sem
preferência; use os defaults do playbook de build").

```ts
export interface StyleRange { min: number; max: number }

export interface PrescriptionStyle {
    version: 1
    source: 'mined' | 'interview' | 'hybrid'
    updated_at: string                      // ISO
    mined: { programs_analyzed: number; last_mined_at: string } | null

    // ── Estrutura ──
    /** Split preferido por frequência semanal. Chave = '2'..'6'. Ex.: {"3":"Full-body A/B/C","5":"PPL + Upper/Lower"} */
    splits_by_frequency: Partial<Record<'2' | '3' | '4' | '5' | '6', string>>
    /** Convenção de nomes de sessão. Ex.: 'Por foco ("Inferior — Glúteo")' | 'Letras (Treino A/B/C)' */
    session_naming: string | null
    exercises_per_session: StyleRange | null

    // ── Dose ──
    reps_compound: string | null            // ex.: '6–8'
    reps_accessory: string | null           // ex.: '10–15'
    rest_compound_seconds: StyleRange | null
    rest_accessory_seconds: StyleRange | null
    /** Séries/semana típicas. SEMPRE clampadas nos tetos absolutos do playbook (enfatizado ≤20). */
    weekly_sets_emphasized: StyleRange | null
    weekly_sets_principal: StyleRange | null
    weekly_sets_small: StyleRange | null

    // ── Ferramentas ──
    methods_used: string[]                  // method_keys reais (kinevo_list_training_methods)
    methods_avoided: string[]
    superset_usage: 'frequente' | 'ocasional' | 'raro' | null
    /** Top exercícios por grupo muscular (nomes do catálogo). Máx. 5 grupos × 4 nomes. */
    favorite_exercises: Array<{ group: string; names: string[] }>
    avoided_exercises: string[]
    equipment_notes: string | null          // ex.: 'estúdio sem barra livre; prioriza máquinas e halteres'

    // ── Filosofia (entrevista) ──
    progression: string | null              // ex.: 'dupla progressão (reps até o teto, depois carga)'
    warmup: string | null                   // ex.: '2 séries de aproximação no 1º composto'
    special_populations: string | null      // ex.: 'idosos: sem impacto, RIR 3+'
    notes: string | null                    // texto livre do treinador
}
```

Regra de sanidade no SAVE (determinística, em código): clampar `weekly_sets_*` nos tetos do
playbook (enfatizado ≤20, principal ≤14, pequeno ≤10 no max; min ≥4), `exercises_per_session`
em [3,10], descansos em [20,300]s; strings ≤200 chars; arrays ≤10 itens. Estilo inválido nunca
entra no banco.

## 5. Mineração (`lib/assistant/style-miner.ts`)

Função pura + wrapper com DB, no molde de `trainer-patterns.ts` (análise pura sem DB, testável).

### 5.1 Programas elegíveis

- `assigned_programs` do treinador com `status IN ('active','completed','expired')` — programas
  que RODARAM (rascunho não conta como estilo) — **+ templates da Biblioteca** (autorados são
  sinal forte).
- **Proveniência (heurística, documentar a limitação):** não há coluna de origem. Para não
  aprender com programa que a própria IA criou e o treinador ativou sem tocar, EXCLUIR programas
  cujo id conste em `prescription_generations` (gerações do motor) **sem edição posterior do
  treinador** quando esse cruzamento for possível barato; caso contrário, minerar tudo e confiar
  na proposta editável como corretor. Registrar em `mined.programs_analyzed` só os contados.
- Piso: **5 elegíveis** (D3). Abaixo → `mined = null`, entrevista completa.
- Janela: os 30 mais recentes (consistente com `ANALYSIS_WINDOW` do precedente).

### 5.2 Agregações (por programa → consolidado)

Da árvore (mesmo select de `programs.ts`):

| Campo do estilo | Como derivar |
|---|---|
| `splits_by_frequency` | nº de sessões/semana (pelos `scheduled_days` ou contagem de workouts) → rotular o shape pelos grupos dominantes de cada sessão (full-body / upper-lower / PPL / por foco). Moda por frequência |
| `session_naming` | padrão dos nomes de workout (regex: `Treino [A-Z]` vs nome descritivo) |
| `exercises_per_session` | p25–p75 da contagem de items por workout |
| `reps_compound` / `reps_accessory` | moda das faixas de `reps` particionadas por `exercise_function` (`main` vs `accessory`); itens sem função: classificar pelo padrão do exercício |
| `rest_*_seconds` | p25–p75 de `rest_seconds` por função |
| `weekly_sets_*` | somar séries/semana por `exercise_muscle_group` em cada programa; p25–p75 do grupo mais volumoso (→ emphasized) e mediana dos demais |
| `methods_used` | `method_key` distintos com ≥2 ocorrências em ≥2 programas |
| `superset_usage` | % de programas com superset: ≥50% frequente, ≥20% ocasional, senão raro |
| `favorite_exercises` | por grupo, exercícios com maior nº de programas distintos em que aparecem (≥2), top 4 |

Saída: `Partial<PrescriptionStyle>` + lista de **slots respondidos pela mineração** (para a
entrevista pular). Guardar rascunho minerado em `ai_conversations.style_state` ao iniciar a
entrevista (não direto em `trainers` — só a proposta APROVADA vira estilo).

## 6. Entrevista roteirizada (conversa especial no `/assistente`)

### 6.1 Migration (`supabase/migrations/248_trainer_prescription_style.sql`)

```sql
alter table trainers add column if not exists prescription_style jsonb;
alter table ai_conversations add column if not exists kind text not null default 'default'
    check (kind in ('default','style_interview'));
alter table ai_conversations add column if not exists style_state jsonb;
```

`style_state` = `{ mined: Partial<PrescriptionStyle> | null, answers: Record<SlotId, string>,
proposed: PrescriptionStyle | null }`. RLS: mesmas policies da tabela (select-only; writes via
service role). Rodar `npm run gen:types` NÃO é necessário (conversations.ts usa tipos locais —
manter o padrão).

### 6.2 Slots (ordem FIXA — isto é o "roteirizado" da D2)

| # | SlotId | Pergunta (resumo) | Opções (exemplos) | Minerável? |
|---|---|---|---|---|
| 1 | `split` | "Como você costuma dividir os treinos?" (por frequência mais comum do treinador) | PPL / Upper-Lower / Full-body / Por foco / Outro | ✅ |
| 2 | `reps` | Faixas de reps preferidas (compostos e acessórios) | 4–6+10–12 / 6–8+10–15 / 8–12+12–15 / Outro | ✅ |
| 3 | `rest` | Descansos típicos | Longos (2–3min/60–90s) / Moderados (90s–2min/45–60s) / Curtos / Outro | ✅ |
| 4 | `volume` | Postura de volume semanal | Conservador / Moderado / Agressivo (mapeados p/ ranges DENTRO dos tetos) | ✅ |
| 5 | `methods` | Métodos que usa / evita | multipla=true com os method_keys do catálogo | ✅ |
| 6 | `supersets` | Frequência de supersets | Frequente / Ocasional / Raro–nunca | ✅ |
| 7 | `progression` | Filosofia de progressão | Dupla progressão / %1RM / RIR-RPE / A sensação do aluno / Outro | ❌ (sempre pergunta) |
| 8 | `warmup` | Aquecimento padrão | Séries de aproximação / Cardio leve + mobilidade / Direto ao trabalho / Outro | ❌ |
| 9 | `notes` | "Algo mais que eu deva seguir sempre?" (públicos especiais, equipamento, manias) | allowOther puro (texto livre, opção "Nada a acrescentar") | ❌ |

Slot minerado = **pulado** (o valor minerado aparece na proposta final; o treinador ajusta lá).
Entrevista típica com dados: 3–4 perguntas. Sem dados: 9. Uma pergunta por turno (padrão já
imposto pelo motor).

### 6.3 Mecânica no motor (modo entrevista)

`runAssistantTurn` ganha `opts.styleInterview?: { state: StyleState }` (populado pela rota quando
`conversation.kind === 'style_interview'`):

- **Pula**: ponte MCP, subsetting, read-guard, guarda de homônimos, contexto dinâmico
  (`buildChatContext`), memória de tools, **metering** (D5 — ainda grava turn-trace com
  `surface: 'workspace'` e um marcador `kind: 'style_interview'` no trace).
- **System prompt dedicado** (`buildStyleInterviewInstructions(state)`): persona curta + o
  ROTEIRO com os 9 slots na ordem, marcando cada um como `respondido (valor)` / `minerado (valor)`
  / `pendente`, + instrução: "pergunte APENAS o primeiro slot pendente via `perguntar_estilo`;
  quando não houver pendentes, monte a proposta via `propor_ao_treinador` com TODOS os campos;
  após o treinador aprovar, chame `salvar_estilo` com os valores finais".
- **Tools do modo** (3, todas locais — nada de kinevo_*):
  - `perguntar_estilo`: schema = `perguntar_treinador` + `slot` (enum dos SlotIds). Sem execute
    (client tool) → vira `QuestionRequest` normal na UI. O motor devolve o `slot` junto no
    resultado do turno para a rota persistir.
  - `propor_ao_treinador`: o já existente, inalterado.
  - `salvar_estilo`: COM execute. Input = o `PrescriptionStyle` (schema JSON estrito). Execute =
    validação/clamp determinístico (§4) → grava `trainers.prescription_style` + limpa
    `style_state` → retorna `{saved: true}`. Escrita reversível de configuração própria: NÃO é
    CONFIRM_TOOL (a proposta aprovada FOI a confirmação).
- **Persistência das respostas (determinística, na ROTA)**: ao receber o turno seguinte a uma
  part `question` com `slot=S`, a rota grava `style_state.answers[S] = texto da resposta` ANTES
  de chamar o motor. O roteiro do prompt é recomputado do `style_state` a cada turno — o modelo
  nunca é fonte de verdade do progresso (isto garante a D2: terminável e previsível).

### 6.4 Entrada na UI

- Home do `/assistente` sem `prescription_style`: card-convite "Configurar meu estilo de
  prescrição (~3 min)" → cria conversa `kind='style_interview'` (rodando a mineração no create,
  server-side) e abre a thread. Design: seguir o padrão dos cards existentes da home
  (`components/assistant/workspace/`), pills/violeta, **sem emojis** (feedback 12/jul).
- Com estilo salvo: entrada discreta no menu da aba ("Meu estilo de prescrição") → ver §8 F3.
- Free tier: PODE configurar o estilo (D5 — não consome créditos; é investimento do treinador na
  plataforma e melhora a conversão).

## 7. Injeção no harness

### 7.1 `lib/assistant/style-block.ts`

`buildStyleBlock(style: PrescriptionStyle): string` — renderiza SÓ os campos não-nulos, em PT-BR
legível, dentro de delimitadores:

```
<<ESTILO_DO_TREINADOR>>
Split preferido: 5x/sem → PPL + Upper/Lower; 3x/sem → Full-body A/B/C
Reps: compostos 6–8, acessórios 10–15. Descanso: compostos 120–180s, acessórios 45–60s.
Volume típico: enfatizado 14–18 séries/sem; ...
Métodos que usa: drop_set, piramide. Evita: cluster.
Favoritos — Costas: Remada curvada, Puxada neutra; Glúteo: Hip thrust, ...
Progressão: dupla progressão. Aquecimento: 2 séries de aproximação no 1º composto.
Observações: ...
<<FIM_ESTILO_DO_TREINADOR>>
```

Alvo: ≤600 tokens no pior caso.

### 7.2 Ponto de injeção e precedência (command-engine)

- Carregar `trainers.prescription_style` junto do contexto **apenas quando**
  `buildTurn || intents.includes('prescricao')` (mesmo padrão da minimização LGPD já existente).
- Anexar o bloco ao `system` DEPOIS do `dynamicContext`, com esta régua (texto no prompt):
  1. **Pedido explícito do treinador no turno** vence o estilo ("dessa vez quero full-body" →
     full-body, sem discutir);
  2. **Estilo** vence os defaults do playbook de build (reps/descansos/split/métodos);
  3. **Tetos e regras de segurança do playbook** (volume máximo, cobertura de padrões,
     restrições médicas do aluno) vencem TUDO — o estilo nunca os relaxa.
- O bloco é declarado como preferência do PRÓPRIO treinador (dado, não instrução de terceiro —
  mesma família de delimitadores dos `<<DADOS_DO_ALUNO>>`, D4).

## 8. Fases de entrega

**F1 — Fundação + mineração (sem UI).** Migration 248; tipo `PrescriptionStyle`;
`style-miner.ts` (pura + wrapper) com testes unitários sobre fixtures de árvore de programa;
`style-block.ts` + injeção no command-engine (por trás de estilo salvo — sem estilo, nada muda);
clamps do save. *Critério: com um `prescription_style` inserido à mão no banco, um turno de build
honra reps/descanso/split do estilo (verificar por eval + manual).*

**F2 — Entrevista roteirizada.** Modo `styleInterview` no motor; tools `perguntar_estilo` /
`salvar_estilo`; prompt do entrevistador; persistência de `style_state` na rota; card-convite na
home; fluxo completo mineração → perguntas pendentes → proposta editável → salvar. *Critério:
treinador com ≥5 programas responde ≤4 perguntas e sai com estilo salvo; treinador zerado
responde 9; abandonar no meio e voltar retoma do slot certo (style_state); nenhum crédito
consumido.*

**F3 — Gestão do estilo.** Tela/painel "Meu estilo" (resumo legível do JSONB) com ações
"Refazer entrevista" e "Reanalisar meus programas" (re-mineração → proposta editável de novo);
badge discreto num turno de build informando que o estilo foi aplicado. *Critério: refazer
substitui o estilo; excluir (voltar a null) remove o bloco dos builds.*

**Evals (junto de F1/F2):** adicionar em `lib/assistant/evals/cases.ts`: (a) build com estilo →
saída respeita reps/métodos/split do estilo; (b) pedido explícito contrário ao estilo → pedido
vence; (c) estilo com volume acima do teto (forjado) → clamp/teto vence. Bumpar `PROMPT_VERSION`
(mudança de system em turnos de build).

## 9. Riscos e limitações registradas

- **Loop de realimentação** (IA aprende de programa da IA): mitigado por heurística §5.1 +
  proposta editável; solução definitiva (coluna de proveniência em `assigned_programs`) fica
  para a fase de aprendizado contínuo.
- **Mineração com poucos dados** engana (5 programas = estatística grosseira): por isso TODO
  valor minerado passa pela proposta editável antes de salvar; nunca auto-salvar.
- **Estilo desatualizado** (treinador evolui): sem aprendizado contínuo no MVP; F3 dá o botão de
  re-mineração. Fase futura: diffs das edições de rascunhos criados pelo assistente realimentam
  o estilo (molde do `trainer-patterns.ts`).
- **Um estilo só** (D1): treinadores com públicos muito distintos usam `special_populations`;
  se virar dor real, per-objetivo é extensão natural do schema (versionado).

## 10. Fora de escopo (explícito)

- Injetar o estilo no canvas/"Gerar com IA" e no motor determinístico (D7 — têm personalização
  própria; unificar depois).
- Aprendizado contínuo por diffs de edição.
- Estilos múltiplos / por objetivo.
- Expor o estilo via MCP externo (tool de leitura/escrita p/ claude.ai) — avaliar depois; se
  feito, `salvar_estilo` externo precisaria ser CONFIRM_TOOL.
