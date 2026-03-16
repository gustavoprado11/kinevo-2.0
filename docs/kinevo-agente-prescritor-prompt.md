# Kinevo — Agente Prescritor Evoluído
## Prompt para Claude Code

---

## 1. CONTEXTO DO PROJETO

**Produto:** Kinevo — SaaS de gestão para personal trainers  
**Stack:** Next.js + React + Tailwind CSS + Radix UI (frontend) | Supabase (PostgreSQL + Auth + RLS) | Vercel (deploy)  
**Módulo:** Evolução do módulo de prescrição de treinos com IA

O Kinevo já possui um módulo de prescrição com IA que recebe um formulário simples (objetivo + nível do aluno) e gera um programa de treinos. O output abre diretamente no builder do sistema para o treinador revisar e ajustar.

**O que existe hoje:**
- Formulário de input com campos: objetivo, nível do aluno
- Chamada à API da Anthropic com system prompt básico
- Output em JSON que popula o builder de programas

**O que será construído:**
- Evolução para um agente com loop de raciocínio multi-turn
- Enriquecimento automático de contexto via Supabase
- Web search para embasamento em evidências científicas
- Sistema de perguntas pontuais antes da geração
- Output com racional das decisões

---

## 2. OBJETIVO DA FEATURE

Transformar o prescritor de um **gerador de template** em um **agente que raciocina antes de gerar**.

O agente deve:
1. Coletar contexto rico do aluno automaticamente do banco de dados
2. Analisar o contexto e identificar lacunas críticas
3. Fazer perguntas específicas ao treinador quando necessário (máximo 3)
4. Pesquisar evidências científicas antes de gerar
5. Gerar o programa com racional das decisões
6. Abrir o programa no builder existente para revisão

---

## 3. FLUXO DO AGENTE

```
[ETAPA 1 — COLETA]
Treinador seleciona o aluno + informa objetivo do ciclo
Sistema busca automaticamente no Supabase:
  - Histórico de programas anteriores (últimos 2 ciclos)
  - Resultados de avaliações físicas
  - Lesões e restrições registradas
  - Frequência e aderência recente (últimas 4 semanas)
  - Equipamentos disponíveis (perfil do aluno)

[ETAPA 2 — ANÁLISE]
Agente recebe todo o contexto e raciocina internamente:
  - Quais são os dados disponíveis?
  - Há lacunas críticas para prescrever com segurança?
  - Existem restrições que mudam a prescrição?
  - O objetivo atual é consistente com o histórico?

[ETAPA 3 — DECISÃO DE PERGUNTAS]
SE há lacunas críticas:
  → Retorna 1 a 3 perguntas específicas e contextualizadas ao treinador
  → Treinador responde em linguagem natural
  → Volta à Etapa 2 com contexto enriquecido
SE o contexto é suficiente:
  → Avança para Etapa 4

[ETAPA 4 — PESQUISA DE EVIDÊNCIAS]
Web search com queries direcionadas ao objetivo + nível + restrições
Exemplos de queries geradas pelo agente:
  - "volume semanal hipertrofia iniciante revisão sistemática"
  - "substituição agachamento livre dor lombar evidência"
  - "periodização linear força intermediário protocolo"

[ETAPA 5 — GERAÇÃO]
Agente gera:
  a) Programa estruturado em JSON (formato do builder existente)
  b) Racional das principais decisões (texto curto, 3-5 pontos)

[ETAPA 6 — ENTREGA]
Programa abre no builder para revisão
Racional exibido em painel lateral colapsável
```

---

## 4. INTERFACE DO USUÁRIO

### 4.1 Ponto de entrada
Botão "Prescrever com IA" na página do aluno (já existe — manter).

### 4.2 Modal/Drawer do Agente
Substituir o formulário atual por uma interface conversacional em etapas:

**Etapa 1 — Contexto do Ciclo**
```
Campo: Objetivo principal deste ciclo
  (ex: Hipertrofia, Emagrecimento, Força, Condicionamento)
Campo: Dias disponíveis por semana
  (select: 2, 3, 4, 5, 6)
Campo: Duração por sessão
  (select: 30min, 45min, 60min, 75min, 90min+)
Botão: "Analisar"
```

**Etapa 2 — Análise em progresso**
```
Loading state com etapas visíveis:
  ✓ Carregando histórico do aluno
  ✓ Lendo avaliações físicas
  ⟳ Analisando contexto...
```

**Etapa 3 — Perguntas (se necessário)**
```
Card com título: "Preciso de mais algumas informações"
Subtítulo: "Com base no histórico de [Nome], tenho X dúvidas antes de prescrever:"

Pergunta 1: [texto contextualizado]
  Input: textarea livre

Pergunta 2 (se houver): [texto contextualizado]
  Input: textarea livre

Botão: "Responder e Gerar"
```

**Etapa 4 — Pesquisando evidências**
```
Loading state:
  ✓ Perguntas respondidas
  ⟳ Pesquisando evidências científicas...
  ○ Gerando programa...
```

**Etapa 5 — Programa gerado**
```
Toast: "Programa gerado com sucesso"
→ Abre builder com programa pré-preenchido
→ Painel lateral: "Racional do Agente" (colapsável)
```

### 4.3 Painel Racional (colapsável, no builder)
```
🧠 Racional do Agente

• Frequência: Full body 3x/semana — adequado para nível iniciante
  e objetivo de hipertrofia (Schoenfeld et al., 2016)

• Volume: 12-16 séries/semana por grupo muscular — faixa ótima
  para iniciantes sem histórico de treino resistido

• Restrição lombar: Agachamento livre substituído por leg press
  e cadeira extensora conforme restrição registrada em 15/03

• Progressão: Linear simples — adicionar 2.5kg por sessão em
  exercícios compostos até falha na adaptação

[Fechar racional]
```

---

## 5. SYSTEM PROMPT DO AGENTE

O system prompt deve ser passado na chamada à API da Anthropic. Usar exatamente este conteúdo como base, adaptando variáveis dinamicamente:

```
Você é o Agente Prescritor do Kinevo, um assistente especializado em prescrição de exercícios baseada em evidências para personal trainers.

SUA METODOLOGIA BASE:
- Foco em aderência antes de otimização — o melhor treino é o que o aluno faz
- Periodização linear para iniciantes e intermediários
- Volume escalado por nível: iniciante (10-15 séries/sem), intermediário (15-20), avançado (18-25)
- Full body para frequências baixas (2-3x/sem), splits para frequências altas (4x+)
- Ciclos de 4 semanas com reavaliação
- Evitar erros comuns: volume excessivo para iniciantes, excesso de isolados, complexidade desnecessária

CONTEXTO DO ALUNO:
{{DADOS_DO_ALUNO}}

OBJETIVO DO CICLO:
{{OBJETIVO}}

DISPONIBILIDADE:
{{DISPONIBILIDADE}}

RESPOSTAS ÀS PERGUNTAS (se houver):
{{RESPOSTAS}}

EVIDÊNCIAS PESQUISADAS:
{{RESULTADOS_WEB_SEARCH}}

COMPORTAMENTO ESPERADO:

Fase de Análise:
1. Leia todo o contexto do aluno cuidadosamente
2. Identifique lacunas críticas para uma prescrição segura e eficaz
3. Lacunas críticas incluem: restrições físicas ambíguas, divergência entre objetivo e histórico, ausência de dados de experiência prévia
4. NÃO são lacunas críticas: informações complementares, preferências estéticas, detalhes de rotina

Fase de Perguntas (apenas se necessário):
- Formule no máximo 3 perguntas
- Cada pergunta deve ser específica e contextualizada com o nome do aluno
- Exemplo bom: "João tem dor lombar registrada em março. Essa restrição ainda é ativa ou foi liberada?"
- Exemplo ruim: "O aluno tem alguma lesão?"
- Se o contexto for suficiente, PULE esta fase e vá direto para geração

Fase de Geração:
Gere um JSON estruturado com o programa de treinos no seguinte formato:

{
  "programa": {
    "nome": "string",
    "objetivo": "string",
    "nivel": "string",
    "duracao_semanas": number,
    "frequencia_semanal": number,
    "sessoes": [
      {
        "nome": "string",
        "dia_sugerido": "string",
        "exercicios": [
          {
            "nome": "string",
            "series": number,
            "repeticoes": "string",
            "descanso_segundos": number,
            "observacao": "string"
          }
        ]
      }
    ]
  },
  "racional": [
    {
      "decisao": "string",
      "justificativa": "string",
      "referencia": "string (opcional)"
    }
  ],
  "perguntas_para_treinador": [
    "string"
  ]
}

Se ainda estiver na fase de análise e houver lacunas, retorne APENAS o campo "perguntas_para_treinador" com as perguntas. Não gere o programa ainda.

Se o contexto for suficiente, retorne o programa completo com racional e deixe "perguntas_para_treinador" como array vazio.

IMPORTANTE: Nunca gere um programa incompleto ou genérico. Se faltar contexto crítico, pergunte. Se o contexto for suficiente, gere com qualidade total.
```

---

## 6. IMPLEMENTAÇÃO TÉCNICA

### 6.1 Novo hook: `useAgentePrescitor`

Criar em `/hooks/useAgentePrescitor.ts`:

```typescript
interface AgenteState {
  etapa: 'coleta' | 'analisando' | 'perguntas' | 'pesquisando' | 'gerando' | 'concluido' | 'erro'
  perguntas: string[]
  respostas: Record<number, string>
  programa: ProgramaGerado | null
  racional: RacionalItem[]
  erro: string | null
}

// Funções principais:
// iniciarPrescricao(alunoId, objetivo, disponibilidade) → busca contexto + chama agente
// responderPerguntas(respostas) → enriquece contexto + chama agente novamente
// resetarAgente() → limpa estado
```

### 6.2 Nova Server Action: `prescreverComAgente`

Criar em `/app/actions/agente-prescritor.ts`:

```typescript
// Etapa 1: buscar contexto do aluno no Supabase
async function buscarContextoAluno(alunoId: string) {
  // Buscar:
  // - supabase: tabela 'programas' (últimos 2, com exercícios)
  // - supabase: tabela 'avaliacoes' (mais recente)
  // - supabase: tabela 'alunos' (lesões, restrições, equipamentos)
  // - supabase: tabela 'sessoes_realizadas' (últimas 4 semanas para calcular aderência)
}

// Etapa 2: chamar Claude com web search
async function chamarAgente(contexto, objetivo, disponibilidade, respostas?) {
  // Chamar API da Anthropic com:
  // - model: "claude-sonnet-4-20250514"
  // - tools: [{ type: "web_search_20250305", name: "web_search" }]
  // - system: SYSTEM_PROMPT com variáveis preenchidas
  // - messages: histórico da conversa
  // Retornar: { perguntas } ou { programa, racional }
}
```

### 6.3 Adaptação do Builder existente

- Adicionar prop `racionalItems` ao componente do builder
- Renderizar painel lateral colapsável quando `racionalItems` não for vazio
- Manter todo o comportamento atual de edição intacto

### 6.4 Queries Supabase necessárias

```sql
-- Histórico de programas
SELECT p.*, pe.* 
FROM programas p
LEFT JOIN programa_exercicios pe ON pe.programa_id = p.id
WHERE p.aluno_id = $1
ORDER BY p.created_at DESC
LIMIT 2;

-- Avaliação mais recente
SELECT * FROM avaliacoes
WHERE aluno_id = $1
ORDER BY data_avaliacao DESC
LIMIT 1;

-- Aderência recente (últimas 4 semanas)
SELECT 
  COUNT(*) as sessoes_realizadas,
  COUNT(*) FILTER (WHERE status = 'concluida') as concluidas
FROM sessoes
WHERE aluno_id = $1
AND data >= NOW() - INTERVAL '28 days';
```

---

## 7. CRITÉRIOS DE ACEITAÇÃO

### Funcionais
- [ ] O agente busca dados do aluno automaticamente — treinador não precisa preencher o que já está no sistema
- [ ] O agente retorna perguntas antes de gerar quando há lacunas críticas
- [ ] O agente pula a etapa de perguntas quando o contexto é suficiente
- [ ] O agente usa web search para embasar decisões de volume, intensidade e seleção de exercícios
- [ ] O programa gerado respeita restrições físicas registradas no sistema
- [ ] O racional exibe 3-5 decisões principais com justificativas
- [ ] O programa abre no builder existente sem quebrar nenhuma funcionalidade atual
- [ ] O painel de racional é colapsável e não interfere no fluxo de edição

### Qualidade da prescrição
- [ ] Volume dentro das faixas por nível (iniciante: 10-15 séries/sem por grupo)
- [ ] Frequência coerente com disponibilidade informada
- [ ] Exercícios compostos priorizados sobre isolados (especialmente para iniciantes)
- [ ] Restrições físicas respeitadas com substituições adequadas
- [ ] Nomenclatura de exercícios compatível com o banco de exercícios do Kinevo

### UX
- [ ] Loading states visíveis em cada etapa do processo
- [ ] Perguntas claramente contextualizadas com o nome do aluno
- [ ] Tempo total do fluxo (sem perguntas) inferior a 30 segundos
- [ ] Possibilidade de cancelar o processo em qualquer etapa
- [ ] Mensagem de erro clara se a API falhar

---

## 8. ARQUIVOS A CRIAR/MODIFICAR

```
CRIAR:
/hooks/useAgentePrescitor.ts
/app/actions/agente-prescritor.ts
/components/agente-prescritor/ModalAgente.tsx
/components/agente-prescritor/EtapaColeta.tsx
/components/agente-prescritor/EtapaAnalisando.tsx
/components/agente-prescritor/EtapaPerguntas.tsx
/components/agente-prescritor/EtapaPesquisando.tsx
/components/agente-prescritor/PainelRacional.tsx

MODIFICAR:
/components/builder/ProgramaBuilder.tsx (adicionar prop racionalItems + PainelRacional)
/app/alunos/[id]/page.tsx (substituir botão prescritor atual pelo novo modal)
/app/api/prescricao/route.ts (adaptar endpoint para novo fluxo, se existir)
```

---

## 9. NOTAS IMPORTANTES PARA O CLAUDE CODE

1. **Manter compatibilidade total** com o builder existente — não quebrar nenhuma funcionalidade atual de edição de programas

2. **O JSON de output do agente** deve ser idêntico ao formato que o builder já consume hoje — verificar o formato atual antes de implementar

3. **Web search** deve ser usado via tool use da API da Anthropic (`type: "web_search_20250305"`) — não via fetch externo

4. **O loop multi-turn** é implementado mantendo o histórico de mensagens em memória no estado do hook — não persiste no banco de dados

5. **RLS do Supabase** — garantir que as queries usam o cliente autenticado do servidor (createServerClient), não o cliente público

6. **Tratamento de erros** — se a API da Anthropic falhar, oferecer fallback para o prescritor atual (formulário simples), nunca deixar o treinador sem saída

7. **Variáveis de ambiente** — a chave da API da Anthropic já deve estar em `ANTHROPIC_API_KEY` no Vercel

---

*Documento gerado para uso com Claude Code. Versão 1.0 — Kinevo Agente Prescritor.*
