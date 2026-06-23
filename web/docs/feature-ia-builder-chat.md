# Feature: "Gerar com IA" como chat ao vivo no builder

> Trocar o wizard de formulário (Configurar → Refinar → Programa) por um CHAT conversacional, escopado ao aluno, que monta e ajusta o programa direto no canvas do builder **em tempo real**. Direção decidida com o Gustavo em 23/jun/2026.

## Decisões (travadas)
- **Canvas ao vivo:** a IA monta/ajusta direto no builder via *canvas tools* executadas no cliente; **nada persiste** até o treinador clicar **Ativar/Agendar** (1 save via `save_assigned_program_tree`). Bônus: mata o acúmulo de `prescription_generations`/rascunhos no banco.
- **Chat padrão + chips:** o chat é a experiência principal; chips de **Objetivo** (Hipertrofia/Perda/Performance/Saúde) e **Dias** no topo pré-preenchem a 1ª mensagem. O wizard de formulário atual (motor `lib/prescription/`) permanece como **fallback** ("usar formulário").

## Pré-requisito de qualidade
- Build turns só usam **Claude Sonnet** (`claude-sonnet-4-6`) se a `ANTHROPIC_API_KEY` for válida no Vercel. Hoje está **inválida em prod** → cai pra `gpt-4.1-mini` (bem mais fraco pra montar treino). **Rotacionar antes do go-live**, senão a feature nasce capenga.

## Arquitetura
Três sistemas que já existem, conectados por uma ponte:

1. **Builder** — estado em `useWorkoutModel` (React local; mutadores = funções **puras** de `builder-model.ts`).
2. **Engine do Assistente** — `runAssistantTurn` (`lib/assistant/command-engine.ts`), streaming via `/api/assistant/conversations/{id}`; já escopável a aluno (`studentId` → injeta contexto), já detecta intenção de build (Sonnet, 8k tokens, 12 passos), e já suporta **client-tools sem `execute`** (`perguntar_treinador`/`propor_ao_treinador`) — o mecanismo exato pras canvas tools.
3. **Ponte do canvas** (NOVA) — `helpers/builder-canvas-bridge.ts`: singleton onde o builder publica sua API de mutação; o chat escreve por ali.

### Fluxo
```
[Gerar com IA] → painel de chat (escopado ao aluno, intenção "criar programa")
  treinador (chips/texto) → turn no engine → IA chama CANVAS TOOLS (client-tools)
    → handler aplica via canvas-bridge → builder re-renderiza AO VIVO
  iterar: "troca X", "tira Y" → mais canvas tool-calls → updates instantâneos
[Ativar como Atual]/[Agendar] → 1 save (save_assigned_program_tree)
```

## Fases
- **F1 — Ponte do canvas (FEITO):** `builder-canvas-bridge.ts` + registro no `useWorkoutModel`. Aditivo, sem mudança de comportamento. Invisível ao usuário; só valida que o builder segue funcionando.
- **F2 — Canvas tools no engine:** tools client-side + um "builder turn" que as injeta (sem `execute`, resolvidas no cliente). Resolver exercício por id (via `list_exercises`) e/ou por nome (catálogo já carregado no builder).
- **F3 — Painel de chat:** novo drawer "Gerar com IA" (chips objetivo/dias no topo, thread com streaming, input), seeding da conversa com aluno+intenção, handlers das canvas tools chamando a ponte. **Primeira fase testável.**
- **F4 — Acabamento:** Ativar/Agendar (1 save); wizard de formulário como fallback; métricas/quota (conta como build turn); QA visual.

## Contrato das canvas tools (rascunho)
Cada uma mapeia 1:1 pra um mutador já existente em `builder-model`/`use-workout-model`:
- `canvas_set_meta({ name?, duration_weeks? })`
- `canvas_add_session({ name, scheduled_days? }) → { session_id }`
- `canvas_add_exercise({ session_id, exercise_id?, exercise_name?, sets?, reps?, rest_seconds?, set_scheme?, method_key?, rounds? }) → { item_id }`
- `canvas_add_superset({ session_id, exercises: [{exercise_id|name, sets, reps}] }) → { item_id }`
- `canvas_update_item({ session_id, item_id, patch })`
- `canvas_remove_item({ session_id, item_id })`
- `canvas_remove_session({ session_id })`
- `canvas_replace_program({ sessions: [...] })` — build inicial em 1 tacada

## Riscos / notas
- Posse do estado fica no builder (ponte aditiva); se a reatividade do "canvas atual" no chat exigir, migra-se pro Zustand depois.
- **Não tocar `lib/prescription/`** (protegido). O chat usa o engine do Assistente, não o motor de prescrição.
- HITL: tools de montar programa não exigem card de confirmação (auto-executam); as canvas tools são client-side (escrita local), idem.
