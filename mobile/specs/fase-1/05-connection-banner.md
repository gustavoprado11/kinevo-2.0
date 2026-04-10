# Spec: Banner de Status de Conexão

## Objetivo
Exibir um banner não-intrusivo quando o dispositivo perde conexão com a internet, alertando o treinador que os dados podem estar desatualizados. Esconder automaticamente ao reconectar.

## Dependência
Instalar `@react-native-community/netinfo`:
```bash
npx expo install @react-native-community/netinfo
```

## Arquivos a criar

### `mobile/hooks/useNetworkStatus.ts`
```tsx
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { useState, useEffect } from 'react'

export function useNetworkStatus() {
    const [isConnected, setIsConnected] = useState(true)
    const [wasDisconnected, setWasDisconnected] = useState(false)

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const connected = state.isConnected ?? true
            if (!connected) setWasDisconnected(true)
            setIsConnected(connected)
        })
        return () => unsubscribe()
    }, [])

    // wasDisconnected se torna true na primeira desconexão e reseta após 5s de reconexão
    useEffect(() => {
        if (isConnected && wasDisconnected) {
            const timer = setTimeout(() => setWasDisconnected(false), 5000)
            return () => clearTimeout(timer)
        }
    }, [isConnected, wasDisconnected])

    return { isConnected, wasDisconnected }
}
```

### `mobile/components/shared/ConnectionBanner.tsx`
```tsx
// Banner que aparece abaixo da status bar quando offline
// Design:
// - Background: colors.warning.light (#fffbeb)
// - Ícone: WifiOff (lucide) em colors.warning.default (#f59e0b)
// - Texto: "Sem conexão — dados podem estar desatualizados"
// - Font: 12px semibold
// - Height: 36px, paddingHorizontal: 16
// - Animação: slide-in-down com FadeInUp.duration(200), slide-out com FadeOutUp.duration(200)

// Quando reconecta, mostra brevemente:
// - Background: colors.success.light (#f0fdf4)
// - Ícone: Wifi em colors.success.default (#16a34a)
// - Texto: "Conexão restaurada"
// - Auto-dismiss após 3 segundos
```

## Arquivos a modificar

### `mobile/app/_layout.tsx`
Adicionar o `ConnectionBanner` no root layout, logo após o `<Stack>`:
```tsx
import { ConnectionBanner } from '@/components/shared/ConnectionBanner'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

// Dentro do RoleModeProvider:
const { isConnected, wasDisconnected } = useNetworkStatus()

// Após </Stack>:
<ConnectionBanner isConnected={isConnected} wasDisconnected={wasDisconnected} />
```

## Padrões a seguir
- Banner não deve deslocar o conteúdo (posição absolute sobre o conteúdo)
- Usar `react-native-reanimated` para animação de entrada/saída
- Usar `useSafeAreaInsets()` para posicionar abaixo da status bar
- Z-index alto para ficar acima de todo conteúdo

## Critérios de aceite
- [ ] Banner amarelo aparece quando WiFi/dados são desligados
- [ ] Banner verde de "Conexão restaurada" aparece ao reconectar e some após 3s
- [ ] Banner não desloca o conteúdo da tela
- [ ] Animação de entrada/saída suave
- [ ] Funciona em todas as telas do app (montado no root layout)
