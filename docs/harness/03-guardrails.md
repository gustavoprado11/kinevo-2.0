# Guardrails — Assistente Kinevo

> Onde colocamos as garantias que NÃO podem depender do modelo "lembrar".
> Parte já existe (HITL + tool-policy); este doc formaliza e aponta o que falta.

## Camadas de defesa (defense-in-depth)

```
 Treinador
    │
    ▼
[G1] Gate de acesso ........... tier Pro+ + cota         ✅ gateAssistant()
    │
    ▼
[G2] Subsetting de tools ...... só as tools da intenção  ✅ resolveIntents()
    │                            (reduz superfície de erro)
    ▼
[G3] Classificação read/write/  ✅ tool-policy.ts
     confirm
    │
    ▼
[G4] HITL — confirmação humana  ✅ CONFIRM_TOOLS sem execute → card
     em ações sensíveis
    │
    ▼
[G5] Validação semântica de     ✅ PARCIAL — ver §2
     argumentos                   (estrito: contratos+lead; best-effort no resto)
    │
    ▼
[G6] Rate-limit de escrita      ✅ FEITO — ver §3
    │
    ▼
[G7] Trilha de auditoria        ✅ FEITO — traces migr 211 (§4)
    │
    ▼
[G8] Isolamento por treinador   ✅ tools filtram por trainer_id (verificar §5)
```

## 1. O que já está sólido (manter e testar)

- **G1 Gate:** `gateAssistant()` valida tier + cota antes de qualquer turno. A UI
  esconde, mas o backend recusa de novo (defense-in-depth). 402/403 amigáveis.
- **G3/G4 HITL:** `tool-policy.ts` é a fonte de verdade — o `client.tools()` do AI SDK
  descarta as annotations do MCP, então a classificação vive aqui, não nas hints. As 9
  `CONFIRM_TOOLS` (5 financeiras/conta + destrutivas) chegam ao modelo **sem `execute`**;
  o turno para e devolve `ToolConfirmationRequest`. A execução real exige um POST
  separado em `/api/assistant/execute-tool`, que **revalida tier + cota**.

> Invariante #1 (trava merge): nenhuma `CONFIRM_TOOL` pode aparecer em
> `AssistantTurnResult.executed`. O eval `run-evals.test.ts` checa isso globalmente.

## 2. G5 — Validação semântica de argumentos (IMPLEMENTADO — `assistant/arg-validation.ts`)

O HITL protege a *execução*, mas o card era montado com o que o modelo mandou, sem
checar se fazia sentido. `validateConfirmArgs(admin, trainerId, toolName, args)` agora
valida ANTES e devolve um **alvo legível** ou um **motivo de bloqueio**.

Escopo (proposital):
- **Estrito (pode BLOQUEAR)** onde há dinheiro/conta e dá pra validar com confiança:
  `kinevo_create_contract` (aluno + plano são do treinador), `kinevo_mark_payment_as_paid`
  e `kinevo_cancel_contract` (contrato é do treinador; cancelar exige não-cancelado),
  `kinevo_convert_lead` (lead é do treinador e não convertido).
- **Best-effort (NUNCA bloqueia)** no resto (delete de treino, agenda, avaliação): a
  própria tool já checa posse na execução (`verifyItemOwnership`, cores/RPCs). Retorna
  alvo genérico e o card mostra o resumo dos args.
- **FAIL-OPEN:** se o validador em si falhar (erro de query/schema), libera — guardrail
  quebrado não pode travar ação legítima.

Conectado em dois pontos:
- **command-engine (UX):** inválido → não mostra o card, vira clarificação
  ("⚠️ Esse contrato já está cancelado."); válido com alvo → `card.summary` vira o
  rótulo legível ("**Pedro** — R$ 199,00"), em vez de `chave: valor`.
- **execute-tool (enforcement):** revalida e responde **422** se inválido, antes de
  executar — defense-in-depth mesmo que a UI/modelo burlem.

Coberto por `arg-validation.test.ts` (posse ok/não-é-seu, já cancelado, já convertido,
aluno fora da carteira, tool sem validador estrito).

Evolução futura: faixas de valor plausível (não-negativo, ≤ N× o plano) em pagamentos.

## 3. G6 — Rate-limit de escrita (IMPLEMENTADO — `assistant/rate-limits.ts`)

`maxSteps: 5` limita um turno, mas não limitava turnos seguidos. Agora há limites por
janela, reusando o limitador durável e atômico (`consumeRateLimit`, migration 195):

- **Turno** (`limitTurn`, chave `assistant:turn:<trainer>`): 15/min, 300/dia. Aplicado
  nos dois caminhos que rodam `runAssistantTurn` — ⌘K (`/api/assistant/command`) e a aba
  workspace (`/api/assistant/conversations/[id]`). Anti-amplificação de custo.
- **Sensível** (`limitSensitive`, chave `assistant:sensitive:<trainer>`): 8/min, 120/dia.
  Aplicado no `/api/assistant/execute-tool` (toda ação confirmada passa por lá).
  Mais apertado — anti-loop / anti-engano em sequência.
- Estourou → **429** amigável (`{ error: 'rate_limited', message }`); a UI degrada.
- Janelas do backend: por minuto e por dia (aproxima "por hora"). Fail-open se o banco
  hiccupar (o endpoint já tem auth + gate).

## 4. G7 — Trilha de auditoria imutável (IMPLEMENTADO — `assistant_turn_traces`, migr 211)

Toda ação executada gera um registro append-only via `recordTurnTrace`:
`trainer_id`, `tool` + `args`, `output`, `surface`, `prompt_version`, tokens/custo,
`timestamp`. Ações sensíveis confirmadas entram com `kind='confirmed_action'` (escritas
pelo `/execute-tool`), e os turnos de IA com `kind='turn'`. Serve para depurar incidentes,
alimentar a suíte de eval com casos reais e dar ao treinador um histórico do que a IA fez.
RLS restringe a leitura ao próprio treinador; escrita só via service role.

Pendência menor: rotina de retenção (purgar traces antigos) num cron futuro.

## 5. G8 — Isolamento por treinador (verificar)

As tools MCP usam `supabaseAdmin` (service role, **bypassa RLS**) e filtram por
`trainer_id`/`coach_id` em cada query. Isso funciona, mas é frágil: um filtro esquecido
em uma tool nova vaza dados entre treinadores. Recomendações:
- **Teste de isolamento automatizado:** para cada tool de leitura, semear 2 treinadores e
  garantir que A nunca vê dado de B. Roda no CI.
- Helper central `scopedQuery(trainerId, table)` que sempre injeta o filtro, para tools
  novas não dependerem de lembrar.
- Considerar RLS como segunda barreira mesmo com service role em rotas críticas.

## 6. Tabela-resumo de ações sensíveis (estado vs. desejado)

| Tool | HITL hoje | Validação de args desejada |
|---|---|---|
| `kinevo_mark_payment_as_paid` | ✅ | aluno existe + valor plausível + competência válida |
| `kinevo_create_contract` | ✅ | plano existe + aluno existe + não duplica contrato ativo |
| `kinevo_cancel_contract` | ✅ | contrato existe, ativo, do treinador, aluno bate |
| `kinevo_convert_lead` | ✅ | lead existe, não convertido, do treinador |
| `kinevo_finalize_assessment` | ✅ | avaliação existe, tem medições, não finalizada |
| `kinevo_delete_workout_session` | ✅ | sessão pertence a programa do treinador |
| `kinevo_delete_workout_item` | ✅ | item pertence a programa do treinador |
| `kinevo_cancel_appointment_occurrence` | ✅ | ocorrência existe, futura, do treinador |
| `kinevo_cancel_appointment_series` | ✅ | série existe, do treinador; avisar nº de sessões afetadas |

## 7. Princípios

1. **Falha fechada:** na dúvida sobre uma ação sensível, pare e pergunte — nunca execute.
2. **Erro vira pergunta:** validação que falha não some; volta ao modelo como
   esclarecimento ao treinador.
3. **Card com contexto:** confirmar com nome legível e impacto, não com args crus.
4. **Tudo auditável:** se a IA fez, ficou registrado.
5. **Guardrail é código + teste:** cada guardrail tem um caso de eval que o exercita.
