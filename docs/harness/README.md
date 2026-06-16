# Harness do Assistente Kinevo

Blueprint para tornar o assistente de IA preciso, seguro e útil no dia a dia do personal.
Escopo v1: prescrição, alunos, financeiro, agenda/leads. Superfícies: aba `/assistente`,
⌘K, voz e proativo.

## Documentos

| Arquivo | O quê |
|---|---|
| [`00-arquitetura-harness.md`](./00-arquitetura-harness.md) | Doc mestre: estado atual do código, gaps, arquitetura em 7 camadas, roadmap ordenado, métricas. **Comece aqui.** |
| [`01-system-prompt-referencia.md`](./01-system-prompt-referencia.md) | Prompt v2 consolidado (corrige o bug `analyzeStudentProgress`), com plano de migração. |
| [`02-estrategia-de-evals.md`](./02-estrategia-de-evals.md) | Como medir qualidade do agente — a peça que falta. |
| [`03-guardrails.md`](./03-guardrails.md) | Camadas de defesa: HITL (existe) + validação de args, rate-limit, auditoria (faltam). |

## Artefatos de código

- `web/src/lib/assistant/evals/cases.ts` — 24 casos de eval (4 domínios + segurança).
- `web/src/lib/assistant/evals/run-evals.test.ts` — runner vitest (integridade sempre;
  comportamental com `RUN_EVALS=1`).

## Por onde começar (Fase A)

1. Corrigir o prompt fantasma e consolidar (`01`).
2. Adicionar data/hora + timezone ao contexto.
3. Ativar a suíte de eval (wire das fixtures em `run-evals.test.ts`).
4. Persistir trace por turno (vira o dataset dos evals).

## Achados principais da análise do código

- **🔴 Bug:** `context-builder.ts:197` manda usar a tool `analyzeStudentProgress`, que
  não existe. A real é `kinevo_get_student_progress`.
- **🟠 Dois prompts** (`context-builder` + `command-engine`) divergem; consolidar.
- **🔴 Sem eval de qualidade** — impossível saber se mudanças melhoram ou pioram.
- **🟠 Sem contexto temporal** — agenda erra "amanhã/quinta" silenciosamente.
- **🟠 Guardrails** cobrem execução (HITL) mas não a semântica dos argumentos.
