# Kinevo — Custo de inferência do build de treino: análise para revisão por pares

**Data:** 2026-07-13
**Propósito deste arquivo:** entregar a um segundo modelo/revisor todo o material necessário para **auditar, contestar e refazer** as contas abaixo sem acesso ao repositório. Tudo que é medido está marcado como **[MEDIDO]**; tudo que é premissa está marcado como **[PREMISSA]**; tudo que é derivado do código sem observação está marcado como **[DERIVADO]**.

**Pergunta original do dono do produto:** *"Vale a pena usar um modelo de ponta (GPT-5.5 e similares) no assistente do Kinevo para montar treinos? Quanto gastaríamos?"*

**Ao revisor:** a seção 9 lista explicitamente os pontos onde eu tenho menos confiança e onde quero ser contestado. Se você discordar de uma conta, refaça-a — todos os insumos estão aqui.

---

## 1. O sistema, em uma página

Kinevo é um SaaS de personal trainers (Next.js + Supabase, monorepo web/mobile). Tem um "assistente" de IA que o treinador usa em linguagem natural para gerenciar alunos, financeiro, agenda — e, sobretudo, **montar programas de treino** ("build").

Arquitetura do assistente (`web/src/lib/assistant/command-engine.ts`):

- É um **agent loop** sobre o Vercel AI SDK (`streamText`), com tools expostas via uma ponte MCP in-process (`mcp-bridge.ts` → `client.listTools()`).
- **62 tools** no catálogo (CRUD de alunos, programas, exercícios, financeiro, agenda, formulários, avaliações, leads).
- Um classificador por regex (`build-signals.ts` → `isBuildTurn`) detecta se o turno vai construir/renovar um programa. Se sim, o turno é promovido a **"build grade"**:

```ts
// command-engine.ts:770-791 (resumido)
maxOutputTokens: buildGrade ? 12000 : 1500,
temperature: 0.3,
stopWhen: stepCountIs(buildGrade ? 16 : 8),
tools,                                  // <- as 62, sempre (ver §4)
...(model.startsWith('gemini') && buildGrade
    ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: 4096 } } } }
    : {}),
```

- **Modelos hoje:**
  - Turno normal (conversa): `gpt-4.1-mini` (hardcoded, `command-engine.ts:69`)
  - **Turno de build: `gemini-3.5-flash`** (default, env `ASSISTANT_BUILD_MODEL`, `command-engine.ts:91`)
  - Claude está na whitelist mas **inerte em produção** (`ANTHROPIC_API_KEY` retorna 401 desde mar/2026).
- **Cadeia de retry do build:** `[gemini, gemini, gpt-4.1-mini]` — até 3 execuções completas de LLM por pedido (`command-engine.ts:877-880`). Motivo dominante: *thinking leak* do Gemini, que um comentário no código estima em **~1 a cada 4 builds**.
- **Escalada por truncamento** (`command-engine.ts:923-928`): um turno "normal" que termina com `finishReason === 'length'` sem ter escrito nada é reclassificado como build e **re-roda**. O primeiro turno vira custo perdido.
- **Pior caso: 4 chamadas de LLM cobradas em um único pedido do usuário.**

### Modelo de negócio (é o que define se o custo é aceitável)

O produto **já vende IA por créditos** (`web/src/lib/billing/tiers.ts`). **Um build custa 6 créditos** (`tool-policy.ts:187-197`).

| Plano | Preço/mês | Créditos/mês | **Receita por crédito** | Builds que a cota permite |
|---|---|---|---|---|
| Free | R$ 0 | 25 | — | 4 |
| Essencial | R$ 39,90 | 20 | **R$ 2,00** | 3 |
| Pro IA *(featured)* | R$ 79,90 | 300 | **R$ 0,27** | 50 |
| Premium IA | R$ 129,90 | 1.000 | **R$ 0,13** | 166 |

> **A métrica que decide tudo é: custo de produzir 1 crédito de build vs. receita por crédito do plano.** Qualquer análise em "% do ARPU" (inclusive uma versão anterior desta) está usando a régua errada — o produto já tem gate de créditos.

---

## 2. Dados brutos [MEDIDO]

Fonte: tabelas `assistant_turn_traces` e `ai_usage_events` do Postgres de produção (Supabase, projeto `lylksbtgrihzepbteest`), consultadas em 2026-07-13. Janela: 2026-06-17 → 2026-07-13.

### 2.1 Agregado por modelo

| Modelo | Turnos | Input médio | Input p50 | Input máx | Output médio | Custo médio/turno |
|---|---|---|---|---|---|---|
| `gpt-4.1-mini` | 152 | 34.180 | 15.966 | 360.879 | 338 | $0,0142 |
| `gemini-3.5-flash` | 8 | 147.715 | 102.276 | 326.750 | 896 | **$0,2296** |
| `claude-sonnet-4-6` | 4 | 130.875 | 107.205 | 293.191 | 2.539 | $0,4307 |
| `gpt-4.1` | 2 | 27.165 | — | 29.387 | 440 | $0,0579 |

### 2.2 Turnos individuais de build (a unidade de análise)

| Data | Modelo | Input | Output | Tool calls | Custo |
|---|---|---|---|---|---|
| **13/jul** | gemini-3.5-flash | **320.269** | **3.401** | 8 | **$0,511** |
| 07/jul | gemini-3.5-flash | 288.216 | 257 | 12 | $0,435 |
| 23/jun | gemini-3.5-flash | 326.750 | 619 | 11 | $0,496 |
| 23/jun | gemini-3.5-flash | 181.496 | 2.556 | 17 | $0,295 |
| 20/jun | claude-sonnet-4-6 | 293.191 | 4.043 | 13 | $0,940 |
| 19/jun | claude-sonnet-4-6 | 194.239 | 5.845 | 20 | $0,670 |
| — | gpt-4.1-mini (conversa, mediana) | 15.966 | 136 | 0–2 | $0,007 |

**Turno canônico adotado nas contas: 320.269 input / 3.401 output** (o build completo e aprovado de 13/jul).

### 2.3 Uma prescrição inteira, ponta a ponta (13/jul, mesmo treinador, mesmo dia)

| | Turnos | Input somado | Output somado | Custo |
|---|---|---|---|---|
| Build (gemini-3.5-flash) | 2 | 343.325 | 3.546 | **$0,547** |
| Entrevista/conversa (gpt-4.1-mini) | 11 | 349.449 | 5.714 | $0,149 |
| **Total** | 13 | 692.774 | 9.260 | **~$0,70** |

### 2.4 Volume atual de produção [MEDIDO]

- **26 treinadores** (25 `free`, 1 `premium_ia` — o próprio dono).
- **8 assinaturas ativas**, todas no price **Essencial**.
- Créditos consumidos por superfície: workspace 264 · proactive 49 · mobile 19 · voice 2.
- COGS total registrado: **~US$ 4,61 para ~600 créditos**.
- Apenas **8 turnos de build em Gemini** no período inteiro.

> ⚠️ **A base é minúscula.** O risco de margem descrito abaixo é estrutural, não observado no extrato. Ele se materializa quando o produto crescer.

### 2.5 O estado do cache [MEDIDO, e é o achado mais importante]

`cached_input_tokens` é **NULL em 100% dos eventos** de `ai_usage_events`.

**Mas a causa não é a ausência de cache — é a ausência de medição:**

- `rg 'cache_control|cachedContent|promptCaching|anthropic-beta'` no repo inteiro → **zero ocorrências**.
- O metering (`command-engine.ts:1112-1113`) grava apenas `inputTokens` e `outputTokens` do `totalUsage`. A função `turnCostUsd` (`ai-usage/metering.ts:53`) **aceita** `cachedInputTokens`, mas **ninguém passa esse argumento**.

**Consequência para esta análise:** o custo registrado de **$0,511** assume `cached = 0`. Ele é um **teto**, não uma medição exata. Se o cache automático da OpenAI/Gemini estiver acertando parcialmente, o custo real é menor — **e ninguém sabe, porque não é medido.**

> **[INCERTEZA CENTRAL]** Todo o resto desta análise herda essa incerteza. A recomendação nº 1 (§8) existe justamente para eliminá-la.

---

## 3. Preços dos modelos [MEDIDO — verificado 2026-07-13 nas páginas oficiais]

US$ por 1M de tokens.

| Modelo | Input | Cached input | Output |
|---|---|---|---|
| gpt-4o-mini | 0,15 | 0,075 | 0,60 |
| gpt-4.1-mini *(conversa hoje)* | 0,40 | 0,10 | 1,60 |
| gemini-3-flash | 0,50 | 0,05 | 3,00 |
| gpt-5.4-mini | 0,75 | 0,075 | 4,50 |
| gpt-5.6-luna | 1,00 | 0,10 | 6,00 |
| **gemini-3.5-flash** *(build hoje)* | **1,50** | **0,15** | **9,00** |
| Claude Sonnet 5 | 2,00 | 0,20 | 10,00 *(promo até 31/ago; depois 3,00 / 15,00)* |
| gpt-5.6-terra | 2,50 | 0,25 | 15,00 |
| gpt-5.4 | 2,50 | 0,25 | 15,00 |
| **Claude Opus 4.8** | **5,00** | **0,50** | **25,00** |
| **GPT-5.5** | **5,00** | **0,50** | **30,00** |
| GPT-5.5-pro | 30,00 | — | 180,00 |

Notas:
- GPT-5.5 tem tier de **long-context acima de 272k tokens numa única janela**: $10 / $45. **Não se aplica aqui** — os 320k são a *soma* de ~10 passos de ~30k, não uma janela única. *(Revisor: confirme este raciocínio; é um ponto onde um erro mudaria tudo.)*
- Anthropic cobra **cache write a 1,25× o input** (Sonnet 5: $2,50/Mtok). É pago uma vez por prefixo, não por passo. Ignorado nas contas por ser de segunda ordem (~$0,02 por build); um revisor rigoroso deveria incluí-lo.
- Batch API (50% off) **não se aplica**: o build é síncrono e interativo.

---

## 4. Anatomia do input: de onde vêm os 320k tokens

### 4.1 Tool definitions — a maior linha [MEDIDO na fonte]

**As 62 tools são enviadas em TODO passo, em TODA superfície, inclusive num turno que só monta treino.**

Medição no código-fonte (`web/src/lib/mcp/tools/*.ts`):

| Componente | chars |
|---|---|
| `description` das 62 tools | 19.221 |
| Schemas zod (fonte) | 30.543 |
| **Total (fonte)** | **49.764** |
| nº de parâmetros zod | 280 (51 `z.enum`) |

Serializado como **JSON Schema** (o que de fato vai ao provider), com overhead de wrapper + objetos aninhados (`sessions[]`, `items[]`, `set_scheme[]`):

> **≈ 60.000–75.000 chars ≈ 15.000–19.000 tokens de tool defs POR PASSO.** [DERIVADO — ±25%]

Tools mais pesadas (chars de fonte):

| Tool | chars |
|---|---|
| `kinevo_create_student_draft_program` | 4.070 |
| `kinevo_create_program_template` | 3.737 |
| `kinevo_add_exercise_to_session` | 2.221 |
| `kinevo_update_workout_item` | 1.914 |
| `kinevo_create_superset` | 1.586 |
| `kinevo_list_exercises` | 1.566 |

> **Contradição com a doc interna:** um doc de 07/jul afirma "62 tools (~8k tokens por passo)". Esse número é herdado de uma medição de **jun/2026, quando eram 55 tools / 18.834 chars**. O catálogo **cresceu 2,6× em um mês** (18.834 → 49.764 chars). **O custo de input real é ~2× o que a doc vigente assume.**

### 4.2 O subsetting de tools existe e foi DESLIGADO hoje (13/jul)

O mecanismo está pronto e não é usado:

```ts
// tool-policy.ts:356
export function resolveToolSubset(intents: ToolIntent[]): McpToolName[] {
    if (intents.length === 0) return [...ALL_MCP_TOOLS]
    const set = new Set<McpToolName>(CORE_TOOLS)
    for (const intent of intents) for (const tool of TOOL_SUBSETS[intent]) set.add(tool)
    return ALL_MCP_TOOLS.filter((t) => set.has(t))
}

// mcp-bridge.ts:56 — o filtro só age se `intents` for passado…
const allowed = options.intents && options.intents.length > 0
    ? new Set<string>(resolveToolSubset(options.intents)) : null
```

…e o motor **parou de passar `intents`**, com esta justificativa:

```ts
// command-engine.ts:606-614 (comentário literal)
// 1. Sinais do turno. As intents NÃO cortam mais o catálogo de tools
//    (P5 — 13/jul): o subsetting por regex era a maior fonte de "o
//    assistente não conseguiu" silencioso (falso negativo amputava o
//    domínio inteiro) e, com o custo de input atual, o catálogo completo
//    é barato.
```

> **A premissa "o catálogo completo é barato" é falsa, e é o núcleo desta análise.** A 16k tokens × ~10 passos, o catálogo é ~160k tokens — **metade do custo do build**. Mas o *motivo* da remoção era real (falso negativo do regex amputava domínios silenciosamente), e qualquer proposta precisa endereçá-lo (§7).

Tamanho dos subsets (`tool-policy.ts:254,271`):

- `CORE_TOOLS`: 4 (`ping`, `list_students`, `get_student`, `get_dashboard_summary`)
- `prescricao`: 21 · `alunos`: 8 · `financeiro`: 9 · `agenda`: 6 · `forms`: 5 · `avaliacao`: 5 · `comunicacao`: 5 · `leads`: 3

Num build, `isBuildTurn` força `intents ⊇ {prescricao, alunos}` → subset = **core + prescricao + alunos ≈ 29 tools de 62**. Como as tools de prescrição são as mais pesadas, o corte em *tokens* é menor que o corte em *contagem*: **~16k → ~10k tokens/passo** [DERIVADO].

### 4.3 System prompt [MEDIDO na fonte]

Montagem (`command-engine.ts:727-735`):

```ts
const system =
    buildInstructions(surface) +                       // 2.385 chars (~600 tok)
    buildMcpHitlInstructions({ intents, buildTurn }) + // HITL_BUILD: 8.162 chars (~2.040 tok)
    '\n\n' +
    dynamicContext +                                   // 1.500–4.000 chars — MUDA A CADA TURNO
    routeHint + studentHint + programHint +            // ~800 chars
    styleBlock                                         // 0–1.500 chars (só em build)
```

**Total do system num turno de build: ~16.000–20.000 chars ≈ 4.000–5.000 tokens.**

> **Bug de cache suspeito [DERIVADO — precisa de verificação]:** `dynamicContext` contém data/hora e "dias desde o último treino" — **muda a cada turno** — e está posicionado **no meio do system**, antes dos hints e do styleBlock. Se o AI SDK serializa `system` antes das `tools`, um prefixo instável no meio pode **invalidar o cache de tudo que vem depois**. Isso explicaria por que o cache automático da OpenAI parecia acertar em abr/2026 (12.288 tokens cacheados observados numa geração) e hoje não há evidência disso. **Revisor: este é o ponto de maior alavancagem e o que tenho menos certeza. Conteste.**

### 4.4 Tool results acumulados

- **`kinevo_list_exercises`** é o maior: o prompt manda buscar todos os grupos numa chamada com `limit: 100`. Cada exercício serializa ~270 chars (id UUID, nome, equipamento, grupos musculares, `difficulty_level`, `movement_pattern`, `is_primary_movement`, `session_position`, `is_custom` — `mcp/tools/exercises.ts:177-192`). **100 exercícios ≈ 27.000 chars ≈ 6.800 tokens**, e ficam no contexto por todos os passos seguintes.
- **`kinevo_get_program`**: "4–6k tokens" (medição de prod citada em `llm-projection.ts:4-5`).
- Os **args do `create_*_program`** carregam o programa inteiro (~5k tokens) e ficam no histórico, reenviados em cada passo posterior.
- Existe uma projeção lossless (`projectMcpResultForLlm`) que remove `null`/`''`/`[]` dos resultados — **mas só nos READs**, não nos WRITEs.
- `MAX_HISTORY = 32` mensagens.

### 4.5 Decomposição estimada dos 320k [DERIVADO]

| Componente | Por passo | × ~10 passos | % |
|---|---|---|---|
| Tool defs (62) | ~16k | ~160k | **50%** |
| System (instruções + contexto) | ~4,5k | ~45k | 14% |
| Tool results + histórico acumulado | crescente | ~115k | 36% |
| **Total** | | **~320k** | 100% |

Bate com o medido (320.269). *(Revisor: o nº de passos é inferido — 320k / ~32k médio. O código tem teto de 16 e o fluxo canônico documentado é 4–6. Se o build real usa 10 passos, há um comportamento não intencional aí — vale investigar separadamente.)*

---

## 5. As contas

**Fórmula:** `custo = (input_novo × preço_in + input_cacheado × preço_cache + output × preço_out) ÷ 1e6`
**Câmbio [PREMISSA]:** R$ 5,50 / US$ 1,00.

### Cenário A — arquitetura de hoje (sem cache, 62 tools/passo)
Insumos: **320k input novo · 3,4k output.**

| Modelo | Conta | **$/build** |
|---|---|---|
| gpt-4.1-mini | 320k×0,40 + 3,4k×1,60 | $0,133 |
| gemini-3-flash | 320k×0,50 + 3,4k×3,00 | $0,170 |
| gpt-5.4-mini | 320k×0,75 + 3,4k×4,50 | $0,255 |
| gpt-5.6-luna | 320k×1,00 + 3,4k×6,00 | $0,340 |
| **gemini-3.5-flash (hoje)** | 320k×1,50 + 3,4k×9,00 | **$0,511** ✅ *bate com o medido ($0,511)* |
| Claude Sonnet 5 | 320k×2,00 + 3,4k×10,00 | $0,674 |
| gpt-5.6-terra | 320k×2,50 + 3,4k×15,00 | $0,851 |
| **Claude Opus 4.8** | 320k×5,00 + 3,4k×25,00 | **$1,685** |
| **GPT-5.5** | 320k×5,00 + 3,4k×30,00 | **$1,702** |

> **Validação:** o cenário A reproduz o custo real medido em produção com erro de 0,2%. O modelo de cálculo está correto.

### Cenário C — cache + prompt corrigido [DERIVADO bottom-up]

Reconstrução passo a passo do build corrigido (§7), 6 passos:

| Passo | Input |
|---|---|
| 1 — system (5k) + tools subset (10k) | 15k |
| 2 — + proposta | 15,5k |
| 3 — + `list_exercises` enxuto (3,5k) | 19,5k |
| 4 | 20k |
| 5 — + result compacto do create | 20,5k |
| 6 | 21k |
| **Soma** | **~111k** |

Prefixo estável cacheável (instruções 3,5k + tools 10k = 13,5k × 6 passos) ≈ **81k cacheado**; **~30k novo**; output 3,4k.

| Modelo | Conta | **$/build** | vs. hoje ($0,511) |
|---|---|---|---|
| gpt-4.1-mini | 30k×0,40 + 81k×0,10 + 3,4k×1,60 | $0,026 | 20× mais barato |
| gemini-3.5-flash | 30k×1,50 + 81k×0,15 + 3,4k×9,00 | $0,088 | 5,8× |
| **Claude Sonnet 5** | 30k×2,00 + 81k×0,20 + 3,4k×10,00 | **$0,110** | **4,6×** |
| gpt-5.6-terra | 30k×2,50 + 81k×0,25 + 3,4k×15,00 | $0,146 | 3,5× |
| **Claude Opus 4.8** | 30k×5,00 + 81k×0,50 + 3,4k×25,00 | **$0,276** | **1,9×** |
| **GPT-5.5** | 30k×5,00 + 81k×0,50 + 3,4k×30,00 | **$0,293** | **1,7×** |

> **Resultado central:** **GPT-5.5 com o prompt corrigido ($0,293) custa 1,7× MENOS que o Gemini 3.5 Flash na arquitetura de hoje ($0,511).**
>
> **⚠️ Autocorreção registrada:** uma versão anterior desta análise usou uma meta redonda de "65k de input" e chegou a **$0,193** para o GPT-5.5. A derivação bottom-up acima (que leva em conta que o subset de build ainda tem ~29 tools, e que as tools de prescrição são as mais pesadas do catálogo) dá **$0,293 — 52% mais caro**. A conclusão qualitativa sobrevive; a margem é menor. **Use o número desta tabela.**

**Efeito de segunda ordem:** depois de enxugar o input, **o output passa a dominar**. No GPT-5.5 pós-correção, os 3,4k de output a $30/M são $0,102 = **35% do custo**. É por isso que Opus 4.8 (output $25) fica melhor que GPT-5.5 (output $30) apesar do input idêntico, e Sonnet 5 (output $10) dispara na frente.

### Cenário B — só ligando o cache, sem tocar no prompt

320k input, dos quais 256k cacheados [PREMISSA: 80% de hit] + 64k novos, 3,4k output:

| Modelo | $/build |
|---|---|
| gemini-3.5-flash | $0,165 |
| Claude Sonnet 5 | $0,213 |
| Claude Opus 4.8 | $0,533 |
| GPT-5.5 | $0,550 |

> Só o cache já corta ~67% do custo atual **sem mexer em modelo, prompt ou qualidade**.

---

## 6. Margem: custo por crédito vs. receita por crédito

`custo/crédito = ($/build × 5,50) ÷ 6 créditos`

| Cenário | $/build | **R$/crédito** | Essencial (R$ 2,00) | Pro IA (R$ 0,27) | Premium IA (R$ 0,13) |
|---|---|---|---|---|---|
| **gemini-3.5-flash — HOJE** | $0,511 | **R$ 0,47** | +77% ✅ | **−74%** ❌ | **−262%** ❌ |
| GPT-5.5, arquitetura de hoje | $1,702 | R$ 1,56 | +22% 🟡 | −478% ❌ | −1100% ❌ |
| GPT-5.5, corrigido | $0,293 | R$ 0,27 | +87% ✅ | **±0%** 🟡 | −107% ❌ |
| Claude Opus 4.8, corrigido | $0,276 | R$ 0,25 | +87% ✅ | +6% 🟡 | −95% ❌ |
| **Claude Sonnet 5, corrigido** | $0,110 | **R$ 0,10** | +95% ✅ | **+63%** ✅ | **+22%** ✅ |
| gemini-3.5-flash, corrigido | $0,088 | R$ 0,08 | +96% ✅ | +70% ✅ | +38% ✅ |
| gpt-4.1-mini, corrigido | $0,026 | R$ 0,024 | +99% ✅ | +91% ✅ | +82% ✅ |

### Conclusões desta tabela

1. **O prejuízo já existe, hoje, com o modelo "barato".** Um assinante Pro IA que consumir a cota inteira montando treinos (50 builds) gera **R$ 79,90 de receita** e **R$ 140 de custo**. O Premium é pior. Não aparece no extrato porque a base ativa é de 8 assinantes, todos no Essencial, com 8 builds no mês.
2. **Corrigido o prompt, GPT-5.5/Opus 4.8 ficam viáveis no Essencial e no limite do Pro** — mas **não fecham o Premium IA**.
3. **Sonnet 5 corrigido fecha os três planos** e custa menos que o Gemini de hoje.
4. **O Premium IA está mal precificado**, independentemente do modelo: a R$ 0,13/crédito, só os modelos baratos fecham. Se o objetivo é GPT-5.5 no Premium, o caminho é **subir o peso do build de 6 para ~9-10 créditos** (recomendação que já constava de um doc interno de 07/jul e nunca foi executada).

---

## 7. O "prompt corrigido", concretamente

Quatro mudanças. Nenhuma envolve trocar de modelo.

### 7.1 Catálogo de tools em dois níveis — com escape hatch
O mecanismo já existe (`resolveToolSubset`, `mcp-bridge.ts:56`); só voltar a passar `intents`. Num build: `core + prescricao + alunos` = ~29 tools ≈ 10k tok (de 16k).

**Mas isso reintroduziria o bug que motivou a remoção** ("falso negativo do regex amputava o domínio inteiro" → o assistente falhava em silêncio). Proposta que preserva a correção:

- O subset entra como **otimização, não como restrição**.
- Adicionar uma tool `expandir_ferramentas(dominio)` que recarrega o catálogo completo sob demanda.
- Assim, o custo de um falso negativo do regex deixa de ser *"o assistente não conseguiu"* e passa a ser *"um passo a mais no loop"*.
- `isBuildTurn` já é deliberadamente generoso e o subset é aditivo → falso positivo é inofensivo.

### 7.2 Enxugar o retorno do `list_exercises`
6.800 → ~3.500 tokens, cortando campos que raramente mudam a escolha do modelo (`difficulty_level`, `is_custom`, `session_position`). Ganho multiplicado por ficar no contexto em todos os passos seguintes.

### 7.3 Compactar o eco do `create_*_program`
Estender `projectMcpResultForLlm` (hoje só nos READs) aos WRITEs. Os args carregam o programa inteiro (~5k tok) e são reenviados em cada passo posterior.

### 7.4 Reordenar o system para o cache acertar
Hoje: `instruções + HITL + dynamicContext + hints + styleBlock`. O `dynamicContext` **muda a cada turno** e está **no meio**. Mover o conteúdo volátil para **depois** de todo o prefixo estável (ou para a primeira mensagem `user`), garantindo um prefixo byte-a-byte idêntico entre passos.

---

## 8. Recomendação

Em ordem estrita. Não inverter.

1. **Medir o cache.** Ler `cachedInputTokens` do `providerMetadata` e gravar no metering (`command-engine.ts:1112`). É uma linha. Hoje não se sabe se um build custa $0,51 ou $0,25 — e essa é a variável que domina o custo. **Nenhuma decisão de modelo deveria ser tomada antes disso.**
2. **Fazer o cache acertar** (§7.4 + `cache_control` na Anthropic / contexto explícito no Gemini). Corta ~67% do custo sem tocar em modelo nem qualidade.
3. **Devolver o subsetting com escape hatch** (§7.1). Maior linha isolada do custo.
4. **Só então trocar o modelo — e só no turno de build.** Sugestão: **Sonnet 5 como default de build** (fecha os três planos, custa menos que o Gemini de hoje, lidera tool-calling — que é literalmente o trabalho do build). **GPT-5.5 / Opus 4.8 como tier premium** atrás do gate de plano, se um head-to-head mostrar prescrição melhor.
5. **Manter `gpt-4.1-mini` na conversa.** $0,007/turno. Não há dinheiro nem qualidade a ganhar ali.
6. **Repreçar o Premium IA** ou subir o peso do build de 6 → 9-10 créditos.

---

## 9. Onde eu posso estar errado — conteste isto

Revisor: estes são os pontos frágeis, em ordem de impacto.

1. **A premissa de 80% de cache hit (cenários B e C) é inventada.** Não há medição. Se o hit real for 50%, o GPT-5.5 corrigido sai de $0,293 para ~$0,38 — e a margem do Pro IA vira negativa. **Toda a recomendação de modelo de ponta depende desta premissa.** É por isso que "medir o cache" é o passo 1.
2. **O nº de passos (~10) é inferido**, não observado (320k ÷ ~32k). O código tem teto de 16 e o fluxo canônico documentado é 4–6 passos. Se o build real gasta 10 passos, pode haver um loop patológico não intencional — o que seria uma *quinta* correção, possivelmente a mais barata de todas. **Alguém deveria instrumentar `steps` por turno antes de qualquer outra coisa.**
3. **A serialização das tool defs (15–19k tok) é derivada de 49.764 chars de fonte zod × overhead JSON Schema estimado.** Não medi o payload real enviado ao provider. Erro de ±25% aqui move o cenário C proporcionalmente. **Isto é trivial de medir de verdade** (logar o request body) e ninguém mediu.
4. **Amostra de 8 builds em Gemini.** Os $0,511 vêm de um build real e são consistentes com outros três, mas não é uma distribuição. Builds com mais alunos/exercícios podem ser 2–3× maiores.
5. **Ignorei o custo dos retries.** A cadeia é `[gemini, gemini, gpt-4.1-mini]` e o Gemini vaza thinking em ~1/4 dos builds. O custo esperado real é ~**1,25× o número da tabela**. Isso piora todas as linhas uniformemente, mas piora *mais* os modelos caros. Um modelo de ponta que errasse menos e precisasse de menos retry poderia se pagar só nisso — **não modelei esse efeito, e ele joga a favor do modelo de ponta**.
6. **Ignorei o cache write da Anthropic** (1,25× input, uma vez por prefixo). Penaliza levemente Sonnet 5 e Opus 4.8 (~$0,02/build).
7. **Não medi qualidade.** Toda esta análise responde "quanto custa", nunca "prescreve melhor". A hipótese de que GPT-5.5/Opus prescrevem melhor que o Gemini Flash é **plausível e não testada**. Existe um harness de evals no repo (`lib/assistant/evals/`, com um juiz em `gpt-4.1-mini`) que poderia resolver isso e não foi usado. **Se a qualidade não melhorar, todo o exercício é acadêmico — o certo seria enxugar o prompt e ficar no modelo barato.**
8. **Confirme o tier de long-context do GPT-5.5** ($10/$45 acima de 272k numa única janela). Afirmei que não se aplica porque os 320k são a soma de ~10 passos de ~30k, e nenhuma janela isolada passa de 272k. Se eu estiver errado, o cenário A do GPT-5.5 dobra.
9. **Câmbio R$ 5,50** e a contagem de "20 prescrições/treinador/mês" (usada só na versão HTML) são premissas de modelagem, não dados.

---

## 10. Anexo — consultas SQL usadas

```sql
-- Agregado por modelo
select kind, model, count(*) n,
  round(avg(input_tokens)) avg_in,
  round(percentile_cont(0.5) within group (order by input_tokens)) p50_in,
  max(input_tokens) max_in,
  round(avg(output_tokens)) avg_out,
  round(avg(cost_usd_micros)) avg_cost_micros
from assistant_turn_traces
where input_tokens is not null
group by 1,2 order by n desc;

-- Turnos individuais de build
select id, created_at::date d, model, input_tokens, output_tokens, cost_usd_micros,
  jsonb_array_length(coalesce(tools,'[]'::jsonb)) n_tools
from assistant_turn_traces
where model in ('gemini-3.5-flash','claude-sonnet-4-6') and input_tokens is not null
order by created_at desc;

-- Uso por classe de ação (mostra cached_input_tokens sempre NULL)
select action_class, model, surface, count(*) n,
  round(avg(input_tokens)) avg_in,
  round(avg(cached_input_tokens)) avg_cached,
  round(avg(output_tokens)) avg_out,
  sum(cost_usd_micros) total_micros
from ai_usage_events group by 1,2,3 order by n desc;
```

**Arquivos-chave do repo:** `web/src/lib/assistant/command-engine.ts` · `build-signals.ts` · `mcp-bridge.ts` · `tool-policy.ts` · `llm-projection.ts` · `web/src/lib/ai-usage/metering.ts` · `web/src/lib/billing/tiers.ts` · `web/src/lib/mcp/tools/*.ts` · `web/src/lib/prescription/llm-client.ts`

**Docs internos relacionados:** `docs/analise-mcp-assistente-custos.md` (15/jun — desatualizado: assume 55 tools e build em `gpt-4.1-mini`) · `docs/analise-assistente-lancamento-2026-07-07.md` (assume 8k tok de tool defs — é ~2× isso).
