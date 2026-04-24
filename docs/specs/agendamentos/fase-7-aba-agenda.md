# Fase 7 — Aba Agenda com calendário visual

**Objetivo:** vista rica de calendário semanal com drag-and-drop. Encerra o MVP.

**Pré-requisito:** Fases 1-6 concluídas.

---

## Entregáveis

1. Nova rota `/schedule` + item "Agenda" na sidebar
2. Componente de calendário semanal com scroll horizontal
3. Cards visuais de agendamento
4. Click em slot vazio abre modal de criação (reusa da Fase 3)
5. Click em card abre popover com ações
6. Drag-and-drop pra remarcar ocorrência
7. Navegação entre semanas
8. Indicadores "Hoje" e "Agora"
9. Testes

---

## Arquivos a criar

```
web/src/app/schedule/
├── page.tsx
└── schedule-client.tsx

web/src/components/schedule/
├── weekly-calendar.tsx
├── appointment-card.tsx
├── time-grid.tsx
├── week-navigator.tsx
├── now-indicator.tsx
├── use-drag-drop-reschedule.ts     # hook
└── __tests__/
    ├── weekly-calendar.test.tsx
    ├── appointment-card.test.tsx
    └── use-drag-drop-reschedule.test.ts
```

## Arquivos a modificar

- `web/src/components/layout/sidebar.tsx` — adicionar item "Agenda" com ícone Calendar
- `web/src/stores/sidebar-store.ts` — verificar se `/schedule` deve entrar nos padrões de auto-collapse

---

## Detalhamento

### Layout do calendário semanal

- Grid de 7 colunas (Dom-Sáb) × N linhas (horas do dia)
- Horário configurável: default 6h-22h (17 slots de 1h)
- Slot clicável vazio
- Cards posicionados absolutamente por hora/duração
- Scroll vertical dentro do calendário
- Scroll horizontal pra semanas anteriores/seguintes

### `AppointmentCard`

```typescript
interface Props {
    occurrence: AppointmentOccurrence
    student: { name: string; avatarUrl: string | null }
    onClick: (occurrence) => void
    onDragEnd: (occurrence, newDate, newTime) => void
}
```

- Card com cor suave por aluno (hash do ID → cor consistente)
- Mostra nome do aluno + hora início-fim
- Badge no canto se sync Google está pending/erro
- Cursor grab; durante drag, fantasma do card segue o mouse

### Drag-and-drop

Usar biblioteca leve: `@dnd-kit/core` (se já estiver no projeto) ou `react-dnd`. Alternativa simples: implementação manual com `onMouseDown`/`onMouseMove`/`onMouseUp`.

**Regras:**
- Drag só afeta a ocorrência (sempre `scope: 'only_this'`)
- Ao soltar num slot válido, chama `rescheduleOccurrence`
- Se o slot tem conflito, mostra overlay vermelho durante drag
- Ao soltar em slot com conflito, pede confirmação

### Week navigator

Header com:
- Botão "←" e "→" pra semana anterior/próxima
- Texto "Semana de DD/MM" no meio
- Atalhos: `←` `→` (teclado), `T` vai pra hoje
- Botão "Hoje" que resetar pra semana atual

### Now indicator

Linha horizontal vermelha atravessando a coluna do dia atual, na altura do horário atual. Atualiza a cada 60s.

### Popover de ações do card

Ao clicar em um card, popover com:
- "Remarcar..." → abre modal de remarcação (sempre pergunta "só essa" ou "daqui pra frente")
- "Cancelar essa" → confirmação
- "Editar rotina" → abre modal de edição (Fase 3)
- "Abrir perfil do aluno" → router.push

---

## Performance

- Se a semana tiver muitos agendamentos (>50), considerar virtualization. No MVP, renderização direta deve ser suficiente pro volume típico (20-40 alunos = ~80 ocorrências/semana).
- Ocorrências carregadas via server-side rendering inicial + refetch ao navegar pra outra semana
- Debounce no drag pra evitar chamadas duplicadas

---

## Testes

### `weekly-calendar.test.tsx`

- Renderiza grid 7×N
- Posiciona cards corretamente por hora/duração
- Click em slot vazio dispara callback com data/hora correta
- Click em card abre popover
- Navegação semanal atualiza range corretamente
- Now indicator aparece só na coluna do dia atual

### `appointment-card.test.tsx`

- Mostra nome do aluno e horário
- Badge de sync quando relevante
- Drag handlers chamados corretamente

### `use-drag-drop-reschedule.test.ts`

- Drop em slot válido chama `rescheduleOccurrence` com params corretos
- Drop no mesmo slot é no-op
- Drop em slot com conflito mostra aviso

---

## Critérios de aceite

- [ ] Aba "Agenda" aparece na sidebar e leva pra /schedule
- [ ] Calendário renderiza semana atual com ocorrências
- [ ] Click em slot vazio abre modal de criação pré-preenchido
- [ ] Click em card abre popover funcional
- [ ] Drag-and-drop remarca 1 ocorrência
- [ ] Navegação entre semanas funciona (botões + teclado)
- [ ] "Hoje" e indicator do horário atual aparecem
- [ ] Sync com Google funciona após remarcar via drag
- [ ] Performance aceitável com 80+ ocorrências visíveis
- [ ] Testes passam, tsc e eslint clean

---

## Referências

- Layout de referência: qualquer calendário usando Tailwind CSS Grid
- Drag-and-drop: `@dnd-kit/core` ou implementação manual
- Modal de criação: componente da Fase 3 (reusa)
- Actions: todas das Fases 2 e 5
