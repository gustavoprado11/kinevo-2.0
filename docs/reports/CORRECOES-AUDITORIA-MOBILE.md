# Correções da Auditoria — Mobile (branch `fix/auditoria-mobile-2026-05`)

Status: **16/16 tarefas endereçadas.** Mobile `tsc` = 12 erros (baseline pré-existente, **0 novos**), **277/277 testes** passando, web `tsc` = 0. Nada commitado (aguarda autorização).

## 🔴 Críticos

1. **URLs de backend centralizadas** — novo `mobile/lib/config.ts` (`WEB_URL`, sempre `www.kinevoapp.com`). Corrigido domínio divergente `app.kinevo.com.br` em ~13 arquivos; `more.tsx`, `trainer-subscription-blocked.tsx`, `StripeStatusCard.tsx` agora usam o env. Destrava portal de assinatura/conversão.
2. **IDs gravados errados** — `usePushNotifications` resolve `trainers.id` (não auth.uid) em `trainer_notifications`; `verify-email` usa `auth_user_id` (não `user_id`) ao sincronizar e-mail do aluno.
3. **Botões mortos** — "Remover supersets" agora desfaz supersets (nova ação `clearSupersets` no store) e re-salva; "Gerar link de pagamento" resolve o `plan_id` real do contrato.
4. **Vazamento de dados no logout** — novo `lib/logout-cleanup.ts` chamado no `signOut`: limpa cache MMKV + reseta stores (notificações, sala de treino, program-builder, drafts). Fim do vazamento de dashboard/alunos (PII) entre contas no mesmo aparelho.
5. **Player — perda de treino** — `persistSetLog` cria a sessão preguiçosamente (séries sempre persistem); `createSession` com dedupe de criação concorrente; mensagem de retry clara em falha de finalização (offline).
6. **Player — falhas silenciosas** — `createSession` falho agora avisa o aluno e permite retry (sem "sessão fantasma"); `finishWorkout` sem usuário não deixa mais o aluno preso em silêncio.
7. **Chat — upload de imagem reabilitado** — troca FormData/XHR (bugado no RN) por `expo-file-system` `File().bytes()` + `supabase.storage`. Botão de imagem reativado. *(Precisa smoke-test em device.)*

## 🟡 Médios

8. **Gate de assinatura reativo** — `(trainer-tabs)/_layout.tsx` redireciona pra `blocked` quando a assinatura expira (+ revalida no foreground via AppState).
9. **Realtime de conversas** — filtro server-side (`student_id=in.(...)`) e re-subscribe estável (chave memoizada).
10. **Player — performance** — `handleSetChange` sem deep-clone por tecla (update imutável raso); `KeyboardAvoidingView` condicional por plataforma (Android).
11. **Sala de Treino do detalhe do aluno** — abre o picker já com o aluno pré-selecionado (param `studentId` + `initialStudentId`).
12. **Taxas Asaas centralizadas** — `shared/lib/asaas/fees.ts` é a fonte única; web e mobile importam de lá (re-export no web).
13. **UX** — pull-to-refresh de Mensagens com spinner real (`isRefreshing`); `syncWallet` com feedback de erro; feed financeiro com "Ver mais" (paginação); erros do Supabase traduzidos pra PT-BR (`lib/auth-errors.ts`).

## 🔵 Polish / Limpeza

14. **Datas** — sentence case consistente (Saúde, calendário do detalhe) — fim de "Maio De 2026"/"Quinta-Feira".
15. **Emojis → Lucide** — `AchievementCard` (Flame/Dumbbell/Star), KStreakBadge (Flame animado), "Continue assim". Card de conquista "rumo a marco" agora desbloqueia no marco.
16. **Unidade de volume** unificada ("t"); **Health Connect** filtrado por plataforma (não aparece no iOS).
17. **Produção** — `signOut`/`is_trainer` não rebaixa treinador por erro de rede; rota `/debug-logs` bloqueada fora de `__DEV__`; `app_version` dinâmica; TODO de suporte removido (número já era real); `console.error` gateados em telas-chave.

## 🔴 Bug sistêmico de UI corrigido (Agenda) — reportado pelo Gustavo

**Causa raiz:** `Pressable` com `style` como **função que retorna um objeto literal inline** (`({ pressed }) => ({ backgroundColor: ... })`) NÃO pinta o `backgroundColor` neste build (RN 0.81/Fabric). Componentes que usam `TouchableOpacity`/`PressableScale`/`View` com estilo estático, ou função retornando **referências de StyleSheet**, renderizam normal — por isso só a feature de Agenda (que abusava do padrão inline) quebrou.

**Sintomas corrigidos:** botão "Novo agendamento" invisível (texto branco sem pill); "60 min" sumindo no modal (selecionado roxo invisível); chevrons de dia sem fundo; FAB sem círculo roxo e na posição errada; cards de data/horário/recorrência sem destaque de seleção.

**Correção:** convertidos para estilo estático / `PressableScale` em `AgendaDayView`, `agenda/index.tsx` (FAB), `CreateAppointmentSheet`, `AppointmentDetailSheet`, `AppointmentCard`, `EditScopeDialog` e `notification-settings.tsx` (seletor de lembrete, mesmo padrão). Verificado visualmente no simulador: agenda e modal agora consistentes com o app.

## Não eram bugs (verificado)

- **Texto inglês no financeiro** ("at R$ 1.00/month") é **dado** (nome de um plano de teste), não código.
- **Bolhas roxas vazias no chat**: bucket `messages` é público e a renderização tem fallback correto — foi hiccup de rede do simulador, não bug de código.
- **Splash dark** (index/AuthContext): é a tela de marca, intencionalmente escura.

## Follow-ups recomendados (não feitos — exigem device/QA ou decisão)

- **Fila offline-first do player** (cache local + sync) — feature maior; hoje há persistência incremental + retry, mas não fila para treino 100% offline.
- **Smoke-test do upload de imagem no chat** em device real.
- **Migração ampla de dark mode** nas telas legadas (training-room, financial/*, forms, logs, student/[id]) — dezenas de hex; precisa QA visual por tela em ambos os modos. Os casos de texto invisível/inversão confirmados já foram corrigidos.
- **Emojis nos insights de saúde** (📅 etc.) — são modelo de dados em `lib/healthInsights/rules.ts`; converter exige refatorar o sistema de insights (decisão de design).
- **Taxas de cartão/boleto** ("a calibrar") — valores ainda estimados; calibrar com dados reais via `/api/diagnostic/asaas-fees`.
