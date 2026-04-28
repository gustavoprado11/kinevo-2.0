# Prompt Claude Code — Fase 4.2: Meta de carga visível por série (paridade com Meta de reps)

> Cole numa nova sessão do Claude Code. Push direto em main. Fix cirúrgico em cima da Fase 4.1.

---

A Fase 4.1 ficou linda visualmente: chip do método, badges por tipo de série, "Meta: 10" violeta acima do input de Reps. Agora o Gustavo notou que a coluna **Peso** ficou assimétrica — ela não tem nenhuma meta visível, só o placeholder do treino anterior.

Sua missão: replicar o tratamento "Meta: X" pra coluna de Peso, usando os campos já disponíveis no `WorkoutSet`:

- `weight_kg?: number | null` — carga absoluta em kg
- `weight_pct1rm?: number | null` — % de 1RM

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Confira que os commits da Fase 4.1 estão em main
```

## 1. Lógica de exibição (importante — leia antes de codar)

A meta de carga é **opcional na prescrição**. O treinador pode ou não preencher. Por isso, três cenários:

| Treinador prescreveu | Mostrar acima do input |
|---|---|
| `weight_kg = 80` | `Meta: 80 kg` |
| `weight_pct1rm = 75` | `Meta: 75% 1RM` |
| Ambos preenchidos (raro) | `Meta: 80 kg (75% 1RM)` |
| Nenhum dos dois | **NÃO mostra** linha "Meta:" — mantém só o placeholder do "Anterior" |

Isso é diferente da meta de reps (que SEMPRE aparece quando há `set_scheme`). Carga é hint contextual.

**Placeholder do input "Peso"**: se há `weight_kg` ou `weight_pct1rm`, usa como placeholder com cor violet-500/60% opacity (mesmo padrão da meta de reps). Senão, mantém o placeholder atual (geralmente vindo de `previousSets[].weight`).

## 2. Mudanças no `mobile/components/workout/SetRow.tsx`

Atualmente a célula de Reps tem essa estrutura:

```tsx
<View className="reps-cell">
  {repsTarget && <Text className="meta-label">Meta: {repsTarget}</Text>}
  <TextInput placeholder={repsTarget ?? previousReps} ... />
</View>
```

Replica o padrão pra célula de Peso:

```tsx
<View className="weight-cell">
  {weightMetaLabel && <Text className="meta-label">{weightMetaLabel}</Text>}
  <TextInput placeholder={weightTargetPlaceholder ?? previousWeight} ... />
</View>
```

Onde `weightMetaLabel` é montado por um helper:

```ts
function buildWeightMetaLabel(weightKg: number | null | undefined, weightPct1rm: number | null | undefined): string | null {
  if (weightKg != null && weightPct1rm != null) return `Meta: ${weightKg} kg (${weightPct1rm}% 1RM)`
  if (weightKg != null) return `Meta: ${weightKg} kg`
  if (weightPct1rm != null) return `Meta: ${weightPct1rm}% 1RM`
  return null
}
```

Coloca esse helper em `shared/lib/prescription/set-scheme.ts` (já tem `summarizeSetScheme` lá). Adiciona testes Vitest pros 4 cenários da tabela.

`weightTargetPlaceholder`: se `weight_kg != null`, é a string `String(weight_kg)`. Senão, null.

## 3. Aplicar a MESMA mudança nas outras duas superfícies

Por princípio de paridade visual:

- **Sala de treino do treinador** (`mobile/app/training-room.tsx`): se a tela usa `<SetRow>` diretamente, herda automático. Se tem componente próprio, espelha a mesma lógica.
- **Preview do builder** (`mobile/app/program-builder/preview.tsx` + `SetRowPreview.tsx` se existe): idem.

**Princípio:** se o treinador altera carga no builder e abre o preview, ele tem que ver "Meta: 80 kg" antes de salvar. Igual o aluno verá depois.

## 4. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Sem erros novos = ok.

## 5. Commits e push

```bash
git pull --rebase origin main

# Re-valida após rebase
cd shared && npx tsc --noEmit && cd ..
cd mobile && npx tsc --noEmit && cd ..

git add shared/lib/prescription/set-scheme.ts \
        shared/lib/prescription/__tests__/set-scheme.test.ts
git commit -m "feat(per-set): add buildWeightMetaLabel helper for prescribed weight rendering"

git add mobile/components/workout/SetRow.tsx \
        mobile/components/workout/SetRowPreview.tsx
git commit -m "feat(per-set): show 'Meta: X kg' above weight input when prescribed"

git add mobile/app/training-room.tsx
git commit -m "feat(per-set): mirror weight meta label in trainer live coaching"

git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): document Fase 4.2 weight meta parity"

git push origin main
```

## 6. Reporte final

```
FASE 4.2 — meta de carga visível

Mudanças:
  - Helper shared `buildWeightMetaLabel` com 4 cenários cobertos por teste
  - SetRow / SetRowPreview / training-room mostram "Meta: 80 kg" ou "Meta: 75% 1RM" quando prescrito
  - Placeholder do input "Peso" prioriza target sobre histórico

Commits:
  - <hash> feat(per-set): buildWeightMetaLabel helper
  - <hash> feat(per-set): show weight meta in SetRow
  - <hash> feat(per-set): mirror in trainer training-room
  - <hash> docs(per-set): Fase 4.2 notes

Próximo passo do Gustavo:
1. Reload do simulador.
2. Abrir o builder, criar um exercício novo, modo Avançado.
3. Em uma série específica, preencher carga (ex.: 80 kg).
4. Salvar, atribuir pra um aluno, abrir como aluno.
5. Conferir que aparece "Meta: 80 kg" acima do input de Peso da série correspondente.
6. Em séries onde NÃO foi preenchida carga, conferir que NÃO aparece "Meta:" — só placeholder do anterior.
```

## 7. Edge cases

- **Treinador preenche carga só na 1ª série**: linha 1 mostra "Meta: 80 kg", linhas 2-3 não mostram nada (ou só placeholder do anterior). Comportamento esperado.
- **Programa antigo (sem set_scheme)**: nenhuma linha mostra "Meta:" — comportamento atual mantido.
- **Carga vinda como decimal (ex.: 22.5 kg)**: formata sem zeros à direita supérfluos. `22.5 kg` ok, `40.0 kg` vira `40 kg`.

## 8. Reverter (se quebrar)

```bash
git revert HEAD~4..HEAD --no-edit
git push origin main
```

Tudo claro? Confirma com "Fase 4.2 — começando" e parta da pré-checagem.
