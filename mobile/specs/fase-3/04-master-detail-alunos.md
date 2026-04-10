# Spec 04 — Lista de Alunos (Master-Detail)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
A lista de alunos atualmente navega via stack: toque no aluno → push da tela de detalhe → voltar. No tablet, esse padrão desperdiça 2/3 da tela e exige navegação desnecessária. O padrão master-detail (split view) é o padrão ouro no iPad — lista à esquerda, detalhe à direita.

**Dependências: Spec 01 (useResponsive), Spec 02 (NavigationSidebar)**

## Objetivo
Implementar split view na lista de alunos: lista persistente na lateral com detalhe ao lado no tablet, mantendo navegação stack no celular.

## Escopo

### Incluído
- Split view: lista (1/3) + detalhe (2/3) em tablet
- Seleção com highlight visual na lista
- Auto-seleção do primeiro aluno ao carregar
- Transição animada ao selecionar
- Barra de busca funcional em ambos os modos
- Pull-to-refresh na lista

### Excluído
- Mudanças no conteúdo do detalhe do aluno (Spec 05)
- Filtros avançados na lista
- Multi-seleção

## Arquivos Afetados

### Novos
- `mobile/components/shared/MasterDetailLayout.tsx` — layout genérico reutilizável
- `mobile/components/trainer/students/StudentMasterDetail.tsx` — composição específica

### Modificados
- `mobile/app/(trainer-tabs)/students.tsx` — usar MasterDetailLayout no tablet
- `mobile/components/trainer/students/StudentCard.tsx` — estado selected
- `mobile/app/student/[id].tsx` — poder renderizar embutido (sem header de nav)

## Comportamento Esperado

### MasterDetailLayout (Genérico)

```typescript
interface MasterDetailLayoutProps {
  masterContent: React.ReactNode;
  detailContent: React.ReactNode | null;
  masterWidth?: number | string;  // default: '35%'
  placeholder?: React.ReactNode;  // quando nenhum item selecionado
}

// No phone: renderiza apenas masterContent (detalhe via navigation)
// No tablet: side-by-side com divider
```

### Phone (< 768px)
Sem mudanças — toque no StudentCard faz `router.push(/student/${id})`.

### Tablet (≥ 768px)

```
┌──────────────┬───────────────────────────────────┐
│  ALUNOS      │                                   │
│  🔍 Buscar   │  ┌─────────────────────────────┐  │
│              │  │  Ana Silva                   │  │
│  ┌─────────┐ │  │  ⭐ Programa: Hipertrofia    │  │
│  │ Ana ✓  │ │  │                             │  │
│  └─────────┘ │  │  [Overview] [Programs] [Forms]│  │
│  ┌─────────┐ │  │                             │  │
│  │ Bruno   │ │  │  📊 Gráficos de Progressão  │  │
│  └─────────┘ │  │  📋 Heatmap de Frequência   │  │
│  ┌─────────┐ │  │  🏋️ Treinos Ativos          │  │
│  │ Carlos  │ │  │                             │  │
│  └─────────┘ │  └─────────────────────────────┘  │
│  ┌─────────┐ │                                   │
│  │ Diana   │ │                                   │
│  └─────────┘ │                                   │
│              │                                   │
│  35% width   │          65% width                │
└──────────────┴───────────────────────────────────┘
```

### Fluxo do Usuário (Tablet)
1. Entra na aba "Alunos" → vê lista à esquerda
2. Primeiro aluno é auto-selecionado → detalhe aparece à direita
3. Toca em outro aluno → detalhe atualiza com transição suave
4. Busca na lista → filtra em tempo real, seleção mantida se possível
5. Aluno selecionado aparece com fundo highlight na lista

### StudentCard com Estado Selected

```typescript
interface StudentCardProps {
  student: Student;
  selected?: boolean;  // novo
  onPress: () => void;
}

// selected=true → border-left com cor brand.primary + background brand.primaryLight
```

### Detalhe Embutido
O componente de `student/[id].tsx` precisa funcionar em dois modos:
1. **Standalone** (phone): com header de navegação, back button
2. **Embedded** (tablet master-detail): sem header, sem safe area própria

```typescript
// student/[id].tsx
interface StudentDetailProps {
  embedded?: boolean;  // quando true, esconde header e back button
}
```

## Critérios de Aceite
- [ ] Phone: navegação stack idêntica ao atual
- [ ] Tablet: split view com lista (35%) + detalhe (65%)
- [ ] Primeiro aluno auto-selecionado ao carregar
- [ ] Toque em aluno atualiza detalhe sem navegação
- [ ] Aluno selecionado com destaque visual na lista
- [ ] Busca filtra lista sem afetar o detalhe
- [ ] Pull-to-refresh funciona na lista
- [ ] Rotação portrait↔landscape mantém seleção
- [ ] Deep link para `/student/123` funciona em ambos os modos
- [ ] Sem novos erros de TypeScript

## Edge Cases
- Lista vazia (sem alunos) → mensagem empty state no lado esquerdo, detalhe vazio
- Aluno selecionado removido/desativado → auto-selecionar próximo
- Busca sem resultados → manter detalhe do último selecionado
- iPad Split View com width < 768 → fallback para stack navigation
- Muitos alunos (100+) → FlatList performática com lazy loading

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `getMasterWidth(isTablet)` — '35%' no tablet, '100%' no phone
- [ ] Auto-selection logic — seleciona primeiro quando lista carrega
- [ ] Selection persistence — mantém seleção quando lista atualiza

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
