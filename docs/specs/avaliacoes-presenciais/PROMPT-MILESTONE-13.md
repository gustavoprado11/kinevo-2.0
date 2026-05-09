# PROMPT — Milestone 13: Reverter D1 + Cards expandidos + Subtitles

> Cole no Claude Code. Hotfix-style. Commit direto em main.

---

## Goal

Reverter D1 do workshop ("forms azul / avaliações violet") — ambos azul `#007AFF`. Adicionar cards expandidos de templates em `/avaliacoes`. Adicionar subtitle contextual em ambas as telas.

## Antes de começar

1. Leia: `docs/specs/avaliacoes-presenciais/13-milestone-13-revert-d1.md`
2. Examine:
   - `web/src/components/layout/sidebar.tsx`
   - `web/src/app/avaliacoes/avaliacoes-client.tsx`
   - `web/src/app/forms/forms-dashboard-client.tsx` (referência de Templates section)
   - `web/src/components/layout/migration-banner.tsx`
   - `mobile/app/(trainer-tabs)/forms.tsx` (segmented control)
   - `mobile/components/trainer/forms/MigrationBannerMobile.tsx`

## Workflow

- **Sem branch.** Direto em main.
- **Single sub-bloco**.
- **Commit + push** após você reportar e eu validar.

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO + PLANEJAMENTO (~0.5 dia)
═══════════════════════════════════════════════════════════════════════

1. `git status --short`, `git log --oneline -5` (último: M12 squash)
2. **Audit de violet em chrome (web + mobile)**:
   - `grep -rn "violet-" web/src/app/avaliacoes/`
   - `grep -rn "violet-" web/src/components/layout/sidebar.tsx`
   - `grep -rn "violet-" web/src/components/layout/migration-banner.tsx`
   - `grep -rn "violet-" mobile/app/\(trainer-tabs\)/forms.tsx`
   - `grep -rn "violet-" mobile/components/trainer/forms/`
   - Distinguir: chrome (substituir por azul) vs categoria badge (manter)
3. **Cards de template em /forms** — extrair pattern visual pra usar em /avaliacoes:
   - Linhas exatas que renderizam Templates section
   - Estrutura: ícone + nome + meta + lista perguntas + footer
4. **Subtitles** — verificar se há padrão existente no produto pra subtitle de page header. Senão criar inline.

PARE e me reporte:
- Lista exata de arquivos a modificar
- Identificação clara: chrome vs categoria badge (qual violet vai e qual fica)
- Plano de cards expandidos (extrair shared ou inline)
- Plano dos subtitles

═══════════════════════════════════════════════════════════════════════
BLOCO B — IMPLEMENTAÇÃO (~3-4 dias)
═══════════════════════════════════════════════════════════════════════

Após meu OK do diagnóstico.

### Mudanças

**Web:**

1. **`sidebar.tsx`**: item Avaliações active state usa `#007AFF` (igual Formulários)
2. **`avaliacoes-client.tsx`**:
   - CTA "Nova avaliação": violet → azul `#007AFF` rounded-full (idêntico ao "Enviar para aluno")
   - Filter chips active: violet → azul
   - Callout "Próximas": violet → azul (paralelo ao "Enviados pendentes" do /forms)
   - Substituir footer collapsed "Templates de avaliação" por section completa com cards expandidos (paridade visual com /forms Templates)
   - Adicionar subtitle "Sessões presenciais com captura de medições" abaixo do h1
3. **`migration-banner.tsx`**: violet → azul (ou neutro se preferir)
4. **`forms-dashboard-client.tsx`**: adicionar subtitle "Anamneses, check-ins e pesquisas que o aluno responde no app" abaixo do h1

**Mobile:**

5. **`forms.tsx`**: segmented control Avaliações segment usa azul (não violet)
6. **`MigrationBannerMobile.tsx`**: violet → azul

**Não tocar:**
- Badge "Avaliação Presencial" violet em listing de templates (M7 QW1) — categoria
- Ícone Activity violet em assessment templates — categoria
- WizardShell M9 — manter ou neutralizar (decisão durante Bloco A)

### Critério de saída
Smoke test lado-a-lado:
- /forms e /avaliacoes idênticos em chrome (todos azul)
- Cards de templates paralelos
- Subtitles claros em ambos
- Mobile segmented Avaliações azul

PARE e reporte. Eu valido em localhost via Chrome MCP.

═══════════════════════════════════════════════════════════════════════
BLOCO C — STATUS DOC + COMMIT
═══════════════════════════════════════════════════════════════════════

Após eu validar.

1. `MILESTONE-13-STATUS.md` cobertura
2. Commit direto em main:

```
fix(visual): M13 reverte D1 (cor única azul) + cards templates + subtitles

User decidiu que cores distintas (D1 do workshop) fragmentavam o produto
visualmente. Voltando pra azul único como cor padrão Kinevo.

- Sidebar Avaliações active state: azul
- CTAs primários /avaliacoes: violet → azul
- Filter chips active: violet → azul
- Callout 'Próximas': violet → azul
- Mobile segmented Avaliações segment: azul
- Migration banners: violet → neutro/azul
- /avaliacoes Templates section vira cards expandidos (paridade com /forms)
- Subtitle contextual em ambas /forms e /avaliacoes

Mantidos: badge 'Avaliação Presencial' violet em listing (categoria),
ícone Activity violet (categoria), elementos de discriminação de tipo.

D1 do workshop oficialmente revertida em FASE-2-DECISIONS.md (será atualizado
em milestone separado de housekeeping de docs).

Co-authored-by: Claude <claude@anthropic.com>
```

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR
═══════════════════════════════════════════════════════════════════════

- Distinção chrome vs categoria badge confusa em algum lugar
- Cards expandidos de templates exigem nova query (ex: count de sessions por template)
- Subtitle quebra layout em mobile responsive

═══════════════════════════════════════════════════════════════════════
ORDEM
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar
2. BLOCO B → reportar (eu valido em localhost via Chrome MCP)
3. BLOCO C (commit + push após meu OK)

COMECE PELO BLOCO A.
