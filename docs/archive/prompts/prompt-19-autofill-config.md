# Prompt 19 — Auto-preenchimento da Configuração Rápida a partir do Questionário

## Objetivo
Quando o aluno respondeu o Questionário de Prescrição, os campos de "Configuração Rápida" (equipamento, dias disponíveis, duração da sessão) devem ser **auto-preenchidos** com as respostas do questionário, economizando tempo do treinador.

Também preencher nível e objetivo quando for primeira prescrição (sem perfil existente).

---

## Contexto

O `questionnaire-mapper.ts` já extrai:
- `suggested_frequency` → número de dias (2–6)
- `suggested_duration` → duração em minutos (35, 45, 55, 67, 82)
- `suggested_equipment` → string de equipamento (ex: `academia_completa`)
- `suggested_level` → `'beginner' | 'intermediate' | 'advanced'`
- `goal_from_student` → `'hypertrophy' | 'weight_loss' | 'health' | 'performance'`

Esses valores estão em `QuestionnaireData` que já é calculado em `prescribe-client.tsx` (linhas 76-82).

---

## Alterações

### Arquivo 1: `web/src/app/students/[id]/prescribe/prescribe-client.tsx`

**Passo 1** — Passar `questionnaireData` para o `PrescriptionProfileForm`.

Na linha 275 onde o `<PrescriptionProfileForm` é renderizado, adicionar a prop `questionnaireData`:

```tsx
<PrescriptionProfileForm
    studentId={student.id}
    existingProfile={profile}
    questionnaireData={questionnaireData}   // ← ADICIONAR
    onSaved={handleProfileSaved}
    recentSessions={prescriptionData.recentSessions}
    activeProgram={prescriptionData.activeProgram}
    previousProgramCount={prescriptionData.previousProgramCount}
    lastFormSubmissionDate={prescriptionData.lastFormSubmissionDate}
    onGenerate={handleGenerate}
    compactMode={selectedFormIds.length > 0}
/>
```

---

### Arquivo 2: `web/src/components/prescription/prescription-profile-form.tsx`

**Passo 2** — Importar o tipo `QuestionnaireData`.

No topo do arquivo, adicionar ao import:

```tsx
import type { QuestionnaireData } from '@/lib/prescription/questionnaire-mapper'
```

**Passo 3** — Adicionar a prop na interface `PrescriptionProfileFormProps`.

Adicionar após `compactMode?: boolean`:

```tsx
questionnaireData?: QuestionnaireData | null
```

**Passo 4** — Receber a prop no destructuring do componente.

Na linha ~92-102, adicionar `questionnaireData = null` no destructuring:

```tsx
export function PrescriptionProfileForm({
    studentId,
    existingProfile,
    questionnaireData = null,  // ← ADICIONAR
    onSaved,
    recentSessions,
    activeProgram,
    previousProgramCount,
    lastFormSubmissionDate,
    onGenerate,
    compactMode = false,
}: PrescriptionProfileFormProps) {
```

**Passo 5** — Criar uma função helper para distribuir N dias na semana.

Adicionar antes do componente (na seção de Helpers, após `formatDate`):

```tsx
/**
 * Distributes N training days evenly across the week (Mon-Sat preferred).
 * Returns sorted array of day indices (0=Sun, 1=Mon, ..., 6=Sat).
 */
function distributeTrainingDays(frequency: number): number[] {
    const COMMON_DISTRIBUTIONS: Record<number, number[]> = {
        2: [1, 4],           // Seg, Qui
        3: [1, 3, 5],       // Seg, Qua, Sex
        4: [1, 2, 4, 5],    // Seg, Ter, Qui, Sex
        5: [1, 2, 3, 4, 5], // Seg a Sex
        6: [1, 2, 3, 4, 5, 6], // Seg a Sáb
    }
    return COMMON_DISTRIBUTIONS[frequency] || [1, 3, 5] // fallback: 3x
}
```

**Passo 6** — Modificar a inicialização dos estados para usar dados do questionário como fallback.

Substituir as linhas de inicialização de estado (~107-117) por lógica que prioriza:
1. `existingProfile` (se existir e tiver valores configurados)
2. `questionnaireData` (se existir)
3. Valores padrão

```tsx
// ── State (questionnaire values used as smart defaults) ──
const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>(
    existingProfile?.training_level
    || questionnaireData?.suggested_level
    || 'beginner'
)
const [goal, setGoal] = useState<PrescriptionGoal>(
    existingProfile?.goal
    || (questionnaireData?.goal_from_student as PrescriptionGoal | undefined)
    || 'hypertrophy'
)
const [availableDays, setAvailableDays] = useState<number[]>(() => {
    if (existingProfile?.available_days && existingProfile.available_days.length > 0) {
        return existingProfile.available_days
    }
    if (questionnaireData?.suggested_frequency) {
        return distributeTrainingDays(questionnaireData.suggested_frequency)
    }
    return []
})
const [sessionDuration, setSessionDuration] = useState(() => {
    if (existingProfile?.session_duration_minutes) {
        return roundToStep(existingProfile.session_duration_minutes, 15)
    }
    if (questionnaireData?.suggested_duration) {
        return roundToStep(questionnaireData.suggested_duration, 15)
    }
    return 60
})
const [equipment, setEquipment] = useState<string[]>(() => {
    if (existingProfile?.available_equipment && existingProfile.available_equipment.length > 0) {
        return existingProfile.available_equipment
    }
    if (questionnaireData?.suggested_equipment) {
        return [questionnaireData.suggested_equipment]
    }
    return []
})
```

As demais linhas de estado (`restrictions`, `cycleObservation`, etc.) permanecem inalteradas.

**Passo 7** — Adicionar um indicador visual sutil quando valores vieram do questionário.

Criar uma variável computada logo após os estados:

```tsx
// Track if values were auto-filled from questionnaire
const autoFilledFromQuestionnaire = !existingProfile && !!questionnaireData
```

**Passo 8** — Mostrar um badge discreto no header do formulário quando há auto-fill.

Na seção do header do formulário (dentro do `<div className="px-6 py-5 border-b border-k-border-subtle">`), logo após o `<p>` de descrição (~linha 393), adicionar:

```tsx
{autoFilledFromQuestionnaire && (
    <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
        <Check className="w-3 h-3" />
        Preenchido com respostas do questionário
    </span>
)}
```

O ícone `Check` já está importado no arquivo.

---

## Resumo das alterações

| Arquivo | O que muda |
|---------|-----------|
| `prescribe-client.tsx` | Passa `questionnaireData` como prop para `PrescriptionProfileForm` |
| `prescription-profile-form.tsx` | Importa `QuestionnaireData`, recebe como prop, usa como fallback inteligente na inicialização de estado, badge visual |

## Comportamento esperado

1. **Aluno respondeu questionário + primeiro acesso do treinador (sem perfil)**: Campos pré-preenchidos com dados do questionário. Badge "Preenchido com respostas do questionário" visível.
2. **Aluno respondeu questionário + treinador já configurou perfil**: Valores do perfil existente prevalecem. Sem badge.
3. **Aluno NÃO respondeu questionário**: Comportamento atual mantido (valores padrão).

## Notas

- A distribuição de dias usa padrões comuns (Seg/Qua/Sex para 3x, Seg/Ter/Qui/Sex para 4x, etc.) — o treinador pode ajustar livremente.
- A duração é arredondada para o step de 15 min mais próximo (ex: 67 min → 75 min, 55 min → 60 min).
- Equipamento vem como string única do questionário, é convertido para array de 1 elemento.
- **NÃO sobrescreve** nada que o treinador já configurou — só preenche campos vazios/padrão.
