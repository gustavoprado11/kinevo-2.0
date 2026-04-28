# Prompt Claude Code — Fase 4.5h: Renomear "Tempo" → "Cadência" + passada completa de testes

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando.
>
> Releia `mobile/specs/WORKFLOW.md` e `CLAUDE.md` antes de começar.

---

Duas coisas combinadas nesta fase:

1. **Rename "Tempo" → "Cadência"** em todas as strings visíveis ao trainer e ao aluno. "Cadência" é o termo correto no jargão de personal training brasileiro (3-1-1-0 = ritmo da execução: 3s descida, 1s pausa embaixo, 1s subida, 0s pausa em cima). "Tempo" gera confusão com "tempo cronológico".
2. **Passada rigorosa de testes** após o rename, dado que o working tree acumula Fase 4.5d-g. Antes do Gustavo decidir push, queremos confiança alta de que nada regrediu.

**Importante:** o **nome interno do campo** (`tempo: string` no `WorkoutSet`, coluna `tempo` no DB) **fica como está**. Não vamos refatorar nome de coluna nem propriedade de tipo — isso seria churn sem ganho. Só strings user-facing.

## 0. Pré-checagens

```bash
git status        # confirma working tree atual com 4.5d-g acumuladas
```

## 1. Mapear ocorrências

```bash
# Strings user-facing pra renomear (UI labels, placeholders, mensagens de helper)
grep -rn -iE "tempo['\"]|tempo:" web/src/components/programs mobile/components/trainer/program-builder mobile/components/workout shared/lib/prescription 2>/dev/null | head -40

grep -rn "Tempo " web/src mobile/components shared 2>/dev/null | grep -v "node_modules\|\.test\.\|tempoTimestamp\|setTimeout" | head -30
```

Espera-se encontrar em:
- `web/src/components/programs/SetSchemeTable.tsx` — coluna "TEMPO" no header
- `mobile/components/trainer/program-builder/SetSchemeCard.tsx` — label do campo "Tempo"
- `mobile/components/trainer/program-builder/SetSchemeEditor.tsx` — possível label
- `shared/lib/prescription/set-meta-label.ts` — string "Tempo X" → "Cadência X"
- `shared/lib/prescription/__tests__/set-meta-label.test.ts` — assertions
- `mobile/specs/active/prescricao-per-set-manual.md` — texto da spec

**Não renomear** em:
- Nomes de variáveis no código (`tempo`, `setTempo`, `tempo: string`, etc.) — fica como está
- Coluna do DB (`tempo` em `workout_item_set_templates` e `assigned_workout_item_sets`) — fica
- TypeScript interface `WorkoutSet.tempo` — fica
- Propriedade JSON em payloads — fica
- Comentários em código (manter `tempo` em comentários de inglês ou explicativos)

**Renomear** em:
- Labels visíveis no UI (column headers, field labels, placeholders se houver "Tempo de execução", etc.)
- Output do helper `buildSetMetaLabel` — `Tempo 3-1-1-0` → `Cadência 3-1-1-0`
- Tooltips, mensagens descritivas
- Spec doc (texto explicativo)

## 2. Aplicar rename

### 2.1 Helper compartilhado — `shared/lib/prescription/set-meta-label.ts`

```ts
// ANTES
parts.push(`Tempo ${set.tempo}`)

// DEPOIS
parts.push(`Cadência ${set.tempo}`)
```

JSDoc da função: troca exemplos de "Tempo 3-1-1-0" → "Cadência 3-1-1-0".

### 2.2 Testes do helper — `shared/lib/prescription/__tests__/set-meta-label.test.ts`

Atualiza todas as assertions que esperam "Tempo " → "Cadência ".

```ts
// ANTES
expect(buildSetMetaLabel({ reps: '10', tempo: '3-1-1-0' })).toBe('Meta: 10 reps · Tempo 3-1-1-0')

// DEPOIS
expect(buildSetMetaLabel({ reps: '10', tempo: '3-1-1-0' })).toBe('Meta: 10 reps · Cadência 3-1-1-0')
```

### 2.3 Web — `web/src/components/programs/SetSchemeTable.tsx`

- Header da coluna `TEMPO` → `CADÊNCIA` (mantém uppercase do header).
- Tooltip da coluna (se houver) idem.
- Placeholder do input se for "tempo" → "Cadência" ou mantém "3-1-1-0" (formato).

### 2.4 Mobile — `mobile/components/trainer/program-builder/SetSchemeCard.tsx`

- Label do campo "Tempo" no card de fase → "Cadência".

### 2.5 Mobile — `mobile/components/trainer/program-builder/SetSchemeEditor.tsx`

- Se houver alguma label/cabeçalho mencionando "Tempo" pra introduzir o campo, renomeia.

### 2.6 Spec — `mobile/specs/active/prescricao-per-set-manual.md`

- Atualiza o texto explicativo da feature trocando "Tempo" → "Cadência" onde for label de UI.
- Em referências internas ao campo TS (`tempo?: string`), mantém.

### Mensagem de commit (sugerida — não execute agora)

```
feat(per-set): rename "Tempo" to "Cadência" in user-facing strings (BR jargon)

- Helper buildSetMetaLabel outputs "Cadência X-X-X-X" instead of "Tempo X-X-X-X"
- Web SetSchemeTable column header renamed
- Mobile SetSchemeCard field label renamed
- Tests assertions updated to match new string
- Internal field names (tempo: string in WorkoutSet, DB column "tempo") unchanged
- Spec doc explanatory text updated
```

## 3. Passada rigorosa de testes

Após o rename, roda todos os workspaces e reporta o estado completo:

### 3.1 Shared

```bash
cd shared
npx tsc --noEmit
npx vitest run
echo "---"
npx vitest run --coverage 2>&1 | tail -20  # opcional, se vitest config suporta
cd ..
```

Espera-se: 142+ testes passando (após rename, contagem deve ser igual). Zero erros TS.

### 3.2 Web

```bash
cd web
npx tsc --noEmit 2>&1 | tee /tmp/web-tsc.log
echo "TS errors: $(grep -c 'error TS' /tmp/web-tsc.log || echo 0)"
echo "---"
npx vitest run
cd ..
```

Espera-se:
- Baseline TS: 11 erros (todos pré-existentes em test files: program-calendar.test.tsx, student-insights-card.test.tsx).
- Vitest: 596+/597 (1 skip pré-existente).

### 3.3 Mobile

```bash
cd mobile
npx tsc --noEmit 2>&1 | tee /tmp/mobile-tsc.log
echo "TS errors: $(grep -c 'error TS' /tmp/mobile-tsc.log || echo 0)"
echo "---"
npx vitest run
cd ..
```

Espera-se: 10 erros TS baseline, 255/255 vitest.

### 3.4 Comparação com baseline

Reporta uma tabela final:

```
| Workspace | TS errors antes | TS errors depois | Vitest antes | Vitest depois |
|-----------|----------------|------------------|--------------|---------------|
| shared    | 0              | <X>              | 142/142      | <X>/<X>       |
| web       | 11             | <X>              | 596/597      | <X>/<X>       |
| mobile    | 10             | <X>              | 255/255      | <X>/<X>       |
```

**Se algum número aumentou**, investiga e conserta antes de declarar pronto. **Não reporta sucesso se houver regressão**.

## 4. NÃO commita, NÃO empurra

Atualize a spec com notas dessa fase no working tree, rode `git status` final, e pare.

## 5. Reporte final

```
FASE 4.5h — rename "Tempo" → "Cadência" + passada de testes (working tree, sem commit)

Rename aplicado:
  - shared: helper buildSetMetaLabel + 13 testes atualizados
  - web: SetSchemeTable column header
  - mobile: SetSchemeCard field label
  - spec doc atualizada

Strings user-facing alteradas: <X> ocorrências em <Y> arquivos.
Strings internas (variáveis, tipos, DB columns): NÃO tocadas — ficam como `tempo`.

Passada de testes (após rename):

| Workspace | TS errors | Vitest |
|-----------|-----------|--------|
| shared    | 0         | 142/142 |
| web       | 11 (idem baseline) | 596/597 |
| mobile    | 10 (idem baseline) | 255/255 |

Conclusão: zero regressões. Working tree saudável.

Mensagem de commit sugerida (não execute agora):
  feat(per-set): rename "Tempo" to "Cadência" in user-facing strings (BR jargon)

Arquivos modificados (working tree):
  shared/lib/prescription/set-meta-label.ts
  shared/lib/prescription/__tests__/set-meta-label.test.ts
  web/src/components/programs/SetSchemeTable.tsx
  mobile/components/trainer/program-builder/SetSchemeCard.tsx
  mobile/components/trainer/program-builder/SetSchemeEditor.tsx (se aplicável)
  mobile/specs/active/prescricao-per-set-manual.md (notas Fase 4.5h)

Estado: working tree acumulando 4.5d + 4.5e + 4.5f + 4.5g + 4.5h.
SEM commits, SEM push. Aguardando autorização do Gustavo pra batch final.
```

## 6. Edge cases

- **`tempoTimestamp`, `setTimeout`, `tempo` em comentário inglês**: ignora — não são strings user-facing.
- **Coluna SQL `tempo`**: mantém. Renomear coluna seria migration nova + risco — sem ganho.
- **JSON payload com `tempo`**: mantém. Cliente e servidor falam o mesmo nome interno.
- **Se algum lugar tem texto tipo "Tempo de execução"** (composto): renomeia o "Tempo" pra "Cadência" só se a frase fizer sentido. Senão, pula.

## 7. Iterar / desfazer

- Working tree: edita arquivos in-place se algo precisar ajustar.
- Voltar arquivo específico: `git checkout -- <arquivo>`.
- NÃO `git reset --hard origin/main`.

Tudo claro? Confirme com "Fase 4.5h — começando" e parta da pré-checagem.
