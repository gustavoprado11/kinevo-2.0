# Fase 8.5 — Encerrar rotinas (UX gap)

**Objetivo:** expor a ação "encerrar rotina" onde o trainer naturalmente precisa dela — hoje só existe no perfil do aluno, deixando o trainer sem saída rápida no calendário e sem caminho pra "aluno parou de treinar".

**Status:** fast-follow da Fase 8. Puramente UX — as server actions já existem desde Fase 2.

**Pré-requisito:** MVP + Fase 8.

---

## Problema identificado

Ao clicar num card no `/schedule` ou no widget do dashboard, o trainer tem 3 ações no popover:
- Remarcar este treino
- Cancelar este treino (afeta só 1 ocorrência)
- Abrir perfil do aluno

**Faltam:**
1. Encerrar a rotina inteira daquela linha do calendário
2. Encerrar TODAS as rotinas ativas de um aluno de uma vez (caso "aluno parou")

## Decisões fechadas

| Decisão | Escolha |
|---------|---------|
| Adicionar "Encerrar esta rotina" no popover | Sim, 4° item do menu |
| Data de corte | Trainer escolhe no diálogo (default: hoje) |
| Pacote | Encerrar só essa rotina; outras do pacote continuam |
| Caso "aluno parou" | Duas entradas: botão no perfil + integração com "Arquivar aluno" |
| Confirmação do botão em massa | Sim, com contagem ("Você vai encerrar 3 rotinas") sem listar nomes |
| Arquivar aluno | Perguntar sobre agendamentos SÓ se houver rotinas ativas |
| Visual | Textos e ícones distintos entre "cancelar este treino" e "encerrar esta rotina" |

## Entregáveis

### 1. `OccurrencePopover` — 4° item

- Adicionar item "Encerrar esta rotina" após "Cancelar este treino"
- Ícone distinto: `CalendarX` ou `CalendarOff` (lucide) em vermelho
- Texto em `#FF3B30`
- Separador visual antes de "Abrir perfil do aluno" (já existe)
- Clique abre diálogo de confirmação com date picker

### 2. Diálogo "Encerrar esta rotina"

Reusa padrão de diálogo do próprio `OccurrencePopover` (confirm inline):
- Título: "Encerrar esta rotina?"
- Body: "A rotina deixa de gerar novos treinos a partir da data escolhida. Treinos passados ficam no histórico."
- Campo: "Encerrar a partir de" + `<input type="date">` default = hoje
- Se rotina é pacote: texto adicional "Apenas esta linha do pacote será encerrada. Outros dias do pacote continuam."
- Botões: "Voltar" (ghost) + "Encerrar rotina" (vermelho)
- Ao confirmar: chamar `cancelRecurringAppointment({ id, endsOn: dataEscolhida })`
- Disparar callback `onCanceled()` pra atualizar widget/calendário

### 3. Botão "Encerrar todos os agendamentos" no perfil do aluno

Em `web/src/components/appointments/student-schedule-section.tsx`:
- No header da seção, à direita do título "Rotina atual", botão outline vermelho pequeno: "Encerrar todos"
- Aparece apenas se houver rotinas ativas (`students_schedules.length > 0`)
- Clique abre diálogo de confirmação:
  - Título: "Encerrar todos os agendamentos?"
  - Body: "Você vai encerrar N rotinas ativas deste aluno a partir de hoje. Treinos passados ficam no histórico."
  - Botões: "Voltar" + "Encerrar tudo" (vermelho)
- Ao confirmar: chamar uma action nova `cancelAllAppointmentsForStudent(studentId)` que internamente faz bulk cancel (ver abaixo)

### 4. Nova server action

`web/src/actions/appointments/cancel-all-for-student.ts`:

```typescript
'use server'

export async function cancelAllAppointmentsForStudent(params: {
    studentId: string
    endsOn?: string  // default: hoje
}): Promise<{ success: boolean; error?: string; data?: { canceledCount: number } }>
```

Lógica:
1. Auth + validação ownership (mesmo padrão das outras actions)
2. Buscar todas as rotinas ativas do aluno: `recurring_appointments WHERE student_id=X AND trainer_id=Y AND status='active'`
3. Para cada rotina: `UPDATE status='canceled', ends_on=$endsOn`
4. Para rotinas que pertencem a grupo: encerrar só a linha específica, não o grupo inteiro (consistente com a decisão do popover — `cancelRecurringAppointment` já faz isso corretamente)
5. Cancelar lembretes pendentes (upsert em `scheduled_notifications` status='canceled')
6. Disparar push agregado pro aluno: "Seus treinos com [trainer] foram encerrados" (reusa `notification-messages.rotinaCancelada` ou variante)
7. Sync Google: pra cada rotina, chamar `syncDeleteAppointment` (fire-and-forget)
8. Retornar `canceledCount`

### 5. Integração com "Arquivar aluno"

Em `web/src/actions/students/archive.ts` (ou onde estiver o action de arquivar):
- Antes de arquivar, verificar se aluno tem rotinas ativas
- Se sim, retornar `data: { hasActiveAppointments: true, count: N }` SEM arquivar ainda
- UI em `web/src/components/students/` que chama archive precisa:
  - Se response vem com `hasActiveAppointments`, abrir diálogo extra: "Este aluno tem N agendamentos ativos. Encerrar todos ao arquivar?"
  - Se trainer confirma, chamar archive com flag `alsoCancelAppointments: true`
  - Se trainer negar, arquivar sem mexer em agendamentos

Alternativa mais simples: criar um `archiveStudentWithCleanup(studentId, { cancelAppointments: boolean })` que faz tudo em uma chamada. UI pergunta antes qual caminho.

### 6. Testes

- `cancel-all-for-student.test.ts` — 4-5 casos:
  - Cancela todas as rotinas ativas do aluno
  - Não afeta rotinas de outros alunos
  - Pacote: cancela só as linhas do aluno, outras linhas do pacote (se houverem alunos diferentes — improvável, mas defensivo) continuam
  - Cancela lembretes pendentes
  - Dispara push agregado
- `occurrence-popover.test.tsx` — 2 casos novos:
  - 4° item "Encerrar esta rotina" renderiza
  - Clique chama `cancelRecurringAppointment` com a `endsOn` correta
- `student-schedule-section.test.tsx` — 2 casos novos:
  - Botão "Encerrar todos" só aparece quando há rotinas
  - Clique + confirmação chama `cancelAllAppointmentsForStudent`

## Critérios de aceite

- [ ] Popover do card mostra 4 itens, com "Encerrar esta rotina" bem diferenciado de "Cancelar este treino"
- [ ] Diálogo tem date picker funcional, confirma com `cancelRecurringAppointment`
- [ ] Botão "Encerrar todos" aparece no perfil do aluno só quando há rotinas
- [ ] Bulk cancel funciona: confere no banco que todas as rotinas foram encerradas
- [ ] Push agregado chega pro aluno (1 push, não N)
- [ ] Google sync: eventos deletados
- [ ] Integração com Arquivar: perguntam antes, opt-in pra encerrar
- [ ] Testes passam, tsc e eslint clean
