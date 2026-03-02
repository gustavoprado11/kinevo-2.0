# KINEVO — Módulo de Prescrição Inteligente
## Guia de Implementação para Claude Code

---

## 🔴 LEIA ISTO PRIMEIRO — Antes de qualquer ação

Você está prestes a implementar o **Módulo de Prescrição Inteligente** no Kinevo.

**Sua primeira obrigação não é escrever código. É entender o projeto.**

Todo código, schema SQL e decisão de arquitetura neste documento são **referências conceituais**, não instruções para copiar e colar. Antes de propor qualquer implementação, você deve ler o código existente e derivar a estratégia a partir do que já existe — não do que está escrito aqui.

Se você propuser código sem ter lido os arquivos do projeto primeiro, estará errado por definição.

---

## 🎯 Contexto do Projeto

Kinevo é um SaaS de treino com:
- **Painel Web** para treinadores (Next.js + Supabase)
- **App Mobile** para alunos (Expo Router)
- **Monorepo** com workspace compartilhado de tipos

O fundador é Profissional de Educação Física com metodologia proprietária de prescrição. O módulo de IA deve replicar essa metodologia em escala — gerando programas de treino personalizados com velocidade, sem comprometer qualidade ou o que já está em produção.

**Estado atual:** produto em beta com treinadores reais. Qualquer erro em produção tem rosto.

---

## 🔍 FASE 1 — Investigação (faça tudo isso antes de propor qualquer coisa)

### 1.1 Mapeie a estrutura do projeto

```bash
# Estrutura geral
find . -type f -name "*.json" | grep -E "(package\.json|tsconfig)" | head -20
cat package.json

# Workspaces
ls -la
ls web/src/
ls mobile/
ls packages/ 2>/dev/null || ls shared/ 2>/dev/null

# Rotas existentes no web
find web/src/app -type f -name "*.tsx" | sort
find web/src/app -type f -name "*.ts" | sort
```

### 1.2 Entenda o banco de dados existente

```bash
# Leia TODAS as migrações existentes, em ordem
ls supabase/migrations/ | sort
cat supabase/migrations/*.sql

# Leia o README do banco se existir
cat web/README.md 2>/dev/null
cat supabase/README.md 2>/dev/null
```

Ao ler as migrações, documente para si mesmo:
- Quais tabelas existem e quais são suas colunas e tipos
- Quais relacionamentos (FK) já existem
- Quais políticas de RLS já estão definidas
- Qual convenção de nomenclatura é usada (snake_case? UUIDs como PK? Timestamps com timezone?)
- Se há padrões de soft delete, status, ou audit trail

### 1.3 Entenda os tipos compartilhados

```bash
# Tipos do shared/packages
find packages -type f -name "*.ts" 2>/dev/null | xargs cat
find shared -type f -name "*.ts" 2>/dev/null | xargs cat

# Como os tipos são importados no web e mobile
grep -r "@kinevo/shared\|from.*shared" web/src --include="*.ts" --include="*.tsx" | head -20
grep -r "@kinevo/shared\|from.*shared" mobile --include="*.ts" --include="*.tsx" | head -20
```

### 1.4 Entenda os padrões de código existentes

```bash
# Como o Supabase client é instanciado
find web/src -name "*.ts" | xargs grep -l "createClient\|supabase" | head -5
cat $(find web/src -name "*.ts" | xargs grep -l "createClient" | head -1)

# Como as Server Actions são estruturadas
find web/src/actions -type f -name "*.ts" | sort
cat $(find web/src/actions -type f -name "*.ts" | head -3)

# Como o OpenAI já é usado no projeto
find web/src -name "*.ts" | xargs grep -l "openai\|OpenAI" 2>/dev/null
cat $(find web/src -name "*.ts" | xargs grep -l "openai" 2>/dev/null | head -2)

# Como a autenticação funciona
find web/src -name "*.ts" -o -name "*.tsx" | xargs grep -l "auth\|session\|user" | head -5

# Como formulários e mutations são feitos
find web/src/app -name "*.tsx" | xargs grep -l "useFormState\|useActionState\|action=" | head -3
cat $(find web/src/app -name "*.tsx" | xargs grep -l "useFormState\|useActionState\|action=" | head -1)
```

### 1.5 Entenda o modelo de dados de alunos e treinos

```bash
# Arquivos que usam tabelas de alunos, treinos, exercícios
grep -r "workout\|exercise\|student\|program\|treino\|aluno" web/src --include="*.ts" -l
cat $(grep -r "workout\|exercise\|student\|program" web/src --include="*.ts" -l | head -5)
```

### 1.6 Entenda o app mobile

```bash
# Estrutura de rotas do mobile
find mobile/app -type f | sort

# Como o mobile consome dados do Supabase
find mobile -name "*.ts" -o -name "*.tsx" | xargs grep -l "supabase\|workout\|program" | head -5
cat $(find mobile -name "*.ts" -o -name "*.tsx" | xargs grep -l "supabase" | head -2)
```

---

## 📋 FASE 2 — Relatório de Diagnóstico

Depois de concluir a Fase 1, produza um relatório respondendo explicitamente cada pergunta abaixo. **Não pule para a implementação sem este relatório estar completo.**

### Banco de dados
- Quais tabelas existem? Liste todas com suas colunas principais.
- Já existe alguma tabela de perfil de aluno? Com quais campos?
- Já existe alguma tabela de programas de treino? Como ela funciona?
- Já existe tabela de exercícios? Com quais campos e convenções?
- Qual é a convenção de nomenclatura usada?
- Há padrão de soft delete ou audit trail?
- Quais migrações já existem e qual é o próximo número a usar?

### Arquitetura web
- Como o Supabase client é criado? (server vs client component pattern)
- Como as Server Actions são estruturadas? Há um padrão consistente?
- Onde ficam os tipos? São gerados pelo Supabase CLI ou escritos manualmente?
- Como o OpenAI já é usado? Qual wrapper ou padrão é adotado?
- Há middleware de autenticação? Como ele protege rotas?
- Qual é o padrão de rotas para features de alunos?

### Shared package
- O que já está exportado pelo shared package?
- Quais convenções de tipos são usadas?
- Como o pacote é configurado no monorepo?

### Mobile
- Como o mobile consome programas de treino?
- O que precisará mudar no mobile quando o novo programa for enviado ao aluno?

### Gaps e riscos
- O que está faltando para o módulo funcionar que ainda não existe no projeto?
- Quais arquivos existentes terão que ser modificados (se algum)?
- Qual é o risco de cada modificação necessária?

---

## 🏗️ FASE 3 — Proposta de Estratégia

Só depois do relatório de diagnóstico aprovado pelo fundador, proponha a estratégia. Ela deve ser derivada inteiramente do que você encontrou — não do que está neste documento como referência.

### Estratégia de banco de dados
- Quais tabelas novas criar (nomes e colunas alinhados com convenção existente)
- Quais tabelas existentes precisam de extensão e como fazer isso com segurança
- As políticas de RLS seguindo o padrão já existente
- A ordem das migrações e dependências entre elas
- Confirmação explícita de impacto zero nas tabelas existentes

### Estratégia de código
- Onde cada novo arquivo deve viver, seguindo a estrutura atual
- Como o novo código se integra com os padrões já estabelecidos
- Como o OpenAI será chamado seguindo o padrão já existente
- Como os tipos serão organizados no shared package

### Estratégia de rollout seguro
- Como isolar o desenvolvimento do código em produção
- Onde a feature flag deve viver dado o modelo de dados existente
- Ordem de implementação baseada em dependências reais do projeto

### O que não tocar
- Lista explícita de arquivos e tabelas que não serão modificados
- Justificativa para cada caso em que uma modificação for inevitável

**Aguarde aprovação do fundador antes de escrever qualquer código ou migração.**

---

## 🧠 A Metodologia Kinevo (contexto de domínio — não é especificação técnica)

### Princípio central: aderência acima de tudo
O melhor programa é o que o aluno vai seguir. Preferências, disponibilidade e histórico têm peso alto em toda decisão de prescrição.

### Volume semanal por nível (séries por grupo muscular)
- Iniciante: 10–12 séries
- Intermediário: 12–15 séries
- Avançado: 15–20 séries
- Sempre iniciar no limite inferior. Progredir só após 2 semanas sem fadiga excessiva.

### Estrutura por frequência semanal
- 2–3 dias → Full Body
- 4 dias → Upper/Lower ou Push-Pull adaptado
- 5–6 dias → PPL completo ou Upper/Lower alternado

### Periodização linear em blocos de 4 semanas
- Semana 1: adaptação, volume mínimo
- Semana 2: progressão de volume se aderência > 80%
- Semana 3: progressão de carga se séries completadas
- Semana 4: deload automático (–20% volume)

### Restrições absolutas (o sistema jamais pode violar)
- Nenhum exercício com restrição médica ativa do aluno
- Pelo menos 1 exercício composto por dia de treino
- Volume nunca acima do máximo do nível na semana 1
- Máximo 2 exercícios de isolamento para grupos pequenos em iniciantes

### Modos de operação da IA
- **Piloto automático** → iniciante ou < 4 semanas de histórico
- **Copiloto** → intermediário com histórico: IA sugere, treinador edita
- **Assistente** → avançado ou restrições complexas: IA apoia, treinador compõe

### Regra de ouro de segurança
**Nenhum programa chega ao aluno sem aprovação explícita do treinador. Sem exceção.**

---

## 🚨 Restrições Inegociáveis

Independente do que você encontrar no código, estas restrições nunca mudam:

1. **Branch isolado.** Todo desenvolvimento em `feature/ai-prescription`. Zero risco para o main.

2. **Aprovação obrigatória.** `requiresTrainerApproval: true` em todo retorno do motor de prescrição, sem exceção.

3. **IA é a última camada.** A ordem é sempre: regras TypeScript → validação → IA → validação novamente → fallback heurístico se IA falhar.

4. **Migrações são aditivas.** Propor e aguardar aprovação antes de qualquer alteração em tabela existente.

5. **Feature flag.** O módulo invisível para todos até o fundador ativar explicitamente.

6. **Leia antes de editar.** Nunca modifique um arquivo sem ter lido seu conteúdo completo primeiro.

---

## ✅ Checklist — Fase 1 concluída

Confirme cada item antes de passar para a Fase 2:

- [ ] Li todas as migrações SQL existentes
- [ ] Entendo todas as tabelas, colunas e relacionamentos atuais
- [ ] Li os arquivos de Server Actions existentes
- [ ] Entendo como o Supabase client é instanciado (server vs client)
- [ ] Li como o OpenAI já é usado no projeto
- [ ] Entendo a estrutura de tipos do shared package
- [ ] Li como o mobile consome dados de treino
- [ ] Produzi o relatório de diagnóstico completo (Fase 2)
- [ ] Aguardei aprovação do fundador para a estratégia antes de codificar

---

*Kinevo — Módulo de Prescrição Inteligente | Guia de Implementação v2.0 | Confidencial*