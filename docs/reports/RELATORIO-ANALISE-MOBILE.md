# Análise Crítica — App Mobile Kinevo (Treinador + Aluno)

**Data:** 21/05/2026 · **Versão analisada:** 1.6.0 (build 1.1.6) · **Plataforma:** iOS (Simulador iPhone 17 Pro, iOS 26)

## Metodologia

- **Auditoria de código** das telas e fluxos do treinador, do aluno e de áreas transversais (auth, navegação, tema, estado global, rede, notificações).
- **Inspeção visual ao vivo** no simulador, navegando como **treinador** (logado) e **aluno** (via deep links), com screenshots de 15+ telas.
- Achados classificados: 🔴 **Crítico** · 🟡 **Médio** · 🔵 **Baixo/polish**. Cada item de código tem referência `arquivo:linha`.

> Observação geral de UI: o app está **visualmente bem construído e consistente** nas telas principais (dashboard, alunos, home do aluno, player de treino, financeiro). Os problemas mais graves são **funcionais/lógicos** (persistência, vazamento de dados entre contas, URLs erradas), não estéticos. O **dark mode**, porém, está parcialmente quebrado em muitas telas (cores hardcoded).

---

## 🔴 Falhas Críticas

### Lado Aluno — Player de Treino (maior risco do produto)

1. **Séries só são persistidas no fim do treino** — `hooks/useWorkoutSession.ts:306` (`persistSetLog` aborta se `!sessionId`). Com `deferSessionCreation` ligado, se o app fechar/crashar no meio do treino (academia, bateria), **perde-se o treino inteiro**. Não há gravação incremental garantida.
2. **`createSession` falha em silêncio** — `useWorkoutSession.ts:940-945` retorna `null` sem alertar quando `coach_id`/`assigned_program_id` não resolvem; o aluno treina uma "sessão fantasma" e só descobre o erro ao tentar finalizar.
3. **Zero tratamento offline** — `useWorkoutSession.ts:365,658`. Sem internet, o treino **nem abre** (`Alert "Falha ao carregar"`). Crítico para um app usado em academia. Existe `sync_status` no schema, mas é sempre setado como `'synced'`.
4. **`finishWorkout` retorna `undefined` tratado como falha** — `useWorkoutSession.ts:993` + `app/workout/[id].tsx:528`. Em early-return o aluno fica preso na tela "sem finalizar", sem mensagem de erro nem navegação.

### Lado Aluno — Chat

5. **🔴 Mensagens de imagem renderizam como blocos roxos vazios** *(confirmado visualmente)* — na tela de Mensagens do aluno, mensagens antigas de imagem aparecem como **retângulos roxos grandes e vazios**, sem conteúdo. O envio de imagem está desabilitado no código (`components/chat/ChatView.tsx:427` — `TODO: Re-enable image upload after fixing RN XMLHttpRequest/FormData issue`), e as imagens já enviadas não exibem. Quebra visível para o usuário.

### Transversal — Vazamento de dados entre contas (mesmo aparelho)

6. **Cache MMKV não é escopado por usuário nem limpo no logout** — `lib/cache-keys.ts:2-6` usa chaves globais (`cache:dashboard:stats`, `cache:students:list`); `lib/cache.ts:65 clearAllCache()` **nunca é chamado** no logout. Ao trocar de conta no mesmo device, o treinador B vê **dashboard e lista de alunos (PII)** do treinador A até a revalidação. **Risco de privacidade.**
7. **`signOut` não reseta stores Zustand** — `contexts/AuthContext.tsx:111-123`. `notification-store`, rascunhos de programa, training-room e assessment drafts (todos persistidos em MMKV) **vazam entre contas** no mesmo aparelho.

### Transversal — Dados gravados com ID errado

8. **`trainer_id` errado ao persistir notificação** — `hooks/usePushNotifications.ts:144-151` insere `auth.uid` em `trainer_notifications.trainer_id`, mas o resto do app usa `trainers.id`. Provável violação de RLS / linha órfã → notificações do treinador não são contadas/lidas.
9. **Update de e-mail do aluno usa coluna inexistente** — `app/(auth)/verify-email.tsx:90-93` filtra `students` por `user_id` (todo o resto usa `auth_user_id`). O `UPDATE` não afeta linha nenhuma → e-mail dessincroniza entre Auth e tabela `students` (falha silenciosa).

### Lado Treinador — Fluxos quebrados / receita

10. **URLs de backend hardcoded e divergentes do `.env`** — `app/(trainer-tabs)/more.tsx:40` (`https://app.kinevo.com.br`) e `app/trainer-subscription-blocked.tsx:10` (`/subscription`). O `.env` usa `https://www.kinevoapp.com`. Os fallbacks no app (`app.kinevo.com.br`) **não batem** com o domínio real → **portal de assinatura e fluxo de conversão (assinar) provavelmente quebrados**. Crítico para receita.
11. **Botão "Remover supersets" não faz nada** — `app/program-builder/index.tsx:201`. No alerta `SUPERSET_BLOCKED` a opção "Remover supersets" não tem `onPress`: o treinador acha que removeu, mas o programa continua igual.
12. **"Gerar link de pagamento" passa `contract_id` como `planId`** — `app/financial/contract/[id].tsx:141-148` (com TODO admitindo que não tem o `plan_id`). O endpoint de checkout rejeita → ação Stripe legada quebrada.
13. **"Sala de Treino" no perfil do aluno não adiciona o aluno** — `app/student/[id]/index.tsx:77-100`. O comentário diz que o picker "vai cuidar", mas a training-room abre **vazia**; o treinador precisa re-selecionar o mesmo aluno manualmente. Fluxo contra-intuitivo.

---

## 🟡 Problemas Médios

### Aluno
- **Race no timer de descanso em superset com séries desiguais** — `app/workout/[id].tsx:74-77`: compara índice de rodada de um exercício com `setsData` de todos do grupo; timer pode disparar na rodada errada.
- **Deep-clone (`JSON.parse(JSON.stringify)`) a cada tecla digitada** — `useWorkoutSession.ts:677`. Lag de digitação de peso/reps em treinos grandes (superset/drop-set), pior no Android.
- **`KeyboardAvoidingView behavior="padding"` incondicional** — `app/workout/[id].tsx:715`. No Android o input de peso/reps pode ficar coberto pelo teclado (deveria ser `Platform.OS === 'ios' ? 'padding' : undefined`).
- **`onWeekChange={() => {}}` vazio** — `app/(tabs)/home.tsx:389`: handler sugerindo lógica esquecida.
- **`volume: 0` hardcoded no share da Home** — `home.tsx:110`: o card compartilhado a partir da Home mostra volume zerado (diferente do gerado no fim do treino).
- **Stats do hero do Perfil são placeholders** *(confirmado visualmente)* — `app/(tabs)/profile.tsx:223`: o perfil do aluno mostra "Aluno (PLANO) / Ativo (STATUS) / Gustavo (TREINADOR)" em vez de métricas de jornada (treinos/volume/streak). Marcado no código como "placeholder até Fase 7".

### Treinador
- **Pull-to-refresh de Mensagens nunca mostra spinner** — `app/(trainer-tabs)/messages.tsx:209` (`refreshing={false}`): usa skeleton-flicker em vez do refresh sutil.
- **Realtime de conversas sem filtro server-side + re-subscribe instável** — `hooks/useTrainerConversations.ts:148,201`: assina todos os INSERTs de `messages` e filtra no cliente; não escala e pode perder eventos.
- **Taxas financeiras hardcoded** — `app/financial/settings.tsx:18-22`: espelham o web manualmente ("atualizar lá e aqui juntos"). Risco de mostrar taxa diferente da cobrada (já sinalizado como "a calibrar").
- **`syncWallet` engole erro em silêncio** — `app/financial/settings.tsx:51` (`catch { /* silencioso */ }`): sem feedback de falha.
- **Feed financeiro cortado em 15 sem paginação** — `app/financial/index.tsx:74-79`: cobranças pendentes além das 15 mais recentes somem da visão.

### Transversal
- **Gate de assinatura não é reativo** — só roda em `app/index.tsx`/`role-select.tsx`, não no `app/(trainer-tabs)/_layout.tsx`. Se a assinatura expira com o treinador dentro do app, ele continua no modo treinador até reabrir.
- **Erros do Supabase exibidos em inglês** — `app/(auth)/login.tsx:50`, `verify-email.tsx:85`, `workout/[id].tsx:637`: "Invalid login credentials" etc. cru para o usuário.
- **Domínio de fallback divergente para push** — `hooks/usePushNotifications.ts:10` (`app.kinevo.com.br`) vs resto (`www.kinevoapp.com`).
- **Uso massivo de `as any` contornando os tipos do banco** — `useProgramBuilder.ts` (~32), `useWorkoutSession.ts` (~28) e ~30 arquivos. Viola a regra do CLAUDE.md e **mascara exatamente os bugs de coluna/id** dos itens 8 e 9.

---

## 🔵 Polish / Layout

### Achados visuais (confirmados ao vivo)
- **Capitalização de datas inconsistente entre telas** — Home do aluno mostra `quinta-feira, 21 de maio` (correto), mas **Saúde** mostra `Quinta-Feira, 21 De Maio` e o **calendário do detalhe do aluno** mostra `Maio De 2026` (Title Case, com "De" capitalizado — incorreto em PT). Padronizar o formatador de datas.
- **Botão "Novo agendamento" quase invisível** — tela **Agenda**: texto branco/baixo contraste sobre fundo claro no empty state.
- **FAB "+" inconsistente** — na **Agenda** o "+" fica no canto **inferior esquerdo**; em **Exercícios** fica à **direita** (convenção). Padronizar.
- **Texto em inglês no Financeiro** — atividade recente mostra `Pagamento automático — 1 × Teste (at R$ 1.00 / month)` (descrição de plano em inglês no meio da UI PT).
- **Unidade de volume inconsistente** — Histórico mostra `29.8t` (resumo) e `8.7 ton` (cards). Unificar.
- **Hierarquia de abas densa em Formulários** — 3 níveis aninhados (Formulários/Avaliações → Respostas/Templates → Todas/Pendentes/Concluídas). Avaliar simplificação.
- **Emoji como ícone** *(viola regra explícita do CLAUDE.md "Lucide exclusivamente, nunca emoji")* — badges de streak/intensidade usam 🔥 (`home.tsx:673-688`, histórico, KStreakBadge no showcase), e insights de saúde usam 📅.
- **"Google Health Connect" listado como fonte no iOS** — tela Saúde mostra Health Connect (exclusivo Android) como fonte conectável num device iOS; falta checagem de plataforma.
- **Card de conquista sempre `locked`** — `home.tsx:688`: terceiro AchievementCard nunca desbloqueia (feature pela metade).

### Dark mode (cores hardcoded, vários arquivos)
- Telas "antigas" (`training-room.tsx`, `student/[id]/index.tsx`, `financial/*`, `forms.tsx`, `logs.tsx`, player de treino) usam dezenas de hex literais (`#7c3aed`, `#10b981`, `#f1f5f9`, `rgba(0,0,0,0.40)`…) em vez dos tokens `useV2Colors()`. No dark mode haverá contraste quebrado (ex.: `workout/[id].tsx:832` label de seção preto sobre fundo escuro).
- Telas globais ignoram o tema: `app/index.tsx:84` (`#111019`), `app/role-select.tsx:29` (`#F2F2F7` + status bar dark sempre), `contexts/AuthContext.tsx:133-177` (splash fixo). Cor de marca também diverge: `#a855f7`/`#A78BFA` em telas de auth vs `#7c3aed` do design system.

### Limpeza para produção
- **WhatsApp de suporte com número placeholder** — `app/profile/support.tsx:6` (`TODO: Substituir pelo número real`). O "Ajuda via WhatsApp" do aluno e do treinador aponta para placeholder.
- **`console.error/warn` não-guardados (21×)** fora de `__DEV__` (ex.: `usePushNotifications.ts`, `report/[id].tsx`).
- **Rota `/debug-logs` navegável** — verificar gate em produção.
- **`app_version: "1.0.0"` hardcoded** — `app/inbox/[id].tsx:316` (deveria usar `Constants.expoConfig?.version`).
- **Fallback de `is_trainer` joga treinador para modo aluno** — `contexts/RoleModeContext.tsx:135-137`: erro de rede no boot trata treinador como aluno até refazer o fluxo.

---

## Top 10 — Prioridades recomendadas

| # | Prioridade | Severidade | Onde |
|---|-----------|-----------|------|
| 1 | Persistência incremental + offline do player de treino (perda de treino) | 🔴 | `useWorkoutSession.ts` |
| 2 | Vazamento de dados entre contas (cache MMKV + stores não limpos no logout) | 🔴 | `lib/cache.ts`, `AuthContext.tsx` |
| 3 | URLs de backend erradas (portal de assinatura/conversão quebrados) | 🔴 | `more.tsx:40`, `trainer-subscription-blocked.tsx:10` |
| 4 | Mensagens de imagem renderizam como blocos vazios + upload desabilitado | 🔴 | `ChatView.tsx:427` |
| 5 | IDs errados gravados (notificações `trainer_id`; e-mail do aluno) | 🔴 | `usePushNotifications.ts:145`, `verify-email.tsx:93` |
| 6 | `createSession`/`finishWorkout` falham em silêncio (aluno preso/sessão fantasma) | 🔴 | `useWorkoutSession.ts:940,993` |
| 7 | Botões mortos: "Remover supersets" e "Gerar link de pagamento" | 🔴/🟡 | `program-builder/index.tsx:201`, `financial/contract/[id].tsx:147` |
| 8 | Gate de assinatura reativo no layout do treinador | 🟡 | `(trainer-tabs)/_layout.tsx` |
| 9 | Dark mode: migrar cores hardcoded para tokens `useV2Colors` | 🟡/🔵 | múltiplos |
| 10 | Polish PT-BR: datas, contraste do botão Agenda, unidades, textos em inglês, emojis | 🔵 | múltiplos |

---

## Telas inspecionadas visualmente

**Treinador (9):** Dashboard · Alunos (lista) · Detalhe do aluno · Program Builder · Financeiro · Exercícios · Agenda · Formulários · Mais — todas com layout limpo e consistente.

**Aluno (6):** Home · Histórico · Saúde · Perfil · Mensagens (bug das imagens) · Player de treino — design polido; player e home especialmente bem feitos.

> Nota de processo: ao abrir o player via deep link foi criada uma `workout_session` `in_progress` de teste na conta real — **removida em seguida** para não poluir os dados.
