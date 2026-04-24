# Agendamentos — Specs de Desenvolvimento

Este diretório contém as specs de implementação da feature Agendamentos, uma por fase.

**Referência mestra:** [`../agendamentos-plano.md`](../agendamentos-plano.md) — leia antes de começar qualquer fase.

## Fases

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | [`fase-1-modelo-dados.md`](./fase-1-modelo-dados.md) | Schema, RLS, helper de projeção, testes |
| 2 | [`fase-2-server-actions.md`](./fase-2-server-actions.md) | Server actions CRUD com validação Zod |
| 3 | [`fase-3-ui-modal-perfil.md`](./fase-3-ui-modal-perfil.md) | Modal de criação + integração no perfil do aluno |
| 3.5 | [`fase-3.5-rotinas-multi-slot.md`](./fase-3.5-rotinas-multi-slot.md) | Suporte a rotinas com múltiplos dias/horários (pacote) |
| 4 | [`fase-4-widget-dashboard.md`](./fase-4-widget-dashboard.md) | Widget "Próximos agendamentos" no dashboard |
| 5 | [`fase-5-lembretes-push.md`](./fase-5-lembretes-push.md) | Notificações push agendadas + imediatas |
| 6 | [`fase-6-google-calendar.md`](./fase-6-google-calendar.md) | OAuth, sync híbrido, webhooks |
| 7 | [`fase-7-aba-agenda.md`](./fase-7-aba-agenda.md) | Calendário visual com drag-and-drop |
| 8 | [`fase-8-agendamento-unico.md`](./fase-8-agendamento-unico.md) | Agendamento único (aula experimental, reposição) — V2 |
| 8.5 | [`fase-8.5-encerrar-rotinas.md`](./fase-8.5-encerrar-rotinas.md) | UX fix — encerrar rotina direto do popover + encerrar todas de um aluno — V2 |

## Como usar

Cada spec é auto-contida. Execute na ordem. Ao terminar uma fase, rode:

```bash
cd web
npm run test:run
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```

Se tudo passar, faça o commit da fase e avance pra próxima.

## Padrões do Kinevo

Todas as specs seguem convenções existentes do codebase:
- **SQL**: `TIMESTAMPTZ`, CHECK constraints em vez de ENUM, FK `ON DELETE CASCADE`
- **RLS**: padrão `trainer_id = current_trainer_id()` + service_role bypass
- **Tests**: Vitest + React Testing Library, `__tests__/` adjacente ao arquivo
- **Server actions**: Zod pra validação, padrão `try/catch` + retorno `{ success, error?, data? }`
- **Mocks**: Supabase via `vi.mock()`, Zustand via `getState()` + reset em `beforeEach`
