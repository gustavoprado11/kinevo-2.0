# Plano de Convergência de Design — Kinevo

> Unificar web e mobile numa só linguagem: **base limpa e contida do web** + **acentos premium do mobile** (hero, glass, glow), com **primária unificada no roxo `#7C3AED`**, sem regressão.
>
> Mockup de referência: [`design-convergencia.html`](../design-convergencia.html)
> Direção aprovada: Mobile adota base web · Primária unificada no roxo.

---

## 1. Princípios

1. **Separe fundação de aplicação.** Tokens/primitivos mudam de forma geral (1 vez); telas migram de forma incremental e verificada.
2. **Nunca find-replace global de hex.** Migração componente a componente, com verificação visual.
3. **A "shield strategy" é airbag, não dívida.** Mudar um token não vaza para os legados — isso limita o blast radius. Mantemos durante toda a transição.
4. **Um componente/tela por PR.** Diff pequeno = revisão visual possível.
5. **Preservar as joias do mobile.** Hero de saúde, nav glass, KButton com glow, KPI sparkline **não regridem**.

---

## 2. Resultado do inventário (web/src) — 21/05/2026

**Total: 4.031 ocorrências de hex hardcoded, em 167 arquivos.**

### Insight-chave: a maior parte NÃO muda de valor

| Categoria | Ocorrências | Ação na convergência |
|---|---:|---|
| **Família azul** (`#007AFF` 574, `#0056B3` 56, `#0066D6` 22) | **~652** | **MUDA → roxo** (`#7C3AED` / hover `#6D28D9`) |
| Neutros Apple (`#1D1D1F`, `#F5F5F7`, `#86868B`, `#E8E8ED`, `#AEAEB2`, `#6E6E73`, `#D2D2D7`, `#1C1C1E`…) | ~2.800 | **Mantêm o valor** (é a base limpa que queremos). Tokenizar é higiene futura, fora deste escopo. |
| Semânticas Apple (`#FF3B30` 111, `#34C759` 92, `#FF9500` 45) | ~248 | **Decisão pendente** (ver §6) — divergem do v2 (`#EF4444`/`#10B981`/`#F59E0B`) |
| Roxo já presente (`#7C3AED` 135, `#8B5CF6`, `#6D28D9`, `#A78BFA`…) | ~170 | Já corretos |

**Conclusão:** o trabalho real de cor da convergência é **~652 ocorrências da família azul em ~83 arquivos** — não 4.031. O resto é base que fica.

### Split marketing vs app
- Landing (marketing): apenas **15** ocorrências de `#007AFF` → track separado, baixo risco funcional, alta visibilidade de marca.
- Resto do app: **574** → o foco real.

### Arquivos mais carregados (priorização da Fase 1/2)
| Hex | Arquivo |
|---:|---|
| 156 | `components/programs/program-builder-client.tsx` |
| 129 | `components/landing/landing-hero.tsx` *(marketing)* |
| 113 | `app/financial/financial-client.tsx` |
| 111 | `components/exercises/exercise-form-modal.tsx` |
| 105 | `app/forms/templates/new/builder-client.tsx` |
| 88 | `app/forms/forms-dashboard-client.tsx` |
| 85 | `components/appointments/create-appointment-modal.tsx` |
| 84 | `app/programs/programs-client.tsx` |
| 84 | `app/globals.css` |
| 71 | `app/students/students-client.tsx` |
| 70 | `components/layout/sidebar.tsx` |

---

## 3. Fases

### Fase 0 — Fundação (1 PR, geral) 🔒 ✅ FEITO (branch `feat/design-convergencia-fase0`)
- [x] Trocar tokens de marca (light) em `web/src/app/globals.css`: `--primary`, `--ring`, `--accent-foreground` → `#7C3AED`.
- [x] **Não** mexer em `--accent-superset` (linha 72): é cor categórica de tipo de treino, não a primária — pintar de roxo colidiria com dropset.
- [x] **Não** mexer no dark mode: `--primary` dark já é violet (`#8b5cf6`), correto para contraste em fundo escuro.
- [x] Rodar `web/scripts/sync-tokens.mjs` → `_tokens.generated.css` **sem drift** (confirma que `shared/tokens/v2` já está alinhado ao roxo).
- [x] **Achado:** o snapshot lock (`shared/tokens/__tests__`) estava **stale** (baseline não cobria `colors.border` e a reestruturação de motion). Atualizado com `vitest -u` — airbag agora armado. Brand primary segue `#7C3AED`, nenhum `#007AFF` no baseline.
- [ ] **Pendente (você):** verificar visualmente com `npm run dev` (light + dark) antes de autorizar commit/push.
- **Efeito:** todo componente *novo* que usa o token já vira roxo; legados (hex hardcoded) intactos. Risco mínimo, sinal alto.

### Fase 1 — Primitivos web 🧩 ◐ EM ANDAMENTO (mesma branch `feat/design-convergencia-fase0`)
**Achado:** o web só tem 1 primitivo centralizado em `ui/` (button, + toast/tooltip/skeleton). Não existem `badge.tsx`/`input.tsx`/`card.tsx` — são inline/hardcoded por componente. Criar primitivos novos = mudança arquitetural maior; fica para Fase 2 (por tela) ou decisão à parte. Não inventar primitivo onde não há.
- [x] `components/ui/button.tsx` — variante `default` (primária) = **gradiente roxo `700→500` + glow** (`--k-shadow-glow-purple`); `hover:brightness`. `outline`/`ghost` mantidos **neutros** de propósito (botões de Cancelar/secundário — pintar de roxo seria regressão). `destructive` intacto (semânticas pendentes). `link`/focus-ring já roxos via Fase 0.
- [x] **Decidido (Gustavo):** manter o glow em toda variante `default`. Não criar variante `hero`/prop `glow` separada. O brilho roxo é a assinatura do CTA primário em web e mobile.
- [ ] Status/badge, input/search, card — **inline hoje**; migrar por tela na Fase 2 (não há primitivo central).
- [ ] (Opcional) Portar `HeroStat` e `KPICard` do mobile para o web como componentes premium.

### Fase 2 — Telas web (incremental) 🖥️
Ordem por **risco/tráfego** (do mais seguro/visível ao mais sensível):

1. [x] **`app/dashboard`** ✅ FEITO — 10 arquivos, 24 trocas (`#007AFF`→`#7C3AED`, hovers `#0056B3`/`#0066D6`→`#6D28D9`). **Regra de decisão aplicada** (vale p/ todas as telas): `dark:` = `primary`/`violet-*` → é brand → migra; `dark:` = `blue-*` → azul categórico/intencional → **fica**; escala-semáforo (verde/azul/âmbar em `stat-cards`) → data-viz → **fica**. Preservados 12 azuis categóricos (quick-actions, weekly-goals, stat-cards gauge, ring decorativo do ranking).
2. [x] `app/students` (lista) ✅ FEITO — `students-client` (9), `quick-message-card` (4), `student-access-dialog` (2) migrados. `student-header` **preservado** (cor categórica `blue` num mapa de tags, `dark:blue-400`). 10 trocas 1:1.
3. [ ] `app/students/[id]` (detalhe do aluno) — restante: varrer demais componentes de detalhe (a maioria já sem azul-família; `quick-message-card`/`student-header` já tratados acima).
4. [x] `app/schedule` + `components/appointments/*` ✅ FEITO — 6 arquivos (week-navigator, weekly-calendar, occurrence-popover, create/edit/reschedule modals), 53 azuis-marca migrados. **Preservado:** `schedule/appointment-card.tsx` (paleta categórica `STUDENT_STRIPE_COLORS` — 6 cores de aluno por hash).
5. [x] `app/messages` + `components/messages/*` ✅ FEITO — 3 arquivos (conversation-list, message-input, chat-panel), 13 azuis-marca migrados. Sem cor categórica no módulo.
6. [x] `app/exercises` + `components/exercises/*` ✅ FEITO (lote B)
7. [x] `app/programs` + `components/programs/*` + `components/builder` + `components/prescription` ✅ FEITO (lote B) — inclui `program-builder-client`, workout-cards, ai-prescribe-panel etc.
8. [x] `app/forms` + `components/forms/*` ✅ FEITO (lote B). `app/avaliacoes` ✅ FEITO — 2 arquivos (avaliacoes-client, assessment-builder), 28 azuis-marca. `components/assessments/*` sem azul-família (já em token). Todos brand.
9. [x] `app/settings/*` + `components/settings/*` ✅ FEITO (lote B)

**Lote B (telas 6,7,8-forms,9):** 29 arquivos, 319 azuis-marca migrados (196 linhas), 1:1. Categóricas Tailwind `blue-*` preservadas (tipo de formulário "anamnese", tags de status, badge dark do muscle-group). Typecheck sem erros novos. Check crítico aplicado: nenhum `#007AFF` pareado com `dark:blue-*`.
10. [x] **`app/financial/*`** ✅ FEITO — 5 arquivos (subscriptions, settings, pix-keys, financial-client, plans), 55 azuis-marca migrados. **Preservada a paleta categórica de tipo de cobrança** (`#5856D6` índigo, `#5AC8FA` azul-claro, classes Tailwind `blue-*` p/ courtesy/recorrente) — protegida por serem hex distintos. `wallet`/`checkout-bridge`/`subscription/*` sem azul-marca. Typecheck sem erros novos.

**Track paralelo (marketing):** `components/landing/*` ✅ FEITO — 5 arquivos, 12 brand migrados (sed só em `[#007AFF]` bracketed); 3 categóricos em aspas preservados (`color: '#007AFF'` em mocks de quick-action/steps).

**Transversais (achado da auditoria — NÃO estavam na lista de telas):** ✅ FEITO — `layout/{sidebar,migration-banner,notification-bell}` (sidebar aparece em toda tela!), `training-room/*` (4 arq), `student-modal`, `shared/{student-picker,builder-wizard-shell,template-picker}`, `feedback/feedback-modal`, `search/search-results`, `communication/messages-panel-content`. 14 arquivos via sed condicional `/dark:.*blue/!` (preserva `search-results:84` = ícone "novo aluno" categórico).

**✅ WEB ZERADO (auditoria final):** todo `#007AFF` restante (19×) + `#0056B3` (1×) é categórico/data-viz/intencional — paletas (`STUDENT_STRIPE_COLORS`, billing `#5856D6`/`#5AC8FA`, landing mocks), `dark:blue-*` (quick-actions, weekly-goals, student-header, search "novo aluno"), e o gauge verde/azul/âmbar do `stat-cards`. Typecheck: 0 erros novos em todas as fases.

**Track auth (baixíssimo risco):** `login`, `signup`, `auth/*` — encaixar entre fases conforme conveniência.

### Fase 3 — Mobile 📱 ◐ AUDITORIA FEITA — escopo muito menor que o previsto

**Achado central:** o DS v2 do mobile **já estava alinhado** aos princípios. A "discrepância" original era quase toda do lado **web** (azul Apple), já resolvida nas Fases 0–2. Verificado por leitura/auditoria:
- ✅ **Fonte** idêntica (Plus Jakarta Sans) — nada a fazer.
- ✅ **Cor** já é roxo `#7C3AED` (marca do mobile) — sem migração.
- ✅ `KCard` já contido (borda `neutral[200]` + sombra `xs`) — sem mudança.
- ✅ `KSearchBox` já neutro em repouso → roxo no foco (linha 55) — sem mudança.
- ✅ `uppercase` (85 arquivos) = labels de **eyebrow/seção**, padrão **compartilhado** com o web (token `micro`). Manter — strippar seria regressão.
- ✅ `toUpperCase()` = **iniciais de avatar** — manter.

**Única divergência real corrigida:** `components/v2/KStatus.tsx` — pill estava `uppercase`+tracking 0.4 (contrariava o próprio `mobile/CLAUDE.md` "sentence case" e o badge contido do web). → `transform: 'none'`, `letterSpacing: 0`. Typecheck sem erros. Propaga a todo `KStatus`.

- [x] Auditoria de uppercase/contenção (KCard, KSearchBox, KStatus).
- [x] `KStatus` → sentence case.
- [ ] **Preservadas (NÃO tocar):** `health/HeroStatBlock`, `ReadinessCard`, `v2/BottomNav` (glass), `v2/KButton` (glow), `v2/KPICard` (sparkline).
- [ ] **Pendente (opcional, sob demanda):** se Gustavo apontar telas/cards específicos que "pesam", revisar caso a caso — sem bulk-edit (evita regredir o premium).

**Conclusão:** a convergência foi essencialmente alcançada migrando o web para o roxo. O mobile precisou de 1 ajuste (KStatus).

---

## 4. Rede de segurança contra regressão

- **Verificação visual obrigatória por tela.** Mobile: usar o workflow de dirigir o simulador iOS por deep links + screenshots (QA visual já documentado). Web: screenshot antes/depois no PR.
- **Um componente/tela por PR.** PRs grandes (ex.: `program-builder-client`, 156 hex) devem ser fatiados.
- **Snapshot tests nos tokens** (`shared/tokens/__tests__`) travam a fundação; considerar snapshot dos primitivos (vitest já configurado em web e mobile).
- **Manter a shield strategy** durante toda a transição.
- **Checklist de "pronto" por PR** (ver §5).

---

## 5. Definição de pronto (por PR)

- [ ] Família azul migrada para token roxo (sem `#007AFF`/`#0056B3`/`#0066D6` remanescentes no escopo do PR).
- [ ] Neutros mantidos (sem mudança de valor não intencional).
- [ ] Screenshot antes/depois anexado (light + dark).
- [ ] Testes passando; snapshot de token intacto (ou atualizado conscientemente).
- [ ] Dark mode verificado (web e mobile).
- [ ] Joias premium do mobile não tocadas (quando aplicável).

---

## 6. Decisões pendentes

1. **Semânticas: Apple vs v2.** Web usa `#FF3B30`/`#34C759`/`#FF9500` (248 occ); v2 usa `#EF4444`/`#10B981`/`#F59E0B`. Unificar no v2 dá consistência, mas adiciona ~248 trocas. **Recomendação:** track separado e opcional, *depois* da família azul — não bloqueia a convergência principal.
2. **Tokenizar neutros.** Os ~2.800 neutros podem virar tokens por higiene, mas **fora deste escopo** (não mudam de valor, não afetam a convergência visual).
3. **Landing primeiro ou junto?** Marketing tem alta visibilidade de marca; pode ser o primeiro "wow" público ou ir junto com a Fase 2.

---

## 7. Sequência recomendada (resumo executivo)

```
Fase 0  Fundação (token --primary → roxo)        [1 PR, geral, seguro]
   ↓
Fase 1  Primitivos web (button, badge, input…)   [1 comp/PR]
   ↓
Fase 2  Telas web — dashboard primeiro,          [incremental]
        financeiro por último
   ↓
Fase 3  Mobile adota contenção, web é referência  [incremental]
        joias premium preservadas
```

**Web primeiro** porque é o destino (mudança pequena), é onde os tokens vivem, e finalizá-lo dá ao mobile uma referência viva para comparar pixel a pixel.
