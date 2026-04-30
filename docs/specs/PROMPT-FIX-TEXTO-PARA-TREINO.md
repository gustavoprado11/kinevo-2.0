# Spec — Fix "Texto para Treino": split, matching e overwrite no mobile

> **Audience:** Claude Code rodando no monorepo `kinevo-monorepo`.
> **Pré-leitura obrigatória:** `web/CLAUDE.md`, `mobile/CLAUDE.md`, `docs/specs/03-fase-2-unificar-texto-para-treino.md`.
> **Não questione decisões aqui documentadas. Faça os passos na ordem.**

---

## 1. Contexto e sintomas reportados

A funcionalidade "Texto para Treino" / "Prescrição por Texto" (cole texto livre → IA estrutura em treinos) está com três bugs em produção:

1. **Timeout em prescrições reais.** Treinadores colam o programa completo (5 treinos × ~6 exercícios) e recebem:
   - **Web:** "Erro ao processar — Erro desconhecido".
   - **Mobile:** "Erro ao processar — A IA está demorando demais. Tente novamente ou divida o treino em blocos menores."
2. **Mobile sobrescreve o que já tinha sido prescrito.** Seguir a sugestão do erro ("divida em blocos") é ruim porque, ao colar o segundo bloco, o primeiro treino que já tinha sido prescrito é apagado.
3. **Matching falha em variações regionais.** Texto como `Banco flexor 3x10` ou `Banco extensor unilateral 3x8` é deixado como `unmatched`, mesmo o catálogo tendo "Cadeira Flexora" e "Cadeira Extensora".

Texto de teste de referência (entrada real de um treinador):

```
Superior A - segunda
Supino inclinado halter 3x8
Puxada Aberta pegada neutra 3x8
Supino articulado 3x8
Remada aberta articulada 3x10
Rosca direta banco inclinado 3x10-8
Tríceps francês polia 3x10

Inferior A - terça
Leg press horizontal 3x8 120kg
Mesa flexora 3x8 90kg
Banco extensor unilateral 3x8 90kg
Banco flexor 3x10 90kg
Búlgaro 3x8 40kg

Superior B - quarta
Supino reto Barra 3x6 80kg
Puxada aberta pegada neutra 3x8 80kg
Supino inclinado articulado 3x8
Remada neutra máquina 3x8
Rosca Scott máquina 3x8
Tríceps polia corda 3x10

Inferior B - quinta
Leg press 45 3x8
Stiff barra 3x8
Banco extensor unilateral 3x8
Banco flexor 3x12
Panturrilha em pé 3x12

Superior C - sexta
Supino inclinado halter 3x8
Puxada neutra 3x8
Crucifixo máquina 3x8
Remada aberta articulada 3x10
Rosca direta banco inclinado 3x10-8
Tríceps francês polia 3x10
```

---

## 2. Diagnóstico (causas-raiz, já confirmadas)

### 2.1. Splitter não reconhece os cabeçalhos do treinador → 1 chamada LLM gigante

`splitWorkoutBlocks()` aceita apenas linhas que casam com `^\s*(?:treino|dia|workout|day)\b`. O treinador escreve `Superior A - segunda`, `Inferior A - terça`, ... — **nada disso** casa, então toda a prescrição vira **1 bloco** e é mandada numa única chamada com 30+ exercícios e 5 treinos. Isso estoura o `LLM_TIMEOUT_MS = 26_000` (web) / `28000ms` (edge) e o `maxDuration = 30` da rota web. A rota web é morta pelo Vercel antes de formatar o JSON de erro → o cliente cai no fallback genérico "Erro desconhecido".

Reprodução (executada): rodar `splitWorkoutBlocks(textoAcima)` retorna **um único bloco de 846 chars com 37 linhas**. O esperado é 5 blocos.

Locais:
- `web/src/app/api/prescription/parse-text/route.ts` linhas 32–62 (função `splitWorkoutBlocks`).
- `supabase/functions/parse-workout-text/index.ts` linhas 240–264 (função idêntica, duplicada).

### 2.2. Pre-filter de catálogo elimina exercícios por mismatch de gênero/derivação

`filterCatalogByText()` só conta como match quando dois tokens são **idênticos após normalização**. Texto do treinador tem `flexor` (masculino, abreviado), e o catálogo tem `Cadeira Flexora` (feminino). `flexor !== flexora` → score 0 → `Cadeira Flexora` fica fora do prompt da LLM quando o número de candidatos com pelo menos 1 hit é ≥ 20.

Reprodução (executada) com bloco isolado `Inferior B`:

```
Keywords: ['inferior','quinta','leg','press','3x8','stiff','banco','extensor','unilateral','flexor','3x12','panturrilha']
Scores:
  2  Leg Press 45
  1  Stiff Barra Livre
  1  Panturrilha em Pé no Smith
  0  Cadeira Flexora           ← deveria ser candidato
  0  Cadeira Extensora         ← deveria ser candidato
  0  Mesa Flexora
  0  Mesa Extensora
```

Mesmo problema: `extensor` ≠ `extensora`. Além disso, "banco" (gíria regional para "cadeira"/"mesa") **nunca** vai casar com "Cadeira Flexora" via token-match, mesmo que a LLM saiba.

Locais:
- `web/src/app/api/prescription/parse-text/route.ts` linhas 354–410.
- `supabase/functions/parse-workout-text/index.ts` linhas 382–427.

### 2.3. SYSTEM_PROMPT não cobre slang regional

O prompt já lista `flexora → Cadeira Flexora`, mas não tem exemplos para `banco flexor`, `banco extensor`, `cadeira flexor` etc. Mesmo se o pre-filter passar a deixar os candidatos no prompt (correção 2.2), a LLM precisa de uma dica explícita de que "banco {flexor,extensor}" é equivalente a "cadeira {flexora,extensora}" para acertar com confiança.

### 2.4. Mobile sobrescreve o draft inteiro a cada prescrição por texto

`handleParsedText` em `mobile/app/program-builder/index.tsx` (linhas 235–279) chama `useProgramBuilderStore.getState().initFromParsedText(...)` toda vez. Em `mobile/stores/program-builder-store.ts` linhas 413–552, a implementação **constrói um `ProgramDraft` novo do zero** (workouts, name, description, originalIds, etc.) e faz `set({ draft, currentWorkoutId, isDirty: true, ... })`. Qualquer treino/exercício que já estava no draft vira lixo.

Web não tem esse problema porque `AiPrescribePanel` chama `onAddExerciseToWorkout` (additivo) e `onCreateWorkout` (cria sem apagar) — `web/src/components/programs/program-builder-client.tsx` linhas 778–828.

---

## 3. Escopo da spec

**Em escopo:**
- Splitter reconhecer cabeçalhos comuns que treinadores brasileiros usam.
- Pre-filter tolerar gênero e derivações curtas (flexor/flexora, extensor/extensora, etc.).
- SYSTEM_PROMPT ganhar exemplos de slang ("banco flexor" → "Cadeira Flexora").
- Mobile parar de apagar prescrições anteriores quando uma nova é colada.

**Fora de escopo:**
- Mudar pricing/tokens, modelo padrão ou fallback de modelo.
- Refatorar para extrair lógica duplicada entre `web/.../parse-text/route.ts` e `supabase/functions/parse-workout-text/index.ts` (vamos manter as duas paridades, só não vamos consolidar agora).
- Mudar shape de `ParseTextResponse`, `ParsedExercise`, `ParsedWorkout`.
- Criar telemetria/observabilidade nova.

---

## 4. Mudanças de código (na ordem)

### 4.1. Splitter — reconhecer cabeçalhos brasileiros

Em **ambos** os arquivos:
- `web/src/app/api/prescription/parse-text/route.ts` (função `splitWorkoutBlocks`, linhas 32–62)
- `supabase/functions/parse-workout-text/index.ts` (função `splitWorkoutBlocks`, linhas 240–264)

Substituir o regex de heading por um conjunto que cobre os padrões reais. Concretamente, uma linha conta como heading de treino quando, **após trim**, ela tem ≤ 80 chars **e** casa qualquer um destes padrões (case-insensitive, sem acentos via normalize):

1. Começa com palavra-chave estrutural: `treino`, `dia`, `workout`, `day`, `sessao`, `session`.
2. Começa com palavra-chave de divisão: `superior`, `inferior`, `push`, `pull`, `legs`, `pernas`, `peito`, `costas`, `ombro`, `ombros`, `braco`, `bracos`, `braço`, `braços`, `full`, `upper`, `lower`, `posterior`, `anterior`, `ab`, `abdomen`, `abdômen`.
3. Letra única ou rótulo curto seguido de `-`/`–`/`—`/`:` e dia da semana ou descrição. Ex: `A - segunda`, `B – terça`, `C: quarta`.
4. Heuristic fallback: linha curta (≤ 40 chars) que não contém dígitos `\d+x\d+` (ou seja, não é um exercício com `3x10`) **e** é seguida por uma linha em branco antes ou logo seguida de uma linha que contém `\d+x\d+`. (Isto pega títulos como "Empurrar - segunda" sem palavra-chave conhecida.)

Implementação sugerida (manter idêntica entre web e edge — copiar/colar):

```ts
// Palavras-chave que indicam início de bloco de treino. Sem acentos.
const HEADING_KEYWORDS = [
    'treino', 'dia', 'workout', 'day', 'sessao', 'session',
    'superior', 'inferior', 'push', 'pull', 'legs', 'pernas',
    'peito', 'costas', 'ombro', 'ombros', 'braco', 'bracos',
    'full', 'upper', 'lower', 'posterior', 'anterior',
    'ab', 'abs', 'abdomen', 'core',
];

function normalizeHeading(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function isWorkoutHeading(line: string, nextNonEmpty: string | null): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 80) return false;

    // Se já é um exercício (tem padrão NxM ou "3 x 10"), não é heading.
    if (/\d+\s*[x×]\s*\d+/i.test(trimmed)) return false;

    const norm = normalizeHeading(trimmed);

    // (1) e (2): começa com palavra-chave conhecida.
    for (const kw of HEADING_KEYWORDS) {
        const re = new RegExp(`^${kw}\\b`);
        if (re.test(norm)) return true;
    }

    // (3): rótulo curto "A - segunda", "B: terça", "C – qualquer coisa".
    if (/^[a-z0-9]{1,4}\s*[-–—:]/.test(norm)) return true;

    // (4) heuristic fallback: linha curta sem números de série, seguida (em
    // até 1 linha em branco) por uma linha de exercício "Nome ... NxM".
    if (trimmed.length <= 40 && nextNonEmpty && /\d+\s*[x×]\s*\d+/i.test(nextNonEmpty)) {
        // Aceita só se a linha "parece" um título: começa com letra maiúscula
        // ou tem ≤ 4 palavras.
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
        if (wordCount <= 5) return true;
    }

    return false;
}

function splitWorkoutBlocks(text: string): string[] {
    const lines = text.split('\n');
    const blocks: string[] = [];
    let current: string[] = [];

    // Pré-computa próxima linha não vazia para a heurística (4).
    const nextNonEmpty: (string | null)[] = new Array(lines.length).fill(null);
    let pending: string | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
        nextNonEmpty[i] = pending;
        if (lines[i].trim()) pending = lines[i].trim();
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isWorkoutHeading(line, nextNonEmpty[i])) {
            if (current.length > 0) {
                const b = current.join('\n').trim();
                if (b) blocks.push(b);
            }
            current = [line];
        } else {
            current.push(line);
        }
    }
    if (current.length > 0) {
        const b = current.join('\n').trim();
        if (b) blocks.push(b);
    }

    if (blocks.length === 0) return [text];
    return blocks;
}
```

> **Critério de aceite (4.1):** rodando `splitWorkoutBlocks` no texto da seção 1 deste documento, o retorno tem **5 blocos** ("Superior A", "Inferior A", "Superior B", "Inferior B", "Superior C"), cada um começando pela linha de heading correspondente.

### 4.2. Pre-filter — tolerar derivação masculina/feminina e prefixos curtos

Em **ambos** os arquivos (mesmas regiões da seção 4.1, função `filterCatalogByText` e helpers).

Mudanças:

1. **Stem leve para palavras de exercício recorrentes.** Em `extractKeywords` e ao tokenizar o nome do exercício no scoring, aplicar `stemPtBr(token)` que normaliza:
   - Sufixos `a`/`o`/`as`/`os` finais quando o radical resultante tem ≥ 4 chars (ex: `flexora` → `flexor`, `extensora` → `extensor`, `flexão` → `flexao` → `flexa`, `crucifixo` → `crucifix`).
   - Sufixo `s` final genérico (plural).
   - **Não** mexer em palavras com ≤ 4 letras (`leg`, `mesa` → não estema).
2. **Aliases regionais ↔ catálogo.** Antes do scoring, expandir o keyword set do texto do treinador com sinônimos:
   - `banco` → adicionar `cadeira`, `mesa` (cobre "banco flexor" → "Cadeira/Mesa Flexora").
   - `pulldown` → `puxada`.
   - `hip` (com `thrust`) → `elevacao` + `quadril`.
   - `agacho` / `agache` → `agachamento`.
3. **Match parcial do prefixo.** No scoring, considerar match também quando o token do nome do exercício é prefixo do token do texto do treinador (ou vice-versa) com pelo menos 4 chars compartilhadas. Isso pega `extensor`/`extensora`, `flexor`/`flexora`, `agachamento`/`agacho`.

Implementação:

```ts
// Stems comuns no português de academia. Roda DEPOIS da normalização
// (sem acentos, lowercase). Mantém token original quando não há regra clara.
function stemPtBr(token: string): string {
    if (token.length <= 4) return token;
    // -ora/-oras/-ores -> -or  (flexora -> flexor, extensoras -> extensor)
    if (/(or)(a|as|es)$/.test(token)) return token.replace(/(or)(a|as|es)$/, '$1');
    // -as/-os/-a/-o no fim com radical >= 4 chars.
    if (/(.{4,})(as|os|a|o)$/.test(token)) {
        return token.replace(/(.{4,})(as|os|a|o)$/, '$1');
    }
    if (/s$/.test(token) && token.length > 4) return token.slice(0, -1);
    return token;
}

// Aliases bidirecionais. Quando o keyword aparece no texto, adicionamos os
// "expandidos" também — assim o scoring pega exercícios cujo nome tem o sinônimo.
const KEYWORD_ALIASES: Record<string, string[]> = {
    banco: ['cadeira', 'mesa'],
    pulldown: ['puxada'],
    hip: ['elevacao', 'quadril'],
    agacho: ['agachamento'],
    agache: ['agachamento'],
    bulgaro: ['agachamento', 'bulgaro'],
    legpress: ['leg', 'press'],
};

function extractKeywords(text: string): Set<string> {
    const tokens = normalize(text).match(/[a-z0-9]+/g) || [];
    const keywords = new Set<string>();
    for (const tok of tokens) {
        if (tok.length < 3 || STOP_WORDS.has(tok) || /^\d+$/.test(tok)) continue;
        const stem = stemPtBr(tok);
        keywords.add(stem);
        // Adiciona aliases (com stem, para combinar com tokens do nome do ex.)
        const aliases = KEYWORD_ALIASES[stem] ?? KEYWORD_ALIASES[tok];
        if (aliases) for (const a of aliases) keywords.add(stemPtBr(a));
    }
    return keywords;
}

function filterCatalogByText<T extends { id: string; name: string }>(
    text: string,
    catalog: T[],
): T[] {
    const keywords = extractKeywords(text);
    if (keywords.size === 0) return catalog;

    const scored: Array<{ ex: T; score: number }> = [];
    for (const ex of catalog) {
        const nameTokens = (normalize(ex.name).match(/[a-z0-9]+/g) || [])
            .filter(t => t.length >= 3)
            .map(stemPtBr);
        let score = 0;
        for (const tok of nameTokens) {
            if (keywords.has(tok)) score += 2;          // match exato (após stem)
            else {
                // match por prefixo (>= 4 chars compartilhadas)
                for (const kw of keywords) {
                    if (kw.length >= 4 && tok.length >= 4 &&
                        (kw.startsWith(tok) || tok.startsWith(kw))) {
                        score += 1;
                        break;
                    }
                }
            }
        }
        if (score > 0) scored.push({ ex, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const filtered = scored.map(s => s.ex);
    if (filtered.length < 20) return catalog;
    return filtered.slice(0, 150);
}
```

> **Critério de aceite (4.2):** com o bloco "Inferior B" da seção 1, `filterCatalogByText` agora deixa **`Cadeira Flexora`** e **`Cadeira Extensora`** entre os 150 candidatos top-scored, mesmo que o catálogo total seja > 400 exercícios. Reproduzir com o snippet de teste deste documento (seção 6).

### 4.3. SYSTEM_PROMPT — adicionar slang regional

Em **ambos** os arquivos:
- `web/src/app/api/prescription/parse-text/route.ts` constante `SYSTEM_PROMPT` (linhas 64–208).
- `supabase/functions/parse-workout-text/index.ts` constante `SYSTEM_PROMPT` (linhas 24–214).

No bloco "Exemplos de matching esperado", **somar** estas linhas (não remover as existentes):

```
- "banco flexor" / "banco flexora" → "Cadeira Flexora"
- "banco extensor" / "banco extensora" → "Cadeira Extensora"
- "cadeira flexor" → "Cadeira Flexora"
- "cadeira extensor" → "Cadeira Extensora"
- "mesa flexor" → "Mesa Flexora"
- "mesa extensor" → "Mesa Extensora"
- "supino articulado" → "Supino Reto Articulado" (ou variante mais próxima do catálogo)
- "rosca direta banco inclinado" → "Rosca Direta com Halteres no Banco Inclinado"
- "tríceps francês polia" → "Tríceps Francês na Polia"
- "panturrilha em pé" → "Panturrilha em Pé no Smith" (ou similar)
- "puxada neutra" → "Puxada Pegada Neutra"
- "remada aberta articulada" → "Remada Articulada Pegada Aberta"
```

E adicionar uma linha-regra logo abaixo dos exemplos:

```
- Em academias brasileiras, "banco" + flexor/extensor é gíria regional para os
  aparelhos guiados de bíceps femoral / quadríceps. Trate "banco flexor",
  "banco extensor", "cadeira flexor", "mesa flexor" e variações como sinônimos
  do exercício do catálogo correspondente.
```

> **Critério de aceite (4.3):** o prompt fica idêntico entre web e edge (mesmas linhas, mesma ordem). Verificar com `diff` lado a lado.

### 4.4. Mobile — `addParsedWorkoutsToDraft` em vez de overwrite

Em `mobile/stores/program-builder-store.ts`:

1. **Adicionar** novo método na interface (junto com os outros init/add):
   ```ts
   /**
    * Mescla treinos parseados (de "Texto para Treino") no draft atual.
    * Se o draft está vazio ou pertence a outro studentId, delega para
    * `initFromParsedText` (comportamento legado). Caso contrário, faz
    * append: cada workout parseado vira um novo workout no fim da lista,
    * preservando todos os existentes. Se o nome bater com um existente
    * (case-insensitive), os exercícios entram NO existente em vez de criar
    * duplicata.
    */
   addParsedWorkoutsToDraft: (
       studentId: string,
       parsedWorkouts: ParsedWorkoutForBuilder[],
   ) => void;
   ```

2. **Implementar** o método. Reutilizar 100% da lógica de "construir items a partir de parsedWorkouts.exercises" que já existe em `initFromParsedText` (lines 423–510). Diferença é que, em vez de montar um `ProgramDraft` zerado e dar `set({ draft })`, deve atualizar o draft existente:
   - Para cada `parsedWorkout`:
     - Procurar workout existente com nome igual (case-insensitive, accent-insensitive).
     - Se encontrar: append items no final, ajustando `order_index` para `existingItems.length + i`.
     - Se não encontrar: criar novo workout (UUID, `order_index = workouts.length`, `frequency: []`) e empurrar no array.
   - **Não** mexer em `name`, `description`, `duration_weeks`, `studentId`, `originatedFromAi`, `editingAssignedProgramId`, `originalWorkoutIds`, `originalItemIds`. **Marcar `isDirty: true`.**
   - **Trocar `currentWorkoutId`** para o primeiro workout afetado (novo ou existente que recebeu items), pra dar feedback visual ao treinador de onde a prescrição caiu.
   - Se `state.draft.studentId !== studentId` ou `state.draft.workouts` está vazio (nenhum item em nenhum workout), delegar para `initFromParsedText(studentId, parsedWorkouts)` e retornar — esse é o caso "primeira prescrição na sessão", e o comportamento legado (criar draft do zero) é o correto.

3. **Não mexer** em `initFromParsedText`. Outras telas (ex: novo programa partindo do zero) podem depender dela.

4. Em `mobile/app/program-builder/index.tsx`, na função `handleParsedText` (linhas 235–279), trocar:
   ```ts
   useProgramBuilderStore.getState().initFromParsedText(params.studentId, workoutsForBuilder);
   ```
   por:
   ```ts
   useProgramBuilderStore.getState().addParsedWorkoutsToDraft(params.studentId, workoutsForBuilder);
   ```

> **Critério de aceite (4.4):**
> - Cenário 1 (estado vazio): abrir o builder novo, prescrever via texto "Treino A: supino 3x10" → resultado idêntico ao atual (1 workout, 1 exercício, draft com `studentId` correto).
> - Cenário 2 (draft com 1 treino prescrito): com Treino A já no canvas com 6 exercícios, prescrever via texto "Treino B: leg press 3x10" → fica 2 workouts (A original intacto + B novo). `currentWorkoutId` aponta pro B.
> - Cenário 3 (mesmo nome): com Treino A com 3 exercícios, prescrever "Treino A: agachamento 3x10" → ainda 1 workout, mas com 4 exercícios (3 antigos + agachamento no fim).
> - Cenário 4 (trocou de aluno): prescrever para aluno X, depois abrir builder pra aluno Y e prescrever — não vaza o draft de X pra Y.

---

## 5. Testes

### 5.1. Web (`web/`)

Criar/atualizar:

- `web/src/app/api/prescription/parse-text/__tests__/split.test.ts` (criar arquivo se não existir):
  - Caso 1: texto com 5 cabeçalhos "Superior A - segunda", "Inferior A - terça"... → 5 blocos, cada bloco começa com sua linha de heading e contém apenas suas próprias linhas de exercício.
  - Caso 2: texto com cabeçalhos "Treino A", "Treino B" (legado) → ainda funciona, retorna 2 blocos.
  - Caso 3: texto sem cabeçalho conhecido ("Push 1", "Pull 1", "Legs 1") → 3 blocos.
  - Caso 4: texto sem heading nenhum ("supino 3x10\nremada 3x10") → 1 bloco igual ao input.

- `web/src/app/api/prescription/parse-text/__tests__/filter.test.ts` (criar):
  - Bloco "Inferior B" do exemplo da seção 1 + catálogo seedado com 30 exercícios incluindo "Cadeira Flexora", "Cadeira Extensora", "Mesa Flexora", "Mesa Extensora", "Leg Press 45", "Stiff Barra Livre", "Panturrilha em Pé no Smith" e 23 distratores → o resultado de `filterCatalogByText` **inclui** "Cadeira Flexora" e "Cadeira Extensora" (entre os 150 top).
  - Texto "pulldown 3x10" + catálogo com "Puxada Aberta Barra reta" → Puxada Aberta entra como candidato.
  - Texto "agacho búlgaro" + catálogo com "Agachamento Búlgaro" → Agachamento Búlgaro entra com score > 0.

- `web/src/components/programs/__tests__/ai-prescribe-panel.test.tsx`: adicionar caso de regressão "duas prescrições seguidas não duplicam workout existente" (se ainda não tiver).

### 5.2. Edge function (`supabase/functions/parse-workout-text/`)

A função roda em Deno. Ela não tem suite Vitest do monorepo. Adicionar um teste rodável via `deno test`:

- Criar `supabase/functions/parse-workout-text/index_test.ts` (Deno):
  - Importar `splitWorkoutBlocks`, `filterCatalogByText`, `extractKeywords`, `stemPtBr` do `index.ts`. Como a função hoje não exporta nada (o arquivo é `Deno.serve(...)`), refatorar **somente** para `export` essas funções puras (não tocar no `Deno.serve`). Deixar comentário no topo dizendo que esses exports são usados por testes.
  - Replicar os 4 casos de `split.test.ts` e os 3 de `filter.test.ts`.

### 5.3. Mobile

Em `mobile/stores/__tests__/` (se já existir; criar se não), adicionar:
- `program-builder-store.parsed-text.test.ts`:
  - Cenários 1–4 da seção 4.4 acima, usando `useProgramBuilderStore.getState()` direto.

Se o mobile não tem ambiente de teste configurado para esse store, **não criar suite nova** — apenas validar manualmente os 4 cenários no simulador e documentar o resultado num comentário no PR. (Não bloquear merge nesse caso.)

---

## 6. Reprodução (referência)

Para o reviewer / quem testar manualmente, salvar o snippet abaixo em `/tmp/repro.js` e rodar `node /tmp/repro.js`. **Antes** das mudanças, retorna 1 bloco; **depois**, retorna 5.

```js
const text = `Superior A - segunda
Supino inclinado halter 3x8
Puxada Aberta pegada neutra 3x8

Inferior A - terça
Leg press horizontal 3x8 120kg
Mesa flexora 3x8 90kg

Superior B - quarta
Supino reto Barra 3x6 80kg

Inferior B - quinta
Leg press 45 3x8
Banco flexor 3x12

Superior C - sexta
Supino inclinado halter 3x8`;

// Cole aqui a função splitWorkoutBlocks atualizada e rode.
console.log(splitWorkoutBlocks(text).length); // antes: 1, depois: 5
```

---

## 7. Checklist de execução

Em ordem. Não pular.

- [ ] **4.1** `splitWorkoutBlocks` atualizado em `web/.../parse-text/route.ts` e `supabase/functions/parse-workout-text/index.ts` com o mesmo código.
- [ ] **4.2** `filterCatalogByText`, `extractKeywords`, `stemPtBr`, `KEYWORD_ALIASES` adicionados nos dois lugares.
- [ ] **4.3** SYSTEM_PROMPT recebe os exemplos de slang regional nos dois lugares; `diff` confirma paridade.
- [ ] **4.4** `addParsedWorkoutsToDraft` adicionado em `mobile/stores/program-builder-store.ts`, e `handleParsedText` em `mobile/app/program-builder/index.tsx` chama o novo método. `initFromParsedText` segue intacto.
- [ ] **5.1** Testes web criados/atualizados; `npm test --workspace=web` (ou comando equivalente) verde.
- [ ] **5.2** Função edge expõe puras + `deno test` verde.
- [ ] **5.3** Cenários mobile validados (manualmente ou via teste).
- [ ] `tsc --noEmit` verde no `web` e no `mobile`.
- [ ] Verificação manual no simulador: colar o texto da seção 1 no app mobile com um aluno; receber **5 treinos** estruturados, com `Banco flexor` virando `Cadeira Flexora`. Salvar como template e abrir em outro device para confirmar persistência.
- [ ] Verificação manual no web: mesmo cole/teste, no construtor `/programs/new` ou `/students/[id]/programs/new`. Confirmar 5 treinos, exercícios matched.

---

## 8. Riscos e mitigação

- **Falsos positivos no splitter (4.1).** A heurística (4) pode tratar uma linha de "nota livre" como heading e quebrar o bloco no meio. Mitigação: a heurística só dispara se a linha tem ≤ 5 palavras e a próxima linha não-vazia tem padrão `\d+x\d+` (i.e. é claramente um exercício). Se mesmo assim houver falso positivo, o pior caso é uma chamada extra ao LLM com 1–2 exercícios, sem perda funcional.
- **Stem agressivo demais (4.2).** `stemPtBr` corta sufixos `a`/`o`/`as`/`os` apenas quando o radical resultante tem ≥ 4 chars, justamente para não comer "leg" em "lega". Cobertura por testes.
- **Aliases ambíguos (4.2).** "banco" também aparece em "banco inclinado" (= banco de supino). Como aliases são **adicionados** ao keyword set (não substituem), o resultado é só candidatos extras — nunca remoção. Pior caso: prompt um pouco maior. Aceitável.
- **`addParsedWorkoutsToDraft` mesclando errado (4.4).** Se o usuário cola um texto "Treino A" e já existe um workout chamado "treino a", o método deve dar append no existente. Test cenário 3 cobre.
- **Vercel `maxDuration = 30`.** Após o split correto, cada bloco demora ~3–6s no LLM (gpt-4.1-mini), e os blocos rodam em paralelo. Total do request fica em ~6–10s. Bem dentro do budget. Não mexer no `maxDuration`.

---

## 9. Não-objetivos / coisas a deixar para depois

- Substituir o pre-filter por embeddings (vector search). Custo/complexidade alto, ganho marginal sobre a versão melhorada do 4.2.
- Streaming de resposta para mostrar progresso por workout. Existe spec de streaming separada (`docs/specs/02-fase-1.5-streaming-parcial.md`) — não confundir escopos.
- Dedupe de exercícios quando o mesmo exercício é prescrito 2x no mesmo workout. Treinador às vezes faz isso de propósito (warmup + working set). Manter como está.
