# Prompt Claude Code — Fase 4.5g: Meta line não trunca quando todos os campos são prescritos

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando mudanças até o Gustavo autorizar push.
>
> Releia `mobile/specs/WORKFLOW.md` e os `CLAUDE.md` antes de começar.

---

Bug visual identificado pelo Gustavo após validar a Fase 4.5f:

Quando o trainer prescreve todos os campos avançados (reps + RIR + Tempo) numa fase, a linha de meta no app do aluno fica:

```
Meta: 10-12 reps · RIR 2 · ...
```

O `...` indica truncamento. Texto está sendo cortado pelo `line-clamp` (web) e `numberOfLines={2}` (mobile) que eu pedi por engano na Fase 4.5f. Isso esconde informação prescrita pelo trainer — bug funcional.

**Decisão de produto:** **remover o limite de linhas**. A linha de meta pode quebrar pra quantas linhas precisar. O custo visual é menor que o custo de esconder informação.

## 0. Pré-checagens

```bash
git status        # working tree atual com Fase 4.5d-f acumuladas
```

## 1. Localizar os 3 lugares

Os arquivos modificados na Fase 4.5f que aplicaram line-clamp / numberOfLines:

```bash
grep -n "numberOfLines\|line-clamp\|webkit-line-clamp\|truncate\|max-lines" mobile/components/workout/SetRow.tsx
grep -n "numberOfLines\|line-clamp\|webkit-line-clamp\|truncate\|max-lines" web/src/components/programs/workout-preview/preview-set-row.tsx
grep -rn "numberOfLines\|line-clamp" mobile/app/training-room.tsx mobile/components/workout/ 2>/dev/null | head
```

## 2. Mudanças

### 2.1 Mobile (`mobile/components/workout/SetRow.tsx`)

- **Remova `numberOfLines={2}`** do `<Text>` que renderiza `buildSetMetaLabel(...)`.
- Garanta que o container do texto tem `flexShrink: 1` e/ou `flexWrap: 'wrap'` apropriado. Texto deve quebrar naturalmente em quantas linhas forem necessárias.

### 2.2 Web (`web/src/components/programs/workout-preview/preview-set-row.tsx`)

- **Remova as classes `line-clamp-2`** ou estilo `-webkit-line-clamp` aplicado ao texto da meta.
- Container do texto: garanta `text-wrap: balance` ou nada — deixa o navegador quebrar naturalmente. Sem `overflow: hidden` ou `text-overflow: ellipsis`.

### 2.3 Mobile training-room (treinador live coaching)

Se reaproveita `<SetRow>`, herda o fix automático. Se tem componente próprio, aplica o mesmo princípio: zero `numberOfLines`, layout permite wrap natural.

## 3. Validação visual antes de declarar pronto

Pra confirmar que o fix funciona end-to-end, simula no working tree mentalmente:

- Fase com **só reps**: "Meta: 10-12 reps" → 1 linha. ✓
- Fase com **reps + RIR**: "Meta: 10-12 reps · RIR 2" → 1 linha em telas normais. ✓
- Fase com **reps + RIR + Tempo**: "Meta: 10-12 reps · RIR 2 · Tempo 3-1-1-0" → pode quebrar pra 2 linhas em telas pequenas. **Sem `...`**.
- Fase com **AMRAP + Tempo**: "Meta: até a falha · Tempo 3-0-1-0" → 1-2 linhas. ✓
- Fase com **Cluster + RIR**: "Meta: 5+5+5 · cluster · RIR 1" → 1-2 linhas. ✓

## 4. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baselines. Sem regressões esperadas (mudança puramente CSS/style).

## 5. NÃO commita, NÃO empurra

Atualize a spec `mobile/specs/active/prescricao-per-set-manual.md` adicionando notas dessa correção no working tree, rode `git status`, e pare.

## 6. Reporte final

```
FASE 4.5g — fix do truncamento da linha de meta (working tree, sem commit)

Bug corrigido:
  Quando trainer prescrevia reps + RIR + Tempo na mesma fase, o texto da meta
  era truncado com '...' no app do aluno (line-clamp:2 / numberOfLines={2}
  herdados da Fase 4.5f). Informação prescrita ficava invisível.

Fix aplicado em 3 superfícies:
  ✓ mobile/components/workout/SetRow.tsx — removido numberOfLines
  ✓ web/src/components/programs/workout-preview/preview-set-row.tsx — removido line-clamp
  ✓ training-room.tsx — herda via SetRow (ou fix direto se componente próprio)

Comportamento agora:
  - Linha de meta quebra naturalmente em quantas linhas forem necessárias
  - Sem '...', sem informação escondida
  - Em telas pequenas com todos campos: 2 linhas (aceitável)
  - Em telas normais: 1 linha (caso comum)

Mensagem de commit sugerida (não execute agora):
  fix(per-set): allow meta label to wrap freely instead of truncating

Arquivos modificados (working tree):
  mobile/components/workout/SetRow.tsx
  web/src/components/programs/workout-preview/preview-set-row.tsx
  mobile/app/training-room.tsx (se aplicável)
  mobile/specs/active/prescricao-per-set-manual.md (notas Fase 4.5g)

Validações:
  shared: 142/142
  web TS: 11 erros baseline (idêntico)
  web vitest: 596/597
  mobile TS: 10 erros baseline (idêntico)
  mobile vitest: 255/255

Estado: working tree acumulando 4.5d + 4.5e + 4.5f + 4.5g. Sem commits, sem push.
```

## 7. Edge cases

- **Telas muito estreitas (iPhone SE)** com texto longo (Cluster + RIR + Tempo): pode quebrar pra 3 linhas. Aceitável visualmente — informação completa é prioridade.
- **Container do `SetRow` tem altura fixa**: se sim, e o wrap quebrar o layout, ajusta pra altura dinâmica. Se não, OK.
- **`flex-shrink: 0`** num parent: pode impedir wrap. Verifica e ajusta se for o caso.

## 8. Iterar / desfazer

- Working tree: edita arquivos in-place se algo precisar ajustar.
- Voltar arquivo específico: `git checkout -- <arquivo>` (volta ao último commit em main, perde Fase 4.5d-g daquele arquivo).
- NÃO fazer `git reset --hard origin/main`.

Tudo claro? Confirme com "Fase 4.5g — começando" e parta da pré-checagem.
