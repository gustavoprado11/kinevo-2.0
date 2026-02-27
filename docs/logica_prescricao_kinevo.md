# Lógica de Prescrição de Treinos — The Muscle & Strength Pyramid

> Documento de referência para o módulo de prescrição com IA do **Kinevo**.
> Baseado no livro *The Muscle & Strength Pyramid: Training* (Eric Helms, Andy Morgan, Andrea Valdez).

---

## Sumário

1. [Hierarquia da Pirâmide](#1-hierarquia-da-pirâmide)
2. [Aderência (Base)](#2-aderência-base)
3. [Volume](#3-volume)
4. [Intensidade](#4-intensidade)
5. [Frequência](#5-frequência)
6. [Progressão](#6-progressão)
7. [Periodização e Deload](#7-periodização-e-deload)
8. [Seleção de Exercícios](#8-seleção-de-exercícios)
9. [Períodos de Descanso](#9-períodos-de-descanso)
10. [Tempo de Execução](#10-tempo-de-execução)
11. [Fluxograma de Decisão para Platô](#11-fluxograma-de-decisão-para-platô)

---

## 1. Hierarquia da Pirâmide

A pirâmide define a **prioridade relativa** de cada variável de treino. A base é mais importante que o topo.

| Nível | Variável | Importância |
|-------|----------|-------------|
| 1 (Base) | Aderência | Fundamental — sem consistência, nada funciona |
| 2 | Volume, Intensidade, Frequência | O núcleo da prescrição |
| 3 | Progressão | Como avançar ao longo do tempo |
| 4 | Seleção de Exercícios | Quais movimentos prescrever |
| 5 | Períodos de Descanso | Tempo entre séries |
| 6 | Tempo de Execução | Velocidade da repetição |

**Regra para a IA:** Sempre priorizar variáveis da base antes de otimizar variáveis do topo. Um programa "ótimo" que o aluno não consiga seguir é pior que um programa "subótimo" com adesão total.

---

## 2. Aderência (Base)

### Princípio REF
O programa deve ser **Realista, Enjoyable (Prazeroso) e Flexível**.

### Regras de prescrição

- **Realismo:** Antes de prescrever, verificar quantos dias/semana o aluno pode treinar e por quanto tempo. Ajustar o plano à disponibilidade real, não ao "ideal".
- **Prazer:** Incluir exercícios que o aluno goste quando possível. Planos prazerosos geram mais esforço e consistência.
- **Flexibilidade:** O programa deve permitir ajustes quando a vida atrapalha (stress, viagem, doença). Abordagens flexíveis de periodização podem ser superiores a rígidas.
- **Sessão perdida:** Recomendação padrão é simplesmente retomar de onde parou na próxima ida à academia. Não tentar compensar acumulando sessões.
- **Estresse externo:** Reconhecer que estresse de vida (trabalho, sono ruim, problemas pessoais) impacta a recuperação e pode exigir redução temporária de volume/intensidade.

### Regra para a IA
- Perguntar ao treinador sobre a disponibilidade do aluno antes de montar o programa.
- Se o aluno tem 3 dias disponíveis, não prescrever programa de 5 dias.

---

## 3. Volume

### Definição
Volume = número total de **séries desafiadoras** (hard sets) por grupo muscular por semana.

### Conceitos-chave de Volume

| Conceito | Definição | Uso |
|----------|-----------|-----|
| **MV** (Maintenance Volume) | Volume mínimo para manter adaptações | Períodos de deload ou manutenção |
| **MEV** (Minimum Effective Volume) | Volume mínimo para gerar progresso | Ponto de partida para novos programas |
| **MAV** (Maximum Adaptive Volume) | Faixa de volume que gera melhor resposta | Alvo ideal na maioria dos mesociclos |
| **MRV** (Maximum Recoverable Volume) | Volume máximo do qual se consegue recuperar | Limite superior — ultrapassar = overtraining |

### Recomendações de Volume por Nível de Experiência

| Nível | Séries por grupo muscular/semana |
|-------|----------------------------------|
| Iniciante | 10–15 séries |
| Intermediário | 15–20 séries |
| Avançado | 15–25+ séries |

### Regras de prescrição

1. **Começar conservador:** Iniciar mais perto do MEV e aumentar progressivamente ao longo das semanas/mesociclos.
2. **Distribuir o volume:** Dividir as séries semanais por múltiplas sessões. Não colocar todas as séries de um grupo muscular num só dia (ver Frequência).
3. **Volume por sessão:** Máximo recomendado de ~10 séries por grupo muscular por sessão. Mais que isso tem retornos diminuídos.
4. **Contabilização:** Contar apenas séries "produtivas" (suficientemente desafiadoras — tipicamente RPE 5+). Séries de aquecimento não contam.
5. **Resposta individual:** O volume ideal varia enormemente entre indivíduos. Monitorar progresso e sinais de fadiga para ajustar.

### Progressão de Volume ao longo de um Mesociclo
- Semana 1: Começar com MEV ou ligeiramente acima
- Semanas 2-3: Adicionar 1-2 séries por grupo muscular/semana
- Semana 4 (ou quando sinais de fadiga): Deload (reduzir ~50% do volume)

---

## 4. Intensidade

### Definição Dupla
- **Intensidade de carga:** Percentual do 1RM (%1RM) ou faixa de repetições
- **Intensidade de esforço:** Quão perto da falha (RPE / RIR)

### Faixas de Repetições por Objetivo

| Objetivo | Faixa de Reps | %1RM Aproximado | RPE Típico |
|----------|---------------|-----------------|------------|
| Força máxima | 1–6 reps | 80–100% | 7–10 |
| Hipertrofia (foco principal) | 6–12 reps | 65–80% | 6–9 |
| Hipertrofia (faixa estendida) | 12–15+ reps | 55–70% | 7–10 |
| Resistência muscular | 15–20+ reps | 50–65% | 7–10 |

### Escala RPE (Rate of Perceived Exertion) / RIR (Reps in Reserve)

| RPE | RIR | Descrição |
|-----|-----|-----------|
| 10 | 0 | Falha muscular — não consegue completar mais nenhuma rep |
| 9.5 | 0-1 | Talvez mais 1 rep, não tem certeza |
| 9 | 1 | Poderia fazer mais 1 rep |
| 8.5 | 1-2 | Definitivamente 1, talvez 2 reps restantes |
| 8 | 2 | Poderia fazer mais 2 reps |
| 7 | 3 | Poderia fazer mais 3 reps |
| 5-6 | 4-5 | Esforço moderado, longe da falha |

### Regras de prescrição

1. **Hipertrofia:** A maioria do volume (≈2/3) deve ser na faixa de 6-12 reps, com o restante distribuído em faixas adjacentes.
2. **Força:** A maioria do volume (≈2/3) na faixa de 1-6 reps, com trabalho acessório em faixas mais altas.
3. **RPE alvo geral:** A maioria das séries deve ficar entre RPE 6-9. Treinar constantemente a RPE 10 (falha) é desnecessário e pode prejudicar recuperação.
4. **Especificidade de intensidade:** Para melhorar força em 1RM, é preciso treinar com cargas pesadas (≥80% 1RM) regularmente, não apenas com séries de 10-12.
5. **Distribuição semanal:** Variar a intensidade ao longo da semana (ex: dia pesado/moderado/leve) é benéfico para intermediários e avançados.
6. **Evitar falha em compostos:** Em exercícios multiarticulares pesados, ficar 1-3 reps da falha (RPE 7-9). Falha é mais aceitável em isolamentos.

---

## 5. Frequência

### Definição
Número de vezes que um grupo muscular é treinado por semana.

### Recomendações por Nível

| Nível | Frequência por grupo muscular/semana | Dias de treino/semana |
|-------|--------------------------------------|----------------------|
| Iniciante | 2-3x | 3 (full body) |
| Intermediário | 2-3x | 3-5 (upper/lower ou PPL) |
| Avançado | 2-4x | 4-6 (variado) |

### Regras de prescrição

1. **Mínimo 2x/semana:** Cada grupo muscular deve ser treinado pelo menos 2x por semana para otimizar hipertrofia e força.
2. **Distribuição de volume:** A frequência deve servir para **distribuir o volume semanal** de forma eficiente. Se o aluno precisa de 20 séries de peitoral/semana, é melhor 4 sessões de 5 séries do que 2 sessões de 10.
3. **Limite por sessão:** ~10 séries desafiadoras por grupo muscular por sessão é um teto prático. Se o volume necessário excede isso, aumentar frequência.
4. **Dias consecutivos:** Estudos mostram que treinar o mesmo grupo em dias consecutivos vs. alternados produz resultados similares. Porém, se for consecutivo, ajustar a intensidade na segunda sessão.
5. **Splits recomendados por dias disponíveis:**

| Dias/semana | Split recomendado |
|-------------|-------------------|
| 2 | Full body |
| 3 | Full body ou Upper/Lower/Full |
| 4 | Upper/Lower 2x |
| 5 | Upper/Lower + dia extra OU PPL + Upper/Lower |
| 6 | PPL 2x |

6. **Regra fundamental:** Frequência é uma ferramenta para distribuir volume, não um objetivo em si. Mais frequência sem mais volume total não necessariamente melhora resultados.

---

## 6. Progressão

### Princípio Central
**Sobrecarga progressiva** é o motor do progresso. O corpo precisa ser desafiado com estímulos crescentes ao longo do tempo para continuar a se adaptar.

### Modelos de Progressão por Nível

#### Iniciante — Progressão Linear (Single Progression)

- **Método:** Aumentar a carga a cada sessão mantendo as mesmas reps.
- **Incremento:** +2,5 kg (5 lb) para exercícios de membros superiores; +5 kg (10 lb) para agachamento e terra.
- **Quando estagna (2 sessões sem completar as reps):** Reduzir a carga em 10% e retomar a progressão.
- **Exemplo 5x5:**
  - Sessão 1: 60 kg — 5x5 (25 reps) → Aumentar
  - Sessão 2: 65 kg — 5x5 (25 reps) → Aumentar
  - Sessão 3: 70 kg — 5,5,5,5,3 (23 reps) → Manter carga
  - Sessão 4: 70 kg — 5x5 (25 reps) → Aumentar
  - ...
  - Sessão N: Falha 2x consecutivas → Deload 10%

#### Intermediário — Progressão Ondulatória (Wave Loading / Linear Periodization)

**Para compostos (linear periodization):**
- Semana 1: 3x8 @ peso X (RPE ~7)
- Semana 2: 3x7 @ peso X+2,5 kg (RPE ~8)
- Semana 3: 3x6 @ peso X+5 kg (RPE ~9)
- Semana 4: Deload (avaliar necessidade) ou reiniciar com 3x8 @ peso X+2,5 kg

**Para isolamentos (double progression):**
- Manter a mesma carga e adicionar reps até atingir o topo da faixa
- Exemplo com faixa 12-15 reps:
  - Semana 1: 3x12 @ 20 kg
  - Semana 2: 3x13 @ 20 kg
  - Semana 3: 3x14 @ 20 kg
  - Semana 4: Deload (2x12 @ 20 kg)
  - Semana 5: 3x15 @ 20 kg
  - Semana 6: 3x15 @ 20 kg → Atingiu topo → Aumentar carga
  - Semana 7: 3x12 @ 22,5 kg → Recomeçar ciclo

#### Avançado — Periodização por Blocos

**Bloco de Acumulação (~6 semanas):**
- Volume alto (12→22 séries/grupo/semana), intensidade moderada
- RPE 5-8, faixas de 6-12 ou 8-15 reps
- Aumentar volume em ~2 séries/grupo/semana a cada semana
- Aumentar frequência de 2x para 3x/semana na metade do bloco

**Bloco de Intensificação (~4 semanas):**
- Volume reduzido (22→12 séries/grupo/semana), intensidade alta
- RPE 8.5-10, faixas de 2-6 ou 3-8 reps
- Diminuir reps e aumentar carga semanalmente

**Bloco de Realização (~2 semanas):**
- Semana 1: Taper — reduzir volume para ~10 séries/grupo, manter intensidade (RPE 7-9)
- Semana 2: Teste — AMRAPs ou 1RM nos principais exercícios

### Regras de prescrição

1. **Iniciantes:** Usar single progression (aumentar carga mantendo reps). Simples e eficaz.
2. **Intermediários:** Usar wave loading para compostos e double progression para isolamentos.
3. **Avançados:** Usar periodização por blocos com fases de acumulação, intensificação e realização.
4. **Nunca pular níveis:** Não prescrever periodização por blocos para iniciantes.
5. **Auto-regulação:** Sempre considerar o RPE reportado para ajustar cargas. Se o aluno reporta RPE muito alto consistentemente, a progressão está rápida demais.

---

## 7. Periodização e Deload

### Modelos de Periodização

| Modelo | Descrição | Melhor para |
|--------|-----------|-------------|
| Linear | Volume diminui enquanto intensidade aumenta ao longo de semanas/meses | Intermediários, ciclos simples |
| Por Blocos | Macrociclo dividido em mesociclos com focos distintos (volume → intensidade → peak) | Avançados, competidores |
| Ondulatória Diária (DUP) | Variação de reps/intensidade a cada sessão na semana | Intermediários/avançados, 3+ dias |
| Ondulatória Semanal (WUP) | Cada semana tem um foco diferente | Similar ao DUP mas em escala semanal |

### DUP — Exemplo Prático (3 dias/semana)

| Dia | Foco | Reps | RPE |
|-----|------|------|-----|
| Dia 1 | Hipertrofia | 6-12 | 5-8 |
| Dia 2 | Potência/Técnica | 1-3 | 5-7 |
| Dia 3 | Força | 1-6 | 7-9 |

### Integração de Modelos
Os modelos não são mutuamente exclusivos. A melhor abordagem geralmente **integra elementos de todos**:
- DUP dentro de cada semana (variar reps por sessão)
- Linearidade ao longo de blocos (intensidade sobe, volume desce)
- Blocos com focos distintos (acumulação → intensificação → realização)

### Deload — Quando e Como

#### Checklist Pós-Bloco (determinar se precisa de deload)
Se **2 ou mais** respostas forem "sim", fazer deload:
- Está com pavor de ir à academia?
- Qualidade do sono pior que o normal?
- Cargas/reps diminuindo?
- Nível de estresse pior que o normal?
- Dores/desconfortos piores que o normal?

**Se 0-1 respostas "sim":** continuar para o próximo mesociclo sem deload.

**Regra de segurança:** Se passaram 3 mesociclos consecutivos sem deload, fazer um por precaução.

#### Como fazer Deload

| Nível | Método |
|-------|--------|
| Iniciante | Reduzir carga em 10%, manter séries e reps. Na sessão seguinte, retomar a carga pré-deload |
| Intermediário/Avançado | Reduzir volume em ~50% (cortar 1-2 séries por exercício), manter a carga similar, reduzir RPE em ~2 pontos |

**Exemplo concreto de deload intermediário:**
- Normal: 3x10x90 kg (RPE 8-9)
- Deload: 2x8x90 kg (RPE 6-7)

#### Transições entre Blocos
- **Bloco de Volume → Bloco de Intensidade:** Fazer deload entre eles para dissipar fadiga
- **Bloco de Intensidade → Bloco de Volume:** Fazer "intro week" (75% do volume planejado, RPE 1 ponto mais baixo)

### Tapering (para competidores)
- Iniciar 1-4 semanas antes da competição
- Reduzir volume em 1/3 a 2/3
- Manter ou diminuir intensidade levemente (max 10% redução)
- Manter frequência
- 1-2 dias antes: sessão "primer" leve (single @ RPE 4-5 nos principais)

---

## 8. Seleção de Exercícios

### Diretrizes por Objetivo

| Objetivo | Regra |
|----------|-------|
| Força (Powerlifter) | 50-75% do volume em exercícios de competição; 25-50% em acessórios |
| Hipertrofia (Bodybuilder) | 1-2 exercícios compostos por grupo muscular + 1-3 isolamentos |

### Tabela de Padrões de Movimento e Músculos

| Padrão de Movimento | Exercícios Exemplo | Músculos Primários | Músculos Secundários |
|---------------------|--------------------|--------------------|---------------------|
| Agachamento | Back squat, front squat, leg press, single leg | Quadríceps, Glúteos | Eretores (pesos livres) |
| Dobradiça de Quadril | Deadlift, RDL, good morning, back extension | Glúteos, Isquiotibiais, Eretores | Retratores escapulares |
| Puxada Vertical | Chin-ups, lat pulldown | Latíssimo, Bíceps | Deltoides posteriores |
| Empurrada Vertical | OHP, variações | Deltoides anteriores, Tríceps | Deltoides médios |
| Puxada Horizontal | Remadas (variações) | Latíssimo, Retratores escapulares | Deltoides post., Bíceps, Delt. médios |
| Empurrada Horizontal | Supino (plano, inclinado, declinado) | Peitoral, Deltoides anteriores | Tríceps, Deltoides médios (inclinado) |
| Extensão de Quadril Horizontal | Hip thrust, glute bridge | Glúteos | Isquiotibiais |
| Pull Over | DB pullover, lat pushdown | Latíssimo | Tríceps, Peitoral |
| Fly / Crucifixo | Cable crossover, DB flys | Peitoral | Deltoides anteriores |
| Isolamentos | Curl, extensão, elevação lateral, etc. | Músculo-alvo | N/A |

### Categorias para Força (Powerlifting)

| Categoria | Exercícios |
|-----------|-----------|
| Upper Body Push | Supino e variações (CGBP, board press), empurrada vertical e horizontal, tríceps |
| Upper Body Pull | Terra e variações (RDL, pause deadlift), puxada horizontal e vertical |
| Lower Body | Terra, agachamento e variações (front squat, safety bar), todos os acessórios de perna |

### Regras de prescrição

1. **Especificidade:** Os movimentos nos quais o aluno quer ficar forte devem dominar o programa.
2. **Familiaridade:** Movimentos desconhecidos são menos eficazes para hipertrofia até que o aluno se torne proficiente. Manter os compostos principais estáveis por múltiplos mesociclos.
3. **Variedade controlada:** Compostos principais permanecem fixos; isolamentos podem ser rotacionados a cada mesociclo.
4. **Eficiência:** Compostos treinam múltiplos grupos ao mesmo tempo. Devem ser a base. Isolamentos complementam para pontos fracos ou desenvolvimento uniforme.
5. **Ordem dos exercícios:** Compostos primeiro (quando fresco), isolamentos depois. Exceção: pré-fadiga de um ponto fraco específico se não prejudicar o composto.
6. **Amplitude de movimento:** Prescrever amplitude total (full ROM) como padrão. Parciais têm utilidade específica (trabalho de ponto fraco).
7. **Pontos fracos (hipertrofia):** Adicionar isolamentos específicos para grupos musculares subdesenvolvidos.
8. **Pontos fracos (força):** Usar variações do levantamento principal que "punem" o erro técnico (ex: front squat para quem inclina demais no agachamento).

### Para iniciantes
- Foco em compostos com barra (aprender os padrões motores).
- Limitar o número de exercícios (4-6 por sessão).
- Não se preocupar muito com isolamentos — hipertrofia global acontece com compostos nesse nível.

---

## 9. Períodos de Descanso

### Recomendações

| Tipo de Exercício | Descanso Entre Séries |
|-------------------|-----------------------|
| Exercícios compostos pesados (séries retas) | ≥ 2,5 minutos (idealmente 3-5 min) |
| Compostos em APS (antagonist paired sets) | ~2 minutos entre exercícios do par |
| Isolamentos (séries retas) | ≥ 1,5 minutos |
| Isolamentos em APS | ~1 minuto entre exercícios do par |

### Princípio fundamental
**Descansar até sentir-se pronto para performar bem na próxima série.** Descansos curtos forçados NÃO são superiores para hipertrofia — na verdade, podem prejudicar ao reduzir volume total e carga.

### Técnicas de economia de tempo

**Antagonist Paired Sets (APS):**
- Alternar entre exercícios de músculos opostos (ex: supino + remada)
- NÃO é superset (que treina o mesmo grupo)
- Pode manter ou melhorar performance
- Evitar em exercícios de corpo inteiro (agachamento, terra) que geram fadiga sistêmica
- Funciona melhor com isolamentos e compostos de membros superiores

**Drop Sets:**
- Fazer uma série até a falha, reduzir carga, continuar
- Eficaz para economia de tempo, mas difícil de quantificar progressão
- Relegar a exercícios acessórios/isolamentos

**Rest-Pause Sets:**
- Fazer uma série até falha, descansar 20-30s, fazer mais reps, repetir
- Mais rastreável que drop sets (mesma carga)
- Também relegar a acessórios

### Regras para a IA
- Prescrever descanso mínimo de 2,5 min para compostos pesados
- Prescrever 1,5 min para isolamentos
- Se o aluno tem tempo limitado, sugerir APS para exercícios compatíveis
- Drop sets e rest-pause apenas em acessórios, no final da sessão

---

## 10. Tempo de Execução

### Recomendação geral
O tempo de execução (velocidade da repetição) é a variável **menos importante** da pirâmide.

### Regras simples
- **Fase concêntrica:** Levantar o peso de forma controlada, com intenção de gerar força máxima (não precisa ser explosivo, mas também não intencionalmente lento).
- **Fase excêntrica:** Controlar a descida (2-3 segundos é adequado). Não deixar o peso cair.
- **Não prescrever tempos rígidos** (ex: 3-1-2-0) na maioria dos casos — isso adiciona complexidade desnecessária.
- **Exceção:** Tempo controlado pode ser útil para iniciantes aprendendo a forma, ou para exercícios específicos onde controle é crucial (ex: RDL, pause squat).

### Regra para a IA
- Não incluir prescrição de tempo específico por padrão
- Incluir nota de "controlar a excêntrica" para iniciantes
- Incluir tempos específicos apenas quando o treinador solicitar

---

## 11. Fluxograma de Decisão para Platô

```
O aluno está em platô?
├── NÃO → Não mudar nada, continuar o programa
└── SIM → Verificar fundamentos:
    ├── Sono 8+ horas?
    ├── Superávit calórico (se ganho de massa)?
    ├── Proteína ≥ 1,6 g/kg?
    ├── RPE está sendo estimado corretamente?
    ├── Treina cada grupo 2x+/semana?
    └── Técnica está sólida?
        │
        ├── ALGUM "NÃO" → Corrigir, rodar mais um mesociclo, reavaliar
        │
        └── TODOS "SIM" → Avaliar recuperação:
            ├── Pavor da academia?
            ├── Sono pior que normal?
            ├── Cargas/reps diminuindo?
            ├── Estresse maior que normal?
            └── Dores piores que normal?
                │
                ├── 0-1 "SIM" → Provavelmente está se recuperando
                │   └── Hora de AUMENTAR VOLUME
                │       ├── Platô em vários grupos? → +1-2 séries/grupo (≈10% aumento)
                │       ├── Platô em um exercício? → +1-2 séries desse exercício
                │       └── Verificar técnica / adicionar acessórios
                │
                └── 2+ "SIM" → Provavelmente NÃO está se recuperando
                    └── Fazer DELOAD (semana leve)
                        ├── Melhorou após deload? → Ótimo, continuar
                        └── Fadigou rapidamente de novo?
                            └── Reduzir volume sistematicamente (~20%)
```

---

## Resumo Rápido para Prescrição por IA

### Passo a passo para montar um programa:

1. **Definir disponibilidade** (dias/semana, duração da sessão)
2. **Definir objetivo** (hipertrofia, força, ou misto)
3. **Escolher split** baseado nos dias disponíveis (ver tabela de frequência)
4. **Definir volume semanal** por grupo muscular (ver tabela por nível)
5. **Distribuir volume** pelas sessões (máx ~10 séries/grupo/sessão)
6. **Selecionar exercícios** (compostos primeiro + isolamentos complementares)
7. **Definir faixas de reps** baseado no objetivo (ver tabela de intensidade)
8. **Definir RPE alvo** (maioria em 6-9, evitar falha em compostos)
9. **Definir modelo de progressão** baseado no nível do aluno
10. **Programar deloads** (a cada 3-6 semanas conforme necessidade, ou por checklist)
11. **Definir descanso** (2,5+ min compostos, 1,5+ min isolamentos)

### Tabela de Referência Rápida

| Variável | Iniciante | Intermediário | Avançado |
|----------|-----------|---------------|----------|
| Volume (séries/grupo/semana) | 10-15 | 15-20 | 15-25+ |
| Frequência (por grupo/semana) | 2-3x | 2-3x | 2-4x |
| Intensidade principal | Faixa única (5x5 ou 3x8-12) | Wave loading + double progression | DUP + blocos |
| Progressão | Sessão a sessão (+carga) | Semana a semana (onda) | Bloco a bloco (meses) |
| Deload | Reduzir 10% ao estagnar | A cada 3-6 semanas (checklist) | Integrado nos blocos |
| Exercícios | 4-6 compostos, poucos iso | Compostos + isolamentos | Periodizar seleção por bloco |
| Split típico | Full body 3x | Upper/Lower 4x | PPL, DUP 4-6x |
