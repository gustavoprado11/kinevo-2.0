# Onda 1 — Quick Wins do Dashboard do Aluno

Pré-requisito: ter lido `dashboard-aluno-00-visao-geral.md`. **Não execute esta spec sem isso.**

## 1. Objetivo & escopo

Cinco mudanças cirúrgicas que limpam ruído visual e adicionam contexto que já existe no banco mas não aparece na tela. Risco baixo, todas isoladas, todas reversíveis.

**No escopo:**

1. Mostrar `objective` e `management_tags` no header do aluno.
2. Esconder o card "Rotina atual" (`StudentScheduleSection`) quando não há rotina cadastrada.
3. Esconder ou reduzir o card "Próximos Programas" quando o programa ativo está em <75 % de progresso e não há fila.
4. Trocar o auto-start do tour `student_detail` por opt-in (botão no header).
5. Ocultar programas "Substituído" com 0 sessões no histórico, com toggle "Mostrar substituídos".

**Fora do escopo:**

- Calendário, heatmap, trend strip → Onda 2.
- Smart Banner, deduplicação de insights → Onda 3.
- Refatoração da `StudentStatusBar` → Onda 3.
- Qualquer mudança em `page.tsx` (queries) — só client components.

## 2. Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `web/src/components/students/student-header.tsx` | Adicionar render de `objective` + `management_tags` quando presentes. Adicionar botão "Tour rápido" no menu `MoreHorizontal`. |
| `web/src/app/students/[id]/student-detail-client.tsx` | Esconder `StudentScheduleSection` quando vazio. Esconder/reduzir `Próximos Programas` baseado em progresso. Trocar `autoStart={true}` do `TourRunner` para `false` e disparar via callback do header. |
| `web/src/components/students/program-history-section.tsx` | Filtrar programas "Substituído" com 0 sessões; adicionar toggle "Mostrar substituídos". |
| `web/src/components/onboarding/tours/tour-runner.tsx` | (apenas se necessário) Expor método para trigger manual via prop ou store. Provavelmente já dá para acionar via `useOnboardingStore.startTour()`. **Verifique antes de mexer.** |
| `web/src/components/appointments/student-schedule-section.tsx` | (verificar) Se o componente já expõe um callback `onEmpty` ou `hasItems`, usar. Se não, fetchar localmente e expor. |
| `web/src/components/students/__tests__/student-header.test.tsx` (novo) | Testes do novo render. |
| `web/src/components/students/__tests__/program-history-section.test.tsx` (existente, ampliar) | Cobrir filtro "Substituído". |

## 3. Passos de execução

### Passo 1 — Header com objective e management_tags

1. Em `student-header.tsx`, na interface `Student`, os campos `objective?: string | null` e `management_tags?: string[] | null` já existem. Confirme.
2. Adicione, logo abaixo da linha do email/telefone/`Desde X`, um bloco de `Objetivo` quando `student.objective` for truthy:
   ```tsx
   {student.objective && (
     <div className="mt-1.5 flex items-center gap-2 text-[12px] text-k-text-secondary">
       <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
         🎯 Objetivo
       </span>
       <span className="font-medium truncate">{student.objective}</span>
     </div>
   )}
   ```
3. As `management_tags` viram badges ao lado dos badges de status existentes (Ativo/Presencial). Renderize cada uma com classes de `STAT_COLORS.violet` (ou crie um novo tom neutro `tag` em `STATUS_CONFIG`/STAT_COLORS, sem alterar os existentes):
   ```tsx
   {(student.management_tags ?? []).map(tag => (
     <span key={tag} className="px-2 py-0.5 rounded bg-[#EEF1FF] dark:bg-violet-500/10 text-[#3340A6] dark:text-violet-300 text-[11px] font-bold">
       {tag}
     </span>
   ))}
   ```
4. **Critério de aceitação:** quando o aluno tem `objective="Hipertrofia"` e `management_tags=["VIP","Ciclo 3"]`, ambos aparecem no header. Quando os campos são `null` ou `[]`, o layout volta exatamente ao estado anterior (sem espaço extra).

### Passo 2 — Esconder StudentScheduleSection vazio

1. Em `student-schedule-section.tsx`, examine se o componente já expõe um sinal de "vazio" externamente. Se ele faz fetch interno, **adicione uma prop opcional `onLoadedCount?: (count: number) => void`** que ele chama após carregar; OU exponha um hook `useStudentSchedules(studentId)` que possa ser usado no parent.
2. Em `student-detail-client.tsx`, mantenha o `StudentScheduleSection` montado, mas envolva-o num wrapper que esconde via CSS quando `count === 0`:
   ```tsx
   const [scheduleCount, setScheduleCount] = useState<number | null>(null)
   ...
   <div className={scheduleCount === 0 ? 'hidden' : ''}>
     <StudentScheduleSection
       studentId={student.id}
       refreshKey={scheduleRefreshKey}
       onLoadedCount={setScheduleCount}
     />
   </div>
   ```
3. **Critério de aceitação:** quando o aluno não tem rotinas cadastradas, o card "Rotina atual" não aparece (zero pixels). Ao criar uma rotina (via outro fluxo) e voltar à tela, o card reaparece. Skeleton de loading continua visível enquanto `scheduleCount` é `null`.

**Armadilha:** não esconda preventivamente antes do load — isso quebraria a percepção de carregamento. Use `null` como estado inicial para "ainda não sei".

### Passo 3 — Próximos Programas só quando faz sentido

1. Em `student-detail-client.tsx`, o card "Próximos Programas" hoje é renderizado sempre (linhas ~436-579). Refatore para um componente local `<NextProgramsCard>` que decide internamente se aparece:
   - Aparece se: `scheduledPrograms.length > 0` (sempre) **OU** programa ativo `expired` **OU** progresso ≥ 75 %.
   - Caso contrário, retorna `null`.
2. Mantenha todo o conteúdo atual do card; só envelopa a renderização condicional.
3. **Critério de aceitação:** quando o programa ativo tem 50 % de progresso e a fila está vazia, o card some. Quando o progresso passa de 75 %, o card aparece automaticamente com a mensagem "Faltam N semanas! Prepare o próximo ciclo."

### Passo 4 — Tour opt-in

1. Em `student-detail-client.tsx`, troque:
   ```tsx
   <TourRunner tourId="student_detail" steps={TOUR_STEPS.student_detail} autoStart />
   ```
   por:
   ```tsx
   <TourRunner tourId="student_detail" steps={TOUR_STEPS.student_detail} autoStart={false} />
   ```
2. Em `student-header.tsx`, adicione um item "Tour rápido" no menu `MoreHorizontal` (ou um botão dedicado se houver espaço) que chama `useOnboardingStore.getState().startTour('student_detail')`.
3. **Critério de aceitação:** abrir a tela de aluno pela primeira vez NÃO dispara mais o tour automaticamente. Clicando em "Tour rápido" no menu, o tour inicia normalmente. Tour completo registra como `isTourCompleted` no store, igual hoje.

**Armadilha:** verificar se há outros lugares no código que dependem do auto-start (ex: testes e2e). `rg "tourId=\"student_detail\""` antes de mudar.

### Passo 5 — Histórico sem programas substituídos

1. Em `program-history-section.tsx`, identifique qual flag indica "Substituído". Pode ser `program.workouts_count === 0`, `program.sessions_count === 0`, ou um status específico — confirmar lendo o componente e a interface `CompletedProgram`.
2. Adicione filtro local:
   ```tsx
   const [showReplaced, setShowReplaced] = useState(false)
   const visiblePrograms = showReplaced
     ? programs
     : programs.filter(p => !(p.sessions_count === 0 && p.workouts_count === 0)) // ajustar regra
   const replacedCount = programs.length - visiblePrograms.length
   ```
3. Renderize um link discreto "Mostrar N substituídos" quando `replacedCount > 0`. Ao clicar, alterna o filtro.
4. **Critério de aceitação:** programas com 0 sessões e 0 workouts não aparecem por padrão. Link "Mostrar 3 substituídos" aparece quando relevante. Toggle preserva estado durante a sessão (não precisa persistir).

## 4. Testes obrigatórios

Crie/amplie em `__tests__/`:

- `student-header.test.tsx` (novo)
  - renderiza objetivo quando `student.objective` está presente.
  - renderiza tags quando `management_tags.length > 0`.
  - não renderiza nada extra quando ambos são `null`/`[]`.
  - dispara `useOnboardingStore.startTour` ao clicar em "Tour rápido".

- `program-history-section.test.tsx` (ampliar)
  - filtra programas com 0 sessões + 0 workouts por padrão.
  - mostra link "Mostrar N substituídos" com contagem correta.
  - ao clicar no link, todos aparecem.

- Smoke check em `student-detail-client.tsx` (sem teste novo, mas verifique que o `<NextProgramsCard>` retorna `null` no caso "<75 %, fila vazia").

Rode `pnpm test` (ou equivalente) e garanta que **nenhum teste existente quebra**. Em particular, `student-status-bar.test.tsx` e `body-metrics-trend.test.tsx` precisam continuar verdes.

## 5. Checklist final (rodar antes de abrir PR)

- [ ] `pnpm tsc --noEmit` (ou comando equivalente do projeto) verde.
- [ ] `pnpm test` verde.
- [ ] `pnpm lint` verde, se houver.
- [ ] Walk-through manual em `localhost:3000/students/<id>`:
  - aluno com `objective` e `management_tags` mostra ambos no header.
  - aluno sem rotina cadastrada não mostra o card "Rotina atual".
  - programa ativo em 50 %, fila vazia → "Próximos Programas" some.
  - tour não dispara automático; aciona pelo menu.
  - histórico esconde substituídos; toggle revela.
- [ ] Log de execução em `docs/specs/logs/dashboard-aluno-onda-1.md` com:
  - resumo do que foi feito (3-5 linhas).
  - screenshots do antes/depois para os 5 passos.
  - lista de "follow-ups sugeridos" (se houver).

## 6. Armadilhas conhecidas

- **`StudentScheduleSection`** é dynamic-imported (`next/dynamic`) com `ssr: false`. Garanta que a prop `onLoadedCount` seja serializável e o componente filho continue funcionando com SSR off.
- **`management_tags`** pode vir como string em alguns alunos legados (em vez de array). Defenda com `Array.isArray`.
- **`STAT_COLORS`** em `student-header.tsx` é tipado com `as const`. Adicionar tom novo exige ajuste do tipo `QuickStat['color']`. Se preferir, reuse `violet`.
- **Tour completion** é gravado no Zustand store com persistência local. Não reinicie o estado ao trocar `autoStart` — só mude o gatilho.
- **`isTrainerProfile`** alunos (treinador vendo o próprio perfil) não devem mostrar `Tour rápido`. Cheque o flag.
- **`scheduledPrograms[0]`** pode ser `undefined`; o cálculo de progresso usa `getProgramWeek` que pode retornar `null`. Cubra os edge cases.

## 7. Definição de pronto

- Todas as caixas do checklist da seção 5 marcadas.
- PR aberta apontando explicitamente para `dashboard-aluno-01-onda-1-quick-wins.md` na descrição.
- Log de execução commitado no mesmo PR (ou em commit anterior na mesma branch).
- Nenhuma das invariantes da seção 3 do `00-visao-geral` violada.
