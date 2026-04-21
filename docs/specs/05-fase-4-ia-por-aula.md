# Fase 4 — Ações de IA por aula/bloco

**Esta spec é de alto nível.** Quando o time estiver pronto, Fase 4 vira sua própria spec detalhada.

**Depende de:** Fase 3 em produção. Reaproveita a infra de patch.

## 1. Objetivo de produto

Transformar a IA de "evento inicial" em "assistente contínuo". Cada aula do construtor ganha ações contextuais que o treinador aciona sem sair da aula.

Exemplos de ações:

- **Sugerir exercícios para esta aula** — "o aluno não tem leg press; me dê 2 exercícios de quadríceps sem máquina".
- **Balancear volume** — "o volume de peito versus costas nesta aula está desbalanceado".
- **Substituir por variação** — menu de alternativas para um exercício específico, IA ranqueia por fit ao perfil do aluno.
- **Otimizar ordem** — "reordene os exercícios para ordem ótima (compostos primeiro, isoladores depois)".

Nenhuma dessas ações gera um programa novo — todas produzem **um patch restrito à aula ativa** (reusando a infra da Fase 3).

## 2. Princípios

1. **Escopo visível.** A IA é explícita sobre *o que* ela está mexendo: "Proposto para Treino B" (e não o programa todo).
2. **Ações pequenas, imediatas.** Sugestões específicas aplicam-se diretamente (com toast + undo). "Sugira exercícios" adiciona direto. Nenhum modal para ação pequena.
3. **Contexto mínimo.** Mandar só a aula alvo + perfil resumido do aluno para a LLM, não o programa inteiro. Latência < 5s por ação.
4. **Menu de contexto, não poluição visual.** As ações aparecem num menu "..." no header de cada aula (discreto), não como botões soltos.

## 3. Ações v1

Três ações para entregar primeiro (as mais alinhadas a jobs observáveis do treinador):

| Ação | Input | Output |
|---|---|---|
| `suggest_exercises_for_workout` | `workout`, `count = 2`, `constraints?` | Patch com `add_item` de N exercícios |
| `balance_volume` | `workout` | Patch que ajusta séries/repetições para equilibrar grupos |
| `replace_with_variant` | `workout`, `item_id` | Patch com `replace_item` |

Ações futuras (v2+): "otimizar ordem", "adaptar para lesão", "duplicar aula com variação".

## 4. UI

No header de cada `<WorkoutTab>` ou `<WorkoutPanel>` do construtor, adicionar um ícone "…" (ou `Sparkles` pequeno) que abre um dropdown:

```
✨ IA para esta aula
  Sugerir exercícios...
  Balancear volume
  Otimizar ordem
  ——
  Substituir um exercício...  (abre seleção de exercício dentro da aula)
```

Cada item do dropdown dispara a action correspondente, mostra um micro-loading no header da aula, e aplica o patch com toast "Mudanças aplicadas · Desfazer".

## 5. Contrato

Reaproveita `proposeProgramPatch` da Fase 3, com novo parâmetro:

```ts
proposeProgramPatch({
  ...,
  scope?: { type: 'workout'; workout_id: string } | { type: 'item'; workout_id: string; item_id: string },
  intent?: 'suggest_exercises' | 'balance_volume' | 'replace_variant' | 'free_text',
  instruction?: string,  // se intent='free_text'
})
```

O prompt da LLM varia por `intent` (poderia ser um switch simples em `web/src/lib/prescription/patch-prompt.ts`).

## 6. Riscos

- **Ações demais, polimento de menos.** Fácil cair na tentação de lançar 10 ações. Começar com 3, medir uso, expandir.
- **Sobrecarga cognitiva.** Menu fica gigante. Categorização por seção ("Conteúdo", "Estrutura", "Preferência do aluno"?) se passar de 5 ações.
- **Ação aplica no treino errado.** `scope` precisa ser passado corretamente — se o treinador tem Treino A aberto mas dispara a ação enquanto o foco é Treino B (caso raro em drag+click), detectar e desabilitar durante interações transitórias.

## 7. Critério de pronto

- [ ] Fase 3 estável por 3+ semanas.
- [ ] Sinal de uso: treinadores estão usando "Ajustar com IA" da Fase 3 frequentemente — se não, Fase 4 não é prioridade.
- [ ] Dados sobre os ajustes mais pedidos via Fase 3: devem informar quais são as 3 ações da v1.
