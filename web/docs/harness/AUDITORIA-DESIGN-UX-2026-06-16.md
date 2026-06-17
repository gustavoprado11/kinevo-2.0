# Auditoria de Design, UX e Produto — Modo Assistente (Kinevo)

**Data:** 2026-06-16
**Escopo:** Experiência do treinador na ponta (aba `/assistente`, ⌘K, HITL, créditos, voz, proativo).
**Fora de escopo (Aba 1):** harness, backend, segurança, prontidão técnica. Não repetido aqui.
**Método:** leitura read-only de `web/src/components/assistant/*`, `web/src/app/assistente/*`, rotas `api/assistant/*`, command-palette, notification-bell, cron de briefing. Nenhum código alterado além deste relatório.

---

## 1. Sumário executivo

O Modo Assistente está **visualmente lançável, mas funcionalmente NÃO** — falta o "tecido de estados" que separa um protótipo bonito de um produto. A camada de apresentação (home, conversa, sidebar, card HITL, medidor) é coesa, on-brand e bem-acabada. O problema é o que acontece **quando algo dá errado ou está vazio**: a aba dedicada (`/assistente`) engole silenciosamente *todos* os erros de API (cota esgotada, rate-limit, validação, rede, 500) — o usuário envia, a bolha some e nada acontece, sem nenhuma explicação. Isso, sozinho, é um bloqueador de lançamento.

Além disso, dois dos cinco "pilares" anunciados estão incompletos na ponta: **voz** tem backend pronto (`/api/assistant/voice`) mas **zero UI** (nenhum botão de microfone em lugar nenhum), e o **proativo** (briefing diário) chega como notificação que **não tem para onde levar** e cujo texto é **truncado em uma linha** — não há onde ler o briefing completo dentro do app.

Contraste revelador: o **⌘K** (CommandBar) trata erros e cota com banner e degradação para GUI — é a superfície madura. A **aba dedicada**, que é a vitrine do modo, regrediu nesse ponto. A correção é majoritariamente reusar o que o ⌘K já faz.

**Veredito:** **Não lançável** sem resolver os 🔴 (tratamento de erro/cota na aba) e decidir o destino de voz/proativo (shipar UI mínima ou descopar da comunicação de lançamento).

---

## 2. Top 5 problemas de experiência

1. **A aba `/assistente` engole todos os erros em silêncio.** `send()` faz `if (!res.ok) return` sem mostrar nada (`assistant-workspace.tsx:146-149`). Cota esgotada, rate-limit, falha de rede → bolha some, fim. O usuário não sabe se quebrou, se ele errou, ou se acabou a cota.
2. **Cota esgotada (402) na aba é um beco sem saída.** O input continua habilitado, não há banner "créditos acabaram" nem CTA de upgrade. O medidor mostra vermelho, mas o envio falha mudo. (O ⌘K faz certo; a aba, não.)
3. **Voz é vaporware na ponta.** `/api/assistant/voice` existe e transcreve, mas nenhum componente o consome — não há gravador, microfone ou feedback de transcrição. O pilar "voz" não existe para o usuário.
4. **O briefing proativo não tem onde ser lido nem para onde levar.** A notificação `assistant_briefing` não tem handler de clique (`notification-bell.tsx:241` só trata `student_message`), o corpo é truncado a uma linha (`:268-270`), e a aba do Assistente não tem sino de notificação. O resumo do dia chega e morre.
5. **Sem primeira-execução / estado vazio guiado.** Um treinador novo (0 alunos) cai numa home que o convida a "escolher um aluno" inexistente, sem explicação do que o Assistente faz, sem tour, sem placeholder de "comece criando um aluno".

---

## 3. Achados por severidade

### 🔴 Críticos (bloqueiam lançamento)

**🔴-1 — Erros de turno na aba são silenciosos**
`web/src/components/assistant/workspace/assistant-workspace.tsx:145-149`
```ts
const data = await res.json().catch(() => ({}))
if (!res.ok) {
    setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    return   // ← nenhum banner, toast ou mensagem
}
```
**Impacto:** todo 402/429/422/500/erro de rede vira "não aconteceu nada". O usuário reenvia, acha que o app travou, perde confiança no agente justamente no momento de falha.
**Sugestão:** replicar o padrão do `CommandBar` — estado `banner`/`error` exibido no stream (ou um toast), lendo `data.message` (as rotas já devolvem mensagens PT amigáveis: `quota_exceeded`, `rate_limited`, `validation_failed`). Para 402, banner com CTA "Ver planos".

**🔴-2 — Cota esgotada sem feedback nem upgrade na aba**
`assistant-workspace.tsx:112-166` (não inspeciona `summary.exhausted`); `conversation-view.tsx:98-109` (input nunca desabilitado por cota).
**Impacto:** o usuário Pro that esgotou créditos digita, envia e nada acontece — sem caminho de saída (upgrade) nem explicação ("renova em X dias").
**Sugestão:** quando `summary.exhausted`, mostrar banner persistente (reusar a copy do ⌘K em `command-bar.tsx:276-278`) + botão de upgrade; opcionalmente desabilitar o composer com placeholder "Créditos esgotados — renova em N dias".

**🔴-3 — Aba do Assistente sem responsividade mobile**
`assistant-workspace.tsx:190` (`flex h-[100dvh]` com `AssistantSidebar` `w-64` fixa + main) — sem breakpoint, sem colapso automático, sem drawer.
**Impacto:** em telas estreitas a sidebar de 256px + área de chat ficam espremidas; como **não há assistente no mobile** (`mobile/` não tem UI de assistente), a web é o único acesso e quebra no celular/tablet retrato.
**Sugestão:** colapsar a sidebar abaixo de `md`, ou esconder atrás de um toggle. No mínimo, validar a home/conversa em 390px de largura antes do lançamento. **Pergunta aberta:** o lançamento inclui mobile, ou é desktop-only assumido?

### 🟠 Importantes (degradam muito a experiência)

**🟠-4 — Voz: backend sem UI**
`web/src/app/api/assistant/voice/route.ts` existe; nenhum consumidor em `src/components`/`src/app`.
**Impacto:** funcionalidade anunciada que o usuário não consegue acionar; feedback de transcrição inexistente.
**Sugestão:** ou (a) botão de microfone no composer (home + conversa) com gravação, estado "ouvindo/transcrevendo", e exibição do `transcript` antes do turno; ou (b) descopar voz da mensagem de lançamento até a UI existir. Decisão de produto.

**🟠-5 — Briefing proativo sem destino nem leitura completa**
`notification-bell.tsx:239-247` (sem case para `assistant_briefing`); `:268-270` (`truncate`); a aba `/assistente` (`app/assistente/page.tsx`) não renderiza o `AppLayout`, logo **não tem sino**.
**Impacto:** o resumo do dia chega (push + sino do dashboard), mas clicar não leva a lugar nenhum e só dá pra ler a primeira linha. Push manda `data.screen:'assistant'` (`cron/morning-briefing/route.ts:74`) para um screen mobile que não existe.
**Sugestão:** (1) handler de clique que abre `/assistente` (ou um modal com o texto completo); (2) expandir o corpo no sino para briefings; (3) idealmente, uma seção "Resumo do dia" na home do Assistente, ao lado de "Precisa de atenção".

**🟠-6 — Card HITL: alvo ("em QUEM") não garantido e nome interno vazado**
`tool-confirmation-card.tsx:99-104` mostra `request.title` + `request.summary` + **`request.toolName` cru** (ex.: `kinevo_send_message`) num `<code>` violeta.
**Impacto:** o "o quê" depende inteiramente do `summary` vir bom do motor; o `toolName` técnico polui a confirmação e não significa nada para o treinador. Em "enviar mensagem para Maria", o nome legível precisa estar garantido no `summary`.
**Sugestão:** remover/ocultar o `toolName` da UI do usuário (ou trocar por um rótulo humano via mapa, como o `EXECUTED_LABEL` já existente); garantir que o nome do aluno-alvo apareça em destaque no card. **Pergunta aberta:** o `summary` sempre inclui o nome legível do alvo? (verificar no motor — fora do escopo de UI).

**🟠-7 — Chips de ação executada no ⌘K mostram nome técnico**
`command-bar/action-preview.tsx:64-70` renderiza `{e.toolName}` cru.
**Impacto:** "kinevo_assign_program" como selo de sucesso é hostil. A `conversation-view.tsx:21-35` já tem `EXECUTED_LABEL` com rótulos humanos — não reusado aqui.
**Sugestão:** extrair `EXECUTED_LABEL`/`executedText` para `ui-util` e reusar no `action-preview`.

**🟠-8 — "Aluno em foco" é no-op invisível quando a sidebar está colapsada**
`assistant-home.tsx:118-120` → `onPickFocus` → `assistant-workspace.tsx:237` faz `setSegment('alunos')` no rail. Se `isCollapsed` (sidebar-store), o rail não está visível: clicar não mostra nada.
**Impacto:** o seletor de contexto mais importante (Geral vs aluno) parece quebrado para quem usa a sidebar recolhida.
**Sugestão:** expandir a sidebar ao clicar em "Aluno em foco", ou abrir um popover/combobox de alunos ancorado no próprio chip (autossuficiente, não dependente do rail).

**🟠-9 — Home sem onboarding/estado vazio para treinador novo**
`assistant-home.tsx` — "Precisa de atenção" e "Conversas recentes" somem quando vazios (bom), mas não há substituto guiado; o placeholder do composer convida a "escolher um aluno" mesmo com 0 alunos (`:95`).
**Impacto:** primeira impressão fria; o treinador não entende o que pode pedir além dos 4 starters.
**Sugestão:** estado de boas-vindas explícito na 1ª vez (o que o Assistente faz + 1-2 exemplos clicáveis "de verdade"); se 0 alunos, CTA "Crie seu primeiro aluno" em vez do chip de foco.

### 🟡 Menores (polimento)

**🟡-10 — Formatação de créditos inconsistente.** Home usa `toLocaleString('pt-BR')` → "1.000" (`assistant-home.tsx:129`); `credit-meter.tsx:67,109` usa número cru → "1000". Padronizar para milhar PT-BR em todas as superfícies.

**🟡-11 — `assistant_briefing` sem ícone/cor próprios.** `notification-bell.tsx:20-39` não mapeia o tipo → cai no `Bell` cinza genérico. Adicionar ícone (Sparkles) + cor violeta on-brand.

**🟡-12 — Sem dark mode na superfície do Assistente.** Todo o modo é hardcoded claro (`#F5F5F7`, `#1D1D1F`); só `assistant-launcher.tsx` tem classes `dark:`. O app suporta `next-themes` — usuário em dark vê a aba "estourada" em branco. (Pode ser decisão consciente da Shield Strategy, mas é inconsistência visível.) **Pergunta aberta:** dark mode é requisito de lançamento para o Assistente?

**🟡-13 — Acessibilidade do stream.** O fluxo de mensagens e o `TypingRow` (`conversation-view.tsx:183-195`) não têm `aria-live`/texto acessível — leitor de tela não anuncia respostas nem "pensando". Cards HITL e chips não têm `role`. Adicionar `aria-live="polite"` na região do stream e label no indicador de digitação.

**🟡-14 — Sem cancelar/abortar turno.** Durante `sending` não há botão de parar (`conversation-view.tsx:106-109` só desabilita). Em turno longo, o usuário fica preso. Considerar `AbortController` + botão "Parar".

**🟡-15 — Hidratação de saudação/horários.** `greeting()`/`timeShort()` (`ui-util.ts:39-53`) usam `new Date()` em componente client renderizado também no server-data — risco de flash/diferença. Baixo impacto; vigiar.

**🟡-16 — Drift de copy no card HITL.** Comentário do componente diz botões "Revisar / Confirmar" (`tool-confirmation-card.tsx:9`), mas a UI usa "Cancelar / Confirmar ↵". Alinhar doc↔UI (e considerar se "Revisar" — que não fecha o card — seria melhor que "Cancelar").

### 🟢 Bom (manter)

- **🟢** Card HITL distingue ação destrutiva (vermelho + AlertTriangle + selo "Ação destrutiva") de normal — claro e seguro (`tool-confirmation-card.tsx:76-116`).
- **🟢** Estados de loading bem cobertos: skeleton instantâneo na troca de modo (`loading.tsx`), spinner ao reabrir thread (`conversation-view.tsx:85`), typing dots ao enviar.
- **🟢** Medidor de créditos com cor progressiva (violeta→âmbar>80%→vermelho esgotado) e copy contextual por tier/renovação (`credit-meter.tsx:49-61`).
- **🟢** "Precisa de atenção" é acionável: cada card dispara um turno pré-preenchido com contexto do aluno (`assistant-home.tsx:146,150`).
- **🟢** Rail com estados vazios próprios ("Nenhum aluno." / "Nenhuma conversa ainda.") e agrupamento temporal de conversas.
- **🟢** ⌘K com degradação para GUI em cota esgotada + banner — exatamente o padrão que falta na aba.

---

## 4. Matriz de estados × tela

| Estado | Home (aba) | Conversa (aba) | ⌘K (CommandBar) | Card HITL | Sino/Briefing |
|---|---|---|---|---|---|
| Loading | ✅ skeleton | ✅ spinner/typing | ✅ spinner input | ✅ "Executando…" | n/a |
| Vazio (sem alunos) | ⚠️ parcial (sem guia) | n/a | ✅ sugestões | n/a | n/a |
| Vazio (sem conversas) | ✅ oculta seção | n/a | n/a | n/a | ✅ "vazio" |
| Erro de rede | ❌ silencioso | ❌ silencioso | ✅ banner | ✅ "Falha de conexão" | n/a |
| 402 cota esgotada | ❌ silencioso | ❌ silencioso | ✅ banner+degrada | ✅ errorMsg | n/a |
| 429 rate-limit | ❌ silencioso | ❌ silencioso | ✅ banner (message) | ✅ errorMsg | n/a |
| 422 validação | n/a (turno não 422) | n/a | ✅ banner | ✅ errorMsg | n/a |
| Tier sem acesso | ✅ redirect /settings (abrupto) | n/a | ✅ não monta | n/a | n/a |
| Briefing recebido | ❌ não aparece na aba | n/a | n/a | n/a | ⚠️ truncado, sem clique |

Legenda: ✅ ok · ⚠️ parcial · ❌ ausente/quebrado.

---

## 5. Quick wins (alto impacto, baixo esforço — para amanhã)

1. **Banner de erro/cota na aba** (resolve 🔴-1 e 🔴-2): portar o estado `banner`/`exhausted` do `command-bar.tsx` para `assistant-workspace.tsx`, lendo `data.message`. ~1 componente + 1 estado. **Maior ROI do dia.**
2. **Reusar `EXECUTED_LABEL` no ⌘K** (🟠-7): mover `executedText` para `ui-util` e usar em `action-preview.tsx`. ~10 linhas.
3. **Ocultar `toolName` cru do card HITL** (🟠-6): remover o `<code>` ou trocar por rótulo humano. ~3 linhas.
4. **Handler de clique + corpo expandido para `assistant_briefing` no sino** (🟠-5 parcial / 🟡-11): adicionar case que abre `/assistente`, ícone Sparkles, remover `truncate` para esse tipo. ~15 linhas.
5. **Padronizar formatação de créditos** (🟡-10): `toLocaleString('pt-BR')` no `credit-meter.tsx`. ~2 linhas.
6. **`aria-live` no stream + label no typing** (🟡-13): acessibilidade básica. ~3 linhas.
7. **CTA "Crie seu primeiro aluno" quando 0 alunos** (🟠-9 parcial): condicional na home. ~10 linhas.

---

## 6. Resultados dos loops de verificação

**Loop de percurso (2×):**
- 1ª passada (comando→ação / HITL / conversa): os 3 fluxos felizes funcionam e são legíveis. Mensagem otimista, typing, resposta com chips de ação e card de confirmação aparecem na ordem certa.
- 2ª passada ("o que o usuário NÃO consegue"): o caminho infeliz é o buraco. Na aba dedicada não há **nenhum** feedback de falha (🔴-1/2); o seletor de contexto colapsado é no-op (🠒8); voz não tem ponto de partida (🠒4); o briefing não tem destino (🠒5). Becos sem saída concentrados em erro, voz e proativo.

**Loop de estados (retornos das rotas):** mapeados 401/403(tier_locked)/402(quota_exceeded)/429(rate_limited)/422(validation_failed)/400/500/502(transcription). Tratamento visual: **⌘K e card HITL cobrem; a aba dedicada cobre só o caminho feliz.** Ver matriz §4 — coluna "Conversa/Home (aba)" é majoritariamente ❌ para erros.

**Loop de red-team (derrubando as próprias conclusões):**
- Rebaixei "voz ausente" de 🔴 para 🟠: é grave, mas é decisão de produto descopar (não quebra nada existente) — não é bloqueador *técnico*, é de mensagem de lançamento.
- Mantive responsividade mobile em 🔴 porque, sem assistente no app mobile, a web é o único canal e quebra fora do desktop — a menos que o lançamento seja explicitamente desktop-only (pergunta aberta registrada).
- Promovi "erros silenciosos" a 🔴-1 com confiança: confirmado em código que `send()` e `recordConfirmation()` não têm caminho de erro visível; o ⌘K provando que o padrão certo já existe no repo torna a omissão na vitrine mais grave, não menos.
- Dark mode e hidratação ficaram em 🟡: podem ser decisões conscientes (Shield Strategy / desktop claro) — registrados como perguntas abertas, não defeitos assumidos.

**Perguntas abertas (não viraram suposição):**
1. O lançamento inclui mobile/responsivo, ou é desktop-only? (define severidade de 🔴-3)
2. O `summary` do card HITL sempre traz o nome legível do aluno-alvo? (verificar no motor)
3. Dark mode é requisito para o Assistente no lançamento?
4. Voz entra no lançamento (precisa de UI) ou é pós-lançamento (descopar da comunicação)?

---

## 7. Resumo final (8 linhas)

1. **Lançável?** Não ainda — a camada visual está pronta, a de estados não.
2. A vitrine (aba `/assistente`) engole erros e cota em silêncio; o ⌘K, mais maduro, mostra o caminho.
3. **Top 3 problemas:** (a) erros/cota silenciosos na aba; (b) voz sem UI; (c) briefing proativo sem onde ler nem para onde clicar.
4. Riscos secundários: sem responsividade mobile, "aluno em foco" no-op colapsado, `toolName` técnico vazado no HITL.
5. **Top 3 quick wins:** (a) portar o banner de erro/cota do ⌘K para a aba; (b) reusar rótulos humanos de ação (`EXECUTED_LABEL`); (c) dar clique+texto completo ao briefing no sino.
6. A maioria das correções é **reuso** do que já existe no repo, não construção nova.
7. Perguntas abertas a resolver com produto: mobile, dark mode, escopo de voz, garantia de nome-alvo no HITL.
8. Com os 🔴 resolvidos e voz/proativo decididos, o modo fica polido e lançável.
