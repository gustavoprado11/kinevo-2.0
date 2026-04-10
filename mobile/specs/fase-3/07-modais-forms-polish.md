# Spec 07 — Modais, Forms & Polish

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
Última spec da Fase 3. Adapta todos os componentes menores que ainda não foram cobertos: modais que ocupam tela inteira desnecessariamente, formulários com campos empilhados que caberiam lado a lado, e telas secundárias que precisam de ajustes.

**Dependência: Spec 01 (useResponsive)**

## Objetivo
Polish final para garantir que todas as telas e componentes secundários tenham experiência premium no tablet.

## Escopo

### Incluído
- Modais adaptados (sheet lateral ou popover no tablet)
- Formulários com campos side-by-side quando cabem
- Exercise detail como painel (não tela cheia)
- Notification center em layout adaptado
- Financial screens em grid
- Tela de login/auth adaptada
- Settings/More em layout de lista com detalhe

### Excluído
- Novas funcionalidades
- Mudanças de lógica de negócio

## Arquivos Afetados

### Novos
- `mobile/components/shared/AdaptiveModal.tsx` — modal que se adapta (fullscreen phone / sheet tablet)

### Modificados
- `mobile/components/trainer/exercises/ExerciseFormModal.tsx` — campos side-by-side
- `mobile/components/trainer/exercises/MuscleGroupPicker.tsx` — grid no tablet
- `mobile/app/exercises/[id].tsx` — layout adaptativo
- `mobile/app/notifications/index.tsx` — largura centralizada
- `mobile/app/financial/*.tsx` — cards em grid
- `mobile/app/(auth)/login.tsx` — formulário centralizado
- `mobile/app/(trainer-tabs)/more.tsx` — settings com detalhe ao lado
- `mobile/app/(trainer-tabs)/training-room.tsx` — layout expandido
- `mobile/app/(trainer-tabs)/forms.tsx` — grid de formulários

## Comportamento Esperado

### AdaptiveModal

```typescript
interface AdaptiveModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: number;  // tablet sheet width (default: 480)
}

// Phone: Modal fullscreen com slide-up animation (comportamento atual)
// Tablet: Sheet lateral direita (width: 480px) com overlay dimmed
//         ou modal centralizado com max-width e border radius
```

**Phone**: Modal sobe do fundo, ocupa tela inteira.
**Tablet**: Sheet desliza da direita, largura fixa de 480px, fundo escurecido.

### Formulários Side-by-Side

**Phone** (atual):
```
Nome do Exercício
[________________________]

Equipamento
[________________________]

Grupo Muscular
[________________________]

Séries    Repetições
[______]  [__________]
```

**Tablet**:
```
Nome do Exercício                Equipamento
[________________________]      [________________________]

Grupo Muscular                   Função do Exercício
[________________________]      [________________________]

Séries        Repetições        Descanso
[________]    [__________]      [________]
```

### FormRow Component

```typescript
// Utilitário para distribuir campos em linha
interface FormRowProps {
  children: React.ReactNode;
  columns?: number;  // auto-calculado baseado em isTablet
}

function FormRow({ children, columns }: FormRowProps) {
  const { isTablet } = useResponsive();
  const effectiveCols = columns ?? (isTablet ? 2 : 1);
  // Renderiza children em flexDirection: 'row' com flex: 1 cada
}
```

### Notification Center (Tablet)
- Conteúdo centralizado com max-width 800px
- Filtros em row horizontal (não scroll)
- Cards de notificação mais largos com mais informação inline

### Financial Screens (Tablet)
- Cards de contrato em grid 2x2
- Resumo financeiro em row horizontal
- Tabelas com mais colunas visíveis

### Login/Auth (Tablet)
- Formulário centralizado com max-width 440px
- Logo maior
- Espaçamento generoso

### Training Room (Tablet)
- Cards de sessão em grid
- Timer maior e mais visível
- Informações do aluno ao lado do timer

### More/Settings (Tablet)
- Lista de opções à esquerda (35%)
- Conteúdo da opção selecionada à direita (65%)
- Padrão master-detail simples

## Critérios de Aceite
- [ ] Phone: todas as telas idênticas ao atual
- [ ] AdaptiveModal: fullscreen no phone, sheet lateral no tablet
- [ ] Formulários: campos side-by-side no tablet
- [ ] Notification center: centralizado com max-width
- [ ] Financial: cards em grid no tablet
- [ ] Login: formulário centralizado
- [ ] Settings: master-detail no tablet
- [ ] Sem novos erros de TypeScript

## Edge Cases
- Modal aberto durante rotação → reposicionar corretamente
- Formulário com keyboard aberto → scroll adequado no tablet
- Sheet lateral em iPad mini portrait (744px) → pode ser estreito, testar
- Telas com poucos items (ex: 2 notificações) → não esticar desnecessariamente

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `getModalStyle(isTablet)` — 'fullscreen' vs 'sheet'
- [ ] `getFormColumns(isTablet, fieldCount)` — distribui campos corretamente
- [ ] `AdaptiveModal` width calculation — respeita max-width

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
