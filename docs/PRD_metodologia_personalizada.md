# ⚡ KINEVO — Metodologia Personalizada por Treinador
> **Product Requirements Document (PRD) v1.0 — Confidencial**

| | |
|---|---|
| Versão | 1.0 |
| Status | Planejamento — Implementar após validação do módulo base |
| Autor | Gustavo — Fundador Kinevo |
| Dependência | Módulo de Prescrição Inteligente (feature/ai-prescription) em produção |
| Data | Fevereiro 2026 |

---

## 1. Visão Geral

### 1.1 O Problema

O módulo de Prescrição Inteligente atual usa a metodologia Kinevo — que é a metodologia do fundador. Quando outros treinadores usam o produto, a IA prescreve no estilo do Gustavo, não no estilo deles. Treinadores experientes com metodologias próprias vão editar a maioria dos programas gerados, percebendo a IA como pouco útil — não porque a IA seja ruim, mas porque ela não aprendeu com eles.

### 1.2 A Oportunidade

Transformar a IA de um sistema com uma metodologia fixa em um sistema que aprende com cada treinador individualmente. Cada treinador documenta sua forma de pensar sobre prescrição, e a IA passa a prescrever no estilo dele — não no estilo de outra pessoa.

### 1.3 A Proposta de Valor

> *"A IA do Kinevo aprende como você prescreve — não como alguém else prescreve. Quanto mais você usa, mais ela se torna sua."*

---

## 2. Como Funciona — Visão do Treinador

O treinador acessa **Configurações → Minha Metodologia** e preenche seções estruturadas uma única vez. A partir daí, todo programa gerado pela IA reflete suas preferências.

### 2.1 Seções da Metodologia

**Seção 1 — Filosofia de Treino** *(texto livre, ~200 palavras)*
O treinador descreve como pensa sobre prescrição em linguagem natural. Exemplos de o que ele escreveria:

> *"Priorizo sempre movimentos livres antes de máquinas, independente do nível. Para iniciantes, começo com agachamento goblet com kettlebell antes de passar para barra. Acredito que volume alto para iniciantes é o maior erro do mercado — prefiro 2-3 séries por grupo nas primeiras 4 semanas."*

**Seção 2 — Preferências por Objetivo** *(seleção estruturada)*

Para cada objetivo (hipertrofia, emagrecimento, força, saúde), o treinador configura:
- Exercícios que sempre inclui
- Exercícios que nunca inclui
- Faixa de repetições preferida
- Estrutura preferida por frequência

**Seção 3 — Regras Específicas** *(lista de regras em linguagem natural)*

Regras que ele sempre aplica independente do aluno:
- *"Nunca prescrevo leg press para alunos com histórico de joelho"*
- *"Sempre incluo mobilidade de quadril antes de treino de pernas"*
- *"Para emagrecimento, prefiro circuitos em vez de séries tradicionais"*

**Seção 4 — Exercícios Favoritos por Grupo Muscular** *(curadoria da biblioteca)*

Para cada grupo muscular, o treinador marca os 3-5 exercícios que mais prescreve. A IA prioriza esses exercícios antes de qualquer outro.

**Seção 5 — Exemplos de Aprovação** *(automático, sem preenchimento manual)*

Cada programa gerado pela IA que o treinador aprova **sem edição** vira automaticamente um exemplo positivo de aprendizado. Cada edição feita antes da aprovação vira um sinal de ajuste.

---

## 3. Como Funciona — Visão Técnica

### 3.1 Banco de Dados

**Nova coluna em `trainers`:**

```sql
ALTER TABLE public.trainers
  ADD COLUMN methodology_config JSONB DEFAULT '{}'::jsonb;
```

**Estrutura do JSONB:**

```json
{
  "philosophy": "Texto livre da filosofia do treinador...",
  "rules": [
    "Nunca prescrevo leg press para joelho comprometido",
    "Sempre mobilidade antes de pernas"
  ],
  "preferences_by_goal": {
    "hypertrophy": {
      "preferred_exercise_ids": ["uuid1", "uuid2"],
      "avoided_exercise_ids": ["uuid3"],
      "rep_range": { "min": 6, "max": 12 },
      "preferred_structure": "upper_lower"
    }
  },
  "favorite_exercises_by_group": {
    "Peito": ["uuid1", "uuid2", "uuid3"],
    "Costas": ["uuid4", "uuid5"]
  },
  "approval_examples_count": 12,
  "last_updated": "2026-02-25T00:00:00Z"
}
```

### 3.2 Integração com o Motor de Prescrição

**`prompt-builder.ts`** — injetar metodologia no system prompt:

```
SEÇÃO 6 — Metodologia do Treinador (dinâmica, por treinador):
- Filosofia: [methodology_config.philosophy]
- Regras específicas: [methodology_config.rules]
- Preferências para este objetivo: [methodology_config.preferences_by_goal[goal]]
```

**`program-builder.ts`** — usar favoritos como peso extra no shuffle:

```typescript
// Exercícios favoritos do treinador têm peso 3x no sorteio
// Exercícios evitados pelo treinador são excluídos dos candidatos
```

**`generate-program.ts`** — carregar `methodology_config` junto com o perfil do aluno e passar para o engine.

### 3.3 Aprendizado Contínuo (Fase 2)

Quando o treinador aprova um programa sem edição:
```
prescription_generations.trainer_edits_count = 0
→ Registrar exercícios aprovados como reforço positivo
→ Incrementar peso desses exercícios nas próximas gerações
```

Quando o treinador troca um exercício:
```
exercício_removido → peso reduzido para este treinador + nível + objetivo
exercício_adicionado → peso aumentado para este treinador + nível + objetivo
```

---

## 4. Interface — Tela de Configuração

### 4.1 Localização

`Configurações → Minha Metodologia` — nova aba nas configurações do treinador.

### 4.2 Estrutura da Tela

```
┌─────────────────────────────────────────────┐
│  ✨ Minha Metodologia                        │
│  Configure como a IA aprende com você       │
├─────────────────────────────────────────────┤
│  [Filosofia de Treino]      ← Textarea      │
│  [Regras Específicas]       ← Lista dynamic │
│  [Preferências por Objetivo]← Tabs/cards    │
│  [Exercícios Favoritos]     ← Multi-select  │
│                                             │
│  📊 Status do Aprendizado                   │
│  12 programas aprovados sem edição          │
│  3 padrões de substituição identificados    │
│                             [Salvar]        │
└─────────────────────────────────────────────┘
```

### 4.3 Onboarding Guiado

Na primeira vez que o treinador acessa, mostrar um wizard de 3 passos:

1. *"Descreva sua filosofia de treino"* — campo de texto com exemplos sugestivos
2. *"Selecione seus exercícios favoritos"* — filtrado por grupo muscular
3. *"Adicione suas regras específicas"* — lista com exemplos pré-preenchidos que ele pode aceitar ou rejeitar

Tempo estimado de preenchimento: 10-15 minutos.

---

## 5. Por Que Isso é Impossível de Copiar

### 5.1 O Ativo que se Acumula

Cada treinador que configura sua metodologia cria um ativo intangível dentro do Kinevo:
- Sua filosofia documentada
- Seus padrões de aprovação/rejeição acumulados
- Seus exercícios favoritos calibrados

Migrar para outro sistema significa perder tudo isso e recomeçar do zero.

### 5.2 O Efeito Composto

| Tempo de uso | O que a IA aprendeu |
|---|---|
| Semana 1 | Filosofia e regras declaradas (configuração manual) |
| Mês 1 | 20-30 programas aprovados — padrões de exercícios emergem |
| Mês 3 | 80-100 programas — a IA raramente precisa de edição |
| Mês 6 | A IA prescreve melhor que qualquer plataforma genérica |

### 5.3 Diferenciação por Segmento

| Tipo de Treinador | Valor Percebido |
|---|---|
| Iniciante (1-5 anos) | Aprende com a metodologia Kinevo como base, depois personaliza |
| Experiente (5-10 anos) | A IA replica sua metodologia em escala |
| Especialista (atletas, reabilitação) | Regras específicas garantem que casos complexos sejam tratados corretamente |

---

## 6. Métricas de Sucesso

| Métrica | Meta em 90 dias |
|---|---|
| Treinadores que completam a configuração | > 60% dos ativos |
| Redução de edições após configuração | -40% vs. sem configuração |
| Taxa de aprovação sem edição (Modo 1) | > 85% para treinadores com metodologia configurada |
| NPS do módulo após configuração | > 65 (vs. 50 sem configuração) |

---

## 7. Roadmap de Implementação

### Fase 1 — MVP da Configuração (Semanas 1-2)

> **Objetivo:** Treinador consegue declarar sua metodologia e a IA a usa
> **Entrega:** Tela de configuração + integração no prompt

| Tarefa | Estimativa |
|---|---|
| Migração: `methodology_config JSONB` em `trainers` | 0.5 dia |
| Tela de configuração (filosofia + regras + favoritos) | 3 dias |
| Server action: `save-methodology-config` | 1 dia |
| Integrar `methodology_config` no `prompt-builder.ts` | 1 dia |
| Integrar exercícios favoritos no `program-builder.ts` | 1 dia |
| Testes internos com 2-3 treinadores | 1 semana |

### Fase 2 — Aprendizado Contínuo (Semanas 3-6)

> **Objetivo:** A IA melhora automaticamente com cada aprovação/edição

| Tarefa | Estimativa |
|---|---|
| Engine de reforço positivo (aprovação sem edição) | 2 dias |
| Engine de ajuste por substituição (edições registradas) | 3 dias |
| Dashboard de aprendizado para o treinador | 2 dias |
| Onboarding wizard (primeira configuração) | 2 dias |

### Fase 3 — Inteligência Avançada (Semanas 7-10)

> **Objetivo:** A metodologia evolui com dados reais de aderência dos alunos

| Tarefa | Estimativa |
|---|---|
| Correlação metodologia → aderência do aluno | 3 dias |
| Sugestões automáticas de refinamento para o treinador | 2 dias |
| Comparativo anônimo entre metodologias (benchmarking) | 3 dias |

---

## 8. Pré-requisitos para Iniciar

Antes de implementar, o fundador deve:

- [ ] Usar o módulo base por **mínimo 2 semanas** com alunos reais
- [ ] Registrar cada edição feita e o motivo — esse log vira a metodologia documentada
- [ ] Identificar os 10-15 exercícios que mais substitui — esses são os primeiros candidatos para `favorite_exercises_by_group`
- [ ] Validar que a taxa de aprovação sem edição está > 50% antes de expandir para outros treinadores

> *O sistema de metodologia personalizada só faz sentido quando o módulo base já está gerando programas razoáveis. Implementar antes disso é construir personalização em cima de uma base ruim.*

---

## 9. Decisões em Aberto

| Decisão | Opções | Recomendação |
|---|---|---|
| Metodologia Kinevo como padrão | Usar como base para todos ou pedir configuração no onboarding | Usar como base, treinador pode sobrescrever |
| Compartilhamento de metodologia | Metodologia privada ou treinador pode "publicar" sua metodologia para outros | Privada na v1, publicação na v2 |
| Limite de regras específicas | Sem limite ou máximo de 20 regras | Máximo 20 — prompts longos degradam qualidade da IA |
| Visibilidade do aprendizado | Treinador vê o que a IA aprendeu ou é caixa preta | Transparência total — treinador vê e pode corrigir |

---

*⚡ Kinevo — Metodologia Personalizada por Treinador | PRD v1.0 | Fevereiro 2026 | Confidencial*
