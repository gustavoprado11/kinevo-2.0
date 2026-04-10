# Especificação Técnica 05: Cache Offline com MMKV

## Objetivo

Implementar uma camada de cache robusta utilizando MMKV como backend de persistência, permitindo que dados essenciais estejam disponíveis offline e que telas carreguem instantaneamente a partir do cache, enquanto atualizam em background seguindo o padrão **stale-while-revalidate**. Isso elimina spinners de loading desnecessários e melhora a experiência do usuário em conexões lentas ou instáveis.

## Contexto Atual

### Problema Identificado
- **Toda screen que monta dispara uma chamada API**: Não há mecanismo de cache entre componentes
- **Loading spinners obrigatórios**: Usuário vê spinner mesmo para dados que foram buscados segundos atrás
- **Sem suporte offline**: Quando sem conexão, a tela fica vazia ou mostra erro
- **Desperdício de requisições**: Múltiplos usuários podem estar solicitando os mesmos dados simultaneamente

### Estado Atual
```typescript
// Padrão em TODOS os hooks (useTrainerStudentsList, useExerciseLibrary, etc.)
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState(null);

const fetchData = useCallback(async () => {
  // Sem cache: sempre chamada a API
  const result = await supabase.rpc('function_name', { params });
  setData(result);
}, []);

useEffect(() => {
  fetchData(); // No mount, sempre busca
}, []);
```

### Backend de Armazenamento Existente
A aplicação já utiliza MMKV + Zustand com sucesso em `mobile/stores/training-room-store.ts`:

```typescript
const storageBackend: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => mmkv.delete(name),
};
```

### Detecção de Status Online/Offline
A aplicação possui `useNetworkStatus` hook que retorna:
```typescript
{ isConnected: boolean; wasDisconnected: boolean }
```

## Solução Proposta

### Padrão: Stale-While-Revalidate (SWR)
```
1. [Imediatamente] Retorna dados cacheados se existem
2. [Em background] Inicia busca da API
3. [Quando terminar] Atualiza dados se diferentes do cache
4. [Sempre] Mostra indicador "Atualizando..." enquanto background refresh
```

**Benefício**: Usuário vê dados imediatamente, não espera por API.

## Arquivos a Criar

### 1. `mobile/lib/cache.ts` — Utilitário de Cache Genérico

Wrapper funcional ao redor de MMKV com suporte a TTL (Time To Live).

```typescript
import { MMKV } from 'react-native-mmkv';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

interface CacheOptions {
  key: string;
  ttl?: number; // em milissegundos, default: nunca expira
}

// Singleton instance
const mmkv = new MMKV();

/**
 * Recupera dados do cache com validação de TTL
 * @returns { data, timestamp } ou null se expirado ou não existe
 */
export function getCached<T>(key: string): { data: T; timestamp: number } | null {
  try {
    const raw = mmkv.getString(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();
    const age = now - entry.timestamp;

    // Se TTL definido e expirado, retorna null mas NÃO deleta (deixa para invalidação explícita)
    if (entry.ttl && age > entry.ttl) {
      return null;
    }

    return {
      data: entry.data,
      timestamp: entry.timestamp,
    };
  } catch (error) {
    console.warn(`[Cache] Erro ao recuperar ${key}:`, error);
    return null;
  }
}

/**
 * Armazena dados no cache com timestamp
 */
export function setCache<T>(key: string, data: T, ttl?: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    mmkv.set(key, JSON.stringify(entry));
  } catch (error) {
    console.error(`[Cache] Erro ao armazenar ${key}:`, error);
  }
}

/**
 * Remove uma chave do cache
 */
export function invalidateCache(key: string): void {
  try {
    mmkv.delete(key);
  } catch (error) {
    console.error(`[Cache] Erro ao invalidar ${key}:`, error);
  }
}

/**
 * Remove todas as chaves que começam com um prefixo
 * Útil para invalidar um "domínio" de dados (ex: todos os caches de um estudante)
 */
export function invalidateByPrefix(prefix: string): void {
  try {
    const allKeys = mmkv.getAllKeys();
    allKeys.forEach((key) => {
      if (key.startsWith(prefix)) {
        mmkv.delete(key);
      }
    });
  } catch (error) {
    console.error(`[Cache] Erro ao invalidar prefixo ${prefix}:`, error);
  }
}

/**
 * Retorna informações de debug sobre cache (tamanho, número de chaves)
 */
export function getCacheStats(): { totalKeys: number; estimatedSize: string } {
  try {
    const allKeys = mmkv.getAllKeys();
    let totalSize = 0;
    allKeys.forEach((key) => {
      const value = mmkv.getString(key);
      if (value) totalSize += value.length;
    });

    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    return {
      totalKeys: allKeys.length,
      estimatedSize: `${sizeInMB} MB`,
    };
  } catch (error) {
    console.warn('[Cache] Erro ao calcular stats:', error);
    return { totalKeys: 0, estimatedSize: '0 MB' };
  }
}

/**
 * Limpa TODOS os caches
 * ⚠️ Usar com cuidado, apenas em logout/reset da aplicação
 */
export function clearAllCache(): void {
  try {
    mmkv.clearAll();
    console.log('[Cache] Cache completo limpo');
  } catch (error) {
    console.error('[Cache] Erro ao limpar cache:', error);
  }
}

/**
 * Retorna a idade em milissegundos de um cache existente
 */
export function getCacheAge(key: string): number | null {
  try {
    const raw = mmkv.getString(key);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    return Date.now() - entry.timestamp;
  } catch {
    return null;
  }
}
```

### 2. `mobile/lib/cache-keys.ts` — Constantes de Chaves de Cache

Centraliza nomes de chaves para evitar typos e facilitar refatoração.

```typescript
/**
 * Constantes de chaves de cache
 * Padronização: DOMÍNIO:RECURSO:QUALIFICADOR
 * Exemplo: STUDENTS:LIST para lista de estudantes, STUDENT:DETAIL:123 para estudante específico
 */

export const CACHE_KEYS = {
  // Dashboard e visão geral
  TRAINER_DASHBOARD: 'TRAINER:DASHBOARD',

  // Estudantes
  STUDENTS_LIST: 'STUDENTS:LIST',
  STUDENT_DETAIL: (studentId: string) => `STUDENT:DETAIL:${studentId}`,
  STUDENT_EXERCISES: (studentId: string) => `STUDENT:EXERCISES:${studentId}`,
  STUDENT_PERFORMANCE: (studentId: string) => `STUDENT:PERFORMANCE:${studentId}`,

  // Biblioteca de exercícios
  EXERCISE_LIBRARY: 'EXERCISE:LIBRARY',
  EXERCISE_DETAIL: (exerciseId: string) => `EXERCISE:DETAIL:${exerciseId}`,
  EXERCISE_CATEGORIES: 'EXERCISE:CATEGORIES',

  // Planos de treino
  TRAINING_PLAN: (studentId: string) => `TRAINING:PLAN:${studentId}`,
  TRAINING_SESSIONS: (studentId: string) => `TRAINING:SESSIONS:${studentId}`,

  // Métricas e relatórios
  STUDENT_METRICS: (studentId: string, period?: string) =>
    `STUDENT:METRICS:${studentId}:${period || 'ALL'}`,

  // Sala de treino
  TRAINING_ROOM_STATE: 'TRAINING:ROOM:STATE',

  // Cache de prefixos para invalidação em massa
  PREFIX_STUDENT: (studentId: string) => `STUDENT:${studentId}:`,
  PREFIX_EXERCISE: 'EXERCISE:',
  PREFIX_TRAINING: 'TRAINING:',
} as const;

/**
 * Tempos de vida padrão para diferentes tipos de dados
 */
export const CACHE_TTL = {
  VERY_SHORT: 1 * 60 * 1000, // 1 minuto - dados que mudam frequentemente
  SHORT: 2 * 60 * 1000, // 2 minutos - dashboard, dados ao vivo
  MEDIUM: 5 * 60 * 1000, // 5 minutos - lista de estudantes, detalhes
  LONG: 30 * 60 * 1000, // 30 minutos - biblioteca de exercícios (muda raramente)
  VERY_LONG: 60 * 60 * 1000, // 1 hora - categorias, metadados
  PERMANENT: undefined, // Nunca expira, deve ser invalidado manualmente
} as const;
```

### 3. `mobile/hooks/useCachedQuery.ts` — Hook Genérico com SWR

Implementa o padrão stale-while-revalidate para qualquer fetcher.

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, setCache, invalidateCache } from '../lib/cache';
import { useNetworkStatus } from './useNetworkStatus';

interface UseCachedQueryOptions<T> {
  /** Chave única para armazenamento em cache */
  cacheKey: string;

  /** Função assíncrona que busca os dados da API */
  fetcher: () => Promise<T>;

  /** Time-to-live em milissegundos (default: 5 minutos) */
  ttl?: number;

  /** Se false, não executa nenhuma busca (default: true) */
  enabled?: boolean;

  /** Callback quando dados são atualizados */
  onSuccess?: (data: T) => void;

  /** Callback quando erro ocorre */
  onError?: (error: Error) => void;
}

interface UseCachedQueryReturn<T> {
  /** Dados do cache ou resultado da última busca bem-sucedida */
  data: T | null;

  /** True se carregando do cache E nenhum cache existe */
  isLoading: boolean;

  /** True se refrescando em background (dados já disponível) */
  isRefreshing: boolean;

  /** True se dados provêm de cache expirado */
  isStale: boolean;

  /** Função para invalidar cache e buscar novamente */
  refresh: () => Promise<void>;

  /** Erro da última tentativa de fetch */
  error: Error | null;

  /** Idade do cache em ms, ou null se sem cache */
  cacheAge: number | null;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

export function useCachedQuery<T>({
  cacheKey,
  fetcher,
  ttl = DEFAULT_TTL,
  enabled = true,
  onSuccess,
  onError,
}: UseCachedQueryOptions<T>): UseCachedQueryReturn<T> {
  const { isConnected } = useNetworkStatus();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  // Rastreia se componente está montado (previne memory leaks)
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Tenta carregar dados do cache
   */
  const loadFromCache = useCallback((): T | null => {
    const cached = getCached<T>(cacheKey);
    if (cached) {
      if (isMountedRef.current) {
        setData(cached.data);
        setCacheAge(Date.now() - cached.timestamp);
      }
      return cached.data;
    }
    return null;
  }, [cacheKey]);

  /**
   * Busca dados da API e atualiza cache
   */
  const fetchAndUpdateCache = useCallback(
    async (isBackground: boolean = false) => {
      if (!isConnected) {
        // Se offline, não tenta buscar
        return;
      }

      try {
        if (isBackground) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const result = await fetcher();

        if (isMountedRef.current) {
          setData(result);
          setCacheAge(0);
          setError(null);
          setIsStale(false);
          setCache(cacheKey, result, ttl);
          onSuccess?.(result);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (isMountedRef.current) {
          setError(error);
          onError?.(error);
        }
      } finally {
        if (isMountedRef.current) {
          if (isBackground) {
            setIsRefreshing(false);
          } else {
            setIsLoading(false);
          }
        }
      }
    },
    [cacheKey, fetcher, ttl, isConnected, onSuccess, onError]
  );

  /**
   * Estratégia inicial: SWR
   * 1. Carrega cache imediatamente
   * 2. Se offline ou cache existe, apenas carrega cache
   * 3. Se online, inicia fetch em background
   */
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const cached = loadFromCache();

    if (cached && !isConnected) {
      // Offline e tem cache: use cache, sem loading spinner
      setIsLoading(false);
      setIsRefreshing(false);
    } else if (cached) {
      // Online e tem cache: use cache imediatamente, refresh em background
      setIsLoading(false);
      setIsRefreshing(true);
      fetchAndUpdateCache(true); // background = true
    } else {
      // Sem cache: precisa buscar (pode estar offline)
      if (!isConnected) {
        // Offline e sem cache: mostra loading, mas sem esperança de sucesso
        setIsLoading(false);
        setIsStale(true);
      } else {
        // Online e sem cache: busca normalmente
        fetchAndUpdateCache(false); // background = false
      }
    }
  }, [enabled, cacheKey, isConnected, loadFromCache, fetchAndUpdateCache]);

  /**
   * Função para invalidar cache e buscar novamente
   */
  const refresh = useCallback(async () => {
    if (!enabled) return;

    invalidateCache(cacheKey);
    setCacheAge(null);
    setIsStale(false);

    if (isConnected) {
      await fetchAndUpdateCache(false);
    }
  }, [enabled, cacheKey, isConnected, fetchAndUpdateCache]);

  return {
    data,
    isLoading,
    isRefreshing,
    isStale,
    refresh,
    error,
    cacheAge,
  };
}
```

## Arquivos a Modificar

### Modificações com Exemplo Antes/Depois

#### `mobile/hooks/useTrainerStudentsList.ts`

**ANTES:**
```typescript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useTrainerStudentsList() {
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStudents = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('get_trainer_students', {
        trainer_id: userId,
      });
      setStudents(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStudents().finally(() => setLoading(false));
  }, []);

  return { students, loading, refreshing, error };
}
```

**DEPOIS:**
```typescript
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL } from '../lib/cache-keys';

export function useTrainerStudentsList() {
  const userId = useAuth().user?.id; // Assumindo que existe hook de auth

  const { data: students, isLoading, isRefreshing, error, refresh } =
    useCachedQuery({
      cacheKey: CACHE_KEYS.STUDENTS_LIST,
      fetcher: useCallback(async () => {
        const { data } = await supabase.rpc('get_trainer_students', {
          trainer_id: userId,
        });
        return data;
      }, [userId]),
      ttl: CACHE_TTL.MEDIUM, // 5 minutos
    });

  return {
    students,
    loading: isLoading,
    refreshing: isRefreshing,
    error,
    refresh, // Novo: permite refresh manual
  };
}
```

#### `mobile/hooks/useTrainerDashboard.ts`

**DEPOIS:**
```typescript
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL } from '../lib/cache-keys';

export function useTrainerDashboard() {
  const userId = useAuth().user?.id;

  const { data: dashboard, isLoading, isRefreshing, refresh } =
    useCachedQuery({
      cacheKey: CACHE_KEYS.TRAINER_DASHBOARD,
      fetcher: useCallback(async () => {
        const { data } = await supabase.rpc('get_trainer_dashboard', {
          trainer_id: userId,
        });
        return data;
      }, [userId]),
      ttl: CACHE_TTL.SHORT, // 2 minutos - dashboard muda frequentemente
    });

  return { dashboard, isLoading, isRefreshing, refresh };
}
```

#### `mobile/hooks/useExerciseLibrary.ts`

```typescript
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL } from '../lib/cache-keys';

export function useExerciseLibrary() {
  const { data: exercises, isLoading, isRefreshing, refresh } =
    useCachedQuery({
      cacheKey: CACHE_KEYS.EXERCISE_LIBRARY,
      fetcher: useCallback(async () => {
        const { data } = await supabase.rpc('get_exercise_library');
        return data;
      }, []),
      ttl: CACHE_TTL.LONG, // 30 minutos - exercícios mudam raramente
    });

  return { exercises, isLoading, isRefreshing, refresh };
}
```

#### `mobile/hooks/useStudentDetail.ts`

```typescript
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL } from '../lib/cache-keys';

export function useStudentDetail(studentId: string) {
  const { data: student, isLoading, isRefreshing, refresh, isStale } =
    useCachedQuery({
      cacheKey: CACHE_KEYS.STUDENT_DETAIL(studentId),
      fetcher: useCallback(async () => {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .single();
        return data;
      }, [studentId]),
      ttl: CACHE_TTL.MEDIUM, // 5 minutos
      enabled: !!studentId, // Só busca se studentId existe
    });

  return {
    student,
    isLoading,
    isRefreshing,
    isStale,
    refresh,
  };
}
```

## Padrões de Invalidação

### Invalidação em Mutations

Sempre que dados são alterados (criar, atualizar, deletar), o cache deve ser invalidado:

```typescript
// Exemplo: Criar novo estudante
async function createStudent(data: StudentData) {
  const result = await supabase
    .from('students')
    .insert([data]);

  // Invalidar lista após mutação
  invalidateCache(CACHE_KEYS.STUDENTS_LIST);

  // Ou invalidar tudo relacionado a estudantes
  invalidateByPrefix(CACHE_KEYS.PREFIX_EXERCISE);

  return result;
}

// Exemplo: Atualizar exercício
async function updateExercise(exerciseId: string, updates: Partial<Exercise>) {
  const result = await supabase
    .from('exercises')
    .update(updates)
    .eq('id', exerciseId);

  // Invalidar biblioteca completa se exercício é importante
  invalidateCache(CACHE_KEYS.EXERCISE_LIBRARY);
  invalidateCache(CACHE_KEYS.EXERCISE_DETAIL(exerciseId));

  return result;
}
```

## Padrão: Componente com Cache e Status Offline

```typescript
import React from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { useTrainerStudentsList } from '../hooks/useTrainerStudentsList';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function StudentListScreen() {
  const { students, loading, refreshing, refresh } = useTrainerStudentsList();
  const { isConnected, wasDisconnected } = useNetworkStatus();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View>
      {/* Mostrar indicador de conexão perdida */}
      {wasDisconnected && !isConnected && (
        <ConnectionBanner status="disconnected" />
      )}

      {/* Mostrar que está atualizando em background */}
      {refreshing && <Text style={styles.refreshing}>Atualizando...</Text>}

      <FlatList
        data={students}
        renderItem={({ item }) => <StudentCard student={item} />}
        onRefresh={refresh} // Pull-to-refresh
        refreshing={refreshing}
      />
    </View>
  );
}
```

## Integração com ConnectionBanner (Spec 05)

O `ConnectionBanner` existente detecta offline status. O cache funciona em sinergia:

```typescript
export function ConnectionBanner() {
  const { isConnected, wasDisconnected } = useNetworkStatus();

  if (!wasDisconnected && isConnected) return null; // Online, sem problemas

  return (
    <Banner
      visible={!isConnected || wasDisconnected}
      actions={[{ label: 'Fechar' }]}
      style={{
        backgroundColor: isConnected ? '#fff3cd' : '#f8d7da',
      }}
    >
      {!isConnected
        ? 'Sem conexão. Exibindo dados em cache.'
        : 'Conexão restaurada. Atualizando dados...'}
    </Banner>
  );
}
```

## Gerenciamento de Memória

### Limite de Tamanho de Cache

Implementar em um app service ou hook de startup:

```typescript
export function trimCacheIfNeeded() {
  const stats = getCacheStats();
  const sizeInMB = parseFloat(stats.estimatedSize);

  // Se cache > 50 MB, remove entradas expiradas
  if (sizeInMB > 50) {
    const allKeys = mmkv.getAllKeys();
    let removed = 0;

    allKeys.forEach((key) => {
      const cached = getCached(key);
      if (!cached) {
        // Já expirou, remove
        invalidateCache(key);
        removed++;
      }
    });

    console.log(`[Cache] Limpeza: ${removed} entradas removidas`);
  }
}
```

### Limpeza no Logout

```typescript
export function handleLogout() {
  clearAllCache(); // Limpar todo cache sensível
  // Depois fazer logout normal
}
```

## Critérios de Aceitação

- [ ] **Cache.ts implementado**: Funções getCached, setCache, invalidateCache, invalidateByPrefix funcionam corretamente
- [ ] **Cache-keys.ts centralizado**: Todas as chaves constantes, sem strings hardcoded nos hooks
- [ ] **useCachedQuery.ts implementado**: Hook genérico segue padrão SWR, suporta TTL customizável
- [ ] **Exemplo completo**: Pelo menos 3 hooks (useTrainerStudentsList, useExerciseLibrary, useStudentDetail) migrados com código antes/depois
- [ ] **Integração offline**: useCachedQuery respeita `isConnected` de useNetworkStatus
- [ ] **Invalidação em mutations**: Padrão documentado e exemplificado para CREATE/UPDATE/DELETE
- [ ] **Sem memory leaks**: useCachedQuery usa isMountedRef para prevenir setState após unmount
- [ ] **Testes unitários**: Cache.ts possui testes para expiração TTL, invalidação, e recovery de erros
- [ ] **Documentação de uso**: Arquivo com guia de quando usar cache vs. refresh, e como debugar
- [ ] **Monitoramento**: getCacheStats() funciona, pode-se logar estatísticas em startup

## Performance Esperada

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tempo para dados aparecer na tela | ~2-4s (rede) | ~100-200ms (cache) |
| Loading spinner visível | ~100% dos loads | ~5% (apenas sem cache) |
| Requisições repetidas em 5 min | 10+ chamadas | 1 chamada + 1 refresh BG |
| Funcionalidade offline | ❌ Não | ✅ Sim |
| Consumo de bateria | Alto (requests freqüentes) | Reduzido (menos requests) |

## Próximos Passos

1. Implementar `mobile/lib/cache.ts` com testes
2. Criar `mobile/lib/cache-keys.ts`
3. Implementar `mobile/hooks/useCachedQuery.ts`
4. Migrar hooks um a um (começar pelo mais usado)
5. Adicionar UI para mostrar "Atualizando..." durante background refresh
6. Monitoramento: logar estatísticas de cache em startup
7. Implementar limpeza automática de cache expirado
