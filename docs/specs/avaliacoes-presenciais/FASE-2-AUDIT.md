# Fase 2 — Auditoria do módulo Avaliações + integração com Formulários

> Data: 2026-05-08
> Escopo: aba Avaliações (web) + integração Formulários ↔ Avaliações Presenciais
> Lentes: UX do trainer na prática diária + coerência visual / design system
> Método: leitura de código + navegação autenticada em prod via Chrome MCP
> Status: relatório de discovery — nenhum código alterado

---

## Sumário executivo

A Fase 1 entregou o módulo de Avaliações Presenciais ponta-a-ponta (M1→M6). O fluxo trainer→aluno funciona: cria template, agenda sessão, captura no mobile, vê resultado na web, baixa PDF. Mas a auditoria revelou **três classes de problema** que justificam tratamento na Fase 2:

1. **Conflito de nomenclatura no nível da IA do produto.** A rota `/forms` virou "Avaliações" — o nome do módulo de Formulários sumiu da interface enquanto a aba interna de Avaliações Presenciais ficou empilhada dentro dele. O trainer vê três rótulos sobrepostos para coisas relacionadas mas distintas.

2. **Quebra de identidade entre os dois sub-módulos.** Templates de avaliação aparecem na lista geral de templates como categoria "Pesquisa" (bug confirmado em prod). Builders divergem em UX (forms tem wizard 3-step + IA, assessments cai direto no canvas). Cores, verbos e hierarquia visual diferem entre tabs irmãs.

3. **Atrito contextual na criação de sessão a partir do aluno.** O "+" da seção AVALIAÇÃO PRESENCIAL no detalhe do aluno navega para `/forms?tab=assessments` em vez de abrir modal pré-preenchido. O trainer perde contexto e tem que reselecionar o aluno que estava vendo.

Essas três classes não são bugs novos — são consequências de o produto ter crescido em camadas. Avaliações Presenciais foi enxertada na infraestrutura de Formulários (mesma tabela `form_templates`, mesma rota `/forms`, mesma navegação no sidebar), mas sem o trabalho de unificação visual e conceitual que essa decisão exigia.

A boa notícia: a branch `dashboard-aluno-redesign` já endereça parte disso através da **Onda 2** (HealthMetricsCard unifica avaliações + formulários + métricas no detalhe do aluno). O trabalho de Fase 2 deve coordenar com essas ondas — não competir.

Este relatório é discovery puro. Propostas estão organizadas por prioridade no fim, mas decisões de escopo ficam pra próxima conversa.

---

## 1. Estado atual — mapa do território

### 1.1 Onde Avaliações vivem

```
/forms                     → "Avaliações" (item do sidebar)
  └─ Tab "Respostas"        → submissions de formulários (anamnese/checkin/survey)
  └─ Tab "Avaliações Presenciais" → sessions de in-person assessment (M1-M6)

/forms/templates            → lista de templates (mistura forms e assessments)
/forms/templates/new        → builder de form (wizard 3-step com opção de IA)
/forms/templates/new?category=assessment → builder de assessment (canvas drag-drop)
/forms/templates/new?edit=<id> → edita template existente

/students/[id]              → detalhe do aluno
  └─ Sidebar direita        → card "Avaliações" (legacy) com sub-bloco
                              "AVALIAÇÃO PRESENCIAL" + body metrics
  └─ Branch dashboard-aluno-redesign substitui pelo HealthMetricsCard

/students/[id]/avaliacoes/[sessionId]         → detalhe da sessão (web view-only)
/students/[id]/avaliacoes/[sessionId]/result  → resultado da sessão completed
```

### 1.2 Inventário de templates seedados (sistema, M6)

Cinco templates `trainer_id IS NULL`, `category='assessment'`:

| `system_key` | Título visível |
|---|---|
| `assessment_anthropometry_basic` | Antropometria mínima |
| `assessment_jackson_pollock_3` | Composição corporal — Jackson & Pollock 3 dobras |
| `assessment_jackson_pollock_7` | Composição corporal — Jackson & Pollock 7 dobras |
| `assessment_petroski_4` | Composição corporal — Petroski 4 dobras (BR) |
| `assessment_initial_complete` | Avaliação Inicial Presencial |

### 1.3 Fluxo end-to-end atual (visão prática)

```
1. Trainer cria template (web) ──> escolhe entre form ou assessment
2. Trainer cria sessão (web) ────> seleciona aluno, template, sexo, idade
3. Aluno faz captura (mobile) ───> mede peso/altura/dobras na MeasurementWizard
4. Engine M2 calcula (server) ───> IMC, RCQ, %BG, massa magra/gorda, classificações
5. Trainer vê resultado (web) ───> ResultStatsCardWeb + ComparisonTable + History
6. Trainer baixa PDF (web) ──────> Edge Function pdf-lib, M5
7. Trainer compartilha (mobile) ──> Share Sheet via expo-sharing (após OTA)
```

Funciona. O problema não está na espinha — está nas costuras.

---

## 2. Achados — UX do trainer

### 2.1 Hierarquia confusa de "Avaliações"

**Observado:** Sidebar mostra item **Avaliações**. Página em `/forms` exibe título **"Avaliações"** com badge `9` (contador de submissions). Tab interna chama **"Avaliações Presenciais"**. Total: três usos do termo "Avaliação" referindo a coisas diferentes na mesma tela.

**Por que importa:** Trainer pergunta "Onde estão minhas avaliações?" — a resposta é "depende do que você quer dizer". Anamnese é avaliação? Check-in é? Avaliação física presencial é? Linguagem ambígua aumenta atrito de descobrabilidade.

**Fonte:** screenshot do header `/forms` + `forms-dashboard-client.tsx:365` (h1 "Avaliações") + `tour-definitions.ts` que aponta a tab como "Avaliações Presenciais".

### 2.2 Contador "9" no header é enganoso

**Observado:** O badge `9` ao lado de "Avaliações" só conta submissions de formulários. Quando o trainer está na tab Avaliações Presenciais, o número não corresponde ao que ele vê.

**Por que importa:** Métricas globais devem refletir tudo dentro do escopo, ou cada tab deve ter seu próprio contador (já existe um pequeno `9` rentado no tab Avaliações Presenciais com cor violet, mas o grande no header é só de forms).

### 2.3 Atrito na criação de sessão a partir do aluno

**Observado:** No detalhe do aluno (`/students/[id]`), card "Avaliações" exibe sub-bloco "AVALIAÇÃO PRESENCIAL" com botão `+`. Clique no `+` navega para `/forms?tab=assessments` e abre o CreateSessionModal — **sem pré-preencher o aluno**.

**Esperado:** o trainer está olhando para Marina; clica `+`; modal abre com Marina já selecionada, foco no campo Template ou Quando. Atualmente ele perde contexto e tem que escolher Marina de novo na dropdown.

**Implicação:** ~3 cliques desnecessários por sessão criada nesse caminho.

**Fonte:** screenshot do flow + `/students/[id]/student-detail-client.tsx` que renderiza o legacy `AssessmentSidebarCard`.

### 2.4 "Modo preencher agora" só no mobile

**Observado:** já registrado no MILESTONE-6-STATUS.md. Trainer com tablet/desktop fixo no estúdio precisa do mobile para capturar.

**Por que importa:** estúdios bem equipados (tablet ou desktop dedicado) são exatamente o cliente premium. Captura no web seria um diferencial competitivo (MFIT e similares cobram caro por feature equivalente).

### 2.5 Tour `forms` e `assessments_first_time` podem competir

**Observado:** registrado como limitação conhecida no M6. Se trainer entra em `/forms` pela primeira vez e clica direto em "Avaliações Presenciais" antes do tour `forms` iniciar/completar, dois tours brigam por foco. TourRunner evita simultaneidade, mas a ordem é indeterminada.

**Por que importa:** primeira impressão do produto é crítica. Tour quebrado = sensação de produto inacabado.

### 2.6 Empty state pesado na tab vazia

**Observado:** Tab Avaliações Presenciais vazia mostra um card grande tracejado com `+`, título "Nenhuma avaliação ainda" e CTA "Nova avaliação". Acima já tem o botão "Nova avaliação" no header da página + ainda existe "Novo template de avaliação". Três pontos de entrada para a mesma ação na mesma viewport.

**Por que importa:** redundância visual sem valor adicional. Ou consolida em um CTA principal claro, ou diferencia (ex: empty state tem flow guiado "agora você precisa de um template, vamos criar?", header tem ações rápidas para quem já entende o produto).

---

## 3. Achados — Coerência visual / design system

### 3.1 Bug: templates de assessment aparecem como "Pesquisa" na lista geral

**Severidade: ALTA** — confirma como bug em produção.

**Observado em prod:** `/forms/templates` lista os 5 templates de sistema com:
- Badge de categoria: **"Pesquisa"** (errado — deveriam ser "Avaliação Presencial" ou similar)
- Metadata: **"0 perguntas"** (errado — assessment templates têm seções e tests, não perguntas)
- Metadata: **"0 respostas"** (errado — assessment sessions, não responses)
- Ícone: ícone genérico de form

**Por que importa:** confunde trainer ("isso é uma pesquisa?"), e o vocabulário "perguntas/respostas" não se aplica. É a primeira impressão de quem clica "Gerenciar →" na seção Templates.

**Fonte:** screenshot anexado. Grep no código mostra que `templates-client.tsx` provavelmente usa o mapping `CATEGORY_CONFIG` do `forms-dashboard-client.tsx:95-99` que só cobre `anamnese`/`checkin`/`survey` e cai no default "survey" para qualquer outra categoria.

### 3.2 Cores divergentes entre as duas tabs irmãs

**Observado:**

| Elemento | Tab Respostas | Tab Avaliações Presenciais |
|---|---|---|
| CTA primário | `#007AFF` (Apple Blue) light / `violet-600` dark | `violet-500` light e dark |
| Badges de filtro ativo | Azul + branco | Violet + branco |
| Active tab indicator | violet (compartilhado) | violet (compartilhado) |
| Cards de seção | Borda neutra, accent azul | Borda neutra, accent violet |

**Por que importa:** o user explicitamente flagged "coerência visual" como prioridade. Duas tabs irmãs com paletas diferentes parecem produtos distintos coabitando.

**Pergunta de design:** o trainer enxerga Avaliações Presenciais como "categoria especial" (justificando o violet de destaque) ou como "irmã par" de Respostas (justificando paleta unificada)? Ambos são válidos, mas precisa decidir explicitamente.

### 3.3 Verbos e CTAs com framing diferente

**Observado:**

| Tab Respostas | Tab Avaliações Presenciais |
|---|---|
| "Enviar para aluno" | "Nova avaliação" |
| "Novo Template" | "Novo template de avaliação" |

**Por que importa:** "Enviar" é o verbo da relação (eu mando, aluno responde). "Nova" é o verbo de criação. Mas no fundo são a mesma ação em ambos: instanciar um template para um aluno específico. O framing diferente sugere que os dois flows são essencialmente diferentes — quando estruturalmente são o mesmo.

### 3.4 Builder de template é uma experiência completamente diferente

**Observado:**

| | `/forms/templates/new` (form) | `/forms/templates/new?category=assessment` |
|---|---|---|
| Entrada | Wizard 3-step (Método → Configurar → Editor) | Vai direto pro canvas |
| AI option | Sim ("Criar com IA") | Não |
| Cabeçalho | "Criar Template" + breadcrumb | "← Voltar / Alterações não salvas / Salvar" |
| Layout | Stepper centrado vertical | 3-column horizontal (biblioteca / canvas / props) |
| Estilo visual | Apple HIG, accent azul | Denso, accent violet |

**Por que importa:** dois trainers que querem criar "alguma coisa" e clicam Templates → Criar Template terão experiências completamente diferentes dependendo da categoria pré-selecionada. Não há **transferência de aprendizado** entre os dois flows.

**Pergunta:** vale unificar o builder (ex: form types e assessment types como "block types" no mesmo editor)? Ou são intencionalmente separados? Argumento pelo separado: assessments têm constraints específicas (sex/age, fórmulas, classificações) que não fazem sentido no contexto de uma anamnese textual. Argumento pelo unificado: o trainer não modela mentalmente "form" vs "assessment" — ele modela "template para coletar dados do aluno".

### 3.5 Layout do builder de assessment quebra em viewports estreitos

**Observado:** em viewport ~924px, as três colunas comprimem demais. A coluna central (canvas) fica com texto fragmentado vertical ("Co... me... ce..."). Funcional só em desktop largo.

**Por que importa:** trainer com MacBook Air 13" ou tablet em portrait pode pegar essa view comprimida. Não bloqueia, mas grita "feature de desktop" pra quem usa device intermediário.

### 3.6 Cards de seção na tab Respostas vs filter chips na tab Presenciais

**Observado:**

Tab Respostas tem **3 seções estruturadas**:
- "Aguardando Feedback" (3) — callout pulsante laranja
- "Enviados pendentes" (1) — callout azul/violet
- "Todas as Respostas" (9) — com filter chips internos

Tab Avaliações Presenciais tem **4 filter chips** soltos:
- "Todas" / "Em atraso" / "Próximas" / "Concluídas"

**Por que importa:** a tab Respostas comunica "tem coisas urgentes pra você fazer" através de hierarquia visual. A tab Presenciais comunica "aqui está uma lista filtrada". Mesmo conceito ("preciso da sua atenção"), tratamentos visuais diferentes.

A spec da Fase 2 já flagou isso: "Padronizar visual entre tabs com mesmo nível de hierarquia (seções 'Aguardando Feedback' também em Presenciais quando aplicável)".

---

## 4. Achados — Integração Avaliações ↔ Formulários

### 4.1 Silos visuais coabitando a mesma rota

Já discutido em 3.6. Recapitulando: a tab Respostas é rica e contextualmente segmentada; a tab Avaliações Presenciais é uma lista com chips. Coabitam `/forms` mas sentem-se como produtos diferentes.

### 4.2 Não há timeline cronológica unificada por aluno

**Observado:** o trainer que quer ver "tudo que aconteceu com a Marina" precisa olhar:
- `/students/[Marina]` — sidebar de Avaliações com 1 anamnese listada + sub-bloco AVALIAÇÃO PRESENCIAL com último resultado
- `/forms?tab=assessments` filtrado por aluno — apenas sessões presenciais
- `/forms?tab=responses` — submissions misturadas com outros alunos

Não existe view "timeline da Marina" mostrando, em ordem cronológica, todas as interações: anamnese inicial, primeira avaliação presencial, check-in 1, check-in 2, segunda avaliação, etc.

**Por que importa:** durante uma consulta de revisão (presencial ou call), o trainer tipicamente quer reconstruir a história do aluno. Hoje ele faz isso fragmentadamente.

### 4.3 Flow "primeira sessão completa" é manual

**Observado:** trainer onboarda aluno novo. Quer: anamnese + primeira avaliação presencial + primeira prescrição. Hoje:

1. Vai em `/students` → cria aluno
2. Vai em `/forms` (Respostas) → "Enviar para aluno" → escolhe template anamnese → assigna
3. Volta em `/forms?tab=assessments` → "Nova avaliação" → escolhe template → escolhe aluno → completa metadata
4. Vai pro mobile → captura medições
5. Volta no web → vai pro detalhe do aluno → cria programa

Cinco contextos distintos para um workflow que é mentalmente uma coisa só ("vou onboardar a Marina"). A spec da Fase 2 sugere "Onboarding completo guiado: anamnese → primeira avaliação → primeira prescrição em 3 cliques contextualmente".

### 4.4 HealthMetricsCard (Onda 2 do dashboard-aluno-redesign) endereça parcialmente

**Observado em código:** `web/src/components/students/health-metrics-card.tsx` (na branch `dashboard-aluno-redesign`) substitui o legacy AssessmentSidebarCard + BodyMetricsTrend por um único card unificando:
- Avaliação presencial mais recente (link pro resultado)
- Peso e %BG com sparkline (histórico)
- Formulários pendentes do aluno
- Schedule de reavaliações periódicas
- Dropdown "Enviar formulário" inline

**Por que importa:** essa é a melhor expressão atual da integração Forms↔Assessments. Mas ainda é só sidebar do detalhe do aluno — não chega na tab Avaliações nem na timeline.

**Implicação para Fase 2:** o trabalho de integração precisa coordenar com as Ondas do dashboard-aluno-redesign. Se uma Fase 2 começa a mexer em `/forms` enquanto Onda 3 está mexendo em `/students/[id]`, vão colidir.

### 4.5 Atribuir formulário a aluno e atribuir avaliação são UX paralelos (e não deveriam)

**Observado:**
- Atribuir formulário: "Enviar para aluno" (botão azul) → AssignFormModal — escolhe template + alunos (multi)
- Atribuir avaliação: "Nova avaliação" (botão violet) → CreateSessionModal — escolhe aluno + template + sex + age + scheduled_at

São duas UIs distintas para "instanciar template para aluno". A diferença real é que avaliação requer metadata adicional (sex, age para a engine). Mas isso poderia ser handled em uma UI unificada com expansão condicional.

---

## 5. Achados — Mobile (out of scope mas relevante)

### 5.1 Builder de assessment não existe no mobile

Já registrado no M6 status como gap de paridade. Trainer 100% mobile fica trancado.

### 5.2 Aba Forms no mobile espelha mais ou menos o web

Confirmar empiricamente após OTA do M5. Provável que tenha o mesmo problema de tab Respostas vs Presenciais com tratamentos visuais diferentes.

---

## 6. Outras observações pontuais

- **"Reavaliação Periódica · Pendente"** banner amarelo no detalhe do aluno é boa UX (chama atenção). Boa âncora pra padronizar callouts em outros pontos do produto.
- **Card legacy AssessmentSidebarCard** está marcado `@deprecated` no código. Não está depreciado funcionalmente — só sumiu do `student-detail-client.tsx` na branch `dashboard-aluno-redesign`. Em main ainda é o componente vivo.
- **expo-sharing já está no projeto mobile** (não foi nova dep no M5). Boa.
- **Onboarding "Primeiros Passos 0/7"** widget bottom-right é onipresente. É contextual ao trainer atual. Confirmar se itens 1-7 incluem tarefas específicas de Avaliações ou só onboarding genérico.

---

## 7. Recomendações priorizadas

Cada item tem 3 atributos: **impacto** (alto/médio/baixo no UX), **esforço** (XS/S/M/L em dias-pessoa), **dependências**.

### Tier 1 — Quick wins (corrigir agora, baixo custo)

| ID | O que | Impacto | Esforço | Depende de |
|---|---|---|---|---|
| QW1 | **Fix: categoria correta em `/forms/templates` para assessments** — estender `CATEGORY_CONFIG` com `assessment` (badge violet, ícone ruler/activity, label "Avaliação Presencial") + ajustar metadata ("seções" em vez de "perguntas", "sessões" em vez de "respostas") | Alto | XS (1d) | Nenhum |
| QW2 | **Pré-preencher aluno no CreateSessionModal quando vindo de `/students/[id]`** — passar `student_id` via query param ou state, render modal com aluno já selecionado | Alto | S (1-2d) | Nenhum |
| QW3 | **Contador correto no header de `/forms`** — ou ambos (forms + assessments), ou contextual ao tab ativo | Médio | XS (0.5d) | Nenhum |
| QW4 | **Limpar empty state da tab Presenciais** — escolher um CTA principal claro, sem 3 entradas redundantes | Médio | XS (0.5d) | Nenhum |

Total: ~3-4 dias-pessoa. Faz sentido empacotar como **M7 — Polish & Bug Fixes**.

### Tier 2 — Coerência visual (média complexidade)

| ID | O que | Impacto | Esforço | Depende de |
|---|---|---|---|---|
| CV1 | **Padronizar paleta entre tabs irmãs** — decidir se Avaliações Presenciais é "categoria especial" (mantém violet) ou "irmã par" (adota azul). Ajustar CTAs, filter chips, hover states | Alto | M (3-5d) | Decisão de produto |
| CV2 | **Estruturar tab Presenciais com seções tipo Respostas** — "Em atraso" (era filter chip → vira callout vermelho pulsante quando >0), "Próximas" (callout azul), "Concluídas recentemente" (lista neutra) | Alto | M (3-4d) | CV1 |
| CV3 | **Unificar verbos de CTAs** — "Enviar para aluno" virar "Atribuir formulário", "Nova avaliação" virar "Agendar avaliação" (ou similares que rimem) | Baixo | S (1d) | Decisão de copy |
| CV4 | **Layout responsivo do assessment builder** — em <1100px colapsa propriedades para drawer, em <800px colapsa biblioteca pra accordion topo. Já parcialmente implementado em mobile, faltam transições intermediárias | Médio | M (4-5d) | Nenhum |

Total: ~10-15 dias-pessoa. Empacotável como **M8 — Visual Coherence**.

### Tier 3 — Integração estrutural (alto valor, alto custo)

| ID | O que | Impacto | Esforço | Depende de |
|---|---|---|---|---|
| INT1 | **Renomear "Avaliações" → "Formulários e Avaliações"** ou nova arquitetura com 2 itens distintos no sidebar (`Formulários` + `Avaliações Presenciais`). Decisão de IA do produto | Alto | S (2d) execução, M discussão | Decisão de produto |
| INT2 | **Timeline cronológica do aluno** — `/students/[id]/timeline` ou seção expandível dentro do detalhe. Mostra anamnese, check-ins, avaliações, prescrições em ordem | Alto | L (5-8d) | Coordenação com Onda 3 do dashboard-aluno-redesign |
| INT3 | **Flow guiado "Onboardar aluno novo"** — 3 cliques contextuais: criar aluno → enviar anamnese → agendar primeira avaliação. Substitui os 5 contextos atuais | Alto | L (5-8d) | INT2 |
| INT4 | **Unificar AssignFormModal + CreateSessionModal em um único "Atribuir template ao aluno"** — UI dinâmica que expande campos sex/age só quando template é assessment | Médio | M (3-5d) | CV3 |
| INT5 | **Unificar builder forms + assessment** — ou pelo menos compartilhar header/breadcrumb/save logic, mantendo canvas distinto | Baixo | L (5-7d) | Risco alto, baixo retorno imediato |

Total Tier 3: ~20-30 dias-pessoa. Empacotável como **M9 — Structural Integration**.

### Tier 4 — Paridade web/mobile (estratégico)

| ID | O que | Impacto | Esforço | Depende de |
|---|---|---|---|---|
| PAR1 | **Builder mobile simplificado** (list-based, sem drag-drop) | Médio | L (5-8d) | Nenhum |
| PAR2 | **Modo "preencher agora" no web** (captura desktop/tablet) | Alto p/ estúdios | L (5-7d) | Nenhum |
| PAR3 | **"Criar com IA" no mobile** | Baixo | M (3-4d) | PAR1 |

Total Tier 4: ~13-19 dias-pessoa. Empacotável como **M10 — Cross-platform Parity**.

---

## 8. Recomendação de roadmap para Fase 2

Pensando em ordem de prioridade, dependências, e ROI:

### Fase 2.1 — Limpeza (1-2 semanas)
**M7 — Polish & Bug Fixes (Tier 1 inteiro)**
Corrige o bug de categoria, melhora UX micro, custo baixo, ganho imediato de qualidade percebida. Não bloqueia nada.

### Fase 2.2 — Decisão estratégica (workshop, não milestone)
**Workshop de design** com você + (idealmente) feedback de 2-3 trainers reais sobre:
- Avaliações Presenciais é "categoria especial" ou "irmã par"?
- Formulários e Avaliações: 1 item de menu ou 2?
- Vale unificar builders ou são propositalmente separados?

Output: 3-5 decisões registradas em ADR (Architecture Decision Records). Sem decisão, Tier 2 e 3 ficam parados.

### Fase 2.3 — Coerência (2-3 semanas)
**M8 — Visual Coherence (Tier 2)**
Após decisões do workshop, executa CV1-CV4. Eleva a percepção de produto unificado sem mexer em arquitetura.

### Fase 2.4 — Integração estrutural (4-6 semanas)
**M9 — Structural Integration (parte do Tier 3)**
Coordena com Onda 3 do dashboard-aluno-redesign. Implementa INT1 + INT2 + INT3 (renomeio + timeline + flow guiado). Deixa INT4 e INT5 para depois — risco/recompensa não compensa numa primeira leva.

### Fase 2.5 — Paridade (paralelo ou depois)
**M10 — Cross-platform Parity**
Pode rodar em paralelo com M9 se houver banda. Ou ficar pra depois. Decisão de prioridade depende de quantos trainers 100% mobile temos hoje.

---

## 9. Riscos e cuidados

- **Coordenação com `dashboard-aluno-redesign`** — branch tem 4 commits ahead, 1 behind main. Antes de Fase 2 começar, decidir: rebase, merge, ou continuar como branch paralela. Conflict aréa: `/students/[id]/student-detail-client.tsx`, `health-metrics-card.tsx`, `assessment-sidebar-card.tsx`.
- **Mudar nomenclatura ("Avaliações" no sidebar)** mexe com a memória muscular dos trainers atuais. Pode gerar pequena onda de "ué, sumiu". Mitigação: mensagem in-app de "renomeamos para...".
- **Renomear categorias** afeta dados existentes. Migration de soft-rename (não deletar `survey`, só ocultar para assessments) preserva backward compat.
- **Onboarding tour `forms`** assume estrutura visual específica. Se M8 mexer, atualizar selectors `data-onboarding`.

---

## 10. O que NÃO está neste relatório

- Auditoria do app mobile (escopo definido como "foco web")
- Performance/bundle size (não foi pedido, embora seja relevante)
- Acessibilidade (a11y) — vale auditoria dedicada depois
- Tradução/i18n — produto é PT-BR fixo
- Dashboard, Programas, Treinos, Financeiro, Bibliotecas, Agenda — fora do recorte da Fase 2 atual

---

## 11. Próximos passos sugeridos (operacional)

1. Você lê este relatório e marca o que ressoa, o que discorda, o que está fora de foco
2. Marcamos um workshop curto (você + eu) para decisões estratégicas (item 8.2 acima)
3. Eu escrevo a spec do M7 (Tier 1 quick wins) — pode rodar em paralelo enquanto o workshop não acontece
4. Após workshop: spec do M8 e M9 com escopo afinado

Não bloqueia nada agora. Você tem o material. Quando quiser, retomamos.
