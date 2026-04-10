# Spec 02 — Navegação Adaptativa

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
A navegação atual usa bottom tab bar com 5 ícones (trainer) ou 4 ícones (student). No iPad, essa tab bar fica perdida na parte inferior de uma tela grande, desperdiçando espaço horizontal. Apps concorrentes como Trainerize usam navigation rail (sidebar vertical) em tablets.

**Dependência: Spec 01 (useResponsive)**

## Objetivo
Implementar navegação adaptativa: sidebar vertical no tablet, bottom tabs no celular. Sem alterar as rotas — apenas a apresentação da navegação.

## Escopo

### Incluído
- Navigation rail (sidebar vertical colapsável) para tablet
- Manter bottom tabs no celular
- Transição automática baseada em breakpoint
- Profile/avatar na sidebar
- Indicador de tela ativa

### Excluído
- Drawer com swipe gesture (complexidade desnecessária)
- Mudanças de rotas ou stack navigation
- Menu hamburger

## Arquivos Afetados

### Novos
- `mobile/components/shared/AdaptiveNavigation.tsx` — wrapper que escolhe tab bar ou sidebar
- `mobile/components/shared/NavigationSidebar.tsx` — sidebar vertical para tablet
- `mobile/components/shared/SidebarNavItem.tsx` — item individual da sidebar

### Modificados
- `mobile/app/(trainer-tabs)/_layout.tsx` — usar AdaptiveNavigation
- `mobile/app/(tabs)/_layout.tsx` — usar AdaptiveNavigation

## Comportamento Esperado

### Phone (< 768px)
Sem mudanças — bottom tab bar idêntica ao atual.

### Tablet Portrait (≥ 768px, portrait)
- Sidebar colapsada (ícones only, ~68px de largura) no lado esquerdo
- Ícones das tabs com tooltip no hover/press
- Indicador visual da tab ativa (pill background)
- Avatar do trainer no topo da sidebar
- Conteúdo ocupa o restante da tela

### Tablet Landscape (≥ 768px, landscape)
- Sidebar expandida (~220px) com ícones + labels
- Nome do trainer abaixo do avatar
- Seção inferior: Settings/Logout
- Conteúdo ocupa o restante da tela

### Fluxo Técnico

```
AdaptiveNavigation
├── isPhone? → <BottomTabBar /> (existente, sem mudanças)
└── isTablet? → <View style={{ flexDirection: 'row' }}>
                  <NavigationSidebar expanded={isLandscape} />
                  <View style={{ flex: 1 }}>
                    {children} // tab content
                  </View>
                </View>
```

### Estrutura da Sidebar

```typescript
// NavigationSidebar.tsx
interface SidebarProps {
  expanded: boolean;  // icons+labels (landscape) vs icons only (portrait)
  tabs: TabConfig[];
  activeTab: string;
  onTabPress: (tab: string) => void;
}

// Trainer tabs config
const TRAINER_TABS: TabConfig[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { key: 'students', label: 'Alunos', icon: 'Users' },
  { key: 'training-room', label: 'Sala de Treino', icon: 'Dumbbell' },
  { key: 'forms', label: 'Formulários', icon: 'ClipboardList' },
  { key: 'more', label: 'Mais', icon: 'Menu' },
];
```

### Animação de Transição
- Sidebar width anima com `react-native-reanimated` (withTiming, 200ms)
- Labels aparecem com fade-in quando sidebar expande
- Content area ajusta com flex suave

## Critérios de Aceite
- [ ] Phone: bottom tabs inalteradas — zero regressão visual
- [ ] Tablet portrait: sidebar colapsada (ícones only) funcional
- [ ] Tablet landscape: sidebar expandida (ícones + labels)
- [ ] Tab ativa com indicador visual claro
- [ ] Navegação funcional em todas as tabs (trainer e student)
- [ ] Transição suave ao rotacionar o iPad
- [ ] Avatar do trainer visível na sidebar
- [ ] Sem novos erros de TypeScript
- [ ] Safe area respeitada em ambos os modos

## Edge Cases
- iPad rotacionando de landscape para portrait enquanto navega → sidebar colapsa sem perder tab ativa
- iPad em Split View com largura < 768px → fallback para bottom tabs
- Deep link abrindo tela interna → sidebar mostra tab correta como ativa
- Badge de notificação → visível tanto na sidebar quanto nas bottom tabs

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `getNavigationMode(width)` — retorna 'tabs' ou 'sidebar'
- [ ] `getSidebarWidth(expanded)` — 68px colapsada, 220px expandida
- [ ] `TRAINER_TABS` config — todos os items com key, label e icon

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
