# Fase 3.5 — Rotinas multi-slot

**Objetivo:** permitir que o trainer crie em um único fluxo rotinas com múltiplos dias/horários ("pacote") pro mesmo aluno. Caso real muito comum: "Gustavo: Seg 7h, Qua 7h, Sex 18h".

**Por que "3.5" em vez de uma fase nova:** é uma evolução sobre a Fase 3, não uma entrega completamente separada. Reaproveita 90% do código já existente.

**Pré-requisito:** Fases 1-3 concluídas.

---

## Decisão de modelagem: `group_id`

Mantém o schema atual (1 linha = 1 dia + 1 horário). Adiciona coluna `recurring_appointments.group_id UUID NULL` pra agrupar N linhas do mesmo pacote.

**Vantagens:**
- Migration aditiva — não quebra Fases 1/2
- Helper de projeção (Fase 1) continua funcionando sem mudanças
- Server actions (Fase 2) continuam funcionando — apenas adicionam suporte opcional a `groupId`
- Google Calendar mantém semântica correta (cada slot = 1 evento recorrente separado no Google)

**Como funciona:**
- Rotina simples (1 dia): `group_id = NULL`
- Rotina multi-slot (N dias): todas as N linhas com o mesmo `group_id` (UUID novo gerado no ato da criação)

---

## Decisões de UX (já fechadas com usuário)

| Decisão | Escolha |
|---------|---------|
| Modal de criação | Permite múltiplos slots (dia+horário+duração por slot) |
| Exibição na "Rotina atual" | Card do pacote com header (resumo) + linhas de slots com ações individuais |
| Editar um slot | Afeta apenas aquele slot (aquela linha) — não o pacote |
| Notas | **Compartilhadas no grupo**: uma nota única aplicada a todas as linhas do grupo. Editar a nota de um slot replica nos outros |
| Encerrar | **Duas opções**: "Encerrar pacote" (encerra todos os slots do grupo) + "Encerrar esta" (encerra só um slot) |
| Agrupar rotinas existentes | **Fora do MVP** |

---

## Entregáveis

1. Migration nova (`107_recurring_appointments_group.sql`) — coluna `group_id`
2. Modal de criação refatorado pra permitir múltiplos slots
3. Server action `createRecurringAppointmentGroup` que cria N linhas com mesmo `group_id`
4. Atualização de `StudentScheduleSection` pra agrupar e mostrar híbrido
5. Atualização de `updateRecurringAppointment` pra propagar notas quando é do grupo
6. Novo server action `cancelRecurringGroup(groupId, endsOn?)`
7. Atualização de testes
8. **Débito técnico da Fase 3 (banner "N ajustes individuais" em EditModal) vai pra Fase 4** — reconfirmado

---

## Arquivos

### Novos

- `supabase/migrations/107_recurring_appointments_group.sql`
- `web/src/actions/appointments/create-recurring-group.ts`
- `web/src/actions/appointments/cancel-recurring-group.ts`
- `web/src/actions/appointments/__tests__/create-recurring-group.test.ts`
- `web/src/actions/appointments/__tests__/cancel-recurring-group.test.ts`
- `web/src/components/appointments/recurring-group-card.tsx` — card de pacote na seção "Rotina atual"
- `web/src/components/appointments/__tests__/recurring-group-card.test.tsx`

### Modificados

- `web/src/actions/appointments/schemas.ts` — adicionar `createRecurringGroupInputSchema` com `slots: Array<{dayOfWeek, startTime, durationMinutes}>` + campos compartilhados (studentId, frequency, startsOn, notes)
- `web/src/actions/appointments/update-recurring.ts` — se a rotina sendo editada pertence a um grupo E `notes` foi alterado, propagar `notes` pra todas as rotinas do mesmo `group_id`
- `web/src/actions/appointments/list-appointments.ts` — incluir `group_id` no retorno de ocorrências
- `web/src/components/appointments/create-appointment-modal.tsx` — refatorar pra permitir múltiplos slots
- `web/src/components/appointments/student-schedule-section.tsx` — agrupar rotinas por `group_id` antes de renderizar (usar `RecurringGroupCard` pra grupos, cartão individual pra rotinas sem grupo)

---

## Migration

```sql
-- ========================================================================
-- Migração 107: Grupo de rotinas recorrentes (pacotes multi-slot)
-- ========================================================================
--
-- Adiciona `group_id` opcional em `recurring_appointments` pra agrupar
-- rotinas do mesmo "pacote" — caso em que um aluno treina em múltiplos
-- dias/horários distintos na mesma semana.
--
-- Rotinas simples continuam com `group_id = NULL`. Rotinas criadas em
-- pacote compartilham o mesmo UUID.
-- ========================================================================

ALTER TABLE recurring_appointments
    ADD COLUMN group_id UUID;

CREATE INDEX idx_recurring_appointments_group
    ON recurring_appointments(group_id)
    WHERE group_id IS NOT NULL;

COMMENT ON COLUMN recurring_appointments.group_id IS
    'Agrupa linhas que fazem parte do mesmo pacote multi-slot. NULL quando a rotina é simples (1 dia/horário).';
```

---

## Modal de criação (refatoração)

### Estado interno

Em vez de campos individuais `dayOfWeek`, `startTime`, `durationMinutes`, o estado passa a ser:

```typescript
interface Slot {
    id: string  // UUID temporário, só pra manipulação da UI
    dayOfWeek: number
    startTime: string      // "HH:MM"
    durationMinutes: number
}

const [slots, setSlots] = useState<Slot[]>([
    { id: newId(), dayOfWeek: nextWeekdayFromToday(), startTime: '07:00', durationMinutes: 60 },
])
```

### UI

Seção "DIAS E HORÁRIOS" substitui as seções atuais de "Dia da Semana" + "Horário" + "Duração":

- Lista vertical de cards. Cada card tem o rótulo **"Dia 1"**, **"Dia 2"**, etc. (terminologia do trainer, não "SLOT"):
  - Dropdown ou pills compactos com dia da semana
  - `<input type="time">` pro horário
  - Chip selector pra duração (45/60/90 + "Outra")
  - Botão `×` (lucide `X`) pra remover o card (só aparece se houver mais de 1)
- Abaixo da lista: botão outline "+ Adicionar dia" adiciona novo card com valores default
- Validação client-side:
  - Precisa ter pelo menos 1 card
  - Não permitir 2 cards com mesmo `dayOfWeek` + mesmo `startTime` (duplicata inútil)
  - Avisar mas permitir 2 cards no mesmo dia com horários diferentes

**Nota de terminologia:** na API, banco e código interno, o termo "slot" continua sendo usado (já está consolidado). Apenas na UI visível pro trainer, usar "Dia N" ou referenciar pelo dia da semana.

### Frequência ficou mais complexa?

**Não** — a frequência é compartilhada entre slots (semanal/quinzenal/mensal).

### Comportamento especial `monthly`

Como monthly precisa que `dayOfWeek === new Date(starts_on).getDay()`, em modo monthly:

- Fica permitido apenas **1 slot**
- O botão "+ Adicionar dia" fica desabilitado com tooltip "Rotinas mensais permitem apenas um dia"
- O campo `dayOfWeek` do slot único fica readonly (derivado de `starts_on`, igual Fase 3)

### Submit

Se `slots.length === 1`: usa `createRecurringAppointment` existente (preserva rotinas simples sem `group_id`).

Se `slots.length > 1`: usa `createRecurringAppointmentGroup` nova, que cria N linhas com o mesmo `group_id`.

---

## Server actions

### `createRecurringAppointmentGroup(input)`

```typescript
interface Input {
    studentId: string
    slots: Array<{
        dayOfWeek: number
        startTime: string
        durationMinutes: number
    }>
    frequency: 'weekly' | 'biweekly' | 'monthly'
    startsOn: string
    endsOn?: string | null
    notes?: string | null
}

interface Output {
    success: boolean
    error?: string
    data?: {
        groupId: string
        appointmentIds: string[]
        pendingConflicts?: Array<{ slotIndex: number; conflicts: Array<{ studentName; startTime }> }>
    }
}
```

Lógica:
1. Valida input (Zod)
2. Se `frequency === 'monthly'` e `slots.length > 1`, retorna erro "Rotinas mensais permitem apenas um dia"
3. Para cada slot, detectar conflitos (mesma lógica do `createRecurringAppointment`)
4. Se houver conflitos em qualquer slot e `!options.confirmConflicts`, retorna `pendingConflicts` e NÃO insere
5. Gera UUID pra `group_id`
6. Insere N linhas em `recurring_appointments` com o mesmo `group_id`, mesma `frequency`, mesma `notes`
7. Retorna `{ groupId, appointmentIds }`

### `cancelRecurringGroup(groupId, endsOn?)`

Encerra todas as rotinas do grupo de uma vez:

```sql
UPDATE recurring_appointments
SET status = 'canceled',
    ends_on = COALESCE($endsOn, CURRENT_DATE),
    updated_at = now()
WHERE group_id = $groupId
  AND trainer_id = current_trainer_id()
  AND status = 'active'
```

### Alteração em `updateRecurringAppointment`

Quando editando uma rotina que pertence a grupo (`group_id IS NOT NULL`) e o campo `notes` foi alterado:
- Propagar `notes` pra todas as linhas do mesmo `group_id` (`UPDATE ... WHERE group_id = X`)
- Outros campos (dayOfWeek, startTime, durationMinutes) só afetam a linha sendo editada (não propaga)

---

## `StudentScheduleSection` refatorada

Agrupa rotinas por `group_id` antes de renderizar:

```typescript
// Busca todas as rotinas ativas do aluno
const recurring = await supabase
    .from('recurring_appointments')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'active')

// Agrupa
const groups = groupBy(recurring, r => r.group_id ?? `single-${r.id}`)

// Renderiza
Object.entries(groups).map(([key, rows]) => {
    if (rows.length === 1 && !rows[0].group_id) {
        // Rotina simples — card individual (igual Fase 3)
        return <SingleAppointmentCard rotina={rows[0]} />
    } else {
        // Pacote — novo card com header + lista de slots
        return <RecurringGroupCard slots={rows} />
    }
})
```

### `RecurringGroupCard`

Header:
- Título resumido: "3 treinos/semana" + pills compactas "Seg · Qua · Sex"
- Notas compartilhadas (se houver)
- Ação principal: "Encerrar pacote" (com confirmação igual à de rotina individual)
- Ação secundária: "Editar pacote" → abre modal de edição com todos os slots

Lista de slots (expandida por default):
- Linha por slot: "Seg às 7h · 60 min" + ações hover (`Pencil` edita só este slot, `Trash2` encerra só este slot)

### Degradação graceful pra 1 slot

Se o trainer cancelou N-1 slots de um pacote e sobrou apenas 1 slot ativo, o `StudentScheduleSection` renderiza o último slot restante como **card individual** (igual a uma rotina simples), não como "Pacote de 1 treino" que ficaria visualmente estranho.

- `group_id` permanece na linha no banco (histórico preservado)
- Apenas a apresentação muda
- Lógica no `StudentScheduleSection`: `if (rows.length === 1) renderIndividual() else renderGroup()`

### Tratamento de falhas na propagação de notas

Quando `updateRecurringAppointment` propaga `notes` pra outras linhas do grupo, a operação pode falhar (RLS, rede, etc.). No MVP aceitamos inconsistência temporária:

- Edição principal persiste (a linha sendo editada)
- Propagação é tentada imediatamente após
- Se propagação falha, `console.error` + a edição original continua válida
- Próxima edição de `notes` em qualquer linha do grupo resincroniza

**Débito técnico pra V2:** quando o projeto tiver Sentry ou telemetria similar, esses erros devem ser reportados. Hoje ficam apenas no console do servidor.

---

## Testes

### `create-recurring-group.test.ts`

- Cria grupo com 3 slots válidos
- Retorna erro se `frequency='monthly'` e `slots.length > 1`
- Retorna `pendingConflicts` com `slotIndex` quando há conflitos e `!confirmConflicts`
- Insere mesmo com conflitos quando `confirmConflicts=true`
- Todas as linhas compartilham o mesmo `group_id`
- Nenhuma linha é inserida se validação falhar

### `cancel-recurring-group.test.ts`

- Cancela todas as rotinas do grupo
- Não afeta rotinas de outros grupos
- Respeita auth (não cancela rotinas de outros trainers)

### `recurring-group-card.test.tsx`

- Renderiza header com contagem correta
- Renderiza todos os slots
- "Encerrar pacote" chama `cancelRecurringGroup`
- "Encerrar esta" chama `cancelRecurringAppointment` (individual)
- Edição de slot individual chama `updateRecurringAppointment`

### Testes existentes que precisam ser revistos

- `create-appointment-modal.test.tsx` — atualizar pros novos estados de slots
- `student-schedule-section.test.tsx` — testar renderização de grupos

---

## Critérios de aceite

- [ ] Trainer consegue criar rotina com 3 slots num único fluxo
- [ ] "Rotina atual" mostra o pacote como card agrupado
- [ ] Editar um slot afeta apenas aquele slot
- [ ] Editar as notas de um slot propaga pros outros do grupo
- [ ] "Encerrar pacote" encerra todos os slots
- [ ] "Encerrar esta" encerra apenas um slot (resto continua ativo)
- [ ] Monthly rejeita múltiplos slots
- [ ] Validação de duplicatas (dia+horário iguais) funciona
- [ ] Testes passam
- [ ] tsc e eslint clean

---

## Débitos técnicos conhecidos (fora de escopo desta fase)

1. **"Editar pacote" como bulk edit**: hoje o trainer precisa editar slot a slot pra mudar frequência do pacote inteiro. Seria natural extender `EditAppointmentModal` com toggle "aplicar a todo o pacote" quando a rotina tem `group_id`. Não foi incluído pra não expandir escopo.
2. **Telemetria de falha na propagação de `notes`**: hoje `console.error` apenas. Quando o projeto tiver Sentry ou similar, adicionar report.
3. **Agrupar rotinas avulsas em pacote depois**: trainer não consegue hoje transformar 3 rotinas independentes num pacote sem recriar. Útil mas V2+.

## Referências

- Spec original: `fase-3-ui-modal-perfil.md`
- Helper de projeção: `shared/utils/appointments-projection.ts` (Fase 1)
- Actions base: `web/src/actions/appointments/` (Fase 2)
