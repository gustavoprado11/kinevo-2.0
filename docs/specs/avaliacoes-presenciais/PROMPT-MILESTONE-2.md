# PROMPT — Milestone 2: Engine de fórmulas (Avaliações Presenciais)

> Cole este prompt no Claude Code. Ele assume que você está na raiz do repo `kinevo`.
> M1 já está completo: migration 122 aplicada em prod e validada, código em main.

---

Você vai implementar o **Milestone 2 — Engine de fórmulas** do módulo de Avaliações
Presenciais do Kinevo. Trata-se de um pacote TypeScript puro em
`shared/lib/assessment-protocols/` com todas as fórmulas de composição corporal
(IMC, RCQ, dobras cutâneas, equações Siri/Brozek, derivadas) + classificações +
suite de testes com fixtures cross-validadas.

⚠️ **Atenção crítica:** estas são fórmulas regulamentadas (CFEF). Erro de
coeficiente vira recomendação clínica errada. Citação de source e fixtures
cruzadas são OBRIGATÓRIOS, não opcionais.

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/00-visao-geral.md`
   - `docs/specs/avaliacoes-presenciais/02-milestone-2-formula-engine.md` (a spec
     completa deste milestone)
   - `shared/types/assessments.ts` (tipos do M1, podem ser referenciados)

2. Confirme que entendeu:
   - Que protocolos serão implementados (4: J&P 3, J&P 7, Petroski 4, Faulkner 4)
   - Que classificações serão implementadas (3: BMI/OMS, RCQ/OMS, %BG/Pollock-Wilmore)
   - Que testes são exigidos (5+ fixtures por protocolo, cada uma com fonte)
   - Que o pacote é `shared/`, sem deps externas, sem persistência

3. Se algo na spec for ambíguo ou se a fonte primária divergir do que está
   escrito (especialmente Petroski feminino), **PARE e pergunte**. Não invente
   coeficientes.

## Workflow (mesmo padrão do M1)

- **Sem branch.** Trabalho direto em main.
- **Sem `git commit` nem `git push` durante desenvolvimento.** Eu autorizo
  ao final.
- **Faça em três blocos** (A → B → C) com PARADAS no meio para reportar:

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (read-only, sem mudanças)
═══════════════════════════════════════════════════════════════════════

Execute e me reporte:

1. `git status --short` (deve estar limpo, exceto cosméticos não relacionados)
2. `git log --oneline -5` (último commit deve ser `d93f294 feat(assessments):
   M1 data foundation`)
3. `ls shared/lib/ 2>/dev/null` — diretório existe? Se não, vai ser criado.
4. `cat shared/package.json` — confirmar:
   - Tem `vitest` ou `jest` em devDependencies?
   - Existe script `test` ou `test:unit`?
   - Qual é a config de tsconfig para esse package?
5. `cat shared/tsconfig.json`
6. `ls shared/utils/schedule-projection 2>/dev/null` — usar como template de
   estrutura (mostrar conteúdo dos arquivos principais)
7. Procurar por qualquer cálculo de %BG, IMC ou dobra cutânea já existente:
   `grep -rin "body_fat\|skinfold\|jackson.pollock\|petroski\|faulkner\|siri\|brozek" \
   --include="*.ts" shared/ web/ mobile/ | grep -v node_modules | grep -v ".next"`
   — se já houver código de body composition no repo, me reporta antes de
   começar do zero.
8. `cat shared/types/assessments.ts | head -60` (confirmar tipos do M1
   disponíveis: Sex, ProtocolId, etc).

PARE e me mande o relatório completo. Não escreva código ainda.

═══════════════════════════════════════════════════════════════════════
BLOCO B — IMPLEMENTAÇÃO
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

Implementar exatamente o que está nas seções 2-9 da spec. Ordem sugerida:

1. **types.ts** — sex, protocols, classifications, errors
2. **formulas.ts** — bmi, rcq, siri, brozek, J&P3, J&P7, Petroski4, Faulkner4
3. **classifications.ts** — classifyBMI, classifyWaistHipRatio, classifyBodyFat
4. **derived.ts** — fatMassKg, leanMassKg
5. **protocols.ts** — registry
6. **index.ts** — public exports + função `calculateBodyComposition` orquestradora
7. **__tests__/fixtures.ts** — casos de referência cruzados
8. **__tests__/formulas.test.ts**
9. **__tests__/classifications.test.ts**
10. **__tests__/derived.test.ts**
11. **__tests__/protocols.test.ts**

### Convenções obrigatórias

- **Funções puras.** Sem `class` (exceto FormulaInputError), sem mutation, sem
  side effects.
- **Sem libs externas.** Use só Math nativo + as deps que `shared/` já tem.
- **Naming snake_case nos campos de input** (alinha com o database — ex:
  `weight_kg`, `age_years`, `height_m`). Funções em camelCase.
- **Validação eager** — toda função valida inputs no início e lança
  `FormulaInputError` com `field` correto.
- **Citação de source** no JSDoc de toda fórmula. Sem source, sem código.
- **Coeficientes literais com pontuação inteligível** — ex:
  `0.0008267` em vez de `8.267e-4` (legível, debugable).
- **Tolerância de testes:** ±0.01 para densidade, ±0.1 pp para %BG.

### Verificações de cada coeficiente — OBRIGATÓRIO

Antes de hardcodar qualquer coeficiente:
1. Buscar o source primário citado na spec (paper, livro)
2. Se não conseguir acesso direto, usar pelo menos 2 referências secundárias
   independentes (e.g., calculadora online + livro-texto) e cruzar
3. Se houver discrepância entre fontes, **PARAR e me chamar** — não
   "escolha" uma versão sem confirmação

Especialmente:
- Jackson & Pollock feminino: confirmar coeficientes (publicação Jackson,
  Pollock, Ward 1980)
- Petroski feminino 4 dobras: a versão "pura sem peso/estatura" — confirmar
  na tese de 1995 ou em cite review reconhecido. Se a fonte primária só
  documentar a versão com peso/estatura, **parar e me chamar**.
- Faulkner: confirmar `0.153` e `5.783`.

### Fixtures cross-validadas

Para cada protocolo, mínimo 5 fixtures. Cada fixture é um objeto com:
```ts
{
  description: string;
  input: BodyCompositionInput;
  expected: { density?: number; body_fat_percent: number; classification_category: string };
  source_url_or_citation: string;  // OBRIGATÓRIO
  tolerance?: { density?: number; body_fat?: number };  // default ±0.01 / ±0.1
}
```

Cobertura obrigatória de fixtures (5 mínimo por protocolo):
- 1 caso padrão masculino (~30a, %BG médio)
- 1 caso padrão feminino (~30a, %BG médio)
- 1 caso "atleta extremo" (%BG <8%)
- 1 caso "borderline obesidade" (%BG >30%)
- 1 caso "idoso" (60+a)

Fontes de cross-validação aceitas:
- Calculadoras online conhecidas (ex: medesportepapers.com.br para J&P)
- ACSM Guidelines for Exercise Testing and Prescription (último citado)
- Tabelas em livros como "Anthropometric Standardization Reference Manual"
  (Lohman, Roche, Martorell)
- Outro paper peer-reviewed que valida a equação original

### Verificações antes de reportar

- `cd shared && npx tsc --noEmit` deve passar sem erros
- `cd shared && npm test` (ou comando equivalente do projeto) deve passar
  100% verde
- Cobertura ≥ 95% em `formulas.ts`, `classifications.ts`, `derived.ts`
  (rodar com `--coverage` se Vitest, ou flag equivalente)
- `git status --short` mostra os novos arquivos como untracked, NADA
  modificado em arquivos pré-existentes (ou no máximo `shared/types/index.ts`
  se você precisar exportar tipos novos do pacote)

PARE e reporte:
- Arquivos criados (com tamanho em linhas)
- Output do typecheck
- Output dos testes (com cobertura)
- Lista de fontes citadas
- Qualquer ambiguidade que tenha encontrado e como resolveu (ou perguntou)

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL ANTES DO COMMIT
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do BLOCO B.

Eu vou:
1. Revisar o código aqui no Cowork
2. Pegar uma avaliação real (de um trainer ativo no banco) e cruzar com a
   nossa engine via execução pontual
3. Aprovar ou pedir ajustes

Quando eu aprovar, você executa o commit + push:

```
git add shared/lib/assessment-protocols/
git add shared/types/index.ts                                              # se modificado
git add docs/specs/avaliacoes-presenciais/02-milestone-2-formula-engine.md # spec do M2
git add docs/specs/avaliacoes-presenciais/PROMPT-MILESTONE-2.md            # este prompt
git status --short
git diff --cached --stat
```

Se tudo OK, commitar com:

```
git commit -F- <<'COMMITMSG'
feat(assessments): M2 formula engine — body composition protocols

Pure TypeScript package in shared/lib/assessment-protocols/ implementing
all formulas needed for Phase 1 in-person assessments.

Formulas:
- bmi(weight_kg, height_m) — Quetelet (1832), WHO standard
- waistHipRatio(waist_cm, hip_cm) — WHO 1999
- siri(density), brozek(density) — density → body fat %
- jacksonPollock3 — Jackson & Pollock 1978; Jackson, Pollock & Ward 1980
- jacksonPollock7 — same sources, 7-site protocol
- petroski4 — Petroski 1995 (Brazilian population)
- faulkner4 — Faulkner 1968 (direct % body fat)

Classifications:
- BMI: WHO 1995 (underweight → obese class III)
- WHR: WHO 1999 (cardiovascular risk by sex)
- Body fat: Pollock & Wilmore 1990 (by age and sex)

Derivatives: fatMassKg, leanMassKg

Public API:
- calculateBodyComposition(input) — high-level orchestrator
- Individual formula exports for direct use

Tests: Vitest, ≥95% coverage, 5+ cross-validated fixtures per protocol
with cited sources.

This package is consumed by M3 (mobile capture) and M4 (web builder/view).
Migration 122 already applied to prod (M1).
COMMITMSG

git log --oneline -3
git push origin main
```

## Gatilhos para parar e perguntar

Pare e me chame antes de prosseguir se:

- Coeficientes encontrados em fontes diferentes divergem entre si
- Fonte primária não disponível (Jackson & Pollock 1978 e Petroski 1995 são
  papers/teses em pt-BR — pode ser difícil acessar; usar fontes secundárias
  é OK, mas precisa de pelo menos 2 que concordem)
- Petroski feminino só estiver documentado com peso/estatura (não 4 dobras
  puras como a spec assume)
- Algum teste falhar de forma que não dê pra atribuir a coeficiente errado
- Cobertura ficar abaixo de 95%
- Você precisar adicionar nova lib/dependência
- Encontrar código pré-existente no repo que já calcula alguma das fórmulas

**Não invente coeficientes nem "ajuste" pra fixtures passarem.** Se o teste
não bate, ou o coeficiente está errado ou o fixture está errado — descobrir
qual antes de tocar em qualquer um.

COMECE PELO BLOCO A.
