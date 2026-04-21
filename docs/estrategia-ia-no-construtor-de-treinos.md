# Prescrição com IA dentro do Construtor de Treinos — Estratégia & UX

**Autor:** Gustavo (com apoio do Claude)
**Data:** 16 de abril de 2026
**Status:** Proposta para decisão

---

## 1. O problema, em uma frase

Hoje a prescrição com IA vive num fluxo paralelo (`/students/[id]/prescribe`) disparado de dois cartões do dashboard do aluno ("Treino em execução" e "Próximos Programas"). Isso força o treinador a escolher *antes de começar a trabalhar* entre dois modos de trabalho — "IA" ou "manual" — como se fossem produtos diferentes. O objetivo é que a IA seja **uma ferramenta dentro do construtor**, não **um caminho alternativo pra chegar até ele**.

## 2. Diagnóstico do estado atual

### 2.1 Como está hoje

No dashboard do aluno, o treinador cria um programa a partir de dois cartões:

- **"Treino em execução"** — cria substituto/novo. Tem um botão "Novo com IA" que só aparece se `trainer.ai_prescriptions_enabled` está ligado (`student-detail-client.tsx:532`). O caminho manual vai para `/program/new`; o "Novo com IA" vai para `/prescribe`.
- **"Próximos Programas"** — agenda um programa para a fila. Tem "+ Criar Novo" que manda para `/program/new?scheduled=true` e também um botão "Novo com IA" (`student-detail-client.tsx:686`) que dispara a mesma `handlePrescribeAI` e leva para `/prescribe` — ou seja, o fluxo de IA hoje **não diferencia** se o programa é para ativar agora ou agendar na fila; cai sempre na mesma tela.

Dentro do `ProgramBuilderClient` existe uma barra de ações no topo com três toggles de *viewMode*: `preview` (celular), `compare` (comparar com programa anterior) e `ai_prescribe`. O `ai_prescribe` abre hoje um painel chamado **"Texto para Treino"** (`AiPrescribePanel`) — uma ferramenta de *colar texto solto e a IA transforma em exercícios e adiciona ao treino ativo*. É uma IA leve, tática, "digite ou cole o treino em linguagem natural".

### 2.2 O achado importante

Existem **duas IAs diferentes** no produto hoje, e elas não conversam:

| Eixo | `/prescribe` (fluxo paralelo) | `ai_prescribe` no builder |
|---|---|---|
| Entrada | Anamnese + contexto + questionário + perguntas do agente | Texto livre colado/digitado |
| Motor | Claude agent + OpenAI (geração completa) | `/api/prescription/parse-text` (parseamento) |
| Saída | Programa inteiro + racional | Exercícios inseridos no treino ativo |
| Momento de uso | "Começar do zero com IA" | "Já estou montando, quero atalho para colar um treino" |
| Escopo | Programa completo (várias aulas) | Um bloco de exercícios |
| Status | Robusto, com stepper e status | Simples, painel lateral |

As duas são úteis e **representam dois jobs distintos**: *"gera o programa inicial pra mim baseado no aluno"* vs. *"traduz este texto em exercícios"*. O problema atual não é ter duas — é que a primeira vive fora do construtor, e a existência das duas separadas cria confusão.

### 2.3 A boa notícia técnica

O fluxo `/prescribe` **já salva a saída da IA no mesmo schema do builder** e redireciona para `/program/new?generationId=...`. Ou seja: hoje a IA já termina dentro do construtor — o treinador só tem que atravessar uma tela inteira antes disso. Não é um "refactor de produto", é uma mudança de **onde** a jornada começa. Tipos, actions de salvamento (`assignProgram`), mapeamento (`mapAiOutputToBuilderData`), tabela `prescription_generations` — tudo reaproveitável.

## 3. Princípios de design

Antes de falar de opções, quatro princípios para manter a honestidade:

**Um construtor, múltiplas formas de começar a preencher.** O construtor é o produto; IA é um dos "preenchedores", ao lado do "começar do zero", "duplicar programa anterior" e "aplicar modelo". Todos desembocam no mesmo estado editável.

**IA assistiva, não substitutiva.** O treinador nunca deve sentir que "entregou o trabalho pra IA e agora precisa conferir o trabalho dela". A IA preenche; o treinador ajusta. Por isso a IA deve aparecer *dentro* do lugar onde ele ajusta, e não *antes* dele.

**Dois jobs, uma superfície coerente.** Geração completa (a partir de perfil/histórico) e parseamento de texto são jobs diferentes e devem continuar existindo — mas o treinador deve entender que ambos são "coisas que a IA faz pra ele dentro do construtor". Unificar a narrativa, não necessariamente a UI.

**Contexto do aluno é o ativo principal.** O valor da IA do Kinevo não é "gerar treinos" (qualquer GPT faz) — é "gerar treinos que consideram a anamnese, os questionários e o histórico deste aluno específico". Esse contexto precisa estar visível no momento da geração para que o treinador confie.

## 4. Três alternativas de integração

Usei três variações do mesmo esqueleto — elas diferem em **quanto a IA "invade" a UI do construtor** e em **quando o treinador é pedido para tomar decisões**.

### Alternativa A — Botão único "Gerar com IA" na barra de ações

A UI do construtor ganha um único botão na barra de ações principal, ao lado de Salvar/Agendar/Ativar. Ao clicar, abre um painel lateral direito com dois modos em tabs:

- **"A partir do aluno"** (substitui o `/prescribe` atual) — anamnese + contexto + perguntas do agente, agora dentro do construtor como painel lateral. Enquanto a IA gera, o treinador vê o construtor ficar preenchido em tempo real ou ao final de uma vez.
- **"A partir de texto"** (o `AiPrescribePanel` atual, "Texto para Treino") — mantém como está hoje.

Os pontos de entrada no dashboard deixam de ter "Novo com IA". Ambos os cartões levam direto para `/program/new` — a IA está no construtor, não na navegação.

**Prós.** Uma única porta de entrada, visualmente simples. Resolve o pedido literal (migrar a IA para o construtor). Desambigua "IA" pro treinador: é uma ferramenta dentro da tela de trabalho. Reaproveita quase tudo que existe.

**Contras.** Perde-se o "atalho do dashboard" para quem quer 100% IA — o treinador precisa abrir o construtor vazio primeiro, depois clicar em IA. Dois cliques pra começar o fluxo que antes era um. Pode frustrar quem usa IA como ponto de partida padrão.

**Quando escolher.** Se a análise de uso mostrar que a maioria dos treinadores edita manualmente depois da geração — ou seja, se o construtor já era o destino de fato.

---

### Alternativa B — Botão no construtor **+** atalho preservado no dashboard (recomendada)

Mesmo botão da Alternativa A dentro do construtor (a barra de ações com "Gerar com IA"), mas **mantém-se os atalhos "Novo com IA" no dashboard** — com um detalhe importante: esses atalhos agora são apenas atalhos de navegação. Eles abrem `/program/new?mode=ai` (ou equivalente) — ou seja, vão direto pro construtor e *já disparam o painel de IA aberto*. A UI de IA **só existe num lugar** (o painel dentro do construtor), mas existe mais de uma forma de chegar até lá.

No construtor, o painel de IA abre ocupando ~40% à direita. O treinador vê a estrutura do construtor vazia à esquerda e, enquanto preenche anamnese/responde perguntas do agente, visualiza o construtor ser populado em tempo real (streaming ou *commits* parciais). Quando a IA termina, o painel se reduz a um botão discreto de "Ajustar com IA" (permitir tweaks pontuais: "torne o treino B mais curto", "adicione mais volume de pernas").

Concretamente o fluxo do ponto de vista do treinador:

1. No dashboard, clica "Novo com IA" → abre o construtor com painel de IA já aberto em anamnese.
2. Preenche perfil → vê perguntas do agente → responde.
3. Clica "Gerar" → vê os treinos aparecerem no canvas à esquerda em tempo real (ou ao final, se streaming não for viável na primeira versão).
4. Painel reduz-se; treinador edita livremente; reabre painel pra pedir ajustes.
5. Salva/Agenda/Ativa normalmente.

**Prós.** Preserva a velocidade pra quem já tem a IA como fluxo padrão. Unifica a UI (uma única superfície de IA, no construtor). Mostra o contexto do aluno e o resultado lado a lado — o que vende o diferencial do Kinevo. Abre espaço natural para "Ajustar com IA" pós-geração (conversa iterativa com o treino já montado), que hoje não existe e é um valor enorme.

**Contras.** Mais complexo de implementar — requer integrar o stepper do `/prescribe` como painel lateral redimensionável, pensar em streaming/commit parcial, e coordenar estado entre painel IA e canvas. Painel lateral pode ser apertado em monitores pequenos (precisa responsividade).

**Quando escolher.** Se o objetivo é **também** extrair mais valor da IA (conversa pós-geração, ajustes iterativos) — não só "migrar o botão". É a aposta mais alta de valor.

---

### Alternativa C — IA no construtor com acesso também por bloco/aula

Variação da B com uma dimensão extra: a IA não só monta o programa inteiro, mas também age **por aula**. Cada aula do construtor ganha um menu "…" com ações IA: "Sugerir exercícios para esta aula", "Balancear volume", "Substituir por variação com menos impacto articular". A barra principal ainda tem "Gerar com IA" para geração completa.

**Prós.** Transforma IA de um "evento inicial" em "assistente contínuo" — mais alinhado ao job real do treinador, que itera. Valor de produto muito superior.

**Contras.** Muito mais trabalho de produto e engenharia (cada ação por bloco é um prompt, um modelo de UI, um estado de loading). Difícil de entregar bem na primeira iteração. Risco de virar "IA everywhere" sem que nenhum dos modos fique polido.

**Quando escolher.** Como horizonte de 3–6 meses, depois de ter a Alternativa B estável. Não como primeira entrega.

## 5. Recomendação

**Alternativa B**, com a Alternativa C como horizonte.

Razões resumidas:

- Preserva o comportamento que os treinadores já internalizaram (botão "Novo com IA" no dashboard) sem manter o fluxo separado — os atalhos viram navegação, não produto.
- A UI de IA passa a viver em um único lugar, dentro do construtor, o que resolve o pedido central.
- A mudança abre naturalmente um próximo capítulo de produto ("Ajustar com IA" pós-geração) que é onde mora muito valor não explorado.
- Tecnicamente é viável com o que já existe: o `PrescribeClient` precisa virar um painel (`<AiPrescriptionPanel/>`) que aceita as mesmas props e renderiza dentro do construtor. Nenhuma mudança de schema.

## 6. Proposta de UX detalhada (Alternativa B)

### 6.1 Barra de ações do construtor

Hoje os ícones ali são todos do mesmo "peso visual" (pré-visualizar, comparar, texto-pra-treino). A IA principal não deve ser um ícone como os outros — ela deve ser um **botão principal com label**, visualmente mais presente:

- **"✨ Gerar com IA"** — botão roxo sólido (a cor do acento do produto) ou outline com estrela, à esquerda do grupo de ações secundárias (pré-visualizar/comparar/"Texto para Treino").
- O atual botão "Texto para Treino" (`FileText`) pode ser agrupado **dentro** do painel de IA como uma das abas/modos, ou permanecer como ícone secundário — opto por agrupá-lo no painel de IA para consolidar a narrativa "IA = este painel".

### 6.2 O painel

Painel lateral direito, ~420–480px, com header que mostra **"IA — {nome do aluno}"** e um chip de contexto (ex.: "Usando: anamnese, 3 questionários, último programa"). Conteúdo em etapas:

1. **Escolha o modo** (se vier sem `?mode`): cards "A partir do perfil do aluno" (recomendado) e "A partir de um texto" (colar).
2. **Modo perfil**: stepper atual do `/prescribe` (anamnese → análise → perguntas do agente → gerando). Preserva o que já funciona.
3. **Durante geração**: o canvas à esquerda mostra skeleton de aulas sendo preenchidas, e o painel mostra o racional ("Escolhi supino inclinado porque o aluno reportou desconforto no ombro direito"). Esse racional fica salvo e acessível depois via `PrescriptionRationalePanel`.
4. **Pós-geração**: painel se reduz a uma barra com "Ajustar com IA" e "Ver racional". Clicar "Ajustar" reabre o painel com um campo de texto ("peça um ajuste: 'adicionar um dia de cardio'").

### 6.3 Dashboard do aluno

**Decisão tomada (16/abr/2026):** os dois botões "Novo com IA" são **removidos** do dashboard (linhas 532 e 686 em `student-detail-client.tsx`). A ponta do dashboard passa a ter apenas "Criar Novo" / "+ Criar Novo" — o treinador entra no construtor vazio e aciona a IA lá dentro pelo botão "Gerar com IA". É a simplificação mais alinhada com a ideia de "IA vive dentro do construtor, não como caminho alternativo de navegação".

Isso resolve de brinde um bug de experiência atual: hoje os dois botões "Novo com IA" disparam a mesma rota (`/prescribe`), e o fluxo não diferencia se é para ativar agora ou agendar na fila. Ao consolidar no construtor, o contexto `scheduled=true` viaja pela query-string normal do construtor e os botões de save já sensíveis a contexto ("Agendar na Fila" vs. "Ativar como Atual") assumem a decisão, que é onde a decisão visualmente deveria estar.

A rota `/prescribe` **vira redirect imediato** para `/program/new?mode=ai` (308 permanente). Sem dual-run.

### 6.4 Primeira abertura — qual o default?

Tem uma pergunta que vai voltar no review: "quando o treinador clica em 'Criar Novo' (sem dizer IA), o painel de IA abre por padrão?". Proposta: **não**. O default é o construtor vazio. A IA é uma ação explícita — e isso vale para respeitar o treinador que quer começar manualmente. O botão "Gerar com IA" fica visível e convidativo, mas não invasivo.

## 7. Riscos e como mitigar

**"E se o treinador estava no meio de um programa e clica IA? Perde o trabalho?"** O painel IA deve respeitar estado atual — se há conteúdo, o modo "A partir do perfil" deve perguntar "Substituir este programa" vs. "Adicionar uma aula com IA". O modo "A partir de texto" já se comporta bem (adiciona ao treino ativo).

**Painel lateral em monitores pequenos.** Definir breakpoint: abaixo de 1280px, painel vira fullscreen/modal. Acima, é side-by-side. Isso casa com o fato de o público do Kinevo provavelmente ser desktop (treinadores montando programas).

**Percepção de lentidão.** Geração com LLM pode demorar 10–30s. Sem streaming, o painel precisa mostrar progresso semântico ("analisando anamnese", "montando aula A", "ajustando volume") em vez de um spinner genérico. O `GenerationStatus` atual já faz isso; manter.

**Confusão entre "Texto para Treino" e "Gerar com IA".** Se for manter as duas como modos do painel, rotular bem: "**Começar do zero (IA)**" vs. "**Converter texto em exercícios**". Linguagem, não só ícone.

## 8. Roadmap sugerido (alto nível)

| Fase | Escopo | Critério de pronto |
|---|---|---|
| 1 | Embutir `PrescribeClient` como painel dentro do `ProgramBuilderClient`; adicionar botão "Gerar com IA" na barra; rota `/prescribe` vira redirect | Treinador consegue gerar programa pela IA a partir do construtor; comportamento do `/prescribe` preservado funcionalmente |
| 2 | Unificar "Texto para Treino" como aba do painel de IA; atualizar dashboard para `/program/new?mode=ai` | UI de IA vive num único componente; `ai_prescribe` ViewMode deprecated |
| 3 | "Ajustar com IA" — conversa iterativa pós-geração (`"adicione mais volume de pernas"`) | Treinador consegue refinar o programa sem sair da tela |
| 4 | Ações IA por aula/bloco (Alternativa C) | Cada aula tem menu de ações IA contextuais |

Fase 1 é o coração do pedido. Fases 2–4 são escadas de valor sobre a mesma infra.

## 9. Decisões tomadas (16/abr/2026)

As quatro questões em aberto foram fechadas com o Gustavo:

1. **Entrada única.** Dashboard passa a ter um único "Criar Novo". IA é acionada dentro do construtor.
2. **Streaming parcial, sim.** Exercícios aparecem em tempo real no canvas. A implementação recomendada (ver `docs/specs/02-fase-1.5-streaming-parcial.md`) é **commits parciais por aula** — uma chamada de plan seguida de N chamadas por aula, persistidas incrementalmente em `prescription_generations.output_snapshot` e consumidas via polling. Não é streaming de bytes da LLM; entrega o mesmo efeito visual com muito menos mudança de infra.
3. **"Texto para Treino" vira aba** do painel de IA, encerrando o botão separado e o `BuilderViewMode='ai_prescribe'`.
4. **Redirect imediato** de `/prescribe` para `/program/new?mode=ai`. Sem dual-run.

## 10. Specs executáveis para o Claude Code

As specs detalhadas estão em `docs/specs/`:

- `00-visao-geral.md` — ler primeiro (decisões, invariantes, glossário).
- `01-fase-1-embutir-painel-ia.md` — spec completa da Fase 1.
- `02-fase-1.5-streaming-parcial.md` — spec completa da Fase 1.5.
- `03-fase-2-unificar-texto-para-treino.md` — spec completa da Fase 2.
- `04-fase-3-ajustar-com-ia.md` — alto nível; será detalhada após Fase 1.5 em prod.
- `05-fase-4-ia-por-aula.md` — alto nível; será detalhada após Fase 3 em prod.
