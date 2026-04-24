# Fase 2 — Server actions CRUD

**Objetivo:** toda a lógica de negócio para criar, editar, remarcar e cancelar agendamentos, exposta como server actions do Next.js. Sem UI ainda — mas testável via chamadas diretas.

**Pré-requisito:** Fase 1 concluída (tabelas e helper de projeção existem).

---

## Entregáveis

1. Server actions em `web/src/actions/appointments/`
2. Validação com Zod (seguindo padrão do projeto)
3. Detecção de conflito (avisa mas permite)
4. Testes unitários para cada action

---

## Arquivos a criar

```
web/src/actions/appointments/
├── create-recurring.ts
├── update-recurring.ts
├── cancel-recurring.ts
├── reschedule-occurrence.ts
├── cancel-occurrence.ts
├── mark-occurrence-status.ts
├── list-appointments.ts
├── __tests__/
│   ├── create-recurring.test.ts
│   ├── update-recurring.test.ts
│   ├── cancel-recurring.test.ts
│   ├── reschedule-occurrence.test.ts
│   ├── cancel-occurrence.test.ts
│   ├── mark-occurrence-status.test.ts
│   └── list-appointments.test.ts
└── schemas.ts  # schemas Zod compartilhados
```

---

## Detalhamento

### 1. Schemas Zod (`schemas.ts`)

```typescript
import { z } from 'zod'

export const frequencySchema = z.enum(['weekly', 'biweekly', 'monthly'])
export const exceptionKindSchema = z.enum(['rescheduled', 'canceled', 'completed', 'no_show'])

export const createRecurringInputSchema = z.object({
    studentId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().min(15).max(240).default(60),
    frequency: frequencySchema.default('weekly'),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
})
export type CreateRecurringInput = z.infer<typeof createRecurringInputSchema>

export const updateRecurringInputSchema = createRecurringInputSchema
    .partial()
    .extend({ id: z.string().uuid() })

export const rescheduleOccurrenceInputSchema = z.object({
    recurringAppointmentId: z.string().uuid(),
    originalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newStartTime: z.string().regex(/^\d{2}:\d{2}$/),
    scope: z.enum(['only_this', 'this_and_future']),
    notes: z.string().max(500).optional(),
})
```

### 2. `create-recurring.ts`

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createRecurringInputSchema, type CreateRecurringInput } from './schemas'
import { getCurrentTrainerId } from '@/lib/auth/get-current-trainer'

export interface CreateRecurringResult {
    success: boolean
    error?: string
    data?: {
        id: string
        conflicts: Array<{ studentName: string; startTime: string }>
    }
}

/**
 * Cria uma nova rotina recorrente. Detecta conflitos (mesmo dia+horário)
 * mas permite criação — conforme decisão 12 da Seção 2 do plano.
 */
export async function createRecurringAppointment(
    input: CreateRecurringInput,
): Promise<CreateRecurringResult> {
    // 1. Validar input com Zod
    // 2. Validar regra extra pra frequency='monthly':
    //    day_of_week deve bater com (new Date(startsOn)).getDay().
    //    Se não bater, retornar erro claro:
    //    "Para rotinas mensais, o dia da semana precisa coincidir com a data de início."
    //    Justificativa: o helper de projeção (Fase 1) ignora day_of_week quando
    //    frequency='monthly' e ancora em starts_on. Pra UX ficar consistente, o
    //    trainer precisa escolher starts_on que cai no day_of_week selecionado.
    // 3. Obter trainer atual (auth)
    // 4. Verificar se o studentId pertence ao trainer
    // 5. Detectar conflitos: buscar rotinas ativas do trainer no mesmo day_of_week
    //    cujos horários se sobrepõem ao novo agendamento
    // 6. Inserir em recurring_appointments
    // 7. Retornar { success, data: { id, conflicts } }
}
```

**Regra específica de `monthly`:** conforme descoberta na Fase 1, o helper de projeção ancora ocorrências mensais em `starts_on` (mesma data do mês) e ignora `day_of_week`. Pro server action não permitir inconsistência, validamos que `day_of_week === new Date(starts_on).getDay()` quando `frequency='monthly'`. A UI da Fase 3 deve facilitar isso preenchendo automaticamente `day_of_week` quando o trainer muda `starts_on` em frequência mensal (ou mostrando aviso se divergir).

Padrão de retorno segue convenção do projeto (veja `web/src/actions/financial/mark-as-paid.ts`).

### 3. `update-recurring.ts`

Permite editar uma rotina inteira. Atualiza campos da regra. Exceções existentes ficam intactas (conforme Seção 4.4 do plano).

### 4. `cancel-recurring.ts`

```typescript
export async function cancelRecurringAppointment(params: {
    id: string
    endsOn?: string  // default: hoje
}): Promise<{ success: boolean; error?: string }>
```

Seta `status='canceled'` e `ends_on`. Ocorrências após `ends_on` param de aparecer na projeção.

### 5. `reschedule-occurrence.ts`

```typescript
export async function rescheduleOccurrence(
    input: RescheduleOccurrenceInput,
): Promise<{ success: boolean; error?: string }>
```

Lógica baseada em `scope`:

- **`only_this`**: insere 1 linha em `appointment_exceptions` com `kind='rescheduled'`, `new_date` e `new_start_time`. Se já existir exceção pra essa `occurrence_date`, atualiza.
- **`this_and_future`**:
  1. Atualiza a rotina original definindo `ends_on = originalDate - 1 dia`
  2. Cria nova rotina com `starts_on = newDate` e os novos campos
  3. Exceções futuras da rotina original permanecem associadas a ela (ficam "órfãs" após `ends_on`, o que é ok — projeção ignora)

### 6. `cancel-occurrence.ts`

Insere linha em `appointment_exceptions` com `kind='canceled'`. Upsert: se já houver exceção pra essa data, atualiza o kind.

### 7. `mark-occurrence-status.ts`

```typescript
export async function markOccurrenceStatus(params: {
    recurringAppointmentId: string
    occurrenceDate: string
    status: 'completed' | 'no_show'
    notes?: string
}): Promise<{ success: boolean; error?: string }>
```

Upsert em `appointment_exceptions`.

### 8. `list-appointments.ts`

```typescript
export async function listAppointmentsInRange(params: {
    rangeStart: string  // YYYY-MM-DD
    rangeEnd: string
}): Promise<{
    success: boolean
    data?: AppointmentOccurrence[]
    error?: string
}>
```

Busca regras ativas + exceções do trainer, chama `expandAppointments` do helper, retorna ocorrências ordenadas.

---

## Testes

Cada arquivo de teste deve cobrir:

### `create-recurring.test.ts`

- Cria rotina válida com todos os campos
- Retorna erro se `studentId` não pertence ao trainer
- Retorna erro se Zod rejeita input malformado
- Detecta conflito e retorna lista de conflitos (mas insere mesmo assim)
- Não quebra se não houver conflitos
- Usuário não autenticado → erro
- **Monthly com `day_of_week` inconsistente com `starts_on`**: retorna erro claro sem inserir no banco
- **Monthly com `day_of_week` consistente com `starts_on`**: cria normalmente
- **Weekly/biweekly**: aceita qualquer `day_of_week` vs `starts_on` (sem validação extra)

### `reschedule-occurrence.test.ts`

- `only_this`: insere exceção correta
- `only_this` com exceção pré-existente: atualiza
- `this_and_future`: atualiza rotina antiga + cria nova
- Rejeita `newDate` anterior a `originalDate` (avisa mas permite? decidir na impl — seguir regra "avisa mas permite")

### Padrão de mock

Seguindo `web/src/app/api/prescription/analyze/__tests__/route.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => mockSupabase)
}))

vi.mock('@/lib/auth/get-current-trainer', () => ({
    getCurrentTrainerId: vi.fn(() => 'trainer-uuid-1')
}))

const mockSupabase = {
    from: vi.fn(() => chainable),
    // ...
}
```

---

## Critérios de aceite

- [ ] Todas as 7 server actions implementadas seguindo padrão do projeto
- [ ] Todas as entradas validadas via Zod
- [ ] Conflitos detectados mas não bloqueados
- [ ] Testes passam: `npm run test:run`
- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint` clean nos arquivos novos
- [ ] Chamada manual via console do browser (após login) cria agendamento e confere dados no banco

---

## Referências

- Action de referência: `web/src/actions/financial/mark-as-paid.ts` (estrutura e tratamento de erro)
- Teste de referência: `web/src/app/api/prescription/analyze/__tests__/route.test.ts` (mocks Supabase)
- Helper de projeção: `shared/utils/appointments-projection.ts` (Fase 1)
