# Relatório de Análise — Kinevo Web (Painel do Treinador)

**Data:** 01/06/2026
**Escopo:** Análise funcional e de consistência do sistema web (painel do personal). Apenas análise — **nenhuma alteração de código foi feita**.
**Método:** Dev server local (`next dev`, porta 3000, apontando para o Supabase de produção `lylksbtgrihzepbteest`) dirigido por um navegador Chrome real via CDP/playwright-core, complementado por leitura do código-fonte para confirmar causas-raiz.

---

## 0. Setup de teste e limpeza necessária

Para exercitar os fluxos reais foi criada uma conta de treinador de teste **no banco de produção**. **Recomendo apagar após revisar este relatório:**

- **Treinador:** `qa-teste-kinevo@example.com` (nome "QA Teste (apagar)") — `trainer_id = b7787ab5-2245-4df8-81ce-b78ca03cbe7f`, `auth_user_id = 95d905c9-f68b-4cfd-97f9-04e6e6ac79b4`. Subscription falsa `trialing` (stripe ids `cus_qa_test`/`sub_qa_test`).
- **Alunos:** "Maria Aluna Teste" (`maria-aluna-qa@example.com`) + o auto-perfil "QA Teste (apagar) (Eu)".
- **Templates/Programas:** "Programa QA Maria" (ativo), "Programa QA - Full Body" (arquivado), 2 `program_templates`.

> O signup real não pôde ser concluído porque exige checkout do Stripe em modo **live** (cartão real). A conta foi criada via service-role replicando o que a server action `signupTrainer` faz. A tela de signup em si foi analisada visualmente.

---

## 1. Telas/fluxos cobertos

Signup, Login, Onboarding (modal de boas-vindas + escolha de modalidade + tours por página + checklist "Primeiros Passos"), Dashboard (vazio e com dados), Alunos (lista), Perfil do aluno (vazio e com programa ativo), Editar aluno, **Program Builder** (criação manual, catálogo de 568 exercícios, agendamento de dias, ativação, confirmação de arquivamento), Programas, Exercícios, Agenda, Mensagens, Financeiro, Formulários, Avaliações, Marketing (visão geral/leads/landing), Configurações, Sala de Treino, Detalhe de programa.

---

## 2. O que está bom (destaques)

- **Program Builder** é maduro: catálogo grande e filtrável, preview do celular ao vivo, campos por exercício (séries/reps/descanso/função), agendamento por dia da semana, modal de confirmação claro ao trocar o programa ativo, validação de dias agendados.
- **Estados vazios** bem cuidados em quase todas as telas (dashboard, programas, alunos, marketing, training-room).
- **Onboarding** coeso (boas-vindas → modalidade → tours contextuais → checklist com milestones auto-rastreados, ex.: criar aluno marcou "first_student_created").
- Semana começa na segunda de forma consistente nos chips de dia (`S T Q Q S S D`).
- Contagem de exercícios consistente (568) entre Dashboard/Exercícios/Builder.
- Perfil do aluno com programa ativo é rico (semana atual, "primeira sessão pendente", aderência).

---

## 3. Achados

### 🔴 Alta — lógica/funcional

**A1. Treinos VAZIOS (sem exercícios) podem ser atribuídos ao aluno.**
O builder cria 3 treinos por padrão (A/B/C). A validação de ativação exige apenas que cada treino tenha **dias agendados** — **não** valida que o treino tenha exercícios. Resultado verificado no banco: o programa ativo "Programa QA Maria" foi atribuído com **Treino B (agendado Seg) e Treino C (agendado Qui) com ZERO exercícios**. Na prática, o aluno abre o app na segunda/quinta e encontra um treino vazio.
- Código: validação em `src/components/programs/program-builder-client.tsx:1950-1954` e modal em `:2505-2535` (só checa `scheduled_days`). Não há checagem de `items.length > 0`.
- **Sugestão:** bloquear ativação (ou avisar) quando um treino agendado não tem exercícios; ou ignorar/auto-remover treinos vazios no salvamento.

### 🟠 Média

**A2. Atrito do "3 treinos por padrão" + validação de dias.**
Ao abrir `/program/new`, são criados 3 treinos vazios (`default_workout_count: 3` em `src/types/prescription-preferences.ts:81`, seed em `program-builder-client.tsx:518-532`). Para ativar um programa de 1–2 treinos, o usuário é obrigado a **agendar dias para B/C vazios** ou **excluí-los** — o modal "Treinos sem dia agendado" reaparece a cada tentativa até resolver todos. A exclusão de aba (ícone lixeira `title="Excluir treino"`) só aparece na aba **ativa** e quando há **>1 treino**, o que não é óbvio.
- **Sugestão:** não bloquear por dias em treinos vazios; ou tornar o "remover treino" mais visível; ou default de 1 treino.

**A3. Validação do nome do programa ocorre DEPOIS do modal de confirmação de arquivamento.**
Fluxo observado ao ativar sem nome preenchido: clica "Ativar como Atual" → aparece o modal "Ativar programa? O programa atual será arquivado…" → confirma → **só então** surge o erro "Por favor, preencha o nome do programa." A ordem está invertida (confirma-se arquivar o programa atual antes de saber que a operação nem é válida).
- **Sugestão:** validar nome/estrutura antes de exibir o modal de confirmação.

**A4. Inconsistência na contagem de "alunos ativos".**
A lista `/students` conta o **auto-perfil do treinador** como aluno ("Alunos 2", incluindo "QA Teste (Eu)"), enquanto o card do Dashboard "ALUNOS ATIVOS" o exclui (mostra 1).
- Dashboard: `src/lib/dashboard/get-dashboard-data.ts:357` → `status==='active' && !is_trainer_profile`.
- Lista: `src/app/students/students-client.tsx:85-87` → só `status==='active'` (não exclui `is_trainer_profile`).
- **Sugestão:** alinhar as duas definições (provavelmente excluir o self-profile da lista, ou rotulá-lo distintamente).

**A5. Bug de string/pluralização no Marketing — "0 virouam aluno".**
`src/app/marketing/page.tsx:161`:
```ts
sub={`${convertidos} virou${convertidos === 1 ? '' : 'am'} aluno`}
```
Gera "0 virou**am** aluno" / "2 viro**uam** aluno" (palavra inexistente). O plural correto de "virou" é "viraram", e "aluno" não é pluralizado.
- **Sugestão:** `${n} ${n === 1 ? 'virou aluno' : 'viraram alunos'}` (e tratar 0).

**A6. Botão "Enviar reavaliação" mesmo sem nenhuma avaliação anterior.**
`src/components/students/health-metrics-card.tsx:190-228` usa label fixo `"Enviar reavaliação"` inclusive no empty state ("Sem avaliações"). Semanticamente deveria ser "Enviar avaliação"/"Enviar primeira avaliação" quando o aluno nunca foi avaliado.

### 🟡 Baixa / Polish / Code quality

**B1. `console.log` de debug em produção** — `src/components/programs/program-builder-client.tsx:519` (`"Initializing workouts with program:"`), `:828` (`"updateWorkoutFrequency"`), `:1481` (`"Saving workout:"`). Também `console.warn('[SmartBanner] action sem handler:')` em `src/app/students/[id]/student-detail-client.tsx`. Aparecem no console do navegador em uso normal.

**B2. Erro recorrente nível ERROR nos logs do servidor:** `"Using the user object as returned from supabase.auth.getSession() ... could be insecure! Use supabase.auth.getUser()"` — disparado a cada navegação. Origem provável: middleware setando `x-user-id` a partir de `getSession()` (ver comentário em `src/lib/auth/get-trainer.ts:24-31`). É ruído de log (e potencial alerta de segurança que vale endereçar/silenciar conscientemente).

**B3. `/messages` é rota morta** — `src/app/messages/page.tsx` faz `redirect('/dashboard')`. A mensageria virou drawer; ok manter, mas a rota antiga só redireciona (qualquer link/bookmark para `/messages` cai no dashboard sem aviso).

**B4. `/students/[id]/program/[programId]` retorna 404** — existe só o subdiretório `/edit` (sem `page.tsx` na rota base). Nenhum link no código aponta para a rota base (só acessível digitando a URL), então impacto é baixo; ainda assim, idealmente redirecionar para `/edit` em vez de 404.

**B5. CSP bloqueia o script do Vercel Speed Insights** — console: `Loading the script 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js' violates ... Content Security Policy`. Speed Insights não carrega; ou ajustar a CSP (`script-src`) ou remover a dependência.

**B6. Footer duplicado no /signup** — o texto "Seus dados estão protegidos com criptografia de ponta a ponta" aparece duas vezes (painel esquerdo + rodapé central).

**B7. Visão semanal do perfil esconde treinos coincidentes no mesmo dia** — com Treino A (Seg) e Treino B (Seg) agendados no mesmo dia, a célula de segunda mostra só "Agendado: Treino A"; o contador, porém, soma os dois ("0/6"). Edge case de calendário (dois treinos no mesmo dia → só um exibido).

**B8. `scheduled_days` não ordenados** — Treino A salvou `[1,3,5,2]` (ordem de clique) em vez de `[1,2,3,5]`. Cosmético, mas pode afetar exibição/ordenação no app do aluno.

**B9. Checklist "Primeiros Passos" com progresso divergente entre páginas** — mostra "3 de 10" no Dashboard e "0 de 10" no Financeiro na mesma sessão (provável estado stale/hidratação ao trocar de rota).

**B10. Valor de modalidade grafado `"presential"`** (24 ocorrências no código, ex.: `src/actions/create-student.ts`, `src/components/student-modal.tsx`). Funciona (o usuário sempre vê o label "Presencial"), mas é grafia incorreta — nem inglês ("in-person") nem português ("presencial"). Apenas naming/consistência interna.

**B11. Badge de seção "Ativo"/"Fila" no estado vazio do perfil** — no perfil sem programa, a seção "Programa Atual" exibia um badge verde "Ativo" como rótulo da seção, o que pode ler como "há um programa ativo" mesmo quando a mensagem abaixo diz "Nenhum programa ativo". (Confirmado em código que o badge de status do *programa* é condicional — `src/components/students/active-program-card.tsx:23,143` —; o rótulo de seção é separado.)

---

## 4. Não reproduzido / esclarecido

- **"Ativação trava em loading / não cria programa":** investigado a fundo e **descartado** — era artefato do meu script de verificação (query selecionava colunas inexistentes `start_date/end_date`, retornando `null`). A ativação **funciona**: confirmado no banco que `assigned_programs`/`assigned_workouts`/`assigned_workout_items` foram criados corretamente e o programa anterior foi arquivado para `completed`.

---

## 5. Sugestão de priorização

1. **A1** (treinos vazios atribuídos ao aluno) — maior impacto na experiência do aluno final.
2. **A5** (string "virouam") e **A6** ("reavaliação") — visíveis ao usuário, correção trivial.
3. **A3/A2** (ordem de validação + atrito dos 3 treinos) — fricção recorrente na prescrição.
4. **A4** (contagem de alunos ativos) — consistência de métricas.
5. **B1/B2/B5** — limpeza de logs/CSP.
