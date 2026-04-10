# Spec: Acessibilidade Básica

## Objetivo
Adicionar `accessibilityLabel`, `accessibilityRole` e `accessibilityHint` a todos os componentes interativos das telas do treinador. Tornar o app usável com VoiceOver (iOS) e TalkBack (Android).

## Contexto
Apenas 13 instâncias de `accessibilityLabel` existem em todo o projeto mobile. Componentes como StudentCard, StatCard, botões de ação e inputs de formulário não possuem nenhum suporte a leitor de tela.

## Arquivos a modificar

### `mobile/components/trainer/StatCard.tsx`
```tsx
// Adicionar ao View raiz:
accessibilityRole="summary"
accessibilityLabel={`${label}: ${value}${subtitle ? `, ${subtitle}` : ''}`}
```

### `mobile/components/trainer/StudentCard.tsx`
```tsx
// No PressableScale wrapper:
accessibilityRole="button"
accessibilityLabel={`Aluno ${student.name}, status ${student.status}${student.program_name ? `, programa ${student.program_name}` : ''}`}
accessibilityHint="Toque para ver detalhes do aluno"
```

### `mobile/components/trainer/StudentFilterChips.tsx`
```tsx
// Em cada chip/botão de filtro:
accessibilityRole="tab"
accessibilityState={{ selected: filter === chipValue }}
accessibilityLabel={`Filtro ${label}, ${count} alunos`}
```

### `mobile/components/shared/EmptyState.tsx`
```tsx
// No View raiz:
accessibilityRole="alert"
accessibilityLabel={`${title}${description ? `. ${description}` : ''}`}
// No botão de ação (se existir):
accessibilityRole="button"
accessibilityLabel={actionLabel}
```

### `mobile/components/shared/PressableScale.tsx`
```tsx
// Garantir que accessibilityLabel e accessibilityRole são passados adiante:
// Já aceita accessibilityLabel como prop — verificar que está no Pressable interno
accessibilityRole={accessibilityRole || "button"}
```

### `mobile/app/(trainer-tabs)/dashboard.tsx`
- Botão "Sala de Treino": `accessibilityLabel="Abrir sala de treino"` `accessibilityRole="button"`
- Seção de pending actions: `accessibilityRole="list"` `accessibilityLabel="Ações pendentes"`
- Cada action item: `accessibilityRole="button"` `accessibilityHint="Toque para resolver"`

### `mobile/app/(trainer-tabs)/students.tsx`
- Search input: `accessibilityLabel="Buscar alunos por nome ou email"` `accessibilityRole="search"`
- FlatList: `accessibilityRole="list"` `accessibilityLabel="Lista de alunos"`

### `mobile/app/(trainer-tabs)/forms.tsx`
- Tab buttons (Respostas/Templates): `accessibilityRole="tab"` `accessibilityState={{ selected }}`
- Filter chips: mesmo padrão de StudentFilterChips
- Submission cards: `accessibilityRole="button"` `accessibilityLabel` com nome do aluno e template

### `mobile/app/student/[id].tsx`
- Action buttons ("Sala de Treino", "Atribuir Programa", "Prescrever IA"): `accessibilityRole="button"` com labels descritivos
- Tab buttons (Overview/Programs/Forms): `accessibilityRole="tab"` `accessibilityState={{ selected }}`

### `mobile/app/(trainer-tabs)/_layout.tsx`
- Cada tab icon: verificar que `tabBarAccessibilityLabel` está definido com nomes em português:
```tsx
<Tabs.Screen name="dashboard" options={{ tabBarAccessibilityLabel: "Painel de controle" }} />
<Tabs.Screen name="students" options={{ tabBarAccessibilityLabel: "Lista de alunos" }} />
<Tabs.Screen name="training-room" options={{ tabBarAccessibilityLabel: "Sala de treino" }} />
<Tabs.Screen name="forms" options={{ tabBarAccessibilityLabel: "Formulários" }} />
<Tabs.Screen name="more" options={{ tabBarAccessibilityLabel: "Mais opções" }} />
```

## Padrões a seguir
- Labels em português (pt-BR)
- `accessibilityRole` correto: "button" para ações, "tab" para navegação, "search" para inputs de busca, "list" para listas, "summary" para cards informativos
- `accessibilityHint` apenas quando a ação não é óbvia pelo label
- Não adicionar labels em elementos puramente decorativos (ícones, divisores)

## Critérios de aceite
- [ ] Todos os componentes interativos em `components/trainer/` têm accessibilityLabel
- [ ] Todas as telas em `app/(trainer-tabs)/` têm labels nos elementos interativos
- [ ] Tabs têm `tabBarAccessibilityLabel` em português
- [ ] VoiceOver consegue navegar por todas as telas do treinador e anunciar cada elemento
- [ ] Nenhum elemento interativo sem label acessível
