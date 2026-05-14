# Plano de Implementação — Feedbacks de Usuário (Abril/2026)

> **Origem:** feedback presencial recebido em 24/04/2026 de um treinador usuário do Kinevo.
> **Objetivo deste documento:** diagnosticar o estado atual do código, comparar com o mercado, e propor um roadmap priorizado por impacto × esforço — sem alterar o código nesta etapa.
> **Autor:** análise técnica + benchmark.

---

## 1. Sumário executivo

| # | Feedback | Estado atual no código | Esforço | Impacto | Prioridade |
|---|---|---|---|---|---|
| 1 | Prescrição de reps/descanso diferentes por série (pirâmide) | **Não suportado** — `assigned_workout_items` armazena `sets/reps/rest_seconds` agregados | M | Alto | **P0** |
| 2 | App mobile mais visual para o aluno (vídeo na sala de treino) | Parcial — vídeo já existe em modal; UX já tem confete + timer circular; falta vídeo inline e mapa muscular | M | Alto | **P1** |
| 3 | Avaliação física presencial (dobras cutâneas) | **Não existe** — métricas hoje são extraídas de respostas de formulários (`weight_kg`, `body_fat_percentage` como texto livre) | G | Alto | **P1** |
| 4 | Vídeos padronizados dos exercícios | Parcial — `exercises.video_url` existe, mas biblioteca esparsa; cada PT traz seu vídeo (`trainer_exercise_videos`) | G | Médio-Alto | **P2** |

**Recomendação de sequenciamento (3 sprints de 2 semanas):**

- **Sprint 1 (P0 — pirâmide):** modelagem por série + UI de prescrição + execução. Item técnico mais barato, destrava o uso por treinadores avançados, é diferencial competitivo claro.
- **Sprint 2 (P1 — avaliação física):** módulo dedicado de antropometria com protocolos de dobras. Maior trabalho, mas é tabela de tabela em apps BR (Pacto, Tecnofit) e ausente no Kinevo — fechar essa lacuna sustenta retenção.
- **Sprint 3 (P1 — sala de treino visual):** vídeo inline, mapa muscular, microanimações. Pode rodar em paralelo ao Sprint 2 com designer/front dedicado.
- **Sprint 4-5 (P2 — biblioteca de vídeos padronizados):** projeto de conteúdo + infraestrutura de CDN. É um esforço contínuo (centenas de exercícios). Começar com lote curado dos 80 exercícios mais usados.

---

## 2. Diagnóstico técnico do código atual

### 2.1 Stack relevante

- **Web (trainer):** Next.js 16, React 19, Supabase SSR, Tailwind v4, motor de prescrição IA em `web/src/lib/prescription/` (~15K LOC, 26 arquivos).
- **Mobile (aluno + trainer):** Expo 54, React Native 0.81.5, Expo Router 6, NativeWind, Zustand, Supabase JS, Reanimated, MMKV.
- **Backend:** Supabase (Postgres + RLS + Realtime + Storage + Edge Functions). 110 migrations na branch.
- **Compartilhado:** workspace `shared/` com tipos auto-gerados do banco.

### 2.2 Modelagem atual de prescrição (relevante para feedback #1)

Tabelas envolvidas:

```sql
workout_item_templates (
  id, workout_template_id, parent_item_id, item_type,
  exercise_id, sets INTEGER, reps TEXT, rest_seconds INTEGER, notes
)

assigned_workout_items (
  id, assigned_workout_id, parent_item_id, item_type,
  exercise_id, exercise_name, exercise_muscle_group,
  sets INTEGER, reps TEXT, rest_seconds INTEGER, notes
)
```

Cada exercício tem **um único** `sets` (inteiro), **um único** `reps` (texto, ex.: `"10-12"`) e **um único** `rest_seconds`. Não há campo capaz de modelar séries com cargas/repetições/descansos distintos. Hoje o trainer pode escrever `"12,10,8"` no campo `reps` como gambiarra de texto, mas o app não interpreta isso — em `useWorkoutSession.ts` (mobile, linhas 117–123), o cliente apenas instancia `Array(setsCount).fill({ weight: '', reps: '', completed: false })`, ou seja, todos os slots são iguais.

Execução real (já existente):

```sql
set_logs (
  id, workout_session_id, assigned_workout_item_id, exercise_id,
  set_number, weight DECIMAL, weight_unit, reps_completed, rpe, is_completed, ...
)
```

A boa notícia: a tabela `set_logs` **já é por série**. Só o que falta é o lado da **prescrição** (o que o trainer pediu) também ser por série.

### 2.3 Sala de treino mobile (relevante para feedback #2)

Arquivos centrais:

- `mobile/app/workout/[id].tsx` (linhas 630–863): tela de execução com header (timer + barra de progresso), seções automáticas (AQUECIMENTO/PRINCIPAL/ACESSÓRIO etc.) e ScrollView de cards.
- `mobile/components/workout/ExerciseCard.tsx`: card com cabeçalho do exercício, botão de troca, botão de vídeo.
- `mobile/components/workout/SetRow.tsx`: linha de série com carga, reps, toggle de conclusão.
- `mobile/components/workout/ExerciseVideoModal.tsx`: modal de vídeo (YouTube via `react-native-youtube-iframe` ou MP4 via `expo-av`).
- `mobile/components/workout/RestTimerOverlay.tsx`: bottom sheet full-screen com timer circular SVG, ±15s/+30s.
- `mobile/components/workout/WorkoutCelebration.tsx`: tela de comemoração com confete (24 partículas), anel animado, stats (duração, séries, volume, RPE) e mensagem contextual.

**Pontos fortes:** já existe gamificação no fim (confete, mensagem por RPE), timer circular, animações sequenciadas, haptics via `PressableScale`. **Lacunas visuais para o aluno:**

1. Vídeo só abre em modal — não há inline.
2. Não há ilustração do grupo muscular / mapa anatômico destacando o músculo trabalhado.
3. Não há GIF curto demonstrativo no card (só tap para abrir modal).
4. Cards são primariamente texto + inputs; falta hierarquia visual chamativa entre série atual / próximas / passadas.
5. Não há visual feedback de "PR/Recorde" ou "Meta atingida" durante o set (só ao final).

### 2.4 Avaliação física (relevante para feedback #3)

**Não existe módulo dedicado.** O fluxo atual:

- Migration 065 cria o template "Avaliação Inicial" (47 perguntas, sistema PAR-Q + estilo de vida + objetivos).
- `weight_kg`, `body_fat_percentage`, `height_cm` são apenas campos de **texto livre** dentro de `form_submissions.answers_json`.
- `web/src/lib/constants/body-metrics.ts` define um mapa simples para extrair peso e %BF do JSON da submissão:

```ts
BODY_METRIC_FIELD_MAP = {
  initial_assessment:   { weight: 'weight_kg', bodyFat: 'body_fat_percentage' },
  periodic_reassessment:{ weight: 'ra1',       bodyFat: 'ra2' },
}
```

**Lacunas críticas para suportar avaliação presencial:**

- Sem tabela `physical_assessments` com timeline de medidas.
- Sem campos para dobras (tríceps, subescapular, suprailíaca, abdominal, axilar média, peitoral, coxa, panturrilha, bíceps, supraespinal etc.).
- Sem campos para perímetros/circunferências (ombro, peitoral, cintura, quadril, braço relaxado, braço contraído, antebraço, coxa proximal/medial/distal, panturrilha).
- Sem campos para diâmetros ósseos (úmero, fêmur).
- Sem cálculos de protocolo (Pollock 3/7, Jackson-Pollock, Guedes 3, Faulkner 4, Petroski).
- Sem upload de fotos comparativas (frente, lado, costas).
- Sem gráficos de evolução por métrica.

### 2.5 Vídeos de exercícios (relevante para feedback #4)

Recursos existentes:

- `exercises.video_url` (campo único, nullable) — vídeo "do sistema".
- `trainer_exercise_videos` (migration 092) — override por treinador, suporta `upload` (bucket `trainer-videos`) ou `external_url` (YouTube ou MP4 direto).
- `mobile/lib/youtube.ts` extrai ID de YouTube com regex robusta (suporta `youtube.com/watch`, `youtu.be`, `embed`, `shorts` e ID puro de 11 chars).
- `mobile/components/workout/ExerciseVideoModal.tsx` faz roteamento: tenta YouTube → cai para `expo-av` se for `.mp4`/`.mov`/`.webm`.

**Lacunas:**

- Não existe biblioteca padrão curada (Kinevo) com vídeos profissionais cobrindo o catálogo todo. Cada treinador "monta o seu", o que cria experiência inconsistente para o aluno e custo de ramp-up para novos PTs.
- Não há thumbnail próprio, dependemos da preview do YouTube ou do primeiro frame do MP4.
- Não há transcoding/streaming adaptativo nem CDN dedicado — uploads via Supabase Storage funcionam mas escalam mal para vídeo (pricing e latência).
- Sem categorização padronizada por ângulo (frente/lado), dificuldade, equipamento — informações que apps como PT Distinction (1.200+ vídeos com cues e erros comuns) já entregam.

---

## 3. Benchmark de mercado

### 3.1 Prescrição com pirâmide / drop-set / per-set

| Plataforma | Suporte a per-set | Como faz |
|---|---|---|
| **Hevy Coach** | Nativo, robusto | Cada série tem campos próprios: load, reps/rep range, RPE alvo, e *set type* (Normal, Warm-up, Failure, Drop) |
| **Trainerize** | Parcial (texto livre) | Trainer escreve `"12 reps/15 lbs, 1/2/4 tempo"` no campo de target — não estruturado, exige convenção |
| **TrueCoach** | Parcial | Reps/peso por exercício; per-set é via texto |
| **Tecnofit/Pacto (BR)** | Limitado a ficha tradicional | Foco em gestão; prescrição mais simples, segue padrão "3x12" |

→ **Janela de oportunidade clara.** O Hevy Coach mostra que tratar série como entidade de primeira classe é tendência. No Brasil, ninguém faz isso bem — e o feedback do nosso usuário confirma a dor.

### 3.2 Avaliação física antropométrica

| Plataforma | Protocolos de dobras | Perimetria | Fotos comp. | Gráficos evolução |
|---|---|---|---|---|
| **Pacto Solutions** | Pollock 3/7, Guedes, Faulkner 4, Bioimpedância | ✅ | ✅ | ✅ |
| **Tecnofit** | Pollock 3/7, Guedes 3 | ✅ | ✅ | ✅ |
| **Sanny App** | Vários, com vídeos demonstrativos | ✅ | ✅ | ✅ histórico comparativo |
| **Nexur Trainer** | Sim + upload de exames | ✅ | ✅ | ✅ |
| **Physical Test 8.0** | 32 vídeos de medidas, dobras, perímetros, diâmetros | ✅ | ✅ | ✅ relatórios PDF |
| **App Avaliação Física (iOS)** | Sim | ✅ | ✅ | ✅ |
| **Kinevo (hoje)** | ❌ | ❌ | ❌ | Só peso/%BF como texto |

→ **Tabela de mesa do mercado brasileiro.** É praticamente impossível vender Kinevo como ferramenta completa para PT presencial sem isso.

### 3.3 Visual da sala de treino

| App | Diferenciais visuais |
|---|---|
| **Hevy / Strong** | Interface clean, gráficos de distribuição muscular, social feed |
| **Muscle & Motion** | 4.000+ vídeos 3D mostrando músculos e articulações trabalhados, com erros comuns |
| **Trainerize / Everfit** | Vídeos inline + thumbnails do exercício no card, animações sutis |
| **Kinevo (hoje)** | Confete ao final, timer circular, haptics — bom no fim, médio durante |

→ Já temos alicerce técnico (Reanimated, NativeWind, haptics). Falta investimento em **conteúdo visual** (mapa muscular, GIF/clip curto inline) e em **microinterações por série**.

### 3.4 Biblioteca de vídeos padronizada

| Plataforma | Estratégia |
|---|---|
| **Trainerize** | 250+ vídeos adicionados em update recente; biblioteca curada própria |
| **PT Distinction** | 1.200+ vídeos cobrindo gym/casa/outdoor com coaching cues e erros comuns |
| **ABC Trainerize** | Biblioteca extensa + permite upload de vídeos custom |
| **Kinevo** | Sem biblioteca curada; cada PT preenche seu próprio |

**Infraestrutura de vídeo (custos referência 2026):**

- **Bunny Stream:** ~$0.01/GB armazenamento, $0.005–0.01/GB delivery. ~50% mais barato que Cloudflare Stream para o mesmo uso. Encoding e player inclusos. **Recomendado.**
- **Cloudflare Stream:** $5/1.000 min armazenados + $1/1.000 min entregues. Simples, mas mais caro.
- **Mux:** premium, melhor analytics, pricing por minuto. Bom para apps que vão fazer ao vivo.

→ Para começar com 200 vídeos × ~10MB cada (versão H.264 720p, 30-60s) = 2GB de storage e poucos GB/mês de delivery. Bunny custa cêntimos por mês inicialmente.

---

## 4. Plano de implementação — proposta detalhada por feedback

### 4.1 [P0] Prescrição com séries diferentes (pirâmide / drop-set / cluster)

**Objetivo:** permitir prescrever, por série, valores distintos de carga sugerida, repetições alvo, descanso e tipo de série (warm-up, normal, drop, falha, cluster).

#### 4.1.1 Modelagem de dados sugerida (Supabase migration nova)

Estratégia: introduzir tabelas-filhas mantendo retrocompatibilidade.

```sql
-- Nova tabela: prescrição por série no template
CREATE TABLE workout_item_set_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_item_template_id UUID NOT NULL REFERENCES workout_item_templates(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'normal'
        CHECK (set_type IN ('warmup','normal','feeder','top','backoff','drop','failure','cluster','amrap')),
    reps_target TEXT,                 -- "12", "10-12", "AMRAP"
    weight_target_kg DECIMAL(6,2),    -- opcional, sugestão
    weight_target_pct1rm DECIMAL(4,1),-- opcional, % de 1RM
    rir_target INTEGER,               -- reps in reserve
    rest_seconds INTEGER,
    tempo TEXT,                       -- "3-1-1-0"
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (workout_item_template_id, set_number)
);

-- Espelho para o programa atribuído
CREATE TABLE assigned_workout_item_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_workout_item_id UUID NOT NULL REFERENCES assigned_workout_items(id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES workout_item_set_templates(id) ON DELETE SET NULL,
    set_number INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'normal',
    reps_target TEXT,
    weight_target_kg DECIMAL(6,2),
    weight_target_pct1rm DECIMAL(4,1),
    rir_target INTEGER,
    rest_seconds INTEGER,
    tempo TEXT,
    notes TEXT,
    UNIQUE (assigned_workout_item_id, set_number)
);

-- Métodos pré-definidos (presets clicáveis)
CREATE TABLE training_method_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE, -- NULL = sistema
    name TEXT NOT NULL,             -- "Pirâmide Crescente 12-10-8-6"
    description TEXT,
    sets_config JSONB NOT NULL,     -- array de objetos com a config de cada série
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Compatibilidade:** os campos antigos `sets`, `reps`, `rest_seconds` em `assigned_workout_items` viram **derivados/legados**. Em runtime:

- Se houver linhas em `assigned_workout_item_sets`, elas são a fonte da verdade.
- Se não houver, o app expande os campos antigos como N séries idênticas (compat com programas existentes).
- Endpoint de leitura (RPC `get_assigned_workout_with_sets`) retorna sempre formato unificado.

**Set types implementados (referência: Hevy Coach):**

- `warmup` — não conta no volume.
- `normal` — padrão.
- `feeder` — aproximação leve.
- `top` — série pesada principal.
- `backoff` — série de redução pós-top.
- `drop` — drop set (carga reduzida na sequência).
- `failure` — até a falha técnica.
- `cluster` — pausas curtas dentro da série.
- `amrap` — as many reps as possible.

#### 4.1.2 UI — trainer (Next.js)

Tela: `web/src/app/students/[id]/programs/[programId]/edit` (ou template equivalente).

Componente novo: `<SetMatrixEditor exerciseId={...} />`. UX proposta:

1. Toggle "Modo simples / Avançado" no card do exercício.
2. **Modo simples (default):** mantém UI atual (sets/reps/rest agregados). 95% dos casos.
3. **Modo avançado:** abre tabela editável série-a-série com colunas: `#`, `Tipo`, `Reps`, `Carga (kg/%1RM)`, `RIR`, `Descanso`, `Tempo`, `+`.
4. Botões de **preset**: "Pirâmide ↑ (12-10-8-6)", "Pirâmide ↓ (6-8-10-12)", "Drop-set (10-8-6 com -20%)", "5x5", "Cluster", "Top + Backoff" → preenchem a tabela.
5. Permitir salvar configuração custom como preset do treinador (`training_method_presets` com `trainer_id`).

#### 4.1.3 UI — aluno (mobile)

`mobile/components/workout/SetRow.tsx`: passa a renderizar o badge do `set_type` (cor/ícone), o `reps_target` e a `weight_target` específicos da série. Hierarquia visual:

- Série atual: card maior, fundo destacado, próximo set sugerido.
- Séries futuras: peek com targets já preenchidos (em opacidade reduzida).
- Séries concluídas: collapse com check verde + valores reais.

`useWorkoutSession.ts`: ajustar o initial state para hidratar de `assigned_workout_item_sets` em vez de replicar o template agregado.

#### 4.1.4 IA / motor de prescrição

`web/src/lib/prescription/`: passar a gerar JSON com array `sets[]`. O Claude já é capaz se o prompt for ajustado. Adicionar nas `feature flags`: `ENABLE_PER_SET_PRESCRIPTION`.

#### 4.1.5 Esforço estimado

- Migration + RPCs: 3 dias.
- Web (matrix editor + presets): 5 dias.
- Mobile (SetRow + useWorkoutSession): 4 dias.
- IA / prompt: 2 dias.
- QA + retro-compat: 2 dias.
- **Total: ~16 dias-dev** (≈ 1 sprint cheio com 2 devs).

---

### 4.2 [P1] Avaliação física presencial — módulo dedicado

**Objetivo:** permitir ao PT registrar, em sessão presencial, anamnese antropométrica completa com cálculo automático de %BF por protocolo, comparativo histórico e fotos.

#### 4.2.1 Modelagem proposta

```sql
CREATE TABLE physical_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    protocol TEXT NOT NULL DEFAULT 'pollock_3'
        CHECK (protocol IN ('pollock_3','pollock_7','jackson_pollock_3','jackson_pollock_7',
                             'guedes_3','faulkner_4','petroski','bioimpedance','manual')),
    -- Antropometria básica
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    age INTEGER,
    sex TEXT CHECK (sex IN ('M','F')),
    -- Resultados calculados
    body_density DECIMAL(6,4),
    body_fat_pct DECIMAL(5,2),
    lean_mass_kg DECIMAL(5,2),
    fat_mass_kg DECIMAL(5,2),
    bmi DECIMAL(5,2),
    -- Observações
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dobras (uma linha por dobra medida)
CREATE TABLE assessment_skinfolds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES physical_assessments(id) ON DELETE CASCADE,
    site TEXT NOT NULL CHECK (site IN (
        'triceps','biceps','subscapular','suprailiac','abdominal',
        'midaxillary','chest','thigh','calf','suprailiac_anterior'
    )),
    measurement_mm DECIMAL(4,1) NOT NULL,
    measurement_2_mm DECIMAL(4,1),
    measurement_3_mm DECIMAL(4,1),
    UNIQUE (assessment_id, site)
);

-- Perímetros / circunferências
CREATE TABLE assessment_circumferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES physical_assessments(id) ON DELETE CASCADE,
    site TEXT NOT NULL CHECK (site IN (
        'neck','shoulder','chest','waist','abdomen','hip',
        'arm_relaxed','arm_flexed','forearm','thigh_proximal',
        'thigh_medial','thigh_distal','calf'
    )),
    measurement_cm DECIMAL(5,2) NOT NULL,
    UNIQUE (assessment_id, site)
);

-- Fotos comparativas (referência aos buckets de storage)
CREATE TABLE assessment_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES physical_assessments(id) ON DELETE CASCADE,
    angle TEXT NOT NULL CHECK (angle IN ('front','side_left','side_right','back')),
    storage_path TEXT NOT NULL,    -- bucket `assessment-photos/<student_id>/...`
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Bucket novo:** `assessment-photos` (privado, RLS estrito — o aluno e o seu treinador são os únicos que veem).

#### 4.2.2 Cálculos de protocolo

Centralizar fórmulas em `shared/lib/anthropometry/` (TS puro, testável em vitest):

- **Jackson & Pollock 3 dobras (homens):** D = 1.10938 − 0.0008267·(Σ3) + 0.0000016·(Σ3)² − 0.0002574·idade. Σ3 = peitoral + abdominal + coxa.
- **Jackson & Pollock 3 dobras (mulheres):** D = 1.0994921 − 0.0009929·(Σ3) + 0.0000023·(Σ3)² − 0.0001392·idade. Σ3 = tríceps + suprailíaca + coxa.
- **Pollock 7 dobras** (peitoral, axilar média, tríceps, subescapular, abdominal, suprailíaca, coxa).
- **Guedes 3 dobras** (BR, tradicional).
- **Faulkner 4 dobras** (mais comum em academias BR).
- **Petroski 4 dobras** (validado para população brasileira).
- Conversão D → %BF via Siri ou Brozek.

Cobertura de testes: snapshots com inputs de referência da literatura (lojas de softwares BR como Physical Test publicam tabelas-exemplo).

#### 4.2.3 UI

**Web (trainer):** `web/src/app/students/[id]/assessments/`

- Lista de avaliações com filtro por data/protocolo.
- Botão "Nova avaliação" → wizard com 4 passos: dados básicos → dobras (campo numérico para cada site, com vídeo curto demonstrando) → perímetros → fotos.
- Resultado calculado mostrado em tempo real (sticky no rodapé).
- Tela de comparativo: até 3 avaliações lado-a-lado, com delta percentual e gráfico de evolução por métrica (Recharts já está no stack).
- Exportação em PDF (já temos infra para gerar relatórios — `program_reports`).

**Mobile (trainer-tabs / mais):** versão simplificada para coletar em campo (academia, atendimento presencial). Inputs grandes, teclado numérico, navegação por carrossel entre dobras com mini-vídeo demonstrativo (reaproveita `expo-av`).

**Aluno (mobile, opcional na fase 1):** ver o histórico das próprias avaliações em `(tabs)/profile` ou nova rota `(tabs)/progress`.

#### 4.2.4 Esforço estimado

- Migrations + RLS: 2 dias.
- Lib de protocolos + testes: 3 dias.
- UI web (wizard + comparativo + PDF): 6 dias.
- UI mobile (entrada em campo): 4 dias.
- Upload de fotos + bucket policies: 2 dias.
- QA com PT real (validação dos cálculos): 2 dias.
- **Total: ~19 dias-dev** (1 sprint + buffer).

---

### 4.3 [P1] Sala de treino mobile — mais visual / inline video

**Objetivo:** elevar o "wow factor" do app para o aluno durante a execução, sem reescrever a tela.

#### 4.3.1 Frentes propostas

1. **Inline video preview no card.** Ao expandir o `ExerciseCard`, mostrar um GIF/clip curto silencioso (3-5s) em loop, gerado a partir do vídeo padronizado (4.4). Player full em modal continua disponível ao tocar.
2. **Mapa muscular destacando o músculo trabalhado.** SVG de silhueta humana (vista frontal/posterior) com os músculos primários/secundários do exercício destacados. `react-native-svg` já está no projeto. Dataset alimentado por `exercises.muscle_groups` (já existe).
3. **Micro-celebração por série concluída.** Pequeno haptic + check animado + sparkle SVG, em vez de só ao fim do treino. Reanimated 4 já no projeto.
4. **Indicador de PR (Personal Record).** Comparar carga atual com `set_logs` históricos do mesmo exercício; se for nova máxima, badge "🏆 Novo recorde" (temos o histórico em `idx_set_logs_exercise_history`).
5. **Dark mode caprichado para a sala de treino.** Já existe NativeWind com tema; criar variante "training-focus" com fundo quase preto, glow no card ativo (Expo Blur já no stack), reduzindo distração.
6. **Indicador de ritmo / próxima série visível.** Card peek atrás do card atual mostrando "Próximo: Supino reto 4ª série · 80kg".
7. **Reformulação do `SetRow`** com tipografia maior, contraste melhor para uso em academia (mãos suadas, telefone numa bancada — pensar em legibilidade a 60-80cm).

#### 4.3.2 Esforço estimado

- Mapa muscular SVG (400 exercícios × 2 vistas, mas pode-se gerar via ChatGPT/Claude + revisão): 4 dias (ou contratar designer).
- Inline video/GIF + thumbnail generator: 3 dias.
- Microanimações + PR badge: 3 dias.
- Polimento UI/typography: 3 dias.
- QA + iterações com 3 alunos reais: 2 dias.
- **Total: ~15 dias-dev** + 1 designer part-time.

---

### 4.4 [P2] Vídeos padronizados dos exercícios

**Objetivo:** todos os exercícios da biblioteca-base do Kinevo têm um vídeo curto (15-30s), padronizado, com qualidade profissional, hospedado em CDN próprio. PT pode continuar fazendo override via `trainer_exercise_videos`.

#### 4.4.1 Decisões de produto

- **Lote inicial:** os 80-100 exercícios mais usados (extrair via query em `assigned_workout_items` agrupado por `exercise_id`). Cobre ~80% do uso.
- **Padrão técnico:** 1080p H.264, 720p para mobile, 16:9 + versão 9:16 (para inline portrait), 15-30s, sem áudio (legendas com cues opcionais), execução perfeita 2 ângulos (frente + lateral).
- **Conteúdo extra (referência PT Distinction):** cues do que fazer (3 bullets), erros comuns (2 bullets) na descrição estruturada — acrescentar campos `exercises.cues_text`, `exercises.common_errors_text`.

#### 4.4.2 Infraestrutura

- **CDN:** Bunny Stream. Custo estimado para 200 vídeos × 10MB × 720p + 5MB × 9:16 ≈ 3GB de storage = $0.03/mês. Delivery escalável e acessível.
- **Player:** mobile usa `expo-av` (já no stack); web usa `<video>` HTML5 com HLS via biblioteca leve (hls.js).
- Schema novo (campo opcional em `exercises`):

```sql
ALTER TABLE exercises
  ADD COLUMN video_hls_url TEXT,
  ADD COLUMN video_portrait_url TEXT,
  ADD COLUMN video_thumbnail_url TEXT,
  ADD COLUMN cues_text TEXT[],
  ADD COLUMN common_errors_text TEXT[];
```

Manter `video_url` como fallback (YouTube continua funcionando).

#### 4.4.3 Operação de conteúdo

Não é tarefa de engenharia — é projeto editorial. Sugestão:

- Contratar 1 PT/educador físico parceiro + cinegrafista freelance.
- 2-3 dias de gravação em academia parceira → 100 exercícios filmados.
- Edição padronizada (template After Effects ou similar).
- Pipeline de upload/aprovação (uma página interna no `web/`).

#### 4.4.4 Esforço estimado (eng)

- Pipeline de upload + transcoding (Bunny Stream): 4 dias.
- Players atualizados (web + mobile): 3 dias.
- Painel admin para curadoria/seed de exercícios: 4 dias.
- Schema + migrations: 1 dia.
- **Total eng: ~12 dias-dev.**
- **Conteúdo:** 4-6 semanas externamente (escopo separado).

---

## 5. Riscos & dependências

| Risco | Mitigação |
|---|---|
| Migração de `sets/reps/rest_seconds` agregados → per-set quebra programas existentes | Estratégia de retrocompat descrita em 4.1.1 (ler do agregado se a tabela nova estiver vazia) |
| Cálculos de %BF errados quebram credibilidade com PT | Cobertura de testes com casos da literatura + revisão por PT parceiro antes do GA |
| Custo de gravação dos vídeos (orçamento externo) | Começar com lote curado (80) e expandir trimestralmente |
| Storage de fotos de avaliação física (sensível, LGPD) | Bucket privado, RLS estrita por aluno+trainer, exclusão em cascata se aluno for arquivado, retenção configurável |
| Onboarding do trainer no "modo avançado" de prescrição | Manter modo simples como default, presets clicáveis prontos, tooltip educacional |

---

## 6. Roadmap consolidado

```
Sprint 1 (semanas 1-2)   → Pirâmide / per-set (P0)
Sprint 2 (semanas 3-4)   → Avaliação física — backend + cálculos + web wizard (P1)
Sprint 3 (semanas 5-6)   → Avaliação física — mobile entrada + comparativos
                          → Sala de treino visual fase 1 (PR badge, microanim) (P1, paralelo)
Sprint 4 (semanas 7-8)   → Sala de treino visual fase 2 (mapa muscular, inline video)
                          → Infra de vídeo padronizado (Bunny Stream + pipeline) (P2)
Sprints 5+ (contínuo)    → Lote 1 de 100 vídeos curados + lote 2 trimestral
```

**Próximos passos imediatos:**

1. Validar este plano com 2-3 treinadores usuários (entrevista de 30 min) — **incluindo o que deu o feedback original**.
2. Refinar a modelagem de `workout_item_set_templates` em uma RFC curta (1 página) para socializar antes de migrar.
3. Levantar orçamento para o projeto editorial dos vídeos padronizados (4.4) — é o item de maior lead-time.

---

## 7. Apêndice — Fontes e referências

### Benchmark
- [Hevy — Set Types Explained (Drop, Warm-Up, Failure)](https://help.hevyapp.com/hc/en-us/articles/34896293707927-Set-Types-in-Hevy-Explained-Drop-Sets-Warm-Up-Sets-and-More)
- [Hevy — How to Write Sets and Reps](https://www.hevyapp.com/features/how-to-write-sets-and-reps/)
- [Hevy Coach — Workout Builder Features](https://hevycoach.com/features/workout-builder/)
- [Trainerize — How to Build Drop Sets](https://help.trainerize.com/hc/en-us/articles/34824850269460-How-to-Build-Warm-Ups-Cool-Downs-and-Drop-Sets-into-Workouts)
- [Trainerize — 250 New Exercise Videos Update](https://www.trainerize.com/blog/trainerize-250-new-exercise-videos-added/)
- [Pacto Solutions — Avaliação Física para Academias (Pollock 3/7, Guedes, Faulkner, Bioimpedância)](https://blog.sistemapacto.com.br/avaliacao-fisica-para-academias-o-guia-completo/)
- [Tecnofit — Tipos de avaliação física disponíveis](https://ajuda.tecnofit.com.br/pt-BR/support/solutions/articles/67000695977-quais-s%C3%A3o-os-tipos-de-avalia%C3%A7%C3%A3o-f%C3%ADsica-dispon%C3%ADveis-)
- [Sanny App — Avaliação Física](https://avaliacaofisica.com.br/)
- [Nexur Trainer — Avaliação Física](https://aplicativonexur.com.br/aplicativo-para-avaliacao-fisica-nexur/)
- [Physical Test 8.0 — Software](https://www.lojaterrazul.com.br/software-avaliacao-fisica-programa-physical-test-80)
- [Best Strength Training Apps 2026 (FindYourEdge)](https://www.findyouredge.app/news/best-strength-training-apps-2026)
- [Muscle & Motion — App de Treinamento de Força com 3D](https://www.muscleandmotion.com/strength-training-por/)

### Infraestrutura de vídeo
- [Mux vs Cloudflare Stream vs Bunny Stream (2026)](https://www.pkgpulse.com/blog/mux-vs-cloudflare-stream-vs-bunny-stream-video-cdn-2026)
- [Best Cloudflare Stream Alternatives 2026](https://www.buildmvpfast.com/alternatives/cloudflare-stream)
- [Bunny.net Review 2026](https://affinco.com/bunny-net-review/)

### Código analisado (interno)
- `supabase/migrations/001_initial_schema.sql` (workout_item_templates, assigned_workout_items, set_logs)
- `supabase/migrations/065_initial_assessment_template.sql` (anamnese atual baseada em form)
- `supabase/migrations/092_trainer_exercise_videos.sql` (override de vídeo por trainer)
- `mobile/components/workout/{ExerciseCard,SetRow,ExerciseVideoModal,RestTimerOverlay,WorkoutCelebration}.tsx`
- `mobile/hooks/useWorkoutSession.ts`
- `web/src/lib/constants/body-metrics.ts`
- `web/src/lib/prescription/` (motor de IA — 26 arquivos)
