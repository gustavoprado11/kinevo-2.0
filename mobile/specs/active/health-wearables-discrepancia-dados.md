# Correção de discrepância nos dados de wearables (saúde do aluno)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

Alunos relatam **discrepância significativa** entre os números de saúde exibidos no Kinevo e os que veem nos apps nativos (Apple Saúde / Health Connect / wearable). A investigação no código (`lib/healthSync/`, `hooks/useHealthDashboard.ts`) identificou **6 causas técnicas concretas**, em ordem de impacto. A maior delas — contagem dupla de passos/calorias/distância — sozinha provavelmente responde pela maior parte da percepção de erro.

A arquitetura atual é sólida (funções puras reusáveis em foreground/background, fix de timezone já aplicado, permissões granulares, retry com backoff). O problema **não é estrutural** — são correções cirúrgicas na camada de agregação e apresentação.

## Objetivo

Fazer os números de saúde do Kinevo baterem (dentro de tolerância razoável) com os apps nativos de saúde, eliminando contagem dupla, métricas incompatíveis e defasagem de dados.

## Escopo

### Incluído
- Causa #1 — deduplicação de passos/calorias/distância (iOS + Android)
- Causa #2 — separar/normalizar HRV (SDNN iOS vs RMSSD Android)
- Causa #3 — FC de repouso via valor representativo (não média cega)
- Causa #4 — frescor do dado "hoje" (sync no foco + timestamp na UI)
- Causa #5 — sono: evitar soma de segmentos sobrepostos
- Causa #6 — seleção/prioridade de fonte de dispositivo

### Excluído
- Reescrita da engine de readiness ou de insights (apenas ajustes mínimos onde HRV é consumido)
- Mudança no caminho do Apple Watch durante o treino (`workout_health_samples`) — já confiável
- Novas integrações de wearable (Garmin, Whoop, etc.)
- Mudança de schema destrutiva (toda migration deve ser backward-compat)

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `lib/healthSync/healthKitSync.ts` | Trocar soma bruta por statistics queries (passos/cal/dist), `discreteAverage` p/ FC, ajuste HRV |
| `lib/healthSync/healthConnectSync.ts` | Usar agregação/prioridade de origem (passos/cal/dist), ajuste HRV (RMSSD) |
| `lib/healthSync/shared.ts` | Possível helper de fonte/origem; tipos de HRV metric |
| `hooks/useHealthDashboard.ts` | Expor `last_sync_at`/frescor; tratar "hoje parcial" |
| `hooks/useHealthKitSync.ts` / `useHealthConnectSync.ts` | Disparar sync incremental ao focar aba de saúde |
| `app/(tabs)/health.tsx` | Mostrar timestamp de última sincronização + label de dado parcial |
| `lib/readiness.ts` / `lib/healthInsights/*` | Investigar — separar baseline de HRV por fonte/métrica |
| `@kinevo/shared/types/*` | Campo opcional de `hrv_metric` ('sdnn' \| 'rmssd') se formos persistir |
| Migration Supabase | Coluna opcional `hrv_metric` em `hrv_samples` (nullable, backward-compat) |

## Comportamento Esperado

Após a implementação, os totais diários de passos/calorias/distância do Kinevo devem coincidir com o app Saúde nativo (que já deduplica), o HRV deve ser apresentado de forma honesta por métrica/fonte, e o dado de "hoje" deve refletir o estado atual do dispositivo (ou indicar claramente que está parcial/defasado).

---

## As 6 causas — análise, plano e risco

### 🔴 Causa #1 — Contagem dupla de passos/calorias/distância

**Diagnóstico.** `aggregateQuantitySamplesByDay` (`healthKitSync.ts:116-123`) soma TODAS as amostras de `queryQuantitySamples`. HealthKit guarda amostras sobrepostas de iPhone + Apple Watch + apps terceiros. O app Saúde mostra total **deduplicado** (algoritmo de prioridade/merge da Apple); somar bruto conta o mesmo passo 2-3x. No Android, somar `Steps` brutos (`healthConnectSync.ts:277-279`) duplica entre apps.

**Plano.**
- iOS: substituir `queryQuantitySamples` + soma por **`queryStatisticsCollectionForQuantity(identifier, ['cumulativeSum'], anchorDate, { day: 1 }, options)`** para `StepCount`, `ActiveEnergyBurned`, `DistanceWalkingRunning`. Usa `HKStatisticsCollectionQuery` → deduplica entre fontes nativamente. `anchorDate` alinhado à meia-noite local (consistente com `toDateOnlyISO`).
- Android: usar API de agregação do `react-native-health-connect` (`aggregateGroupByPeriod` / `aggregateRecord`) que respeita prioridade de origem de dados, em vez de somar registros brutos.

**Confirmado.** A v14 do kingstinct instalada exporta `queryStatisticsForQuantity` e `queryStatisticsCollectionForQuantity` (+ variantes `SeparateBySource`).

**Risco: Médio.**
- Mudança no core do sync; precisa testar device real (iPhone só, iPhone+Watch, com app terceiro instalado).
- `intervalComponents` e fuso: garantir que o bucket diário casa com `toDateOnlyISO` (local), não UTC.
- Verificar unidade retornada (passar `unit` explícito nas options).
- Retrocompat: schema de `daily_activity_samples` não muda; só o valor calculado fica correto. Dados históricos já gravados ficam inflados até o próximo re-sync (rodar `syncHistorical(30)` corrige a janela).

**Impacto esperado: Alto** (provavelmente ~80% da discrepância percebida).

---

### 🔴 Causa #2 — HRV mistura SDNN (iOS) e RMSSD (Android)

**Diagnóstico.** iOS lê `HeartRateVariabilitySDNN`, Android lê `HeartRateVariabilityRmssd`; ambos vão para `hrv_samples.value_ms` e são comparados igualmente em baseline/readiness/insights. **SDNN e RMSSD não são comparáveis** (faixas e fenômenos fisiológicos diferentes). Além disso o app faz média no dia (`averageQuantityByDay`), enquanto o Saúde mostra leituras discretas → número nunca bate.

**Plano.**
- Persistir a métrica de origem: coluna nullable `hrv_metric` ('sdnn' | 'rmssd') em `hrv_samples` (migration backward-compat). Default = inferir pela `source`.
- Não comparar baselines entre métricas: baseline de HRV por (student, métrica) ou por fonte.
- Rever agregação diária: usar `discreteAverage`/leitura mais recente em vez de média cega de todas as amostras.
- UI: rotular a métrica exibida ("HRV (SDNN)") e a fonte.

**Risco: Médio.**
- Toca readiness/insights (consumidores de HRV) — escopo precisa ficar mínimo e retrocompat.
- Migration de schema (nullable → seguro). Backfill opcional inferindo por `source`.
- Aluno que troca de plataforma terá série com 2 métricas — UI/baseline precisa lidar.

**Impacto esperado: Médio** (afeta confiança no readiness, não os números "grandes").

---

### 🟠 Causa #3 — FC de repouso por média de amostras

**Diagnóstico.** `averageQuantityByDay` (`healthKitSync.ts:125-139`) faz média de todas as leituras de resting HR do dia. A Apple expõe um valor diário representativo; média de múltiplas fontes/leituras diverge.

**Plano.**
- iOS: usar `queryStatisticsForQuantity(['discreteAverage'])` (deduplicado por fonte) ou a leitura mais recente do dia.
- Android: `RestingHeartRate` costuma ter poucas leituras; manter, mas filtrar por prioridade de origem se houver múltiplas fontes.

**Risco: Baixo.**
- Mudança isolada; resting HR alimenta o baseline do readiness (`shared.ts:73`) — verificar que continua coerente.
- Sem mudança de schema.

**Impacto esperado: Baixo-Médio.**

---

### 🟠 Causa #4 — Dado "hoje" parcial + sync defasado até 12h

**Diagnóstico.** Background sync roda a cada 12h (`healthSyncTask.ts`); ao abrir o app o número pode estar horas velho. "Passos hoje" é sempre parcial (dia acumulando) → sempre menor que o Saúde aberto ao vivo. O aluno compara Kinevo (defasado/parcial) com nativo (ao vivo) e vê "erro" mesmo sem bug.

**Plano.**
- Disparar `syncIncremental()` ao focar a aba de saúde (`useFocusEffect`) com debounce.
- Exibir "Atualizado há X" usando `wearable_connections.last_sync_at` (já disponível em `useHealthDashboard`).
- (Opcional, fase 2) iOS: `HKObserverQuery` + background delivery (`enableBackgroundDelivery`) para sync near-real-time.

**Risco: Baixo.**
- UX e disparo de sync; sem lógica de cálculo nem schema.
- Observer query (opcional) exige entitlement de background delivery e teste em device.

**Impacto esperado: Médio** (mata a percepção de discrepância em "hoje").

---

### 🟡 Causa #5 — Sono: soma de segmentos potencialmente sobrepostos

**Diagnóstico.** `aggregateSleep` soma duração de todas as fases; fontes sobrepostas ou cochilos no mesmo dia inflam. Fallback de eficiência (`healthKitSync.ts:103`) é heurística que pode divergir do "Tempo dormindo" da Apple.

**Plano.**
- iOS: deduplicar por fonte/intervalo antes de somar (preferir fonte única — Apple Watch — ou mesclar intervalos sem sobreposição).
- Validar definição de "duração" contra o "Tempo dormindo" do Saúde (asleep core+deep+rem).
- Manter `raw` para auditoria.

**Risco: Médio.**
- Lógica de merge de intervalos é sutil (evitar regressão na eficiência/fases).
- Sem mudança de schema.

**Impacto esperado: Médio** (sono é métrica visível e sensível).

---

### 🟡 Causa #6 — Sem seleção/prioridade de fonte de dispositivo

**Diagnóstico.** Não há "fonte de verdade" (priorizar Watch vs iPhone, ou deixar o aluno escolher). Sem isso, fontes redundantes contribuem para #1, #3 e #5.

**Plano.**
- Usar `querySources` / `queryStatisticsForQuantitySeparateBySource` para inspecionar fontes.
- Definir prioridade padrão (Watch > iPhone > terceiros) — em grande parte já resolvido ao adotar as statistics queries de #1/#3.
- (Opcional) toggle de fonte preferida em `app/profile/connections.tsx`.

**Risco: Baixo-Médio.**
- Em boa medida absorvido por #1 e #3 (statistics queries já deduplicam corretamente).
- Toggle de UI é incremento opcional.

**Impacto esperado: Baixo** (isolado), **mas habilitador** das outras correções.

---

## Ordem de execução recomendada

1. **#1** (maior retorno, correção cirúrgica) → valida com device real iPhone+Watch.
2. **#4** (UX de frescor + sync no foco — barato, alto efeito percebido).
3. **#3** (rápido, mesma família de statistics queries de #1).
4. **#2** (precisa migration + cuidado com readiness/insights).
5. **#5** (lógica de merge de sono).
6. **#6** (incremento, em parte já coberto).

Sugestão: **fases #1+#3+#4 num primeiro batch** (sem mudança de schema, alto impacto), depois **#2+#5** num segundo batch.

## Critérios de Aceite
- [ ] Passos/calorias/distância do dia batem com o app Saúde nativo (iPhone só e iPhone+Watch), tolerância pequena
- [ ] HRV exibido com métrica/fonte corretas; baselines não misturam SDNN com RMSSD
- [ ] FC repouso coincide com valor diário do nativo
- [ ] Aba de saúde sincroniza ao focar e mostra "atualizado há X"
- [ ] Sono não infla por sobreposição de fontes
- [ ] Sem novos erros de TypeScript (`tsc --noEmit` limpo)
- [ ] Retrocompatível; migrations backward-compat
- [ ] Testado em device real (HealthKit não funciona pleno no simulador; Watch nunca no simulador)

## Restrições Técnicas
- Seguir CLAUDE.md: zero `any` novo, mudanças cirúrgicas, retrocompat obrigatória.
- Funções de sync permanecem **puras** (chamadas de TaskManager, sem hooks).
- Buckets diários sempre em **hora local** (`toDateOnlyISO`), nunca UTC.
- Migrations apenas aditivas/nullable.
- Não tocar no caminho do Watch durante treino (`workout_health_samples`).

## Edge Cases
- Usuário só com iPhone (sem Watch): statistics query deve devolver os mesmos passos do Saúde.
- Usuário com app terceiro gravando passos: não deve mais somar em dobro.
- Sem HRV (sem Watch): HRV vazio, não erro (já tratado).
- Troca de plataforma (iOS→Android): série de HRV com 2 métricas — baseline separado.
- Dia parcial ("hoje"): exibir como parcial, não como discrepância.
- Fuso horário negativo (UTC-3): bucket diário não pode vazar pro dia seguinte.
- Re-sync histórico sobrescreve dados inflados antigos (upsert por `student_id,sample_date`).

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] Agregação por fonte/dedup: dado um conjunto de amostras sobrepostas de 2 fontes, total = valor deduplicado esperado.
- [ ] Bucket diário em UTC-3 não vaza pro dia seguinte (regressão do fix de timezone).
- [ ] Merge de intervalos de sono sem sobreposição (#5).
- [ ] Seleção de métrica de HRV por fonte (#2).
- [ ] `lib/readiness.ts` continua coerente com baseline de FC ajustado (#3).

### Server Actions / Queries (escrita no banco — recomendado)
- [ ] `syncHealthKit` / `syncHealthConnect` com Supabase mockado: upsert grava valor deduplicado nas tabelas corretas.

### Componentes
- [ ] (Opcional) `app/(tabs)/health.tsx`: renderiza "atualizado há X" e label de parcial.

## Referências
- Apple — [HKStatisticsCollectionQuery](https://developer.apple.com/documentation/healthkit/hkstatisticscollectionquery), [stepCount](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/stepcount)
- [kingstinct/react-native-healthkit](https://github.com/kingstinct/react-native-healthkit) (v14 instalada exporta `queryStatisticsCollectionForQuantity`)
- HRV SDNN vs RMSSD: [Empirical Health](https://www.empirical.health/blog/how-wearables-measure-hrv/), [Ultrahuman](https://blog.ultrahuman.com/blog/rmssd-vs-sdnn-hrv-metrics-explained/)
- Código atual: `lib/healthSync/healthKitSync.ts`, `lib/healthSync/healthConnectSync.ts`, `lib/healthSync/shared.ts`, `hooks/useHealthDashboard.ts`, `lib/healthSyncTask.ts`

## Notas de Implementação

### Batch 1 — implementado (2026-05-21)

Cobre causas #1, #3 e #4. Sem mudança de schema.

**#1 + #3 iOS — `lib/healthSync/healthKitSync.ts`**
- Novo helper `queryDailyStatistic()` usando `queryStatisticsCollectionForQuantity` (anchor à meia-noite local, intervalo `{ day: 1 }`). Deduplica entre fontes via `HKStatisticsCollectionQuery`, espelhando o app Saúde.
- Passos/calorias/distância: `cumulativeSum` (antes: soma de samples brutos = contagem dupla).
- FC repouso: `discreteAverage` (antes: média cega de todas as amostras).
- Removido `aggregateQuantitySamplesByDay`. HRV segue inalterado (Batch 2).

**#1 + #3 Android — `lib/healthSync/healthConnectSync.ts`**
- Passos/cal/dist/FC via `aggregateGroupByPeriod` (`{ period: 'DAYS', length: 1 }`), que respeita prioridade de origem (dedup entre apps). Antes: `readRecords` + soma manual.
- Helper `toLocalDateTimeNoTZ()` — agregação por período exige TimeRangeFilter em hora local (sem `Z`). Filtro ancorado à meia-noite local.
- Unidades já normalizadas pela lib (`inKilocalories`, `inMeters`). Removidos imports de record types não usados; adicionado `AggregationGroupResult`.

**#4 Frescor — `app/(tabs)/health.tsx`**
- `useFocusEffect` dispara `syncIncremental` ao focar a aba (debounce 5min, silencioso).
- Header mostra "Atualizado há X" / "Atualizando…" (helper `formatRelativeTime`, reusa `lastSyncAt`).
- Nota de rodapé explicando que dados de hoje são parciais e batem após a sync.

**Validação**
- `tsc --noEmit`: 0 erros novos (12 pré-existentes, em arquivos não relacionados).
- `vitest run`: 277/277 passando.
- ⚠️ Pendente teste em **device real** (HealthKit/Health Connect não funcionam pleno em simulador): conferir passos/cal/dist iguais ao app nativo em (a) iPhone só e (b) iPhone+Apple Watch.

### Batch 2 — implementado (2026-05-21)

Cobre causas #2 e #5. **Sem migration** (ver decisão abaixo).

**Decisão — #2 sem coluna nova:** o spec previa adicionar `hrv_metric`. Na implementação, `hrv_samples.source` ('healthkit'/'health_connect') já identifica unicamente a métrica (SDNN/RMSSD), então derivamos via `lib/hrv.ts::hrvMetricFromSource`. Mais cirúrgico, backward-compat por definição, zero risco de migration/backfill.

**#5 Sono — `lib/healthSync/shared.ts` + ambos os syncs**
- Novo helper puro `mergedMinutes(intervals)` + tipo `TimeInterval`: mescla intervalos sobrepostos e conta cada minuto uma vez. Resolve contagem dupla quando >1 fonte grava a mesma noite (Apple Watch + AutoSleep/Pillow) e lida com cochilos.
- `aggregateSleep` (iOS) e `aggregateSleepSessions` (Android) reescritos: coletam intervalos por fase e aplicam `mergedMinutes`. `duration` = cobertura mesclada de todas as fases de sono; eficiência usa inBed/sessão mesclada como denominador.
- Type-safe: usa só `start`/`end` (o tipo `CategorySample` retornado não expõe `sourceRevision`, então merge por intervalo é a abordagem correta).

**#2 HRV — `lib/hrv.ts` (novo) + consumidores**
- `hrvMetricFromSource` / `hrvMetricLabel` + tipo `HrvMetric`.
- `useHealthDashboard`: baseline só agrega a mesma métrica do valor de hoje; expõe `hrvMetric`.
- `app/health/[metric].tsx`: série + baseline filtrados pela métrica do registro mais recente; título/eyebrow rotulados ("HRV (SDNN)").
- `useHealthInsights`: filtra HRV pra métrica dominante antes das regras (não corrompe baseline de hrv_drop/hrv_streak).
- `app/(tabs)/health.tsx`: card "HRV" mostra a métrica (ex.: "HRV SDNN").

**Validação Batch 2**
- `tsc --noEmit`: 0 erros novos.
- `vitest run`: 291/291 (14 novos testes: `mergedMinutes`, `hrvMetricFromSource/Label`).
- ⚠️ Teste em **device real** pendente (junto com Batch 1): conferir duração de sono não inflada com fonte dupla, e rótulo de métrica HRV correto por plataforma.

### Pendente
- #6 (prioridade de fonte) majoritariamente coberto por #1/#3; toggle de fonte preferida fica como incremento futuro opcional.
- Validação end-to-end em device real (iOS + Android) antes do push.
