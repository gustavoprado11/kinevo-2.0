# Estratégia: Avaliações Presenciais no Kinevo

**Data:** 6 de maio de 2026
**Autor:** Análise estratégica para Gustavo Prado
**Status:** Proposta inicial para discussão

---

## 1. Sumário executivo

Hoje o Kinevo tem uma fundação sólida de formulários assíncronos (anamnese, check-in, pesquisa) com `form_templates`, `schema_json`, AI-assist, versionamento e RLS bem desenhados. O que falta é a camada **presencial e quantitativa**: o momento em que o treinador está na frente do aluno e precisa medir, calcular, comparar e gerar resultado na hora.

A oportunidade é transformar o Kinevo na ponte entre o **mundo dos formulários** (anamnese, check-in) e o **mundo das medições** (dobras, perimetria, força, salto), com três diferenciais claros frente ao MFIT (líder do mercado brasileiro):

1. **Funil contínuo aluno-treinador**: a avaliação presencial não fica órfã num PDF; ela vira ponto de partida do programa, baseline para check-ins e comparativo da próxima reavaliação.
2. **Testes de campo modernos** com vídeo (CMJ, RSI, simetria) que hoje exigem o My Jump Lab à parte.
3. **Inteligência de série temporal**: gráficos de evolução, classificações automáticas e recomendações que o MFIT não entrega bem.

A recomendação é entregar em **três fases**, começando pelo MVP de antropometria + dobras (paridade competitiva crítica), depois testes funcionais e CMJ por vídeo (diferenciação) e por fim integração com balanças bluetooth e relatórios automáticos para o aluno (lock-in).

**Tudo é desenvolvido em paralelo para mobile e web** — não como duplicação, mas como divisão de tarefas: mobile é o lugar de **capturar** medidas (com o aluno na frente), web é o lugar de **construir templates, comparar avaliações no histórico e gerenciar estúdios multi-trainer**. Os dados são os mesmos; as UIs são otimizadas para cada momento. O componente web também desbloqueia o tier de pricing "Estúdio" (multi-trainer), elevando ARPU.

---

## 2. Contexto: o que o Kinevo já tem

A análise do código mostra fundação reutilizável e bem estruturada:

- **Tabela `form_templates`** com `schema_json` (JSON dinâmico), categorias `anamnese | checkin | survey`, versionamento, flag de "default para novo aluno", AI-assist com score de confiança.
- **Templates de sistema seedados**: PAR-Q + Anamnese inicial (47 perguntas), Check-in semanal (10 perguntas), Reavaliação periódica, Feedback de programa.
- **Tipos de pergunta atuais**: `short_text`, `long_text`, `single_choice`, `scale`, `photo`.
- **Fluxo assíncrono já maduro**: trainer atribui → aluno preenche → trainer dá feedback → tudo via `student_inbox_items` + `form_submissions`.
- **Storage privado** para uploads de imagem, RLS hardening recente, realtime publicado.
- **Mobile**: `FormBuilderModal`, `FormRenderer`, `QuestionEditor`, `SubmissionDetailSheet` — UX de editor já enxuto.
- **Web**: `evaluation-preview` para visualização espelhada do mobile.

Por outro lado, faltam três classes de capacidade para suportar avaliação presencial:

1. **Tipos de pergunta estruturados/numéricos**: hoje peso ou dobra cutânea entram como `short_text` sem unidade, sem range, sem cálculo derivado.
2. **Modo "preencher AGORA"**: todo formulário hoje é assíncrono pelo aluno; não há fluxo de "treinador abre na frente do aluno e mede".
3. **Cálculos e séries temporais**: nenhum protocolo (Pollock, Petroski, Faulkner, IMC, RCQ) está implementado, e não há tabela `assessment_sessions` que permita comparar avaliação 1 vs 2 vs 3.

Esse desenho atual é uma **vantagem**: dá pra estender o `schema_json` com novos tipos de pergunta sem refactor pesado, e reaproveitar todo o pipeline de inbox/submissão/feedback.

---

## 3. Análise de mercado: como os concorrentes resolvem

### 3.1 MFIT Personal — o líder a bater

O MFIT é o padrão de fato no Brasil (mais de 200 mil treinadores, ~5M alunos globais, preço a partir de R$ 10,90/mês). É uma referência obrigatória porque é o app que os usuários do Kinevo já têm na cabeça quando pedem avaliação física.

O que o MFIT entrega:
- **11+ protocolos de avaliação física** com cálculo automático: Pollock 3 e 7 dobras, Petroski 4 dobras, Faulkner 4 dobras, Guedes, Durnin & Womersley, equações de Siri/Brozek para conversão de densidade em %BG.
- **Anamnese personalizada** (similar ao Kinevo).
- **Avaliação postural**: análise de imagem com marcação de pontos.
- **PDF do laudo** para entrega ao aluno — um dos motivos mais citados de uso.
- **Biblioteca de 1.800+ vídeos** de exercícios.
- **Cobranças e financeiro** dentro do app.

Pontos fracos do MFIT que viram oportunidade:
- UX antiga, telas com muitos campos sem priorização.
- Não tem testes baseados em vídeo (CMJ, salto horizontal).
- Comparativo histórico é fraco — geralmente é um PDF estático por avaliação, não uma série temporal interativa.
- Não conecta avaliação → prescrição automaticamente.
- Pouca integração com balanças bluetooth/wearables.

### 3.2 My Jump Lab — o gold standard de testes de salto

App espanhol com **20+ estudos peer-reviewed** validando precisão equivalente a plataforma de força (r > 0,91, p < 0,05 em altura, força, velocidade e potência). Usa câmera lenta + ML para detectar takeoff e landing.

Testes que ele cobre e o MFIT/Kinevo não têm:
- **CMJ** (Countermovement Jump) com altura derivada do tempo de voo: `h = 122,5 × t²` (cm), partindo de `h = ½g(t/2)²`.
- **SJ** (Squat Jump) — sem fase excêntrica, isola contribuição concêntrica.
- **CMJ com braços livres** — diferença vs CMJ com mãos no quadril mede contribuição do swing dos braços.
- **DJ** (Drop Jump) com **RSI** (Reactive Strength Index = altura/tempo de contato).
- **Perfil força-velocidade ótimo** (ferramenta de Jiménez-Reyes).
- **Assimetria unilateral**: pulo perna direita vs esquerda — útil pós-cirúrgico e prevenção.
- **Repeated Jump Test**: queda de altura ao longo de N saltos (fadiga).

Custo: ~US$ 12/mês ou US$ 80/ano. Esse é o app que vários treinadores compram à parte hoje. Se o Kinevo embutir o equivalente, tira motivo de uso de outro app.

### 3.3 TrainHeroic, TrueCoach, Trainerize — o benchmark internacional

São fortes em prescrição e tracking, mas **fracos em avaliação presencial**:
- TrainHeroic: foco em S&C de equipe, pouca avaliação corporal.
- TrueCoach: deixa o trainer escolher uma métrica (ex: %BG, agachamento) e tracka ao longo do tempo — mas o trainer precisa coletar fora.
- Trainerize: tem campos de body composition, mas sem protocolos prontos.

A leitura é: no Brasil, **dobras e perimetria são tablestakes**. Lá fora, body composition é mais relaxado e força/performance ganha mais peso.

### 3.4 Outros apps brasileiros (HexFit, Vedius, Avaliação Física PRO, AFIG, Sanny)

São apps especializados (só avaliação) que coexistem com plataformas de prescrição. O treinador hoje **paga por dois**: uma plataforma (Kinevo/MFIT) + um avaliador. Se o Kinevo absorve essa camada, captura mais tempo e mais valor.

### 3.5 Comparativo resumido

| Recurso | Kinevo (hoje) | MFIT | My Jump Lab | TrueCoach | Oportunidade |
|---|---|---|---|---|---|
| Anamnese / PAR-Q | ✅ | ✅ | ❌ | parcial | Manter |
| Dobras + protocolos | ❌ | ✅ (11+) | ❌ | ❌ | **MVP fase 1** |
| Perimetria / circunferências | ❌ | ✅ | ❌ | ❌ | **MVP fase 1** |
| IMC, RCQ, classificação | ❌ | ✅ | ❌ | parcial | **MVP fase 1** |
| Postural por foto | ❌ | ✅ | ❌ | ❌ | Fase 2 |
| CMJ via vídeo | ❌ | ❌ | ✅ | ❌ | **Diferencial fase 2** |
| Outros saltos (SJ, DJ, RSI) | ❌ | ❌ | ✅ | ❌ | Fase 2/3 |
| Sit and reach, FMS | ❌ | parcial | ❌ | ❌ | Fase 2 |
| Dinamometria (handgrip) | ❌ | parcial | ❌ | ❌ | Fase 3 |
| Comparativo histórico (gráfico) | parcial | fraco | ✅ por teste | ✅ | **Diferencial transversal** |
| Avaliação → prescrição auto | ❌ | ❌ | ❌ | ❌ | **Diferencial estratégico** |
| Bluetooth (balança, fita) | ❌ | parcial | ❌ | parcial | Fase 3 |
| PDF de laudo | ❌ | ✅ | ❌ | parcial | **Fase 1** (tabletake) |

---

## 4. Catálogo de testes recomendados

A seleção foi feita pensando em **personal autônomo + estúdio pequeno**, priorizando o que cobre 90% do uso real, com fórmulas validadas e protocolos publicados.

### 4.1 Antropometria (essencial — fase 1)

| Medida | Unidade | Como usar |
|---|---|---|
| Peso corporal | kg | Entrada manual ou via balança bluetooth |
| Estatura | cm | Único campo "lock", muda pouco |
| IMC | kg/m² | Calculado: `peso / altura²` — classificação OMS |
| Circunferência abdominal | cm | Risco cardiovascular (OMS: <94 H, <80 M) |
| Cintura, quadril | cm | Calcula RCQ |
| RCQ | razão | Risco cardiovascular (>0,90 H, >0,85 M = alto risco) |
| Pescoço, tórax, braços (R/E), antebraços, coxas (R/E), panturrilhas | cm | Comparativo de hipertrofia, simetria direita/esquerda |

### 4.2 Dobras cutâneas + composição corporal (essencial — fase 1)

Implementar **3 protocolos como mínimo**, todos com cálculo automático:

| Protocolo | Dobras | Quando usar |
|---|---|---|
| **Jackson & Pollock 3 dobras** | H: peito, abdômen, coxa / M: tríceps, supra-ilíaca, coxa | Default rápido, mais usado |
| **Jackson & Pollock 7 dobras** | tríceps, peito, sub-axilar, subescapular, abdominal, supra-ilíaca, coxa | Mais preciso, atletas |
| **Petroski 4 dobras** | subescapular, tríceps, supra-ilíaca, panturrilha medial | **Validado para população brasileira** — diferencial |
| **Faulkner 4 dobras** | tríceps, subescapular, supra-ilíaca, abdominal | Simples, popular |
| **Guedes 3 dobras** | H: tríceps, abdômen, supra-ilíaca / M: subescapular, supra-ilíaca, coxa | Brasileiro |
| **Durnin & Womersley** | bíceps, tríceps, subescapular, supra-ilíaca | Idosos, faixas etárias amplas |

Todos convergem para **densidade corporal → %BG** via equação de Siri (`%BG = (495/D) - 450`) ou Brozek (`%BG = (4,57/D - 4,142) × 100`).

Output do app:
- %BG calculado
- Massa gorda (kg) e massa magra (kg)
- Classificação por idade/sexo (Pollock & Wilmore)
- Comparativo com avaliação anterior (delta absoluto e %)

### 4.3 Testes funcionais e flexibilidade (fase 2)

| Teste | Mede | Protocolo |
|---|---|---|
| **Sit and Reach (Wells)** | flexibilidade posterior | banco de Wells, 3 tentativas, melhor resultado |
| **Flexão de braço (1 min)** | resistência de membros superiores | total em 60s, classificação por idade/sexo |
| **Abdominal (1 min)** | resistência de tronco | total em 60s |
| **Plank** | core | tempo até falha |
| **Agachamento (1 min)** | resistência de membros inferiores | total em 60s |
| **Squat overhead, lunge, FMS subset** | qualidade de movimento | escala 0-3 por padrão FMS |

### 4.4 Testes de potência via vídeo (fase 2 — DIFERENCIAL)

Aqui é onde o Kinevo se diferencia do MFIT. Implementar usando o ML kit do iOS/Android (pose detection nativa + cálculo de tempo de voo via análise de frames).

| Teste | Métrica | Fórmula |
|---|---|---|
| **CMJ (Countermovement Jump)** | altura (cm), potência (W) | `h = 122,5 × t²` (cm), `P = peso × √(g × h × 9,81)` |
| **SJ (Squat Jump)** | altura sem contramovimento | mesma fórmula, sem fase excêntrica |
| **CMJ com braços** | altura assistida | mostra contribuição do swing |
| **DJ (Drop Jump)** | RSI = altura/tempo de contato | mais avançado, fase 3 |
| **Salto horizontal** | distância em cm | manual + foto opcional |
| **Assimetria unilateral** | %% diferença entre pernas | salto perna direita vs esquerda |

Implementação tecnicamente viável:
- iOS: `AVFoundation` para captura em 240fps + Vision/CoreML para detecção de chão/pé.
- Android: `CameraX` em alta taxa de quadros + MLKit pose detection.
- Alternativa MVP: o trainer aponta no vídeo o frame de takeoff e o frame de landing — app calcula `flight_time` = (frame_landing - frame_takeoff) / fps. Funciona em qualquer celular sem ML pesado.

### 4.5 Cardiorrespiratório (fase 2/3)

| Teste | Aplicação | Output |
|---|---|---|
| **Teste de Cooper (12 min)** | corrida ou esteira | distância → VO₂máx estimado |
| **Teste de Rockport (caminhada 1.6 km)** | iniciantes/sedentários | tempo + FC final → VO₂máx |
| **PSE de esforço (Borg 6-20 ou CR-10)** | escala subjetiva | input rápido pós-treino |

### 4.6 Outros opcionais (fase 3)

- **Dinamometria** (handgrip): exige equipamento, mas tem indicação clínica forte (sarcopenia, idosos).
- **Bioimpedância via balança bluetooth**: integração Renpho/Mi Body Composition.
- **Análise postural por foto/vídeo**: marcação de pontos, comparativo lateral/frontal.

---

## 5. Estratégia de produto: como diferenciar

A análise sugere quatro alavancas de diferenciação. Listadas em ordem decrescente de impacto/custo:

### 5.1 Funil aluno-treinador integrado (alavanca principal)

Hoje, em qualquer app concorrente, a avaliação é um silo: vira PDF, é entregue, e não fala com a prescrição. No Kinevo, a avaliação deve ser **a porta de entrada do programa**.

Fluxo proposto:
1. Treinador agenda **Sessão de Avaliação** com o aluno (já tem `agendamentos` no schema).
2. No dia, abre o app, escolhe o **Pacote de Avaliação** (template com lista de testes).
3. Faz medições com o aluno (modo "preencher agora", trainer-side).
4. Ao salvar, gera:
   - Relatório PDF para o aluno.
   - **Recomendações automáticas** que abastecem a prescrição: ex: %BG alto → priorizar gasto calórico; assimetria CMJ >10% → trabalho unilateral; dor lombar na anamnese → omitir overhead.
   - **Baseline** que vira referência para o `weekly_checkin` (ex: aluno reporta peso, app compara com o último).
5. Próxima reavaliação (30/60/90 dias) usa o **mesmo template**, popula automaticamente as variáveis fixas (estatura) e mostra os deltas inline.

Esse é o tipo de coisa que o MFIT estruturalmente não faz porque sua avaliação é PDF-céntrica, não dado-céntrica.

### 5.2 Comparativo histórico interativo (transversal)

Toda métrica deve ter automaticamente um gráfico de série temporal acessível em 1 toque. O aluno vê seu progresso, o treinador vê tendências. Já dá pra fazer com `recharts` (web) e `victory-native` ou similar (mobile).

### 5.3 CMJ + testes de potência por vídeo (diferenciação técnica)

Embutir testes que hoje fazem o treinador comprar o My Jump à parte. Mesmo se o MVP for "trainer marca os frames manualmente", já é diferencial — o automatic-detection vem na fase 3.

### 5.4 Templates regionais validados (Petroski, Guedes)

O MFIT tem todos. Mas é diferencial vs concorrentes internacionais e é tabletake doméstico. **Não dá pra entrar sem isso.**

---

## 6. Arquitetura técnica sugerida

### 6.1 Modelo de dados

Estender o schema atual sem quebrar:

```sql
-- Estender form_templates
ALTER TABLE form_templates
  ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'student_self'
    CHECK (delivery_mode IN ('student_self', 'trainer_in_person', 'both'));

-- Categoria nova (não obrigatório expandir o CHECK existente)
ALTER TABLE form_templates DROP CONSTRAINT form_templates_category_check;
ALTER TABLE form_templates ADD CONSTRAINT form_templates_category_check
  CHECK (category IN ('anamnese', 'checkin', 'survey', 'assessment'));

-- Nova tabela: sessões de avaliação (1 sessão = N submissions vinculadas)
CREATE TABLE assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  student_id UUID NOT NULL REFERENCES students(id),
  scheduled_at TIMESTAMPTZ,
  performed_at TIMESTAMPTZ,
  package_template_id UUID REFERENCES form_templates(id),
  notes TEXT,
  status TEXT CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  computed_metrics JSONB,  -- IMC, %BG, RCQ, classificações
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cada teste/medição da sessão
CREATE TABLE assessment_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,           -- 'skinfold_triceps', 'cmj_height', 'waist_circ'
  value_numeric NUMERIC,
  value_unit TEXT,                    -- 'mm', 'cm', 'kg', 's'
  side TEXT CHECK (side IN ('left', 'right', 'both')),
  attempt_number INT,                 -- para múltiplas tentativas (CMJ tira a melhor)
  raw_input JSONB,                    -- frames de vídeo, foto, dados brutos
  measured_at TIMESTAMPTZ DEFAULT now()
);

-- View materializada para série temporal por aluno
-- (permite gráficos rápidos sem joins pesados)
CREATE MATERIALIZED VIEW student_metrics_timeline AS ...;
```

### 6.2 Novos tipos de pergunta no `schema_json`

Estender o builder mobile com:
- `numeric_unit`: número com unidade fixa, range, validação (ex: peso, dobras).
- `bilateral_numeric`: dois valores (R/E) com cálculo de assimetria.
- `multi_attempt_numeric`: 3+ tentativas, escolhe melhor/média.
- `video_test`: gravação de vídeo + marcação de frames + cálculo derivado.
- `computed`: campo derivado (read-only, fórmula declarativa).

### 6.3 Engine de cálculo

Encapsular fórmulas em um pacote TypeScript no `shared/`:

```ts
// shared/lib/assessment-protocols/
export const protocols = {
  jacksonPollock3: { calc: (...) => density, fields: [...] },
  petroski4: { calc: ..., fields: [...] },
  faulkner4: { calc: ..., fields: [...] },
  // ...
};

export const formulas = {
  bmi: (kg, m) => kg / (m * m),
  bodyFatSiri: (density) => 495 / density - 450,
  rcq: (waist, hip) => waist / hip,
  cmjHeightFromFlightTime: (t) => 122.5 * t * t,
  cmjPower: (mass, height) => mass * Math.sqrt(9.81 * height * 9.81),
};
```

Mantém web e mobile com mesma fonte da verdade — já é o padrão da pasta `shared/`.

### 6.4 PDF do laudo

Tabletake. Sugere usar **react-pdf** (já compatível com o stack) gerando server-side via Edge Function do Supabase, com layout Kinevo-branded e seção de comparativo se já houver avaliação anterior.

---

## 7. Componente web: paridade e diferenciação

A avaliação presencial não pode ser exclusivamente mobile. Há cenários reais em que o web é claramente superior — e há casos em que mobile + web rodam juntos no mesmo dia, no mesmo aluno. A regra geral é dividir por momento de uso, não por feature.

### 7.1 Princípio de divisão: "execução" vs "preparação/análise"

| Momento | Plataforma ideal | Por quê |
|---|---|---|
| **Capturar** medidas com o aluno na frente | Mobile | Mobilidade, câmera nativa, teclado numérico, haptic feedback, está sempre na mão |
| **Construir/editar** pacotes de avaliação (templates) | Web | Muitos campos, copiar-colar, drag-and-drop, ver lista grande |
| **Revisar** resultado individual e gerar PDF | Ambos | Mobile rápido, web melhor pra leitura cuidadosa |
| **Comparar** série temporal e múltiplas avaliações | **Web** | Telona ganha — gráficos lado a lado, exportação Excel |
| **Gerenciar** alunos de um estúdio (multi-trainer) | **Web** | Dashboard de filtros, relatórios em massa, controle de equipe |
| **Revisar vídeo** de CMJ com marcação fina | **Web** | Resolução maior, scrubber preciso de frame |
| **Aluno consumir** seu próprio histórico | **Ambos** | Mobile no dia-a-dia, web pra impressão/share |

### 7.2 Casos de uso específicos do web

**A. Estúdios com tablet/desktop fixo**
Vários estúdios e boxes mantêm um iPad ou notebook na recepção/sala de avaliação. O treinador faz a avaliação ali. O web (em modo PWA responsivo) permite isso sem precisar instalar app — e o estúdio pode trocar de aparelho sem realojar conta.

**B. Builder/editor de pacote**
A tela de "criar pacote de avaliação" tem 8-15 testes, cada um com unidade, range, vídeo de instrução, fórmula derivada. Editar isso no celular é doloroso. No web, o trainer monta uma vez no escritório e usa no celular pelo resto do mês. Esse fluxo, inclusive, pode ser **só web na fase 1** — o mobile só consome.

**C. Comparativo avançado entre avaliações**
"Quero ver as três últimas avaliações da Marina lado a lado, e comparar com a média dos meus alunos do mesmo perfil." Isso é fluxo de telona. Tabelas pivot, exportação para Excel/CSV, gráficos sobrepostos.

**D. Painel do estúdio (multi-trainer)**
Dono de box com 6 trainers e 80 alunos quer:
- Quem fez avaliação esse mês? Quem está atrasado?
- Distribuição de %BG por faixa etária no estúdio.
- Trainer que mais melhora alunos em CMJ.
- Exportar laudos em massa pra entregar pra rede ou plano de saúde.

Isso é o tipo de feature que **converte plano "Pro individual" em plano "Estúdio" (mais ARPU)** e o concorrente direto não atende bem.

**E. Revisão de vídeo de CMJ**
Quando a marcação automática ficar boa (fase 3) ainda vai ter casos de "salto suspeito" que o trainer quer revisar com calma. Tela maior + scrubber frame-a-frame + mouse precisa muito mais que touch.

**F. Imprimir/compartilhar laudo**
Personal autônomo que entrega PDF físico pro aluno: geração e revisão do laudo é melhor no web, com prévia em tamanho A4 antes de imprimir.

**G. Aluno: portal de progresso**
O aluno não vai abrir o web no celular pra ver o gráfico que tem dentro do app. Mas vai abrir no notebook no domingo, antes da reavaliação, pra entender onde está. Faz sentido o aluno ter um portal `web` próprio com histórico bonito (já dá pra reaproveitar o `evaluation-preview`).

### 7.3 Implicações técnicas

**Bom:** o `shared/` já é o padrão. As fórmulas (J&P, Petroski, Siri, CMJ) ficam em `shared/lib/assessment-protocols/` e rodam idênticas nos dois mundos. O `schema_json` já é renderizado por dois renderers (mobile `FormRenderer` + web `evaluation-preview`).

**Cuidado:**
- **Vídeo de CMJ no web** é mais complexo: precisa upload pro Supabase Storage, leitor de vídeo customizado (frame-a-frame), e idealmente UM mesmo arquivo gravado no mobile e revisável no web. Sugere-se tirar foto-key do takeoff/landing no upload e armazenar metadados juntos pra economizar bandwidth.
- **PWA + offline mobile**: estúdios sem wifi confiável vão querer iniciar avaliação offline e sincronizar depois. O mobile já tem cache local; o web precisaria service worker mais elaborado.
- **Permissões**: a tabela `assessment_sessions` precisa de RLS pensada para o caso "estúdio" — owner do estúdio vê tudo dos seus trainers, mas trainer A não vê dados do trainer B (a não ser que o estúdio configure).

### 7.4 Sugestão de scope por plataforma

| Funcionalidade | Mobile | Web | Observação |
|---|---|---|---|
| Capturar antropometria/dobras | F1 | F1 | UI diferente: mobile = wizard fullscreen; web = painel denso |
| Builder de pacote | F2 | **F1** | Web prioritário — UX bem melhor |
| Visualizar resultado | F1 | F1 | Reaproveita evaluation-preview |
| Comparativo histórico simples | F1 | F1 | Mesmo gráfico, layouts diferentes |
| Comparativo avançado (multi-aval) | F3 | **F2** | Web ganha por causa da telona |
| Gerar PDF | F1 | F1 | Mesma engine server-side |
| Captura de vídeo CMJ | **F2** | F3 | Mobile primeiro, sempre |
| Revisão/marcação de vídeo | F2 | F2 | Web é melhor pra precisão fina |
| Painel estúdio multi-trainer | — | **F2** | Exclusivo web |
| Portal do aluno (histórico) | F2 | F2 | Em paralelo |
| Exportação Excel/CSV em massa | — | **F2** | Exclusivo web |

**Regra prática:** se o trainer está com o aluno na frente, abre o app. Se o trainer está sentado num computador (preparando, revisando, gerenciando), abre o web. Os dados são os mesmos.

---

## 8. Plano de integração ao sistema atual

A análise da base de código mostra que o Kinevo **já tem 80% da plumbing necessária**. Não é um módulo novo a ser bolted-on — é uma extensão natural do que existe. Esta seção mapeia exatamente onde cada peça encaixa.

### 8.1 Navegação: nada de novo no menu

A sidebar do web (`web/src/components/layout/sidebar.tsx`) **já tem o item "Avaliações"** apontando para `/forms`. O caminho interno é "forms" mas o label exibido é "Avaliações". Essa é a casa do módulo — não criar nova rota top-level.

A página atual `/forms` (componente `FormsDashboardClient`) já organiza:
- Templates de formulário (anamnese, checkin, survey).
- Submissions (respostas dos alunos).
- Modal de atribuir formulário, sheet de detalhes da resposta, etc.

A extensão é **adicionar uma terceira aba/seção dentro dessa mesma página**: "Avaliações Presenciais", lado a lado com "Respostas" e "Templates". Mesma chrome, mesma sidebar, mesmo header — só uma view nova.

No mobile, a tab inferior `(trainer-tabs)/forms.tsx` já tem tabs internos `responses | templates`. Adicionar `assessments` como terceiro tab segue o mesmo padrão (`Tab = "responses" | "templates" | "assessments"`).

### 8.2 Como a categoria nova encaixa visualmente

O sistema já tem mapeamento `category → cor + ícone` em `forms-dashboard-client.tsx`:

```
anamnese → azul (text-blue-600), ícone ClipboardList
checkin  → esmeralda (text-emerald-600), ícone CheckCircle2
survey   → âmbar (text-amber-600), ícone MessageSquare
```

Adiciona-se:

```
assessment → violeta (text-violet-600), ícone Activity ou Ruler
```

A escolha de violeta não é arbitrária: o token `colors.status.presencial = '#8b5cf6'` **já está definido** em `mobile/theme/colors.ts` para uso em badges de modalidade. Reusar esse semantic mantém consistência com o resto do app.

Padrão de badge atual (ex: `submissionStatusForSheet`):
```
bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20
```
Já é o mesmo pattern usado para "Feedback Enviado". Ou seja, a estética não precisa de nada novo.

### 8.3 Componentes existentes que são estendidos (não substituídos)

| Componente atual | Como é estendido |
|---|---|
| `form_templates` (table) | Aceita nova `category = 'assessment'` + nova coluna `delivery_mode` |
| `FormBuilderModal` (mobile) | Recebe novos `QUESTION_TYPES`: `numeric_unit`, `bilateral_numeric`, `multi_attempt_numeric`, `video_test`, `computed`. O resto do modal não muda. |
| `QuestionEditor` (mobile) | Ganha branches para os novos tipos (cada um com sua sub-UI de configuração) |
| `FormFieldRenderer` (mobile) | Idem para renderizar os novos tipos no modo "preencher" |
| `evaluation-preview` (web) | Mesma extensão, mantém pixel-parity com mobile |
| `AssessmentSidebarCard` (web, em `students/[id]`) | **Já existe e já mostra `bodyMetrics` + `BodyMetricsTrend`!** Apenas adiciona seção "Avaliações Presenciais" com último resultado, link para sessão completa e CTA de "Agendar reavaliação" |
| `FormsDashboardClient` (web) | Nova aba/view "Avaliações Presenciais" reutilizando o layout de tabs existente |
| `forms.tsx` (mobile trainer-tabs) | Novo `Tab` enum, mesmo padrão de FilterChips |
| `submission-detail-sheet.tsx` | Especialização para abrir resultado de avaliação (mesma sheet, conteúdo diferente) |

### 8.4 Componentes novos (mínimos)

Apenas o que **não tem equivalente** no sistema atual:

- `<MeasurementWizard>` (mobile) — fluxo wizard fullscreen para captura presencial. Não há wizard hoje (as submissions são preenchidas página única pelo aluno).
- `<VideoFrameMarker>` (mobile + web) — player com scrubber frame-a-frame para CMJ. Componente isolado, reutilizável também para análise postural futura.
- `<MetricTimeline>` (shared) — gráfico de série temporal por métrica. Já existe `BodyMetricsTrend` (sparkline) — pode ser evoluído ou um novo componente para o caso multi-métrica do comparativo avançado.
- `<AssessmentSession>` page (mobile + web) — tela full da sessão (header com aluno + protocolo, lista de testes a completar, botão "iniciar"). Equivalente ao `student-detail-client.tsx` em complexidade.
- `<ComparePanel>` (web) — exclusivo do comparativo avançado, vive em `/students/[id]/avaliacoes/comparar`.
- `<StudioDashboard>` (web) — exclusivo do plano Estúdio, vive em `/estudio/avaliacoes`.

### 8.5 Hooks de dados

Estende-se o padrão existente de `useTrainerFormTemplates`, `useTrainerFormSubmissions`:

```ts
useAssessmentSessions(studentId?)  // lista de sessões
useAssessmentSession(sessionId)    // sessão completa com measurements
useStudentMetricsTimeline(studentId, metricKey)  // série temporal
useAssessmentBuilder(templateId)   // espelha useFormTemplateCrud
useStudioAssessmentDashboard()     // só plano Estúdio
```

RPCs Supabase seguem o padrão atual (`get_trainer_*` em `supabase/migrations/049_trainer_mobile_rpcs.sql`):

```sql
get_assessment_sessions(p_student_id UUID DEFAULT NULL)
get_assessment_session(p_session_id UUID)
save_assessment_measurement(p_session_id UUID, p_measurements JSONB)
finalize_assessment_session(p_session_id UUID)  -- dispara cálculos derivados
```

### 8.6 Dark mode

O web já tem `:root` (light) + `.dark` em `globals.css`. Todas as cores dos novos componentes precisam usar **CSS variables semânticas** (`--surface-card`, `--text-primary`, etc.) já definidas — nunca hex direto. O mobile não tem dark mode hoje, então não há trabalho extra ali.

### 8.7 Onboarding e tours

O sistema tem `TourRunner` (`web/src/components/onboarding/tours/`). Quando o módulo for liberado, adicionar:
- Tour "primeira avaliação presencial" (3-4 passos) na primeira vez que o trainer entra na nova aba.
- Onboarding-id `sidebar-forms` já existe — só estender o tour da página.

### 8.8 Pricing gating

O bloqueio por plano segue o padrão `getTrainerWithSubscription()` que já é chamado nas páginas (`web/src/app/forms/page.tsx`). Mesmo padrão para checar se o trainer tem feature `assessment_in_person`, `assessment_video_tests` ou `studio_dashboard`.

### 8.9 Resumo da extensão

**O que é construído do zero:** ~5 componentes (wizard de captura, video marker, sessão, comparativo, painel estúdio) + 3 tabelas (sessions, measurements, view materializada) + engine de fórmulas no `shared/`.

**O que é estendido:** ~6 componentes existentes ganham 1 caso novo cada.

**O que muda na navegação:** **nada visualmente.** O item "Avaliações" da sidebar já existe — só ganha conteúdo novo. No mobile, um terceiro tab dentro da Forms screen.

Esse é o tipo de trabalho que parece grande no roadmap mas, na prática, é mais "preencher os espaços que o sistema já reservou" do que reconstruir UI. Daí o roadmap das 3 fases ser realista em 8-12 semanas por fase com um time pequeno.

---

## 9. Roadmap proposto (3 fases)

### Fase 1 — MVP "Avaliação Presencial Essencial" (8-12 semanas)

**Objetivo:** Paridade competitiva crítica com MFIT. O treinador consegue fazer toda avaliação presencial padrão dentro do Kinevo, **mobile e web**.

**Backend / shared:**
- Categoria `assessment` + modo `trainer_in_person` no `form_templates`.
- Tabelas `assessment_sessions` + `assessment_measurements`.
- Novos campos: `numeric_unit`, `multi_attempt_numeric`, `bilateral_numeric`, `computed`.
- Engine de fórmulas no `shared/lib/assessment-protocols/`: IMC, RCQ, J&P 3 e 7, Petroski, Faulkner, Siri.
- Edge Function de geração de PDF (server-side, mesmo layout no mobile e web).
- Templates de sistema seedados: "Avaliação Antropométrica Completa", "Avaliação por Dobras (3 protocolos no toggle)", "Avaliação Inicial Presencial".

**Mobile:**
- Fluxo wizard de captura ("preencher agora") — uma medida por tela, big-input numérico.
- Tela de resultado com gráfico de linha simples e comparativo com avaliação anterior.
- Geração e compartilhamento do PDF.

**Web:**
- **Builder de pacote** (prioritário, melhor UX do que mobile) — drag-and-drop, copia/cola, preview lado a lado.
- Modo "preencher agora" também no web (para estúdios com tablet/desktop fixo).
- Tela de resultado com chart e comparativo (mesmo conteúdo, layout denso).
- Pré-visualização e download do PDF em A4.

**KPIs:** % de treinadores ativos que criam pelo menos 1 sessão presencial em 60 dias após release; NPS específico do módulo; razão de pacotes criados via web vs mobile (validar hipótese de que web ganha em criação).

### Fase 2 — "Performance & Funcional" (8-10 semanas)

**Objetivo:** Diferenciação técnica (CMJ via vídeo) + cobertura de testes funcionais + painel para estúdios.

**Mobile:**
- Novo tipo de campo `video_test` — captura em câmera lenta + marcação manual de takeoff/landing + cálculo de altura/potência.
- CMJ, SJ, CMJ-arms, salto horizontal.
- Sit and reach, flexão/abdominal/plank em 1 min, agachamento em 1 min.
- Auto-detecção de assimetria (CMJ unilateral) com alerta quando >10%.
- Recomendações automáticas que **alimentam a prescrição**.
- Foto postural com sobreposição de grade.

**Web:**
- **Comparativo avançado**: visualizar 2-N avaliações lado a lado, gráficos sobrepostos, exportação Excel/CSV.
- **Player de vídeo CMJ** com scrubber frame-a-frame para revisão fina (re-marca takeoff/landing) — útil quando o trainer quer reauditar um salto suspeito.
- **Painel do estúdio**: visão multi-trainer, filtros de status, "quem está atrasado", distribuições demográficas.
- **Portal do aluno**: histórico bonito acessível pelo navegador (reaproveita `evaluation-preview`).

**KPIs:** % de avaliações com pelo menos 1 teste de potência; correlação entre prescrição automática e edição manual do treinador (proxy de qualidade da recomendação); adoção do painel estúdio em contas multi-trainer.

### Fase 3 — "Lock-in" (10-12 semanas)

**Objetivo:** Tornar o Kinevo a casa única do treinador e do estúdio.

**Mobile:**
- **Auto-detecção de takeoff/landing** via pose detection (CoreML/MLKit) — promove o CMJ a "tirar foto e ter resultado".
- Drop Jump + RSI, Repeated Jump (fadiga), Perfil Força-Velocidade.
- Integração com **balanças bluetooth** (Mi Body Composition, Renpho).
- Dinamometria (handgrip).
- "Reavaliação inteligente": app sugere quando agendar.

**Web:**
- **Exportação em massa** de laudos (estúdio gera PDFs de 80 alunos pra entregar pra rede de academia ou plano de saúde).
- **Comparativo entre alunos** (com cuidado de privacidade): "média de %BG dos meus alunos vs Marina".
- API/integrações: webhooks de avaliação concluída, integração com sistemas de academia (Pacto, Tecnofit) para sincronizar dados de bioimpedância.

**KPIs:** Redução de churn por motivo "uso outro app pra avaliar"; conversão de Pro → Estúdio; ARPU.

---

## 10. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cálculo errado em fórmula vira processo (CFEF) | Baixa | Alto | Suite de testes unitários por protocolo, validação com revisor técnico (educador físico parceiro) antes de release. Fonte e referência citadas no app ("Pollock & Jackson, 1978"). |
| CMJ via vídeo tem variância maior em celulares ruins | Média | Médio | Limitar MVP a marcação manual de frames (preciso); auto-detecção só na fase 3 com fallback manual. |
| Curva de aprendizado para treinador antigo | Média | Médio | Onboarding guiado na primeira avaliação + biblioteca de vídeos curtos "como fazer cada teste". |
| MFIT lança CMJ depois | Média | Baixo | Speed-to-market é o ativo. Diferencial sustentável é o **funil integrado**, não o teste isolado. |
| Volume de dados de mídia (vídeos) explode storage | Alta | Médio | Vídeos só comprimidos; oferecer descarte automático após 90 dias salvando só a métrica derivada. |
| Tela de avaliação fica complexa demais e ninguém usa | Média | Alto | Validação com 5-10 treinadores beta antes do release; modo "fluxo guiado" passo-a-passo. |

---

## 11. Sinalização de pricing (para discussão)

Se hoje o MFIT custa R$ 10,90-30/mês e o My Jump Lab US$ 12/mês (~R$ 60), há espaço para o Kinevo posicionar:

- Plano **Pro** (faixa atual + R$): inclui Avaliação Presencial Essencial (fase 1) — mobile + web.
- Plano **Performance** (premium, ~R$ 79-99/mês): inclui CMJ + funcionais + comparativos avançados + revisão de vídeo no web.
- Plano **Estúdio** (a partir de ~R$ 199/mês ou por trainer adicional): inclui painel multi-trainer no web, exportação em massa, sub-contas para até N trainers. Esse é o tier que o componente web realmente desbloqueia.
- Add-on por uso (ex: "primeira avaliação presencial grátis, R$ 5 cada subsequente") — pode ser viável para personal autônomo de baixo volume.

Vale validar com treinadores beta antes de fechar.

---

## 12. Próximos passos sugeridos

1. **Validação com 5 treinadores** (uso real, MFIT + outro app de avaliação) — entrevistas de 30 min para confirmar priorização. Pode ser feita em 1-2 semanas.
2. **Spike técnico de 1 semana** para CMJ via marcação manual de frames — confirma viabilidade antes de comprometer fase 2.
3. **Wireframes detalhados** das três telas-chave: lista de pacotes de avaliação, tela de medição (com teclado numérico fast-input), tela de resultado/comparativo.
4. **Catálogo de fórmulas revisado por educador físico** parceiro antes do desenvolvimento começar.
5. **Decisão de scope da fase 1**: vai fechar com 3 ou 6 protocolos de dobras? Inclui postural por foto já no MVP?

---

## Anexo A — Referências

### Concorrentes
- [MFIT Personal — Avaliação Física](https://avaliacaofisica.mfit.app)
- [Protocolos de avaliação física no MFIT](https://blog.mfitpersonal.com.br/saiba-como-calcular-protocolos-de-avaliacao-fisica-automaticamente/)
- [My Jump Lab — App Store](https://apps.apple.com/us/app/my-jump-lab-my-jump-3/id1554077178)
- [Validação científica do My Jump Lab (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11679296/)
- [Comparativo apps personal trainer 2026 — TreinoAI](https://www.treinoai.com.br/academy/blog/melhor-app-para-personal-trainer-2026)

### Protocolos e fórmulas
- [Protocolos antropométricos — CDOF](https://www.cdof.com.br/protocolos1.htm)
- [Calculadora Jackson & Pollock 7 dobras](https://medesportepapers.com.br/calculadoras/jackson-pollock-7-dobras/)
- [Comparação Pollock x Faulkner x Guedes — RBONE](https://www.rbone.com.br/index.php/rbone/article/view/865)
- [CMJ — Science for Sport](https://www.scienceforsport.com/countermovement-jump-cmj/)
- [Calculadora Bosco CMJ (flight time → height)](https://www.topendsports.com/testing/tests/bosco-counter-movement-jump.htm)

### Avaliação funcional
- [FMS — Functional Movement Screen (Reaction)](https://www.institutoreaction.com.br/artigos/como-o-teste-fms-pode-ajudar-a-melhorar-seu-desempenho-no-esporte/)
- [Dinamometria — uso clínico](https://emfoco.med.br/dinamometria-essencial-para-avaliacao-funcional/)
