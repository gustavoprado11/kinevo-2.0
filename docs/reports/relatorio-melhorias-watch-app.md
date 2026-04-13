# Kinevo Apple Watch - Relatório de Melhorias para Tela de Execução de Treinos

**Data:** 31 de Março de 2026
**Autor:** Análise de UX/Frontend
**Escopo:** Tela de execução de treinos (WorkoutExecutionView) e componentes relacionados

---

## 1. Resumo Executivo

Após análise detalhada do código-fonte (946 linhas do WorkoutExecutionView.swift, 428 linhas do CardioExecutionView.swift, e componentes auxiliares), das capturas de tela fornecidas e de pesquisa sobre as melhores práticas de design para watchOS e apps concorrentes (Hevy, Strong, Fitbod), este relatório apresenta **28 oportunidades de melhoria** organizadas por impacto e complexidade.

O app já tem uma base sólida: uso inteligente da Digital Crown, feedback háptico bem implementado, persistência de estado robusta e integração com HealthKit. As melhorias propostas focam em **refinamento visual**, **acessibilidade**, **micro-interações** e **alinhamento com os padrões mais recentes do watchOS**.

---

## 2. Análise do Estado Atual

### 2.1 Pontos Fortes (manter)

- **Digital Crown para peso/reps** - Padrão nativo excelente, melhor que tapping repetitivo
- **Feedback háptico diversificado** - Usa `.start`, `.success`, `.directionUp`, `.failure`, `.click` nos momentos certos
- **Undo banner temporizado** - 3 segundos com animação spring, padrão moderno
- **PR badge ("Novo recorde!")** - Motivacional e bem posicionado
- **Persistência atômica de estado** - Sobrevive a crash/terminação do app
- **Rest timer circular** - Visual limpo e funcional
- **Indicadores de progresso (dots)** - Compactos e informativos

### 2.2 Problemas Identificados nas Capturas de Tela

**Screenshot 1 (Supino Reto com Halteres):**
- O banner "Série concluída" e o badge "Novo recorde!" competem por espaço visual na parte superior
- A informação "Série 3 de 3 - Exercício 1 de 6" usa fonte muito pequena e pode ser difícil de ler durante o treino
- O texto "Anterior 32 × 8 +0.5 kg" está muito pequeno e pouco legível com suor nos olhos
- A borda violeta no card de "Carga" indica foco, mas o card de "Reps" à direita não tem indicação visual de que é interativo (tap para focar)

**Screenshot 2 (Pulldown Barra Reta):**
- O texto "Superset - 2 de 2" compete com o nome do exercício
- O botão "Finalizar Treino" aparece no estado correto (última série do último exercício), mas poderia ter mais destaque visual
- O relógio do sistema (11:17) e o timer do treino (17:46) competem visualmente sem hierarquia clara

---

## 3. Melhorias Propostas

### PRIORIDADE ALTA - Impacto Visual e Usabilidade Imediata

#### 3.1 Hierarquia Tipográfica do Header
**Problema:** O header atual embala muita informação em fontes entre 9pt e 14pt, criando ruído visual durante o exercício.

**Proposta:** Reestruturar o header em 2 linhas máximas durante execução ativa:
- **Linha 1:** Nome do exercício (`.subheadline.bold`, mantido) + badge de superset inline
- **Linha 2:** Série X/Y + dots de progresso alinhados à direita (mantido, mas removendo "Exercício X de Y" que já é redundante com o swipe horizontal)

**Mover para o Dashboard (page 2):** Timer do treino e hora atual. Esses dados não são essenciais durante a execução de uma série e consomem espaço precioso.

**Código afetado:** `headerView(exercise:compact:)` no `ExerciseExecutionPage`

```swift
// ANTES (5 linhas de header):
// Linha 1: clock + timer | hora
// Linha 2: Superset · 2 de 2
// Linha 3: Nome do exercício
// Linha 4: Anterior 32 × 8 +0.5kg
// Linha 5: Série 3 de 3 · Exercício 1 de 6 | dots

// DEPOIS (3 linhas de header):
// Linha 1: Nome do exercício (+ badge superset inline)
// Linha 2: Anterior 32×8 → +0.5kg (com seta animada verde)
// Linha 3: Série 3/3 | dots
```

**Impacto:** Ganha ~20pt de altura vertical para os cards de input, que são o elemento mais importante da tela.

---

#### 3.2 Cards de Input Maiores com Feedback Visual Melhorado
**Problema:** Os `CrownInputCard` têm altura mínima de 60-70pt. Em telas menores (Apple Watch SE, 40mm), ficam apertados.

**Proposta:**
- Aumentar a fonte do valor de 32pt para 36pt (ou 28pt para 32pt no modo compact)
- Adicionar animação de escala sutil (`scaleEffect`) quando o valor muda via Digital Crown
- Mudar a cor do valor para verde quando supera o valor anterior (lastWeight/lastReps)
- Adicionar uma micro-animação de pulse no card quando recebe foco

```swift
// Sugestão de animação no CrownInputCard:
.scaleEffect(isValueChanging ? 1.05 : 1.0)
.animation(.spring(response: 0.15, dampingFraction: 0.6), value: currentValue)
```

**Impacto:** Os números são a informação mais crítica durante o treino. Torná-los mais legíveis e responsivos ao input melhora significativamente a experiência.

---

#### 3.3 Indicador Visual de "Qual Card Está com Foco"
**Problema:** Atualmente o foco é indicado por uma borda violeta fina (2px) e um fundo levemente diferente. Com suor e movimento, isso é insuficiente.

**Proposta:**
- Card sem foco: Manter fundo `kinevoCard` sem borda
- Card com foco: Borda violeta **3pt** + fundo com gradiente sutil de violeta (opacity 0.1 → 0.05)
- Adicionar um pequeno ícone da Digital Crown (SF Symbol `crown`) no canto do card focado
- Considerar usar `ContainerRelativeShape` do watchOS para bordas mais orgânicas

```swift
// Sugestão de indicador de foco mais visível:
.overlay(
    RoundedRectangle(cornerRadius: 12, style: .continuous)
        .stroke(
            isFocused ? Color.kinevoViolet : Color.clear,
            lineWidth: isFocused ? 3 : 0
        )
)
.overlay(alignment: .topTrailing) {
    if isFocused {
        Image(systemName: "digitalcrown.horizontal.arrow.clockwise")
            .font(.system(size: 8))
            .foregroundStyle(Color.kinevoViolet)
            .padding(4)
    }
}
```

---

#### 3.4 Botão "Concluir Série" com Estado de Confirmação
**Problema:** Um toque acidental no botão registra uma série com valores incorretos. O undo existe, mas é melhor prevenir.

**Proposta:** Implementar um sistema de confirmação por pressão longa ou duplo-tap:
- **Opção A (recomendada):** Toque simples mantém o comportamento atual, mas com animação de "preenchimento" de 0.3s antes de confirmar (como o botão de emergência do iOS). Se soltar antes, cancela.
- **Opção B:** Após tocar, o botão muda para "Confirmar ✓" por 1.5s. Se não confirmar, volta ao estado original.

**Nota:** Analisar dados de uso do undo. Se a taxa de undo for > 5%, esta melhoria é essencial.

---

#### 3.5 Rest Timer com Haptics Intermediários
**Problema:** O rest timer atual só envia haptic ao finalizar (`.success`). Apps como Hevy e Edge enviam haptics aos 30s e 10s restantes.

**Proposta:** Adicionar haptic checkpoints no `RestTimerSheet`:

```swift
.onReceive(ticker) { _ in
    // ... existing logic ...

    // Haptic intermediário: "quase lá"
    if newRemaining == 30 && timerState.seconds > 45 {
        WKInterfaceDevice.current().play(.directionUp)
    }
    if newRemaining == 10 {
        WKInterfaceDevice.current().play(.click)
    }
    // Haptic triplo no final para garantir percepção
    if newRemaining == 0 {
        WKInterfaceDevice.current().play(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            WKInterfaceDevice.current().play(.success)
        }
    }
}
```

**Impacto:** Reduz a necessidade de olhar para o relógio durante o descanso, que é exatamente o UX ideal.

---

### PRIORIDADE MÉDIA - Experiência e Polish

#### 3.6 Animação de Transição entre Séries
**Problema:** Ao completar uma série, o card de input simplesmente atualiza os valores sem transição visual.

**Proposta:** Adicionar uma micro-animação de "slide up" nos valores quando a série avança:

```swift
.transition(.asymmetric(
    insertion: .move(edge: .bottom).combined(with: .opacity),
    removal: .move(edge: .top).combined(with: .opacity)
))
```

---

#### 3.7 Progress Ring em Vez de Dots para Exercícios
**Problema:** Os dots de progresso são funcionais, mas não transmitem a sensação de "estou avançando" no treino como um todo.

**Proposta:** Substituir os dots por um mini progress ring (similar ao ring de atividade da Apple) no canto do header, mostrando progresso geral do treino (séries totais completadas / séries totais).

```swift
// Mini ring de progresso do treino
Circle()
    .trim(from: 0, to: overallProgress)
    .stroke(Color.kinevoViolet, style: StrokeStyle(lineWidth: 3, lineCap: .round))
    .frame(width: 20, height: 20)
    .rotationEffect(.degrees(-90))
```

Manter os dots para progresso do exercício individual, mas adicionar o ring para progresso geral.

---

#### 3.8 Estado Visual "Exercício Completo"
**Problema:** Quando todas as séries de um exercício são concluídas, a tela mostra "Próximo exercício >" com uma seta animada. Isso é bom, mas poderia ser mais celebratório.

**Proposta:**
- Adicionar um efeito de "confetti" sutil (2-3 partículas violeta) quando a última série do exercício é completada
- Mudar o background momentaneamente para um gradiente violeta suave
- O texto "Próximo exercício" poderia mostrar o nome do próximo exercício para dar contexto

```swift
// Mostrar nome do próximo exercício
if let nextExercise = store.state?.exercises[safe: exerciseIndex + 1] {
    Text(nextExercise.name)
        .font(.caption2)
        .foregroundStyle(.secondary)
}
```

---

#### 3.9 Melhoria no Banner de Undo
**Problema:** O banner de undo atual (`undoBannerView`) ocupa a área superior e pode cobrir informações do header.

**Proposta:**
- Mover o banner de undo para a parte **inferior** da tela, sobre o botão de "Concluir Série" (que já não é relevante, pois a série acabou de ser concluída)
- Adicionar um gesto de swipe-left para desfazer (mais ergonômico que tocar no texto "Desfazer")
- Incluir os valores registrados em destaque: "32.5kg × 9 reps ✓"

---

#### 3.10 Superset: Indicador Visual de Grupo
**Problema:** O texto "Superset - 2 de 2" é funcional, mas não cria uma conexão visual clara entre exercícios do mesmo grupo.

**Proposta:**
- Adicionar uma barra lateral colorida (2pt de largura) no lado esquerdo do header quando o exercício faz parte de um superset
- Usar cores alternadas para supersets diferentes (violeta para superset 1, cyan para superset 2)
- Mostrar um ícone de link/corrente entre exercícios do mesmo grupo

---

#### 3.11 Tela de Início do Treino Mais Engajante
**Problema:** A `startView` mostra ícone genérico + nome + contagem de exercícios. É funcional mas não inspira.

**Proposta:**
- Mostrar preview dos primeiros 3 exercícios com pesos anteriores
- Indicar se há PRs a bater ("2 exercícios perto do recorde!")
- Adicionar animação de entrada com scale + opacity
- Mostrar tempo estimado do treino baseado em histórico

---

#### 3.12 Tela de Conclusão com Estatísticas
**Problema:** A `successFinishView` mostra apenas checkmark + "Treino Concluído!" + "Seu resultado já está no celular."

**Proposta:** Enriquecer com estatísticas rápidas:
- Total de séries completadas
- Peso total movimentado (volume)
- Número de PRs batidos
- Duração do treino
- Animação de "celebração" mais elaborada (ring de conclusão preenchendo)

---

### PRIORIDADE BAIXA - Refinamento e Acessibilidade

#### 3.13 Dynamic Type / Acessibilidade
**Problema:** O código usa tamanhos de fonte fixos em todos os componentes (`.system(size: 32)`, `.system(size: 10)`, etc.). Isso ignora completamente o Dynamic Type do usuário.

**Proposta:**
- Para textos secundários: Migrar de `.system(size: X)` para text styles do sistema (`.caption`, `.caption2`, `.body`)
- Para valores numéricos grandes: Manter tamanho fixo mas respeitar o `minimumScaleFactor` existente
- Adicionar labels de acessibilidade em todos os elementos interativos:

```swift
CrownInputCard(...)
    .accessibilityLabel("Carga: \(currentWeight) quilos")
    .accessibilityHint("Gire a Digital Crown para ajustar")
```

---

#### 3.14 Suporte a VoiceOver
**Problema:** Nenhum componente tem `.accessibilityLabel` ou `.accessibilityValue` customizado.

**Proposta:** Adicionar acessibilidade em todos os componentes interativos:
- CrownInputCard: label descritivo + value + hint
- Botão "Concluir Série": incluir contexto ("Concluir série 2 de 3, Supino Reto, 32.5kg × 9 reps")
- Set progress dots: "3 de 5 séries concluídas"
- Rest timer: anunciar tempo restante periodicamente

---

#### 3.15 Modo Compacto Mais Agressivo
**Problema:** O `compact` flag (detectado quando `proxy.size.height < 170`) ajusta apenas tamanhos de fonte e espaçamento minimamente.

**Proposta:** No modo compact, aplicar transformações mais agressivas:
- Esconder o texto "Anterior X × Y" completamente
- Reduzir o header a uma única linha: "Supino 3/3 ●●●"
- Aumentar a área dos cards de input proporcionalmente

---

#### 3.16 Cor Dinâmica para Cardio
**Problema:** O `CardioExecutionView` usa `.cyan` como cor primária, que funciona bem, mas as cores de fase ("TRABALHO" em vermelho, "DESCANSO" em verde) poderiam ser mais sofisticadas.

**Proposta:**
- TRABALHO: Gradiente de vermelho-alaranjado, pulsando suavemente
- DESCANSO: Verde suave que fica mais intenso conforme o tempo acaba
- PREPARE-SE: Animação de zoom no countdown (scale de 1.5 → 1.0 a cada segundo)

---

#### 3.17 Suporte a Always-On Display
**Problema:** O código não implementa lógica específica para o Always-On Display (AOD) do Apple Watch.

**Proposta:** Quando o pulso está abaixado e a tela está em AOD:
- Mostrar apenas: nome do exercício + série atual + timer do descanso (se ativo)
- Reduzir brilho e complexidade visual
- Usar `TimelineView` para atualizações eficientes

```swift
.onChange(of: scenePhase) { newPhase in
    if newPhase == .inactive {
        // Simplificar UI para AOD
    }
}
```

---

#### 3.18 Navegação com Gestos Aprimorada
**Problema:** A navegação entre exercícios é por swipe horizontal no TabView com `.page(indexDisplayMode: .never)`. O index display está oculto, o que é bom para espaço, mas remove contexto de posição.

**Proposta:**
- Adicionar indicador de página customizado na parte inferior (3 dots minimalistas) mostrando posição no carrossel
- Implementar "snap" feedback háptico (`.click`) ao trocar de exercício
- Considerar navegação por Digital Crown quando nenhum card está focado (swipe vertical no watchOS 10+ é mais natural)

---

#### 3.19 Loading States e Skeleton Views
**Problema:** O `emptyView` mostra um ícone e texto estático. Se houver latência na comunicação com iPhone, o usuário não tem feedback.

**Proposta:** Implementar skeleton loading com shimmer effect enquanto dados são carregados, e um indicador de sincronização no canto superior.

---

## 4. Melhorias Técnicas (não visuais, mas impactam UX)

#### 4.1 Debounce da Digital Crown
**Status atual:** O store já faz debounce de 500ms para persistência. Bom.

**Melhoria:** Adicionar debounce visual separado de 100ms para evitar flickering nos valores numéricos quando a crown gira rápido.

#### 4.2 Pre-load do Próximo Exercício
Quando o usuário está na última série de um exercício, já carregar os dados do próximo exercício em memória para transição instantânea.

#### 4.3 Otimização de Redraws
O `GeometryReader` no `ExerciseExecutionPage` força relayout completo em mudanças de estado. Considerar extrair o check de `compact` para um `@Environment` value para evitar recálculos desnecessários.

#### 4.4 Watch Complications
Adicionar complication que mostra o próximo treino agendado ou progresso do treino atual na watch face. Isso aumenta engajamento e é recomendado pelas diretrizes da Apple.

#### 4.5 Live Activity / Smart Stack Widget
Com watchOS 10+, criar um widget para o Smart Stack que mostra o exercício atual durante o treino, permitindo glance sem abrir o app.

---

## 5. Análise Competitiva - O que Aprender

| Feature | Hevy | Strong | Fitbod | Kinevo (Atual) | Recomendação |
|---------|------|--------|--------|----------------|--------------|
| Rest timer haptics intermediários | Sim (30s, 10s) | Sim | Sim | Apenas no final | Implementar (3.5) |
| Tipo de série (warmup/drop/failure) | Sim | Sim | N/A | Não | Considerar para v2 |
| Watch complication | Sim | Sim | Sim | Não | Implementar (4.4) |
| Standalone (sem iPhone) | Sim | Parcial | Não | Não (requer iPhone) | Avaliar viabilidade |
| PR tracking visual | Badge simples | Badge + histórico | Gráfico | Badge 2s | Estender duração + animação (3.2) |
| Feedback visual set complete | Checkmark + haptic | Haptic + som | Animação | Banner + haptic | Adicionar animação (3.6) |
| Acessibilidade/VoiceOver | Bom | Básico | Bom | Ausente | Implementar (3.13, 3.14) |
| Always-On Display | Sim | Não | Parcial | Não | Implementar (3.17) |

---

## 6. Roadmap Sugerido

### Sprint 1 (1-2 semanas) - Quick Wins
- 3.5 Rest Timer com haptics intermediários
- 3.3 Indicador de foco mais visível nos cards
- 3.2 Cards de input com animação de escala
- 3.14 Accessibility labels básicos

### Sprint 2 (2-3 semanas) - Header e Layout
- 3.1 Reestruturar hierarquia do header
- 3.7 Mini progress ring do treino
- 3.9 Mover banner de undo para baixo
- 3.15 Modo compacto mais agressivo

### Sprint 3 (2-3 semanas) - Polish e Celebração
- 3.6 Animações de transição entre séries
- 3.8 Estado visual "exercício completo" celebratório
- 3.12 Tela de conclusão com estatísticas
- 3.11 Tela de início mais engajante

### Sprint 4 (3-4 semanas) - Platform Features
- 4.4 Watch Complications
- 4.5 Smart Stack Widget
- 3.17 Always-On Display
- 3.10 Superset visual refinado

---

## 7. Métricas de Sucesso

Para avaliar o impacto das melhorias, sugiro monitorar:

- **Taxa de undo por treino** (deve diminuir com 3.4)
- **Tempo médio entre abrir o app e iniciar primeiro exercício** (deve diminuir com 3.11)
- **Porcentagem de treinos finalizados via watch vs. iPhone** (deve aumentar com todas as melhorias)
- **Retenção de uso do watch app semana a semana** (métrica principal)
- **Feedback qualitativo** sobre legibilidade e facilidade de uso

---

## 8. Conclusão

O Kinevo Watch já está no top tier técnico: Digital Crown input, HealthKit, persistência atômica e sync bidirecional são features que muitos concorrentes não têm. As melhorias propostas focam em transformar essa base sólida em uma experiência visualmente refinada e emocionalmente engajante.

As 5 melhorias de maior impacto-por-esforço são: **haptics intermediários no rest timer (3.5)**, **cards de input maiores com animação (3.2)**, **reestruturação do header (3.1)**, **accessibility labels (3.14)** e **tela de conclusão com estatísticas (3.12)**.

O objetivo final: que o usuário prefira treinar pelo Watch em vez do iPhone, porque a experiência é mais rápida, mais natural e menos intrusiva.
