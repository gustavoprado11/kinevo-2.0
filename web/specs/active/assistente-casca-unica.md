# Brief — Unificar "Modo Assistente" e "Modo Clássico" numa casca só

> Para o Claude Code. Objetivo: acabar com a deriva de componentes entre os dois
> modos e com a confusão entre **modo** (estado global) e **aba** (navegação).
> Não é refatorar a lógica do motor de IA — é arquitetura de UI/navegação e
> design system. Leia este doc inteiro antes de mexer.

---

## 1. Decisão de produto (modelo mental)

São **duas formas de trabalho do MESMO app**, não dois apps. O **modo** é um
**estado global e persistente** (`homeStyle`: `classic | assistant`). Quem troca o
modo é **só o `ModeToggle`** — nenhuma aba/link pode trocar o modo como efeito
colateral.

### Modo Assistente — "o chat É o dashboard"

Selecionar o modo Assistente significa: **o treinador prefere trabalhar via chat.**
Então:

- **O "Dashboard" do menu abre o CHAT** (a home conversacional "O que vamos
  resolver hoje?"). O chat ocupa o lugar do dashboard. ✅ *Isto já é o
  comportamento atual do reapontamento do item Dashboard — mantenha.*
- **NÃO existe um item "Assistente IA" separado** na sidebar neste modo. É
  redundante (o chat já é a home). Esse item duplicado é o que aparece destacado
  no print e deve **sumir** quando `homeStyle === 'assistant'`.
- **As outras abas (Alunos, Marketing, Agenda, Formulários, Financeiro,
  Bibliotecas, Configurações) continuam acessíveis e funcionam exatamente como no
  Clássico** — páginas normais. O treinador navega para elas do mesmo jeito.
- Para preservar a preferência "trabalho via chat", ao sair da home e abrir outra
  aba, o chat fica acessível num **dock ancorado à direita** (página normal + chat
  fixo), carregando a mesma conversa/contexto. Navegar entre abas **mantém o modo**.

### Modo Clássico — app tradicional

- Dashboard clássico (SaaS), navegação por abas, como hoje.
- O assistente continua sendo uma **feature acessível** (item "Assistente IA"
  e/ou launcher flutuante e ⌘K) que **abre o assistente como painel/dock SEM trocar
  o `homeStyle`**. Em hipótese alguma clicar nessa feature deve "cair no modo
  assistente" — é o incômodo original a eliminar.

Regra de ouro: **o assistente é a mesma conversa em duas apresentações** — tela
cheia quando é o dashboard (modo assistente) e dock à direita nas demais telas e no
clássico.

---

## 2. Diagnóstico — o que o código faz hoje (a causa do incômodo)

1. **`/assistente` é uma casca SEPARADA.** `app/assistente/page.tsx` renderiza
   `AssistantWorkspace` **sem `AppLayout`**, com a sua própria sidebar
   (`components/assistant/workspace/assistant-sidebar.tsx`). É efetivamente um
   "segundo app" com fundação estrutural diferente.

2. **Item "Assistente IA" duplicado/redundante** em
   `components/layout/sidebar.tsx`:
   - O item **"Dashboard"** já é reapontado para o chat (`/assistente`) quando
     `assistantMode` — **isso é o comportamento desejado, manter.**
   - Mas **ainda existe um item separado "Assistente IA"** sempre visível. Em modo
     assistente ele é **redundante** (é o do print). Em modo clássico, clicar nele
     **te joga na casca do assistente / troca o contexto** — é o *"aba que cai no
     modo assistente"* que não queremos.

3. **A lógica "permaneço no assistente" se quebra.** Em modo assistente, abrir
   Alunos/Agenda/Financeiro te devolve à casca clássica (a `Sidebar` global) e não
   há chat acompanhando. Só `/assistente` é "assistente".

4. **Deriva visual / design system (o "contorno diferente do toggle" e os
   componentes que destoam):**
   - `assistant-sidebar.tsx` **reimplementa a casca** com **hex literais e zero
     variantes `dark:`** (contagem real: `sidebar.tsx` tem **82** ocorrências de
     `dark:`; `assistant-sidebar.tsx` tem **0**). Em dark mode a experiência
     assistente quebra; em light mode ela "parece de outro produto".
   - A borda da casca é diferente: global usa `border-r border-[#E8E8ED]
     dark:border-k-border-subtle`; o assistente usa `shadow-[1px_0_0_...]`.
   - O `<aside>` do assistente **não é `fixed`** (é filho flex do workspace),
     enquanto a `Sidebar` global é `fixed inset-y-0`.
   - Resultado: o `ModeToggle` é o mesmo componente, mas como **a casca ao redor é
     outra**, o "contorno" e o espaçamento lêem diferente. Some o problema quando
     houver **uma casca só**.
   - Há ainda **componentes duplicados** que o assistant-sidebar refez à mão:
     perfil + popover "Sair", botão de recolher na borda (edge toggle), accordion
     de Bibliotecas. Devem voltar a ser os compartilhados.

5. **Boa notícia — a infra de "chat fixo" já existe (parcialmente):**
   - `app-layout.tsx` já lê `isChatOpen` (de `stores/assistant-chat-store.ts`,
     que reexporta `communication-store`) e **encolhe o main** com
     `xl:pr-[420px]` quando o chat está aberto.
   - Já existem `UnifiedCommunicationPanel` (painel global que desliza da direita),
     `AssistantLauncher` (bolha flutuante) e o ⌘K (`command-palette`).
   - Ou seja: o caminho "página normal + dock" **já está semi-montado**.

---

## 3. Arquitetura-alvo

**Uma casca única (`AppLayout` + `Sidebar` global) para TODAS as telas, nos dois
modos.** O chat passa a viver dentro dessa casca — como **conteúdo da página**
quando é o dashboard do modo assistente, e como **dock ancorado** nas demais telas.

1. **`homeStyle` continua a fonte de verdade do modo.** Só o `ModeToggle` o altera.

2. **Aposentar a casca paralela do `/assistente`.** A rota do chat pode continuar
   existindo, mas deve renderizar **dentro do `AppLayout`** (mesma `Sidebar`
   global), exibindo a **home conversacional como conteúdo da página** — não com
   `assistant-sidebar.tsx`. O rail de **Conversas & Alunos** vira um painel
   **dentro da área de conteúdo do chat**, não uma segunda sidebar.

3. **Sidebar no modo Assistente:**
   - O item **"Dashboard" abre o chat** (manter o reapontamento atual).
   - **Remover o item "Assistente IA"** (redundante neste modo).
   - Demais itens inalterados, levando às páginas normais.

4. **Sidebar no modo Clássico:**
   - Dashboard normal. O assistente é feature: manter um ponto de entrada
     ("Assistente IA" e/ou launcher/⌘K) que **abre o dock** (`communication-store`)
     **sem alterar `homeStyle`** e **sem navegar para a casca separada**.

5. **O dock é a apresentação "docked" do assistente.** Mesmo motor/conversa da
   home. Estado de abertura no `communication-store` (já existe `isChatOpen`).
   - **Modo assistente:** ao sair da home (Dashboard) para outra aba, o dock fica
     **aberto/persistente** entre abas.
   - **Modo clássico:** dock **fechado por padrão**; abre via feature, sem trocar
     de modo.

6. **`assistant-sidebar.tsx` deixa de existir como casca.** O que for reaproveitável
   (Nova conversa, rail de Conversas/Alunos, medidor de créditos) migra para a
   página do chat e/ou para o dock; o resto é removido em favor dos componentes
   compartilhados (`Sidebar`, perfil, edge toggle, `ModeToggle`).

---

## 4. Tarefas concretas (por arquivo)

- [ ] **`components/layout/sidebar.tsx`**
  - **Manter** o item "Dashboard" reapontando para o chat quando
    `assistantMode` (já existe).
  - **Remover o item "Assistente IA"** quando `assistantMode === true`.
  - No **modo clássico**, transformar o ponto de entrada do assistente para
    **abrir o dock** (`communication-store`) em vez de navegar para `/assistente`.
    Garantir que **nunca altere `homeStyle`**.
- [ ] **`app/assistente/page.tsx` + `components/assistant/workspace/assistant-workspace.tsx`**
  - Renderizar a home conversacional **dentro do `AppLayout`** (casca global).
  - Mover o rail **Conversas & Alunos** para dentro da área de conteúdo do chat.
- [ ] **`components/assistant/workspace/assistant-sidebar.tsx`**
  - Remover como casca paralela. Migrar o que for útil; descartar a duplicação de
    perfil, edge toggle e Bibliotecas.
- [ ] **Dock do assistente (consolidar `UnifiedCommunicationPanel`)**
  - Painel ancorado à direita, reusa `xl:pr-[420px]` já presente no `app-layout`.
  - Persistente entre abas no modo assistente; fechado por padrão no clássico.
- [ ] **`app-layout.tsx`**
  - Orquestrar o default de abertura do dock conforme `homeStyle` e a rota atual
    (na home/Dashboard do modo assistente o chat já é a página; nas demais, dock).
- [ ] **`components/assistant/assistant-launcher.tsx`**
  - No clássico, **abrir o dock** em vez de navegar para `/assistente`.
- [ ] **`components/layout/mode-toggle.tsx`**
  - Sem mudança de marcação. Com casca única, o "contorno" fica idêntico nos dois
    modos automaticamente. Conferir paridade `dark:` do container.

---

## 5. Regras de design system (não negociáveis)

- **Nenhum hex literal sem o par `dark:`** na experiência assistente. Usar os
  tokens já existentes (`k-border-subtle`, `glass-bg`, `glass-bg-active`,
  `surface-*`, `muted-foreground`, etc.), como faz a `Sidebar` global.
- **Uma casca, um conjunto de componentes.** Perfil, edge toggle, accordion de
  Bibliotecas e `ModeToggle` são **compartilhados** — proibido reimplementar.
- **`ModeToggle` é o único toggle**, com o mesmo container (margem/borda) nos dois
  modos.

---

## 6. Resumo das regras de navegação (o que muda)

| Situação | Comportamento correto |
|---|---|
| Modo Assistente → item "Dashboard" | Abre o **chat** (é o dashboard) |
| Modo Assistente → item "Assistente IA" | **Não existe** (removido) |
| Modo Assistente → Alunos/Agenda/etc. | Página normal + chat no dock; modo se mantém |
| Modo Clássico → "Dashboard" | Dashboard tradicional |
| Modo Clássico → "Assistente IA"/launcher/⌘K | Abre o dock do assistente, **sem trocar de modo** |
| Trocar de modo | **Só** pelo `ModeToggle` |

---

## 7. Critérios de aceite

1. Em modo Assistente, o "Dashboard" é o **chat** e **não há item "Assistente IA"**
   separado na sidebar.
2. Em modo Assistente, navegar para Alunos/Agenda/Financeiro mostra a página normal,
   **mantém o modo** e mantém o chat acessível no dock.
3. Em modo Clássico, abrir o assistente (tab/launcher/⌘K) **não altera `homeStyle`**;
   apenas abre o dock. Nada "cai no modo assistente".
4. Trocar de modo é **só** pelo `ModeToggle`; nenhuma aba/link troca o modo sozinho.
5. **Zero sidebar paralela**: toda a navegação usa a `Sidebar` global.
6. `ModeToggle` **pixel-idêntico** nos dois modos.
7. **Dark mode** funciona em toda a experiência assistente (0 hex sem `dark:`).
