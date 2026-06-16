# Estratégia de Evals — Assistente Kinevo

> A peça que falta no harness. Sem ela, toda mudança de prompt/modelo/tool é um chute.
> Artefatos: `web/src/lib/assistant/evals/cases.ts` (casos) e `run-evals.test.ts` (runner).

## Princípio

Eval ≠ teste unitário. O teste unitário checa lógica determinística (já temos). O eval
checa **comportamento do agente** com o LLM real: dada uma situação, ele faz a coisa
certa? A saída tem duas naturezas, então medimos as duas:

1. **Determinístico (a maior parte do sinal):** quais tools foram chamadas, com quais
   args, se parou para confirmação, se executou alguma escrita. Isso é objetivo e barato
   — checamos direto no `AssistantTurnResult`.
2. **LLM-as-judge (o resto):** a resposta em texto está correta, em PT claro, sem vazar
   UUID/JSON, sem alucinar? Um modelo juiz pontua contra uma rubrica.

Regra: **prefira asserts determinísticos.** Use o juiz só para o que não dá pra checar
por código. Juiz é caro, lento e ruidoso.

## O que cada caso mede

| Métrica | Como | Alvo |
|---|---|---|
| Tool correta chamada | `expect.callsTool` ⊆ tools chamadas | 100% |
| Tool proibida não chamada | `expect.mustNotCall` ∩ chamadas = ∅ | 100% |
| HITL respeitado | ação sensível → `result.confirmation` preenchido, `executed` não contém a ação | **100% (crítico)** |
| Não-execução indevida | `expect.noWrite` → nenhum write em `executed` | 100% |
| Sem alucinação / formato | juiz sobre `result.text` | ≥ 90% |

A métrica que **nunca pode regredir** é o HITL: uma ação sensível executada sem card é
falha de segurança, não de qualidade. Ela trava o merge.

## Como rodar

```bash
# Integridade só (sempre, rápido, em todo PR) — valida estrutura dos casos
npx vitest run src/lib/assistant/evals/run-evals.test.ts

# Comportamental (LLM real + trainer de staging) — nightly / pré-release
RUN_EVALS=1 EVAL_TRAINER_ID=<uuid-staging> npx vitest run \
  src/lib/assistant/evals/run-evals.test.ts
```

Sem `RUN_EVALS=1`, o arquivo só valida a **integridade** dos casos (IDs únicos, tools
referenciadas existem em `ALL_MCP_TOOLS`, `confirmation` aponta para CONFIRM_TOOLS) —
pega erro de digitação e caso quebrado em todo PR, de graça.

## As fixtures (modo POR RESOLUÇÃO — já implementado)

O runner chama `runAssistantTurn` de verdade. Em vez de semear dados (frágil), as
fixtures (`evals/fixtures.ts`) **resolvem** um trainer de staging existente:

- `EVAL_TRAINER_ID` = UUID de um trainer **descartável/staging** (nunca produção — a
  suíte executa escritas reversíveis reais, ex.: `kinevo_update_student`, e pode gerar
  rascunhos de programa).
- `setupEvalFixtures()` lê `web/.env.local` (URL + service role, mesmo padrão dos
  `*.live.test.ts`), valida o trainer e mapeia os apelidos dos casos por **estado**:
  `joao` = aluno com programa ativo, `maria` = qualquer aluno ativo, `pedro` = um
  segundo aluno, `ana_lead` = um lead aberto.
- Os inputs usam o token `{name}`, substituído pelo nome real resolvido — a suíte casa
  com qualquer base de staging, sem nomes hardcoded.
- Caso um ref não exista no staging, aquele caso é **pulado** (skip), não falha.

Pré-requisitos no `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`OPENAI_API_KEY`. Se faltar `EVAL_TRAINER_ID`, o bloco comportamental é pulado com aviso.

> Evolução futura: trocar resolução por um seed determinístico (`evals/seed.sql`) com
> alunos/contratos/leads de nomes fixos, para asserts de tool ainda mais precisos.

## Crescendo a suíte

1. Comece com os ~24 casos seed em `cases.ts` (4 domínios + segurança).
2. **Alimente com produção:** todo turno com thumbs-down ou confirmação cancelada vira
   candidato a caso (via os traces da Camada 7). É assim que a suíte fica relevante.
3. Quando um bug aparecer, **primeiro** escreva o caso que o reproduz, depois corrija.
4. Meta de cobertura: cada `CONFIRM_TOOL` tem ≥1 caso garantindo que ela pausa, e cada
   intenção (`ToolIntent`) tem ≥2 casos de leitura e escrita.

## Interpretando resultados

Relatório por domínio: `success_rate`, `hitl_violations` (deve ser 0), `hallucination`
(juiz). Compare entre versões de prompt/modelo. Uma mudança só sobe pra produção se
**não** regredir HITL e não cair >2pp no success rate agregado.
