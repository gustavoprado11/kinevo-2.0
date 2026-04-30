# Spec — Fix "Texto para Treino" PARTE 2: heurística do splitter + cobertura de regressão

> **Audience:** Claude Code rodando no monorepo `kinevo-monorepo`.
> **Pré-leitura obrigatória:** `docs/specs/PROMPT-FIX-TEXTO-PARA-TREINO.md` (parte 1, já mergeada).
> **Não questione decisões aqui documentadas. Faça os passos na ordem.**

---

## 1. Contexto

A parte 1 corrigiu três bugs do "Texto para Treino": timeout no split, matching de slang regional ("banco flexor" → "Cadeira Flexora") e overwrite no mobile. Tudo funcionando, 24/24 testes verdes.

**Risco que ficou em aberto:** a regra (4) do `isWorkoutHeading` em `web/src/app/api/prescription/parse-text/lib.ts` é gulosa demais. Ela trata qualquer linha curta (≤ 40 chars, ≤ 5 palavras, sem padrão `NxM`) seguida por uma linha de exercício como heading. Isso pega corretamente "Empurrar - segunda" (bom), mas também dispara em seções internas como "Aquecimento", "Mobilidade", "Trabalho principal" — quebrando o bloco no meio.

**Reproduzido:**

```
Input: "Treino A\nAquecimento 5min esteira\nSupino 3x10\nRemada 3x10"
Output: 2 blocos (esperado: 1)
  - Bloco 1: "Treino A" (sem exercícios)
  - Bloco 2: "Aquecimento 5min esteira\nSupino 3x10\nRemada 3x10"
```

```
Input: "Treino A\nAquecimento\nSupino 3x10\nTrabalho\nAgachamento 3x10"
Output: 3 blocos (esperado: 1)
```

Esse caso é silencioso: o LLM recebe blocos quebrados, alguns sem heading válido, e pode atribuir exercícios ao treino errado. O texto exato que motivou a parte 1 (5 treinos com cabeçalhos "Superior A - segunda" etc.) **continua passando** — então não é regressão das mudanças anteriores, é uma frouxidão pré-existente da heurística.

---

## 2. Escopo

**Em escopo (mínimo necessário):**
- Apertar regra (4) de `isWorkoutHeading` em `web/.../lib.ts` E `supabase/functions/parse-workout-text/index.ts` (paridade obrigatória).
- Adicionar 2 testes de regressão em `web/.../__tests__/split.test.ts` cobrindo seção interna que NÃO é heading.
- Replicar os 2 testes no equivalente Deno (`supabase/functions/parse-workout-text/index_test.ts` se já existir; pular se a parte 1 não criou).
- Documentar resultado da validação manual dos cenários mobile 1–4 (que ficaram pendentes da parte 1).

**Fora de escopo:**
- Mudar regras (1), (2), (3) de `isWorkoutHeading`.
- Refatorar a duplicação web/edge (continua paritária por enquanto).
- Mudar a função no mobile.
- Telemetria, streaming, qualquer outra melhoria de UX.

---

## 3. Mudanças de código

### 3.1. Apertar regra (4) — exigir linha em branco precedente

A regra (4) deve disparar **somente** quando a linha está em uma das duas situações:
1. É a primeira linha não-vazia do texto inteiro (caso comum: heading abre o texto).
2. A linha imediatamente anterior está em branco (i.e., separa visualmente do bloco anterior).

Isso elimina o falso positivo de "Aquecimento" no meio de um bloco de exercícios, sem afetar o caso real do treinador (cabeçalhos sempre vêm depois de linha em branco ou no início).

**Arquivo 1:** `web/src/app/api/prescription/parse-text/lib.ts`

Substituir a função `isWorkoutHeading` (linhas 19–39 hoje) e ajustar `splitWorkoutBlocks` para passar o novo parâmetro:

```ts
function isWorkoutHeading(
    line: string,
    nextNonEmpty: string | null,
    prevLineBlank: boolean,
): boolean {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length > 80) return false
    if (/\d+\s*[x×]\s*\d+/i.test(trimmed)) return false

    const norm = normalizeHeadingStr(trimmed)

    // (1) e (2): palavra-chave estrutural ou de divisão.
    for (const kw of HEADING_KEYWORDS) {
        const re = new RegExp(`^${kw}\\b`)
        if (re.test(norm)) return true
    }

    // (3): rótulo curto "A - segunda", "B: terça", "C – qualquer coisa".
    if (/^[a-z0-9]{1,4}\s*[-–—:]/.test(norm)) return true

    // (4) heuristic fallback: linha curta sem números de série, seguida (em
    // até 1 linha em branco) por uma linha de exercício "Nome ... NxM".
    // SÓ dispara se a linha está separada visualmente do bloco anterior
    // (linha em branco antes ou início do texto). Sem isso, "Aquecimento"
    // dentro de um bloco de exercícios viraria heading falso.
    if (
        prevLineBlank &&
        trimmed.length <= 40 &&
        nextNonEmpty &&
        /\d+\s*[x×]\s*\d+/i.test(nextNonEmpty)
    ) {
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length
        if (wordCount <= 5) return true
    }

    return false
}

export function splitWorkoutBlocks(text: string): string[] {
    const lines = text.split('\n')
    const blocks: string[] = []
    let current: string[] = []

    const nextNonEmpty: (string | null)[] = new Array(lines.length).fill(null)
    let pending: string | null = null
    for (let i = lines.length - 1; i >= 0; i--) {
        nextNonEmpty[i] = pending
        if (lines[i].trim()) pending = lines[i].trim()
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // prevLineBlank = true quando a linha é a primeira do texto OU
        // a linha imediatamente anterior está em branco (apenas whitespace).
        const prevLineBlank = i === 0 || lines[i - 1].trim() === ''

        if (isWorkoutHeading(line, nextNonEmpty[i], prevLineBlank)) {
            if (current.length > 0) {
                const block = current.join('\n').trim()
                if (block) blocks.push(block)
            }
            current = [line]
        } else {
            current.push(line)
        }
    }
    if (current.length > 0) {
        const block = current.join('\n').trim()
        if (block) blocks.push(block)
    }

    if (blocks.length === 0) return [text]
    return blocks
}
```

**Arquivo 2:** `supabase/functions/parse-workout-text/index.ts`

Aplicar a **mesma** mudança (mesmo código, ajustando ponto-e-vírgula/aspas se a convenção do arquivo for diferente). A função `isWorkoutHeading` está no mesmo arquivo da edge function. Manter paridade obrigatória — o `diff` entre os dois deve mostrar só as diferenças triviais já existentes (aspas, imports, etc.), não diferenças semânticas.

> **Critério de aceite (3.1):**
> - O texto exato do treinador (5 treinos com "Superior A - segunda" etc.) continua dando 5 blocos.
> - "Treino A\nAquecimento 5min esteira\nSupino 3x10\nRemada 3x10" dá **1 bloco**.
> - "Treino A\nAquecimento\nSupino 3x10\nTrabalho\nAgachamento 3x10" dá **1 bloco**.
> - `diff web/.../lib.ts supabase/functions/parse-workout-text/index.ts` na função `isWorkoutHeading` mostra apenas diferenças cosméticas.

### 3.2. Cobertura de regressão — testes do split

**Arquivo:** `web/src/app/api/prescription/parse-text/__tests__/split.test.ts`

Adicionar dois casos novos ao describe `splitWorkoutBlocks`. Manter os 4 existentes (não tocar):

```ts
it('linha de "Aquecimento" dentro do bloco não vira heading separado', () => {
    const text = `Treino A
Aquecimento 5min esteira
Supino 3x10
Remada 3x10`
    const blocks = splitWorkoutBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain('Aquecimento 5min esteira')
    expect(blocks[0]).toContain('Supino 3x10')
})

it('seções internas sem linha em branco antes não viram heading', () => {
    const text = `Treino A
Aquecimento
Supino 3x10
Trabalho principal
Agachamento 3x10`
    const blocks = splitWorkoutBlocks(text)
    expect(blocks).toHaveLength(1)
})

it('cabeçalho fora do dicionário ainda funciona quando precedido por linha em branco', () => {
    // Cobre o uso legítimo da regra (4): "Empurrar - segunda" não está em
    // HEADING_KEYWORDS, mas vem após linha em branco e é seguido de exercício.
    const text = `Empurrar - segunda
Supino 3x10

Puxar - terça
Remada 3x10`
    const blocks = splitWorkoutBlocks(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatch(/^Empurrar - segunda/)
    expect(blocks[1]).toMatch(/^Puxar - terça/)
})
```

Observação importante sobre o terceiro teste: ele documenta que a regra (4) **continua útil** mesmo apertada — cabeçalhos não-padrão precedidos de linha em branco ainda são detectados. Isso protege o caso real do treinador caso ele use "Empurrar"/"Puxar"/"Pernas" em vez de "Push"/"Pull"/"Legs".

**Equivalente Deno:** se a parte 1 criou `supabase/functions/parse-workout-text/index_test.ts`, replicar os 3 testes acima nele. Se não criou, **pular** — não criar suite Deno só para esse follow-up.

> **Critério de aceite (3.2):** `npm test --workspace=web` (ou comando equivalente) verde, com 7 casos no `splitWorkoutBlocks` describe (4 antigos + 3 novos).

### 3.3. Validação manual mobile (não-código)

Os cenários 1–4 da seção 4.4 da parte 1 não foram automatizados (mobile não tem suite de teste pra esse store). Antes de fechar este PR, **executar manualmente no simulador iOS ou Android** com um aluno de teste:

- **Cenário 1 (estado vazio):** abrir builder novo (programa do zero) → "Texto para Treino" → colar `Treino A: Supino 3x10` → confirmar 1 workout, 1 exercício, draft com `studentId` correto.
- **Cenário 2 (draft com 1 treino prescrito):** com Treino A já no canvas (ex: 6 exercícios via prescrição anterior), abrir "Texto para Treino" novamente → colar `Treino B: Leg press 3x10` → confirmar 2 workouts (A original intacto + B novo). `currentWorkoutId` aponta pro Treino B.
- **Cenário 3 (mesmo nome):** com Treino A com 3 exercícios, prescrever via texto `Treino A: Agachamento 3x10` → confirmar **1 workout** com 4 exercícios (3 antigos + agachamento no fim).
- **Cenário 4 (trocou de aluno):** prescrever para aluno X, voltar, abrir builder pra aluno Y, prescrever — confirmar que o draft de Y começa do zero, sem vazar nada de X.

Registrar o resultado de cada cenário no comentário do PR (ou no commit message), no formato:

```
Mobile manual validation:
- Cenário 1 ✓ (build #N, simulador iPhone 15 Pro iOS 17.x)
- Cenário 2 ✓
- Cenário 3 ✓
- Cenário 4 ✓
```

Se algum falhar, **não mergear** — abrir issue com repro e voltar a olhar `addParsedWorkoutsToDraft` em `mobile/stores/program-builder-store.ts`.

---

## 4. Reprodução para reviewer

Antes da mudança 3.1, rodar `node /tmp/repro.js`:

```js
// Cole aqui o splitWorkoutBlocks atual (do lib.ts) e teste:
const t1 = `Treino A
Aquecimento 5min esteira
Supino 3x10
Remada 3x10`;
console.log('antes:', splitWorkoutBlocks(t1).length, '(deve ser 1)');
```

Antes do fix: imprime `2`. Depois do fix: imprime `1`.

---

## 5. Checklist de execução

Em ordem.

- [ ] **3.1 (web)** `isWorkoutHeading` e `splitWorkoutBlocks` atualizados em `web/src/app/api/prescription/parse-text/lib.ts`.
- [ ] **3.1 (edge)** Mesma mudança em `supabase/functions/parse-workout-text/index.ts`. `diff` confirma paridade.
- [ ] **3.2** 3 novos testes adicionados em `web/.../__tests__/split.test.ts`. Suite verde.
- [ ] **3.2** (se aplicável) testes Deno equivalentes em `index_test.ts`.
- [ ] **3.3** Cenários mobile 1–4 validados manualmente; resultado registrado no PR.
- [ ] `tsc --noEmit` verde no `web` (e no `mobile` se algum tipo foi tocado).
- [ ] Verificação final: rodar o repro de `/tmp/repro.js` da seção 4 e confirmar `1` em vez de `2`.

---

## 6. Riscos e mitigação

- **Falso negativo na regra (4) apertada.** Se um treinador colar um texto sem linhas em branco entre treinos (`Empurrar\nSupino\nPuxar\nRemada` numa única coluna), a regra (4) não dispara em "Puxar" porque a linha anterior é "Supino" (não em branco). Para esse formato denso, regras (1)/(2)/(3) precisariam reconhecer "Empurrar"/"Puxar". Mitigação: HEADING_KEYWORDS já cobre `push`, `pull`, `peito`, `costas`, `pernas`. Se aparecer relato real desse caso, adicionar `empurrar`/`puxar` ao dicionário em PR separado. Não bloquear este PR.
- **`prevLineBlank = true` na primeira linha.** Comportamento intencional: heading no início do texto (caso muito comum) tem que disparar. Não tem regressão associada.
- **Edge function sem testes automatizados.** Aceito. Se a parte 1 não criou `index_test.ts`, este PR também não cria.

---

## 7. Não-objetivos

- Refatorar para extrair splitter/filter num pacote `@kinevo/shared` (eliminaria a duplicação web/edge). Vale a pena no médio prazo, mas é PR próprio.
- Adicionar telemetria de matched/unmatched. Vale a pena pra entender se o prompt de slang está pegando, mas é PR próprio.
- Streaming parcial. Coberto pela spec separada `02-fase-1.5-streaming-parcial.md`.
