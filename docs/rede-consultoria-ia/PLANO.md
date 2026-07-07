# Rede de Consultoria Assistida por IA — Plano de Estratégia

> **Tipo:** Tese de produto + go-to-market (estratégico, não spec de implementação).
> **Data:** 2026-07-02.
> **Status:** Fase 1 do loop (§5) **IMPLEMENTADA em 2026-07-02/03** — feature "Consultoria IA"
> no working tree (não commitada): migration 226 (aplicada em prod), triagem PAR-Q
> (`web/src/lib/consultoria/`), actions (`web/src/actions/consultoria/`), fila `/consultoria`,
> carimbo CREF, atribuição no mobile. Camadas de §5.2 (standing orders/lote) e negócio
> (§6-§7, pricing/Wellhub) NÃO implementadas — v1 é o piloto do Model A.
> **Origem:** sessão de brainstorm (captação → OBP → loop IA-humano → economia da rede).
> **Artefatos visuais:**
> - Loop IA-faz / humano-valida → https://claude.ai/code/artifact/a8c8ed42-79fc-41f2-a9fe-dad46c952ef8
> - Modelo de unidade da rede → https://claude.ai/code/artifact/940840e2-5b2c-4922-b64e-9924aa4f1a49
> **Relacionado:** `docs/analise-venda/` (escada de 4 tiers), `docs/analise-mcp-assistente-custos.md` (COGS de IA), `docs/estudios/PLANO.md` (B2B).

---

## 0. TL;DR

O problema nº 1 do personal trainer é **captação de aluno**. Em vez de resolver isso com um diretório de descoberta (fraco, vazável, sem demanda), o Kinevo resolve com **um produto de consultoria padronizado, barato e legalmente compliant** — a IA faz 90% da análise e prescrição, um Profissional de Educação Física registrado no CREF valida e assume a responsabilidade técnica — e **canaliza demanda** pra ele (começando pelos treinadores atuais; depois, potencialmente, Wellhub).

- **A unidade fecha:** ~R$9–10 de margem Kinevo por aluno/mês nos dois canais.
- **O gargalo não é margem — é demanda** (por isso o foco é captação) **e absorção de fixo** (~12,5k alunos ativos ≈ 63 treinadores lotados).
- **Preço flat de SaaS quebra aqui:** a IA de coaching exige cobrança **por aluno ativo**, o que é a mesma ponte pro outcome/usage-pricing.
- **Sequência:** Model A (treinador vende aos próprios alunos) primeiro — risco de demanda zero; Model B (Wellhub) só depois de travar payout ≥ R$38 e derrubar o COGS de IA.

---

## 1. O problema

Captação é a dor nº 1 e mais cara do personal. Todo o resto do Kinevo (prescrição, financeiro, mensagens) melhora a vida de quem **já tem** aluno; quase nada ataca **conseguir** aluno. Duas ideias surgiram pra atacar isso:

1. **Marketplace** — ecossistema onde alunos acham personais; o treinador paga pra participar.
2. **Consultoria IA + humano** — o aluno faz anamnese, a IA analisa e prescreve, um treinador humano valida. Custo mais baixo pro aluno; possível oferta via Wellhub.

**Conclusão desta análise: não são duas ideias — são uma só, e na ordem errada.**

---

## 2. Por que o marketplace-diretório morre sozinho

Três leis de física de marketplace jogam contra o Kinevo no formato "diretório onde o treinador paga pra participar":

| Problema | Por quê é fatal aqui |
|---|---|
| **Você tem oferta, não demanda** | O Kinevo é o SO do treinador (B2B). Alunos não chegam ao Kinevo pra procurar personal. Marketplace = construir o lado que você **não** tem (marketing de consumidor, marca B2C, CAC) — outra competência, fora do foco. |
| **Personal é o pior caso de vazamento** | Serviço **presencial** é o cenário mais fácil de furar a plataforma (o problema TaskRabbit). Aluno e treinador migram pro WhatsApp no dia 1. "Take-rate sobre a relação" vaza ~100%. |
| **Competição com quem tem marca + budget** | Inclusive o próprio Wellhub, que comprou a Trainiac (2021) pra ofertar personais. Kinevo como *destino de descoberta* é briga perdida. Sua vantagem é o back-office, não a descoberta. |

O único formato de captação que sobrevive: **intro qualificada paga adiantado** (pay-per-qualified-intro), cobrada **antes** do vazamento ser possível — que é exatamente uma superfície de outcome-pricing (ver §4). Mas mesmo isso depende de resolver a demanda.

---

## 3. A tese: as duas ideias são UMA — "rede de fulfillment gerenciada"

O reframe central:

> A Ideia 1 (marketplace) morre sozinha (sem demanda + vazamento presencial). A Ideia 2 (consultoria IA+humano) é forte mas precisa de distribuição. **Combinadas**, viram um negócio coerente — desde que "marketplace" deixe de ser um **diretório de descoberta** e vire uma **rede de fulfillment gerenciada.**

O encaixe:
1. A **Ideia 2** cria um produto padronizado e barato (coaching desenhado por IA + validado por humano) — padronizado o suficiente pra ser vendido por um canal de demanda.
2. **Demanda** vem do próprio treinador (base existente) ou de um parceiro (ex.: Wellhub).
3. O "marketplace" não é uma lista onde o aluno garimpa — é o **Kinevo roteando demanda pra uma oferta curada de treinadores** que cumprem a consultoria assistida por IA.
4. Kinevo tira um cut do fulfillment; **o treinador resolve a captação plugando em demanda em vez de caçá-la.**

**Por que essa versão sobrevive ao vazamento** (que mataria a Ideia 1): o Kinevo controla três pontos ao mesmo tempo — o **roteamento da demanda** + a **camada de IA** + o **SO do treinador**. O aluno chegou porque o Kinevo mandou; a IA e o app seguem entregando valor todo mês; então "furar pro WhatsApp" não economiza fee — deixa de ser pedágio e vira feature.

---

## 4. Filosofia de pricing: outcome-based, na dose certa

Contexto de mercado (2025-2026): **outcome-based pricing** (cobrar pelo resultado mensurável, não por acesso/uso) é a fronteira de pricing de IA. Exemplos-cânone: Intercom US$0,99/conversa resolvida, HubSpot US$0,50. Mas o consenso é **híbrido** (piso de assinatura + camada de outcome), nunca outcome puro — atribuição, definição de outcome e ansiedade de conta matam o puro.

**Aplicação ao Kinevo — os dois níveis de "outcome":**

| Nível | Outcome | Kinevo mede? | Kinevo cobra? |
|---|---|---|---|
| **A — negócio do treinador** | lead→aluno pagante, pagamento recuperado, retenção | **Sim** (CRM + rails de pagamento) | **Sim** (está no fluxo do dinheiro) |
| **B — fitness do aluno** | perdeu peso, ganhou força | Parcial | **Não** (atribuição impossível, risco moral) |

**Sacada:** ancore OBP no **nível A**, nunca no B. O Kinevo tem vantagem que 90% dos SaaS não têm: **já senta no rail de pagamento** (Asaas + Stripe) → consegue *medir* e *cobrar* o outcome (como Stripe/Shopify com take-rate). O nível B vira **narrativa/garantia de marketing** (ex.: "garantia de retenção"), não billing.

As três camadas de OBP (da mais viável pra aspiracional):
1. **Take-rate sobre dinheiro que passa pelo Kinevo** — conversão de lead, recuperação de pagamento. Atribuição limpa, coletável. É a **captação-como-produto** da §3.
2. **Créditos de IA que só queimam com resultado** — winback que não reteve não conta; refino do que já existe.
3. **Outcome de fitness como garantia** — marketing, não métrica.

> O pricing por aluno da rede de consultoria (§6) **é** essa filosofia aplicada: você cobra por unidade de valor entregue, não por seat.

---

## 5. O produto: o loop "IA-faz / humano-valida"

**Princípio operante:** *IA rascunha → o humano dispõe → o risco roteia a atenção → a responsabilidade torna real.*

### 5.1 O loop (7 estágios)

1. **Anamnese & triagem de risco** *(IA-assistida)* — aluno preenche anamnese estruturada (PAR-Q+, objetivo, histórico, lesões, equipamento, disponibilidade). Screen de risco bifurca:
   - 🟢 **Verde** (baixo risco) → IA segue, validação padrão.
   - 🟡 **Amarelo** (sinais de alerta) → segue com validação humana reforçada + flags.
   - 🔴 **Vermelho** (contraindicação, condição não controlada, gestação c/ intercorrência, pós-cirúrgico) → **PARADA**: nenhum plano gerado; revisão humana obrigatória + liberação médica.
2. **Análise & rascunho** *(IA)* — lê anamnese + assessments → **rascunho** invisível ao aluno, com racional citando a anamnese + confiança + perguntas abertas pro validador. Opera **dentro do protocolo do profissional** (standing orders).
3. **PORTÃO — validação humana CREF** *(humano, não-pulável)* — profissional revisa (racional + flags + **diff** IA-vs-edição); **aprova/edita/rejeita**; age nas flags. Ao aprovar, vira **legalmente a prescrição dele**, carimbada com nome + CREF + timestamp. Só então publica. **Sem auto-publicação por tempo.**
4. **Publicação & execução** *(sistema → aluno)* — `assign_program` dispara; aluno treina no app, com atribuição CREF visível.
5. **Sinais de volta** *(IA monitora)* — check-ins, aderência, PRs, dor → insights.
6. **Ajuste → mesmo portão** *(IA rascunha, humano valida, tier leve)* — progressão/deload/troca; rotina dentro do protocolo aprova em lote, exceção sobe.
7. **Escalada** *(humano síncrono)* — dor/lesão, platô, queda de aderência, red flag em re-anamnese → IA **escala, não resolve**. Contato humano (mensagem, revisão mensal, form-check por vídeo).

### 5.2 Camadas de validação (protegem o 1-para-200)

| Evento | Camada | Por quê |
|---|---|---|
| Prescrição inicial | Completa · individual | Maior risco clínico + legal |
| Progressão de rotina (verde, no protocolo) | Lote · exceção | Alavancagem sem perder o humano |
| Anomalia · amarelo · vermelho | Individual · não-pulável | Segurança > eficiência |

**Standing orders:** o profissional configura o protocolo **uma vez** (faixas de rep, regras de progressão, deload, contraindicações); a IA opera dentro do envelope; só exceções sobem. Dá alavancagem e é mais limpo juridicamente (regras pré-aprovadas por humano habilitado).

### 5.3 Como garantir que a validação é REAL (anti-carimbo)

O maior risco: humano validando 200 planos vira carimbo automático → o valor de confiança/legal/CREF evapora. **O produto É a qualidade da validação.** Seis mecanismos:

1. **Roteie a atenção, não refaça o trabalho** — IA pré-aprova o trivial, força toque humano no incerto (flags de confiança/risco).
2. **Ação afirmativa obrigatória** — nada auto-publica; precisa aprovar ativamente + reconhecer flags.
3. **Diff + taxa de edição** — aprovar 100% sem editar em 200 casos = sinal de carimbo → flag de auditoria.
4. **Tempo em revisão** — rápido demais = sinal (input de QA).
5. **Amostragem & QA** — auditoria aleatória por revisor sênior; qualidade alimenta o ranking na rede (bons validadores recebem mais demanda).
6. **Skin in the game legal (pedra angular)** — o profissional assume a responsabilidade técnica → incentivo mais profundo e barato de todos. Validação vira real por interesse próprio, não por vigilância.

### 5.4 Enquadramento CREF (Brasil) — o modelo é o caminho compliant

Prescrever/orientar exercício é **privativo do Profissional de EF registrado no CREF** (Lei 9.696/1998, reafirmada pelo STF). IA-pura prescrevendo direto tem exposição legal cinzenta. "IA rascunha, profissional valida e assume responsabilidade" não é só economia — é o **jeito legalmente correto** de escalar IA de prescrição no Brasil. Concorrentes de IA-pura têm passivo; o Kinevo tem o porto seguro.

- **IA é ferramenta de apoio à decisão** — nunca prescreve; produz proposta que jamais chega sozinha ao aluno.
- **Prescrição atribuível** — nome + CREF + data na tela do aluno (confiança + trilha de auditoria).
- **Atendimento remoto é permitido** — o Profissional orienta à distância assumindo condição de **Responsável Técnico** (resoluções CONFEF/CREF).
- **Triagem PAR-Q com roteamento de liberação médica** para red flags (padrão de cuidado ACSM).

**Duas estruturas legais possíveis — a decisão estrutural do produto:**

| | **A — Kinevo habilita o treinador** *(mais leve)* | **B — Kinevo opera a rede** *(mais pesada)* |
|---|---|---|
| Prescritor / RT | O próprio treinador-cliente (PF, CREF ativo) | Precisa de **registro CREF-PJ + Responsável Técnico** |
| Kinevo é | Software (fora da cadeia de responsabilidade) | Prestador de serviço de EF |
| Conflito de canal | Não | **Sim** (compete com clientes SaaS) |
| Quando usar | Sempre — piloto de baixo risco | Só quando um canal (Wellhub) justificar virar prestador |

> ⚠️ **Não é parecer jurídico.** A Estrutura B (PJ + RT) precisa de confirmação com advogado especializado / consulta ao CREF antes de operar como prestador.

---

## 6. A economia da rede

**Premissas de planejamento** (as duas ⚑ são negociadas/incertas e mais sensíveis):

| Premissa | Valor |
|---|---|
| Câmbio | R$ 5,50 / US$ |
| COGS de IA por aluno·mês (com cache/gate) | R$ 10 |
| Infra + QA por aluno·mês | R$ 3 |
| Taxa de pagamento (só DTC) | 3,5% |
| Capacidade de validação por treinador | 200 (100–300) |
| Preço ao aluno · DTC | R$ 89 (59–119) |
| Take do Kinevo · DTC | 25% |
| Payout Wellhub / aluno ativo ⚑ | R$ 45 (30–60) |
| Pago ao treinador · validação (Model B) ⚑ | R$ 22 |

> COGS de IA ancorado em `docs/analise-mcp-assistente-custos.md`: tarefa pesada US$0,19–1,39 no `gpt-4.1-mini` (com cache read $0,10). O produto de coaching usa IA **bounded** (não chat aberto), o que mantém o custo perto de R$10.

### 6.1 Margem por aluno (para onde vai cada real)

| Componente | **Model A** (DTC, aluno paga R$89, take 25%) | **Model B** (Wellhub paga R$45) |
|---|---|---|
| Líquido do treinador | **R$ 64** (72%) | R$ 22 |
| COGS de IA | R$ 10 | R$ 10 |
| Infra + QA | R$ 3 | R$ 3 |
| Pagamento (3,5%) | R$ 3 | — (B2B) |
| **Margem Kinevo** | **R$ 9** | **R$ 10** |

A margem do Kinevo é ~igual nos dois. O que muda é **quem fica com o grosso** e **quem resolve a demanda**.

### 6.2 Renda do treinador (por que ele topa)

Com a IA fazendo o desenho (~10 min/aluno/mês), um treinador supervisiona centenas:

| Alunos | Model A líquido/mês | Model B líquido/mês | Tempo |
|---|---|---|---|
| *Baseline online 1:1 (~25 × R$150)* | *R$ 3.750* | — | *~40–50 h* |
| 60 | R$ 3.816 | R$ 1.320 | ~10 h |
| 100 | R$ 6.360 | R$ 2.200 | ~17 h |
| **200 (capacidade)** | **R$ 12.720** | **R$ 4.400** | ~33 h |

Model A **bate o roster tradicional já com ~60 alunos** (menos tempo). Model B rende menos por aluno mas enche a agenda sozinho (CAC zero).

### 6.3 Sensibilidade — as duas alavancas que decidem tudo

**Alavanca 1 · COGS de IA** (margem Kinevo/aluno, Model A):

| COGS IA | R$6 | R$10 | R$14 | R$20 |
|---|---|---|---|---|
| Margem | +13 🟢 | +9 🟢 | +5 🟡 | **−1 🔴** |

→ A leanness da IA **é** a margem. Cache/gate/subsetting (já obrigatórios no doc de custos) são o que segura o verde. **Coaching exige IA bounded, não chat aberto.**

**Alavanca 2 · Payout Wellhub** (margem Kinevo/aluno, Model B, treinador R$22):

| Payout | R$30 | R$38 | R$45 | R$60 |
|---|---|---|---|---|
| Margem | **−5 🔴** | +3 🟡 | +10 🟢 | +25 🟢 |

→ O payout do Wellhub é opaco e desfavorável ao parceiro (per-check-in com teto). **Piso inegociável: payout ≥ R$38** OU pago-ao-treinador ≤ R$15.

### 6.4 Break-even da empresa

A ~R$9–10 de contribuição/aluno, cobrindo ~R$120k/mês de fixo dedicado (time + revisores de QA): **~12.500 alunos ativos ≈ 63 treinadores lotados.** Alcançável.

---

## 7. Recomendação & sequenciamento

1. **NÃO construa o diretório de descoberta.** É o formato mais fraco, mais vazável, mais pesado de CAC.
2. **Construa a consultoria IA+humano como produto que seus treinadores atuais vendem (Model A, Estrutura legal A).** Eles já têm alunos → **risco de demanda zero**, testa o loop IA-valida ao vivo, valida qualidade/legal/ops, aprofunda o valor do SaaS. Adesão fácil (o treinador ganha mais). **É o piloto de menor risco.**
3. **Em paralelo, pilote UM canal de demanda** com pay-per-intro-qualificada (não take-rate na relação).
4. **Só abra o Model B / Wellhub depois de duas travas:** (a) payout negociado **≥ R$38/aluno**; (b) COGS de IA derrubado por gate/cache. E resolva o conflito de canal conscientemente (Estrutura legal B exige CREF-PJ + RT).
5. Se 2–4 funcionarem, você tem a **rede gerenciada**: Kinevo roteia demanda → treinadores curados → coaching IA+humano → Kinevo tira cut. Endgame defensável.

**Insight que atravessa tudo:** preço flat de SaaS quebra aqui (200 alunos × R$10 IA = R$2.000/mês de inferência estoura qualquer plano de R$129). O coaching **exige pricing por aluno ativo** — a mesma ponte pro outcome/usage-pricing.

---

## 8. Riscos (olhos abertos)

| Risco | Mitigação |
|---|---|
| **Conflito de canal** (Kinevo-coaching vs. treinadores-clientes) | Preferir Estrutura A (habilitar o treinador). Só ir pra B com demanda que justifique. |
| **Vazamento/disintermediação** | Kinevo controla demanda + IA + SO simultaneamente → valor recorrente mantém o aluno on-platform. |
| **Validação virar carimbo** | Os 6 mecanismos da §5.3; responsabilidade técnica é o incentivo-âncora. |
| **CREF / legal** | Estrutura A é o porto seguro; B precisa de advogado + CREF-PJ + RT. |
| **Payout Wellhub margem-negativa** | Piso ≥ R$38; não fechar sem isso. |
| **COGS de IA estourar** | IA bounded (não chat aberto) + cache/gate/subsetting. |
| **É outro negócio** (B2C/B2B2C: suporte, trust & safety, ops) | Custo de foco real; começar pequeno com base existente. |

---

## 9. Decisões em aberto

- **D1 — Estrutura legal:** A (habilitar treinador) vs. B (Kinevo presta). Recomendação: começar por A.
- **D2 — Preço ao aluno DTC:** R$59 / R$89 / R$119. Recomendação: R$89.
- **D3 — Modelo de cobrança do Kinevo:** take % (25%) vs. fee fixo/aluno vs. híbrido com piso.
- **D4 — Wellhub agora ou depois:** depois das duas travas (§7.4).
- **D5 — Quem são os treinadores-piloto do Model A** e como medir sucesso antes de escalar.

---

## 10. Fontes

**Pricing / OBP:** Sierra (outcome-based pricing for AI agents); Bessemer (AI Pricing & Monetization Playbook); Forbes/Parloa ("The Most Expensive Myth in Enterprise AI"); Metronome; Stripe; L.E.K.; Monetizely (2026 guide + fitness SaaS); TSIA.
**Marketplace:** Sharetribe (disintermediation/leakage); Platform Chronicles (Hagiu & Wright).
**IA+humano coaching:** XLR8 (apps com coach humano 2026); Boon (AI-only vs hybrid); precedentes Future / Caliber.
**Wellhub:** Wikipedia (aquisição Trainiac); Wellhub for Partners; Help Center (pagamento por check-in com teto + success fee).
**CREF:** Lei 9.696/1998 (Planalto); CREF/CONFEF (competência privativa + atendimento remoto sob RT); STF (obrigatoriedade de registro). Triagem: PAR-Q+ / ACSM.
**Interno:** `docs/analise-mcp-assistente-custos.md`; `docs/analise-venda/`; `web/src/lib/billing/tiers.ts`.
