# Spec: Skeleton Loaders

## Objetivo
Substituir todos os `ActivityIndicator` de tela cheia por skeleton placeholders que refletem o layout final do conteúdo. Isso elimina a percepção de lentidão e transmite qualidade profissional.

## Contexto
Atualmente, todas as telas do treinador (Dashboard, Students, Forms, Student Detail) usam o mesmo padrão de loading:
```tsx
if (isLoading) {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#7c3aed" />
        </SafeAreaView>
    );
}
```
Isso mostra uma tela em branco com um spinner central — o pior padrão de loading para UX mobile.

## Arquivos a criar

### `mobile/components/shared/Skeleton.tsx`
Componente base reutilizável com animação shimmer usando Reanimated.

```tsx
// Props:
interface SkeletonProps {
    width: number | string;    // ex: 120 ou "100%"
    height: number;
    borderRadius?: number;     // default: 8
    style?: StyleProp<ViewStyle>;
}
```

**Implementação:**
- Usar `react-native-reanimated` (já instalado) para criar animação de shimmer
- Loop infinito com `withRepeat` + `withTiming` movendo um gradiente de opacidade
- Cor base: `#E5E7EB` (cinza claro), highlight: `#F3F4F6`
- Duração do ciclo: 1200ms
- Usar `LinearGradient` do `expo-linear-gradient` (já instalado) para o efeito shimmer

### `mobile/components/shared/skeletons/DashboardSkeleton.tsx`
Espelha o layout de `dashboard.tsx`:
- Retângulo para greeting (width: 200, height: 24)
- Retângulo para data (width: 140, height: 16)
- Retângulo para botão "Sala de Treino" (width: "100%", height: 56, borderRadius: 16)
- Grid 2×2 de StatCard skeletons (cada um: borderRadius: 20, height: 120)
  - Dentro: círculo 36×36 + retângulo 80×28 + retângulo 100×12
- 3× retângulos para activity feed (width: "100%", height: 64, borderRadius: 12)

### `mobile/components/shared/skeletons/StudentsListSkeleton.tsx`
Espelha o layout de `students.tsx`:
- Retângulo para search bar (width: "100%", height: 44, borderRadius: 12)
- Horizontal row de 4 filter chips (width: 80, height: 32, borderRadius: 16)
- 5× StudentCard skeletons:
  - Círculo 44×44 (avatar)
  - Retângulo 140×16 (nome)
  - Retângulo 100×12 (email)
  - Retângulo 60×20 (badge)

### `mobile/components/shared/skeletons/FormsSkeleton.tsx`
Espelha o layout de `forms.tsx`:
- Tab indicator (2 retângulos)
- 3× filter chips
- 4× SubmissionCard skeletons (width: "100%", height: 80, borderRadius: 16)

### `mobile/components/shared/skeletons/StudentDetailSkeleton.tsx`
Espelha o layout de `student/[id].tsx`:
- Círculo 80×80 (avatar)
- Retângulo 160×20 (nome)
- Retângulo 200×14 (email)
- Horizontal row de 2 badges
- Horizontal row de 3 action buttons (height: 44)
- Tab indicator (3 retângulos)
- Grid 2×2 de stat cards

## Arquivos a modificar

### `mobile/app/(trainer-tabs)/dashboard.tsx`
Substituir o bloco `if (isLoading) { return <ActivityIndicator /> }` por:
```tsx
if (isLoading) {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
            <DashboardSkeleton />
        </SafeAreaView>
    );
}
```

### `mobile/app/(trainer-tabs)/students.tsx`
Mesma substituição, usando `<StudentsListSkeleton />`.

### `mobile/app/(trainer-tabs)/forms.tsx`
Mesma substituição, usando `<FormsSkeleton />`.

### `mobile/app/student/[id].tsx`
Mesma substituição, usando `<StudentDetailSkeleton />`.

## Padrões a seguir
- Usar `Animated.View` de `react-native-reanimated` (não o Animated nativo)
- Todas as dimensões devem espelhar os componentes reais (`StatCard` = borderRadius: 20, padding: 16)
- Espaçamentos: `paddingHorizontal: 20` (igual ao contentContainerStyle do FlatList)
- Animação: usar presets de `lib/animations.ts` — `ANIM.timing.normal` para entrada dos skeletons

## Critérios de aceite
- [ ] Nenhum `ActivityIndicator` de tela cheia restante nas 4 telas do treinador
- [ ] Skeletons refletem fielmente o layout final do conteúdo
- [ ] Animação shimmer suave e contínua
- [ ] Transição skeleton → conteúdo real é fluida (sem flash branco)
- [ ] Pull-to-refresh continua funcionando normalmente
