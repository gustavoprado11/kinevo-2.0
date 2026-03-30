# Testes — Template Update + Testes Retroativos (Trainer Custom Videos)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

O projeto Kinevo agora possui Vitest + Testing Library + jsdom configurados. Precisamos de duas coisas:

1. Atualizar o `specs/TEMPLATE.md` em ambos os repositórios (web e mobile) para incluir uma seção padrão de testes
2. Criar testes retroativos para a feature de vídeos custom de treinadores (recém-implementada)

A filosofia de testes do Kinevo é **pragmática**: foco em lógica pura, server actions críticas e fluxos de receita. Não testamos layout, navegação ou componentes puramente visuais.

## Objetivo

Garantir que o fluxo SDD inclua testes desde a spec, e que a feature de vídeos custom tenha cobertura nos pontos críticos.

---

## Parte 1: Atualizar `specs/TEMPLATE.md`

Em **ambos os repositórios** (web e mobile), adicionar a seguinte seção no `specs/TEMPLATE.md`, entre "Edge Cases" e "Referências":

```markdown
## Testes Requeridos

Priorize testes por camada de retorno:

### Lógica Pura (unitários — obrigatório)
Funções utilitárias, cálculos, resolvers, helpers, validações.
Sem DOM, sem mocks complexos.
- [ ] (listar funções a testar com cenários)

### Server Actions / Queries (quando houver escrita no banco — recomendado)
Ações que envolvem CRUD, integrações externas, ou lógica de negócio.
Mockar Supabase client e dependências externas.
- [ ] (listar actions a testar com cenários)

### Componentes (apenas fluxos críticos de receita — opcional)
Happy path e edge cases de componentes que impactam pagamento, prescrição ou experiência core.
- [ ] (listar componentes a testar com cenários)

> **Não testar:** páginas inteiras, layout, navegação, componentes puramente visuais.
```

---

## Parte 2: Testes Retroativos — Trainer Custom Videos

### Arquivos de teste a criar

#### Web

**`web/src/lib/__tests__/video-utils.test.ts`**

Testar `isDirectVideoUrl()` (em `web/src/lib/youtube.ts`):
- [ ] Retorna `true` para URL terminando em `.mp4`
- [ ] Retorna `true` para URL terminando em `.mov`
- [ ] Retorna `true` para URL terminando em `.webm`
- [ ] Retorna `true` para URL de Supabase Storage com path de vídeo
- [ ] Retorna `false` para URL do YouTube
- [ ] Retorna `false` para URL do Vimeo
- [ ] Retorna `false` para string vazia
- [ ] Retorna `false` para URL sem extensão de vídeo

Testar `normalizeYouTubeEmbedUrl()` (se não tiver testes ainda):
- [ ] Converte URL padrão do YouTube (`watch?v=`)
- [ ] Converte URL curta (`youtu.be/`)
- [ ] Retorna `null` para URL não-YouTube

**`web/src/lib/__tests__/resolve-exercise-video.test.ts`**

Testar a lógica de resolução de vídeo (identificar onde ela está — pode ser inline nos componentes ou em um helper):
- [ ] Retorna vídeo custom quando `trainerVideo` existe
- [ ] Retorna vídeo padrão do catálogo quando `trainerVideo` é `null`
- [ ] Retorna `null` quando ambos são `null` (exercício sem nenhum vídeo)
- [ ] Vídeo custom com `video_type = 'upload'` retorna URL do Storage
- [ ] Vídeo custom com `video_type = 'external_url'` retorna URL externa

**`web/src/actions/exercises/__tests__/manage-trainer-video.test.ts`**

Testar `saveTrainerVideoMetadata`:
- [ ] Cria registro com `video_type = 'upload'` e `storage_path`
- [ ] Cria registro com `video_type = 'external_url'` sem `storage_path`
- [ ] Atualiza registro existente (upsert) em vez de duplicar
- [ ] Revalida path correto após sucesso

Testar `deleteTrainerVideo`:
- [ ] Deleta arquivo do Storage quando `video_type = 'upload'`
- [ ] Não tenta deletar do Storage quando `video_type = 'external_url'`
- [ ] Deleta registro do banco
- [ ] Falha graceful quando registro não existe
- [ ] Revalida path correto após sucesso

> **Mock pattern:** Mockar `createClient()` do Supabase retornando objetos com `.from().upsert()`, `.from().delete()`, `.storage.from().remove()`. Seguir o padrão de mocks já existente no projeto (investigar se já existe um setup de mocks para Supabase).

#### Mobile

**`mobile/lib/__tests__/video-utils.test.ts`** (ou `mobile/utils/__tests__/youtube.test.ts`)

Testar `isDirectVideoUrl()`:
- [ ] Mesmos cenários do web (MP4, MOV, WebM, Supabase Storage, YouTube, Vimeo, vazio, sem extensão)

Testar `extractYoutubeId()` (se não tiver testes):
- [ ] Extrai ID de URL padrão
- [ ] Extrai ID de URL curta
- [ ] Retorna `null` para URL não-YouTube

**`mobile/hooks/__tests__/video-resolution.test.ts`**

Testar a lógica de resolução de vídeo dentro do `useWorkoutSession` (extrair se necessário):
- [ ] Resolve vídeo custom do treinador quando existe
- [ ] Fallback para vídeo padrão do catálogo
- [ ] Sem vídeo nenhum → retorna `null`/`undefined`

### Estrutura de pastas dos testes

Seguir o padrão `__tests__/` colocated com o módulo:
```
web/src/lib/__tests__/
web/src/actions/exercises/__tests__/
mobile/lib/__tests__/ (ou mobile/utils/__tests__/)
mobile/hooks/__tests__/
```

> **Investigar:** verificar se o projeto já tem algum padrão de pastas de teste estabelecido e seguir o existente.

## Critérios de Aceite

- [ ] `specs/TEMPLATE.md` atualizado em ambos os repos (web + mobile) com a seção "Testes Requeridos"
- [ ] Todos os testes unitários de `isDirectVideoUrl()` passando (web + mobile)
- [ ] Todos os testes de resolução de vídeo passando
- [ ] Testes de server actions `saveTrainerVideoMetadata` e `deleteTrainerVideo` passando
- [ ] Todos os testes rodam com `npx vitest run` sem falhas
- [ ] Sem novos erros de TypeScript
- [ ] Padrão de mocks do Supabase documentado no `CLAUDE.md` (se for criado um novo padrão)

## Restrições Técnicas

- Seguir convenções documentadas no `CLAUDE.md`
- Usar Vitest + Testing Library (já configurados)
- Não instalar bibliotecas de teste adicionais sem necessidade comprovada
- Mocks devem ser mínimos — se uma função pura pode ser testada sem mock, testar sem mock
- Nomes de teste em inglês (padrão de código), descritivos: `it('returns custom video URL when trainer video exists')`

## Edge Cases

- Se `isDirectVideoUrl()` ou a lógica de resolução de vídeo estiver inline em componentes (sem helper separado), **extrair para função pura** antes de testar. Isso é uma refatoração válida dentro do escopo.
- Se o projeto não tiver padrão de mocks para Supabase, criar um helper reutilizável em `web/src/test-utils/` (ou similar) e documentar no `CLAUDE.md`.

## Referências

- Feature implementada: `specs/completed/trainer-custom-videos.md`
- Configuração Vitest: verificar `vitest.config.ts` em cada repo

## Notas de Implementação

_(Preenchido pelo executor durante/após a implementação)_