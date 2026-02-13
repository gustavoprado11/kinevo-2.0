# Resumo de Funcionalidades e Roadmap — Kinevo 2.0

Este documento apresenta um resumo do estado atual do projeto **Kinevo 2.0**, listando as funcionalidades já implementadas e os próximos passos alinhados com o `PRD.md`.

---

## 1. Funcionalidades Implementadas (Estado Atual)

### 1.1 Autenticação e Perfil
* **Infraestrutura Supabase**: Integração completa com Supabase Auth.
* **Módulos de Perfis**: Tabelas e políticas de segurança (RLS) para Treinadores (`trainers`) e Alunos (`students`).
* **Dashboard Web**: Estrutura inicial de dashboard para o treinador.

### 1.2 Biblioteca de Exercícios
* **Gestão de Exercícios**: CRUD completo de exercícios com suporte a grupos musculares, equipamentos, URLs de vídeo e instruções técnicas.
* **Governança de Exercícios**: Sistema preparado para diferenciar exercícios globais e personalizados (Migrações 010 e 011).

### 1.3 Builder de Programas (Core Web)
* **Templates de Programa**: Criação de modelos de programas com nome, descrição e duração.
* **Templates de Treino**: Organização de treinos (Ex: A, B, C) dentro de cada programa.
* **Itens de Treino Flexíveis**: Suporte no banco de dados e UI para:
    * **Exercícios Individuais**.
    * **Supersets** (agrupamento de exercícios).
    * **Notas Técnicas**.
* **Parâmetros de Prescrição**: Definição de Séries, Repetições (texto livre), Descanso e Notas por item.

### 1.4 Gestão de Alunos e Atribuição
* **Listagem de Alunos**: Interface para gerenciamento da base de alunos do treinador.
* **Atribuição de Programas**: Lógica de "cópia" do Programa Template para uma "Instância" do aluno (`assigned_programs`), garantindo a imutabilidade do template original.
* **Edição de Programas Atribuídos**: Possibilidade de ajustar a prescrição especificamente para um aluno após a atribuição.

### 1.5 Infraestrutura de Execução (Pronto para Uso)
* **Sessões de Treino**: Tabelas preparadas para registrar o início, fim e duração das sessões.
* **Logs de Séries**: Registro detalhado de Carga, Repetições Realizadas e RPE (Esforço Percebido).
* **Suporte a Offline-first**: Campos de sincronização e IDs locais já presentes no esquema do banco de dados.

---

## 2. Próximos Passos (Conforme PRD)

Com base no **MVP definido no PRD**, as seguintes áreas são prioritárias para o desenvolvimento:

### 2.1 Player de Treino (Mobile/Execução)
* **Desenvolvimento do App Mobile**: Interface focada no aluno para execução dos treinos atribuídos.
* **Fluxo do Player**:
    * Carregar última carga utilizada para cada exercício.
    * Timer de descanso automático entre séries.
    * Checkbox de conclusão de série com propagação de carga.
* **Sincronização Offline**: Implementar a lógica de persistência local para garantir que o aluno treine sem internet e sincronize depois.

### 2.2 Home do Aluno
* **Visualização do Dia**: Exibir qual treino o aluno deve realizar hoje.
* **Status de Aderência**: Mostrar progresso semanal e treinos pendentes.

### 2.3 Melhorias no Builder (Web)
* **UX Avançada**: Implementar drag-and-drop para reordenação de itens e criação rápida de Supersets na interface.
* **Biblioteca de Vídeos**: Melhorar a pré-visualização de mídias anexadas aos exercícios.

### 2.4 Analytics e Relatórios (Fase 2)
* **Acompanhamento de Performance**: Gráficos de evolução de carga e volume semanal para o treinador.
* **Métricas de Sucesso**: Dashboard para monitorar a taxa de conclusão e retenção de alunos.

---

## 3. Status de Alinhamento com o PRD

| Área | Status | Observação |
| :--- | :--- | :--- |
| **Autenticação** | ✅ Concluído | Integrado com Supabase. |
| **Builder de Programas** | ⚠️ Em progresso | Backend pronto, UI funcional mas expansível. |
| **Biblioteca de Exercícios** | ✅ Concluído | Estrutura robusta de governança. |
| **Atribuição de Treino** | ✅ Concluído | Sistema de instâncias imutáveis pronto. |
| **Player de Treino (Execução)** | ❌ Pendente | Estrutura de dados pronta, falta UI Mobile. |
| **Registro de Logs** | ⚠️ Em progresso | Tabelas prontas, falta integração no Player. |

---
**Documento gerado automaticamente com base na análise do repositório Kinevo 2.0.**
