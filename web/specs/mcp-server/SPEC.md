# Kinevo MCP Server

## Status
- [x] Rascunho
- [ ] Em implementacao
- [ ] Concluida

---

## 1. Visao Geral

### O que e

O **Kinevo MCP Server** e um servidor MCP (Model Context Protocol) que permite que personal trainers operem a plataforma Kinevo diretamente de dentro do Claude.ai ou do ChatGPT, usando linguagem natural.

O trainer conecta sua conta Kinevo via API Key e passa a poder:
- Consultar e gerenciar alunos
- Criar e prescrever programas de treino
- Acompanhar progresso e metricas
- Enviar mensagens para alunos
- Visualizar dados financeiros

### Casos de Uso Primarios

| Prompt do Trainer | O que acontece |
|---|---|
| "Quais alunos nao treinaram essa semana?" | Lista alunos sem `workout_sessions` nos ultimos 7 dias |
| "Cria um programa de hipertrofia de 8 semanas para a Maria" | Cria `program_template` + `workout_templates` + `workout_item_templates` |
| "Me da um resumo do meu mes" | Agrega dados de alunos, programas, receita |
| "Manda uma mensagem motivacional pro Carlos" | Insere registro na tabela `messages` |
| "Qual o historico de carga no agachamento do Joao?" | Consulta `set_logs` filtrado por exercicio e aluno |

### Arquitetura de Alto Nivel

```
+------------------+       HTTPS (Streamable HTTP)       +----------------------+
|                  |  --------------------------------->  |                      |
|   Claude.ai /    |  Authorization: Bearer kinevo_...    |   Kinevo MCP Server  |
|   ChatGPT        |  <---------------------------------  |   /api/mcp/route.ts  |
|                  |       JSON-RPC responses              |                      |
+------------------+                                      +----------+-----------+
                                                                     |
                                                          validates API Key
                                                          resolves trainer_id
                                                                     |
                                                          +----------v-----------+
                                                          |                      |
                                                          |   Supabase           |
                                                          |   (PostgreSQL + Auth)|
                                                          |                      |
                                                          +----------------------+
```

**Fluxo:**
1. LLM envia JSON-RPC request via HTTP POST para `/api/mcp`
2. MCP Server extrai `Authorization: Bearer kinevo_trainer_<uuid>` do header
3. Valida o token contra a tabela `trainer_api_keys` (bcrypt hash comparison)
4. Resolve `trainer_id` e executa a tool requisitada com escopo do trainer
5. Retorna resultado como JSON-RPC response

---

## 2. Decisoes de Implementacao

### Hospedagem

**Route handler dentro do Next.js existente** em `src/app/api/mcp/route.ts`.

Justificativas:
- Evita novo servico/deploy separado
- Reutiliza os clientes Supabase ja configurados (`lib/supabase/admin.ts`)
- Compartilha tipos gerados do banco (`@kinevo/shared/types/database`)
- Ja esta no mesmo dominio (`www.kinevoapp.com`)
- Middleware do Next.js nao interfere (API routes em `/api/` ja sao excluidas do middleware de auth)

### Biblioteca MCP

```
@modelcontextprotocol/sdk (TypeScript)
```

Usar `McpServer` com `StreamableHTTPServerTransport` para criar um servidor stateless.

### Transporte

**Streamable HTTP** (stateless JSON-RPC over HTTP POST). Cada request e independente — sem sessoes, sem SSE persistente.

Endpoint unico: `POST /api/mcp`

### Autenticacao

**API Key** gerada na dashboard do Kinevo, armazenada como bcrypt hash na tabela `trainer_api_keys`.

Formato da key: `kinevo_trainer_<uuid-v4>`

O header de cada request:
```
Authorization: Bearer kinevo_trainer_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Supabase Client

Usar `supabaseAdmin` (service role) para todas as queries do MCP Server. Justificativa:
- A autenticacao e feita via API Key, nao via sessao Supabase
- RLS nao se aplica porque nao ha usuario Supabase autenticado no contexto
- O escopo por trainer e garantido programaticamente (`.eq('trainer_id', trainerId)` ou `.eq('coach_id', trainerId)`)

---

## 3. Modelo de Dados de Suporte

### Tabela `trainer_api_keys`

```sql
-- Migration: create_trainer_api_keys_table
CREATE TABLE public.trainer_api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  key_hash    text NOT NULL,
  key_prefix  text NOT NULL,  -- primeiros 12 chars para identificacao visual (ex: "kinevo_train")
  name        text NOT NULL DEFAULT 'Minha API Key',
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);

-- Indice para busca por trainer
CREATE INDEX idx_trainer_api_keys_trainer_id ON public.trainer_api_keys(trainer_id);

-- RLS (apenas para consistencia — o MCP Server usa admin client)
ALTER TABLE public.trainer_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage own api keys"
  ON public.trainer_api_keys
  FOR ALL
  USING (trainer_id = current_trainer_id())
  WITH CHECK (trainer_id = current_trainer_id());
```

### Logica de Geracao de Key

```typescript
// src/actions/api-keys/generate-api-key.ts
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

export async function generateApiKey(trainerId: string) {
  // Limite de 5 keys ativas por trainer (aplicacao, nao constraint SQL)
  const { count } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .is('revoked_at', null)

  if (count && count >= 5) {
    throw new Error('Limite de 5 API Keys ativas atingido. Revogue uma key existente.')
  }

  const rawKey = `kinevo_trainer_${randomUUID()}`
  const keyHash = await bcrypt.hash(rawKey, 12)
  const keyPrefix = rawKey.slice(0, 12)

  const { data, error } = await supabaseAdmin
    .from('trainer_api_keys')
    .insert({
      trainer_id: trainerId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: 'Minha API Key',
    })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error) throw error

  // rawKey e retornada UMA UNICA VEZ ao trainer
  return { ...data, raw_key: rawKey }
}
```

### Logica de Validacao de Key

```typescript
// src/lib/mcp/auth.ts
import bcrypt from 'bcryptjs'

export async function validateApiKey(
  bearerToken: string
): Promise<{ trainerId: string; keyId: string } | null> {
  // 1. Validar formato
  if (!bearerToken.startsWith('kinevo_trainer_')) return null

  // 2. Buscar todas as keys ativas do prefixo (nao revogadas)
  const prefix = bearerToken.slice(0, 12)
  const { data: keys } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id, trainer_id, key_hash')
    .eq('key_prefix', prefix)
    .is('revoked_at', null)

  if (!keys || keys.length === 0) return null

  // 3. Comparar hash (pode haver colisao de prefixo, por isso itera)
  for (const key of keys) {
    const match = await bcrypt.compare(bearerToken, key.key_hash)
    if (match) {
      // 4. Atualizar last_used_at (fire-and-forget)
      supabaseAdmin
        .from('trainer_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id)
        .then() // nao await — nao bloqueia a request

      return { trainerId: key.trainer_id, keyId: key.id }
    }
  }

  return null
}
```

### Endpoint de Geracao de API Key

```
POST /api/trainer/api-keys
```

**Server Action** (preferido por convencao do projeto):

```typescript
// src/actions/api-keys/generate-api-key.ts
'use server'

// Retorna { success: true, data: { id, name, key_prefix, created_at, raw_key } }
// raw_key so aparece nessa resposta — nunca mais

// src/actions/api-keys/list-api-keys.ts
'use server'

// Retorna { success: true, data: [{ id, name, key_prefix, created_at, last_used_at }] }
// Nunca retorna key_hash nem raw_key

// src/actions/api-keys/revoke-api-key.ts
'use server'

// Seta revoked_at = now() na key especificada
// Retorna { success: true }
```

---

## 4. Spec de Cada Tool

### 4.1 Alunos (`students`)

#### `kinevo_list_students`

```typescript
name: "kinevo_list_students"

description: "List the trainer's students with optional filters. Returns active students by default. Use this to find students by name, check who is active/inactive, or get an overview of all students."

inputSchema: z.object({
  search: z.string().optional().describe("Filter by student name (partial match, case-insensitive)"),
  status: z.enum(["active", "inactive", "pending"]).optional().describe("Filter by student status. Defaults to all statuses if omitted."),
  limit: z.number().min(1).max(100).default(50).describe("Max results to return"),
  offset: z.number().min(0).default(0).describe("Offset for pagination"),
})

// Output
outputSchema: {
  students: [{
    id: string,
    name: string,
    email: string,
    phone: string | null,
    status: "active" | "inactive" | "pending",
    objective: string | null,
    modality: "online" | "presential",
    avatar_url: string | null,
    created_at: string,
    active_program: { id: string, name: string } | null,
    last_workout_at: string | null,
  }],
  total: number,
}

// Supabase queries
implementation: `
  // Query principal
  let query = supabaseAdmin
    .from('students')
    .select('id, name, email, phone, status, objective, modality, avatar_url, created_at', { count: 'exact' })
    .eq('coach_id', trainerId)

  if (input.search) {
    query = query.ilike('name', '%' + input.search + '%')
  }
  if (input.status) {
    query = query.eq('status', input.status)
  }

  query = query
    .order('name', { ascending: true })
    .range(input.offset, input.offset + input.limit - 1)

  // Para cada aluno, buscar programa ativo e ultima sessao
  // (feito via query separada ou join lateral)
  const programsQuery = supabaseAdmin
    .from('assigned_programs')
    .select('id, name, student_id')
    .eq('trainer_id', trainerId)
    .eq('status', 'active')

  const lastWorkoutQuery = supabaseAdmin
    .from('workout_sessions')
    .select('student_id, completed_at')
    .eq('trainer_id', trainerId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Lista meus alunos ativos"
example: "Quais alunos estao inativos?"
example: "Busca aluno chamado Maria"
```

---

#### `kinevo_get_student`

```typescript
name: "kinevo_get_student"

description: "Get the complete profile of a specific student including personal data, clinical conditions, training history, and current program. Use this when the trainer asks about a specific student's details."

inputSchema: z.object({
  student_id: z.string().uuid().describe("The student's UUID"),
})

outputSchema: {
  student: {
    id: string,
    name: string,
    email: string,
    phone: string | null,
    status: string,
    objective: string | null,
    modality: string,
    avatar_url: string | null,
    trainer_notes: string | null,
    management_tags: string[] | null,
    created_at: string,
    // Perfil de prescricao
    prescription_profile: {
      training_level: string,
      goal: string,
      available_days: string[],
      session_duration_minutes: number,
      available_equipment: string[],
      medical_restrictions: object[],
    } | null,
    // Programa ativo
    active_program: {
      id: string,
      name: string,
      status: string,
      duration_weeks: number | null,
      started_at: string | null,
      current_week: number | null,
      workouts: { id: string, name: string, order_index: number }[],
    } | null,
    // Estatisticas
    stats: {
      total_sessions: number,
      sessions_last_30_days: number,
      last_workout_at: string | null,
      adherence_rate: number | null,
    },
    // Contrato financeiro
    contract: {
      status: string,
      amount: number,
      current_period_end: string | null,
    } | null,
  }
}

implementation: `
  // 1. Buscar aluno (com verificacao de coach_id)
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', input.student_id)
    .eq('coach_id', trainerId)
    .single()

  // 2. Perfil de prescricao
  const { data: profile } = await supabaseAdmin
    .from('student_prescription_profiles')
    .select('training_level, goal, available_days, session_duration_minutes, available_equipment, medical_restrictions')
    .eq('student_id', input.student_id)
    .eq('trainer_id', trainerId)
    .single()

  // 3. Programa ativo com workouts
  const { data: program } = await supabaseAdmin
    .from('assigned_programs')
    .select('id, name, status, duration_weeks, started_at, current_week, assigned_workouts(id, name, order_index)')
    .eq('student_id', input.student_id)
    .eq('trainer_id', trainerId)
    .eq('status', 'active')
    .single()

  // 4. Stats de sessoes
  const { count: totalSessions } = await supabaseAdmin
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', input.student_id)
    .eq('trainer_id', trainerId)
    .eq('status', 'completed')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentSessions } = await supabaseAdmin
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', input.student_id)
    .eq('trainer_id', trainerId)
    .eq('status', 'completed')
    .gte('completed_at', thirtyDaysAgo)

  // 5. Contrato ativo
  const { data: contract } = await supabaseAdmin
    .from('student_contracts')
    .select('status, amount, current_period_end')
    .eq('student_id', input.student_id)
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Me mostra o perfil completo da Maria"
example: "Quais sao as restricoes clinicas do Carlos?"
```

---

#### `kinevo_create_student`

```typescript
name: "kinevo_create_student"

description: "Register a new student for this trainer. Creates the student profile with Supabase Auth account and optionally sets clinical/training preferences."

inputSchema: z.object({
  name: z.string().min(2).describe("Student's full name"),
  email: z.string().email().describe("Student's email address"),
  phone: z.string().optional().describe("Student's phone number"),
  objective: z.string().optional().describe("Student's training objective (e.g., 'Hipertrofia', 'Emagrecimento', 'Qualidade de vida')"),
  modality: z.enum(["online", "presential"]).default("online").describe("Training modality"),
  training_level: z.enum(["beginner", "intermediate", "advanced"]).optional().describe("Student's training experience level"),
  medical_restrictions: z.array(z.object({
    condition: z.string(),
    notes: z.string().optional(),
  })).optional().describe("Medical conditions or restrictions (e.g., knee injury, herniated disc)"),
})

outputSchema: {
  student: {
    id: string,
    name: string,
    email: string,
    status: "active",
  },
  message: string,
}

implementation: `
  // REUTILIZAR a logica existente de src/actions/create-student.ts
  // Essa action ja:
  //   1. Cria o auth user no Supabase Auth (via admin client, email_confirm: true)
  //   2. Insere o registro em students com coach_id = trainerId, status = 'active'
  //   3. Dispara push notification (fire-and-forget)
  //   4. NAO cria trainer_student_links (link primario e students.coach_id)
  //   5. NAO envia email de convite explicitamente
  //
  // O MCP Server deve importar e chamar essa action diretamente.
  //
  // Fluxo:
  // 1. supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, password: auto })
  // 2. INSERT INTO students (name, email, phone, coach_id, status: 'active', objective, modality)
  // 3. Se training_level ou medical_restrictions:
  //    INSERT INTO student_prescription_profiles (student_id, trainer_id, training_level, medical_restrictions)
  // 4. Push notification (fire-and-forget)
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,
}

example: "Cadastra a Ana, email ana@email.com, objetivo hipertrofia, ela tem problema no ombro direito"
```

---

#### `kinevo_update_student`

```typescript
name: "kinevo_update_student"

description: "Update an existing student's profile data such as name, phone, objective, modality, notes, or training level."

inputSchema: z.object({
  student_id: z.string().uuid().describe("The student's UUID"),
  name: z.string().min(2).optional().describe("Updated name"),
  phone: z.string().optional().describe("Updated phone number"),
  objective: z.string().optional().describe("Updated training objective"),
  modality: z.enum(["online", "presential"]).optional().describe("Updated modality"),
  trainer_notes: z.string().optional().describe("Trainer's private notes about this student"),
  status: z.enum(["active", "inactive"]).optional().describe("Set student as active or inactive"),
})

outputSchema: {
  student: { id: string, name: string, status: string },
  message: string,
}

implementation: `
  const updates: Record<string, unknown> = {}
  if (input.name) updates.name = input.name
  if (input.phone) updates.phone = input.phone
  if (input.objective) updates.objective = input.objective
  if (input.modality) updates.modality = input.modality
  if (input.trainer_notes !== undefined) updates.trainer_notes = input.trainer_notes
  if (input.status) updates.status = input.status
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('students')
    .update(updates)
    .eq('id', input.student_id)
    .eq('coach_id', trainerId)
    .select('id, name, status')
    .single()
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,
}

example: "Muda o objetivo da Maria para emagrecimento"
example: "Adiciona uma nota no perfil do Carlos: prefere treinar de manha"
```

---

### 4.2 Programas de Treino (`programs`)

#### `kinevo_list_programs`

```typescript
name: "kinevo_list_programs"

description: "List training programs created by this trainer. Can filter by student (to see their program history) or by status. Returns both program templates and assigned programs."

inputSchema: z.object({
  student_id: z.string().uuid().optional().describe("Filter programs assigned to a specific student"),
  status: z.enum(["draft", "active", "scheduled", "completed", "paused", "expired"]).optional().describe("Filter by program status"),
  type: z.enum(["template", "assigned"]).default("assigned").describe("'template' for reusable program templates, 'assigned' for programs assigned to students"),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
})

outputSchema: {
  programs: [{
    id: string,
    name: string,
    description: string | null,
    status: string,             // apenas para assigned
    duration_weeks: number | null,
    student: { id: string, name: string } | null,  // apenas para assigned
    started_at: string | null,
    created_at: string,
    workout_count: number,
  }],
  total: number,
}

implementation: `
  if (input.type === 'template') {
    let query = supabaseAdmin
      .from('program_templates')
      .select('id, name, description, duration_weeks, is_archived, created_at, workout_templates(id)', { count: 'exact' })
      .eq('trainer_id', trainerId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)

    // workout_count = workout_templates.length
  } else {
    let query = supabaseAdmin
      .from('assigned_programs')
      .select('id, name, description, status, duration_weeks, started_at, created_at, student_id, students(id, name), assigned_workouts(id)', { count: 'exact' })
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)

    if (input.student_id) query = query.eq('student_id', input.student_id)
    if (input.status) query = query.eq('status', input.status)
  }
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Lista os programas ativos"
example: "Quais programas a Maria ja fez?"
```

---

#### `kinevo_get_program`

```typescript
name: "kinevo_get_program"

description: "Get full details of a training program including all workout sessions and exercises with sets, reps, and loads. Works for both templates and assigned programs."

inputSchema: z.object({
  program_id: z.string().uuid().describe("The program's UUID"),
  type: z.enum(["template", "assigned"]).default("assigned").describe("Whether this is a template or an assigned program"),
})

outputSchema: {
  program: {
    id: string,
    name: string,
    description: string | null,
    status: string | null,
    duration_weeks: number | null,
    student: { id: string, name: string } | null,
    started_at: string | null,
    workouts: [{
      id: string,
      name: string,
      order_index: number,
      items: [{
        id: string,
        item_type: string,
        order_index: number,
        exercise: { id: string, name: string, equipment: string | null, muscle_groups: string[] } | null,
        sets: number | null,
        reps: string | null,
        rest_seconds: number | null,
        notes: string | null,
        method_key: string | null,
        exercise_function: string | null,
      }],
    }],
  }
}

implementation: `
  if (input.type === 'assigned') {
    const { data } = await supabaseAdmin
      .from('assigned_programs')
      .select(\`
        id, name, description, status, duration_weeks, started_at,
        student_id, students(id, name),
        assigned_workouts(
          id, name, order_index,
          assigned_workout_items(
            id, item_type, order_index, exercise_id, exercise_name, exercise_equipment,
            sets, reps, rest_seconds, notes, method_key, exercise_function, parent_item_id,
            exercises(id, name, equipment)
          )
        )
      \`)
      .eq('id', input.program_id)
      .eq('trainer_id', trainerId)
      .single()

    // Para muscle_groups: query separada via exercise_muscle_groups + muscle_groups
  } else {
    // Similar mas usando program_templates / workout_templates / workout_item_templates
  }
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Me mostra o programa completo da Maria"
example: "Quais exercicios tem no Treino A do programa do Joao?"
```

---

#### `kinevo_create_program`

```typescript
name: "kinevo_create_program"

description: "Create a new training program template. This creates an empty program structure that can then have workout sessions and exercises added to it. Optionally assign it directly to a student."

inputSchema: z.object({
  name: z.string().min(2).describe("Program name (e.g., 'Hipertrofia - Fase 1')"),
  description: z.string().optional().describe("Program description and goals"),
  duration_weeks: z.number().min(1).max(52).optional().describe("Program duration in weeks"),
  student_id: z.string().uuid().optional().describe("If provided, creates the program as already assigned to this student (status: 'draft')"),
})

outputSchema: {
  program: {
    id: string,
    name: string,
    type: "template" | "assigned",
    status: string | null,
  },
  message: string,
}

implementation: `
  if (input.student_id) {
    // Criar como assigned_program (vinculado ao aluno)
    // Verificar que o aluno pertence ao trainer
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', input.student_id)
      .eq('coach_id', trainerId)
      .single()

    if (!student) throw new Error('Student not found')

    const { data } = await supabaseAdmin
      .from('assigned_programs')
      .insert({
        trainer_id: trainerId,
        student_id: input.student_id,
        name: input.name,
        description: input.description ?? null,
        duration_weeks: input.duration_weeks ?? null,
        status: 'draft',
      })
      .select('id, name, status')
      .single()

    return { program: { ...data, type: 'assigned' }, message: 'Programa criado como rascunho' }
  } else {
    // Criar como template reutilizavel
    const { data } = await supabaseAdmin
      .from('program_templates')
      .insert({
        trainer_id: trainerId,
        name: input.name,
        description: input.description ?? null,
        duration_weeks: input.duration_weeks ?? null,
      })
      .select('id, name')
      .single()

    return { program: { ...data, type: 'template', status: null }, message: 'Template de programa criado' }
  }
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,
}

example: "Cria um programa de 8 semanas de hipertrofia para a Maria, foco em membros inferiores"
example: "Cria um template de programa chamado 'Adaptacao - Iniciante', 4 semanas"
```

---

#### `kinevo_assign_program`

```typescript
name: "kinevo_assign_program"

description: "Assign an existing program template to a student, creating a copy. Or activate a draft assigned program by setting its start date."

inputSchema: z.object({
  program_id: z.string().uuid().describe("The program template ID (to copy) or assigned program ID (to activate)"),
  student_id: z.string().uuid().optional().describe("Required when assigning a template. The student to assign to."),
  start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
  action: z.enum(["assign_template", "activate_draft"]).describe("'assign_template' copies a template to a student, 'activate_draft' activates an existing draft program"),
})

outputSchema: {
  assigned_program: { id: string, name: string, status: string, started_at: string },
  message: string,
}

implementation: `
  if (input.action === 'assign_template') {
    // REUTILIZAR a RPC existente assign_program_to_student (migration 003, atualizada na 012)
    // Essa RPC ja faz: copia template -> workouts -> items (com supersets), snapshots de exercicio,
    // e desativa programas ativos anteriores do aluno.
    //
    // IMPORTANTE: A RPC usa current_trainer_id() internamente para validar ownership,
    // mas como o MCP Server usa admin client (service role), essa validacao nao funciona.
    // Portanto, validar ownership ANTES de chamar a RPC.

    // 1. Validar que template pertence ao trainer
    const { data: template } = await supabaseAdmin
      .from('program_templates')
      .select('id')
      .eq('id', input.program_id)
      .eq('trainer_id', trainerId)
      .single()

    if (!template) throw new Error('Template not found or not owned by trainer')

    // 2. Validar que student pertence ao trainer
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', input.student_id)
      .eq('coach_id', trainerId)
      .single()

    if (!student) throw new Error('Student not found or not owned by trainer')

    // 3. Chamar a RPC (retorna o assigned_program_id)
    const { data: assignedProgramId } = await supabaseAdmin.rpc('assign_program_to_student', {
      p_template_id: input.program_id,
      p_student_id: input.student_id,
      p_start_date: input.start_date ?? new Date().toISOString(),
    })

    // 4. Buscar o programa criado para retornar
    const { data: program } = await supabaseAdmin
      .from('assigned_programs')
      .select('id, name, status, started_at')
      .eq('id', assignedProgramId)
      .single()
  } else {
    // activate_draft: atualizar status de draft para active
    const { data } = await supabaseAdmin
      .from('assigned_programs')
      .update({
        status: 'active',
        started_at: input.start_date ?? new Date().toISOString(),
      })
      .eq('id', input.program_id)
      .eq('trainer_id', trainerId)
      .eq('status', 'draft')
      .select('id, name, status, started_at')
      .single()
  }
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,
}

example: "Atribui o template 'Hipertrofia Fase 1' para a Maria, comecando segunda que vem"
example: "Ativa o programa rascunho da Ana"
```

---

#### `kinevo_expire_program`

```typescript
name: "kinevo_expire_program"

description: "Manually expire/deactivate an active program. The program's data is preserved but it will no longer appear as the student's current program."

inputSchema: z.object({
  program_id: z.string().uuid().describe("The assigned program ID to expire"),
})

outputSchema: {
  program: { id: string, name: string, status: "expired" },
  message: string,
}

implementation: `
  const { data } = await supabaseAdmin
    .from('assigned_programs')
    .update({
      status: 'expired',
      completed_at: new Date().toISOString(),
    })
    .eq('id', input.program_id)
    .eq('trainer_id', trainerId)
    .in('status', ['active', 'scheduled', 'paused'])
    .select('id, name, status')
    .single()
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,  // dados preservados, apenas muda status
}

example: "Expira o programa atual do Carlos"
```

---

### 4.3 Prescricao de Exercicios (`workouts`)

#### `kinevo_list_exercises`

```typescript
name: "kinevo_list_exercises"

description: "Search the exercise catalog. Returns exercises available to this trainer (system exercises + trainer's custom exercises). Filter by muscle group, equipment, or name."

inputSchema: z.object({
  search: z.string().optional().describe("Search by exercise name (partial match)"),
  muscle_group: z.string().optional().describe("Filter by muscle group name (e.g., 'Peitoral', 'Quadriceps', 'Biceps')"),
  equipment: z.string().optional().describe("Filter by equipment (e.g., 'Barra', 'Halter', 'Maquina', 'Cabo')"),
  limit: z.number().min(1).max(100).default(30),
  offset: z.number().min(0).default(0),
})

outputSchema: {
  exercises: [{
    id: string,
    name: string,
    equipment: string | null,
    muscle_groups: string[],
    difficulty_level: string,
    movement_pattern: string | null,
    is_custom: boolean,  // true se owner_id = trainerId
  }],
  total: number,
}

implementation: `
  let query = supabaseAdmin
    .from('exercises')
    .select('id, name, equipment, difficulty_level, movement_pattern, owner_id, exercise_muscle_groups(muscle_groups(name))', { count: 'exact' })
    .eq('is_archived', false)
    // Exercicios do sistema (owner_id IS NULL) + do trainer
    .or('owner_id.is.null,owner_id.eq.' + trainerId)

  if (input.search) {
    query = query.ilike('name', '%' + input.search + '%')
  }
  if (input.equipment) {
    query = query.ilike('equipment', '%' + input.equipment + '%')
  }

  // Filtro por muscle_group requer join
  // Se input.muscle_group, fazer query separada para buscar exercise_ids
  // e filtrar com .in('id', exerciseIds)

  query = query
    .order('name')
    .range(input.offset, input.offset + input.limit - 1)
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Quais exercicios de peitoral tem no catalogo?"
example: "Busca exercicios com halter para biceps"
```

---

#### `kinevo_add_workout_session`

```typescript
name: "kinevo_add_workout_session"

description: "Add a new workout session (e.g., 'Treino A - Peito e Triceps') to an existing program. Works for both templates and assigned programs."

inputSchema: z.object({
  program_id: z.string().uuid().describe("The program ID to add the session to"),
  program_type: z.enum(["template", "assigned"]).default("assigned").describe("Whether the program is a template or assigned"),
  name: z.string().describe("Session name (e.g., 'Treino A - Peito e Triceps', 'Treino B - Costas e Biceps')"),
  order_index: z.number().min(0).optional().describe("Position in the program. If omitted, appends at the end."),
})

outputSchema: {
  workout: { id: string, name: string, order_index: number },
  message: string,
}

implementation: `
  const table = input.program_type === 'template' ? 'workout_templates' : 'assigned_workouts'
  const fkColumn = input.program_type === 'template' ? 'program_template_id' : 'assigned_program_id'

  // Se order_index nao fornecido, buscar o max atual + 1
  if (input.order_index === undefined) {
    const { data: existing } = await supabaseAdmin
      .from(table)
      .select('order_index')
      .eq(fkColumn, input.program_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single()

    input.order_index = existing ? existing.order_index + 1 : 0
  }

  // Verificar que o programa pertence ao trainer
  // (via trainer_id no assigned_programs ou program_templates)

  const { data } = await supabaseAdmin
    .from(table)
    .insert({
      [fkColumn]: input.program_id,
      name: input.name,
      order_index: input.order_index,
    })
    .select('id, name, order_index')
    .single()
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,
}

example: "Adiciona o Treino C - Ombros e Trapezio no programa da Maria"
```

---

#### `kinevo_add_exercise_to_session`

```typescript
name: "kinevo_add_exercise_to_session"

description: "Add an exercise to a workout session with sets, reps, load, and rest configuration. Can add exercises to both template and assigned workout sessions."

inputSchema: z.object({
  workout_id: z.string().uuid().describe("The workout session ID to add the exercise to"),
  workout_type: z.enum(["template", "assigned"]).default("assigned"),
  exercise_id: z.string().uuid().describe("The exercise ID from the catalog"),
  sets: z.number().min(1).max(20).describe("Number of sets"),
  reps: z.string().describe("Reps prescription (e.g., '12', '8-12', '10/10/8/6', 'AMRAP')"),
  rest_seconds: z.number().min(0).max(600).optional().default(90).describe("Rest between sets in seconds"),
  notes: z.string().optional().describe("Special instructions (e.g., 'Controlar a excentrica', 'Pausa de 2s no ponto inferior', 'Carga inicial: 80kg')"),
  exercise_function: z.enum(["warmup", "activation", "main", "accessory", "conditioning"]).optional().default("main").describe("The role of this exercise in the session"),
  order_index: z.number().min(0).optional().describe("Position in the session. If omitted, appends at the end."),
  method_key: z.string().optional().describe("Training method (e.g., 'drop_set', 'rest_pause', 'cluster'). Use kinevo_list_exercises to see available methods."),
})

outputSchema: {
  workout_item: {
    id: string,
    exercise_name: string,
    sets: number,
    reps: string,
    rest_seconds: number,
    order_index: number,
  },
  message: string,
}

implementation: `
  const itemTable = input.workout_type === 'template' ? 'workout_item_templates' : 'assigned_workout_items'
  const fkColumn = input.workout_type === 'template' ? 'workout_template_id' : 'assigned_workout_id'

  // Verificar que o workout pertence a um programa do trainer
  // (join com assigned_programs ou program_templates para checar trainer_id)

  // Buscar exercise name para snapshot (assigned_workout_items tem exercise_name)
  const { data: exercise } = await supabaseAdmin
    .from('exercises')
    .select('id, name, equipment')
    .eq('id', input.exercise_id)
    .single()

  // Calcular order_index se nao fornecido
  if (input.order_index === undefined) {
    const { data: existing } = await supabaseAdmin
      .from(itemTable)
      .select('order_index')
      .eq(fkColumn, input.workout_id)
      .is('parent_item_id', null)
      .order('order_index', { ascending: false })
      .limit(1)
      .single()

    input.order_index = existing ? existing.order_index + 1 : 0
  }

  const insertData: Record<string, unknown> = {
    [fkColumn]: input.workout_id,
    item_type: 'exercise',
    exercise_id: input.exercise_id,
    sets: input.sets,
    reps: input.reps,
    rest_seconds: input.rest_seconds ?? 90,
    notes: input.notes ?? null,
    exercise_function: input.exercise_function ?? 'main',
    order_index: input.order_index,
    method_key: input.method_key ?? null,
  }

  // Para assigned_workout_items, tambem gravar snapshots
  if (input.workout_type === 'assigned') {
    insertData.exercise_name = exercise.name
    insertData.exercise_equipment = exercise.equipment
  }

  const { data } = await supabaseAdmin
    .from(itemTable)
    .insert(insertData)
    .select('id, order_index, sets, reps, rest_seconds')
    .single()

  // NOTA: Nao existem tabelas workout_item_set_templates nem assigned_workout_item_sets.
  // Sets sao registrados apenas em set_logs durante a execucao do treino pelo aluno.
  // Informacoes de carga devem ser incluidas no campo notes (ex: "Carga inicial: 80kg").
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,
}

example: "Adiciona Leg Press 45 graus na sessao B do programa do Joao, 4x12, carga inicial 80kg (vai no campo notes)"
example: "Adiciona supino reto com barra, 4 series de 8-12, descanso 120s, funcao principal"
```

---

### 4.4 Progresso e Metricas (`progress`)

#### `kinevo_get_student_progress`

```typescript
name: "kinevo_get_student_progress"

description: "Get a student's training progress including workout history, adherence rate, and load progression over time. Can filter by date range and specific exercise for load tracking."

inputSchema: z.object({
  student_id: z.string().uuid().describe("The student's UUID"),
  days: z.number().min(1).max(365).default(30).describe("Number of days to look back"),
  exercise_id: z.string().uuid().optional().describe("If provided, returns load progression for this specific exercise"),
})

outputSchema: {
  student_name: string,
  period: { from: string, to: string },
  summary: {
    total_sessions: number,
    total_duration_minutes: number,
    avg_session_duration_minutes: number,
    adherence_rate_pct: number | null,
    avg_rpe: number | null,
  },
  sessions: [{
    id: string,
    workout_name: string,
    completed_at: string,
    duration_seconds: number,
    rpe: number | null,
    total_sets: number,
    total_volume_kg: number,
  }],
  // Se exercise_id fornecido:
  exercise_progression: [{
    date: string,
    exercise_name: string,
    sets: [{ set_number: number, weight: number, reps: number }],
    estimated_1rm: number | null,
  }] | null,
}

implementation: `
  const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString()

  // Verificar aluno pertence ao trainer
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name')
    .eq('id', input.student_id)
    .eq('coach_id', trainerId)
    .single()

  // Sessoes completadas no periodo
  const { data: sessions } = await supabaseAdmin
    .from('workout_sessions')
    .select('id, assigned_workout_id, completed_at, duration_seconds, rpe, assigned_workouts(name)')
    .eq('student_id', input.student_id)
    .eq('trainer_id', trainerId)
    .eq('status', 'completed')
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })

  // Set logs para volume total por sessao
  const sessionIds = sessions.map(s => s.id)
  const { data: setLogs } = await supabaseAdmin
    .from('set_logs')
    .select('workout_session_id, weight, reps_completed, is_completed')
    .in('workout_session_id', sessionIds)
    .eq('is_completed', true)

  // Se exercise_id fornecido, buscar progressao de carga
  if (input.exercise_id) {
    const { data: exerciseLogs } = await supabaseAdmin
      .from('set_logs')
      .select('workout_session_id, set_number, weight, reps_completed, completed_at, workout_sessions(completed_at)')
      .in('workout_session_id', sessionIds)
      .or('exercise_id.eq.' + input.exercise_id + ',executed_exercise_id.eq.' + input.exercise_id)
      .eq('is_completed', true)
      .order('completed_at', { ascending: true })
  }

  // Aderencia: sessoes completadas / sessoes esperadas (baseado em frequencia semanal do programa)
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Qual o progresso da Maria nos ultimos 30 dias?"
example: "Historico de carga no agachamento do Carlos nos ultimos 3 meses"
example: "Qual a aderencia do Joao essa semana?"
```

---

#### `kinevo_get_form_responses`

```typescript
name: "kinevo_get_form_responses"

description: "Get form/check-in responses submitted by a student. Includes pre/post-workout check-ins, anamneses, and surveys."

inputSchema: z.object({
  student_id: z.string().uuid().describe("The student's UUID"),
  category: z.enum(["anamnese", "checkin", "survey", "assessment", "feedback"]).optional().describe("Filter by form category"),
  trigger_context: z.enum(["manual", "pre_workout", "post_workout", "recurring"]).optional().describe("Filter by how the form was triggered"),
  limit: z.number().min(1).max(50).default(20),
})

outputSchema: {
  responses: [{
    id: string,
    form_title: string,
    category: string,
    trigger_context: string,
    status: string,
    answers: object,       // schema depends on form template
    submitted_at: string | null,
    trainer_feedback: object | null,
  }],
  total: number,
}

implementation: `
  const { data, count } = await supabaseAdmin
    .from('form_submissions')
    .select(\`
      id, status, answers_json, submitted_at, trainer_feedback, trigger_context,
      form_templates(title, category)
    \`, { count: 'exact' })
    .eq('student_id', input.student_id)
    .eq('trainer_id', trainerId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(input.limit)

  if (input.category) {
    // Filtrar pelo category do form_template (pode exigir inner join ou filtro pos-query)
  }
  if (input.trigger_context) {
    query = query.eq('trigger_context', input.trigger_context)
  }
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Me mostra os check-ins pos-treino da Maria"
example: "Qual foi a ultima anamnese do Carlos?"
```

---

#### `kinevo_get_dashboard_summary`

```typescript
name: "kinevo_get_dashboard_summary"

description: "Get an overview of the trainer's account: total students, active programs, students without programs, students inactive for 7+ days, recent activity, and key metrics."

inputSchema: z.object({})  // sem parametros — sempre do trainer autenticado

outputSchema: {
  summary: {
    students: {
      total: number,
      active: number,
      inactive: number,
      pending: number,
      without_active_program: number,
      inactive_7_days: number,   // sem sessao nos ultimos 7 dias
    },
    programs: {
      active: number,
      draft: number,
      total_created: number,
    },
    sessions: {
      completed_this_week: number,
      completed_this_month: number,
    },
    unread_messages: number,
    pending_form_submissions: number,
  }
}

implementation: `
  // 1. Contagem de alunos por status
  const { data: studentCounts } = await supabaseAdmin
    .from('students')
    .select('status')
    .eq('coach_id', trainerId)

  // 2. Alunos sem programa ativo
  const { data: studentsWithProgram } = await supabaseAdmin
    .from('assigned_programs')
    .select('student_id')
    .eq('trainer_id', trainerId)
    .eq('status', 'active')

  // 3. Alunos sem sessao nos ultimos 7 dias
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activeStudents } = await supabaseAdmin
    .from('workout_sessions')
    .select('student_id')
    .eq('trainer_id', trainerId)
    .gte('completed_at', sevenDaysAgo)

  // 4. Programas ativos e rascunhos
  const { data: programCounts } = await supabaseAdmin
    .from('assigned_programs')
    .select('status')
    .eq('trainer_id', trainerId)

  // 5. Sessoes da semana e mes
  const startOfWeek = ... // calcular inicio da semana
  const startOfMonth = ... // calcular inicio do mes

  const { count: weekSessions } = await supabaseAdmin
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .eq('status', 'completed')
    .gte('completed_at', startOfWeek)

  // 6. Mensagens nao lidas
  const { count: unreadMessages } = await supabaseAdmin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_type', 'student')
    .is('read_at', null)
    // Filtrar por student_id IN (alunos do trainer)
    // Requer subquery ou join

  // 7. Form submissions pendentes de review
  const { count: pendingForms } = await supabaseAdmin
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .eq('status', 'submitted')
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Me da um resumo geral"
example: "Quantos alunos ativos eu tenho?"
example: "Quais alunos estao sem programa?"
```

---

### 4.5 Mensagens (`messages`)

#### `kinevo_list_conversations`

```typescript
name: "kinevo_list_conversations"

description: "List the trainer's conversations with students, ordered by most recent message. Shows unread count for each conversation."

inputSchema: z.object({
  limit: z.number().min(1).max(50).default(20),
})

outputSchema: {
  conversations: [{
    student: { id: string, name: string, avatar_url: string | null },
    last_message: {
      content: string | null,
      sender_type: "trainer" | "student",
      created_at: string,
    },
    unread_count: number,
  }],
}

implementation: `
  // Replicar a logica de fallback ja existente em web/src/app/messages/actions.ts
  // (getConversations). NAO existe RPC get_trainer_conversations no banco.

  // 1. Buscar todos os alunos ativos do trainer
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, avatar_url')
    .eq('coach_id', trainerId)
    .eq('status', 'active')

  const studentIds = students.map(s => s.id)

  // 2. Buscar ultima mensagem de cada conversa
  // (query por student, order by created_at DESC, limit 1 por student)
  const { data: lastMessages } = await supabaseAdmin
    .from('messages')
    .select('student_id, content, sender_type, created_at')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })

  // Agrupar por student_id (pegar apenas a primeira de cada)
  // Em TypeScript: Map<student_id, message>

  // 3. Contar nao lidas por aluno
  // Indice idx_messages_unread (partial WHERE read_at IS NULL) cobre essa query
  const { data: unreadCounts } = await supabaseAdmin
    .from('messages')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('sender_type', 'student')
    .is('read_at', null)

  // Agrupar e contar por student_id

  // 4. Ordenar: conversas com mensagens (mais recente primeiro), depois sem mensagens (alfabetico)
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Quais conversas tenho pendentes?"
example: "Quem me mandou mensagem?"
```

---

#### `kinevo_get_conversation`

```typescript
name: "kinevo_get_conversation"

description: "Get messages from a conversation with a specific student, ordered by most recent first."

inputSchema: z.object({
  student_id: z.string().uuid().describe("The student's UUID"),
  limit: z.number().min(1).max(100).default(30),
  before: z.string().datetime().optional().describe("Fetch messages before this timestamp (for pagination)"),
})

outputSchema: {
  student: { id: string, name: string },
  messages: [{
    id: string,
    sender_type: "trainer" | "student",
    content: string | null,
    image_url: string | null,
    created_at: string,
    read_at: string | null,
  }],
}

implementation: `
  // Verificar que o aluno pertence ao trainer
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name')
    .eq('id', input.student_id)
    .eq('coach_id', trainerId)
    .single()

  let query = supabaseAdmin
    .from('messages')
    .select('id, sender_type, content, image_url, created_at, read_at')
    .eq('student_id', input.student_id)
    .order('created_at', { ascending: false })
    .limit(input.limit)

  if (input.before) {
    query = query.lt('created_at', input.before)
  }

  // Marcar mensagens do aluno como lidas (fire-and-forget)
  supabaseAdmin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('student_id', input.student_id)
    .eq('sender_type', 'student')
    .is('read_at', null)
    .then()
`

annotations: {
  readOnlyHint: true,  // leitura principal, side-effect de marcar como lido
  destructiveHint: false,
}

example: "Me mostra as mensagens com a Maria"
```

---

#### `kinevo_send_message`

```typescript
name: "kinevo_send_message"

description: "Send a text message to a student. The message appears in the student's Kinevo app inbox."

inputSchema: z.object({
  student_id: z.string().uuid().describe("The student's UUID"),
  content: z.string().min(1).max(2000).describe("Message text content"),
})

outputSchema: {
  message: { id: string, content: string, created_at: string },
  status: "sent",
}

implementation: `
  // 1. Verificar que o aluno pertence ao trainer
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, auth_user_id')
    .eq('id', input.student_id)
    .eq('coach_id', trainerId)
    .single()

  if (!student) throw new Error('Student not found')

  // 2. Buscar auth_user_id do trainer
  const { data: trainer } = await supabaseAdmin
    .from('trainers')
    .select('auth_user_id')
    .eq('id', trainerId)
    .single()

  // 3. Inserir mensagem
  const { data: msg } = await supabaseAdmin
    .from('messages')
    .insert({
      student_id: input.student_id,
      sender_type: 'trainer',
      sender_id: trainer.auth_user_id,
      content: input.content,
    })
    .select('id, content, created_at')
    .single()

  // 4. Criar inbox item para o aluno (aparece no app mobile)
  // Reutilizar insertStudentNotification de src/lib/student-notifications.ts
  import { insertStudentNotification } from '@/lib/student-notifications'
  import { sendStudentPush } from '@/lib/push-notifications'

  const trainerName = (await supabaseAdmin
    .from('trainers')
    .select('name')
    .eq('id', trainerId)
    .single()).data?.name ?? 'Seu treinador'

  const preview = input.content.length > 100
    ? input.content.slice(0, 100) + '...'
    : input.content

  const inboxItemId = await insertStudentNotification({
    studentId: input.student_id,
    trainerId,
    type: 'text_message',
    title: 'Nova mensagem de ' + trainerName,
    subtitle: preview,
    payload: { trainer_id: trainerId, trainer_name: trainerName },
  })

  // 5. Enviar push notification (fire-and-forget)
  sendStudentPush({
    studentId: input.student_id,
    title: 'Nova mensagem de ' + trainerName,
    body: preview,
    inboxItemId: inboxItemId ?? undefined,
    data: { type: 'text_message', trainer_id: trainerId, trainer_name: trainerName },
  }).catch(() => {}) // nao bloqueia, nao falha
`

annotations: {
  readOnlyHint: false,
  destructiveHint: false,
}

example: "Manda pro Carlos: Opa Carlos, parabens pelo treino de ontem! Continua assim."
example: "Envia uma mensagem motivacional pra Maria"
```

---

### 4.6 Financeiro (`billing`) - Somente Leitura

#### `kinevo_list_subscriptions`

```typescript
name: "kinevo_list_subscriptions"

description: "List student contracts/subscriptions managed by this trainer. Shows payment status, plan, amount, and next billing date."

inputSchema: z.object({
  status: z.string().optional().describe("Filter by contract status (e.g., 'active', 'past_due', 'canceled', 'pending')"),
  limit: z.number().min(1).max(50).default(30),
})

outputSchema: {
  subscriptions: [{
    id: string,
    student: { id: string, name: string },
    plan: { title: string, price: number } | null,
    amount: number,
    status: string,
    billing_type: string,
    provider: string,
    current_period_end: string | null,
    cancel_at_period_end: boolean,
    start_date: string | null,
    created_at: string,
  }],
  total: number,
}

implementation: `
  let query = supabaseAdmin
    .from('student_contracts')
    .select(\`
      id, amount, status, billing_type, provider, current_period_end,
      cancel_at_period_end, start_date, created_at,
      students(id, name),
      trainer_plans(title, price)
    \`, { count: 'exact' })
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })
    .limit(input.limit)

  if (input.status) {
    query = query.eq('status', input.status)
  }
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Lista as assinaturas ativas dos meus alunos"
example: "Quais alunos estao com pagamento atrasado?"
```

---

#### `kinevo_get_revenue_summary`

```typescript
name: "kinevo_get_revenue_summary"

description: "Get a financial summary: MRR (Monthly Recurring Revenue), new contracts this month, cancellations, and payment status overview."

inputSchema: z.object({
  month: z.string().optional().describe("Month in YYYY-MM format. Defaults to current month."),
})

outputSchema: {
  period: string,  // YYYY-MM
  revenue: {
    mrr: number,                    // soma de amount dos contratos ativos
    total_active_contracts: number,
    new_contracts_this_month: number,
    cancellations_this_month: number,
    past_due_contracts: number,
  },
  events: [{
    event_type: string,
    student_name: string,
    date: string,
    metadata: object,
  }],
}

implementation: `
  const targetMonth = input.month ?? new Date().toISOString().slice(0, 7) // YYYY-MM
  const monthStart = targetMonth + '-01T00:00:00Z'
  const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 1).toISOString()

  // 1. MRR: soma de amount dos contratos com status ativo
  const { data: activeContracts } = await supabaseAdmin
    .from('student_contracts')
    .select('amount, status')
    .eq('trainer_id', trainerId)
    .eq('status', 'active')

  const mrr = activeContracts?.reduce((sum, c) => sum + Number(c.amount), 0) ?? 0

  // 2. Novos contratos no mes
  const { count: newContracts } = await supabaseAdmin
    .from('student_contracts')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)

  // 3. Cancelamentos no mes
  const { count: cancellations } = await supabaseAdmin
    .from('student_contracts')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .eq('status', 'canceled')
    .gte('canceled_at', monthStart)
    .lt('canceled_at', monthEnd)

  // 4. Inadimplentes
  const { count: pastDue } = await supabaseAdmin
    .from('student_contracts')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
    .eq('status', 'past_due')

  // 5. Eventos financeiros do mes
  const { data: events } = await supabaseAdmin
    .from('contract_events')
    .select('event_type, metadata, created_at, students(name)')
    .eq('trainer_id', trainerId)
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)
    .order('created_at', { ascending: false })
    .limit(30)
`

annotations: {
  readOnlyHint: true,
  destructiveHint: false,
}

example: "Qual meu MRR atual?"
example: "Resumo financeiro do mes"
example: "Quantos alunos cancelaram em abril?"
```

---

## 5. Fluxo de Autenticacao Completo

### Diagrama do Fluxo

```
  Trainer                     Claude.ai                   MCP Server                Supabase
    |                            |                           |                        |
    |  1. Gera API Key           |                           |                        |
    |     na dashboard           |                           |                        |
    |--------------------------->|                           |                        |
    |  (mostra key uma vez)      |                           |                        |
    |                            |                           |                        |
    |  2. Configura em           |                           |                        |
    |     Settings > Connectors  |                           |                        |
    |     URL: www.kinevoapp.com/api/mcp                     |                        |
    |     Auth: Bearer kinevo_trainer_xxx                     |                        |
    |                            |                           |                        |
    |  3. "Lista meus alunos"    |                           |                        |
    |--------------------------->|                           |                        |
    |                            |  4. POST /api/mcp         |                        |
    |                            |  Authorization: Bearer    |                        |
    |                            |  kinevo_trainer_xxx       |                        |
    |                            |-------------------------->|                        |
    |                            |                           |  5. SELECT key_hash    |
    |                            |                           |     FROM trainer_api_  |
    |                            |                           |     keys WHERE prefix  |
    |                            |                           |     AND revoked IS NULL|
    |                            |                           |----------------------->|
    |                            |                           |  6. bcrypt.compare()   |
    |                            |                           |     -> trainer_id      |
    |                            |                           |                        |
    |                            |                           |  7. SELECT students    |
    |                            |                           |     WHERE coach_id =   |
    |                            |                           |     trainer_id         |
    |                            |                           |----------------------->|
    |                            |                           |                        |
    |                            |  8. JSON-RPC response     |                        |
    |                            |<--------------------------|                        |
    |  9. Resposta formatada     |                           |                        |
    |<---------------------------|                           |                        |
```

### Middleware de Validacao

```typescript
// src/lib/mcp/auth.ts

export async function authenticateRequest(
  request: Request
): Promise<{ trainerId: string; keyId: string }> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Missing or invalid Authorization header. Expected: Bearer kinevo_trainer_<key>'
    )
  }

  const token = authHeader.slice(7) // Remove "Bearer "

  if (!token.startsWith('kinevo_trainer_')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Invalid API key format. Keys start with kinevo_trainer_'
    )
  }

  const result = await validateApiKey(token)

  if (!result) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Invalid or revoked API key'
    )
  }

  // Verificar se o trainer tem assinatura ativa (trialing tambem permitido)
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('trainer_id', result.trainerId)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .single()

  if (!subscription) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Sua assinatura Kinevo esta inativa. Renove em kinevoapp.com/settings/billing'
    )
  }

  // Rate limiting: 30 req/min, 1000 req/dia por API Key
  // Reutilizar checkRateLimit de src/lib/rate-limit.ts
  import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

  const rateLimitKey = `mcp:${result.keyId}`
  const limit = checkRateLimit(rateLimitKey, { perMinute: 30, perDay: 1000 })
  if (!limit.allowed) {
    throw new McpError(ErrorCode.InvalidRequest, limit.error ?? 'Rate limit exceeded')
  }
  recordRequest(rateLimitKey)

  return result
}
```

### Tratamento de Erros

| Cenario | HTTP Status | MCP Error Code | Mensagem |
|---|---|---|---|
| Header Authorization ausente | 401 | InvalidRequest | "Missing Authorization header" |
| Key com formato invalido | 401 | InvalidRequest | "Invalid API key format" |
| Key nao encontrada ou revogada | 401 | InvalidRequest | "Invalid or revoked API key" |
| Trainer sem assinatura ativa | 403 | InvalidRequest | "Trainer subscription not active" |
| Tool nao encontrada | 400 | MethodNotFound | "Unknown tool: xxx" |
| Parametros invalidos (Zod) | 400 | InvalidParams | Detalhes da validacao |
| Erro interno (Supabase/etc) | 500 | InternalError | "Internal server error" |

---

## 6. UI na Dashboard do Kinevo

### Localizacao

Nova pagina em: `src/app/settings/api-keys/page.tsx`

Link na pagina de Settings existente, secao **"Conectar com IA"**.
Subtitulo: "Use o Claude.ai ou o ChatGPT para gerenciar alunos e treinos por voz."

### Wireframe da Tela

```
+------------------------------------------------------------------+
|  Configuracoes > Conectar com IA                                  |
+------------------------------------------------------------------+
|                                                                    |
|  Conecte o Kinevo ao Claude.ai ou ChatGPT para gerenciar seus    |
|  alunos e treinos usando linguagem natural.                       |
|                                                                    |
|  [Como conectar no Claude.ai ->]                                  |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Suas API Keys                                                    |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | Minha API Key                                                 | |
|  | Criada em 20/05/2026 . Ultimo uso: ha 2 horas                | |
|  | kinevo_train...                                               | |
|  |                                              [Revogar]        | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  [+ Gerar nova API Key]                                           |
|                                                                    |
+------------------------------------------------------------------+
```

### Fluxo de Geracao

1. Trainer clica "Gerar nova API Key"
2. Modal abre pedindo um nome opcional (default: "Minha API Key")
3. Server Action `generateApiKey` e chamada
4. Modal exibe a key completa com botao de copiar e aviso:
   > **Copie esta chave agora.** Ela nao sera exibida novamente.
5. Trainer copia e fecha o modal
6. Key aparece na lista com apenas o prefixo (`kinevo_train...`)

### Fluxo de Revogacao

1. Trainer clica "Revogar" em uma key
2. Confirmacao: "Tem certeza? Conexoes usando esta key deixarao de funcionar."
3. Server Action `revokeApiKey` seta `revoked_at = now()`
4. Key desaparece da lista (ou aparece riscada)

### Instrucoes de Conexao (Link/Modal)

Conteudo da pagina/modal "Como conectar":

```
1. Copie sua API Key acima
2. Abra o Claude.ai
3. Va em Settings > Connectors > Add Connector
4. Configure:
   - Name: Kinevo
   - URL: https://www.kinevoapp.com/api/mcp
   - Authentication: Bearer Token
   - Token: [cole sua API Key aqui]
5. Pronto! Agora voce pode pedir ao Claude para gerenciar seus alunos e treinos.

Exemplos do que voce pode fazer:
- "Lista meus alunos ativos"
- "Cria um programa de hipertrofia para a Maria"
- "Quais alunos nao treinaram essa semana?"
- "Manda uma mensagem pro Carlos"
```

### Componentes Necessarios

| Componente | Tipo | Arquivo |
|---|---|---|
| `ApiKeysPage` | Server Component | `src/app/settings/api-keys/page.tsx` |
| `ApiKeysList` | Client Component | `src/components/settings/api-keys-list.tsx` |
| `GenerateApiKeyModal` | Client Component | `src/components/settings/generate-api-key-modal.tsx` |
| `RevokeApiKeyDialog` | Client Component | `src/components/settings/revoke-api-key-dialog.tsx` |
| `ConnectionInstructions` | Client Component | `src/components/settings/connection-instructions.tsx` |

### Server Actions

| Action | Arquivo |
|---|---|
| `generateApiKey` | `src/actions/api-keys/generate-api-key.ts` |
| `listApiKeys` | `src/actions/api-keys/list-api-keys.ts` |
| `revokeApiKey` | `src/actions/api-keys/revoke-api-key.ts` |

---

## 7. Plano de Implementacao

### Fase 1 — Infraestrutura Base

**Escopo:**
- Migration SQL para `trainer_api_keys` e `mcp_tool_usage_logs`
- `src/lib/mcp/auth.ts` — validacao de API Key + rate limiting
- `src/app/api/mcp/route.ts` — scaffold do MCP Server com `@modelcontextprotocol/sdk`
- Instalar dependencia: `@modelcontextprotocol/sdk`, `bcryptjs`
- Tool de health check (`kinevo_ping`) para testar a conexao
- Logging de uso das tools (fire-and-forget)

**Arquivos:**
- `supabase/migrations/xxx_create_trainer_api_keys.sql`
- `supabase/migrations/xxx_create_mcp_tool_usage_logs.sql`
- `src/lib/mcp/auth.ts`
- `src/lib/mcp/server.ts` (configuracao do McpServer)
- `src/lib/mcp/types.ts` (tipos compartilhados)
- `src/lib/mcp/logger.ts` (fire-and-forget logging para mcp_tool_usage_logs)
- `src/app/api/mcp/route.ts`

---

### Fase 2 — Tools de Leitura

**Escopo:**
- `kinevo_list_students`
- `kinevo_get_student`
- `kinevo_list_programs`
- `kinevo_get_program`
- `kinevo_list_exercises`
- `kinevo_get_student_progress`
- `kinevo_get_form_responses`
- `kinevo_get_dashboard_summary`

**Arquivos:**
- `src/lib/mcp/tools/students.ts`
- `src/lib/mcp/tools/programs.ts`
- `src/lib/mcp/tools/exercises.ts`
- `src/lib/mcp/tools/progress.ts`
- `src/lib/mcp/tools/dashboard.ts`

---

### Fase 3 — Tools de Escrita

**Escopo:**
- `kinevo_create_student`
- `kinevo_update_student`
- `kinevo_create_program`
- `kinevo_assign_program`
- `kinevo_expire_program`
- `kinevo_add_workout_session`
- `kinevo_add_exercise_to_session`
- `kinevo_send_message`

**Arquivos:**
- `src/lib/mcp/tools/students-write.ts`
- `src/lib/mcp/tools/programs-write.ts`
- `src/lib/mcp/tools/workouts-write.ts`
- `src/lib/mcp/tools/messages.ts`

---

### Fase 4 — Tools Financeiras (Somente Leitura)

**Escopo:**
- `kinevo_list_subscriptions`
- `kinevo_get_revenue_summary`
- `kinevo_list_conversations`
- `kinevo_get_conversation`

**Arquivos:**
- `src/lib/mcp/tools/billing.ts`
- `src/lib/mcp/tools/conversations.ts`

---

### Fase 5 — UI de Gestao de API Keys + Banner

**Escopo:**
- Server Actions de API Keys (generate, list, revoke)
- Pagina `settings/api-keys` (secao "Conectar com IA")
- Componentes: lista, modal de geracao, dialog de revogacao
- Instrucoes de conexao
- Banner dismissivel no dashboard ("Novidade: gerencie seus alunos direto do Claude.ai")

**Arquivos:**
- `src/actions/api-keys/generate-api-key.ts`
- `src/actions/api-keys/list-api-keys.ts`
- `src/actions/api-keys/revoke-api-key.ts`
- `src/app/settings/api-keys/page.tsx`
- `src/components/settings/api-keys-list.tsx`
- `src/components/settings/generate-api-key-modal.tsx`
- `src/components/settings/revoke-api-key-dialog.tsx`
- `src/components/settings/connection-instructions.tsx`

---

### Fase 6 — Documentacao e Publicacao

**Escopo:**
- README do MCP Server com exemplos
- Submissao para o diretorio MCP da Anthropic
- Adicionar link na landing page do Kinevo
- Artigo/post sobre a integracao

---

## 8. Prompt de Sistema Recomendado

O trainer pode configurar o seguinte system prompt no Claude.ai para contextualizar o uso:

```
Voce e um assistente especializado para personal trainers usando a plataforma Kinevo.

Voce tem acesso as ferramentas do Kinevo para:
- Gerenciar alunos (cadastro, perfil, condicoes clinicas)
- Criar e prescrever programas de treino
- Acompanhar progresso e metricas dos alunos
- Enviar mensagens para alunos
- Consultar dados financeiros (assinaturas, receita)

Regras:
- Sempre confirme acoes de escrita antes de executar (criar aluno, criar programa, enviar mensagem)
- Ao criar programas de treino, considere restricoes clinicas do aluno
- Ao prescrever exercicios, use nomenclatura padrao e especifique series, repeticoes e carga
- Para consultas financeiras, apresente valores em BRL
- Responda sempre em portugues brasileiro
- Seja conciso e direto nas respostas
- Quando listar dados, use tabelas formatadas para melhor legibilidade
```

---

## 9. Casos de Uso Detalhados

### Caso 1: "Cria um programa de 8 semanas de hipertrofia para a Maria, foco em membros inferiores, ela tem problema no joelho esquerdo"

**Fluxo de tools:**

```
1. kinevo_list_students({ search: "Maria" })
   -> Encontra Maria, obtem student_id

2. kinevo_get_student({ student_id })
   -> Verifica perfil, restricoes clinicas existentes
   -> Nota: precisa atualizar restricao de joelho se nao existir

3. kinevo_create_program({
     name: "Hipertrofia - Membros Inferiores - Fase 1",
     description: "Programa de 8 semanas focado em hipertrofia de membros inferiores. Adaptado para restricao no joelho esquerdo.",
     duration_weeks: 8,
     student_id: maria_id,
   })
   -> Cria programa como rascunho, obtem program_id

4. kinevo_add_workout_session({
     program_id,
     program_type: "assigned",
     name: "Treino A - Quadriceps e Gluteos",
   })
   -> Cria sessao A

5. kinevo_list_exercises({ muscle_group: "Quadriceps", equipment: "Maquina" })
   -> Busca exercicios seguros para joelho (maquinas com amplitude controlada)

6. kinevo_add_exercise_to_session({
     workout_id: sessao_a_id,
     exercise_id: leg_press_id,
     sets: 4, reps: "12-15",
     rest_seconds: 90,
     notes: "Carga inicial: 60kg. Amplitude parcial - nao ultrapassar 90 graus de flexao do joelho",
   })
   -> Adiciona Leg Press com restricao de amplitude

7. [Repete passos 6 para cada exercicio: cadeira extensora, cadeira abdutora, hip thrust, etc.]

8. kinevo_add_workout_session({
     program_id,
     name: "Treino B - Posteriores e Panturrilha",
   })

9. [Adiciona exercicios do Treino B: stiff, mesa flexora, panturrilha, etc.]

10. kinevo_assign_program({
      program_id,
      action: "activate_draft",
      start_date: "2026-05-26",  // proxima segunda
    })
    -> Ativa o programa
```

**LLM apresenta ao trainer:** Resumo do programa criado com todos os treinos e exercicios, pede confirmacao antes de ativar.

---

### Caso 2: "Quais alunos nao registraram treino nos ultimos 7 dias? Manda uma mensagem motivacional para cada um"

**Fluxo de tools:**

```
1. kinevo_get_dashboard_summary({})
   -> Obtem lista de alunos inativos ha 7+ dias

2. kinevo_list_students({ status: "active" })
   -> Lista todos os alunos ativos

3. kinevo_get_student_progress({ student_id: aluno_1, days: 7 })
   -> Verifica se tem sessoes (0 sessoes = inativo)
   [Repete para cada aluno]

   Resultado: Maria, Carlos e Pedro nao treinaram

4. LLM gera mensagem personalizada para cada um e pede confirmacao ao trainer

5. kinevo_send_message({
     student_id: maria_id,
     content: "Oi Maria! Senti sua falta essa semana. Lembra que consistencia e a chave! Quando puder, faz pelo menos o Treino A que ja e um otimo comeco. Qualquer duvida, me chama!",
   })

6. kinevo_send_message({
     student_id: carlos_id,
     content: "E ai Carlos! Vi que essa semana ficou sem treinar. Ta tudo bem? Se precisar adaptar algo no programa, me avisa. Vamos manter o ritmo!",
   })

7. kinevo_send_message({
     student_id: pedro_id,
     content: "Fala Pedro! Essa semana passou em branco, hein? Bora retomar! Seu progresso ta otimo, nao deixa esfriar. Me chama se precisar de algo!",
   })
```

---

### Caso 3: "Me da um resumo do meu mes: alunos ativos, receita, alunos que cancelaram"

**Fluxo de tools:**

```
1. kinevo_get_dashboard_summary({})
   -> Alunos ativos, inativos, sem programa, etc.

2. kinevo_get_revenue_summary({ month: "2026-05" })
   -> MRR, novos contratos, cancelamentos, inadimplencia

3. LLM formata resposta:
   "Resumo de Maio/2026:
    - 28 alunos ativos, 3 inativos
    - 25 com programa ativo, 3 sem programa
    - MRR: R$ 8.450,00
    - 2 novos contratos no mes
    - 1 cancelamento (Maria Silva - 15/05)
    - 0 inadimplentes
    - 142 sessoes de treino completadas"
```

---

### Caso 4: "Qual o historico de carga no agachamento do Carlos nos ultimos 3 meses?"

**Fluxo de tools:**

```
1. kinevo_list_students({ search: "Carlos" })
   -> Obtem student_id

2. kinevo_list_exercises({ search: "Agachamento" })
   -> Encontra exercise_id do "Agachamento Livre" (ou variacao relevante)

3. kinevo_get_student_progress({
     student_id: carlos_id,
     days: 90,
     exercise_id: agachamento_id,
   })
   -> Retorna exercise_progression com historico de cargas

4. LLM formata resposta com tabela:
   "Progressao de Carga - Agachamento Livre (Carlos, ultimos 3 meses):

    Data       | Carga  | Reps      | 1RM Est.
    05/03/2026 | 80kg   | 10/10/8   | ~107kg
    12/03/2026 | 82.5kg | 10/10/9   | ~110kg
    19/03/2026 | 85kg   | 10/10/8   | ~113kg
    ...
    15/05/2026 | 95kg   | 10/10/10  | ~127kg

    Evolucao: +15kg de carga (+18.75%), 1RM estimado subiu ~20kg"
```

---

### Caso 5: "Adiciona o exercicio Leg Press 45 graus na sessao B do programa do Joao, 4x12, carga inicial 80kg"

**Fluxo de tools:**

```
1. kinevo_list_students({ search: "Joao" })
   -> Obtem student_id

2. kinevo_list_programs({ student_id: joao_id, status: "active" })
   -> Obtem o programa ativo do Joao (program_id)

3. kinevo_get_program({ program_id, type: "assigned" })
   -> Ve os workouts do programa
   -> Identifica "Sessao B" (ou "Treino B") e obtem workout_id

4. kinevo_list_exercises({ search: "Leg Press 45" })
   -> Encontra o exercise_id

5. kinevo_add_exercise_to_session({
     workout_id: sessao_b_id,
     workout_type: "assigned",
     exercise_id: leg_press_45_id,
     sets: 4,
     reps: "12",
     rest_seconds: 90,
     exercise_function: "main",
     notes: "Carga inicial: 80kg",
   })
   -> Adiciona o exercicio

6. LLM confirma:
   "Pronto! Adicionei o Leg Press 45 graus na Sessao B do programa do Joao:
    - 4 series de 12 repeticoes
    - Carga inicial: 80kg
    - Descanso: 90s
    - Posicao: ultimo exercicio da sessao"
```

---

## 10. Scaffold do Route Handler

```typescript
// src/app/api/mcp/route.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { authenticateRequest } from '@/lib/mcp/auth'
import { registerAllTools } from '@/lib/mcp/tools'

export async function POST(request: Request) {
  try {
    // 1. Autenticar
    const { trainerId } = await authenticateRequest(request)

    // 2. Criar server MCP com contexto do trainer
    const server = new McpServer({
      name: 'kinevo',
      version: '1.0.0',
    })

    // 3. Registrar todas as tools com o trainerId no closure
    registerAllTools(server, trainerId)

    // 4. Criar transporte stateless
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — sem sessoes
    })

    // 5. Conectar e processar
    await server.connect(transport)
    const response = await transport.handleRequest(request)

    return response
  } catch (error) {
    // Erros de auth retornam JSON-RPC error
    if (error instanceof McpError) {
      return Response.json(
        { jsonrpc: '2.0', error: { code: error.code, message: error.message }, id: null },
        { status: 401 }
      )
    }

    return Response.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null },
      { status: 500 }
    )
  }
}

// Aceitar GET para server info (opcional, requerido por alguns clients)
export async function GET() {
  return Response.json({
    name: 'kinevo',
    version: '1.0.0',
    description: 'Kinevo MCP Server — Manage your personal training business with AI',
  })
}
```

```typescript
// src/lib/mcp/tools/index.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerStudentTools } from './students'
import { registerProgramTools } from './programs'
import { registerExerciseTools } from './exercises'
import { registerProgressTools } from './progress'
import { registerDashboardTools } from './dashboard'
import { registerMessageTools } from './messages'
import { registerBillingTools } from './billing'

export function registerAllTools(server: McpServer, trainerId: string) {
  registerStudentTools(server, trainerId)
  registerProgramTools(server, trainerId)
  registerExerciseTools(server, trainerId)
  registerProgressTools(server, trainerId)
  registerDashboardTools(server, trainerId)
  registerMessageTools(server, trainerId)
  registerBillingTools(server, trainerId)
}
```

---

## 11. Configuracao do Middleware Next.js

O middleware existente (`src/middleware.ts`) ja exclui rotas `/api/` de certas verificacoes. Garantir que `/api/mcp` esta na lista de exclusao:

```typescript
// Em src/middleware.ts — adicionar na regex de exclusao se necessario:
// /api/mcp deve ser excluido do middleware de auth session (pois usa API Key propria)
```

A rota `/api/mcp` ja deve estar coberta pela exclusao geral de `/api/` paths no matcher do middleware. Verificar no momento da implementacao.

---

## 12. Dependencias a Instalar

```bash
# No workspace web
cd web
npm install @modelcontextprotocol/sdk bcryptjs
npm install -D @types/bcryptjs
```

---

## 13. Variaveis de Ambiente

Nenhuma variavel de ambiente adicional necessaria. O MCP Server reutiliza:
- `NEXT_PUBLIC_SUPABASE_URL` (ja existente)
- `SUPABASE_SERVICE_ROLE_KEY` (ja existente, usado pelo admin client)

---

## 14. Criterios de Aceite

- [ ] Route handler `/api/mcp` funcional com transporte Streamable HTTP
- [ ] Autenticacao via API Key valida corretamente
- [ ] Todas as 18 tools registradas e funcionais
- [ ] Escopo por trainer: nenhuma tool retorna dados de outro trainer
- [ ] Keys revogadas sao rejeitadas
- [ ] Trainers sem assinatura ativa sao rejeitados (trialing = permitido)
- [ ] Rate limiting: 30 req/min e 1000 req/dia por API Key
- [ ] Max 5 API Keys ativas por trainer
- [ ] UI de gestao de API Keys na dashboard funcional (secao "Conectar com IA")
- [ ] Key exibida apenas uma vez no momento da geracao
- [ ] `kinevo_send_message` cria inbox item + push notification
- [ ] `kinevo_assign_program` (assign_template) usa RPC existente com validacao previa
- [ ] `kinevo_create_student` reutiliza logica de `src/actions/create-student.ts`
- [ ] Logging de uso das tools em `mcp_tool_usage_logs` (fire-and-forget)
- [ ] Zero erros de TypeScript (build limpo)
- [ ] Retrocompativel — nenhuma rota existente afetada
- [ ] Sem novas migrations destrutivas
- [ ] Funciona com Claude.ai Settings > Connectors

---

## 15. Tabela `mcp_tool_usage_logs`

Tabela para rastrear uso das tools (analytics, debugging, otimizacao).

```sql
-- Migration: create_mcp_tool_usage_logs
CREATE TABLE public.mcp_tool_usage_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  api_key_id  uuid NOT NULL REFERENCES public.trainer_api_keys(id) ON DELETE CASCADE,
  tool_name   text NOT NULL,
  duration_ms integer,
  success     boolean NOT NULL DEFAULT true,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_logs_trainer ON public.mcp_tool_usage_logs(trainer_id, created_at DESC);
CREATE INDEX idx_mcp_logs_tool ON public.mcp_tool_usage_logs(tool_name, created_at DESC);

ALTER TABLE public.mcp_tool_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.mcp_tool_usage_logs
  FOR ALL USING (auth.role() = 'service_role');
```

Insert e fire-and-forget no final de cada tool — nao bloqueia a resposta.

---

## 16. Onboarding Banner

Banner dismissivel no dashboard principal na primeira semana apos lancamento:

- **Texto:** "Novidade: gerencie seus alunos direto do Claude.ai →"
- **Link:** Redireciona para `/settings/api-keys`
- **Dismissivel:** Clicar no X grava no `trainers.onboarding_state` (campo JSONB existente)
- **Feature flag:** Campo `show_mcp_banner` em onboarding_state, default `true` para trainers existentes via migration

---

## 17. Decisoes Confirmadas

Todas as perguntas abertas originais foram respondidas. Resumo das decisoes:

### Schema / Banco de Dados

1. **`messages.sender_id`**: Referencia `auth.users(id)`. Usar `trainers.auth_user_id` (NOT NULL) como `sender_id` ao enviar mensagem pelo MCP.
2. **Vinculo trainer-conversa**: Via `students.coach_id`. Indices `idx_messages_student_created` e `idx_messages_unread` (partial) ja cobrem os padroes de query.
3. **RPC `get_trainer_conversations`**: NAO existe. Usar queries manuais (mesmo fallback que `messages/actions.ts` ja usa).
4. **Indice de mensagens nao lidas**: `idx_messages_unread ON messages(student_id, sender_type, read_at) WHERE read_at IS NULL` — partial index otimizado.

### Autenticacao

5. **Limite de API Keys**: Max 5 ativas por trainer (validacao na Server Action `generateApiKey`).
6. **Rate limiting**: `{ perMinute: 30, perDay: 1000 }` por API Key. Key: `mcp:${keyId}`. Reutiliza `checkRateLimit` de `src/lib/rate-limit.ts`.
7. **Trainers em trialing**: Sim, tem acesso. Query: `status IN ('active', 'trialing')`.

### Funcionalidades

8. **`kinevo_create_student`**: Reutilizar `src/actions/create-student.ts`. Status inicial = `'active'` (nao `'pending'`). Nao cria `trainer_student_links`. Push fire-and-forget.
9. **`kinevo_assign_program`**: Reutilizar RPC `assign_program_to_student()` (migrations 003/012). Validar ownership manualmente ANTES de chamar a RPC (admin client bypassa current_trainer_id()).
10. **Inbox ao enviar mensagem**: Sim. Usar `insertStudentNotification()` de `src/lib/student-notifications.ts` + `sendStudentPush()` de `src/lib/push-notifications.ts`.

### Infraestrutura

11. **Stateless**: Confirmado. Sem sessoes necessarias.
12. **Payload**: 4.5MB Vercel limit e suficiente (~50-100KB para programas complexos).
13. **Cold start**: 1-2s aceitavel (LLM ja tem latencia propria de 1-3s).

### UX / Produto

14. **Nome da secao**: "Conectar com IA". Subtitulo: "Use o Claude.ai ou o ChatGPT para gerenciar alunos e treinos por voz."
15. **Banner no dashboard**: Sim, dismissivel, primeira semana. Via `trainers.onboarding_state`.
16. **Metricas**: Tabela `mcp_tool_usage_logs` (trainer_id, tool_name, duration_ms, success). Insert fire-and-forget.

### Correcoes aplicadas nesta revisao

| Item | Correcao |
|---|---|
| `workout_item_set_templates` | Removido — tabela nao existe |
| `assigned_workout_item_sets` | Removido — tabela nao existe |
| `kinevo_add_exercise_to_session` | Removido bloco que criava set rows; peso vai no campo `notes` |
| `kinevo_assign_program` | Substituido por chamada a RPC `assign_program_to_student` com validacao previa de ownership |
| `kinevo_create_student` status | Corrigido de `'pending'` para `'active'` |
| `kinevo_create_student` flow | Removida referencia a `trainer_student_links` (nao e criado) |
| `kinevo_send_message` | Adicionado `insertStudentNotification()` + `sendStudentPush()` |
| `kinevo_list_conversations` | Removida referencia a RPC inexistente; usa queries manuais |
| `kinevo_get_program` query | Removido join com `assigned_workout_item_sets` (nao existe); adicionado `exercise_name`, `exercise_equipment` ao select |
| Auth — rate limiting | Adicionado `checkRateLimit` com `{ perMinute: 30, perDay: 1000 }` |
| Auth — subscription check | Mensagem de erro em portugues; `trialing` explicitamente permitido |
| API Key limit | Adicionado check de max 5 keys ativas por trainer |
| UI — nome da secao | "Conectar com IA" (era "API Keys" / "Integracoes") |
