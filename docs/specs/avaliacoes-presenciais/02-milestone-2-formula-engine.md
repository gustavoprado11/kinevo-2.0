# Milestone 2 — Engine de fórmulas (`shared/lib/assessment-protocols/`)

**Pré-requisito:** ler `00-visao-geral.md`. M1 está completo (migration 122 aplicada em prod, validada).

**Goal:** criar pacote TypeScript em `shared/` com todas as fórmulas necessárias pra Fase 1 (IMC, RCQ, dobras cutâneas, equações de densidade-pra-%BG, derivadas de massa magra/gorda) + classificações automáticas + suite de testes com fixtures cross-validadas. Esse pacote vai ser consumido por mobile e web em M3 e M4 — então API limpa e estável é prioridade.

**Plataforma:** TypeScript em `shared/lib/assessment-protocols/`.

**Dura:** 3-5 dias úteis.

**Branch:** sem branch — trabalho direto em main, sem commit/push até validação aprovada (mesmo padrão do M1).

---

## 1. Por que isso é crítico

Cálculo de %BG e classificações são informação clínica. Um erro de coeficiente vira recomendação errada → treinador toma decisão errada → aluno se machuca ou não progride. Pior: pode virar processo no Conselho Federal de Educação Física.

**Mitigação obrigatória:** todo coeficiente das fórmulas é citado contra um source primário (paper original, livro-texto reconhecido, ou calculadora de referência amplamente validada). Cada protocolo tem **pelo menos 5 fixtures** cruzando entradas conhecidas com outputs validados de DUAS fontes independentes. Sem isso, M2 não é aceito.

---

## 2. Estrutura do pacote

```
shared/lib/assessment-protocols/
├── index.ts                      # public API exports
├── types.ts                      # Sex, ProtocolId, BodyCompositionResult, etc
├── formulas.ts                   # todas as fórmulas (funções puras)
├── classifications.ts            # classificações (BMI/OMS, %BG/Pollock-Wilmore, RCQ/OMS)
├── derived.ts                    # massa gorda/magra (utilitários)
├── protocols.ts                  # registry: protocol id → formula + lista de skinfolds
└── __tests__/
    ├── formulas.test.ts          # unit tests por fórmula
    ├── classifications.test.ts
    ├── derived.test.ts
    ├── protocols.test.ts
    └── fixtures.ts               # casos de referência cruzados
```

Padrão alinhado com `shared/utils/schedule-projection/` (ver no repo). Funções puras, zero estado, zero side effects, zero deps externas.

### 2.1 O que **NÃO** vai aqui

- ❌ Persistência (já está em M1, via RPCs)
- ❌ Renderização (vai em M3/M4)
- ❌ Integração com Supabase (este pacote roda em qualquer ambiente JS/TS)
- ❌ Locale/i18n (classificações têm labels em pt-BR mas são strings simples; sem i18n lib)

---

## 3. Tipos compartilhados (`types.ts`)

```ts
// Sex e idade
export type Sex = 'male' | 'female';

// Protocolo de cálculo
export type ProtocolId =
  | 'jackson_pollock_3'
  | 'jackson_pollock_7'
  | 'petroski_4'
  | 'faulkner_4';

// Equação densidade → %BG
export type DensityEquation = 'siri' | 'brozek';

// Sites de dobra cutânea (canônicos, em inglês para evitar confusão pt vs en)
export type SkinfoldSite =
  | 'chest'           // peitoral / peito
  | 'abdomen'         // abdominal
  | 'thigh'           // coxa
  | 'triceps'         // tríceps
  | 'subscapular'     // subescapular
  | 'suprailiac'      // supra-ilíaca
  | 'midaxillary'     // sub-axilar / axilar média
  | 'biceps'          // bíceps
  | 'calf';           // panturrilha medial

// Input de dobras: parcial — cada protocolo define seu subset obrigatório
export type SkinfoldInput = Partial<Record<SkinfoldSite, number>>;

// Inputs antropométricos básicos
export interface AnthropometricInput {
  weight_kg: number;
  height_m: number;          // IMPORTANTE: metros, não cm
  age_years: number;
  sex: Sex;
}

// Inputs adicionais para circunferências
export interface CircumferenceInput {
  waist_cm: number;
  hip_cm: number;
}

// Input completo para body composition
export interface BodyCompositionInput {
  protocol: ProtocolId;
  density_equation?: DensityEquation;  // default 'siri'
  anthropometric: AnthropometricInput;
  skinfolds_mm: SkinfoldInput;
}

// Resultado de body composition
export interface BodyCompositionResult {
  protocol: ProtocolId;
  density_equation: DensityEquation;
  body_density: number | null;        // null para Faulkner (calcula %BG direto)
  body_fat_percent: number;           // 0-100
  fat_mass_kg: number;
  lean_mass_kg: number;
  classification: BodyFatClassification;
  // Echo dos inputs essenciais para o relatório
  inputs: {
    sum_skinfolds_mm: number;
    sites_used: SkinfoldSite[];
    age_years: number;
    sex: Sex;
    weight_kg: number;
  };
}

// Classificações
export type BMICategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese_class_1'
  | 'obese_class_2'
  | 'obese_class_3';

export type WHRRiskCategory = 'low' | 'moderate' | 'high';

export type BodyFatCategory =
  | 'essential'        // < limite mínimo (potencialmente perigoso)
  | 'athletic'
  | 'fitness'
  | 'average'
  | 'above_average'
  | 'obese';

export interface Classification<T extends string> {
  category: T;
  label_pt: string;          // ex: 'Sobrepeso', 'Risco moderado'
  description_pt?: string;   // contexto opcional
  range: { min: number | null; max: number | null };
}

export type BMIClassification = Classification<BMICategory>;
export type WHRClassification = Classification<WHRRiskCategory>;
export type BodyFatClassification = Classification<BodyFatCategory>;

// Erros conhecidos do domínio
export class FormulaInputError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'FormulaInputError';
  }
}
```

---

## 4. Fórmulas (`formulas.ts`)

Cada fórmula é uma função pura que valida inputs e retorna número. **Citação obrigatória do source no JSDoc.**

### 4.1 IMC (Body Mass Index)

```ts
/**
 * IMC = peso / (altura²).
 * Source: Quetelet (1832), padronizado pela OMS.
 *
 * @param weight_kg Peso em quilogramas (>0)
 * @param height_m  Estatura em METROS (>0). Atenção: NÃO em cm.
 * @returns IMC em kg/m²
 */
export function bmi(weight_kg: number, height_m: number): number {
  if (weight_kg <= 0) throw new FormulaInputError('weight_kg must be > 0', 'weight_kg');
  if (height_m <= 0) throw new FormulaInputError('height_m must be > 0', 'height_m');
  if (height_m > 3) throw new FormulaInputError('height_m looks like cm — use meters', 'height_m');
  return weight_kg / (height_m * height_m);
}
```

### 4.2 RCQ (razão cintura-quadril)

```ts
/**
 * RCQ = cintura / quadril.
 * Source: WHO (1999) "Waist circumference and waist–hip ratio".
 */
export function waistHipRatio(waist_cm: number, hip_cm: number): number {
  if (waist_cm <= 0) throw new FormulaInputError('waist_cm must be > 0', 'waist_cm');
  if (hip_cm <= 0) throw new FormulaInputError('hip_cm must be > 0', 'hip_cm');
  return waist_cm / hip_cm;
}
```

### 4.3 Equações de densidade → %BG

```ts
/**
 * Equação de Siri (1956): %BG = 495/D - 450.
 * Source: Siri WE. Body composition from fluid spaces and density. NAS-NRC, 1956.
 */
export function siri(density: number): number {
  if (density <= 0) throw new FormulaInputError('density must be > 0', 'density');
  return 495 / density - 450;
}

/**
 * Equação de Brozek et al (1963): %BG = (4.57/D - 4.142) × 100.
 * Source: Brozek J, Grande F, Anderson JT, Keys A. Densitometric analysis
 *   of body composition. Ann NY Acad Sci 1963; 110:113-140.
 *
 * Mais conservadora que Siri em densidades extremas.
 */
export function brozek(density: number): number {
  if (density <= 0) throw new FormulaInputError('density must be > 0', 'density');
  return (4.57 / density - 4.142) * 100;
}
```

### 4.4 Jackson & Pollock 3 dobras

⚠️ **Atenção a coeficientes.** As versões originais (Jackson & Pollock 1978, e Jackson, Pollock & Ward 1980 para mulheres) têm coeficientes que variam entre publicações. Os abaixo são os mais citados — VERIFICAR contra fonte primária antes do commit:

```ts
/**
 * Jackson & Pollock — 3 dobras.
 * Source: Jackson AS, Pollock ML. Generalized equations for predicting body
 *   density of men. Br J Nutr 1978; 40(3):497-504.
 * Source (mulheres): Jackson, Pollock, Ward. Generalized equations for
 *   predicting body density of women. Med Sci Sports Exerc 1980; 12(3):175-181.
 *
 * Sites masculinos: chest, abdomen, thigh.
 * Sites femininos: triceps, suprailiac, thigh.
 */
export function jacksonPollock3(input: {
  sex: Sex;
  age_years: number;
  skinfolds_mm: SkinfoldInput;
}): number {
  const { sex, age_years, skinfolds_mm } = input;
  if (age_years <= 0) throw new FormulaInputError('age_years must be > 0', 'age_years');

  if (sex === 'male') {
    const sites = ['chest', 'abdomen', 'thigh'] as const;
    const sum = sumSkinfolds(skinfolds_mm, sites);
    // Jackson & Pollock (1978) — homens, 3 dobras
    return 1.10938
      - 0.0008267 * sum
      + 0.0000016 * sum * sum
      - 0.0002574 * age_years;
  } else {
    const sites = ['triceps', 'suprailiac', 'thigh'] as const;
    const sum = sumSkinfolds(skinfolds_mm, sites);
    // Jackson, Pollock & Ward (1980) — mulheres, 3 dobras
    return 1.0994921
      - 0.0009929 * sum
      + 0.0000023 * sum * sum
      - 0.0001392 * age_years;
  }
}
```

### 4.5 Jackson & Pollock 7 dobras

```ts
/**
 * Jackson & Pollock — 7 dobras.
 * Sites (ambos os sexos): chest, abdomen, thigh, triceps, subscapular,
 *                        suprailiac, midaxillary.
 *
 * Source: Jackson & Pollock (1978) — homens.
 * Source: Jackson, Pollock & Ward (1980) — mulheres.
 */
export function jacksonPollock7(input: {
  sex: Sex;
  age_years: number;
  skinfolds_mm: SkinfoldInput;
}): number {
  const { sex, age_years, skinfolds_mm } = input;
  if (age_years <= 0) throw new FormulaInputError('age_years must be > 0', 'age_years');

  const sites = [
    'chest', 'abdomen', 'thigh', 'triceps',
    'subscapular', 'suprailiac', 'midaxillary'
  ] as const;
  const sum = sumSkinfolds(skinfolds_mm, sites);

  if (sex === 'male') {
    return 1.112
      - 0.00043499 * sum
      + 0.00000055 * sum * sum
      - 0.00028826 * age_years;
  } else {
    return 1.097
      - 0.00046971 * sum
      + 0.00000056 * sum * sum
      - 0.00012828 * age_years;
  }
}
```

### 4.6 Petroski 4 dobras

⚠️ **Petroski tem MÚLTIPLAS variantes em sua tese (1995) e publicações subsequentes.** A versão "4 dobras adultos" mais usada no Brasil é a citada abaixo. Outras versões incluem peso e estatura como variáveis adicionais. **Implementar apenas a versão "4 dobras puras"** abaixo. Se a versão "4 dobras + peso + estatura" for necessária no futuro, criar `petroski4Composta` separadamente.

```ts
/**
 * Petroski (1995) — 4 dobras, equação para adultos brasileiros.
 * Sites: subscapular, triceps, suprailiac, calf.
 *
 * Source: Petroski EL. Desenvolvimento e validação de equações generalizadas
 *   para a estimativa da densidade corporal em adultos. Tese (Doutorado),
 *   UFSM, 1995.
 *
 * IMPORTANTE: Esta é a versão 4 dobras CUTÂNEAS apenas. Há variantes
 * que incluem peso/estatura — não são esta função.
 */
export function petroski4(input: {
  sex: Sex;
  age_years: number;
  skinfolds_mm: SkinfoldInput;
}): number {
  const { sex, age_years, skinfolds_mm } = input;
  if (age_years <= 0) throw new FormulaInputError('age_years must be > 0', 'age_years');

  const sites = ['subscapular', 'triceps', 'suprailiac', 'calf'] as const;
  const sum = sumSkinfolds(skinfolds_mm, sites);

  if (sex === 'male') {
    return 1.10726863
      - 0.00081201 * sum
      + 0.00000212 * sum * sum
      - 0.00041761 * age_years;
  } else {
    // ATENÇÃO: equação feminina pura sem peso/estatura.
    // ⚠️ VERIFICAR coeficientes contra fonte primária antes do commit.
    return 1.1954713
      - 0.07513507 * Math.log10(sum)
      - 0.00041072 * age_years;
  }
}
```

> **Cuidado especial Petroski feminino:** a versão pura sem peso/estatura usa logaritmo. Se a fonte primária recomendar a versão com peso/estatura, criar uma issue antes de implementar e me chamar.

### 4.7 Faulkner 4 dobras

```ts
/**
 * Faulkner (1968) — 4 dobras, %BG direto (não passa por densidade).
 * Sites: triceps, subscapular, suprailiac, abdomen.
 *
 * Source: Faulkner JA. Physiology of swimming and diving. In: Falls H,
 *   editor. Exercise physiology. Baltimore: Academic Press, 1968.
 *
 * %BG = (Σ × 0.153) + 5.783
 *
 * Equação muito simples — adequada para população geral, mas menos
 * precisa que Jackson & Pollock para atletas.
 */
export function faulkner4(skinfolds_mm: SkinfoldInput): number {
  const sites = ['triceps', 'subscapular', 'suprailiac', 'abdomen'] as const;
  const sum = sumSkinfolds(skinfolds_mm, sites);
  return sum * 0.153 + 5.783;
}
```

### 4.8 Helper

```ts
/**
 * Soma dobras cutâneas. Erra explicitamente se um site requerido faltar.
 */
function sumSkinfolds(
  input: SkinfoldInput,
  required: readonly SkinfoldSite[]
): number {
  let total = 0;
  for (const site of required) {
    const value = input[site];
    if (value === undefined || value === null) {
      throw new FormulaInputError(
        `Skinfold site '${site}' is required but missing`,
        site
      );
    }
    if (value < 0) {
      throw new FormulaInputError(
        `Skinfold site '${site}' must be >= 0`,
        site
      );
    }
    total += value;
  }
  return total;
}
```

---

## 5. Classificações (`classifications.ts`)

### 5.1 IMC — OMS (1995)

| BMI | Categoria | Label PT |
|---|---|---|
| < 18.5 | `underweight` | Baixo peso |
| 18.5 – 24.9 | `normal` | Peso normal |
| 25.0 – 29.9 | `overweight` | Sobrepeso |
| 30.0 – 34.9 | `obese_class_1` | Obesidade grau I |
| 35.0 – 39.9 | `obese_class_2` | Obesidade grau II |
| ≥ 40.0 | `obese_class_3` | Obesidade grau III |

```ts
export function classifyBMI(value: number): BMIClassification { /* ... */ }
```

### 5.2 RCQ — risco cardiovascular (OMS)

| Sex | Baixo | Moderado | Alto |
|---|---|---|---|
| Homens | < 0.95 | 0.95 – 1.0 | > 1.0 |
| Mulheres | < 0.80 | 0.80 – 0.85 | > 0.85 |

```ts
export function classifyWaistHipRatio(value: number, sex: Sex): WHRClassification { /* ... */ }
```

### 5.3 %BG — Pollock & Wilmore (1993) por idade e sexo

Tabela completa, faixas por idade (20-29, 30-39, 40-49, 50-59, 60+) e sexo. Categorias: `essential`, `athletic`, `fitness`, `average`, `above_average`, `obese`.

```ts
export function classifyBodyFat(
  value: number,
  age_years: number,
  sex: Sex
): BodyFatClassification { /* ... */ }
```

> **Fonte da tabela:** Pollock ML, Wilmore JH. Exercise in health and disease. 2nd ed. Philadelphia: Saunders, 1990. (Frequentemente citada como referência em cursos de avaliação física no Brasil.) Implementar a tabela inteira no código com fixtures por faixa.

---

## 6. Derivadas (`derived.ts`)

```ts
/** Massa gorda absoluta (kg). */
export function fatMassKg(weight_kg: number, body_fat_percent: number): number {
  return weight_kg * (body_fat_percent / 100);
}

/** Massa magra (kg) = peso - massa gorda. */
export function leanMassKg(weight_kg: number, body_fat_percent: number): number {
  return weight_kg - fatMassKg(weight_kg, body_fat_percent);
}
```

---

## 7. Registry (`protocols.ts`)

```ts
export interface ProtocolDefinition {
  id: ProtocolId;
  name_pt: string;
  required_sites: { sex: Sex; sites: SkinfoldSite[] }[];
  computes_density: boolean;     // false para Faulkner
  source_citation: string;
}

export const PROTOCOLS: Record<ProtocolId, ProtocolDefinition> = {
  jackson_pollock_3: { ... },
  jackson_pollock_7: { ... },
  petroski_4: { ... },
  faulkner_4: { ... },
};
```

---

## 8. API pública (`index.ts`)

```ts
export { bmi, waistHipRatio, siri, brozek,
         jacksonPollock3, jacksonPollock7, petroski4, faulkner4,
         FormulaInputError } from './formulas';
export { classifyBMI, classifyWaistHipRatio, classifyBodyFat } from './classifications';
export { fatMassKg, leanMassKg } from './derived';
export { PROTOCOLS, type ProtocolDefinition } from './protocols';
export * from './types';

/**
 * Função high-level que combina protocolo + densidade + classificação.
 * Use para o caso comum "trainer terminou avaliação, quero o resultado completo".
 */
export function calculateBodyComposition(
  input: BodyCompositionInput
): BodyCompositionResult { /* ... */ }
```

---

## 9. Testes (`__tests__/`)

### 9.1 Estratégia

Vitest (já está no projeto, ver `web/vitest.config.ts`).

Para cada fórmula, **mínimo 5 fixtures** que cruzem:
1. Calculadora online de referência (e.g., `medesportepapers.com.br` para J&P).
2. Tabela publicada (Pollock & Wilmore, ACSM Guidelines).
3. Cálculo manual (caneta + papel) para 1 caso, conferindo valores intermediários.

Cada fixture documenta:
- Input completo
- Output esperado (com tolerância de ±0.01 para densidade, ±0.1 pp para %BG)
- Citação da fonte de validação

### 9.2 Casos obrigatórios por protocolo

- 1 caso "padrão" (homem 30a, %BG ~15%, atleta médio)
- 1 caso "feminino padrão" (mulher 30a, %BG ~25%)
- 1 caso "idoso" (60+a)
- 1 caso "atleta extremo" (%BG <8%)
- 1 caso "borderline obesidade" (%BG >30%)

### 9.3 Casos de erro obrigatórios

Para cada fórmula:
- Idade negativa → erro
- Sex inválido → erro de tipo
- Skinfold faltando → `FormulaInputError` com `field` correto
- Inputs zero ou negativos onde proibidos → erro

### 9.4 Cobertura

100% das funções e branches em `formulas.ts`, `classifications.ts`, `derived.ts`. Configurar Vitest com `--coverage` no script de teste.

---

## 10. Acceptance criteria

- ✅ Pacote completo em `shared/lib/assessment-protocols/` seguindo a estrutura da seção 2
- ✅ Todas as 8 fórmulas implementadas com JSDoc citando source
- ✅ 3 classificações (BMI, RCQ, %BG por idade/sexo) com tabela completa
- ✅ Função `calculateBodyComposition` orquestrando protocolo+densidade+classificação
- ✅ Cobertura de testes: 100% em `formulas.ts`, `classifications.ts`, `derived.ts`
- ✅ Mínimo 5 fixtures por protocolo, cada uma citando fonte de validação
- ✅ Fixtures de erro: pelo menos 4 casos por função (input inválido)
- ✅ `tsc --noEmit` em `shared/` limpo (zero erros novos)
- ✅ Script de testes adicionado: `cd shared && npm test` rodando verde
- ✅ `index.ts` exporta API pública limpa e completa
- ✅ Testes para `calculateBodyComposition` cobrindo combinações protocolo × density_equation
- ✅ Documentação rápida no header do `index.ts` listando os protocolos suportados e fontes

---

## 11. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Coeficiente errado vira erro clínico | Citação obrigatória + 5 fixtures por protocolo de fonte independente |
| Confusão masculino/feminino nos coeficientes | Fixtures explícitas por sexo. Teste de "swap" — se trocar 'male' por 'female' nos inputs, output muda significativamente |
| Petroski feminino tem múltiplas variantes | Implementar apenas a versão pura 4 dobras documentada na seção 4.6. Se fonte primária divergir, parar e perguntar |
| Confusão de unidades (cm vs m, mm vs cm) | Validação de range nos inputs (height_m > 3 → erro; skinfold > 100 → warning) |
| Idade em anos vs em décadas | Sempre `age_years` (anos como integer) |
| Equação retorna density quando esperava %BG | API `calculateBodyComposition` separa as duas etapas; tipo `BodyCompositionResult` documenta |
| Faulkner não passa por densidade | Tipo result tem `body_density: number \| null` para refletir |
| Tabela Pollock & Wilmore tem variantes | Citar a edição usada e fixtures cobrindo cada faixa de idade |

---

## 12. Fora de escopo deste milestone

- ❌ Fórmulas adicionais (Guedes, Durnin & Womersley, Slaughter, etc) — adicionar em fases posteriores se necessário
- ❌ Fórmulas para crianças/adolescentes — fora da Fase 1 (Pollock & Wilmore só cobre adultos)
- ❌ CMJ / saltos / power output — Fase 2
- ❌ UI ou hooks que consumam essas fórmulas — M3 e M4
- ❌ Validação de input avançada (anatomia plausível, ranges epidemiológicos) — adicionar se virar problema real

---

## 13. Validação manual antes de pushar

Pelo menos UM caso real validado por mim (Gustavo) ou por um educador físico parceiro:
- Pegar uma avaliação real conhecida (de um aluno do Lucas Damiani Ferreira ou outro trainer ativo)
- Inputar peso/altura/idade/dobras manualmente
- Comparar output da nossa engine com o resultado original (calculadora ou outro app)
- Diferença < 1 pp em %BG é aceitável

Esse passo evita o cenário "passa nos testes unitários mas erra no mundo real".
