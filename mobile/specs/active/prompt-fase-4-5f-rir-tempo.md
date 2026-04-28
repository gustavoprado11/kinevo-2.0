# Prompt Claude Code — Fase 4.5f: RIR e Tempo visíveis pro aluno

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando mudanças até o Gustavo autorizar push da funcionalidade inteira.
>
> Releia `mobile/specs/WORKFLOW.md` e os `CLAUDE.md` antes de começar.

---

Após validar a Fase 4.5e, o Gustavo identificou um gap: quando o trainer prescreve **RIR** (Reps in Reserve) ou **Tempo** (cadência tipo 3-1-1-0) por fase, o aluno **não vê esses dados** na execução. Isso quebra a intenção do trainer — RIR e Tempo são determinantes da intensidade e técnica.

**Decisão de produto** (alinhada com Gustavo):

- **Reps**: continua sendo mostrado como "Meta: X reps" acima da linha (já existe).
- **Carga**: continua sendo mostrada como "Meta: Y kg / Z% 1RM" acima do input de carga (já existe — Fase 4.2).
- **RIR**: passa a aparecer **na mesma linha do "Meta: reps"**, separado por `·`. Visual: `Meta: 10 reps · RIR 2`. Só visível quando o trainer prescreveu (`rir != null && rir != undefined`). **`RIR 0` é valor válido = "até a falha"** — também deve aparecer.
- **Tempo**: idem RIR, na mesma linha. Visual: `Meta: 10 reps · RIR 2 · Tempo 3-1-1-0`. Só visível quando prescrito (`tempo != null && tempo != ''`).
- **Descanso**: **NÃO** ganha label na linha. Continua sendo consumido pelo rest timer overlay automático que já existe — descanso mostrado apenas como contagem regressiva ao final da série.

Aplicar em **3 lugares** pra paridade:
1. Mock preview no builder web (`workout-preview/preview-set-row.tsx`)
2. Sala de treino do aluno mobile (`mobile/components/workout/SetRow.tsx`)
3. Sala de treino do treinador / live coaching (`mobile/app/training-room.tsx` ou componente que renderiza linhas)

## 0. Pré-checagens

```bash
git status        # confirma working tree atual com Fase 4.5d + 4.5e + WORKFLOW docs acumulados
git log --oneline -5
```

## 1. Ler estado atual (referência)

```bash
cat mobile/components/workout/SetRow.tsx
cat web/src/components/programs/workout-preview/preview-set-row.tsx
cat shared/lib/prescription/set-scheme.ts | grep -A 20 "buildWeightMetaLabel"
cat shared/types/prescription.ts | grep -A 10 "WorkoutSet"
```

## 2. Helper compartilhado novo

Crie `shared/lib/prescription/set-meta-label.ts`:

```ts
import type { WorkoutSet } from '../../types/prescription'

/**
 * Monta a string de "meta" exibida acima da linha de execução de uma fase.
 *
 * Inclui: Meta: reps + (RIR + Tempo opcionais quando prescritos).
 * NÃO inclui carga (essa é tratada por buildWeightMetaLabel acima do input
 * de peso) nem descanso (consumido pelo rest timer overlay).
 *
 * Casos especiais já cobertos:
 *  - AMRAP: usa "Meta: até a falha · ..." (set.reps já vem como "AMRAP" ou similar)
 *  - Cluster: usa "Meta: 5+5+5 · cluster · ..." (set.reps formato cluster)
 *
 * Exemplos:
 *  - { reps: '10' } → "Meta: 10 reps"
 *  - { reps: '10', rir: 2 } → "Meta: 10 reps · RIR 2"
 *  - { reps: '10', rir: 2, tempo: '3-1-1-0' } → "Meta: 10 reps · RIR 2 · Tempo 3-1-1-0"
 *  - { reps: '10', rir: 0 } → "Meta: 10 reps · RIR 0" (RIR 0 = até a falha, valor válido)
 *  - { reps: 'AMRAP', tempo: '3-0-1-0' } → "Meta: até a falha · Tempo 3-0-1-0"
 */
export function buildSetMetaLabel(set: WorkoutSet): string {
  const parts: string[] = []

  // Reps (sempre primeiro). Inclui formatos especiais (AMRAP, cluster).
  if (set.reps) {
    if (set.reps.toUpperCase() === 'AMRAP') {
      parts.push('Meta: até a falha')
    } else if (set.reps.includes('+')) {
      parts.push(`Meta: ${set.reps} · cluster`)
    } else {
      parts.push(`Meta: ${set.reps} reps`)
    }
  }

  // RIR — valor 0 é válido (= "até a falha"). Só esconde se for null/undefined.
  if (set.rir !== null && set.rir !== undefined) {
    parts.push(`RIR ${set.rir}`)
  }

  // Tempo — só quando prescrito (string não-vazia).
  if (set.tempo && set.tempo.trim() !== '') {
    parts.push(`Tempo ${set.tempo}`)
  }

  return parts.join(' · ')
}
```

**Atenção:** se já existe um helper similar (`formatRepsTarget` ou parecido) usado em `SetRow.tsx` mobile pra cluster/AMRAP, o novo `buildSetMetaLabel` deve **substituí-lo** nos callsites — passa a ser a fonte única.

**Testes** em `shared/lib/prescription/__tests__/set-meta-label.test.ts`:
- só reps → "Meta: 10 reps"
- reps + RIR → "Meta: 10 reps · RIR 2"
- reps + RIR + Tempo → "Meta: 10 reps · RIR 2 · Tempo 3-1-1-0"
- reps + Tempo (sem RIR) → "Meta: 10 reps · Tempo 3-1-1-0"
- RIR 0 → inclui "RIR 0" (não esconde — é "falha")
- Tempo string vazia → não inclui
- AMRAP → "Meta: até a falha"
- Cluster "5+5+5" → "Meta: 5+5+5 · cluster"
- AMRAP + Tempo → "Meta: até a falha · Tempo 3-0-1-0"

Re-exporta em `shared/index.ts`.

### Mensagem de commit (sugerida — não execute agora)

```
feat(per-set): add buildSetMetaLabel helper for unified meta string with RIR and Tempo
```

Arquivos: `shared/lib/prescription/set-meta-label.ts`, `shared/lib/prescription/__tests__/set-meta-label.test.ts`, `shared/index.ts`.

## 3. Aplicar nos 3 lugares

### 3.1 Sala de treino do aluno mobile (`mobile/components/workout/SetRow.tsx`)

Atualmente mostra "Meta: 10 reps" via lógica inline. Substitui pelo helper compartilhado:

```tsx
import { buildSetMetaLabel } from '@kinevo/shared/lib/prescription/set-meta-label'

// onde antes você tinha algo tipo `Meta: ${repsTarget}`
<Text style={...}>{buildSetMetaLabel(setData)}</Text>
```

- Garante que o componente recebe o objeto `WorkoutSet` (ou os campos `reps`, `rir`, `tempo` por props) — se hoje só recebe `repsTarget`, expande a interface.
- Estilo: mantém o atual de "Meta: X" (violeta médio, font pequena). A linha pode quebrar pra 2 linhas em telas pequenas — adicione `flexWrap: 'wrap'` no container.

### 3.2 Mock preview no builder web (`web/src/components/programs/workout-preview/preview-set-row.tsx`)

Mesma substituição:

```tsx
import { buildSetMetaLabel } from '@kinevo/shared/lib/prescription/set-meta-label'

<span className="text-violet-600 dark:text-violet-300 text-xs">{buildSetMetaLabel(setData)}</span>
```

Estilo Tailwind v4. Container com `flex-wrap` se a linha estourar.

### 3.3 Sala de treino do treinador (live coaching)

Localize onde `mobile/app/training-room.tsx` renderiza as linhas de série dos exercícios do aluno. Se reaproveita `<SetRow>`, herda automaticamente. Senão, aplica o mesmo `buildSetMetaLabel`.

**Princípio:** o trainer vendo o aluno em tempo real enxerga **exatamente** a mesma faixa de meta que o aluno está vendo.

### Mensagem de commit (sugerida — não execute agora)

```
feat(per-set): show RIR and Tempo per phase across student, trainer and preview surfaces

- mobile SetRow uses buildSetMetaLabel for unified meta display
- web preview-set-row uses same helper for builder mock parity
- trainer training-room mirrors the same line via shared component or helper
- Descanso continues consumed by rest timer overlay (not displayed in row)
```

Arquivos: `mobile/components/workout/SetRow.tsx`, `web/src/components/programs/workout-preview/preview-set-row.tsx`, `mobile/app/training-room.tsx` (se aplicável), e os callsites que passam props.

## 4. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baseline TS web em 11 erros. Sem regressões. Espera-se ~9 testes novos no shared (vitest run mostra a contagem).

## 5. NÃO commita, NÃO empurra

Atualize a spec `mobile/specs/active/prescricao-per-set-manual.md` adicionando notas dessa fase no working tree, rode `git status` pra confirmar o estado, e pare. Working tree continua acumulando.

## 6. Reporte final

```
FASE 4.5f — RIR e Tempo visíveis pro aluno (working tree, sem commit)

Helper criado:
  shared/lib/prescription/set-meta-label.ts → buildSetMetaLabel
  + 9 testes Vitest (cobertura completa de RIR/Tempo/AMRAP/cluster/RIR=0)

Aplicado nas 3 superfícies pra paridade:
  ✓ mobile/components/workout/SetRow.tsx (aluno na execução)
  ✓ web/src/components/programs/workout-preview/preview-set-row.tsx (mock no builder)
  ✓ mobile/app/training-room.tsx (treinador acompanhando ao vivo)

Comportamento confirmado:
  - "Meta: 10 reps" sempre presente
  - "· RIR X" só quando prescrito (incluindo RIR 0 = até a falha)
  - "· Tempo 3-1-1-0" só quando prescrito (string não-vazia)
  - Linha quebra pra 2 linhas em telas pequenas (flex-wrap)
  - Descanso NÃO entra na linha (rest timer overlay continua sendo a fonte)

Arquivos modificados (working tree):
  shared/lib/prescription/set-meta-label.ts (NOVO)
  shared/lib/prescription/__tests__/set-meta-label.test.ts (NOVO)
  shared/index.ts (export)
  mobile/components/workout/SetRow.tsx
  web/src/components/programs/workout-preview/preview-set-row.tsx
  mobile/app/training-room.tsx (se reaproveitava SetRow, herdou — confere)
  mobile/specs/active/prescricao-per-set-manual.md (notas Fase 4.5f)

Validações:
  shared: <X>/<X> (9 novos)
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: <X> erros baseline (idêntico)
  mobile vitest: <X>/<X>

Estado: working tree acumulando Fase 4.5d + 4.5e + 4.5f. SEM commits, SEM push.
Aguardando próximas iterações + autorização final do batch (per WORKFLOW.md).
```

## 7. Edge cases

- **Programa antigo sem set_scheme** (sem `rir` nem `tempo`): comportamento idêntico ao atual — só "Meta: X reps" se houver, ou nada. Backward compat.
- **`rir = null` vs `rir = 0`**: zero é valor válido (até a falha), não pode ser tratado como "não prescrito". Helper já lida (testar).
- **`tempo = ''`** (string vazia): não exibe. Trata como não prescrito.
- **Cluster + RIR**: "Meta: 5+5+5 · cluster · RIR 1" — linha mais longa, mas legível.
- **AMRAP + RIR**: estranho conceitualmente (AMRAP já é falha), mas se o trainer prescreveu, mostra. Não fazemos validação de "faz sentido" — confiamos no trainer.
- **Linha estoura largura em iPhone SE**: `flex-wrap` quebra pra 2 linhas. Aceitar visualmente.

## 8. Iterar / desfazer

- Working tree: edita arquivos in-place se algo precisar ajustar.
- Voltar arquivo específico ao último commit em main: `git checkout -- <arquivo>`.
- NÃO fazer `git reset --hard origin/main` (apaga toda Fase 4.5d-f acumulada).

Tudo claro? Confirme com "Fase 4.5f — começando" e parta da pré-checagem.
