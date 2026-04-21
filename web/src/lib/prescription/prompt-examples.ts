// ============================================================================
// Few-shot examples for the smart-v2 prescription prompt (Layer 1).
// ============================================================================
// These are SYNTHETIC profiles/programs — not real students. They must stay
// byte-stable to keep Layer 1 cacheable by OpenAI's prompt cache. Edit only
// when bumping PROMPT_VERSION.
//
// Keys below reference actual exercise UUIDs in production; the examples are
// illustrative and the LLM treats them as patterns, not as required picks.

/**
 * Newline-joined, concatenated at the end of the system prompt. All three
 * examples together target ~800 tokens so the full Layer 1 comfortably
 * exceeds OpenAI's 1024-token caching threshold.
 */
export const FEW_SHOT_EXAMPLES: string = `
## EXEMPLOS DE PROGRAMAS BEM FEITOS

Os exemplos abaixo mostram decisões corretas para três perfis distintos.
Estude os padrões: ordem composto→acessório, grande→pequeno, limites de
séries por grupo, reps e descanso por objetivo.

---

### Exemplo 1 — Iniciante, hipertrofia, 3x/semana, 45 min

Perfil:
- Nível: iniciante
- Objetivo: hipertrofia
- Dias: seg, qua, sex
- Sessão: 45 min
- Equipamento: academia completa
- Sem histórico (aluno novo)

Decisão: Full Body A–B alternado. Volume no limite inferior da faixa
iniciante (~8-10 séries/grupo/semana). Exercícios básicos, nenhum com
4 séries (iniciante sem histórico joga conservador).

Programa:
- Treino A (seg, sex): Supino Reto 3x8-12, Remada Curvada 3x8-12,
  Agachamento Livre 3x8-12, Desenvolvimento Halter 3x10-12,
  Rosca Direta 2x10-12, Tríceps Corda 2x10-12
- Treino B (qua): Supino Inclinado Halter 3x10-12, Puxada Frente 3x8-12,
  Leg Press 3x10-12, Elevação Lateral 3x12-15, Cadeira Flexora 3x10-12,
  Panturrilha em Pé 3x12-15

Padrões a notar:
- Todos os exercícios com 3 séries (iniciante cap é 3 em acessórios).
- Compostos antes, isolados depois.
- Reps hipertrofia: 8-12 compostos, 10-15 acessórios.
- Descanso: 60-90s (compatível com 45 min/sessão).

---

### Exemplo 2 — Intermediário, hipertrofia, 4x/semana, estagnado em supino reto

Perfil:
- Nível: intermediário
- Objetivo: hipertrofia
- Dias: seg, ter, qui, sex
- Sessão: 60 min
- Estagnação: Supino Reto sem progresso há 4 semanas

Decisão: ABC+A ajustado. Substituir Supino Reto por Supino Inclinado
Barra como composto principal de peito. Ombro e peito ficam com 4 séries
(grupos tolerantes), bíceps/tríceps em 3.

Programa (resumo):
- Push: Supino Inclinado Barra 4x8-10, Supino Reto Halter 3x10-12,
  Desenvolvimento Halter 4x8-10, Elevação Lateral 3x12-15,
  Tríceps Corda 3x10-12, Tríceps Francês 3x10-12
- Pull: Remada Curvada 4x6-10, Puxada Frente 3x8-12, Face Pull 3x12-15,
  Rosca Direta 3x8-12, Rosca Martelo 3x10-12
- Legs A: Agachamento Livre 4x6-10, Stiff 4x8-10, Leg Press 3x10-12,
  Panturrilha em Pé 4x10-15
- Upper: Supino Inclinado Halter 3x8-12, Remada Cavalinho 3x8-12,
  Desenvolvimento Arnold 3x10-12, Rosca Scott 3x10-12, Tríceps Testa 3x10-12

Padrões a notar:
- Estagnação em Supino Reto motivou troca para inclinado como principal.
- Variação no padrão de empurrar (inclinado barra + reto halter + inclinado
  halter distribuídos).
- No Push, 2 exercícios com 4 séries (peito + ombro), tríceps em 3.
- No Pull, apenas costas com 4 séries; bíceps em 3 (grupo pequeno).

---

### Exemplo 3 — Avançado, hipertrofia, 5x/semana, sessões longas (75 min)

Perfil:
- Nível: avançado
- Objetivo: hipertrofia
- Dias: seg, ter, qua, qui, sex
- Sessão: 75 min
- Histórico forte, boa aderência, sem estagnação

Decisão: PPL + UL. Volume no limite superior avançado (~20 séries/grupo/
semana nos priorizados). Acessórios podem chegar a 5 séries.

Programa (resumo):
- Push: Supino Reto 4x6-8, Supino Inclinado Halter 3x8-10,
  Desenvolvimento Barra 4x6-8, Elevação Lateral 4x10-12,
  Tríceps Corda 3x10-12, Tríceps Testa 3x10-12
- Pull: Barra Fixa 4x6-10, Remada Curvada 3x8-10, Puxada Frente 3x8-12,
  Face Pull 4x12-15, Rosca Direta 3x8-10, Rosca Martelo 3x10-12
- Legs A: Agachamento Livre 4x6-8, Stiff 4x8-10, Leg Press 3x10-12,
  Cadeira Flexora 3x10-12, Panturrilha em Pé 4x10-12
- Upper: Supino Inclinado 4x8-10, Remada Cavalinho 4x8-10,
  Desenvolvimento Halter 3x10-12, Rosca Scott 5x10-12,
  Tríceps Francês 5x10-12
- Lower: Agachamento Frontal 4x6-8, Stiff Halter 3x8-10,
  Cadeira Extensora 5x10-12, Panturrilha Sentado 5x12-15

Padrões a notar:
- Acessórios em 5 séries (permitido em avançado).
- No Push, peito e ombro com 4 séries (dois compostos principais).
- No Legs, 4 séries em quad, posterior e panturrilha (grupos tolerantes).
- Descanso longo (90s+) em compostos pesados; 60s em acessórios.
`.trim()
