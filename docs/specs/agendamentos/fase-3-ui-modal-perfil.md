# Fase 3 — UI essencial: modal de criação + perfil do aluno

**Objetivo:** primeira experiência visível pro trainer. Botão "Agendar" no perfil do aluno, modal de criação, seção "Rotina atual" no perfil.

**Pré-requisito:** Fase 2 concluída.

---

## Entregáveis

1. Componente `CreateAppointmentModal` com campos da Seção 4.1 do plano
2. Botão "Agendar" no header do perfil do aluno
3. Seção "Rotina atual" no perfil do aluno (lista as rotinas ativas do aluno)
4. Ações: editar rotina, encerrar rotina
5. Validação visual de conflito (alerta "Você já tem agendamento com [aluno X]")
6. Testes de componente

---

## Arquivos a criar

```
web/src/components/appointments/
├── create-appointment-modal.tsx
├── appointment-conflict-alert.tsx
├── student-schedule-section.tsx
├── edit-appointment-modal.tsx
└── __tests__/
    ├── create-appointment-modal.test.tsx
    └── student-schedule-section.test.tsx
```

## Arquivos a modificar

- `web/src/app/students/[id]/page.tsx` (ou onde for o header do perfil) — adicionar botão "Agendar"
- Adicionar `StudentScheduleSection` na página do perfil, entre as seções existentes

---

## Detalhamento

### `CreateAppointmentModal`

Props:
```typescript
interface Props {
    isOpen: boolean
    onClose: () => void
    preselectedStudentId?: string  // quando vem do perfil do aluno
    preselectedDate?: string       // quando vem do calendário (Fase 7)
    preselectedTime?: string
    onSuccess?: (recurringId: string) => void
}
```

Campos (na ordem):

1. **Aluno** (autocomplete com busca; oculto/disabled se `preselectedStudentId`)
2. **Dia da semana** — dropdown ou grid de 7 botões
3. **Hora de início** — `<input type="time">` ou time picker custom
4. **Duração** — chips de 45/60/90 min + "Outra" que abre input numérico
5. **Frequência** — radio: Semanal / Quinzenal / Mensal (default: Semanal)
6. **Data de início** — `<input type="date">`, default = próxima ocorrência do dia da semana escolhido a partir de hoje
7. **Notas** — textarea opcional

**Interação especial quando `frequency='monthly'`:**
Por limitação do helper de projeção (ancora em `starts_on`, ignora `day_of_week`), o server action valida que `day_of_week === new Date(starts_on).getDay()` e rejeita se não bater. Pra evitar que o trainer chegue no erro do servidor, o modal deve:

- Quando o trainer seleciona "Mensal", **auto-ajustar `day_of_week`** ao dia da semana de `starts_on`
- Quando muda `starts_on` e frequência é mensal, **re-ajustar `day_of_week`** automaticamente
- Mostrar aviso inline embaixo do campo: "Rotinas mensais usam a data de início como referência — o dia da semana é ajustado automaticamente."

Para `weekly` e `biweekly`, nenhum ajuste automático — `day_of_week` e `starts_on` podem divergir sem problemas.

**Comportamento:**
- Ao salvar, chama `createRecurringAppointment` da Fase 2
- Se response tem `conflicts.length > 0`, mostra `AppointmentConflictAlert` com a lista — usuário clica "Continuar mesmo assim" para confirmar ou "Cancelar"
- Sucesso → toast "Rotina criada" + `onSuccess?.()` + fecha modal

**Estilo:** seguir padrão dos modais existentes (veja `StudentModal` em `web/src/components/student-modal.tsx`).

### `StudentScheduleSection`

Props:
```typescript
interface Props {
    studentId: string
}
```

- **Client component** que busca rotinas ativas do aluno via browser Supabase client + useEffect + `refreshKey` (padrão usado por `LoadProgressionChart` e outros cards de sidebar do perfil). Consulta direta a `recurring_appointments` filtrando `student_id={id} AND status='active'`. Não usar `listAppointmentsInRange` — a seção mostra a regra, não as ocorrências expandidas
- Renderiza cada rotina como card: dia da semana + hora + duração + frequência + notas
- Ações em cada card: "Editar", "Encerrar rotina"
- Empty state: "Nenhuma rotina cadastrada. Clique em 'Agendar' pra começar."
- `refreshKey` permite atualizar a lista sem revalidar a página inteira quando o trainer cria/edita/encerra uma rotina

**Nota sobre notas:** o helper de projeção da Fase 1 concatena `notes` da regra + `notes` da exceção (quando há) com `\n`. Ao renderizar uma ocorrência específica (Fase 4/7), se a string contém `\n`, exibir as duas linhas separadas com rótulos visuais distintos ("Rotina:" e "Ajuste desta ocorrência:") para o trainer distinguir facilmente.

### `EditAppointmentModal`

Similar ao create mas:
- Recebe `recurringId`, carrega dados existentes
- Campos pré-preenchidos
- Chama `updateRecurringAppointment` ao salvar
- Aviso amarelo se houver exceções no futuro: "Essa rotina tem N ajustes individuais. Eles serão mantidos."

### Botão "Agendar" no perfil do aluno

Encontrar o header atual do perfil do aluno. Adicionar botão "Agendar" no grupo de ações, na mesma linha dos outros botões. Ao clicar, abre `CreateAppointmentModal` com `preselectedStudentId`.

---

## Testes

### `create-appointment-modal.test.tsx`

- Renderiza todos os campos
- Aluno vem pré-selecionado e disabled quando `preselectedStudentId` é passado
- Default "próxima ocorrência" calculado corretamente pra cada dia da semana
- Chama `createRecurringAppointment` com os valores corretos
- Mostra `AppointmentConflictAlert` quando há conflitos
- Fecha modal em sucesso
- Validação visual quando campos obrigatórios ficam vazios

### `student-schedule-section.test.tsx`

- Renderiza lista de rotinas ativas
- Empty state quando aluno não tem rotinas
- Botão "Editar" abre modal
- Botão "Encerrar rotina" abre confirmação

**Mock padrão:** seguir `web/src/components/dashboard/__tests__/widget-picker.test.tsx`.

---

## Critérios de aceite

- [ ] Trainer consegue criar rotina pelo botão "Agendar" no perfil de um aluno
- [ ] Rotina aparece em "Rotina atual" na mesma página após criação
- [ ] Editar rotina funciona e reflete mudanças
- [ ] Encerrar rotina pede confirmação e remove da lista de ativas
- [ ] Conflitos mostram alerta visual mas permitem prosseguir
- [ ] Testes passam, tsc e eslint clean

---

## Referências

- Modal de referência: `web/src/components/student-modal.tsx`
- Setup de teste: `web/src/test/setup.tsx`
- Actions usadas: Fase 2
