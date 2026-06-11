# Kinevo — Submissão ao Claude Connectors Directory

> Rascunho dos textos e do checklist para o [formulário de submissão](https://clau.de/mcp-directory-submission).
> Itens marcados com 🟡 dependem de ação manual (assets, conta de teste, doc pública).
> Última revisão: 29 de maio de 2026.

---

## 1. Informações básicas do servidor

| Campo | Valor |
|---|---|
| **Nome** | Kinevo |
| **Server URL (MCP endpoint)** | `https://www.kinevoapp.com/api/mcp` |
| **Transporte** | Streamable HTTP (stateless) |
| **Autenticação** | OAuth 2.1 + PKCE (S256). API key também suportada. |
| **Capacidades** | Leitura **e** escrita (read/write) |
| **Idioma do produto** | Português (Brasil) — público de personal trainers no Brasil |
| **Superfícies testadas** | Claude.ai (web), Claude Desktop |
| **Status** | Produção (GA) — em produção em `www.kinevoapp.com` |

### Tagline (1 linha)
> Manage your personal training business from Claude — students, workout programs, progress and revenue, in natural language.

(PT) *Gerencie seu negócio de personal trainer pelo Claude — alunos, programas de treino, progresso e receita, em linguagem natural.*

### Descrição (curta)
Kinevo is the operating system for personal trainers. This connector lets a trainer run their Kinevo account from Claude: look up students, build and assign training programs (with advanced methods, per-set schemes and supersets), track adherence and load progression, review check-in forms, message students, and see revenue — all by chatting. Every action is scoped to the authenticated trainer's own data.

### Casos de uso (use cases)
1. **Triagem semanal** — "Quais alunos não treinaram nos últimos 7 dias?" → lista alunos inativos para follow-up.
2. **Prescrição** — "Cria um programa de hipertrofia de 8 semanas para a Maria, treino A/B/C, agenda seg/qua/sex" → cria programa, sessões agendadas e exercícios.
3. **Acompanhamento** — "Qual a progressão de carga do João no agachamento nos últimos 3 meses?" → histórico de cargas + 1RM estimado.
4. **Gestão** — "Me dá um resumo do mês: alunos ativos, programas, receita" → dashboard agregado.
5. **Comunicação** — "Manda uma mensagem motivacional pro Carlos" → insere mensagem no inbox do aluno.

---

## 2. Dados e conformidade

- **Dados acessados:** dados de alunos (contato, objetivos, restrições clínicas informadas), programas e sessões de treino, histórico de cargas/progresso, respostas de formulários, mensagens, dados financeiros (contratos/receita). Tudo **restrito à conta do treinador autenticado** (`coach_id`/`trainer_id`).
- **Terceiros:** Supabase (banco/auth/infra). Dados retornados pelas tools são enviados ao provedor do assistente (Anthropic) para gerar respostas.
- **Política de privacidade:** `https://www.kinevoapp.com/privacy` — inclui seções 7–9 dedicadas ao conector MCP (dados acessados, compartilhamento com provedores de IA, credenciais/revogação).
- **Termos:** `https://www.kinevoapp.com/terms`
- **Credenciais:** API keys (bcrypt) e tokens OAuth (sha256) armazenados só como hash; access token expira em 1h, refresh em 30 dias (com rotação); revogáveis em configurações.
- **Segurança:** gate de assinatura ativa, rate limiting (30/min, 1000/dia), validação de `Origin` (anti-DNS-rebinding), DCR com validação de `redirect_uri` (só https/localhost).

---

## 3. Inventário de ferramentas (27 tools)

Todas as tools têm `title` legível + `readOnlyHint`/`destructiveHint`. Read e write são tools separadas.

### Leitura (14)
| Tool | Título | O que faz |
|---|---|---|
| `kinevo_ping` | Testar conexão | Testa a conexão; retorna nome e status da conta do treinador. |
| `kinevo_list_students` | Listar alunos | Lista alunos do treinador, com filtros de nome/status. |
| `kinevo_get_student` | Ver aluno | Perfil completo: dados pessoais, restrições clínicas, programa atual, stats e contrato. |
| `kinevo_list_programs` | Listar programas | Lista programas (templates ou atribuídos), filtrável por aluno/status. |
| `kinevo_get_program` | Ver programa | Detalhe completo: sessões, exercícios, séries, métodos, supersets, agendamento. |
| `kinevo_list_exercises` | Listar exercícios | Busca o catálogo (sistema + custom) por nome/grupo muscular/equipamento. |
| `kinevo_list_training_methods` | Listar métodos de treino | Lista presets de método (pirâmide, drop-set, cluster, 5x5, top+backoff) e como prescrevê-los. |
| `kinevo_get_student_progress` | Progresso do aluno | Histórico de treinos, aderência e progressão de carga (com 1RM estimado). |
| `kinevo_get_form_responses` | Respostas de formulários | Respostas de check-ins, anamneses e formulários do aluno. |
| `kinevo_get_dashboard_summary` | Resumo do painel | Visão geral: alunos, programas, sessões, alertas (inativos, sem programa). |
| `kinevo_list_conversations` | Listar conversas | Lista as conversas do treinador com alunos. |
| `kinevo_get_conversation` | Ver conversa | Mensagens de uma conversa, mais recentes primeiro. |
| `kinevo_list_subscriptions` | Listar assinaturas | Contratos/assinaturas dos alunos: status de pagamento, plano, valor, próxima cobrança. |
| `kinevo_get_revenue_summary` | Resumo de receita | MRR, novos contratos no mês, cancelamentos, visão de pagamentos. |

### Escrita (13 — sendo 2 destrutivas)
| Tool | Título | O que faz | Hint |
|---|---|---|---|
| `kinevo_create_student` | Criar aluno | Cadastra novo aluno (cria conta de auth) com preferências clínicas/treino. | write |
| `kinevo_update_student` | Atualizar aluno | Atualiza nome, telefone, objetivo, modalidade, notas, status. | write |
| `kinevo_create_program` | Criar programa | Cria template de programa (ou já atribuído a um aluno como rascunho). | write |
| `kinevo_assign_program` | Atribuir programa | Copia um template para um aluno ou ativa um rascunho. | write |
| `kinevo_expire_program` | Expirar programa | Desativa um programa ativo (dados preservados). | write |
| `kinevo_add_workout_session` | Adicionar sessão de treino | Adiciona uma sessão ao programa, com agendamento semanal. | write |
| `kinevo_add_exercise_to_session` | Adicionar exercício à sessão | Adiciona exercício com séries/reps/carga/descanso/método. | write |
| `kinevo_update_workout_session` | Atualizar sessão de treino | Renomeia/reordena/reagenda uma sessão in-place. | write |
| `kinevo_delete_workout_session` | Excluir sessão de treino | Remove a sessão e seus exercícios (cascade). | **destructive** |
| `kinevo_update_workout_item` | Atualizar exercício | Edita um exercício (séries/reps/descanso/método) ou troca o exercício. | write |
| `kinevo_create_superset` | Criar superset | Cria bi-set/tri-set com exercícios-filhos numa chamada. | write |
| `kinevo_delete_workout_item` | Excluir exercício | Remove um exercício da sessão (e filhos de superset). | **destructive** |
| `kinevo_send_message` | Enviar mensagem | Envia mensagem ao inbox do aluno no app. | write |

---

## 4. Conta de teste (para os revisores) — ✅ PRONTA

Conta de treinador dedicada, isolada e com dados fictícios (nenhum dado real de cliente é exposto).

- **E-mail (login OAuth):** `kinevo.reviewer.openai@gmail.com` — treinador "Kinevo Reviewer"
- **Senha (login):** `KinevoReview2026!` — ✅ redefinida e validada via login (GoTrue).
- **Assinatura:** `trialing`, válida até 18/ago/2026 (passa o gate do conector) ✅
- **API key (fallback Bearer, já validada em produção):**
  ```
  kinevo_trainer_fd0ee738-0f07-4f60-b0dc-fc23246d4679
  ```
  > Revogável em Configurações → API Keys (nome: "Claude Connector (review)"). Testada via `kinevo_ping` e `kinevo_get_student_progress` na produção.

**Dados de amostra populados:**
- 4 alunos: **Maria Silva** (hipertrofia), **Carlos Santos** (emagrecimento), **Ana Oliveira** (qualidade de vida) + perfil do próprio treinador.
- **Maria** tem restrição clínica (lesão no ombro direito) → exercita `kinevo_get_student`.
- **Maria** tem programa **ativo** "Hipertrofia A/B/C" (8 semanas), com 3 sessões agendadas (seg/qua/sex) e 8 exercícios.
- **6 semanas de sessões concluídas** com `set_logs` e **progressão de carga no agachamento** (60→72,5 kg) → exercita `kinevo_get_student_progress` (1RM estimado 80→96,7 kg).
- Conversa treinador↔Maria (3 mensagens) → exercita `kinevo_get_conversation`.
- 1 contrato → exercita `kinevo_list_subscriptions`.

**Prompts de teste sugeridos (colar no formulário):**
1. "Liste meus alunos e diga quais têm restrições clínicas."
2. "Mostre o programa ativo da Maria com os dias da semana de cada treino."
3. "Qual a progressão de carga da Maria no agachamento nos últimos 2 meses?"
4. "Me dá um resumo do meu painel."
5. "Mostre a conversa mais recente com a Maria."

---

## 5. Documentação pública — ✅ TEXTO PRONTO (falta publicar)

- Texto-fonte completo (o que é, como conectar via OAuth e API key, prompts de exemplo, privacidade, troubleshooting): **`web/specs/mcp-server/PUBLIC-DOC-conector-claude.md`**.
- [ ] 🟡 **Gustavo:** publicar como artigo de ajuda/post e usar a URL pública no formulário.

---

## 6. Branding — 🟡 PARCIAL

- **Favicon:** ✅ existe — `https://www.kinevoapp.com/favicon.png`. Arquivo no repo: `web/public/favicon.png`.
- **Logo:** ✅ `web/public/logo-icon.png` confirmado (Gustavo). URL pública: `https://www.kinevoapp.com/logo-icon.png`.
- **Screenshots (3–5 PNG ≥1000px):** ✅ **4 capturados** em `~/Desktop/kinevo-mcp-screenshots/` (≥1442px de largura, cropados na resposta do Claude), com dados fictícios (aluna "Mariana Costa", já removida da base):
  - `01-painel.png` — resumo do painel (contagens agregadas, sem PII)
  - `02-perfil-mariana.png` — perfil + restrição clínica + programa
  - `03-programa-mariana.png` — programa A/B/C com tabela de exercícios e dias
  - `04-progressao-mariana.png` — progressão de carga no agachamento (6 semanas)
  > Capturados dirigindo o Claude via CDP com o conector conectado. Financeiro foi omitido de propósito (exporia receita real).

---

## 7. Checklist técnico (✅ feito no código)

- [x] OAuth 2.1 + PKCE (S256) — authorize/token/refresh com rotação
- [x] Dynamic Client Registration (`/oauth/register`) — cobre callbacks `claude.ai`/`claude.com`
- [x] `.well-known/oauth-authorization-server` e `.well-known/oauth-protected-resource` (RFC 9728)
- [x] `WWW-Authenticate` no 401 apontando o resource metadata
- [x] Streamable HTTP stateless
- [x] 27 tools com `title` + `readOnlyHint`/`destructiveHint`; read/write separados
- [x] Validação de `Origin` (anti-DNS-rebinding)
- [x] Gate de assinatura + rate limiting + credenciais hasheadas
- [x] Smoke test local: metadata, tools/list (titles), 401, Origin — todos OK
