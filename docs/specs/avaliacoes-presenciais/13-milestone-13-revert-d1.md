# Milestone 13 — Reverter D1 + Cards expandidos + Clarificação contextual

**Pré-requisitos:** M12 em prod (cores distintas + estrutura idêntica). User decidiu que cores distintas não estão funcionando.

**Goal:** abandonar a decisão D1 do workshop ("forms azul / avaliações violet") e adotar azul como cor padrão única em todas as telas. Adicionar cards expandidos de templates em `/avaliacoes` (paridade com `/forms`). Adicionar subtitle contextual no header de cada tela explicando o que significa.

**Plataforma:** web + mobile (M11 também precisa do revert de cor).

**Dura:** ~3-5 dias.

**Branch:** sem branch — direto em main, padrão hotfix-style.

---

## 1. Decisão revertida

### D1 (do workshop) — REVERTIDA

**Antes:** forms azul `#007AFF` / avaliações violet `#7c3aed` como sinal de identidade.

**Agora:** ambos azul `#007AFF`. Identidade vem do conteúdo e do nome no sidebar, não da cor primária.

**Razão da reversão:** o user observou que a paleta dupla "fragmenta" o produto visualmente em vez de unificar. Azul como cor padrão Kinevo cria sensação de produto coeso.

### O que muda

- CTAs primários em `/avaliacoes`: violet → azul
- Sidebar item "Avaliações" ativo: violet → azul
- Filter chips active state: violet → azul
- Callouts de seções ("Em atraso" vermelho mantém, "Próximas" violet → azul)
- Templates "Avaliação Presencial" badge: violet → mantém violet só pra discriminar categoria visualmente no listing (não é chrome principal)
- Mobile (M11) segmented Avaliações segment: violet → azul
- Banner de migração violet → azul

### O que NÃO muda

- Templates de assessment continuam com badge violet "Avaliação Presencial" no listing de `/forms/templates` ou `/avaliacoes/templates` (M7 QW1) — diferenciação de categoria, não chrome
- Ícone Activity violet em assessments (mantém pra reconhecimento de tipo)
- WizardShell Onboarding (M9) violet — pode manter pra criar destaque visual, ou neutralizar (decisão minor)

---

## 2. Cards expandidos em `/avaliacoes`

### Estado atual
Footer "Templates de avaliação 5 — Gerenciar →" como uma única row colapsada.

### Estado desejado
Section completa com cards detalhados (paridade com `/forms`):

```
┌─────────────────────────────────────────────────────────┐
│ Templates de avaliação 5                  Gerenciar →   │
├─────────────────────────────────────────────────────────┤
│ ✦ Antropometria mínima                                  │
│   3 seções · Avaliação Presencial · Kinevo              │
│   1. Antropometria                                      │
│   2. Circunferências                                    │
│   3. Calculados                                         │
│   0 sessões · v1 · há 1 dia               Enviar →     │
├─────────────────────────────────────────────────────────┤
│ ... outros 4 templates                                  │
└─────────────────────────────────────────────────────────┘
```

Cada card tem:
- Ícone categoria (Activity violet)
- Nome do template
- Metadata: `{N} seções · Avaliação Presencial · Kinevo|Meu`
- Lista das 3 primeiras seções (numeradas)
- "+N mais..." quando >3 seções
- Footer do card: `{N} sessões · v{X} · {timestamp}` + "Enviar →" ou "Editar →" CTA

Estrutura idêntica aos cards de form em `/forms` (ver `forms-dashboard-client.tsx` Templates section).

---

## 3. Subtitle contextual

### `/forms` header
- Título: "Formulários"
- Subtitle: "Anamneses, check-ins e pesquisas que o aluno responde no app"

### `/avaliacoes` header
- Título: "Avaliações"
- Subtitle: "Sessões presenciais com captura de medições"

Estilo: text-sm muted, abaixo do h1. Igual padrão do dashboard se houver — senão criar novo.

---

## 4. Acceptance criteria

### Web
- ✅ Sidebar Avaliações active state: azul (igual Formulários)
- ✅ CTA "Nova avaliação": azul
- ✅ Filter chips active: azul preenchido
- ✅ Callout "Próximas" violet → azul
- ✅ Banner de migração violet → azul ou neutro
- ✅ Templates section em `/avaliacoes` mostra 5 cards expandidos
- ✅ Subtitle contextual em ambos `/forms` e `/avaliacoes`

### Mobile (M11)
- ✅ Segmented control Avaliações segment: azul (não violet)
- ✅ Sub-tab active: azul

### Geral
- ✅ TS clean
- ✅ Smoke test paridade lado-a-lado
- ✅ MILESTONE-13-STATUS.md

---

## 5. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Reverter cor após 2-3 milestones de trabalho violet | Substituir tokens via grep + replace cuidadoso. Auditar visualmente cada tela |
| Mobile M11 segmented control quebra com cor nova | Test em emulador |
| Templates expandidos consomem muito espaço vertical | Pode ser collapsable se ficar muito grande (decisão B) |
| Subtitle muito longo quebra header layout | Limitar 60-80 chars |

---

## 6. Plano de implementação

### Bloco único, ~3-5 dias

1. **Reversão de cor (web)**:
   - `sidebar.tsx`: item Avaliações usa mesmo `#007AFF` do item Formulários
   - `avaliacoes-client.tsx`: CTAs, filter chips, callout "Próximas" → azul
   - `migration-banner.tsx`: violet → azul (ou neutro)
   - Verifica grep `violet-` em arquivos de chrome — distinguir do que é categoria badge

2. **Reversão de cor (mobile)**:
   - `forms.tsx`: segmented control Avaliações segment azul
   - `MigrationBannerMobile.tsx`: violet → azul

3. **Cards expandidos templates assessment**:
   - Criar componente `AssessmentTemplateCardExpanded` ou inline em avaliacoes-client.tsx
   - Section completa em `/avaliacoes` (substitui o footer collapsed)
   - Reusa visual do `forms-dashboard-client.tsx` Templates section

4. **Subtitles**:
   - Header de `/forms` ganha subtitle
   - Header de `/avaliacoes` ganha subtitle
   - Estilo consistente

5. **Status doc + commit**:
   - `MILESTONE-13-STATUS.md`
   - Commit direto em main

---

## 7. Validação manual

1. `/forms` e `/avaliacoes` lado-a-lado: cores idênticas em todos os elementos de chrome
2. Templates section: ambas mostram cards expandidos com mesma estrutura
3. Subtitle aparece em ambas as telas, copy correto
4. Mobile: tab Formulários segmento Avaliações com accent azul (não violet)
5. M7 QW1 ainda funciona: badge "Avaliação Presencial" violet ainda aparece em `/forms/templates`
6. M12 callouts ainda funcionam: "Em atraso" vermelho pulsante quando count > 0

---

## 8. Fora de escopo

- ❌ Mudança de cor padrão do produto (Kinevo continua azul)
- ❌ Refactor estrutural maior
- ❌ Onboarding novo
- ❌ Remoção de violet completa do produto (mantém em badges, ícones de categoria)
