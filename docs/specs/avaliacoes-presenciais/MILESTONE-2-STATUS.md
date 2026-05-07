# Milestone 2 — Engine de fórmulas: status

**Estado:** código pronto no working tree, testes 127/127 verde, cobertura 99.13%.

## O que foi feito
- Pacote completo em `shared/lib/assessment-protocols/` (8 arquivos).
- 7 fórmulas: `bmi`, `waistHipRatio`, `siri`, `brozek`, `jacksonPollock3`, `jacksonPollock7`, `petroski4`, `faulkner4`.
- 3 classificações: `classifyBMI` (WHO 1995), `classifyWaistHipRatio` (WHO 2008), `classifyBodyFat` (Pollock & Wilmore 1990).
- Derivadas: `fatMassKg`, `leanMassKg`.
- Registry estático `PROTOCOLS` com required_sites por sexo, citação e flag `computes_density`.
- Orquestrador `calculateBodyComposition` (protocolo + densidade + classificação + decomposição).
- Suite de testes Vitest: **127 testes**, 5+ fixtures cross-validadas por protocolo, casos de erro cobrindo idade/sexo/sites inválidos.
- `@vitest/coverage-v8` instalado no root como devDep; script `test:coverage` em `shared/package.json` e `package.json` raiz.
- `vitest.config.ts` configurado com thresholds 95% (lines/statements/functions/branches) restritos ao novo pacote.

## Cobertura final
| Arquivo | Stmts | Branch | Funcs | Lines |
|---|---:|---:|---:|---:|
| `formulas.ts` | 100% | 100% | 100% | 100% |
| `derived.ts` | 100% | 100% | 100% | 100% |
| `classifications.ts` | 98.18% | 100% | 100% | 98.14% |
| **Total** | **99.13%** | **100%** | **100%** | **99.13%** |

A única linha não coberta (`classifications.ts:284`) é o fallback defensivo `return table[table.length - 1]!` em `pickBand` que só seria atingido se `max_age=200` falhar — caminho impossível com a tabela atual mas mantido para defesa em profundidade.

## Fontes citadas

### Fórmulas primárias
- **BMI**: Quetelet 1832; OMS TRS 854 (1995).
- **WHR**: WHO Expert Consultation, Geneva 2008 (publicada 2011).
- **Siri**: Siri WE, Body composition from fluid spaces and density, NAS-NRC 1961 (originalmente Donner Lab UCRL-3349, 1956).
- **Brozek**: Brozek J et al, Ann NY Acad Sci 1963; 110:113-140.
- **J&P3 / J&P7 (homens)**: Jackson AS, Pollock ML. Br J Nutr 1978; 40(3):497-504.
- **J&P3 / J&P7 (mulheres)**: Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc 1980; 12(3):175-181.
- **Petroski 4**: Petroski EL. Tese de Doutorado, UFSM, 1995.
- **Faulkner**: Faulkner JA. In: Falls H (ed). Exercise Physiology. Academic Press, 1968.

### Cross-checks (fontes secundárias usadas para validar coeficientes e fixtures)
- **ACSM's Guidelines for Exercise Testing and Prescription**, 10ª ed., 2018.
- **Heyward VH, Wagner DR. Applied Body Composition Assessment**, 2ª ed., 2004.
- **Pitanga FJG. Avaliação da Composição Corporal Humana**, 4ª ed., Phorte 2008.
- **Pollock ML, Wilmore JH. Exercise in Health and Disease**, 2ª ed., Saunders 1990.

### Cross-checks específicos para Petroski (versão pura 4 dobras)
1. Pitanga 2008 (livro-texto brasileiro consagrado).
2. Calculadora Med Sport Papers (`https://medesportepapers.com.br/`).
3. Calculadora GPS Esporte (`https://www.gpsesporte.com.br/`).

Os três concordam nos coeficientes para masculino e feminino. Cf. ambiguidades documentadas abaixo.

## Decisões registradas

### 1. Petroski feminino — versão pura 4 dobras
A tese Petroski 1995 documenta primariamente equações **compostas** (com peso e estatura). A versão "pura 4 dobras" implementada aqui é a forma simplificada amplamente adotada em material didático brasileiro e calculadoras online, com coeficientes:

```
D = 1.1954713 − 0.07513507 × log10(Σ4) − 0.00041072 × idade
```

Cross-validada contra **três fontes secundárias independentes que concordam** (Pitanga 2008, Med Sport Papers, GPS Esporte). **Sem rastreabilidade primária direta à tese** — não tive acesso ao PDF da tese de UFSM 1995. Decisão validada com Gustavo (Opção 1 do briefing M2).

Caso uma fase futura precise da versão composta com peso/estatura, criar `petroski4Composta` em separado, sem modificar a função atual (consumidores existentes continuam estáveis).

### 2. Mapeamento P&W → enum `BodyFatCategory`
A tabela Pollock & Wilmore 1990 lista 6 bandas (Excellent / Good / Above Average / Average / Below Average / Poor). O enum do M1 também tem 6 entradas (`essential` / `athletic` / `fitness` / `average` / `above_average` / `obese`). O mapeamento adotado é:

| Enum | P&W |
|---|---|
| `essential` | abaixo do limite ACSM (homens <5%, mulheres <12%) |
| `athletic` | Excellent |
| `fitness` | Good (absorve "Below Average" — ambos representam mais magro que a média sem cruzar para atlético) |
| `average` | Average |
| `above_average` | Above Average (= mais gordura que a típica) |
| `obese` | Poor |

A consolidação Good ⇔ Below Average é uma **decisão Kinevo**, documentada aqui — facilita interpretação clínica linear (essential → atlético → bom → média → acima da média → obeso) sem perder banding fino. Cross-check com ACSM 10ª ed., Tabela 4.4: as bandas são compatíveis dentro de ±1pp em quase todas as células, sem divergências sistemáticas que justifiquem reescolher.

### 3. Floor `essential` fixo por sexo
Homens <5%, mulheres <12% — adotado de **ACSM 10ª ed., Tabela 4.5** ("minimal essential body fat"). Não varia com idade na tabela ACSM, então usamos floor fixo. Cross-check P&W 1990: P&W define a banda "Excellent" começando em 5%/12% para a faixa 18-29; nas faixas etárias mais altas P&W eleva o piso "Excellent" mas o piso fisiológico mínimo (`essential`) é constante per ACSM. Sem divergência crítica.

### 4. Tolerâncias de teste
- Densidade: ±0.0001 (4 casas decimais).
- %BG: ±0.1 percentage point.
- BMI / RCQ: ±0.01.

Conforme spec.

### 5. Coverage threshold
Definido como 95% no `vitest.config.ts`. Atingimos 99.13%. A única linha não coberta é fallback paranoide.

## Known reference divergence
Nenhuma divergência relevante encontrada entre P&W 1990 e ACSM 10ª ed. nas bandas que importam para Fase 1. Caso aparecimento futuro de divergência, **P&W 1990 prevalece** (foi a citação explícita da spec).

## Validação real pendente (BLOCO C)
Conforme combinado, Gustavo vai pegar uma avaliação real de um trainer ativo e cruzar com a engine antes do commit. Diferença <1pp em %BG é aceitável.

## Pre-existing failing test (fora do escopo M2)
`lib/prescription/__tests__/set-type-labels.test.ts` tem 1 teste falhando desde antes do M2 (`Drop` ≠ `DROP`). Não é introduzido por este milestone — registrado aqui para a próxima limpeza.

## Como completar
Ao mergear M3 (mobile capture) e M4 (web builder), os hooks placeholder do M1 vão consumir esta engine via:

```ts
import { calculateBodyComposition } from '@kinevo/shared/lib/assessment-protocols';
const result = calculateBodyComposition({ protocol, anthropometric, skinfolds_mm });
// → enviar result.computed_metrics ao RPC finalize_assessment_session
```
