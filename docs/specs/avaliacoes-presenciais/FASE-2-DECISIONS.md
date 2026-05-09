# Fase 2 — Decisões estratégicas

> Data do workshop: 2026-05-08
> Participantes: Gustavo (founder) + Claude (assistente estratégico)
> Status: ratificado, próximo passo é M8

Este doc registra as 4 decisões tomadas no workshop estratégico que destrava as Tiers 2 e 3 do roadmap de Fase 2 (ver `FASE-2-AUDIT.md`).

---

## D1 — IA do menu: 2 itens

**Decisão:** sidebar passa a ter 2 items distintos: **Formulários** e **Avaliações**.

**Estado anterior:** 1 item "Avaliações" → rota `/forms` → tabs internas (Respostas + Avaliações Presenciais).

**Estado novo:**
- Sidebar item **Formulários** → rota `/forms` (forms-only: anamnese, check-in, survey, feedback)
- Sidebar item **Avaliações** → rota `/avaliacoes` (assessments-only: presencial hoje, futuras: composição por foto, performance, etc)

### Cascade

- Cada item tem sua identidade visual: Formulários = azul (`#007AFF`), Avaliações = violet (`#7c3aed`)
- Rota antiga `/forms?tab=assessments` redireciona pra `/avaliacoes` por ~30 dias e depois deprecate
- HealthMetricsCard (sidebar do detalhe do aluno) permanece como cross-cutting view — não muda
- Tour M6 vira 2 tours: forms + avaliações
- Banner in-app de migração nas 2 primeiras visitas pra cada trainer

### Rationale

1. Vocabulário do trainer separa naturalmente. "Vou avaliar a Marina" = ato presencial. "Mandei a anamnese" = formulário.
2. Avaliações vai crescer (composição por foto, performance, etc). Cabe num espaço dedicado.
3. "Formulários" como conceito de 1ª classe melhora descobrabilidade pra trainer novo.
4. Custo de migração baixo (banner + tooltip resolvem).

### Sub-decisão — naming dos items

**Decisão:** "Formulários" e "Avaliações" (sem qualificador "Presenciais"). Nome curto envelhece melhor à medida que Avaliações vira família.

---

## D2 — Builders: shell compartilhado, canvas distintos

**Decisão:** extrair componente `<BuilderShell>` que cuida da infraestrutura comum (header, save, exit, draft auto-save), com canvases injetáveis distintos por tipo:
- `<FormBuilder>` (wizard 3-step + IA + lista linear de perguntas)
- `<AssessmentBuilder>` (canvas drag-drop com biblioteca de testes)

**Estado anterior:** dois builders em `/forms/templates/new` (com e sem `?category=assessment`) com headers, save, draft, e exit logic completamente independentes.

**Estado novo:**
- `<BuilderShell>` componente compartilhado:
  - Header (← Voltar / [título do template] / [Alterações não salvas] / [Salvar])
  - Auto-save em draft (`localStorage` keys padronizadas)
  - Modal "Sair sem salvar?" consistente
  - Breadcrumb / app layout
- `<FormBuilder>` em `/forms/templates/new`
- `<AssessmentBuilder>` em `/avaliacoes/templates/new`

### Rationale

1. Estruturas de dados são genuinamente diferentes (lista linear vs seções com tests). Unificar canvas seria UX pior pros dois.
2. Mas o "redor" (save, exit, draft, header) é idêntico. Extrair paga juros perpétuos.
3. Refatoração contida (~1-2 dias). Sem risco de regressão se feita com cuidado.

### Não-decisões

- **Não unificamos os builders** propriamente (Opção C do workshop) — projeto grande, risco alto, retorno duvidoso.
- "Criar com IA" continua só em forms. Pra assessments, fica no backlog (low-priority).

---

## D3 — Modais de atribuir: separados, componentes compartilhados

**Decisão:** manter `AssignFormModal` e `CreateSessionModal` como entidades distintas, mas extrair componentes internos comuns:
- `<StudentPicker>` (pode operar em modo single ou multi)
- `<TemplatePicker>` (filtra por categoria)
- Layout consistente (mesmo header, footer, spacing)

**Estado anterior:** 2 modais com UIs completamente independentes apesar de funções aparentadas.

**Estado novo:** 2 modais ainda separados (cada um na sua rota), mas visualmente coerentes via componentes compartilhados.

### Rationale

1. Os fluxos são genuinamente diferentes:
   - AssignFormModal = multi-aluno send (1 form pra muitos)
   - CreateSessionModal = single-aluno schedule (1 sessão é evento individual)
2. Tentar unificar (Opção B do workshop) gera modal cheio de lógica condicional — UX pior pra ambos.
3. Compartilhar componentes internos (Opção C) entrega coerência visual sem unificação forçada.
4. Paralelo direto da decisão D2 aplicado a modais.

---

## D4 — Timeline cronológica do aluno: backlog

**Decisão:** **não** construir timeline dedicada (`/students/[id]/timeline`) na Fase 2. Backlog com flag de "puxar pra frente quando demanda real aparecer".

**Estado atual:** HealthMetricsCard (Onda 2 do dashboard-aluno-redesign) já mostra:
- Última avaliação presencial (link)
- Última anamnese
- Peso e %BG com sparkline (histórico)
- Formulários pendentes
- Schedule de reavaliações

Cobre ~80% dos casos "trainer quer ver histórico recente do aluno".

### Rationale

1. HealthMetricsCard já cobre o caso primário.
2. Timeline dedicada custaria 5-8 dias para servir os 20% restantes.
3. Decisão reversível: feedback de trainer pedindo timeline com força → puxa do backlog.
4. M9 (Structural Integration) fica mais focado e entregável sem timeline.

### Voto carinhoso registrado

Decisão é "backlog", mas com nota: timeline é genuinamente legal. Quando demanda surgir (ou surgir banda livre depois de M10), priorizar.

---

## Roadmap Fase 2 revisado

Após estas decisões, o plano original (M8 Visual Coherence + M9 Structural Integration) colapsa numa estrutura mais focada:

| Milestone | Escopo | Dura |
|---|---|---|
| **M8** — Reestruturação Avaliações + Formulários | Cascade completa da D1 + D2 + D3: nova IA, rotas, BuilderShell, componentes de modal compartilhados, tours, migração in-app | 3-4 semanas |
| **M9** — Onboarding Flow Guiado | "Onboardar aluno novo" em 3 cliques (criar aluno → enviar anamnese → agendar avaliação) | 1-2 semanas |
| **M10** — Cross-platform Parity | Builder mobile simplificado, modo "preencher agora" no web, "Criar com IA" mobile | 2-3 semanas |

### Backlog (sem prazo)

- Timeline cronológica do aluno (D4)
- Custom font Inter no PDF
- Cache de PDF em Storage com signed URL
- Logo/branding por trainer
- "Criar com IA" para assessment templates
- E-mail automático com PDF anexado
- Histórico de PDFs gerados
- Assinatura digital do trainer
- QR code com link pra versão online do laudo

---

## Princípios herdados pra próximas decisões

1. **Reversibilidade** — preferir decisões que podem ser desfeitas com custo razoável.
2. **Cascade explícita** — registrar implicações de cada decisão pra próximas.
3. **HealthMetricsCard como sentinela** — view cross-cutting que validemos não-regressão a cada milestone.
4. **Customer voice via banner** — qualquer mudança visível na IA do produto vem com banner in-app temporário.
5. **Migração com período de compat** — rotas antigas redirecionam ~30 dias antes de deprecate.
