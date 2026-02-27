# Análise de Aprimoramento do PRD — Prescrição Inteligente Kinevo

> Comparação entre o PRD v1.0 e o documento de lógica baseado em *The Muscle & Strength Pyramid*

---

## 1. Resumo Executivo

O PRD atual é um documento sólido de produto — bem estruturado em personas, fluxo, arquitetura e roadmap. Porém, ao compará-lo com o documento de lógica de prescrição (baseado no livro de Eric Helms), ficam evidentes **lacunas técnicas significativas** na camada metodológica. O PRD simplifica demais as regras que a IA precisará seguir, o que pode resultar em prescrições genéricas ou decisões erradas em cenários intermediários e avançados.

As lacunas se concentram em três áreas: (1) o modelo de intensidade está ausente, (2) os modelos de progressão estão incompletos, e (3) faltam regras operacionais para situações reais como platôs, deloads contextuais e seleção de exercícios por padrão de movimento.

---

## 2. Divergências de Valores entre os Documentos

### 2.1 Volume Semanal — Faixas Diferentes

| Nível | PRD Atual | Lógica (Pirâmide) | Impacto |
|-------|-----------|-------------------|---------|
| Iniciante | 10–12 séries | 10–15 séries | Faixa do PRD é mais conservadora — pode ser intencional, mas limita a margem de progressão dentro do mesmo nível |
| Intermediário | 12–15 séries | 15–20 séries | **Divergência significativa** — o PRD subtreina intermediários pela referência da pirâmide |
| Avançado | 15–20 séries | 15–25+ séries | PRD corta o teto em 20; a pirâmide permite até 25+ para avançados |

**Recomendação:** Decidir explicitamente se as faixas do PRD são uma adaptação intencional da metodologia Kinevo (mais conservadora que a pirâmide) ou um erro de transcrição. Se intencional, documentar a justificativa. Se não, alinhar com os valores da pirâmide.

### 2.2 Splits por Frequência — Pequenas Diferenças

| Dias | PRD | Lógica | Observação |
|------|-----|--------|------------|
| 2 dias | Full Body A/B | Full Body | Alinhados |
| 3 dias | Full Body A/B/C | Full Body ou Upper/Lower/Full | Lógica oferece mais opções |
| 5 dias | PPL + 2 complementares | Upper/Lower + extra OU PPL + U/L | Lógica é mais flexível |
| 6 dias | Upper/Lower alternado ou PPL | PPL 2x | Lógica é mais direta |

**Recomendação:** Incorporar as opções adicionais da pirâmide como alternativas que a IA pode considerar dependendo do perfil do aluno.

---

## 3. Lacunas Críticas — O que Falta no PRD

### 3.1 Framework de Intensidade (Ausente)

O PRD menciona "faixa de repetições" uma vez na anamnese, mas **não documenta nenhuma regra de intensidade**. O documento de lógica traz um framework completo que a IA precisa para prescrever corretamente:

**O que está faltando:**

- Tabela de faixas de repetições por objetivo (força: 1–6, hipertrofia: 6–12, resistência: 15–20+)
- Escala RPE/RIR completa (como medir proximidade da falha)
- Regra dos 2/3: a maioria do volume deve estar na faixa principal do objetivo
- Regra de evitar falha em compostos (RPE 7–9, reservar falha para isolamentos)
- Distribuição de intensidade ao longo da semana (dia pesado/moderado/leve)

**Por que é crítico:** Sem regras de intensidade, a IA pode prescrever todas as séries na mesma faixa de repetições, ignorar RPE, ou colocar o aluno perto da falha em exercícios compostos pesados — cenário de risco de lesão.

**Sugestão de seção nova no PRD:**

> **2.X Intensidade e Esforço**
>
> A prescrição deve considerar duas dimensões de intensidade: a carga relativa (%1RM traduzida em faixa de repetições) e o esforço percebido (RPE/RIR). A IA deve distribuir aproximadamente 2/3 do volume na faixa principal do objetivo do aluno e o restante em faixas adjacentes. Em exercícios compostos, o RPE alvo deve ficar entre 7–9 (1–3 repetições da falha). Falha muscular é aceitável apenas em isolamentos e nunca na primeira semana de um bloco.

### 3.2 Modelos de Progressão por Nível (Incompleto)

O PRD documenta apenas a periodização linear de 4 semanas. O documento de lógica traz **três modelos distintos** que a IA precisa dominar:

| Nível | PRD Atual | O que Falta (da Pirâmide) |
|-------|-----------|---------------------------|
| Iniciante | Periodização linear genérica | **Single Progression** — aumentar carga sessão a sessão (+2,5kg superior, +5kg inferior), com regra de reset ao estagnar 2x |
| Intermediário | Mesmo modelo linear | **Wave Loading** para compostos (3x8→3x7→3x6 com carga crescente) + **Double Progression** para isolamentos (manter carga, subir reps até topo da faixa, depois aumentar carga) |
| Avançado | Mesmo modelo linear | **Periodização por Blocos** — Acumulação (~6 sem, volume alto) → Intensificação (~4 sem, carga alta) → Realização (~2 sem, taper + teste) |

**Por que é crítico:** Usar o mesmo modelo de progressão para todos os níveis é o erro mais comum em apps de treino genéricos. É exatamente o que o Kinevo deveria evitar para se diferenciar.

**Sugestão:** Expandir a seção 2.4 do PRD em três subseções, uma por nível, com regras operacionais claras para a IA.

### 3.3 Conceitos de Volume (MEV/MAV/MRV)

O PRD fala em "limite inferior e superior da faixa", mas não nomeia os conceitos técnicos que guiam essas decisões. O documento de lógica define quatro marcos de volume:

- **MV** (Maintenance Volume) — mínimo para manter, usado em deloads
- **MEV** (Minimum Effective Volume) — mínimo para progredir, ponto de partida
- **MAV** (Maximum Adaptive Volume) — faixa ótima, alvo na maioria dos blocos
- **MRV** (Maximum Recoverable Volume) — teto, ultrapassar = overtraining

**Recomendação:** Incorporar esses conceitos no PRD, mesmo que de forma simplificada. A IA precisa saber que "volume inicial = MEV" e "volume máximo do nível = próximo ao MRV", e que o deload reduz para próximo do MV. Sem essa nomenclatura, as regras ficam ambíguas.

### 3.4 Seleção de Exercícios por Padrão de Movimento (Ausente)

O PRD lista um "algoritmo de seleção" com 6 passos genéricos. O documento de lógica traz uma **tabela completa de padrões de movimento** que a IA deveria usar como framework:

- Agachamento → Quadríceps, Glúteos
- Dobradiça de Quadril → Glúteos, Isquiotibiais, Eretores
- Puxada Vertical → Latíssimo, Bíceps
- Empurrada Vertical → Deltoides, Tríceps
- Puxada Horizontal → Latíssimo, Retratores
- Empurrada Horizontal → Peitoral, Deltoides
- Extensão de Quadril Horizontal → Glúteos
- Isolamentos diversos

**Por que é crítico:** Sem essa categorização, a IA pode prescrever dois exercícios de empurrada horizontal e nenhum de puxada, criando desbalanceamento muscular. A tabela de padrões de movimento é a estrutura que garante equilíbrio no programa.

**Sugestão:** Adicionar a tabela de padrões de movimento ao PRD e incluir uma regra: "todo dia de treino deve cobrir padrões de movimento complementares (push/pull, joelho-dominante/quadril-dominante)".

### 3.5 Períodos de Descanso (Ausente)

O PRD menciona "descanso" como campo editável nos cards de exercício, mas **não define nenhuma regra**. O documento de lógica traz guidelines específicos:

- Compostos pesados: ≥ 2,5 min (ideal 3–5 min)
- Isolamentos: ≥ 1,5 min
- Com APS (Antagonist Paired Sets): ~2 min entre pares
- Princípio: descansar o suficiente para performar bem na próxima série

**Recomendação:** Adicionar uma subseção de períodos de descanso com valores padrão que a IA usa ao gerar o programa. Também incluir a técnica de APS como opção para alunos com tempo limitado.

### 3.6 Fluxograma de Decisão para Platô (Ausente)

O PRD menciona "detecção de platô" na Fase 3 do roadmap como "alerta ao treinador quando aluno estagna por 3+ semanas", mas não documenta **o que a IA deve sugerir**. O documento de lógica traz um fluxograma completo:

1. Verificar fundamentos (sono, nutrição, proteína, técnica, frequência)
2. Se algum fundamento falha → corrigir antes de mudar programa
3. Se fundamentos OK → avaliar sinais de fadiga (checklist de 5 perguntas)
4. 0–1 sinais → provavelmente se recuperando → aumentar volume (+10%)
5. 2+ sinais → provavelmente não se recuperando → fazer deload
6. Se fadigou novamente rápido após deload → reduzir volume sistematicamente (–20%)

**Recomendação:** Incorporar esse fluxograma ao PRD como a lógica que a IA segue ao detectar platô. Transformar em regras de decisão que o motor de TypeScript pode implementar.

### 3.7 Deload — Métodos Diferenciados por Nível (Parcialmente Presente)

O PRD define deload como "reduz 20% do volume na semana 4". O documento de lógica diferencia:

- **Iniciante:** Reduzir carga em 10%, manter séries e reps
- **Intermediário/Avançado:** Reduzir volume em ~50%, manter carga, reduzir RPE em ~2 pontos
- **Checklist de necessidade:** Fazer deload se 2+ de 5 sinais de fadiga estiverem presentes; pular se 0–1
- **Regra de segurança:** Se passaram 3 mesociclos sem deload, fazer um por precaução

**Recomendação:** Substituir a regra fixa "–20% na semana 4" por uma lógica condicional baseada no checklist de fadiga, com métodos diferenciados por nível.

### 3.8 Modelos de Periodização Avançados (Ausente)

O PRD só documenta periodização linear. O documento de lógica cobre quatro modelos:

- Linear (já presente)
- Por Blocos (acumulação → intensificação → realização)
- Ondulatória Diária (DUP) — variar reps/intensidade a cada sessão
- Ondulatória Semanal (WUP) — cada semana com foco diferente

**Recomendação:** No mínimo, adicionar DUP como opção para intermediários com 3+ dias de treino, e periodização por blocos para avançados. Esses modelos são o que diferencia prescrição profissional de app genérico.

---

## 4. Aprimoramentos Menores (Qualidade)

### 4.1 Regra de Máximo de Volume por Sessão

O documento de lógica estabelece um teto de ~10 séries por grupo muscular por sessão. O PRD não menciona esse limite. Incluir essa regra evita que a IA concentre todo o volume semanal em uma única sessão.

### 4.2 Tempo de Execução

O documento de lógica recomenda não prescrever tempos específicos (ex: 3-1-2-0) por padrão, apenas "controlar a excêntrica" para iniciantes. Vale incluir como regra para a IA: não adicionar tempo de execução a menos que o treinador peça.

### 4.3 Técnicas de Economia de Tempo

O documento de lógica documenta APS (Antagonist Paired Sets), Drop Sets e Rest-Pause Sets como ferramentas para sessões mais curtas. O PRD poderia incorporar isso como opção quando o aluno tem sessões de duração limitada.

### 4.4 Contagem de Volume Efetivo

O documento de lógica especifica que só contam "séries desafiadoras" (RPE 5+). Séries de aquecimento não entram na contagem. Essa regra precisa estar no PRD para que a IA calcule volume corretamente.

### 4.5 Regra de Frequência Mínima

O documento de lógica estabelece: cada grupo muscular deve ser treinado pelo menos 2x por semana. Incluir como restrição absoluta no PRD (seção 2.5).

---

## 5. Estrutura Sugerida para o PRD v2.0

Abaixo, a estrutura proposta com as seções novas marcadas:

1. Visão Geral e Problema a Resolver *(manter)*
2. A Metodologia Kinevo *(expandir significativamente)*
   - 2.1 Princípio Máximo: Aderência *(manter)*
   - 2.2 Volume por Nível + Conceitos MEV/MAV/MRV **(expandir)**
   - **2.3 Intensidade e Esforço (NOVA)**
   - 2.4 Frequência e Splits *(expandir com opções adicionais)*
   - **2.5 Seleção de Exercícios por Padrão de Movimento (NOVA)**
   - **2.6 Períodos de Descanso (NOVA)**
   - **2.7 Progressão por Nível — 3 Modelos (EXPANDIR)**
   - **2.8 Periodização — Linear, DUP, Blocos (EXPANDIR)**
   - **2.9 Deload Condicional com Checklist de Fadiga (EXPANDIR)**
   - **2.10 Fluxograma de Decisão para Platô (NOVA)**
   - 2.11 Restrições Absolutas da IA *(expandir com novas regras)*
3. Fluxo de Prescrição Adaptativo *(manter)*
4. Funcionalidades Detalhadas *(manter + adicionar APS/técnicas avançadas)*
5. Requisitos Técnicos *(manter)*
6. Métricas de Sucesso *(manter)*
7. Roadmap *(manter)*
8. Vantagem Competitiva *(manter)*

---

## 6. Priorização das Mudanças

| Prioridade | Mudança | Justificativa |
|------------|---------|---------------|
| **P0 — Crítica** | Adicionar framework de intensidade (RPE/RIR + faixas) | Sem isso, a IA não tem como calibrar esforço — risco de lesão |
| **P0 — Crítica** | Diferenciar progressão por nível (3 modelos) | Usar mesmo modelo para todos os níveis anula a proposta de personalização |
| **P0 — Crítica** | Resolver divergência de faixas de volume | IA precisa de valores definitivos para operar |
| **P1 — Alta** | Adicionar padrões de movimento para seleção de exercícios | Garante equilíbrio muscular no programa gerado |
| **P1 — Alta** | Expandir lógica de deload (condicional + por nível) | Deload fixo na semana 4 é simplista demais |
| **P1 — Alta** | Adicionar fluxograma de platô | Fase 3 do roadmap depende dessa lógica |
| **P2 — Média** | Adicionar períodos de descanso padrão | Melhora qualidade da prescrição gerada |
| **P2 — Média** | Adicionar DUP como opção de periodização | Diferencial para intermediários/avançados |
| **P3 — Baixa** | Técnicas de economia de tempo (APS, drop sets) | Nice-to-have para sessões curtas |
| **P3 — Baixa** | Regra de tempo de execução | Variável de menor impacto na pirâmide |

---

*Análise produzida em Fevereiro 2026 — Kinevo | Confidencial*
