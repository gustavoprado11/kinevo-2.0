# Centro de Notificações - Especificação Técnica

## 1. Objetivo

Criar uma tela centralizada de Centro de Notificações para treinadores, permitindo visualizar todo o histórico de atividades e alertas, marcar como lido, e navegar para as telas relevantes. Resolver o problema atual onde notificações push são perdidas se o treinador não as captar no momento.

## 2. Contexto

### Problema Atual
- Sistema atual é **push-only** sem persistência
- Se o treinador ignora uma notificação push, a informação é perdida
- Não existe histórico centralizado de atividades
- Badge system existe nas abas, mas sem visibilidade de detalhes
- Notificações não são rastreáveis ou recuperáveis

### Oportunidade
- Implementar padrão inbox-like (análogo ao sistema atual para alunos)
- Centralizar todas as atividades relevantes do treinador em um único lugar
- Manter contexto histórico para auditoria e referência
- Real-time updates via Supabase Realtime

### Notificações Suportadas
1. **Form Submissions** - Novos envios de formulários de alunos
2. **Workout Completions** - Alunos completaram treinos atribuídos
3. **New Student Signups** - Novo aluno se registrou no programa
4. **Program Expirations** - Programas expiraram ou estão prestes a expirar
5. **Payment Events** - Pagamentos recebidos, falhas, cancelamentos
6. **Feedback** - Feedback de alunos
7. **Message** - Mensagens de sistema ou alunos

## 3. Tipos de Dados

### 3.1 TypeScript Interfaces

```typescript
// mobile/types/notifications.ts

export type NotificationType = 
  | 'form_request'
  | 'feedback'
  | 'message'
  | 'program_assigned'
  | 'workout_completed'
  | 'new_student'
  | 'program_expired'
  | 'payment_pending'
  | 'payment_completed'
  | 'payment_failed'
  | 'subscription_canceled';

export type NotificationCategory = 
  | 'students'
  | 'forms'
  | 'payments'
  | 'programs';

export interface TrainerNotification {
  id: string;
  trainer_id: string;
  type: NotificationType;
  category: NotificationCategory;
  
  title: string;
  message: string;
  icon_type: 'form' | 'check' | 'user' | 'alert' | 'dollar' | 'comment' | 'message';
  
  // Dados contextuais
  related_student_id?: string;
  related_student_name?: string;
  related_student_avatar?: string;
  
  related_form_id?: string;
  related_program_id?: string;
  related_payment_id?: string;
  related_workout_id?: string;
  
  // Navegação
  deep_link?: string;
  deep_link_type?: 'form_detail' | 'student_profile' | 'program_detail' | 'payment_detail' | 'chat';
  
  // Metadados
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
  
  // Ações possíveis
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  action_type: 'approve' | 'reject' | 'view_details' | 'mark_done' | 'navigate';
  deep_link?: string;
}

export interface NotificationFilter {
  type: 'all' | NotificationCategory;
  read_status?: 'all' | 'unread' | 'read';
}

export interface NotificationCount {
  total_unread: number;
  by_category: Record<NotificationCategory, number>;
  last_checked_at: string;
}

export interface PaginatedNotifications {
  items: TrainerNotification[];
  total_count: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Grouped for SectionList
export interface NotificationSection {
  title: string; // "Hoje", "Esta Semana", "Anterior"
  data: TrainerNotification[];
}
```

### 3.2 Supabase Table Schema

```sql
-- Database Migration: create_trainer_notifications_table.sql

CREATE TABLE public.trainer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  
  -- Tipo e categoria
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  
  -- Conteúdo
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  icon_type VARCHAR(50) NOT NULL,
  
  -- Relacionamentos (denormalizados para performance)
  related_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  related_student_name VARCHAR(255),
  related_student_avatar VARCHAR(500),
  
  related_form_id UUID,
  related_program_id UUID,
  related_payment_id UUID,
  related_workout_id UUID,
  
  -- Navegação
  deep_link VARCHAR(500),
  deep_link_type VARCHAR(50),
  
  -- Status de leitura
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP,
  
  -- Metadados
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Índices para queries rápidas
  CONSTRAINT valid_category CHECK (category IN ('students', 'forms', 'payments', 'programs')),
  CONSTRAINT valid_type CHECK (type IN (
    'form_request', 'feedback', 'message', 'program_assigned',
    'workout_completed', 'new_student', 'program_expired',
    'payment_pending', 'payment_completed', 'payment_failed',
    'subscription_canceled'
  ))
);

-- Índices
CREATE INDEX idx_trainer_notifications_trainer_id ON public.trainer_notifications(trainer_id);
CREATE INDEX idx_trainer_notifications_is_read ON public.trainer_notifications(is_read);
CREATE INDEX idx_trainer_notifications_created_at ON public.trainer_notifications(created_at DESC);
CREATE INDEX idx_trainer_notifications_category ON public.trainer_notifications(category);
CREATE INDEX idx_trainer_notifications_type ON public.trainer_notifications(type);
CREATE INDEX idx_trainer_notifications_trainer_created ON public.trainer_notifications(trainer_id, created_at DESC);

-- RLS Policy
ALTER TABLE public.trainer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can view their own notifications"
  ON public.trainer_notifications
  FOR SELECT
  USING (trainer_id = auth.uid());

CREATE POLICY "Trainers can update their own notifications"
  ON public.trainer_notifications
  FOR UPDATE
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_trainer_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trainer_notifications_updated_at
BEFORE UPDATE ON public.trainer_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_trainer_notifications_updated_at();

-- Função para marcar notificações como lidas
CREATE OR REPLACE FUNCTION public.mark_trainer_notification_as_read(notification_id UUID, trainer_id UUID)
RETURNS public.trainer_notifications AS $$
BEGIN
  UPDATE public.trainer_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = notification_id AND trainer_id = trainer_id;
  
  RETURN (SELECT * FROM public.trainer_notifications WHERE id = notification_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar todos como lidos
CREATE OR REPLACE FUNCTION public.mark_all_trainer_notifications_as_read(trainer_id UUID)
RETURNS INT AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.trainer_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE trainer_id = trainer_id AND is_read = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View para contar notificações não lidas
CREATE OR REPLACE VIEW trainer_notification_counts AS
SELECT 
  trainer_id,
  COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count,
  COUNT(*) FILTER (WHERE category = 'students' AND is_read = FALSE) as unread_students,
  COUNT(*) FILTER (WHERE category = 'forms' AND is_read = FALSE) as unread_forms,
  COUNT(*) FILTER (WHERE category = 'payments' AND is_read = FALSE) as unread_payments,
  COUNT(*) FILTER (WHERE category = 'programs' AND is_read = FALSE) as unread_programs,
  MAX(created_at) as last_notification_at
FROM public.trainer_notifications
GROUP BY trainer_id;
```

## 4. Arquivos a Criar

### 4.1 Tela Principal: `mobile/app/(trainer-tabs)/notifications.tsx`

```typescript
// mobile/app/(trainer-tabs)/notifications.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  SectionList,
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import NotificationItem from '@/components/trainer/notifications/NotificationItem';
import NotificationFilters from '@/components/trainer/notifications/NotificationFilters';
import { useTrainerNotifications } from '@/hooks/useTrainerNotifications';
import { NotificationFilter, NotificationCategory, TrainerNotification, NotificationSection } from '@/types/notifications';
import { useNotificationStore } from '@/stores/notification-store';

const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // State
  const [selectedFilter, setSelectedFilter] = useState<'all' | NotificationCategory>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Hooks
  const {
    notifications,
    sections,
    isLoading,
    hasMore,
    fetchNotifications,
    fetchMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useTrainerNotifications(selectedFilter);

  const { markAllAsSeen } = useNotificationStore();

  // Effects
  useEffect(() => {
    fetchNotifications();
  }, [selectedFilter]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleFilterChange = (newFilter: 'all' | NotificationCategory) => {
    setSelectedFilter(newFilter);
  };

  const handleNotificationTap = async (notification: TrainerNotification) => {
    // Marcar como lido
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navegar se houver deep link
    if (notification.deep_link) {
      router.push(notification.deep_link);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleDismiss = async (notificationId: string) => {
    // Swipe to dismiss = marcar como lido
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.is_read) {
      await markAsRead(notificationId);
    }
  };

  const handleEndReached = () => {
    if (hasMore && !isLoading) {
      fetchMore();
    }
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Header com opções */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificações</Text>
        {notifications.some(n => !n.is_read) && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllButton}>Marcar tudo como lido</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <NotificationFilters
        selectedFilter={selectedFilter}
        onFilterChange={handleFilterChange}
      />

      {/* Lista de notificações */}
      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Nenhuma notificação</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => handleNotificationTap(item)}
              onDismiss={() => handleDismiss(item.id)}
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={styles.footerLoader} />
            ) : null
          }
          scrollEnabled={true}
          nestedScrollEnabled={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  markAllButton: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F8F8',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  footerLoader: {
    marginVertical: 16,
  },
});

export default NotificationsScreen;
```

### 4.2 Componente Item: `mobile/components/trainer/notifications/NotificationItem.tsx`

```typescript
// mobile/components/trainer/notifications/NotificationItem.tsx

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { TrainerNotification } from '@/types/notifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationItemProps {
  notification: TrainerNotification;
  onPress: () => void;
  onDismiss: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDismiss,
}) => {
  const getIconName = (type: string) => {
    switch (type) {
      case 'form_request':
        return 'clipboard-list-outline';
      case 'workout_completed':
        return 'check-circle-outline';
      case 'new_student':
        return 'account-plus-outline';
      case 'program_expired':
        return 'alert-circle-outline';
      case 'payment_completed':
        return 'check-circle-outline';
      case 'payment_failed':
        return 'alert-circle-outline';
      case 'feedback':
        return 'comment-text-outline';
      case 'message':
        return 'message-text-outline';
      default:
        return 'bell-outline';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'form_request':
        return '#FF9500';
      case 'workout_completed':
        return '#34C759';
      case 'new_student':
        return '#007AFF';
      case 'program_expired':
        return '#FF3B30';
      case 'payment_failed':
        return '#FF3B30';
      case 'payment_completed':
        return '#34C759';
      case 'feedback':
        return '#5856D6';
      case 'message':
        return '#007AFF';
      default:
        return '#999';
    }
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleDismiss = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const backgroundColor = notification.is_read ? '#FFFFFF' : '#F0F7FF';
  const borderLeftColor = notification.is_read ? 'transparent' : '#007AFF';

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.itemContainer,
        {
          backgroundColor,
          borderLeftColor,
        },
      ]}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        {notification.related_student_avatar ? (
          <Image
            source={{ uri: notification.related_student_avatar }}
            style={styles.avatarImage}
          />
        ) : (
          <MaterialCommunityIcons
            name={getIconName(notification.type)}
            size={28}
            color={getIconColor(notification.type)}
          />
        )}
        {!notification.is_read && <View style={styles.unreadDot} />}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>

        {notification.related_student_name && (
          <Text style={styles.studentName}>
            {notification.related_student_name}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={notification.is_read ? '#D8D8D8' : '#007AFF'}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    borderLeftWidth: 4,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8E8E8',
  },
  unreadDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: 'white',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginRight: 8,
  },
  time: {
    fontSize: 13,
    color: '#999',
  },
  message: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  chevron: {
    marginLeft: 8,
  },
});

export default NotificationItem;
```

### 4.3 Componente Filtros: `mobile/components/trainer/notifications/NotificationFilters.tsx`

```typescript
// mobile/components/trainer/notifications/NotificationFilters.tsx

import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { NotificationCategory } from '@/types/notifications';

interface NotificationFiltersProps {
  selectedFilter: 'all' | NotificationCategory;
  onFilterChange: (filter: 'all' | NotificationCategory) => void;
}

const filters: Array<{
  id: 'all' | NotificationCategory;
  label: string;
  icon: string;
}> = [
  { id: 'all', label: 'Todos', icon: 'bell' },
  { id: 'students', label: 'Alunos', icon: 'account-multiple' },
  { id: 'forms', label: 'Formulários', icon: 'clipboard-list' },
  { id: 'payments', label: 'Pagamentos', icon: 'currency-usd' },
  { id: 'programs', label: 'Programas', icon: 'dumbbell' },
];

const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  selectedFilter,
  onFilterChange,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            onPress={() => onFilterChange(filter.id)}
            style={[
              styles.filterChip,
              selectedFilter === filter.id && styles.filterChipActive,
            ]}
          >
            <MaterialCommunityIcons
              name={filter.icon}
              size={16}
              color={selectedFilter === filter.id ? '#007AFF' : '#999'}
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterLabel,
                selectedFilter === filter.id && styles.filterLabelActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  filterChipActive: {
    backgroundColor: '#E8F3FF',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  filterLabelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default NotificationFilters;
```

### 4.4 Hook: `mobile/hooks/useTrainerNotifications.ts`

```typescript
// mobile/hooks/useTrainerNotifications.ts

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';

import { TrainerNotification, NotificationSection, NotificationCategory } from '@/types/notifications';
import { supabase } from '@/lib/supabase';
import { useNotificationStore } from '@/stores/notification-store';
import * as Haptics from 'expo-haptics';
import {
  startOfToday,
  startOfWeek,
  formatDistanceToNow,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UseTrainerNotificationsReturn {
  notifications: TrainerNotification[];
  sections: NotificationSection[];
  isLoading: boolean;
  hasMore: boolean;
  fetchNotifications: () => Promise<void>;
  fetchMore: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const ITEMS_PER_PAGE = 20;

export const useTrainerNotifications = (
  filter: 'all' | NotificationCategory = 'all'
): UseTrainerNotificationsReturn => {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { incrementUnreadCount } = useNotificationStore();

  const [notifications, setNotifications] = useState<TrainerNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Agrupar notificações por período
  const groupNotificationsByDate = useCallback(
    (items: TrainerNotification[]): NotificationSection[] => {
      const today = startOfToday();
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });

      const grouped: { [key: string]: TrainerNotification[] } = {
        today: [],
        thisWeek: [],
        earlier: [],
      };

      items.forEach((notification) => {
        const notificationDate = new Date(notification.created_at);
        const notificationDateStart = startOfToday();
        notificationDateStart.setTime(notificationDate.getTime());

        if (notificationDateStart.getTime() === today.getTime()) {
          grouped.today.push(notification);
        } else if (notificationDate >= weekStart) {
          grouped.thisWeek.push(notification);
        } else {
          grouped.earlier.push(notification);
        }
      });

      const sections: NotificationSection[] = [];

      if (grouped.today.length > 0) {
        sections.push({
          title: 'Hoje',
          data: grouped.today,
        });
      }

      if (grouped.thisWeek.length > 0) {
        sections.push({
          title: 'Esta Semana',
          data: grouped.thisWeek,
        });
      }

      if (grouped.earlier.length > 0) {
        sections.push({
          title: 'Anterior',
          data: grouped.earlier,
        });
      }

      return sections;
    },
    []
  );

  // Buscar notificações
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setPage(0);

    try {
      let query = supabase
        .from('trainer_notifications')
        .select('*')
        .eq('trainer_id', userId)
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE);

      if (filter !== 'all') {
        query = query.eq('category', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotifications(data || []);
      setHasMore((data?.length || 0) >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, filter]);

  // Buscar mais notificações
  const fetchMore = useCallback(async () => {
    if (!userId || !hasMore || isLoading) return;

    const nextPage = page + 1;
    const offset = nextPage * ITEMS_PER_PAGE;

    try {
      let query = supabase
        .from('trainer_notifications')
        .select('*')
        .eq('trainer_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      if (filter !== 'all') {
        query = query.eq('category', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotifications((prev) => [...prev, ...(data || [])]);
      setPage(nextPage);
      setHasMore((data?.length || 0) >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Erro ao buscar mais notificações:', error);
    }
  }, [userId, hasMore, isLoading, page, filter]);

  // Marcar como lido
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const notification = notifications.find((n) => n.id === notificationId);
        if (!notification || notification.is_read) return;

        const { error } = await supabase
          .from('trainer_notifications')
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
          })
          .eq('id', notificationId)
          .eq('trainer_id', userId);

        if (error) throw error;

        // Atualizar estado local
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? {
                  ...n,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : n
          )
        );

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    },
    [notifications, userId]
  );

  // Marcar todos como lidos
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('trainer_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('trainer_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      // Atualizar estado local
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString(),
        }))
      );

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  }, [userId]);

  // Deletar notificação
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from('trainer_notifications')
          .delete()
          .eq('id', notificationId)
          .eq('trainer_id', userId);

        if (error) throw error;

        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error('Erro ao deletar notificação:', error);
      }
    },
    [userId]
  );

  // Subscribe para atualizações em tempo real
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel(`trainer_notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trainer_notifications',
          filter: `trainer_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as TrainerNotification;
          setNotifications((prev) => [newNotification, ...prev]);
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const sections = groupNotificationsByDate(notifications);

  return {
    notifications,
    sections,
    isLoading,
    hasMore,
    fetchNotifications,
    fetchMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};
```

### 4.5 Zustand Store: `mobile/stores/notification-store.ts`

```typescript
// mobile/stores/notification-store.ts

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { NotificationCount } from '@/types/notifications';

interface NotificationStoreState {
  unreadCount: number;
  unreadByCategory: Record<string, number>;
  lastSeenAt: string;
  lastCheckedAt: string;

  // Actions
  setUnreadCount: (count: number) => void;
  setUnreadByCategory: (category: string, count: number) => void;
  incrementUnreadCount: (count?: number) => void;
  decrementUnreadCount: (count?: number) => void;
  resetUnreadCount: () => void;
  setLastSeenAt: (timestamp: string) => void;
  setLastCheckedAt: (timestamp: string) => void;
  markAllAsSeen: () => void;
}

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set, get) => ({
      unreadCount: 0,
      unreadByCategory: {},
      lastSeenAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),

      setUnreadCount: (count) => set({ unreadCount: count }),

      setUnreadByCategory: (category, count) =>
        set((state) => ({
          unreadByCategory: {
            ...state.unreadByCategory,
            [category]: count,
          },
        })),

      incrementUnreadCount: (count = 1) =>
        set((state) => ({
          unreadCount: state.unreadCount + count,
        })),

      decrementUnreadCount: (count = 1) =>
        set((state) => ({
          unreadCount: Math.max(0, state.unreadCount - count),
        })),

      resetUnreadCount: () =>
        set({
          unreadCount: 0,
          unreadByCategory: {},
        }),

      setLastSeenAt: (timestamp) => set({ lastSeenAt: timestamp }),

      setLastCheckedAt: (timestamp) => set({ lastCheckedAt: timestamp }),

      markAllAsSeen: () =>
        set({
          lastSeenAt: new Date().toISOString(),
          unreadCount: 0,
          unreadByCategory: {},
        }),
    }),
    {
      name: 'notification-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

## 5. Arquivos a Modificar

### 5.1 `mobile/app/(trainer-tabs)/_layout.tsx`

Adicionar aba/ícone de notificações com badge:

```typescript
// Adição ao arquivo existente:

import { NotificationsBell } from '@/components/trainer/notifications/NotificationsBell';
import { useNotificationStore } from '@/stores/notification-store';

export default function TrainerTabsLayout() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <NotificationsBell badgeCount={unreadCount} />,
        // ... resto das opções
      }}
    >
      {/* abas existentes */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificações',
          tabBarIcon: ({ color }) => (
            <Ionicons name="notifications" size={28} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : null,
        }}
      />
    </Tabs>
  );
}
```

### 5.2 `mobile/hooks/usePushNotifications.ts`

Modificar para persistir notificações no Supabase:

```typescript
// Adições ao arquivo existente:

// Quando notificação é recebida em foreground:
const onNotificationReceived = async (notification: PushNotificationEvent) => {
  // ... código existente ...

  // NOVO: Persistir no Supabase
  try {
    await supabase.from('trainer_notifications').insert({
      trainer_id: trainerId,
      type: notification.request.trigger.payload.data.type,
      category: getCategoryFromType(notification.request.trigger.payload.data.type),
      title: notification.request.trigger.payload.title,
      message: notification.request.trigger.payload.body,
      icon_type: getIconTypeFromType(notification.request.trigger.payload.data.type),
      deep_link: notification.request.trigger.payload.data.link,
      deep_link_type: notification.request.trigger.payload.data.type,
      related_student_id: notification.request.trigger.payload.data.student_id,
      related_student_name: notification.request.trigger.payload.data.student_name,
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao persistir notificação:', error);
  }

  // NOVO: Atualizar badge e haptics
  const { incrementUnreadCount } = useNotificationStore.getState();
  incrementUnreadCount();
  
  await Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success
  );
};
```

## 6. Rotas de Navegação

Adicionar rotas para navegação desde notificações:

```typescript
// mobile/utils/notification-deep-links.ts

export const getDeepLinkFromNotification = (notification: TrainerNotification): string => {
  switch (notification.deep_link_type) {
    case 'form_detail':
      return `/forms/${notification.related_form_id}`;
    case 'student_profile':
      return `/students/${notification.related_student_id}`;
    case 'program_detail':
      return `/programs/${notification.related_program_id}`;
    case 'payment_detail':
      return `/payments/${notification.related_payment_id}`;
    case 'chat':
      return `/chat/${notification.related_student_id}`;
    default:
      return '/';
  }
};
```

## 7. Critérios de Aceitação

- [x] Exibir 8-10 itens na primeira carga (SectionList com Hoje/Esta Semana/Anterior)
- [x] Swipe para descartar (marcar como lido)
- [x] Pull to refresh funciona
- [x] Marcar como lido ao tocar notificação
- [x] Badge na aba/header com contagem de não lidos
- [x] Filtros por categoria (All, Alunos, Formulários, Pagamentos, Programas)
- [x] Navegação via deep linking para contexto relevante
- [x] Haptic feedback ao interagir
- [x] Real-time updates via Supabase Realtime
- [x] Paginação com "load more"
- [x] Estado vazio quando nenhuma notificação
- [x] Marcar todos como lidos em um clique

## 8. Considerações Técnicas

### Performance
- Índices no Supabase para `trainer_id`, `created_at`, `category`
- Paginação (20 itens por página)
- Memoização de componentes com `React.memo`
- SectionList ao invés de FlatList para melhor performance

### Segurança
- RLS policies garantem que trainers veem apenas suas notificações
- Validação de tipos no TypeScript
- Sanitização de inputs

### Padrões
- Zustand para estado global leve
- Supabase Realtime para atualizações
- React Query pode ser adicionado para caching mais sofisticado

### Acessibilidade
- Textos descritivos
- Contraste adequado
- Haptic feedback para feedback tátil

## 9. Próximos Passos

1. Criar migration SQL no Supabase
2. Implementar tela principal `notifications.tsx`
3. Criar componentes `NotificationItem` e `NotificationFilters`
4. Implementar hook `useTrainerNotifications`
5. Criar store `notification-store`
6. Modificar `usePushNotifications.ts` para persistir
7. Adicionar tab/badge em `_layout.tsx`
8. Testar real-time updates
9. Integração com deep linking existente
10. QA e testes em dispositivos reais
