# Prompt para o Claude Code — Consistência de contornos no modo Assistente

> Ajuste **pontual** de UI (sem refatorar arquitetura). Objetivo: o **toggle
> Clássico/Assistente** e o **botão de recolher o menu (setinha na borda)** devem
> ter contorno/forma **idênticos** nos dois modos. A referência é sempre o **modo
> Clássico**. O modo Assistente deve copiar exatamente o design do Clássico.

## Causa-raiz (já investigada)

A sidebar do modo Assistente (`web/src/components/assistant/workspace/assistant-sidebar.tsx`)
reimplementou a casca à mão e divergiu da sidebar Clássica
(`web/src/components/layout/sidebar.tsx`):

1. **Borda direita da casca:** o Clássico usa `border-r border-[#E8E8ED]
   dark:border-k-border-subtle`; o Assistente usa `shadow-[1px_0_0_rgba(0,0,0,0.06)]`.
   Isso muda a linha vertical onde a setinha se apoia → contorno diferente.
2. **Botão da setinha (edge toggle):** no Assistente foi recopiado **sem as
   variantes `dark:`** e com `z-30` em vez de `z-sidebar`.
3. O **`ModeToggle`** já é componente compartilhado (`web/src/components/layout/mode-toggle.tsx`),
   então a pílula em si é a mesma — a diferença percebida vem da casca ao redor
   (itens 1 e 2). Não duplicar nem reestilizar o `ModeToggle`.

## O que fazer (somente em `assistant-sidebar.tsx`)

1. **Borda direita do `<aside>`:** trocar o `shadow-[1px_0_0_rgba(0,0,0,0.06)]`
   pela borda do Clássico, igualzinho à `Sidebar` global:
   `border-r border-[#E8E8ED] dark:border-k-border-subtle`.

2. **Botão de recolher (edge toggle):** substituir o `className` atual pelo
   **exatamente igual** ao do Clássico (`web/src/components/layout/sidebar.tsx`),
   incluindo `z-sidebar` e todas as variantes `dark:`:

   ```
   absolute top-9 -right-3 z-sidebar w-6 h-6 flex items-center justify-center
   rounded-full border border-[#E8E8ED] dark:border-k-border-subtle
   bg-white dark:bg-surface-sidebar text-[#AEAEB2] dark:text-muted-foreground/60
   hover:text-[#6E6E73] dark:hover:text-foreground
   hover:bg-[#F5F5F7] dark:hover:bg-glass-bg shadow-sm transition-colors
   ```

3. **Não alterar** a marcação do `ModeToggle`; ele deve permanecer o componente
   compartilhado. Apenas confirme que o container ao redor (margens/fundo da
   sidebar) bate com o Clássico.

## Critérios de aceite

- O botão da setinha e o toggle têm contorno/forma **pixel-idênticos** entre
  Clássico e Assistente, em **light e dark mode**.
- A borda direita da sidebar do Assistente é a mesma linha do Clássico
  (`border-r`, não shadow).
- Nenhuma classe com hex literal sem o par `dark:` foi introduzida.
- Nenhuma mudança de comportamento/navegação — apenas visual.
