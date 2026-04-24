# Fase 1 — Modelo de dados e projeção

**Objetivo:** criar schema, RLS e o helper de projeção que expande regras de recorrência em ocorrências. Base técnica para tudo que vem depois. Sem UI nesta fase.

**Pré-requisito:** ler [`../agendamentos-plano.md`](../agendamentos-plano.md), especialmente seções 3 e 7.

---

## Entregáveis

1. Migration SQL criando `recurring_appointments` e `appointment_exceptions`
2. Helper `shared/utils/appointments-projection.ts` que expande regras + aplica exceções
3. Types TypeScript em `shared/types/appointments.ts`
4. Testes unitários do helper cobrindo os principais cenários

---

## Arquivos a criar/modificar

### Novos

- `supabase/migrations/106_agendamentos_tabelas.sql`
- `shared/types/appointments.ts`
- `shared/utils/appointments-projection.ts`
- `shared/utils/__tests__/appointments-projection.test.ts`

---

## Detalhamento

### 1. Migration SQL

Arquivo: `supabase/migrations/106_agendamentos_tabelas.sql`

```sql
-- ========================================================================
-- Migração 106: Tabelas de Agendamentos
-- ========================================================================
--
-- Adiciona suporte a rotinas recorrentes de treino (appointments).
-- Estratégia: guardar a REGRA (recurring_appointments) e apenas EXCEÇÕES
-- pontuais (appointment_exceptions). Ocorrências são computadas on-the-fly
-- via shared/utils/appointments-projection.ts, seguindo o padrão de
-- assigned_workouts.scheduled_days.
-- ========================================================================

CREATE TABLE recurring_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- Regra
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    duration_minutes SMALLINT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    frequency TEXT NOT NULL DEFAULT 'weekly'
        CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),

    -- Ciclo de vida
    starts_on DATE NOT NULL,
    ends_on DATE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'canceled')),

    -- Metadados
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_appointments_trainer ON recurring_appointments(trainer_id);
CREATE INDEX idx_recurring_appointments_student ON recurring_appointments(student_id);
CREATE INDEX idx_recurring_appointments_active_trainer
    ON recurring_appointments(trainer_id, status) WHERE status = 'active';

-- Trigger updated_at (padrão Kinevo; reusa função existente se já houver)
CREATE TRIGGER set_recurring_appointments_updated_at
    BEFORE UPDATE ON recurring_appointments
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ========================================================================

CREATE TABLE appointment_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_appointment_id UUID NOT NULL
        REFERENCES recurring_appointments(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    occurrence_date DATE NOT NULL,

    kind TEXT NOT NULL
        CHECK (kind IN ('rescheduled', 'canceled', 'completed', 'no_show')),

    -- Só preenchidos quando kind = 'rescheduled'
    new_date DATE,
    new_start_time TIME,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (recurring_appointment_id, occurrence_date)
);

CREATE INDEX idx_appointment_exceptions_recurring
    ON appointment_exceptions(recurring_appointment_id);
CREATE INDEX idx_appointment_exceptions_trainer_date
    ON appointment_exceptions(trainer_id, occurrence_date);

-- ========================================================================
-- RLS (Row Level Security)
-- ========================================================================

ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_exceptions ENABLE ROW LEVEL SECURITY;

-- recurring_appointments
CREATE POLICY "Trainer can read own recurring appointments"
    ON recurring_appointments FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can insert own recurring appointments"
    ON recurring_appointments FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can update own recurring appointments"
    ON recurring_appointments FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can delete own recurring appointments"
    ON recurring_appointments FOR DELETE
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access recurring_appointments"
    ON recurring_appointments FOR ALL
    USING (auth.role() = 'service_role');

-- appointment_exceptions (mesmo padrão)
CREATE POLICY "Trainer can read own appointment exceptions"
    ON appointment_exceptions FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can insert own appointment exceptions"
    ON appointment_exceptions FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can update own appointment exceptions"
    ON appointment_exceptions FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can delete own appointment exceptions"
    ON appointment_exceptions FOR DELETE
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access appointment_exceptions"
    ON appointment_exceptions FOR ALL
    USING (auth.role() = 'service_role');

-- ========================================================================
-- Realtime (seguindo padrão assistant_insights)
-- ========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE recurring_appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_exceptions;

COMMENT ON TABLE recurring_appointments IS
    'Rotinas recorrentes de atendimento. Guarda a regra; ocorrências são computadas on-the-fly.';
COMMENT ON TABLE appointment_exceptions IS
    'Desvios pontuais de uma rotina (remarcações, cancelamentos individuais, no-shows).';
```

### 2. Types TypeScript

Arquivo: `shared/types/appointments.ts`

```typescript
export type AppointmentFrequency = 'weekly' | 'biweekly' | 'monthly'
export type AppointmentStatus = 'active' | 'canceled'
export type ExceptionKind = 'rescheduled' | 'canceled' | 'completed' | 'no_show'

export interface RecurringAppointment {
    id: string
    trainer_id: string
    student_id: string
    day_of_week: number  // 0=Dom, 6=Sáb
    start_time: string   // "HH:MM" ou "HH:MM:SS"
    duration_minutes: number
    frequency: AppointmentFrequency
    starts_on: string    // "YYYY-MM-DD"
    ends_on: string | null
    status: AppointmentStatus
    notes: string | null
    created_at: string
    updated_at: string
}

export interface AppointmentException {
    id: string
    recurring_appointment_id: string
    trainer_id: string
    occurrence_date: string    // "YYYY-MM-DD"
    kind: ExceptionKind
    new_date: string | null
    new_start_time: string | null
    notes: string | null
    created_at: string
}

/**
 * Ocorrência expandida: representa uma instância concreta de um agendamento
 * recorrente em uma data específica, já com exceções aplicadas.
 */
export interface AppointmentOccurrence {
    recurringAppointmentId: string
    studentId: string
    trainerId: string

    /** Data efetiva (pode diferir de originalDate se houve remarcação) */
    date: string          // "YYYY-MM-DD"
    /** Hora efetiva */
    startTime: string     // "HH:MM"
    durationMinutes: number

    /** Data original antes de qualquer remarcação */
    originalDate: string

    /** Status computado */
    status: 'scheduled' | 'rescheduled' | 'completed' | 'no_show'

    /** True se há linha em appointment_exceptions pra essa ocorrência */
    hasException: boolean

    notes: string | null
}
```

### 3. Helper de projeção

Arquivo: `shared/utils/appointments-projection.ts`

Segue o estilo e convenções de `shared/utils/schedule-projection.ts`. Pure functions, sem dependência de Supabase (recebe as linhas via argumento).

```typescript
import type {
    RecurringAppointment,
    AppointmentException,
    AppointmentOccurrence,
    AppointmentFrequency,
} from '../types/appointments'

/**
 * Expande uma regra de recorrência em ocorrências dentro de uma janela,
 * aplicando exceções. Pure function, sem side effects.
 *
 * @param recurring - regras ativas do trainer
 * @param exceptions - exceções associadas às regras
 * @param rangeStart - início da janela (inclusivo)
 * @param rangeEnd - fim da janela (inclusivo)
 * @returns ocorrências ordenadas por data+hora, exceções aplicadas
 */
export function expandAppointments(
    recurring: RecurringAppointment[],
    exceptions: AppointmentException[],
    rangeStart: Date,
    rangeEnd: Date,
): AppointmentOccurrence[] {
    // 1. Index exceptions por (recurringId, originalDate) pra lookup rápido
    // 2. Pra cada regra active:
    //    a. Iterar datas candidatas no range (respeitando day_of_week + frequency)
    //    b. Pular datas antes de starts_on ou depois de ends_on
    //    c. Se houver exceção:
    //       - kind='canceled': skip
    //       - kind='rescheduled': usar new_date/new_start_time
    //       - kind='completed'/'no_show': incluir com status correto
    //    d. Caso contrário, usar dados da regra (status='scheduled')
    // 3. Ordenar resultado por date+startTime
}

/** Próximas N ocorrências a partir de `fromDate`. */
export function getNextOccurrences(
    recurring: RecurringAppointment[],
    exceptions: AppointmentException[],
    fromDate: Date,
    limit: number,
): AppointmentOccurrence[] {
    // Expande uma janela de 90 dias e retorna as primeiras N futuras
}

/** Ocorrências de um dia específico. */
export function getOccurrencesForDay(
    recurring: RecurringAppointment[],
    exceptions: AppointmentException[],
    date: Date,
): AppointmentOccurrence[] {
    // Usa expandAppointments com rangeStart=rangeEnd=date
}

/** Helper interno: itera datas válidas pra uma regra entre rangeStart e rangeEnd. */
function iterateValidDates(
    rule: RecurringAppointment,
    rangeStart: Date,
    rangeEnd: Date,
): Date[] {
    // Lógica:
    // - Encontrar primeira data >= starts_on e >= rangeStart com day_of_week correto
    // - Step forward: 7 dias (weekly), 14 dias (biweekly), ~30 dias (monthly - mesma semana do mês)
    // - Parar quando passar de rangeEnd ou ends_on
}
```

**Pontos importantes:**
- Sem dependência de `Date.now()` ou TZ dinâmico — use apenas operações de data baseadas nos argumentos
- Helper exporta função `iterateValidDates` como test seam (pode ser `export` ou marcado com jsdoc interno)
- Timezone da lógica: assumir `America/Sao_Paulo` (padrão Kinevo)
- "Monthly" = mesma data do mês (se `starts_on = 2026-04-15`, próxima = `2026-05-15`)

### 4. Testes do helper

Arquivo: `shared/utils/__tests__/appointments-projection.test.ts`

Cobrir cenários (mínimo 15 cases):

```typescript
import { describe, it, expect } from 'vitest'
import {
    expandAppointments,
    getNextOccurrences,
    getOccurrencesForDay,
} from '../appointments-projection'
import type { RecurringAppointment, AppointmentException } from '../../types/appointments'

// Helpers de fixture
function makeRule(overrides: Partial<RecurringAppointment> = {}): RecurringAppointment { /* ... */ }
function makeException(overrides: Partial<AppointmentException> = {}): AppointmentException { /* ... */ }

describe('expandAppointments', () => {
    it('expande regra semanal em 4 ocorrências no mês', () => { /* ... */ })
    it('expande regra quinzenal em 2 ocorrências no mês', () => { /* ... */ })
    it('expande regra mensal em 1 ocorrência no mês', () => { /* ... */ })
    it('respeita starts_on (não gera antes)', () => { /* ... */ })
    it('respeita ends_on (não gera depois)', () => { /* ... */ })
    it('ignora regras com status canceled', () => { /* ... */ })
    it('aplica exceção rescheduled (troca data e hora)', () => { /* ... */ })
    it('aplica exceção canceled (remove ocorrência)', () => { /* ... */ })
    it('aplica exceção no_show (mantém data, status no_show)', () => { /* ... */ })
    it('aplica exceção completed (status completed)', () => { /* ... */ })
    it('retorna ordenado por data+hora mesmo com múltiplas regras', () => { /* ... */ })
    it('retorna array vazio quando não há regras', () => { /* ... */ })
    it('funciona quando range começa e termina no mesmo dia', () => { /* ... */ })
})

describe('getNextOccurrences', () => {
    it('retorna só ocorrências futuras a partir de fromDate', () => { /* ... */ })
    it('respeita limit', () => { /* ... */ })
})

describe('getOccurrencesForDay', () => {
    it('retorna apenas ocorrências daquele dia', () => { /* ... */ })
})
```

---

## Critérios de aceite

- [ ] Migration roda limpa em um banco de desenvolvimento fresco
- [ ] `supabase db reset` aplica a migration sem erros
- [ ] `npm run test:run` passa todos os testes em `shared/utils/__tests__/appointments-projection.test.ts`
- [ ] `npx tsc --noEmit` não reporta erros nos arquivos novos
- [ ] `npx eslint shared/utils/appointments-projection.ts` passa sem warnings
- [ ] RLS policies validadas manualmente: trainer A não consegue ler dados de trainer B

---

## Referências técnicas

- Estratégia de projeção: seções 3.1–3.4 do `agendamentos-plano.md`
- Helper de referência: `shared/utils/schedule-projection.ts`
- RLS de referência: migration 088 (`assistant_insights`)
- Tipo de referência: `shared/types/onboarding.ts`
