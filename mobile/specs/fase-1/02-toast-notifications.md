# Spec: Toast Notifications

## Objetivo
Implementar sistema de toast notifications para feedback não-bloqueante, substituindo os `Alert.alert()` usados para mensagens de sucesso e erro não-crítico. Reservar `Alert.alert()` apenas para confirmações destrutivas.

## Contexto
O app usa `Alert.alert()` nativo para todo tipo de feedback — sucesso, erro, aviso. Isso interrompe o fluxo do usuário com um modal de sistema que precisa ser dismissado manualmente. Toasts são a convenção mobile para feedback transitório.

## Dependência
Instalar `react-native-toast-message` (leve, customizável, sem dependências nativas):
```bash
npm install react-native-toast-message
```

## Arquivos a criar

### `mobile/components/shared/ToastConfig.tsx`
Configuração customizada dos toasts para seguir o design system do Kinevo:

```tsx
import Toast, { BaseToast, ErrorToast, type ToastConfig } from 'react-native-toast-message'

export const toastConfig: ToastConfig = {
    success: (props) => (
        // Fundo: #f0fdf4, borda esquerda: #16a34a, ícone: CheckCircle
        // Fonte: 14px semibold para título, 12px para mensagem
        // BorderRadius: 12, shadow sutil
    ),
    error: (props) => (
        // Fundo: #fef2f2, borda esquerda: #ef4444, ícone: AlertCircle
    ),
    info: (props) => (
        // Fundo: #f5f3ff, borda esquerda: #7c3aed, ícone: Info
    ),
}
```

### `mobile/lib/toast.ts`
Helper functions para simplificar chamadas:

```tsx
import Toast from 'react-native-toast-message'

export const toast = {
    success: (title: string, message?: string) =>
        Toast.show({ type: 'success', text1: title, text2: message, visibilityTime: 3000 }),

    error: (title: string, message?: string) =>
        Toast.show({ type: 'error', text1: title, text2: message, visibilityTime: 4000 }),

    info: (title: string, message?: string) =>
        Toast.show({ type: 'info', text1: title, text2: message, visibilityTime: 3000 }),
}
```

## Arquivos a modificar

### `mobile/app/_layout.tsx`
Adicionar o componente `<Toast />` com config customizada como último filho do provider tree:
```tsx
import Toast from 'react-native-toast-message'
import { toastConfig } from '@/components/shared/ToastConfig'

// No final do return, depois de </Stack>:
<Toast config={toastConfig} topOffset={insets.top + 8} />
```

### Substituir `Alert.alert()` por toasts nos seguintes arquivos:
- `mobile/app/student/[id].tsx` — Alert de "Sem programa ativo" → `toast.info()`
- `mobile/components/trainer/student/AssignProgramWizard.tsx` — Sucesso/erro ao atribuir → `toast.success()` / `toast.error()`
- `mobile/components/trainer/forms/AssignFormModal.tsx` — Sucesso/erro ao atribuir form → toast
- `mobile/components/trainer/WorkoutFeedbackModal.tsx` — Feedback enviado → `toast.success()`

### Manter `Alert.alert()` em:
- Confirmações destrutivas (deletar, remover, cancelar assinatura)
- Ações que precisam de escolha do usuário (OK/Cancelar)

## Padrões a seguir
- Toasts aparecem no topo da tela, abaixo da status bar
- Não devem sobrepor a tab bar
- Haptic feedback sutil no toast de sucesso: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`
- Haptic feedback no toast de erro: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)`

## Critérios de aceite
- [ ] Toast component renderiza em todas as telas (montado no root layout)
- [ ] 3 variantes visuais distintas: success (verde), error (vermelho), info (roxo)
- [ ] Toasts auto-dismiss após 3-4 segundos
- [ ] Swipe-to-dismiss funciona
- [ ] Haptic feedback acompanha success e error
- [ ] Alert.alert() permanece apenas em ações destrutivas
