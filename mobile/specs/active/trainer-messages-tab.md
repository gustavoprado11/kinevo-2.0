# Aba de Mensagens do Trainer (Mobile)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

O sistema de mensagens 1:1 entre trainer e aluno já existe e funciona:
- **Banco**: tabela `messages` com real-time habilitado, RLS configurado, indexes otimizados
- **Mobile (aluno)**: `ChatView`, `useTrainerChat`, `useUnreadCount` — tudo funcional
- **Web (trainer)**: split view com conversation list + chat panel — tudo funcional

O que falta é a **tela de mensagens do trainer no mobile**. Atualmente, o trainer só consegue responder mensagens pelo web. No app mobile, a tab "Sala de Treino" ocupa espaço na tab bar, mas já tem botão de acesso no dashboard ("Sala de Treino" em destaque). A proposta é substituir essa tab por "Mensagens".

## Objetivo

1. Criar tela de lista de conversas do trainer no mobile
2. Criar tela de chat individual trainer→aluno
3. Substituir a tab "Sala de Treino" por "Mensagens" na tab bar do trainer
4. Reutilizar ao máximo a infra existente (ChatView, tipos, real-time)

## Escopo

### Incluído
- Hook `useTrainerConversations` (lista de conversas, unread counts, real-time)
- Hook `useTrainerChatRoom` (mensagens de uma conversa específica, send, mark as read, real-time)
- Tela de lista de conversas (`messages.tsx` na trainer-tabs)
- Tela de chat individual (`/messages/[studentId].tsx`)
- Componente `ConversationCard` (preview da conversa com avatar, nome, última msg, unread badge)
- Badge de unread na tab bar
- Troca da tab "Sala de Treino" → "Mensagens"
- Push notification handling (deep link para chat ao tocar na notificação)

### Excluído
- Upload de imagem no chat mobile trainer (limitação conhecida do RN, funciona no web)
- Busca por conteúdo de mensagens
- Reações/emoji
- Grupos/broadcasts
- Mudanças no web

## Arquivos Afetados

### Novos
- `mobile/hooks/useTrainerConversations.ts` — lista de conversas do trainer
- `mobile/hooks/useTrainerChatRoom.ts` — chat de uma conversa (trainer como sender)
- `mobile/app/(trainer-tabs)/messages.tsx` — tela de lista de conversas
- `mobile/app/messages/[studentId].tsx` — tela de chat individual
- `mobile/components/trainer/messages/ConversationCard.tsx` — card de conversa

### Modificados
- `mobile/app/(trainer-tabs)/_layout.tsx` — trocar "training-room" por "messages", atualizar ícone
- `mobile/app/(trainer-tabs)/more.tsx` — adicionar link "Sala de Treino" como item de menu

## Modelo de Dados (já existe)

```typescript
// Tabela: messages
interface Message {
  id: string;
  student_id: string;       // identifica a conversa (1:1 implícito)
  sender_type: 'trainer' | 'student';
  sender_id: string;        // auth.users(id)
  content: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
}

// Conversa (construída via query, não é tabela)
interface Conversation {
  student: {
    id: string;
    name: string;
    avatar_url: string | null;
    status: string;
  };
  lastMessage: {
    content: string | null;
    image_url: string | null;
    sender_type: 'trainer' | 'student';
    created_at: string;
  } | null;
  unreadCount: number;
}
```

## Comportamento Esperado

### Hook `useTrainerConversations`

```typescript
// Retorna lista de conversas do trainer autenticado
// Ordenação: conversas com mensagens recentes primeiro, depois sem mensagens (alfabético)
// Real-time: escuta INSERT na tabela messages para atualizar lastMessage e unreadCount

interface UseTrainerConversationsReturn {
  conversations: Conversation[];
  totalUnread: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
}
```

**Query**: 
1. Buscar todos `students` onde `coach_id = trainer.id` e `status = 'active'`
2. Para cada student, buscar a última mensagem e o count de unread (sender_type='student', read_at IS NULL)
3. Real-time channel: escutar INSERT em `messages` filtrando por student_ids do trainer

### Hook `useTrainerChatRoom`

```typescript
// Gerencia o chat de UMA conversa (trainer envia como 'trainer')
interface UseTrainerChatRoomReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  sendText: (content: string) => Promise<void>;
  markAsRead: () => Promise<void>;
  loadMore: () => Promise<void>;
}
```

**Diferença do `useTrainerChat` existente**: aquele é para o ALUNO (sender_type='student'). Este novo é para o TRAINER (sender_type='trainer'). A lógica de fetch e real-time é similar, mas:
- `sender_type` no insert é `'trainer'`
- `markAsRead` marca mensagens do `sender_type='student'`
- Push notification vai para o aluno (não para o trainer)

### Tela de Lista de Conversas

```
┌─────────────────────────────────┐
│  Mensagens              🔍      │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ 🟣 Ana Silva        2min  │  │
│  │    Fiz o treino hoje!  2  │  │  ← unread badge
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 👤 Bruno Costa       1h   │  │
│  │    Você: Ótimo trabalho!  │  │  ← sem badge (lido)
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 👤 Carlos Lima        3d  │  │
│  │    Sem mensagens          │  │  ← aluno sem conversa
│  └───────────────────────────┘  │
│                                 │
│  (FlatList com pull-to-refresh) │
└─────────────────────────────────┘
```

- Busca por nome do aluno (debounce 300ms)
- Pull-to-refresh
- Empty state quando não há alunos
- Tocar no card → navega para `/messages/${studentId}`

### Tela de Chat Individual

Reutilizar a lógica do `ChatView` existente com adaptações:
- Header com nome + avatar do aluno (não do trainer)
- Mensagens do trainer (sender_type='trainer') → bolha à direita (roxo)
- Mensagens do aluno (sender_type='student') → bolha à esquerda (cinza)
- Input de texto com botão send
- Auto-mark as read ao abrir
- Real-time para novas mensagens
- Scroll to bottom com botão flutuante
- Back button volta para lista

### Tab Bar

**Antes**:
```
[Dashboard] [Alunos] [Sala de Treino] [Formulários²] [Mais]
```

**Depois**:
```
[Dashboard] [Alunos] [Mensagens³] [Formulários²] [Mais]
```

- Ícone: `MessageCircle` do lucide-react-native
- Badge: total unread count (mesma lógica do web)
- "Sala de Treino" move para a aba "Mais" como item de menu

## Critérios de Aceite
- [ ] Tab "Mensagens" aparece no lugar de "Sala de Treino"
- [ ] Badge de unread aparece na tab quando há mensagens não lidas
- [ ] Lista de conversas carrega todos os alunos ativos
- [ ] Conversas ordenadas: com mensagens recentes primeiro, sem mensagens depois
- [ ] Busca por nome do aluno funciona com debounce
- [ ] Tocar em conversa abre o chat
- [ ] Trainer consegue enviar mensagens de texto
- [ ] Mensagens aparecem em tempo real (real-time)
- [ ] Mensagens do aluno marcadas como lidas ao abrir o chat
- [ ] Badge atualiza em tempo real
- [ ] "Sala de Treino" acessível via aba "Mais"
- [ ] Botão "Sala de Treino" no dashboard continua funcionando
- [ ] Deep link de push notification abre o chat correto
- [ ] Sem novos erros de TypeScript
- [ ] Todos os testes existentes passando

## Edge Cases
- Trainer sem alunos → empty state "Você ainda não tem alunos"
- Aluno sem mensagens → mostra card com "Iniciar conversa"
- Mensagem muito longa → truncar no preview do card (1 linha)
- Push notification recebida com app em foreground → atualizar lista, não mostrar toast
- Aluno desativado → não aparece na lista de conversas
- Muitas conversas (50+) → FlatList performática com lazy rendering

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `timeAgo(dateStr)` — retorna "agora", "Xmin", "Xh", "Xd", "Xsem"
- [ ] `getInitials(name)` — "Ana Silva" → "AS", "Carlos" → "C"
- [ ] Ordenação de conversas — com mensagens por recência, sem mensagens alfabético
- [ ] `getMessagePreview(message)` — texto, "Enviou uma imagem", null handling

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
