# Prompt para o Claude Code — analisar, testar, commitar e dar push

> Cole o conteúdo abaixo (a partir de "Você vai...") no Claude Code, na raiz do
> repositório `kinevo`. Ele assume que as mudanças do harness do Assistente já
> estão no working tree (não commitadas), no branch `main`.

---

Você vai revisar, testar e versionar um conjunto de mudanças que implementam o
**harness do Assistente de IA do Kinevo** (Fases A, B e C). Trabalhe com cuidado e
**não commite nada se os testes ou o typecheck falharem** — nesse caso, conserte ou
me reporte antes de prosseguir.

## Contexto do que foi implementado

Camada do assistente em `web/src/lib/assistant/*` e rotas em `web/src/app/api/assistant/*`:

- **Fase A (qualidade):** system-prompt v2 consolidado e versionado
  (`system-prompt.ts`) — corrige o bug da tool inexistente `analyzeStudentProgress`;
  `context-builder.ts` agora só monta contexto dinâmico + data/hora/timezone; trace por
  turno (`turn-trace.ts` + migration `supabase/migrations/211_assistant_turn_traces.sql`)
  gravando `PROMPT_VERSION`; suíte de evals (`evals/`: `cases.ts`, `fixtures.ts`,
  `judge.ts`, `run-evals.test.ts`).
- **Fase B (guardrails):** validação semântica de args das CONFIRM_TOOLS
  (`arg-validation.ts` + teste) ligada no `command-engine` e no `execute-tool`;
  rate-limit de turno e de ação sensível (`rate-limits.ts`).
- **Fase C (multi-superfície + polimento):** proativo (`proactive.ts` + cron
  `web/src/app/api/cron/morning-briefing/route.ts` + entrada em `web/vercel.json`);
  voz (`voice.ts` + rota `web/src/app/api/assistant/voice/route.ts`); erro amigável
  transversal (`errors.ts`) aplicado nos catches das rotas do assistente.

## Passo 1 — Analisar

1. Rode `git status` e `git --no-pager diff` (e `git status --porcelain` para os
   arquivos novos). Leia as mudanças.
2. Confirme a coerência:
   - nenhuma rota do assistente devolve `error.message` cru no catch (deve usar
     `assistant/errors.ts`);
   - `system-prompt.ts` não referencia `analyzeStudentProgress`;
   - imports usados, sem código morto.
3. **Atenção ao escopo:** estes arquivos de componente podem já estar modificados de
   um trabalho anterior e **não** fazem parte do harness:
   `web/src/components/assistant/credit-meter.tsx`,
   `.../workspace/conversation-view.tsx`, `.../workspace/ui-util.ts`,
   `.../workspace/assistant-home.tsx`, `.../workspace/assistant-sidebar.tsx`.
   Verifique o diff deles. Se forem alterações não relacionadas/ inacabadas, **não os
   inclua** neste commit (deixe no working tree) — ou me pergunte. Commite apenas o
   harness.

## Passo 2 — Testar (precisa passar antes de commitar)

```bash
cd web
npx tsc --noEmit                 # deve terminar com 0 erros
npx vitest run                   # suíte unitária; deve ficar verde
```

Garanta que estes testes novos passam:
`src/lib/assistant/system-prompt.test.ts`, `arg-validation.test.ts`,
`proactive.test.ts`, `voice.test.ts`, e `src/lib/assistant/evals/run-evals.test.ts`
(modo integridade — sem `RUN_EVALS`).

Não rode os testes `*.live.test.ts` nem a eval comportamental (precisam de
`RUN_LIVE_*` / `RUN_EVALS` + `.env.local` + trainer de staging). Se algum teste
pré-existente, sem relação com estas mudanças, já estava quebrado, me avise em vez de
"consertar" fora do escopo.

## Passo 3 — Segurança do commit

- Verifique que nenhum segredo/credencial entrou no diff (chaves, tokens, `.env*`).
  Se o repo tiver o skill `safe-commit`, use-o.
- A migration `211_assistant_turn_traces.sql` é **aditiva** (cria tabela + RLS). NÃO a
  aplique em produção como parte deste fluxo — só versione o arquivo. (A aplicação no
  banco é um passo separado, manual.)

## Passo 4 — Commitar e dar push

Faça **commits lógicos por fase** (preferido) ou um único commit bem descrito se for
mais simples. Sugestão de mensagens (Conventional Commits):

- `feat(assistant): prompt v2 versionado + contexto temporal + traces de turno (Fase A)`
- `feat(assistant): evals (cases + fixtures + judge + runner) (Fase A)`
- `feat(assistant): validação semântica de args + rate-limits (Fase B)`
- `feat(assistant): modo proativo (briefing) + voz + erro amigável (Fase C)`
- `docs(assistant): harness — arquitetura, prompt, evals, guardrails`

Inclua a migration `supabase/migrations/211_assistant_turn_traces.sql` e a
`web/vercel.json` no commit da fase correspondente (A e C, respectivamente).

Depois:

```bash
git push origin main
```

Se o push falhar (proteção de branch, divergência, etc.), **não force** — me reporte o
erro e pare.

## Passo 5 — Reportar

Ao final, me dê um resumo curto: o que foi commitado (hashes + mensagens), o resultado
do `tsc`/`vitest`, e qualquer arquivo que você deixou de fora do commit e por quê.
