# Paridade Treinador — Web ↔ Mobile

> Documento vivo. Objetivo: o treinador conseguir fazer **tudo** tanto no web (`web/`) quanto no app (`mobile/`).
> Atualize este arquivo sempre que fechar ou descobrir uma lacuna.
>
> **Regra de ouro ao auditar:** verifique contra o **código atual** (hooks/components/actions), não contra comentários — já houve caso de comentário desatualizado dizendo que algo era "read-only" quando na verdade já estava implementado (ver edição de programa abaixo). Última auditoria completa: **2026-05-21**.

---

## Como ler

- **✅ Em paridade** — existe e funciona nos dois.
- **🟡 Lacuna no mobile** — existe no web, falta (ou é parcial) no mobile.
- **🔵 Lacuna no web** — existe no mobile, falta no web (paridade reversa).
- **⚙️ Nativo de plataforma** — não precisa ser replicado (inerente ao web ou ao mobile).

Esforço/Valor: Baixo / Médio / Alto (estimativa grosseira de implementação e de impacto pro treinador).

---

## ✅ Já em paridade

| Área | Observação |
|---|---|
| Dashboard / overview | KPIs, atividade do dia |
| Alunos (lista, detalhe, criar, editar, arquivar, reset senha) | — |
| **Programas — criar / editar completo** | Mobile edita programa atribuído por inteiro via `saveAssignedProgramFull` (`mobile/hooks/useProgramBuilder.ts`). ⚠️ Comentários "Round 1 metadata-only" no builder estão **desatualizados**. |
| **Biblioteca de Modelos** (criar/editar/duplicar/excluir/atribuir) | Entregue 2026-05-21. Mobile: `mobile/app/program-templates/`. Migrações 151 (usage_count) e 152 (duplicate RPC). |
| Exercícios (biblioteca, custom, grupos musculares) | — |
| Treino ao vivo (Sala de Treino) | — |
| Mensagens / Inbox | — |
| Financeiro (dashboard, contratos, carteira Asaas, PIX, planos) | — |
| **Agenda — criar / remarcar / cancelar / marcar concluído·falta / editar série** | Marcar status + editar série entregues 2026-05-21 (`mobile/components/trainer/agenda/`). |
| **Perfil do treinador** (nome, foto, modalidade, auto-publish reports, instagram) | Entregue 2026-05-21 (`mobile/app/trainer-profile.tsx`). |
| Notificações push / preferências | — |

---

## 🟡 Lacunas no mobile (existe no web)

| # | Lacuna | Web (referência) | Mobile (estado) | Esforço | Valor |
|---|---|---|---|---|---|
| 1 | **IA em formulários** — gerar formulário com IA + auditoria de qualidade | `web/src/actions/forms/generate-form-with-ai.ts`, `audit-form-quality-ai.ts`; usado em `web/src/app/forms/templates/new/builder-client.tsx` | Builder manual apenas (`mobile/components/trainer/forms/FormBuilderModal.tsx`) | Médio | Médio-Alto |
| 2 | **Assistente IA geral (chat)** | `web/src/app/api/assistant/chat/`, `components/assistant/` | Só IA de prescrição (`mobile/components/trainer/program-builder/AIPrescriptionSheet.tsx`); sem chat geral | Alto | Médio |
| 3 | **Agenda — aulas em grupo** (vários alunos no mesmo horário, `group_id`) | `web/src/actions/appointments/create-recurring-group.ts`, `cancel-recurring-group.ts` | `useAppointmentMutations` cria 1 aluno por vez; propaga nota por `group_id` mas não cria grupo | Médio | Médio |
| 4 | **Preferências de prescrição (nível treinador)** | `trainers.prescription_preferences` (jsonb); `web/src/actions/prescription/` | No mobile só existe por-aluno no `AIPrescriptionSheet`; sem edição das prefs do treinador | Médio | Médio |
| 5 | **Captura de avaliação física com fotos** | modo capture com fotos em `web/src/app/students/[id]/avaliacoes/[sessionId]/capture` | Avaliações sem captura de foto (`mobile/components/trainer/assessments/`) | Médio | Baixo-Médio |
| 6 | **Form triggers em programas** (anexar formulário pré/pós-treino ao programa) | builder do web | UI do builder mobile não expõe (a edição completa de programa cobre o resto) | Médio | Médio |
| 7 | **Agenda — cancelar todos os agendamentos de um aluno** (bulk) | `web/src/actions/appointments/cancel-all-for-student.ts` | — | Baixo | Baixo |
| 8 | **Chaves de API** (integração Claude.ai / ChatGPT MCP) | `web/src/app/settings/api-keys` | — | Baixo | Baixo |
| 9 | **Gerenciar a própria assinatura in-app** | `web/src/app/settings` | Mobile redireciona pro web | Médio | Baixo |
| 10 | **Integração Google Calendar** (OAuth + sync de agenda) | `web/src/app/settings/integrations/google-calendar` | — (o mobile pula de propósito) | Alto | Baixo-Médio |

### Prioridade sugerida
1. IA em formulários (#1) — valor alto, esforço médio.
2. Assistente IA geral (#2).
3. Aulas em grupo na agenda (#3).
4. Preferências de prescrição (#4).

---

## 🔵 Lacunas no web (existe no mobile)

| Lacuna | Mobile | Web (estado) |
|---|---|---|
| Mensagens com imagem | image picker no chat (`mobile/hooks/useTrainerChat.ts`) | chat é texto |
| Treino ao vivo multi-aluno simultâneo | Sala de Treino com chips de aluno concorrentes | seleciona 1 aluno por vez |
| Instagram handle (rodapé dos share cards) | `mobile/app/trainer-profile.tsx` | recurso de share é mobile-only |

---

## ⚙️ Nativos de plataforma (não replicar)

- **Mobile:** Live Activities (timer na lock screen), push notifications, persistência offline (MMKV), Apple Watch / HealthKit, Health Connect.
- **Web:** Command Palette / busca global (⌘K).

---

## Notas de arquitetura úteis pra esta paridade

- **Agendamentos:** `recurring_appointments` + `appointment_exceptions` (kind: `rescheduled`/`canceled`/`completed`/`no_show`). A projeção compartilhada `shared/utils/appointments-projection.ts` converte exceções em `status` da ocorrência. Mobile espelha as actions do web em `mobile/hooks/useAppointmentMutations.ts`. Não há coluna de modalidade/local no agendamento.
- **Modelos de programa:** tabelas `program_templates` / `workout_templates` / `workout_item_templates` / `workout_item_set_templates`. `frequency` no template é `string[]` (≠ `scheduled_days` int[] do programa atribuído). `assigned_programs.source_template_id` (FK, ON DELETE SET NULL) liga programa→template (usado no usage_count).
- **Workflow de entrega:** ver `mobile/specs/WORKFLOW.md` — sem commit/push durante dev; push só com autorização (push na `main` = deploy de produção via Vercel).
