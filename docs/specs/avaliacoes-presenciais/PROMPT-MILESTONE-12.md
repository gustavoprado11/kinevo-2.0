# PROMPT — Milestone 12: Visual Coherence (web Avaliações ↔ Formulários)

> Cole no Claude Code. Hotfix-style, single block, commit direto em main.

---

## Goal

Alinhar `/avaliacoes` com a estrutura visual de `/forms`. Mantém cores distintas (D1: forms azul, avaliações violet) mas espelha tudo o resto.

## Antes de começar

1. Leia: `docs/specs/avaliacoes-presenciais/12-milestone-12-visual-coherence.md`
2. Examine lado-a-lado em editor:
   - `web/src/app/forms/forms-dashboard-client.tsx` (referência de estrutura)
   - `web/src/app/avaliacoes/avaliacoes-client.tsx` (alvo da padronização)
   - `web/src/components/assessments/session-list-item.tsx` (card de session)
   - `web/src/components/forms/...` (card de submission de referência)
   - `web/src/components/layout/sidebar.tsx` (active state)

## Workflow

- **Sem branch.** Direto em main.
- **Single sub-bloco** — entrega completa, sem stops intermediários.
- **Commit + push** após você reportar e eu validar.

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (~0.5 dia)
═══════════════════════════════════════════════════════════════════════

1. `git status --short` (limpo)
2. `git log --oneline -5` (último: hotfix archive-student squash)
3. Diff entre componentes:
   - CTA primário: classes Tailwind do "Enviar para aluno" vs "Nova avaliação"
   - Filter chip: classes do active state em /forms vs /avaliacoes
   - Card item: estrutura do submission card vs session-list-item
   - Sidebar active: classes do "Formulários" ativo vs "Avaliações" ativo
4. Componentes reusáveis:
   - Há `<PrimaryCTA>` ou similar shared? Se sim, usa. Se não, espelha classes literais.
   - Há `<FilterChip>` shared? Idem.
   - Há `<CalloutSection>` shared (Aguardando Feedback callout)? Investigar.

PARE e me reporte:
- Inventário de componentes reusáveis vs classes hardcoded em ambos
- Plano concreto: extrair shared OU espelhar classes
- Lista exata de arquivos que vão mudar

═══════════════════════════════════════════════════════════════════════
BLOCO B — IMPLEMENTAÇÃO (~3-5 dias)
═══════════════════════════════════════════════════════════════════════

Após aprovação do diagnóstico.

### Mudanças (em ordem)

1. **CTA primário "Nova avaliação"**:
   - Espelhar shape/padding/altura do "Enviar para aluno"
   - Cor: violet (`bg-violet-600 hover:bg-violet-500`)
   - Forma: `rounded-full` (não `rounded-xl`)

2. **Filter chips**:
   - Active state preenchido violet (`bg-violet-500 text-white`)
   - Inactive: `bg-surface-card text-k-text-secondary`
   - Mesma altura/padding do /forms

3. **Header counter**:
   - `Avaliações 1` inline (em vez de badge violet separado)
   - Mesmo estilo `text-k-text-tertiary` do /forms

4. **Sidebar active**:
   - Item "Avaliações" ativo: background violet cheio, texto branco
   - Hover/focus matching pattern do /forms

5. **Seção "Em atraso" callout**:
   - Quando `assessmentSessions.filter(em_atraso).length > 0`:
     - Renderizar callout vermelho com bullet pulsante (paralelo ao "Aguardando Feedback")
     - Lista nested das sessões em atraso
   - Quando `count === 0`: omitir o callout (não mostrar "Sem em atraso", igual /forms só mostra Aguardando Feedback se há)

6. **Seção "Próximas" callout**:
   - Quando `assessmentSessions.filter(scheduled <= +7d && >= now).length > 0`:
     - Renderizar callout violet (paralelo ao "Enviados pendentes")
     - Lista nested

7. **Cards (session-list-item)**:
   - Espelhar estrutura do submission card em /forms:
     - Avatar do aluno (40px ou matching)
     - Nome do aluno (font-medium)
     - Template + meta (text-xs muted)
     - Status pill direita (Em andamento/Em atraso/Concluída)
     - Chevron right hover

8. **Empty states**:
   - Mantém "Nenhuma avaliação ainda" geral
   - Cada callout só renderiza quando há count > 0 (não mostra "Sem em atraso" cheio)

### Critério de saída

Smoke test comparativo lado-a-lado mostra:
- CTA, filter chips, sidebar active, counter, cards: visualmente paralelos
- Cores distintas (forms azul, avaliações violet) mas estruturas idênticas

PARE e reporte com:
- Arquivos modificados (count + diff stat)
- Output `tsc --noEmit` em web/
- Print/descrição lado-a-lado

═══════════════════════════════════════════════════════════════════════
BLOCO C — STATUS DOC + COMMIT
═══════════════════════════════════════════════════════════════════════

Após eu validar via Chrome MCP (smoke test em prod).

1. `MILESTONE-12-STATUS.md` cobertura
2. Commit direto em main:

```
fix(visual): M12 alinha /avaliacoes com /forms (D1 preservado)

User flagou que apesar da cor distinta (D1 do workshop), as 2 telas pareciam
produtos diferentes — divergência ia além de cor: CTAs, filter chips,
hierarquia de seções, cards.

- CTA primário "Nova avaliação" rounded-full violet (mesma shape do "Enviar para aluno")
- Filter chip ativo preenchido violet (não outlined)
- Sidebar item ativo violet cheio (paralelo ao Formulários ativo azul)
- Counter inline no header
- Seções "Em atraso" (callout vermelho pulsante) e "Próximas" (callout violet) quando count > 0
- Session card espelha estrutura do submission card

Identidade de cor (forms azul, avaliações violet) preservada — só estrutura visual unificada.

Co-authored-by: Claude <claude@anthropic.com>
```

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR
═══════════════════════════════════════════════════════════════════════

- Componente shared parece bom candidato pra extração mas exige refactor maior
- Cards do /forms têm dependências escondidas que não cabem direto em /avaliacoes
- Filter chips do /forms estão hardcoded inline, dificuldade de espelhar

═══════════════════════════════════════════════════════════════════════
ORDEM
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar
2. BLOCO B → reportar (eu valido em localhost via Chrome MCP)
3. BLOCO C (commit + push após meu OK)

COMECE PELO BLOCO A.
